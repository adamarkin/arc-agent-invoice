# Arc Agent Invoice

Tiny, non-custodial invoice + payment-receipt dApp for AI agents and freelancers on **Arc mainnet** (chain ID 5042).

A payee creates an invoice denominated in Arc's **native USDC**. A payer pays the exact amount as `msg.value`; the contract forwards it to the payee in the same transaction and emits a verifiable onchain receipt (`InvoicePaid`). The contract never retains funds.

- Live app: https://adamarkin.github.io/arc-agent-invoice/ (GitHub Pages, served from `docs/`)
- **Arc mainnet contract (verified): [`0x3F5eB3c16E4581E86703aAd94cc5385649b45327`](https://explorer.arc.io/address/0x3F5eB3c16E4581E86703aAd94cc5385649b45327)**, deploy tx [`0x343befc1…2fce`](https://explorer.arc.io/tx/0x343befc10220c508a3f2cc6110c73a69cbda55cbb4db6a575ad29e118a4f2fce), block 24494334, deployer `0x7C483A857D3e9e5db64E7914F9E8D4241E389973`.
  Verified independently from the public RPC with `node scripts/verify-deployment.mjs <tx> <contract> <deployer>`: receipt `success`, tx input equals the artifact creation bytecode (sha256 of hex string `eb084dc3…caff`), on-chain runtime code equals the locally compiled runtime (keccak `0x3676240a…13c9`, 1790 bytes), address equals `CREATE(deployer, nonce 0)`, fee ≈ 0.00925 USDC. Details: `deployments/arc-mainnet.json`.

## Arc config
| | |
|---|---|
| Chain ID | 5042 |
| RPC | https://rpc.mainnet.arc.io |
| Explorer | https://explorer.arc.io |
| Native currency | USDC (gas + `msg.value`) |

**Units.** On Arc, USDC is the native gas token. Native value uses 18-decimal units (1 USDC = `1e18`). The canonical ERC-20 predeploy at `0x3600000000000000000000000000000000000000` exposes **6 decimals**. This project uses *native value only* — `amountNative` is in 18-decimal units, never the ERC-20 interface, and no token approvals are involved. The UI takes normal decimals (`1.5`) and converts.

## Contract (`contracts/AgentInvoice.sol`)
- `createInvoice(bytes32 invoiceId, uint256 amountNative, bytes32 metadataHash)` — unique id, amount > 0, payee = `msg.sender`.
- `payInvoice(bytes32 invoiceId) payable` — requires Active and `msg.value == amount`; marks Paid, records payer + timestamp, then forwards value to payee.
- `cancelInvoice(bytes32 invoiceId)` — payee only, only while Active.
- `getInvoice(bytes32 invoiceId)` — returns payee, paidAt, amount, metadataHash, payer, status (0 None, 1 Active, 2 Paid, 3 Cancelled).
- Events: `InvoiceCreated`, `InvoicePaid`, `InvoiceCancelled`.

Invoice ids are `keccak256(text)` computed in the UI. Metadata is only a hash; keep the actual description off-chain.

## Threat model / non-custody
- No owner, admin, upgradeability, pause, or token approvals. No `receive`/`fallback`: stray transfers revert.
- Checks-effects-interactions: status is set to Paid before the external call; a reentrant `payInvoice` hits `NotActive` (tested).
- If the payee cannot receive native value (reverting contract), payment reverts atomically: payer keeps funds, invoice stays Active. The payee can cancel.
- Ids are first-come: anyone can create an id before you; the payer should always check the payee address and amount shown. Do not treat an id alone as proof of who is owed.
- Cancelled ids cannot be reused. Overpay/underpay is rejected, not refunded.
- Unaudited prototype. Use small amounts.
- The frontend never requests or handles private keys/seeds; all signing happens in the user's injected wallet. CSP restricts network access to the Arc RPC.

## Develop
```
npm install
npm run compile && npm test     # Hardhat 2, solc 0.8.28
npm run artifact                # artifacts-out/AgentInvoice.json (ABI + bytecode, unsigned)
npm run estimate                # read-only gas estimate vs Arc RPC; sends nothing
npm run build                   # static site into docs/
```

## Gas estimate (read-only `eth_estimateGas` against Arc mainnet, 2026-10-05)
Deploy ≈ 445k gas, create ≈ 115k, pay ≈ 47k at 20 gwei ≈ **0.009 + 0.0023 + 0.0009 USDC**. Conservative projection (3× gas price, 1.5× gas) for deploy + create + pay canary ≈ **0.06 USDC**, far below the 5 USDC budget.

## Reown AppKit / WalletConnect setup (mobile wallets, e.g. Trust Wallet)
`deploy.html` has a primary Reown path (`@reown/appkit` + `@reown/appkit-adapter-ethers`, built-in Arc mainnet network `eip155:5042`) and an injected-wallet diagnostics fallback. Without a Project ID the Reown buttons show "Reown not configured: Project ID required" and everything else keeps working.
1. Sign in at https://dashboard.reown.com and create an AppKit project named `arc-agent-invoice` (JavaScript).
2. Add `https://adamarkin.github.io` to the project's allowed origins (domain allowlist).
3. Build with the Project ID: `REOWN_PROJECT_ID=<id> npm run build`, commit `docs/`, push.
The Project ID is public client configuration (it ships in the bundle), not a signing secret. No private key or seed is ever requested; the wallet signs every transaction. App metadata URL: `https://adamarkin.github.io/arc-agent-invoice/`.

## Deploy (no private keys, ever)
Wallet-UI flow only:
1. Serve `docs/` (or open the hosted site) and go to `deploy.html`.
2. Compare the displayed bytecode sha256 with `artifacts-out/AgentInvoice.json` (`bytecodeSha256`).
3. Connect your injected wallet; the helper switches to chain 5042 and sends a plain contract-creation transaction with no constructor args. You sign in the wallet.
4. Put the deployed address into `docs/config.json` (`{"contract":"0x…"}`) and the README, then `npm run build` and push. Users can also pass `#contract=0x…` in the URL.
5. Canary: create a tiny invoice (e.g. 0.001 USDC), pay it from a second account, check the `InvoicePaid` event on the explorer.

Do not pass raw private keys to any CLI. Hardware/browser wallets or an encrypted keystore with an interactive prompt only.

## Arc Microgrants criteria mapping
| Requirement | Where |
|---|---|
| Deployed + working on Arc mainnet | deployed and bytecode-verified (see above); canary: `createInvoice("arc-canary-1", 0.001 USDC)` confirmed on mainnet ([tx](https://explorer.arc.io/tx/0x53baa04f81e21d5197c6beabcddc6b5808f0cf908a49c7f02cafe58b659fe46d)); `payInvoice` pending |
| Public repo | this repo |
| Short description | first paragraph |
| Public builder profile | GitHub: adamarkin |

## License
MIT
