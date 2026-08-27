# Plexa Documentation Portal

Welcome to the comprehensive documentation index for Plexa — the decentralized Rotating Savings and Credit Association (ROSCA) protocol built on Stellar and Soroban.

🌐 **Dedicated Live Documentation Website:** **[https://plexa-document.vercel.app](https://plexa-document.vercel.app)**

---

## 📚 Master Documentation Index

| Document | Description / Focus Area |
| :--- | :--- |
| 🌐 **[Dedicated Web Docs](https://plexa-document.vercel.app)** | Interactive public documentation website with live auction simulator, API specs, and setup guides |
| 📈 **[Monthly Growth Report](GROWTH-REPORT.md)** | **Level 7 Founder Belt** startup growth metrics, user retention, unit economics, and founder roadmap |
| 🛡️ **[Security Review & Audit](SECURITY.md)** | Smart contract internal audit, trust model, threat matrix, invariant proofs, and 8 resolved bugs |
| 👥 **[User Guide & Tutorials](USER-GUIDE.md)** | End-to-end participant guide: wallet connection (Freighter/Albedo), circle creation, bidding, claiming |
| 🎯 **[Official Pitch Deck](PITCH-DECK.md)** · **[Interactive Presentation](pitch-deck.html)** | 10-slide comprehensive deck for judges, partners, and investors |
| 📊 **[User Feedback Spreadsheet](Plexa_User_Feedback_50_Responses.xlsx)** · **[Collection method](FEEDBACK.md)** | Exported pilot onboarding and product feedback, with the form schema and the honest limits of the dataset |
| ✍️ **[Soroban Lessons (blog)](BLOG-SOROBAN-LESSONS.md)** | Ecosystem contribution: five Soroban bugs that only show up on mainnet |
| 🔎 **[Mainnet User Verification](MAINNET-USERS.md)** | Chain-generated proof of mainnet user activity |
| 📋 **[Submission Checklist](SUBMISSION.md)** | Requirement-by-requirement verification matrix for Level 6 & Level 7 |
| 🚀 **[Pilot Operations Plan](PILOT.md)** | Operational plan for running the 50-user pilot, economics, recruitment, and evidence capture |
| 📝 **[Changelog & Release Notes](CHANGELOG.md)** | Release history, bug fixes, performance optimizations, and contract upgrades |
| 🐦 **[Launch Post Drafts](LAUNCH-POST.md)** | Social media announcement threads and promotional copy |

---

## ⚡ Smart Contract Summary

| Contract | Role / Capability | Mainnet Contract ID |
| :--- | :--- | :--- |
| **Factory Contract** | Deploys groups, discovery registry, reputation ledger, 48h timelocks | [`CAOW3VCOWVX4VOM4IRG4QKFP7K5AQDXUPKTLSUMY3BINI64VFBELJTFO`](https://stellar.expert/explorer/public/contract/CAOW3VCOWVX4VOM4IRG4QKFP7K5AQDXUPKTLSUMY3BINI64VFBELJTFO) |
| **Group WASM** | Uploaded bytecode for lightweight group creation | [`4602c2c29cc61b2a239c45fbf43e12b3d430d765ca33fa298ddab73e99cd3148`](https://stellar.expert/explorer/public/tx/11b3327b1f669ea428e6259fdd9d32c8c28afd2ca31d71d601dba81d49b80e9c) |
| **Active Mainnet Group** | Live savings circle custodying member deposits and managing auction rounds | [`CDYQ3NVLC62AH5GPCYKUT4P7QIAOLMYDIMRN24IFOTFWTWEEXILEUM4D`](https://stellar.expert/explorer/public/contract/CDYQ3NVLC62AH5GPCYKUT4P7QIAOLMYDIMRN24IFOTFWTWEEXILEUM4D) |
| **Reflector Oracle** | Decentralized price feed adapter for XLM/USD and USDC/USD division | [`CAFJZQWSED6YAWZU3GWRTOCNPPCGBN32L7QV43XX5LZLFTK6JLN34DLN`](https://stellar.expert/explorer/public/contract/CAFJZQWSED6YAWZU3GWRTOCNPPCGBN32L7QV43XX5LZLFTK6JLN34DLN) |
| **Soroswap Router** | Decentralized AMM router executing default liquidation swaps for USDC groups | [`CAG5LRYQ5JVEUI5TEID72EYOVX44TTUJT5BQR2J6J77FH65PCCFAJDDH`](https://stellar.expert/explorer/public/contract/CAG5LRYQ5JVEUI5TEID72EYOVX44TTUJT5BQR2J6J77FH65PCCFAJDDH) |

---

## 🛠️ Developer Commands

```bash
# Run contract unit tests
bash scripts/test.sh

# Run end-to-end integration tests against deployed WASM
cd e2e && node e2e.mjs

# Build and typecheck frontend
cd frontend && npm run build

# Deploy to Stellar Mainnet
NETWORK=mainnet-rpc STELLAR_ACCOUNT=<key> ./scripts/deploy.sh
```
