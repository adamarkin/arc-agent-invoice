import { encodeFunctionData, keccak256 } from "viem";
import { publicClient, idOf, toNative, fromNative, isAddress, $, say, connect, listWallets, ARC } from "./common.js";

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

// Wallet picker (EIP-6963); several extensions make window.ethereum ambiguous.
const sel = $("walletSel");
const fillWallets = () => {
  const ws = listWallets(), cur = sel.value;
  sel.textContent = "";
  const first = document.createElement("option");
  first.value = ""; first.textContent = ws.length > 1 ? "— choose wallet —" : "(auto)";
  sel.append(first);
  for (const w of ws) { const o = document.createElement("option"); o.value = w.uuid; o.textContent = w.name; sel.append(o); }
  if (ws.length === 1) sel.value = ws[0].uuid; else if (cur) sel.value = cur;
};
window.addEventListener("wallets-changed", fillWallets); fillWallets();

// One transaction through the selected wallet: checks the contract's code, simulates (so reverts show
// BEFORE the wallet prompt), sends with explicit gas, waits for the receipt. Button is locked while in flight.
async function send(btn, out, build) {
  btn.disabled = true;
  try {
    const to = getAddr();
    const code = await publicClient.getCode({ address: to });
    if (!code || keccak256(code) !== cfg.runtimeKeccak) throw new Error("Address does not hold the expected AgentInvoice runtime code (keccak mismatch). Refusing to send.");
    const { account, eth } = await connect(sel.value);
    const { data, value = 0n } = await build(account);
    const gas = await publicClient.estimateGas({ account, to, data, value }); // throws with revert reason if it would fail
    say(out, `Confirm in your wallet: ${account} → ${to}  value ${fromNative(value)} USDC, gas ≤ ${gas * 13n / 10n}…`);
    const hash = await eth.request({ method: "eth_sendTransaction", params: [{
      from: account, to, data, value: "0x" + value.toString(16), gas: "0x" + (gas * 13n / 10n).toString(16) }] });
    say(out, "Submitted " + hash + " — waiting…");
    const rc = await publicClient.waitForTransactionReceipt({ hash });
    say(out, `${rc.status === "success" ? "Confirmed" : "FAILED"}: ${ex}/tx/${hash}`, rc.status === "success" ? "ok" : "err");
  } finally { btn.disabled = false; }
}
const enc = (functionName, args) => encodeFunctionData({ abi: ABI, functionName, args });
$("create").onclick = guard($("createOut"), () => send($("create"), $("createOut"), async () => {
  const amt = toNative($("createAmt").value);
  if (amt <= 0n) throw new Error("Amount must be > 0");
  const meta = $("createMeta").value ? idOf($("createMeta").value) : "0x" + "00".repeat(32);
  return { data: enc("createInvoice", [idOf($("createId").value), amt, meta]) };
}));
$("pay").onclick = guard($("payOut"), async () => {
  const inv = await read($("payId").value);
  if (inv.status !== 1) throw new Error("Invoice is not payable: " + STATUS[inv.status]);
  if (!confirm(`Pay exactly ${fromNative(inv.amount)} native USDC to ${inv.payee}?`)) return;
  await send($("pay"), $("payOut"), async () => ({ data: enc("payInvoice", [idOf($("payId").value)]), value: inv.amount }));
});
$("cancel").onclick = guard($("cancelOut"), () => send($("cancel"), $("cancelOut"), async () => ({ data: enc("cancelInvoice", [idOf($("cancelId").value)]) })));
