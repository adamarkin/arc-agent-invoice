// Read-only gas estimation against Arc mainnet public RPC. Sends NO transaction, signs nothing.
import { readFileSync } from "node:fs";
import { createPublicClient, http, encodeFunctionData, keccak256, encodeAbiParameters, pad, toHex, formatEther, stringToHex } from "viem";
const RPC = "https://rpc.mainnet.arc.io";
const art = JSON.parse(readFileSync("artifacts-out/AgentInvoice.json", "utf8"));
const rt = JSON.parse(readFileSync("artifacts/contracts/AgentInvoice.sol/AgentInvoice.json", "utf8")).deployedBytecode;
const c = createPublicClient({ transport: http(RPC) });
const chainId = await c.getChainId();
if (chainId !== 5042) throw new Error("wrong chain " + chainId);

const FROM = "0x000000000000000000000000000000000000dEaD"; // arbitrary, never signs
const PAYEE = "0x1111111111111111111111111111111111111111";
const PAYER = "0x2222222222222222222222222222222222222222";
const FAKE = "0x00000000000000000000000000000000000c0de1";
const id = keccak256(stringToHex("canary-1")), meta = keccak256(stringToHex("m"));
const amount = 10n ** 15n; // 0.001 USDC native

const rpc = (m, p) => c.request({ method: m, params: p });
const deployGas = BigInt(await rpc("eth_estimateGas", [{ from: FROM, data: art.bytecode }]));
const createData = encodeFunctionData({ abi: art.abi, functionName: "createInvoice", args: [id, amount, meta] });
const createGas = BigInt(await rpc("eth_estimateGas", [{ from: PAYEE, to: FAKE, data: createData }, "latest", { [FAKE]: { code: rt } }]));

// storage for an Active invoice: slot0 payee, slot1 amount, slot2 meta, slot3 status(byte 20)=1
const base = BigInt(keccak256(encodeAbiParameters([{ type: "bytes32" }, { type: "uint256" }], [id, 0n])));
const w = (n) => pad(toHex(n), { size: 32 });
const stateDiff = {
  [w(base)]: pad(PAYEE, { size: 32 }), [w(base + 1n)]: w(amount), [w(base + 2n)]: meta,
  [w(base + 3n)]: w(1n << 160n),
};
const payData = encodeFunctionData({ abi: art.abi, functionName: "payInvoice", args: [id] });
const payGas = BigInt(await rpc("eth_estimateGas", [{ from: PAYER, to: FAKE, data: payData, value: toHex(amount) }, "latest", { [FAKE]: { code: rt, stateDiff }, [PAYER]: { balance: toHex(10n ** 18n) } }]));

const gp = await c.getGasPrice();
const fh = await rpc("eth_feeHistory", ["0x5", "latest", [50]]);
const maxBase = fh.baseFeePerGas.map(BigInt).reduce((a, b) => (a > b ? a : b), 0n);
const conservativePrice = (maxBase > gp ? maxBase : gp) * 3n; // 3x headroom
const tot = (deployGas + createGas + payGas) * 3n / 2n; // 1.5x gas headroom
const cost = (g) => g * conservativePrice;
const usd = (w) => Number(formatEther(w));
const projected = cost(tot);
console.log(JSON.stringify({
  chainId, gasPriceWei: gp.toString(), baseFeeMaxRecent: maxBase.toString(), conservativePriceWei: conservativePrice.toString(),
  gas: { deploy: deployGas.toString(), createInvoice: createGas.toString(), payInvoice: payGas.toString() },
  costUSDC_atCurrentPrice: { deploy: usd(deployGas * gp), create: usd(createGas * gp), pay: usd(payGas * gp) },
  conservativeProjectedTotalUSDC: usd(projected) + usd(amount) /* canary value is paid to self-controlled payee */,
  budgetUSDC: 5, withinBudget: usd(projected) < 5,
}, null, 2));
if (usd(projected) >= 5) { console.error("FAIL: projected spend may exceed 5 USDC"); process.exit(1); }
