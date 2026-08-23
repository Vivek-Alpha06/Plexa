# Plexa — User Guide

Plexa runs **savings circles** on the Stellar blockchain. If you have heard of a
chit fund, committee, kuri, tanda, susu or ROSCA — this is that, with the
organiser replaced by a smart contract.

**Time needed:** about 5 minutes to join. **Cost:** a few cents.

---

## What a savings circle is

Five people each put in a small amount every round. One person takes the whole
pot that round. Next round, everyone pays in again and someone else takes it.
After five rounds, everyone has paid in five times and taken the pot once.

Nobody profits by default — the value is in *timing*. If you need money now, you
take an early pot and keep paying afterwards. If you can wait, you take a later
pot and effectively earn a discount for waiting.

**Who takes the pot each round?** Whoever bids the largest discount. If you bid
a 10% discount, you receive 90% of the pot and the 10% you gave up is split
among all members. Bidding is how the circle prices patience. If nobody bids,
the pot goes to members in join order.

**What stops someone taking the pot and vanishing?** Collateral. Everyone locks
a deposit up front, held by the contract until the circle finishes. Miss a
contribution and it is taken from your collateral automatically. You get your
collateral back when the cycle completes.

---

## Before you start

You need two things.

### 1. A Stellar wallet

Install **[Freighter](https://freighter.app)** — a browser extension, like
MetaMask but for Stellar. Available for Chrome, Firefox and Edge.

1. Install it and click **Create new wallet**.
2. **Write down your 12-word recovery phrase on paper.** Anyone with those words
   controls your money, forever. Nobody from Plexa will ever ask for them.
3. Set a password. Done — you have an address starting with `G…`.

### 2. A little XLM

XLM is Stellar's native currency, used for the deposit and for network fees
(fees are fractions of a cent).

If you are joining a **pilot group**, the organiser will send you the ~$2 of XLM
it costs. Send them your `G…` address — that is public and safe to share. Never
share your recovery phrase.

Otherwise, buy XLM on any exchange and withdraw it to your Freighter address.

> **Keep at least 2 XLM spare.** Stellar requires every account to hold a small
> minimum balance (~1 XLM) to exist. Sending your entire balance away will fail.

---

## Joining a circle

### Step 1 — Connect

Open the app and click **Connect Wallet**. Freighter asks for approval. Your
address appears in the header along with your balance.

### Step 2 — Find a group

Go to **Groups** to see open circles. Each card shows:

- **Currency** — XLM or USDC. Pilot groups are XLM.
- **Contribution** — what you pay each period.
- **Members** — how many have joined out of the target.
- **Period length** — how long each round lasts.

> **Only join groups you reached through the Plexa app itself.** The app checks
> each group against the official registry and shows a red warning on anything
> unregistered. Anyone can deploy a look-alike contract that runs identical code
> but hands control to them. If you see that warning, do not deposit — the app
> will block the transaction anyway.

### Step 3 — Request to join

Click **Join Now**. Existing members vote to approve you. Small pilot groups
approve quickly.

### Step 4 — Lock your collateral

Once approved, click **Lock Collateral**. This is your deposit, equal to the
full pot, and it is what makes the circle trustworthy without anyone vouching
for anyone. Freighter asks you to sign.

You get this back after the circle finishes.

### Step 5 — Contribute

Each period, click **Contribute** during the contribution window. The group
starts automatically once every member has joined and paid the first round.

---

## Each round

Every period has four phases, shown by a countdown in the app:

| Phase | What happens |
|---|---|
| **Contribution** | Pay in for this round |
| **Settlement** | Missed contributions are covered from collateral |
| **Auction** | Bid a discount to take this round's pot |
| **Payout** | The winner claims |

### Bidding

During the auction, enter a discount percentage and click **Place Bid**. The
largest discount wins.

- Bid **0%** to take the full pot with no discount — wins only if nobody else bids.
- Bid **10%** to take 90% of the pot; the remaining 10% is shared among everyone.
- **Bid higher if you need the money sooner.** Bid nothing, or wait, if you don't.

You can win **once per cycle**. After winning you keep contributing but can no
longer bid — that is what makes it a rotation rather than a lottery.

### Claiming

Won a round? Click **Claim Payout**. Funds go straight to your wallet.

### If you miss a contribution

It is taken from your collateral automatically. Nothing breaks and nobody has to
chase you — but your collateral is now short, so **top it up** when the app
prompts. Repeatedly falling short can remove you from the group and costs you
the reputation score that carries across circles.

---

## When the circle finishes

After the last period, and a **24-hour grace window**, click **Claim
Collateral** to withdraw your deposit — minus anything used to cover missed
contributions.

Finish without ever defaulting and you become a *graduate*: your on-chain
reputation increases, which qualifies you for circles that require it.

---

## Common questions

**Do I have to trust the organiser?**
No. Contributions, collateral and payouts are held and moved by the contract.
The person who created the group cannot take your money or change the rules. The
schedule is fixed at creation and enforced by the network.

**What if everyone stops using the app?**
Funds are not stuck. Any member action closes out overdue periods, so you can
always withdraw what you are owed by interacting with the contract directly.

**What if I lose my recovery phrase?**
Your funds are gone permanently. Nobody can recover them. Write it on paper.

**Is my money safe?**
These contracts have **not been independently audited**. Pilot amounts are
deliberately tiny for exactly this reason. Do not put in more than you would
shrug off losing.

**What do fees cost?**
Fractions of a cent per transaction, paid in XLM.

**Can I leave early?**
No. Collateral is locked for the cycle — that commitment is what makes the
circle work for everyone else. Only join circles you can see through.

---

## Getting help

- Something broken or confusing → open an issue on
  [GitHub](https://github.com/Vivek-Alpha06/Plexa/issues)
- Feedback & Suggestions → view the [community feedback sheet](https://docs.google.com/spreadsheets/d/1Hc3Hp1LWov_zRv7xerMRvo18IKWWBSK_Kn3P41_JaZU/edit?usp=sharing)
- Verify anything yourself → every action links to
  [Stellar Expert](https://stellar.expert), where the transaction is public
