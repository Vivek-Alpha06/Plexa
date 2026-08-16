# Plexa Mainnet Pilot — Operations Plan

The goal is 20+ **real people** transacting on mainnet, with on-chain evidence
that stands up to inspection. This document is the operational plan for getting
there, and the reasoning behind the choices.

> **Not a growth plan.** This is a controlled pilot with deliberately tiny
> amounts, run on unaudited contracts. Everything here is sized so that a total
> loss of every participant's funds would be an inconvenience, not a harm.

---

## 1. Why this is cheaper than it looks

Plexa supports **per-group currency**, and an XLM-denominated group needs no
USDC. That matters more than it sounds:

- **No trustline.** Classic Stellar assets like USDC require a trustline before
  a wallet can hold them. That is the single biggest drop-off point for a
  non-crypto-native user. XLM groups skip it entirely.
- **No oracle, no swaps.** XLM groups take same-asset XLM collateral at a flat
  100% of pot. No price feed, no Soroswap liquidation path. The most complex and
  least-proven machinery in the protocol is simply not exercised.
- **One asset to acquire.** Participants need XLM and nothing else.

### Pilot economics

At **XLM ≈ $0.157** (2026-08-16), a 5-member group with a 0.5 XLM contribution:

| Item | Amount | USD |
|---|---|---|
| Pot per period | 2.5 XLM | $0.39 |
| Collateral locked (100% of pot) | 2.5 XLM | $0.39 |
| **Upfront per member** | **3 XLM** | **$0.47** |
| Total out across a full cycle | 5 XLM | $0.78 |

Collateral returns after the cycle completes plus the grace window, and each
member wins the pot exactly once — so a completed cycle is roughly net-neutral,
minus whatever discount they bid and transaction fees of a fraction of a cent.

### Sponsoring the cohort

Fund each participant with **15 XLM (~$2.35)** — comfortably covering Stellar's
account reserve, collateral, all contributions, and fees:

| Cohort | Cost |
|---|---|
| 20 users | 300 XLM ≈ **$47** |
| 25 users | 375 XLM ≈ **$59** |
| 30 users | 450 XLM ≈ **$71** |

**Recruit 25–30 to land 20.** Expect drop-off between "said yes" and "actually
completed a transaction."

---

## 1b. Deployment cost — budget for this separately

Deploying is **not free**, and it is the largest single line item. Soroban
charges *state rent* for storing contract code on-chain, and rent scales with
bytecode size. Measured against mainnet by simulation on 2026-08-16
(`node scripts/estimate-fees.mjs` re-runs this):

`deploy.sh` optimizes the wasm before upload, which is not cosmetic — rent is
charged by bytecode size, so it cuts **22%** off the cost:

| Upload | Raw | Optimized | Cost (optimized) |
|---|---|---|---|
| Group wasm | 69,772 B | 54,949 B | 70.63 XLM (~$11.08) |
| Factory wasm | 29,563 B | 22,122 B | 29.38 XLM (~$4.61) |
| Oracle wasm | 19,474 B | 14,450 B | 21.91 XLM (~$3.44) |
| **Total code uploads** | | | **121.91 XLM (~$19.13)** |

(Unoptimized, the same uploads cost 156.39 XLM / ~$24.54.)

Contract *instance* creation (factory, oracle, and each group) is billed on top
but is much smaller than code upload.

### Total pilot budget

| Item | XLM | USD |
|---|---|---|
| Code uploads (optimized) | 122 | ~$19 |
| Instances + group creation + fees | ~100 | ~$16 |
| Sponsoring 20 participants @ 15 XLM | 300 | ~$47 |
| Buffer | ~100 | ~$16 |
| **Total** | **~620 XLM** | **~$98** |

Fund the deployer with **at least 350 XLM** before running `deploy.sh` — a
deploy that runs out of XLM midway leaves a partial deployment you pay to redo.

**Minimum viable path:** if $98 is out of reach, deploy only (~250 XLM / ~$40)
and recruit participants who already hold a little XLM, or sponsor a smaller
first cohort and grow it. A deployed contract with 8 real users beats a
fabricated one with 25.

> **Rent is ongoing.** Soroban entries carry a time-to-live and are archived if
> it lapses. The initial upload buys a long TTL, so a multi-week pilot is fine,
> but a contract left untouched for a long period can need a restore before it
> works again. Budget for it if this outlives the pilot.

---

## 2. Sponsoring without looking like sybils

Funding every participant from one account produces a pattern that *resembles*
one person running 20 wallets. The difference is real, but it has to be visible.

**Do:**
- Have each participant **generate their own wallet** and send you the public
  address. They hold their keys; you never do.
- **Fund as they sign up**, over days — not 20 payments in one burst.
- Keep a **cohort record** (below) mapping a real person to each address, with
  their consent.
- Let them make their own choices — which group, whether to bid, what discount.
  Independent decisions are what distinguishes a cohort from a puppet show.
- **State plainly in your submission** that pilot participants were sponsored
  with ~$2 of XLM. Disclosed sponsorship is normal practice. Undisclosed
  sponsorship that gets discovered reads as fabrication.

**Don't:**
- Generate keypairs yourself and call them users. `scripts/seed-activity.mjs`
  is for testnet demonstration only — it must never be pointed at mainnet.
- Fund everyone in one transaction batch.
- Have one person operate multiple wallets "to fill a group."

### Cohort record template

Keep this privately (it contains personal data); publish only the aggregate.

| # | Name / handle | Contact | Stellar address | Funded | Group | Completed | Consent |
|---|---|---|---|---|---|---|---|
| 1 | | | `G…` | | | | ☐ |

For the submission, publish the **addresses and activity only** — no names.

---

## 3. Recruiting 20 people

You need roughly **4 groups of 5**, or 3 groups of 7. Sources, roughly in order
of conversion rate:

1. **People who already know you** — classmates, friends, family, colleagues.
   Highest conversion by far. Ten people here is realistic and is half your
   target. A ROSCA is a familiar concept in many families (chit fund, committee,
   kuri, tanda) — lead with that, not with "Soroban."
2. **Your existing feedback-form respondents.** They already engaged with the
   project. Email them first; they are pre-qualified.
3. **Stellar Discord / Developer Discord.** The `#dev-discussion` and project
   showcase channels. Framing: "testing a ROSCA protocol on mainnet, need 20
   pilot users, costs you nothing, takes 5 minutes."
4. **Stellar Community Fund / ecosystem forums.** Slower, but a post there
   doubles as your community-contribution artifact (requirement 12).
5. **Twitter/X.** Your launch post (requirement 8) with an explicit call for
   pilot testers.
6. **University blockchain/CS clubs.** Often actively looking for something real
   to try.

### The ask, written out

> I built Plexa, a savings-circle (ROSCA) protocol on Stellar. I need 20 people
> to try it on mainnet for real — takes about 5 minutes, and I'll send you the
> ~$2 of XLM it costs, so it's free to you. You install a wallet, join a group
> of 5, and contribute a few cents each round. You get it all back at the end.
> It's an unaudited pilot, so the amounts are deliberately tiny.

Honest, short, states the cost and the risk. Don't oversell it.

---

## 4. Group configuration for the pilot

Periods must be short enough that cycles **complete** inside your submission
window — a completed cycle is far stronger evidence than an in-progress one.

| Setting | Value | Why |
|---|---|---|
| Currency | **XLM** | No trustline, no oracle, no swap path |
| Members | 5 | Small enough to fill, enough for a real auction |
| Contribution | 0.5 XLM | ~$0.08 per period |
| Period length | **2 hours** | A 5-member cycle completes in ~10 hours |
| Contribution window | 45 min | |
| Settlement window | 15 min | |
| Auction window | 30 min | Leaves a 30 min payout window |
| Visibility | Public | So it appears in discovery and is independently verifiable |

Run **at least one group to full completion** — through every period, with
payouts claimed and collateral withdrawn. That single completed cycle is the
most persuasive artifact you will have.

Keep the keeper running (`keeper/`) so periods close on schedule. It is not a
safety dependency — any member action advances an overdue group — but a pilot
that closes punctually looks far better than one that stalls.

---

## 5. Timeline

Assuming a two-week window:

| Days | Work |
|---|---|
| 1 | Fund mainnet deployer, deploy contracts, verify addresses on Stellar Expert |
| 1 | Ship the mainnet frontend, run one solo group end-to-end yourself first |
| 2–3 | Recruit cohort 1 (your personal network — aim for 10) |
| 3–4 | Run groups 1–2 to completion; fix whatever the first real users trip over |
| 5–8 | Recruit cohort 2 (community/Twitter — aim for 15 more) |
| 8–10 | Run groups 3–5 to completion |
| 11 | Export activity, capture screenshots, write up the evidence |
| 12–13 | Launch post, demo video, submission assembly |
| 14 | Buffer — you will need it |

**Run one group entirely by yourself before inviting anyone.** Finding a broken
mainnet flow with 20 people watching is a much worse day.

---

## 6. Evidence to collect

Requirements 5 and 6 are satisfied by artifacts, so collect them as you go:

- `node scripts/export-activity.mjs` against mainnet — produces the per-wallet
  activity table. Commit the output.
- **Distinct participating addresses** with a link to each on Stellar Expert.
- **At least one completed cycle**: group address, every period's winner, payout
  claims, collateral withdrawals.
- **Transaction hashes** for a representative sample. The frontend's
  `TxReceipts` panel surfaces these already.
- **Screenshots** of the live mainnet app with real groups.
- A short note on **how participants were recruited and sponsored** — the
  transparency that makes the rest credible.

---

## 7. If you cannot reach 20

Say so rather than manufacturing the number. A submission that reports "we ran a
12-person mainnet pilot across 3 groups, 2 cycles completed, here is every
transaction" is stronger than one claiming 20 with wallets that visibly trace to
a single funder. The first is a real result; the second fails the moment anyone
opens a block explorer.

If you fall short, redirect the effort into depth: more completed cycles, richer
documentation, a genuinely thorough security review. Those are within your
control in a way that other people's participation is not.
