# Plexa Frontend

React + TypeScript + Vite frontend for the Plexa ROSCA protocol. Dark, card-based UI
with a 4-phase create wizard, live summary panels, group/auction views, governance &
history, and a deposit-triggered join flow. Wallet via Freighter; contract calls via
`@stellar/stellar-sdk`.

## Setup

```bash
cd frontend
npm install
cp .env.example .env      # then fill in VITE_FACTORY_ID / VITE_USDC_ID from deploy.sh
npm run dev               # http://localhost:5173
```

Build / typecheck:

```bash
npm run build             # tsc + vite build
npm run lint              # tsc --noEmit
```

## Configuration (`.env`)

| Var | Meaning |
|---|---|
| `VITE_NETWORK` | `testnet` / `public` |
| `VITE_RPC_URL` | Soroban RPC endpoint |
| `VITE_NETWORK_PASSPHRASE` | network passphrase used for signing |
| `VITE_FACTORY_ID` | deployed Plexa factory contract id |
| `VITE_USDC_ID` | USDC token contract id on the network |

Run `../scripts/deploy.sh` to get the factory id; it prints the exact `VITE_*` lines.

## Structure

```
src/
  lib/
    config.ts       env + USDC decimals
    format.ts       USDC <-> base units, dd/hh/mm/ss durations
    wallet.ts       Freighter wrappers
    contracts.ts    factory + group + USDC clients (simulate reads, sign+submit writes)
  context/WalletContext.tsx
  components/        DurationInput, Countdown, Header, Steps, GroupCard
  pages/
    Dashboard.tsx   your groups + public discovery + create CTA
    CreateGroup.tsx 4-phase wizard with live preview / cadence summary
    GroupDetail.tsx status, live auction, members, governance/history, join+member actions
```

## How the UI maps to the protocol

- **Durations** everywhere use the days/hours/minutes/seconds field pattern; the payout
  window is shown read-only (derived = period − contribution − auction).
- **Auto-start** is surfaced explicitly: the Forming panel shows `N/target` filled and
  explains there is no fixed start date.
- **Auction** is open/transparent — the leading discount and bidder are shown live with a
  countdown; eligible members (not yet won) can bid a higher discount.
- **`resolve_period`** is permissionless; a "Resolve Period" button appears to members once
  the auction window has closed.
- **Governance** join requests + the full on-chain history log render in one panel
  (transparency, Section 5).
- Payouts and collateral are **claim/withdraw** actions, never auto-transferred.

> ✅ Installs, typechecks (`tsc --noEmit`) and produces a production build cleanly.
> ⚠️ Not yet exercised at **runtime against a live deployed factory** — the contract-call
> layer (`contracts.ts`) should be smoke-tested once contracts are on testnet, as
> enum/struct decoding from `scValToNative` may need minor tweaks (the `normEnum` helper
> already defensively handles the common shapes).
