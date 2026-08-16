# Plexa Documentation

| Document | For |
|---|---|
| [User Guide](USER-GUIDE.md) | Participants — joining a circle, bidding, claiming |
| [Security Review](SECURITY.md) | Trust model, threat analysis, open risks |
| [Pilot Plan](PILOT.md) | Running the mainnet pilot — economics, recruitment, evidence |
| [Launch Post](LAUNCH-POST.md) | Announcement drafts |
| [Submission Checklist](SUBMISSION.md) | Requirement-by-requirement status |

Architecture, contract reference, lifecycle mechanics and deployment live in the [main README](../README.md) (with the original unformatted details preserved in [README_OLD.md](README_OLD.md)). Component notes: [`frontend/`](../frontend/README.md), [`keeper/`](../keeper/README.md).

## Quick reference

**Contracts**

| Contract | Role |
|---|---|
| `plexa-factory` | Deploys groups; discovery registry; reputation ledger |
| `plexa-group` | One instance per circle — contributions, auction, payouts, collateral |
| `plexa-oracle` | Reflector adapter — XLM/USDC cross rate, refuses stale prices |
| `plexa-swap` | Soroswap-compatible mock venue (**testnet only**) |

**Common tasks**

```bash
bash scripts/test.sh                  # contract unit tests
cd frontend && npm run build          # typecheck + production build
cd e2e && node e2e.mjs                # integration tests vs deployed wasm
NETWORK=mainnet-rpc STELLAR_ACCOUNT=<key> ./scripts/deploy.sh
node scripts/export-activity.mjs      # on-chain activity report
```
