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

export async function connect() {
  if (!window.ethereum) throw new Error("No injected wallet (EIP-1193) found.");
  const wallet = createWalletClient({ chain: ARC, transport: custom(window.ethereum) });
  const [account] = await wallet.requestAddresses();
  let cid = await wallet.getChainId();
  if (cid !== ARC.id) {
    try {
      await window.ethereum.request({ method: "wallet_switchEthereumChain", params: [{ chainId: "0x13b2" }] });
    } catch (e) {
      if (e && e.code === 4902) {
        await window.ethereum.request({ method: "wallet_addEthereumChain", params: [{
          chainId: "0x13b2", chainName: ARC.name, nativeCurrency: ARC.nativeCurrency,
          rpcUrls: ARC.rpcUrls.default.http, blockExplorerUrls: [ARC.blockExplorers.default.url] }] });
      } else throw e;
    }
    cid = await wallet.getChainId();
  }
  if (cid !== ARC.id) throw new Error(`Wrong chain ${cid}; Arc mainnet is 5042.`);
  return { wallet, account };
}
