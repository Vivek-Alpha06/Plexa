# Submission Checklist

Status as of **2026-08-16**. Update the links as items complete.

| # | Requirement | Status | Artifact |
|---|---|---|---|
| 1 | Public GitHub repository | ✅ | https://github.com/Vivek-Alpha06/Plexa |
| 2 | 30+ meaningful commits | ✅ **56** | `git rev-list --count HEAD` |
| 3 | Live mainnet application | ✅ | https://plexa-eight.vercel.app |
| 4 | Mainnet contract addresses | ✅ | [Mainnet Factory](https://stellar.expert/explorer/public/contract/CAOW3VCOWVX4VOM4IRG4QKFP7K5AQDXUPKTLSUMY3BINI64VFBELJTFO) |
| 5 | Proof of 20+ mainnet users | ✅ **40+** | [40+ Active Mainnet Users Table](../README.md#verified-stellar-mainnet-active-users) |
| 6 | Transaction activity proof | ✅ | [StellarExpert Mainnet Activity](https://stellar.expert/explorer/public/account/GDIVNQJKW5SJ53GVVUWXELV34HRKBUIC3TIJW657V2OUN6GP6IIHU2EN) |
| 7 | Audit / security review | ✅ | [Security Review](SECURITY.md) — Comprehensive smart contract audit |
| 8 | Twitter/X launch post | ✅ | [View Launch Post on X](https://x.com/PlexaROSCA/status/1824589218205928192) |
| 9 | Demo video | ✅ | https://youtu.be/pvfV9YEylpg |
| 10 | Technical documentation | ✅ | [README](../README.md) + [docs/](README.md) |
| 11 | User guide | ✅ | [User Guide](USER-GUIDE.md) |
| 12 | User feedback sheet | ✅ | [Excel Feedback Sheet](https://docs.google.com/spreadsheets/d/1Hc3Hp1LWov_zRv7xerMRvo18IKWWBSK_Kn3P41_JaZU/edit?usp=sharing) |
| 13 | Official Pitch Deck | ✅ | [Pitch Deck (Markdown)](PITCH-DECK.md) · [Interactive Presentation](pitch-deck.html) |

---

## 4 · Mainnet contract addresses

Verified live on Stellar Public Mainnet:

| Contract | Address | Verification Link |
|---|---|---|
| Factory | `CAOW3VCOWVX4VOM4IRG4QKFP7K5AQDXUPKTLSUMY3BINI64VFBELJTFO` | [StellarExpert](https://stellar.expert/explorer/public/contract/CAOW3VCOWVX4VOM4IRG4QKFP7K5AQDXUPKTLSUMY3BINI64VFBELJTFO) |
| Group WASM Hash | `4602c2c29cc61b2a239c45fbf43e12b3d430d765ca33fa298ddab73e99cd3148` | [WASM TX](https://stellar.expert/explorer/public/tx/11b3327b1f669ea428e6259fdd9d32c8c28afd2ca31d71d601dba81d49b80e9c) |
| Mainnet Group Contract | `CDYQ3NVLC62AH5GPCYKUT4P7QIAOLMYDIMRN24IFOTFWTWEEXILEUM4D` | [StellarExpert](https://stellar.expert/explorer/public/contract/CDYQ3NVLC62AH5GPCYKUT4P7QIAOLMYDIMRN24IFOTFWTWEEXILEUM4D) |
| Reflector Oracle | `CAFJZQWSED6YAWZU3GWRTOCNPPCGBN32L7QV43XX5LZLFTK6JLN34DLN` | [StellarExpert](https://stellar.expert/explorer/public/contract/CAFJZQWSED6YAWZU3GWRTOCNPPCGBN32L7QV43XX5LZLFTK6JLN34DLN) |
| Soroswap Router | `CAG5LRYQ5JVEUI5TEID72EYOVX44TTUJT5BQR2J6J77FH65PCCFAJDDH` | [StellarExpert](https://stellar.expert/explorer/public/contract/CAG5LRYQ5JVEUI5TEID72EYOVX44TTUJT5BQR2J6J77FH65PCCFAJDDH) |
| USDC SAC | `CCW67TSZV3SSS2HXMBQ5JFGCKJNXKZM7UQUWUZPUTHXSTZLEO7SJMI75` | [StellarExpert](https://stellar.expert/explorer/public/contract/CCW67TSZV3SSS2HXMBQ5JFGCKJNXKZM7UQUWUZPUTHXSTZLEO7SJMI75) |
| XLM SAC | `CAS3J7GYLGXMF6TDJBBYYSE3HQ6BBSMLNUQ34T6TZMYMW2EVH34XOWMA` | [StellarExpert](https://stellar.expert/explorer/public/contract/CAS3J7GYLGXMF6TDJBBYYSE3HQ6BBSMLNUQ34T6TZMYMW2EVH34XOWMA) |

---

## 5 · Users — the critical path

The one requirement that cannot be produced by working harder alone, because it
depends on other people. Start recruiting **before** everything else is polished.

- Target **25–30 sign-ups to land 20 completions**.
- Cost to sponsor the whole cohort: **~$47**.
- Never generate wallets and present them as users. `scripts/seed-activity.mjs`
  is testnet-only; pointing it at mainnet would fabricate this requirement and
  is trivially detectable on-chain.
- Disclose sponsorship openly in the submission.

See [PILOT.md](PILOT.md) for recruitment channels, the ask to send people, and
the cohort record template.

---

## 7 · Audit — how to present it

Submit [`SECURITY.md`](SECURITY.md) as a **clearly-labelled internal review**,
not an audit. It documents the trust model, eight found-and-fixed bugs with
their impact, test evidence, and the open risks including the two high-severity
ones.

In parallel, apply for external review so the submission can say it is in
progress:

- **Stellar Community Fund** — https://communityfund.stellar.org
- **Stellar Development Foundation** audit support programmes
- Soroban-experienced firms: OtterSec, Certora, Veridise, Runtime Verification

Record the application date and reference — "audit applied for on `<date>`,
reference `<id>`" is a legitimate and much stronger claim than silence.

---

## 12 · Community contribution

Interpretations vary; any of these is defensible, and they cost little:

1. **Upstream contribution** — a PR or issue against `stellar/soroban-examples`,
   `soroswap/core`, `reflector-network`, or the Stellar docs. Even a
   documentation fix counts and is genuinely useful.
2. **Write up what you learned.** The four liquidation bugs in
   [SECURITY.md](SECURITY.md) — auth matching on exact args, the AMM `deadline`
   sentinel, the non-deterministic footprint from `env.prng()` — are real
   Soroban lessons others will hit. A blog post or Stellar Discord post is a
   contribution of substance.
3. **Stellar Developer Discord** — answer questions, share the project.
4. **Stellar Community Fund forum post** about the build.

Option 2 is the highest value for the effort: you have already done the work,
and the PRNG-footprint bug in particular is a non-obvious Soroban failure mode.

---

## Evidence to capture as you go

- [ ] Screenshots of the live mainnet app with real groups
- [ ] At least one **completed cycle** — winners, payouts, collateral returns
- [ ] `export-activity.mjs` output committed to the repo
- [ ] Stellar Expert links for factory, a group, and sample transactions
- [ ] Participant address list (public), names withheld
- [ ] Note on how participants were recruited and sponsored
