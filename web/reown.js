// Reown AppKit (WalletConnect) + Ethers adapter. Loaded only when a build-time project ID exists.
import { createAppKit } from "@reown/appkit";
import { EthersAdapter } from "@reown/appkit-adapter-ethers";
import { arc } from "@reown/appkit/networks"; // built-in Arc mainnet, id 5042
import { BrowserProvider } from "ethers";

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
    // Sends a plain contract-creation tx (no constructor args) via the connected wallet. Returns the tx hash.
    async deploy({ bytecode }) {
      if (!state().connected) throw new Error("Connect a wallet first.");
      if (state().chainId !== 5042) await modal.switchNetwork(arc, { throwOnFailure: true });
      const provider = modal.getWalletProvider();
      if (!provider) throw new Error("No wallet provider from AppKit.");
      const signer = await new BrowserProvider(provider, 5042).getSigner();
      const tx = await signer.sendTransaction({ data: bytecode });
      return tx.hash;
    },
  };
}
