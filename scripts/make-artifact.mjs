// Emits unsigned deployment artifact (ABI + creation bytecode). No keys involved.
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { createHash } from "node:crypto";
const a = JSON.parse(readFileSync("artifacts/contracts/AgentInvoice.sol/AgentInvoice.json", "utf8"));
mkdirSync("artifacts-out", { recursive: true });
const out = {
  contract: "AgentInvoice", compiler: "solc 0.8.28, optimizer 200 runs, evm cancun",
  chainId: 5042, constructorArgs: [],
  abi: a.abi, bytecode: a.bytecode,
  bytecodeSha256: createHash("sha256").update(a.bytecode).digest("hex"),
};
writeFileSync("artifacts-out/AgentInvoice.json", JSON.stringify(out, null, 2) + "\n");
console.log("wrote artifacts-out/AgentInvoice.json sha256", out.bytecodeSha256, "bytes", (a.bytecode.length - 2) / 2);
