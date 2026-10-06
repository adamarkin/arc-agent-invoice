// Read-only: finds and verifies the createInvoice (and, if present, payInvoice) canary on Arc mainnet.
import { readFileSync } from "node:fs";
import { createPublicClient, http, keccak256, stringToHex, parseEventLogs, formatEther, parseEther, encodeFunctionData } from "viem";
const abi = JSON.parse(readFileSync("docs/abi.json", "utf8")); const cfg = JSON.parse(readFileSync("docs/config.json", "utf8"));
const DEPLOYER = "0x7C483A857D3e9e5db64E7914F9E8D4241E389973", CONTRACT = cfg.contract, TEXT = process.argv[2] || "arc-canary-1";
const c = createPublicClient({ transport: http("https://rpc.mainnet.arc.io") });
const id = keccak256(stringToHex(TEXT));
const head = await c.getBlockNumber(); const from0 = 24494334n; let logs = [];
for (let s = from0; s <= head; s += 5000n) {
  const e = s + 4999n > head ? head : s + 4999n;
  logs.push(...await c.getLogs({ address: CONTRACT, fromBlock: s, toBlock: e }));
}
const ev = parseEventLogs({ abi, logs });
const mine = ev.filter((l) => l.args.invoiceId === id);
console.log("all contract events:", ev.map((l) => `${l.eventName}@${l.blockNumber}`).join(", ") || "none");
const out = { head: String(head), nonceLatest: await c.getTransactionCount({ address: DEPLOYER }), noncePending: await c.getTransactionCount({ address: DEPLOYER, blockTag: "pending" }), balanceUSDC: formatEther(await c.getBalance({ address: DEPLOYER })), contractBalance: String(await c.getBalance({ address: CONTRACT })), events: [] };
for (const l of mine) {
  const t = await c.getTransaction({ hash: l.transactionHash }); const r = await c.getTransactionReceipt({ hash: l.transactionHash });
  out.events.push({ event: l.eventName, args: JSON.parse(JSON.stringify(l.args, (k, v) => typeof v === "bigint" ? String(v) : v)), tx: l.transactionHash, block: String(l.blockNumber), from: t.from, to: t.to, nonce: t.nonce, value: String(t.value), status: r.status, gasUsed: String(r.gasUsed), feeUSDC: formatEther(r.gasUsed * r.effectiveGasPrice), logCountInReceipt: r.logs.length });
}
// Self-pay accounting: balance delta across the pay block should equal -fee (principal returns to the payer/payee).
for (const e of out.events.filter((x) => x.event === "InvoicePaid")) {
  const b = BigInt(e.block), who = e.from;
  const pre = await c.getBalance({ address: who, blockNumber: b - 1n }), post = await c.getBalance({ address: who, blockNumber: b });
  const blk = await c.getBlock({ blockNumber: b });
  e.accounting = { preBalance: formatEther(pre), postBalance: formatEther(post), deltaUSDC: formatEther(post - pre), feeUSDC: e.feeUSDC, deltaEqualsMinusFee: (pre - post) === parseEther(e.feeUSDC), blockTimestamp: String(blk.timestamp), contractBalanceAtBlock: String(await c.getBalance({ address: CONTRACT, blockNumber: b })) };
}
const inv = await c.readContract({ address: CONTRACT, abi, functionName: "getInvoice", args: [id] });
out.invoice = { id, payee: inv.payee, amount: String(inv.amount), amountUSDC: formatEther(inv.amount), metadataHash: inv.metadataHash, status: Number(inv.status), payer: inv.payer, paidAt: String(inv.paidAt) };
console.log(JSON.stringify(out, null, 2));
if (inv.status === 1) {
  const data = encodeFunctionData({ abi, functionName: "payInvoice", args: [id] });
  const g = await c.estimateGas({ account: DEPLOYER, to: CONTRACT, data, value: inv.amount }); const gp = await c.getGasPrice();
  console.log("PAY simulation OK: value", formatEther(inv.amount), "USDC, gas", String(g), "limit(x1.3)", String(g * 13n / 10n), "fee≈", formatEther(g * gp), "USDC (conservative", formatEther(g * gp * 13n / 10n * 3n) + ")");
}
