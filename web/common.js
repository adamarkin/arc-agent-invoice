import { createPublicClient, createWalletClient, custom, http, keccak256, stringToHex, parseEther, formatEther, isAddress } from "viem";

export const ARC = {
  id: 5042,
  name: "Arc Mainnet",
  nativeCurrency: { name: "USDC", symbol: "USDC", decimals: 18 }, // native gas/value view
  rpcUrls: { default: { http: ["https://rpc.mainnet.arc.io"] } },
  blockExplorers: { default: { name: "Arc Explorer", url: "https://explorer.arc.io" } },
};
export const publicClient = createPublicClient({ chain: ARC, transport: http(ARC.rpcUrls.default.http[0]) });
export const idOf = (s) => keccak256(stringToHex(s.trim()));
export const toNative = (s) => parseEther(s.trim());
export const fromNative = (w) => formatEther(w);
export { isAddress };

export const $ = (id) => document.getElementById(id);
export const say = (el, msg, cls = "") => { el.textContent = msg; el.className = "out " + cls; };

// EIP-6963 wallet discovery: with several extensions installed, window.ethereum is ambiguous
// (whichever injected last), so list every announced provider and let the user pick one.
const announced = new Map();
if (typeof window !== "undefined") {
  window.addEventListener("eip6963:announceProvider", (e) => { announced.set(e.detail.info.uuid, e.detail); window.dispatchEvent(new Event("wallets-changed")); });
  window.dispatchEvent(new Event("eip6963:requestProvider"));
}
export const listWallets = () => [...announced.values()].map((d) => ({ uuid: d.info.uuid, name: d.info.name }));
export function pickProvider(uuid) {
  if (uuid && announced.has(uuid)) return announced.get(uuid).provider;
  if (announced.size > 1) throw new Error("Several wallet extensions detected — choose one in the wallet list first.");
  if (announced.size === 1) return [...announced.values()][0].provider;
  if (window.ethereum) return window.ethereum;
  throw new Error("No injected wallet (EIP-1193) found. Install/enable a browser wallet extension.");
}

export async function connect(uuid) {
  const eth = pickProvider(uuid);
  const wallet = createWalletClient({ chain: ARC, transport: custom(eth) });
  const [account] = await wallet.requestAddresses();
  let cid = await wallet.getChainId();
  if (cid !== ARC.id) {
    try {
      await eth.request({ method: "wallet_switchEthereumChain", params: [{ chainId: "0x13b2" }] });
    } catch (e) {
      // 4902 = unknown chain (MetaMask); other wallets use -32603/-32602 with a message. Never auto-add on user rejection (4001).
      const unknown = e && (e.code === 4902 || e.code === -32603 || e.code === -32602 || /unrecognized|unknown|not added|add.*chain/i.test(String(e.message || "")));
      if (!unknown || (e && e.code === 4001)) throw e;
      await eth.request({ method: "wallet_addEthereumChain", params: [{
        chainId: "0x13b2", chainName: ARC.name, nativeCurrency: ARC.nativeCurrency,
        rpcUrls: ARC.rpcUrls.default.http, blockExplorerUrls: [ARC.blockExplorers.default.url] }] });
    }
    cid = await wallet.getChainId();
  }
  if (cid !== ARC.id) throw new Error(`Wrong chain ${cid}; Arc mainnet is 5042.`);
  return { wallet, account, eth };
}
