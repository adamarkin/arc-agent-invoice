// Read-only independent verification of a deployment against the local compiler output.
import { readFileSync } from "node:fs";
import { createPublicClient, http, getContractAddress, keccak256, formatEther } from "viem";
const [tx, addr, deployer] = process.argv.slice(2);
const c = createPublicClient({ transport: http("https://rpc.mainnet.arc.io") });
if ((await c.getChainId()) !== 5042) throw new Error("wrong chain");
const art = JSON.parse(readFileSync("artifacts/contracts/AgentInvoice.sol/AgentInvoice.json", "utf8"));
const out = JSON.parse(readFileSync("artifacts-out/AgentInvoice.json", "utf8"));
const t = await c.getTransaction({ hash: tx });
const r = await c.getTransactionReceipt({ hash: tx });
const code = await c.getCode({ address: addr });
const expectedAddr = getContractAddress({ from: t.from, nonce: BigInt(t.nonce) });
const rep = {
  status: r.status, from: r.from, to: r.to, contractAddress: r.contractAddress, block: String(r.blockNumber),
  nonceOfTx: t.nonce, gasUsed: String(r.gasUsed), effectiveGasPrice: String(r.effectiveGasPrice),
  feeUSDC: formatEther(r.gasUsed * r.effectiveGasPrice), value: String(t.value), chainIdInTx: t.chainId,
  senderIsDeployer: !deployer || t.from.toLowerCase() === deployer.toLowerCase(),
  addressMatchesCreate: expectedAddr.toLowerCase() === addr.toLowerCase() && r.contractAddress?.toLowerCase() === addr.toLowerCase(),
  txInputEqualsArtifactBytecode: t.input.toLowerCase() === out.bytecode.toLowerCase(),
  creationBytecodeSha256: (await import("node:crypto")).createHash("sha256").update(t.input.slice(2), "hex").digest("hex"),
  onchainRuntimeEqualsCompiledRuntime: code?.toLowerCase() === art.deployedBytecode.toLowerCase(),
  runtimeKeccak: keccak256(code), compiledRuntimeKeccak: keccak256(art.deployedBytecode), runtimeBytes: (code.length - 2) / 2,
  senderNonceLatest: await c.getTransactionCount({ address: t.from }), senderNoncePending: await c.getTransactionCount({ address: t.from, blockTag: "pending" }),
  senderBalanceUSDC: formatEther(await c.getBalance({ address: t.from })),
  contractBalance: String(await c.getBalance({ address: addr })),
};
console.log(JSON.stringify(rep, null, 2));
