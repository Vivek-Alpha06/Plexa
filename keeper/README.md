# Plexa Keeper

Advances every Active group so **members never sign to settle or resolve**.
`settle` and `resolve_period` are permissionless on the contract, so a funded
keeper account can drive them on everyone's behalf and pay the fee (a fraction
of a cent per call).

## The keeper is an optimisation, not a dependency

Since v8, `contribute`, `place_bid`, `claim_payout` and `withdraw_collateral`
close out overdue periods themselves (bounded to 2 per call). If the keeper
stops, the group still advances the moment **any member acts** — funds are never
frozen behind a stalled bot.

What the keeper buys you is *punctuality*: periods close on schedule instead of
whenever somebody next interacts. That is a UX property, not a safety one.

Verified end-to-end in `e2e/e2e.mjs`: a period's auction is allowed to lapse
with nothing running, then a member's ordinary `contribute()` carries the cycle
forward in the same transaction.

## Running it

```bash
npm install
FACTORY_ID=C... KEEPER_SECRET=S... node keeper.mjs            # one pass
FACTORY_ID=C... KEEPER_SECRET=S... node keeper.mjs --watch     # long-lived
FACTORY_ID=C... KEEPER_PUBLIC=G... node keeper.mjs --dry-run   # no submissions
```

| Variable | Purpose |
|---|---|
| `FACTORY_ID` | **Required.** Factory to enumerate groups from. Must match `frontend/.env`. |
| `KEEPER_SECRET` | **Required** to submit. `S…` seed of a funded account. |
| `KEEPER_PUBLIC` | Dry-run only: any funded account to simulate against. |
| `RPC_URL` | Default `https://soroban-testnet.stellar.org`. |
| `NETWORK_PASSPHRASE` | Default testnet. |
| `POLL_SECONDS` | Watch-mode interval. Default 60. |
| `MAX_CATCHUP` | Periods to chase per group per run. Default 12. |
| `HEARTBEAT_URL` | Optional dead-man's-switch ping (see below). |

## The keeper key

Use a **dedicated account**, not the contract admin.

The good news is that this key is low-risk by design: `settle` and
`resolve_period` take no auth and grant the caller nothing — no privileged
position, no way to redirect funds. If it leaks, an attacker can waste its XLM
and nothing else. Fund it with fees only and it is a genuinely safe hot key.

Do not reuse the factory admin key, which *can* schedule upgrades.

## Monitoring

An unmonitored keeper failing silently is the real operational risk — periods
quietly stop closing on time and nobody notices until a member complains.

Create a check at [healthchecks.io](https://healthchecks.io) (free) with a
period slightly longer than `POLL_SECONDS`, then set `HEARTBEAT_URL` to its ping
URL. The keeper pings on every successful cycle and `/fail` on a failed one, so
you are alerted both when it breaks *and* when it goes quiet.

## Deployment

### Fly.io (recommended)

```bash
cd keeper
fly launch --no-deploy --copy-config
fly secrets set KEEPER_SECRET=S...
fly secrets set HEARTBEAT_URL=https://hc-ping.com/<uuid>
fly deploy
fly scale count 1        # exactly one instance
fly logs
```

Edit `FACTORY_ID` in `fly.toml` first. ~$2/month on the smallest VM.

### Railway / Render / Cloud Run

Point at `keeper/Dockerfile`, deploy as a **worker** (no HTTP port), and set the
same environment variables. Keep the instance count at 1.

### GitHub Actions (`.github/workflows/keeper.yml`)

Already committed and free: set the `KEEPER_SECRET` secret and `FACTORY_ID`
variable in repo settings.

Fine for testnet, **not recommended for mainnet**: scheduled workflows are
best-effort and can be delayed or skipped under load, they are auto-disabled
after 60 days of repo inactivity, and there is no alerting when a run fails.

## Concurrency

Run **one** keeper. Races are harmless on-chain — `resolve_period` is
idempotent, so one submission wins and the others find nothing to do — but
instances sharing an account sequence number will burn fees losing races. The
workflow already serialises itself with a `concurrency` group.

## Footprint widening

The keeper declares `Claimable(m)` for every eligible member before submitting
`resolve_period`. Current contracts pick the no-bid winner by fixed rotation, so
this is unnecessary for them; it is what lets the keeper still drive groups from
the superseded factory, whose build drew winners with `env.prng()` and whose
code has no `upgrade` entrypoint to rescue it.
