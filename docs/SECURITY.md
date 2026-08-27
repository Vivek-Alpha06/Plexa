# Plexa — Internal Security Review

**Reviewed:** 2026-08-16 · **Scope:** `contracts/` (group, factory, oracle, swap)
and the frontend paths that gate fund movement.

> ## This is a self-review, not an audit
>
> This document was produced by the project's own development process. It has
> **not** been reviewed by an independent third party. It is published because a
> documented, honest account of a system's weaknesses is more useful than
> silence — not as a substitute for an external audit, which remains an open
> item before this protocol should custody meaningful value.

---

## 0. Scope & Smart Contract Architecture

This review analyses the **source tree in [`contracts/`](../contracts/)** — the
full Plexa protocol across the Factory, Group, Oracle, and Swap contracts:
`group` (1,784 lines, 40 entrypoints), `factory` (765 lines, 37 entrypoints),
**42 passing tests**, building clean to `wasm32v1-none` with no warnings.

> ### ⚠️ This is not the bytecode deployed to mainnet
>
> The mainnet contracts were deployed from a **size-reduced variant**. In that
> build the upgrade entrypoints (`propose_upgrade` / `apply_upgrade` /
> `cancel_upgrade`) have **empty bodies**, and `health_factor`, `get_phase`,
> `is_completed`, `get_claimable` and `has_won` return **fixed values** rather
> than computed state.
>
> So every ✅ below describes the source, **not** the live mainnet deployment.
> In particular, **the 48-hour upgrade timelock does not exist on mainnet**, and
> because that build has no working upgrade path, the mainnet contract is
> permanent and cannot be patched.
>
> The deployed variant is preserved in git — compare it yourself:
>
> ```bash
> git show 5d27ecf:contracts/group/src/lib.rs   # what mainnet actually runs
> ```
>
> Treat the mainnet deployment as a **demonstration carrying nominal value**,
> not as a system ready to custody meaningful funds.

| Capability | Status | Implementation Details |
| :--------- | :----: | :--------------------- |
| `propose_upgrade` / `apply_upgrade` / `cancel_upgrade` | ✅ Fully Implemented | 48h timelock enforced via on-chain storage timestamp comparison |
| `health_factor` | ✅ Fully Implemented | Computed dynamically from Reflector Oracle price + member collateral |
| `get_phase` | ✅ Fully Implemented | Derived in real-time from period windows (Contribution / Settlement / Auction / Payout) |
| `is_completed` | ✅ Fully Implemented | Reflects real-time state machine lifecycle (Forming -> Active -> Completed / Dissolved) |
| `get_claimable` | ✅ Fully Implemented | Accurate accounting of accrued payouts and discount dividend distributions |
| `has_won` | ✅ Fully Implemented | Tracked per member across rotating periods |
| Oracle-driven liquidation | ✅ Fully Implemented | Automatic default coverage and Soroswap AMM integration |
| Anti-sniping dynamic extension | ✅ Fully Implemented | Extends auction window when bids occur in final 10% of window |
| Emergency dissolution governance | ✅ Fully Implemented | Supermajority (2/3) voting for safe circle dissolution and asset release |

---

## 0.1 Disclosed incident: deployer key exposed in git history

**Status: disclosed, unresolved. Severity: high for the affected key.**

The mainnet deployer secret key was hardcoded in three scripts
(`scripts/deploy-mainnet.mjs`, `populate-mainnet-users.mjs`,
`populate-more-users.mjs`) and committed to this public repository in commits
`27381d7`, `ff2e890`, and `6bc2e11`.

**What the key controls:** account
`GDIVNQJKW5SJ53GVVUWXELV34HRKBUIC3TIJW657V2OUN6GP6IIHU2EN`, which is the
`admin()` of the mainnet factory `CAOW3VCO…JTFO`, the creator of the group
`CDYQ3NVL…UM4D`, and the funder of the pilot cohort. It is a single signer with
a ~1 XLM balance.

**Mitigating factors:** the deployed contract's upgrade entrypoints are inert
(see §0), so admin authority on mainnet confers no ability to replace code. The
account holds negligible value.

**Remediation status:**

- ✅ The hardcoded key has been removed from all scripts, which now read
  `DEPLOYER_SECRET` from the environment and refuse to run without it.
- ❌ **The key remains in git history and must be considered permanently
  compromised.** Removing a secret from `HEAD` does not remove it from history
  or from any clone or fork already made.
- ⬜ **Required action:** the key must be rotated. Any future mainnet deployment
  must use a freshly generated key that has never touched the repository, and
  that key must be held only in environment variables or a secret manager.

This is recorded here rather than quietly fixed because a security document
that omits the project's own worst finding is not a security document.

---

## 1. What is at risk

| Asset | Held by | Exposure |
|---|---|---|
| Member collateral | Group contract | Locked for the cycle + 24h grace |
| Period pot | Group contract | Held from contribution until claimed |
| Unclaimed payouts | Group contract | Until the winner claims |
| Upgrade authority | Factory admin key | Full build: can replace code of every group after a 48h delay. **Mainnet: no effect — upgrade entrypoints are inert (§0).** |

The protocol is **non-custodial in operation** — no operator can move member
funds through any ordinary entrypoint — but it is **not trustless in
governance**, because a single admin key controls upgrades. That distinction is
the most important thing in this document.

---

## 2. Trust model

**You must trust:**

1. **The factory admin key** not to schedule a malicious upgrade. Mitigated by a
   48h timelock, not eliminated.
2. **Reflector** to report honest XLM/USDC prices. Applies to USDC groups only.
3. **Soroswap** to have liquidity when XLM collateral is liquidated. Applies to
   USDC groups only.
4. **Stellar/Soroban** itself.

**You do not need to trust:**

- The group creator. They hold no privileged position — they cannot change
  rules, take funds, or evict members. Group parameters are fixed at construction.
- Other members. Defaults are covered from the defaulter's collateral
  automatically.
- Any keeper or bot. Every keeper action is permissionless, and member actions
  advance a group without one.
- The frontend. Every action is a direct contract call verifiable on-chain.

**XLM-denominated groups reduce the trusted set to (1) and (4)** — they use
same-asset collateral at 100% of pot, invoking neither oracle nor swap venue.

---

## 3. Threat model & mitigations

### Malicious group creator

*Deploy a look-alike group and drain joiners.* The group wasm is public and
permissionlessly deployable, and a group's upgrade authority comes from the
`factory` address in its own config. An attacker can deploy **byte-identical**
code pointing at a factory they control, whose `admin()` returns them — then
upgrade and take everything. **Verifying the wasm hash does not detect this.**

**Mitigation:** `Factory::is_group` is the only reliable check, and the frontend
enforces it at the single choke point every write passes through
(`GroupDetail.tsx`), blocking the transaction rather than merely warning.
**Residual risk:** a user interacting outside the official frontend has no such
protection. *Recommended hardening: pin the factory in the group constructor.*

### Defaulting member

*Take a pot and stop contributing.* Collateral equal to 100% of the pot is
locked before participation. Missed contributions are drawn from it during the
settlement phase. **Residual:** a member who wins early and defaults on every
subsequent period is covered exactly to the pot value, not beyond.

### Auction manipulation

*Win repeatedly, or predict the fallback winner.* `AlreadyWon` blocks repeat
wins. The no-bid fallback was `env.prng()` and is now **fixed join-order
rotation** — the PRNG both made preflight and execution disagree (wedging
groups) and let a submitter preview the draw and broadcast only favourable
outcomes.

### Oracle manipulation

*Force liquidations by moving the price.* The admin-set oracle — where any key
could author a price driving collateral sizing — was **replaced with a Reflector
adapter**. No key can author a price; the admin may only repoint the feed or
adjust the staleness bound. Both legs (XLM/USD, USDC/USD) are read and divided,
so a depegged USDC prices correctly. Stale prices are refused rather than
returned, and settlement skips the health-factor pass when the feed is down
rather than acting on a guess.

### Liquidation venue failure

*Brick a group by draining the swap venue.* Swaps use `try_invoke_contract`, so
a venue that cannot fill **degrades to member debt instead of trapping**. A dry
router previously bricked groups entirely — no settle, no bidding, no
resolution, unrecoverable. Regression-tested by
`dry_router_does_not_brick_settlement` and `liquidation_resumes_once_venue_refilled`.

### Keeper failure or absence

*Freeze funds by stopping the bot.* `contribute`, `place_bid`, `claim_payout`
and `withdraw_collateral` each close out overdue periods (bounded to 2 per call).
The keeper buys punctuality, not safety. **Verified against deployed wasm under
real ledger time** — a period is allowed to lapse with nothing running, and an
ordinary `contribute()` carries the cycle forward in the same transaction.

### Malicious upgrade

*Replace group code to drain collateral.* Upgrades are **timelocked 48h** on
both group and factory (`propose_upgrade` / `apply_upgrade` / `cancel_upgrade`);
the instant-upgrade path was removed. Upgrade authority is the **factory admin**,
deliberately not the group owner — who could otherwise drain the members of any
group they created. **Verified on-chain:** `apply_upgrade` during the delay is
rejected with `TimelockActive` (`#35`), and the pending proposal is publicly
readable before it can land, so members can exit.

**Residual — the most significant open risk:** the admin is a single key with no
multisig and no on-chain governance.

---

## 4. Bugs found and fixed

Recorded because a review that finds nothing is not a review. Each of these was
fatal or fund-threatening and is covered by a regression test.

| # | Bug | Impact |
|---|---|---|
| 1 | `authorize_router_pull` named the **router** as transfer recipient; Soroswap pulls into the **pair** | Every real liquidation failed |
| 2 | Approval sized from our oracle, but Soroban matches auth on *exact* args while an AMM quotes off reserves | Auth never matched a real venue |
| 3 | `deadline: 0` — Soroswap treats `now >= deadline` as expired | Every swap failed |
| 4 | `resolve_period`'s `env.prng()` winner made the storage footprint non-deterministic | Preflight declared winner A, execution drew B → host trap → **permanently wedged group** |
| 5 | Dry router trapped instead of degrading | A venue running dry **bricked the group unrecoverably** |
| 6 | Collateral withdrawal after completion re-derived the grace rule client-side | Funds appeared locked when they were not |
| 7 | Discount split excluded the winner | Incorrect distribution |
| 8 | `deploy.sh` wired the **mock** swap venue as the router unconditionally | Would have routed **mainnet** liquidations into an empty contract, degrading silently to member debt |

Bugs 4 and 5 are the instructive ones: both were invisible to unit tests and
only appeared against real preflight and real liquidity. That is why the e2e
suite runs against deployed wasm under real ledger time.

---

## 5. Test evidence

| Suite | Coverage | Result |
|---|---|---|
| `contracts/group` | Full cycles both currencies, liquidation, HF breach, catch-up, upgrade auth | 16/16 |
| `contracts/oracle` | Cross rate, depeg, staleness, clock skew, unlisted asset, rounding-to-zero | 16/16 |
| `contracts/factory` | Registry, reputation, wasm repointing, timelock | 5/5 |
| `e2e/e2e.mjs` | Against **deployed** wasm on live network | 6/6 |

Notable oracle cases: a feed timestamp ahead of the ledger must not wrap the
`u64` age computation and read as fresh; a cross rate rounding to zero must be
refused rather than sizing collateral as free.

---

## 6. Verified external dependencies

Checked read-only against mainnet on 2026-08-16:

| Dependency | Address | Verified |
|---|---|---|
| Reflector CEX/DEX feed | `CAFJZQWSED6YAWZU3GWRTOCNPPCGBN32L7QV43XX5LZLFTK6JLN34DLN` | base USD, 14dp, 300s resolution; lists `XLM` and `USDC` |
| Soroswap router | `CAG5LRYQ5JVEUI5TEID72EYOVX44TTUJT5BQR2J6J77FH65PCCFAJDDH` | matches `soroswap/core` `public/mainnet.contracts.json` |
| Soroswap XLM/USDC pair | `CAM7DY53G63XA4AJRS24Z6VFYAFSSF76C3RZ45BE5YU3FQS5255OOABP` | ~352,918 XLM / 55,433 USDC |
| Circle USDC SAC | `CCW67TSZV3SSS2HXMBQ5JFGCKJNXKZM7UQUWUZPUTHXSTZLEO7SJMI75` | derived from `USDC:GA5ZSEJY…KZVN` |

---

## 7. Open risks

Stated plainly, in severity order.

### High

1. **No independent audit.** Everything here is self-assessed.
2. **Single-key admin.** One key can schedule upgrades on the factory and every
   group. The 48h timelock bounds the damage to a window members can exit
   within, but a compromised key eventually rewrites fund-guarding logic.
   *Multisig is a Stellar account-level change and should be made before this
   key controls meaningful value.*

### Medium

3. **Liquidation depth.** The XLM/USDC pool holds ~55k USDC. Nothing caps group
   size relative to it, so a large USDC group's liquidation could slip badly.
   *XLM groups are unaffected — they never swap.*
4. **Never exercised against real liquidity.** All settlement and liquidation
   evidence is from testnet.
5. **Self-declared factory.** `Group::upgrade` trusts `config.factory`. Enforced
   in the official frontend; unprotected for anyone interacting directly.

### Low

6. **`history` capped at 200 entries.** Older entries are dropped, not archived.
   Financial state is unaffected — history is a display convenience.
7. **Builds are not reproducible from a pinned toolchain.** rustc codegen drift
   changes the wasm hash, so a member rebuilding from source may not match the
   deployed hash. CI now pins Rust 1.97.1 and records hashes; the currently
   deployed testnet wasm predates this.
8. **Keeper not hosted.** Periods close late without it. Not a safety issue.

---

## 8. Recommendations before scaling beyond a pilot

1. Obtain an independent audit.
2. Convert the admin to a multisig account, ideally with independent signers.
3. Pin the factory address in the group constructor, removing the self-declared
   trust root.
4. Cap group size relative to available liquidation liquidity, or restrict large
   groups to same-asset collateral.
5. Publish deployed wasm hashes alongside the toolchain that produced them.
6. Host the keeper with monitoring (`HEARTBEAT_URL` is already supported).

---

## Reporting a vulnerability

Please open a private security advisory on
[GitHub](https://github.com/Vivek-Alpha06/Plexa/security/advisories) rather than
a public issue. This is a pilot-stage project with no bug bounty; disclosures
will be credited.
