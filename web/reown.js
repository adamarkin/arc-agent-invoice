// Reown AppKit (WalletConnect) + Ethers adapter. Loaded only when a build-time project ID exists.
import { createAppKit } from "@reown/appkit";
import { EthersAdapter } from "@reown/appkit-adapter-ethers";
import { arc } from "@reown/appkit/networks"; // built-in Arc mainnet, id 5042

if (arc.id !== 5042) throw new Error("Unexpected built-in Arc network id " + arc.id);

export function initReown(projectId) {
  const modal = createAppKit({
    adapters: [new EthersAdapter()],
    networks: [arc],
    defaultNetwork: arc,
    projectId,
    metadata: {
      name: "Arc Agent Invoice",
      description: "Non-custodial native-USDC invoices and receipts on Arc mainnet",
      url: "https://adamarkin.github.io/arc-agent-invoice/",
      icons: [],
    },
    features: { analytics: false, email: false, socials: false, onramp: false, swaps: false },
  });
  const state = () => ({ address: modal.getAddress(), connected: !!modal.getAddress(), chainId: Number(modal.getChainId()) });
  return {
    open: () => modal.open(),
    state,
    subscribe: (cb) => { modal.subscribeAccount(cb); modal.subscribeNetwork(cb); },
    // Sends a plain contract-creation tx (no `to`, no constructor args) straight through the connected
    // wallet's EIP-1193 provider: no ethers pre-flight/polling that could mask the wallet's own error.
    // `log(line)` receives a trace of the request and its outcome. Returns the tx hash.
    async deploy({ bytecode, gas, log }) {
      const st = state();
      if (!st.connected) throw new Error("Connect a wallet first.");
      if (st.chainId !== 5042) { log("switchNetwork(arc) requested"); await modal.switchNetwork(arc, { throwOnFailure: true }); }
      const provider = modal.getWalletProvider();
      if (!provider || typeof provider.request !== "function") throw new Error("No EIP-1193 wallet provider from AppKit.");
      const tx = { from: st.address, data: bytecode, gas: "0x" + gas.toString(16), value: "0x0" };
      log(`eth_sendTransaction → from=${tx.from} gas=${tx.gas} value=0x0 data=${bytecode.slice(0, 18)}…(${(bytecode.length - 2) / 2} bytes)`);
      try {
        const hash = await provider.request({ method: "eth_sendTransaction", params: [tx] });
        log("eth_sendTransaction ← " + hash);
        return hash;
      } catch (e) { log("eth_sendTransaction ✗ " + JSON.stringify(e, Object.getOwnPropertyNames(e))); throw e; }
    },
  };
}
