# Arc Microgrants submission pack — Arc Agent Invoice

Official program page: https://community.arc.io/public/events/arc-microgrants-f8tijfjhyq
Application link (DoraHacks): https://dorahacks.io/hackathon/arc-microgrants
Submissions close **Oct 14 2026, 23:59 ET**; one submission per project; decisions by Oct 21.

## Fields (copy/paste)

**Project name:** Arc Agent Invoice

**Live Arc mainnet deployment (link that opens):**
- App: https://adamarkin.github.io/arc-agent-invoice/
- Contract (chain 5042): https://explorer.arc.io/address/0x3F5eB3c16E4581E86703aAd94cc5385649b45327

**Public repo:** https://github.com/adamarkin/arc-agent-invoice

**Public builder profile (GitHub):** https://github.com/adamarkin

**Short description (what it does / what it uses Arc for):**
Arc Agent Invoice is a tiny non-custodial invoice and receipt contract for AI agents and freelancers. A payee creates an invoice priced in Arc's native USDC; a payer sends the exact amount as native value, the contract forwards it to the payee in the same transaction and emits an onchain `InvoicePaid` receipt. It uses Arc's USDC-as-native-gas model, so there is no token approval, no custody, no admin or upgrade path. Includes a static dApp (read-only lookup via the public Arc RPC, wallet-signed create/pay/cancel) and 15 contract tests.

## Evidence (all independently reproducible from the public RPC)
- Contract `0x3F5eB3c16E4581E86703aAd94cc5385649b45327`, deploy tx `0x343befc10220c508a3f2cc6110c73a69cbda55cbb4db6a575ad29e118a4f2fce` (block 24494334). Runtime code equals the locally compiled contract: `node scripts/verify-deployment.mjs <tx> <contract> <deployer>`.
- Mainnet canary: `createInvoice("arc-canary-1", 0.001 USDC)` tx `0x53baa04f81e21d5197c6beabcddc6b5808f0cf908a49c7f02cafe58b659fe46d`, then `payInvoice` tx `0xc3f8f63fe9b53f6ca454529c24bd229aecbec78f4c4c0c75348a6e1707b5193d` — invoice status Paid, contract balance 0. Reproduce: `node scripts/verify-canary.mjs`.
- Total real spend ≈ 0.012 USDC.

## Honest caveats (do not overstate in the form)
- The canary was a self-pay (payer = payee); no distinct-payer run yet.
- Unaudited prototype; source is not yet verified on the Arc explorer (the match is against a local compile).
- Mainnet interaction was done through the Trust Wallet desktop extension; the Reown/WalletConnect mobile path is included but did not complete a Trust Wallet request.

## Adam-only steps
1. Sign in to DoraHacks (account/login) and register for "Arc Microgrants".
2. Paste the fields above. For the payout wallet, enter an Arc-USDC-capable address Adam controls (e.g. `0x7C483A857D3e9e5db64E7914F9E8D4241E389973` only if Adam wants it public in the submission).
3. Confirm any eligibility/sanctions/"not previously funded by Circle or Arc" attestations personally.
4. Decide whether the GitHub profile (`adamarkin`) is the public builder identity to use (pseudonymous is allowed; private verification happens only after conditional selection).
