# 🎯 Plexa — Pitch Deck
### *Decentralized Rotating Savings & Credit Association (ROSCA) Protocol on Stellar & Soroban*

---

## 📌 Slide 1: Cover & Vision
* **Project Name:** Plexa Protocol
* **Tagline:** Bringing the world's $500 Billion informal savings circles on-chain with trustless collateral, open discount auctions, and automated default protection.
* **Network:** Stellar Public Mainnet & Testnet
* **Live dApp:** [https://plexa-eight.vercel.app](https://plexa-eight.vercel.app/)
* **Contract Explorer:** [StellarExpert Mainnet Contract](https://stellar.expert/explorer/public/contract/CAOW3VCOWVX4VOM4IRG4QKFP7K5AQDXUPKTLSUMY3BINI64VFBELJTFO)

> **Vision:** Empower billions of people who rely on informal community banking (*chit funds, susu, tandas, chamas, committees*) with a mathematically guaranteed, non-custodial protocol running on Stellar’s ultra-fast, low-cost financial rails.

---

## ⚠️ Slide 2: The Problem
Over **1.4 Billion adults** worldwide are unbanked or underserved by traditional banks. To save money and access lump-sum credit, communities form informal peer-to-peer savings circles (**ROSCAs** / *Chit Funds* / *Tandas*):
1. **Organizer Risk & Theft:** Traditional organizers can abscond with the pool or misappropriate pooled funds.
2. **Member Default Risk:** Early winners often stop contributing once they receive the pot, leaving later members with permanent financial loss.
3. **No Credit Scoring or Portability:** Decades of reliable participation in informal savings circles yield zero verifiable credit history.
4. **Manual & Opaque Record-Keeping:** Paper-based ledgers cause disputes, missed deadlines, and calculation errors.

---

## 💡 Slide 3: The Solution — Plexa
Plexa eliminates all counterparty risk by replacing human intermediaries with verifiable **Soroban Smart Contracts**:
* 🛡️ **100% Non-Custodial Collateral Escrow:** Every member locks collateral before joining, guaranteeing 100% default protection.
* ⚡ **Open Discount Auction Engine:** Members bid the discount they are willing to give up to claim the pot early; the discount is split equally among all members as yield/dividends.
* 🤖 **Autonomous Liquidation:** Missed contributions are automatically covered from the defaulter's collateral (using on-chain **Soroswap DEX** routing & **Reflector Oracle** feeds).
* 📜 **Verifiable On-Chain Reputation:** Cleanly completed cycles build immutable on-chain reputation scores, unlocking access to higher-tier savings pools without centralized KYC.

---

## ⚙️ Slide 4: How Plexa Works (The 4-Stage Lifecycle)

```
 [1. Deposit & Lock] ──▶ [2. Contribution] ──▶ [3. Discount Auction] ──▶ [4. Pot Payout]
         ▲                                                                      │
         └─────────────────── 100% Collateral Returned ─────────────────────────┘
```

1. **Group Formation:** Members join and lock 100% collateral in XLM or USDC.
2. **Fixed Contributions:** Each period, members deposit their fixed contribution into the common pot.
3. **Open Discount Auction:** Members who need cash now bid a discount. The highest discount takes the pot; discount is divided as savings profit among all members.
4. **Payout & Rotation:** The winning bidder claims the payout. Each member wins exactly once per cycle.
5. **100% Collateral Return:** When all periods complete and the grace window lapses, 100% of locked collateral unlocks for withdrawal.

---

## 💎 Slide 5: Core Tech Innovations
* **No Keeper Single-Point-of-Failure:** Built with permissionless progress mechanics — any member transaction moves overdue periods forward even if keeper bots are offline.
* **Multi-Asset Denomination:** Independent ROSCA groups run in native **XLM** (zero oracle risk) or **USDC** (stable pricing).
* **Cross-Asset Collateral Protection:** USDC pools accept XLM collateral sized dynamically by the **Reflector Oracle** and liquidated via **Soroswap DEX Router**.
* **Account Abstraction & Multi-Wallet:** Native support for browser extensions (**Freighter**) and web-based delegated signers (**Albedo**).

---

## 🌍 Slide 6: Market Opportunity
* **$500B+ Global Market:** ROSCAs exist in over 90 countries under various regional names:
  * 🇮🇳 *Chit Funds / Committees / Kuri* (India — $40B+ legal registered industry + massive informal market)
  * 🇲🇽 *Tandas / Cundinas* (Latin America)
  * 🇰🇪 *Chamas / Susu* (Sub-Saharan Africa)
  * 🇨🇳 *Hui / Tanomoshiko* (East Asia)
* **Why Stellar is the Winning Rail:**
  * Sub-cent transaction fees (~$0.00001 per call) make micro-savings economically viable.
  * 3–5 second finality matches instant cash expectations.
  * Native anchor network (MoneyGram Access, local stablecoins) enables seamless cash-to-crypto on/off ramps.

---

## 📈 Slide 7: Traction & Milestones (Level 6 Black Belt Achieved)
* ✅ **Stellar Public Mainnet Deployment:** Factory contract (`CAOW3VCOWVX4VOM4IRG4QKFP7K5AQDXUPKTLSUMY3BINI64VFBELJTFO`) & Group WASM live on ledger block `#64061228`.
* ✅ **51+ Verified Active Mainnet Users:** Real user wallet interactions documented with direct StellarExpert ledger proofs.
* ✅ **25+ Mainnet Operations Verified:** Deposits, bids, collateral locks, settlements, and payout claims confirmed on-chain.
* ✅ **Comprehensive Security Review:** Formal self-audit in `docs/SECURITY.md` covering 8 resolved Soroban vulnerability classes.
* ✅ **Community Engagement:** **200+ Likes on Instagram** ([@plexa_v1](https://www.instagram.com/plexa_v1/)) and official Twitter/X showcase thread.
* ✅ **User Feedback Iteration:** 50-user dataset captured, resulting in 13 direct code feature implementations with committed pull requests.

---

## 💰 Slide 8: Business & Revenue Model
* **Protocol Creation Fee (0.25%):** Micro-fee deducted from successful pot disbursements.
* **Liquidator Arb Margins:** Small fee margin incentivizing decentralized liquidation bots.
* **B2B / White-Label ROSCAs:** Enterprise savings circles for microfinance institutions (MFIs), unions, and cooperatives.
* **Fiat Anchor Routing Partnerships:** Revenue share with SEP-24/31 anchors and cash-in/cash-out providers.

---

## 🗺️ Slide 9: Strategic Roadmap
* **Phase 1: Foundation & Mainnet Launch (Completed)**
  * Native Soroban ROSCA smart contracts, Reflector Oracle, Soroswap AMM router, Freighter/Albedo dApp, Level 6 Mainnet audit.
* **Phase 2: Gasless Onboarding & Global Ramps (Q3–Q4 2026)**
  * Automated Stellar Fee Bump relayer for 100% gasless user onboarding.
  * In-app SEP-24 / SEP-31 MoneyGram Access cash on/off-ramp integration.
  * Telegram & WhatsApp bot alerts for contribution & auction deadlines.
* **Phase 3: DeFi Yield Amplification & Mobile Native (2027)**
  * Yield-bearing collateral via Stellar money markets (Blend Protocol).
  * Native iOS & Android non-custodial mobile app.

---

## 👥 Slide 10: Team & Summary
* **Founder & Core Developers:** Deep expertise in Rust, Soroban SDK, TypeScript, and decentralized financial protocol engineering.
* **Live Application:** [https://plexa-eight.vercel.app](https://plexa-eight.vercel.app/)
* **Code Repository:** [https://github.com/Vivek-Alpha06/Plexa](https://github.com/Vivek-Alpha06/Plexa)
* **Socials:** [@Plexa_v1 on X](https://x.com/Plexa_v1) · [@plexa_v1 on Instagram](https://www.instagram.com/plexa_v1/)

> **Plexa: Financial inclusion through trustless, community-powered savings circles.**
