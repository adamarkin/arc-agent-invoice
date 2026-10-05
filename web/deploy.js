import { publicClient, $, say, connect, ARC } from "./common.js";
const art = await fetch("./AgentInvoice.json").then((r) => r.json());
$("sha").textContent = art.bytecodeSha256;
$("deploy").onclick = async () => {
  const out = $("out");
  try {
    const { wallet, account } = await connect();
    say(out, "Confirm deployment in your wallet (no constructor args)…");
    const hash = await wallet.deployContract({ abi: art.abi, bytecode: art.bytecode, account });
    say(out, "Submitted " + hash + " — waiting…");
    const rc = await publicClient.waitForTransactionReceipt({ hash });
    say(out, `Deployed at ${rc.contractAddress}  ${ARC.blockExplorers.default.url}/address/${rc.contractAddress}`, "ok");
  } catch (e) { say(out, e.shortMessage || e.message, "err"); }
};
