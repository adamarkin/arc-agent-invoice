import { publicClient, idOf, toNative, fromNative, isAddress, $, say, connect, ARC } from "./common.js";

const ABI = await fetch("./abi.json").then((r) => r.json());
const cfg = await fetch("./config.json").then((r) => r.json());
const STATUS = ["None (not found)", "Active (unpaid)", "Paid", "Cancelled"];
const ex = ARC.blockExplorers.default.url;

let addr = new URLSearchParams(location.hash.slice(1)).get("contract") || cfg.contract || "";
$("contract").value = addr;
const getAddr = () => {
  const a = $("contract").value.trim();
  if (!isAddress(a)) throw new Error("Enter a valid AgentInvoice contract address (0x…). Verify it on the explorer first.");
  return a;
};
const guard = (out, fn) => async () => { try { await fn(); } catch (e) { say(out, (e.shortMessage || e.message || String(e)), "err"); } };

async function read(idStr) {
  return publicClient.readContract({ address: getAddr(), abi: ABI, functionName: "getInvoice", args: [idOf(idStr)] });
}
function show(inv) {
  const rows = [["Status", STATUS[inv.status]], ["Payee", inv.payee], ["Amount (native USDC)", fromNative(inv.amount) + " USDC"],
    ["Metadata hash", inv.metadataHash]];
  if (inv.status === 2) rows.push(["Payer", inv.payer], ["Paid at (unix)", String(inv.paidAt)]);
  const box = $("lookupOut"); box.className = "out"; box.textContent = "";
  for (const [k, v] of rows) { const d = document.createElement("div"); d.textContent = `${k}: ${v}`; box.append(d); }
}

$("lookup").onclick = guard($("lookupOut"), async () => {
  say($("lookupOut"), "Reading from " + ARC.rpcUrls.default.http[0] + " …");
  const cid = await publicClient.getChainId();
  if (cid !== 5042) throw new Error("RPC returned chain " + cid);
  const inv = await read($("lookupId").value);
  if (inv.status === 0) say($("lookupOut"), "No invoice with that id.", "err"); else show(inv);
});

async function send(out, fn) {
  const { wallet, account } = await connect();
  say(out, "Confirm in your wallet…");
  const hash = await fn(wallet, account);
  say(out, "Submitted " + hash + " — waiting…");
  const rc = await publicClient.waitForTransactionReceipt({ hash });
  say(out, `${rc.status === "success" ? "Confirmed" : "FAILED"}: ${ex}/tx/${hash}`, rc.status === "success" ? "ok" : "err");
}
$("create").onclick = guard($("createOut"), () => send($("createOut"), (w, a) => {
  const amt = toNative($("createAmt").value);
  if (amt <= 0n) throw new Error("Amount must be > 0");
  const meta = $("createMeta").value ? idOf($("createMeta").value) : "0x" + "00".repeat(32);
  return w.writeContract({ address: getAddr(), abi: ABI, functionName: "createInvoice", args: [idOf($("createId").value), amt, meta], account: a });
}));
$("pay").onclick = guard($("payOut"), async () => {
  const inv = await read($("payId").value);
  if (inv.status !== 1) throw new Error("Invoice is not payable: " + STATUS[inv.status]);
  if (!confirm(`Pay exactly ${fromNative(inv.amount)} native USDC to ${inv.payee}?`)) return;
  await send($("payOut"), (w, a) => w.writeContract({ address: getAddr(), abi: ABI, functionName: "payInvoice", args: [idOf($("payId").value)], value: inv.amount, account: a }));
});
$("cancel").onclick = guard($("cancelOut"), () => send($("cancelOut"), (w, a) =>
  w.writeContract({ address: getAddr(), abi: ABI, functionName: "cancelInvoice", args: [idOf($("cancelId").value)], account: a })));
