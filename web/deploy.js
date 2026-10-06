import { getContractAddress } from "viem";
import { publicClient, $, say, connect, listWallets, fromNative, ARC } from "./common.js";

// Build-time public client config (not a secret). Empty => Reown disabled.
const REOWN_PROJECT_ID = typeof __REOWN_PROJECT_ID__ === "string" ? __REOWN_PROJECT_ID__ : "";
const art = await fetch("./AgentInvoice.json").then((r) => r.json());
$("sha").textContent = art.bytecodeSha256;

// Full error detail: code, message, shortMessage, details, nested cause chain.
function errText(e) {
  const lines = [];
  let cur = e, depth = 0;
  while (cur && depth < 6) {
    const bits = [];
    if (cur.name) bits.push("name=" + cur.name);
    if (cur.code !== undefined) bits.push("code=" + cur.code);
    if (cur.shortMessage) bits.push("shortMessage=" + cur.shortMessage);
    if (cur.message && cur.message !== cur.shortMessage) bits.push("message=" + cur.message);
    if (cur.details) bits.push("details=" + cur.details);
    if (cur.data !== undefined) { try { bits.push("data=" + JSON.stringify(cur.data)); } catch {} }
    lines.push((depth ? "cause[" + depth + "]: " : "") + (bits.join(" | ") || String(cur)));
    if (cur.reason) lines.push("  reason=" + cur.reason);
    if (cur.info) { try { lines.push("  info=" + JSON.stringify(cur.info)); } catch {} }
    cur = cur.cause || cur.error; depth++; // viem nests under .cause, ethers under .error
  }
  return lines.join("\n");
}

let session = null;
const setDeploy = (on) => { $("deploy").disabled = !on; };
setDeploy(false);

// Wallet list (EIP-6963) for the desktop-extension path.
const sel = $("walletSel");
const fillWallets = () => {
  const ws = listWallets(), cur = sel.value;
  sel.textContent = "";
  const first = document.createElement("option");
  first.value = ""; first.textContent = ws.length ? (ws.length > 1 ? "— choose wallet —" : "(auto)") : "(no extension detected; using window.ethereum if present)";
  sel.append(first);
  for (const w of ws) { const o = document.createElement("option"); o.value = w.uuid; o.textContent = w.name; sel.append(o); }
  if (ws.length === 1) sel.value = ws[0].uuid; else if (cur) sel.value = cur;
};
window.addEventListener("wallets-changed", fillWallets); fillWallets();
const logI = (l) => { $("trace").textContent += new Date().toISOString().slice(11, 19) + " " + l + "\n"; };
const nonces = async (a) => {
  const [latest, pending] = await Promise.all([publicClient.getTransactionCount({ address: a }), publicClient.getTransactionCount({ address: a, blockTag: "pending" })]);
  return { latest, pending };
};

$("check").onclick = async () => {
  const out = $("out");
  setDeploy(false); session = null;
  try {
    say(out, "Connecting wallet (no signature, no transaction)…");
    const { wallet, account, eth } = await connect(sel.value);
    const chainId = await wallet.getChainId();
    const [balance, gasPrice, gas, nonce] = await Promise.all([
      publicClient.getBalance({ address: account }),
      publicClient.getGasPrice(),
      publicClient.estimateGas({ account, data: art.bytecode }),
      nonces(account),
    ]);
    const cost = gas * gasPrice;
    const need = cost * 3n;
    const clean = nonce.latest === nonce.pending;
    const expected = getContractAddress({ from: account, nonce: BigInt(nonce.latest) });
    const ok = chainId === ARC.id && balance >= need && clean;
    say(out, [
      "Account:    " + account + "  (confirm this is the account you intend to deploy from)",
      "Nonce:      " + nonce.latest + (clean ? "" : " (pending " + nonce.pending + " — a tx is already pending; wait for it)"),
      "Expected contract address: " + expected,
      "Chain ID:   " + chainId + (chainId === ARC.id ? " (Arc mainnet)" : " (WRONG)"),
      "Balance:    " + fromNative(balance) + " USDC (from " + ARC.rpcUrls.default.http[0] + ")",
      "Gas price:  " + gasPrice + " wei (" + (Number(gasPrice) / 1e9) + " gwei)",
      "Deploy gas: " + gas + " (eth_estimateGas, exact artifact bytecode, sha256 " + art.bytecodeSha256.slice(0, 12) + "…)",
      "Est. cost:  " + fromNative(cost) + " USDC",
      "Needed (3x headroom): " + fromNative(need) + " USDC",
      ok ? "RESULT: PASS — Deploy enabled." : "RESULT: FAIL — insufficient balance or wrong chain.",
    ].join("\n"), ok ? "ok" : "err");
    if (ok) { session = { eth, account, nonce: nonce.latest, expected, gas }; setDeploy(true); }
  } catch (e) { say(out, "Check failed:\n" + errText(e), "err"); }
};

$("deploy").onclick = async () => {
  const out = $("out");
  if (!session) return;
  setDeploy(false); // one shot: stays disabled until Check wallet is re-run
  const { eth, account, nonce, expected, gas } = session;
  session = null;
  $("trace").textContent = "";
  const timer = setTimeout(() => { $("pending").hidden = false; }, 15000);
  try {
    // duplicate-send guard: account activity must be unchanged since Check
    const n = await nonces(account);
    if (n.latest !== nonce || n.pending !== nonce) throw new Error(`Account nonce changed (${nonce} → latest ${n.latest}/pending ${n.pending}); not sending. Re-run Check wallet.`);
    const cid = Number(await eth.request({ method: "eth_chainId" }));
    if (cid !== ARC.id) throw new Error("Wallet is on chain " + cid + ", not 5042; not sending. Re-run Check wallet.");
    const tx = { from: account, data: art.bytecode, gas: "0x" + (gas * 13n / 10n).toString(16), value: "0x0" };
    say(out, "Confirm the contract creation in your wallet (no constructor args)…");
    logI(`eth_sendTransaction → from=${account} nonce=${nonce} gas=${tx.gas} value=0x0 data=${art.bytecode.slice(0, 18)}…(${(art.bytecode.length - 2) / 2} bytes)`);
    const hash = await eth.request({ method: "eth_sendTransaction", params: [tx] });
    logI("eth_sendTransaction ← " + hash);
    say(out, "Submitted " + hash + " — waiting…");
    const rc = await publicClient.waitForTransactionReceipt({ hash });
    const match = rc.contractAddress && rc.contractAddress.toLowerCase() === expected.toLowerCase();
    say(out, `${rc.status === "success" ? "Deployed" : "REVERTED"} at ${rc.contractAddress}${match ? "" : " (differs from expected " + expected + ")"}  ${ARC.blockExplorers.default.url}/address/${rc.contractAddress}`, rc.status === "success" ? "ok" : "err");
  } catch (e) {
    logI("✗ " + JSON.stringify(e, Object.getOwnPropertyNames(e)));
    let note = "";
    try { const n = await nonces(account); note = n.latest > nonce || n.pending > nonce
      ? `\nNOTE: account nonce is now ${n.latest}/${n.pending} — a transaction MAY have been broadcast. Do NOT resend; check ${ARC.blockExplorers.default.url}/address/${account}`
      : "\nNonce unchanged: nothing was broadcast. Re-run Check wallet before trying again."; } catch {}
    say(out, "Deploy failed:\n" + errText(e) + note, "err");
  }
  finally { clearTimeout(timer); $("pending").hidden = true; }
};

// ---- Reown AppKit / WalletConnect (primary mobile path) ----
const rOut = $("rOut");
if (!REOWN_PROJECT_ID) {
  $("rConnect").disabled = true; $("rDeploy").disabled = true;
  say(rOut, "Reown not configured: Project ID required (build with REOWN_PROJECT_ID). Use the injected-wallet diagnostics below.", "err");
} else {
  try {
    const { initReown } = await import("./reown.js");
    const r = initReown(REOWN_PROJECT_ID);
    const refresh = () => {
      const s = r.state();
      $("rDeploy").disabled = !(s.connected && s.address);
      say(rOut, s.connected ? `Connected: ${s.address}\nChain ID: ${s.chainId} (Arc mainnet is 5042; Deploy will request a switch)` : "Not connected.", s.connected ? "ok" : "");
    };
    $("rConnect").onclick = () => r.open();
    r.subscribe(refresh); refresh();
    $("rDeploy").onclick = async () => {
      $("rDeploy").disabled = true;
      say(rOut, "Confirm contract creation in your wallet (no constructor args)…");
      const t = setTimeout(() => { $("pending").hidden = false; }, 15000);
      try {
        const log = (l) => { $("trace").textContent += new Date().toISOString().slice(11, 19) + " " + l + "\n"; };
        $("trace").textContent = "";
        const st = r.state();
        const [bal, est] = await Promise.all([
          publicClient.getBalance({ address: st.address }),
          publicClient.estimateGas({ account: st.address, data: art.bytecode }),
        ]);
        log(`preflight: account=${st.address} chain=${st.chainId} balance=${fromNative(bal)} USDC estimateGas=${est}`);
        const hash = await r.deploy({ bytecode: art.bytecode, gas: est * 13n / 10n, log });
        say(rOut, "Submitted " + hash + " — waiting…");
        const rc = await publicClient.waitForTransactionReceipt({ hash });
        say(rOut, `Deployed at ${rc.contractAddress}  ${ARC.blockExplorers.default.url}/address/${rc.contractAddress}`, "ok");
      } catch (e) { say(rOut, "Deploy failed:\n" + errText(e), "err"); refresh(); }
      finally { clearTimeout(t); $("pending").hidden = true; }
    };
  } catch (e) { say(rOut, "Reown failed to initialise:\n" + errText(e), "err"); }
}
