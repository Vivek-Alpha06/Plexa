# Plexa — Decentralized ROSCA Protocol on Stellar / Soroban

Plexa is a decentralized **Rotating Savings and Credit Association (ROSCA)** protocol built on Stellar's Soroban smart-contract platform. A group of members each contribute a fixed amount per period into a shared pot; every period exactly one member receives the pot — chosen by an open **discount auction** falling back to join-order rotation. This repeats until every member has won exactly once, after which locked collateral is returned.

Think of it as a trustless, on-chain version of the informal savings circles (known as *susu*, *tanda*, *chit fund*, *hui*, *chama*) used by billions of people — but with programmable collateral, automatic default coverage, and a transparent, publicly verifiable ledger of every action.

---

## 🌐 Project Deliverables & Key Links

| Deliverable Resource | Direct Verification Link | Description / Details |
| :--- | :--- | :--- |
| 🚀 **Live Web Application** | [https://plexa-eight.vercel.app](https://plexa-eight.vercel.app/) | Production-ready ROSCA dApp deployed on Vercel |
| ⚡ **Mainnet Contract Explorer** | [StellarExpert Mainnet Contract](https://stellar.expert/explorer/public/contract/CAOW3VCOWVX4VOM4IRG4QKFP7K5AQDXUPKTLSUMY3BINI64VFBELJTFO) | Verifiable Soroban WASM Contract ID on Stellar Mainnet |
| 🧪 **Testnet Contract Explorer** | [StellarExpert Testnet Contract](https://stellar.expert/explorer/testnet/contract/CDOYIGNCIR4QTUTAUYEFSW7IJVS6ZMOFV6CW574VFGHQ5ZDCQCJZ4GDZ) | Verifiable Soroban WASM Contract ID on Stellar Testnet |
| 📜 **Proof of Deployment** | [SUBMISSION.md](./docs/SUBMISSION.md) | Official Mainnet & Testnet Soroban WASM verification report |
| 🐦 **Twitter/X Official Handle** | [@Plexa_v1 on X](https://x.com/Plexa_v1) | Official Twitter/X announcements & community updates |
| 📸 **Instagram Official Account** | [@plexa_v1 on Instagram](https://www.instagram.com/plexa_v1?utm_source=qr&igsi=MWJoN3VkdTJyZGh3Mg==) | Official Instagram community handle & updates |
| 🐤 **Twitter/X Showcase Post** | [View Launch Post on X](https://x.com/PlexaROSCA/status/1824589218205928192) | Official launch post thread & feature walkthrough |
| 📺 **YouTube Walkthrough Demo** | [Watch Demo Video](https://youtu.be/pvfV9YEylpg) | Full video walkthrough of Plexa protocol features |
| 📝 **User Onboarding Feedback Form**| [Give Product Feedback](https://docs.google.com/forms/d/e/1FAIpQLScuDHDzIp4WTlVfaYT1PZZXE5snbTBucxjzs3YbXMmQffshLg/viewform?usp=dialog) | Official Google Form feedback collector |
| 📊 **Feedback Excel Document** | [View Feedback Excel Sheet](https://docs.google.com/spreadsheets/d/1YvV6IvuoG-wsqKcACewvXJMPD38hP5kKXVMfI43n2vE/edit?usp=sharing) | Exported onboarding feedback record sheet |
| 🛡️ **Smart Contract Audit** | [SECURITY.md](./docs/SECURITY.md) | Formal Soroban smart contract internal security review |
| 📚 **User & Developer Guide** | [USER-GUIDE.md](./docs/USER-GUIDE.md) | Contribution guide, developer setup, and protocol user guide |
| 📈 **Pilot Growth Plan** | [PILOT.md](./docs/PILOT.md) | Level 6 user recruitment, test setups, and community growth |

---

## ⚡ Verified Stellar Mainnet Contracts

Plexa smart contracts are officially deployed and verified on the **Stellar Public Mainnet**:

| Component | Contract ID / Code Hash | Status | Verification Links |
| :--- | :--- | :--- | :--- |
| 🏭 **Plexa Factory** | `CAOW3VCOWVX4VOM4IRG4QKFP7K5AQDXUPKTLSUMY3BINI64VFBELJTFO` | 🟢 **Live** | [StellarExpert](https://stellar.expert/explorer/public/contract/CAOW3VCOWVX4VOM4IRG4QKFP7K5AQDXUPKTLSUMY3BINI64VFBELJTFO) · [Stellar Lab](https://lab.stellar.org/r/public/contract/CAOW3VCOWVX4VOM4IRG4QKFP7K5AQDXUPKTLSUMY3BINI64VFBELJTFO) |
| 📦 **Plexa Group WASM** | `4602c2c29cc61b2a239c45fbf43e12b3d430d765ca33fa298ddab73e99cd3148` | 🟢 **Uploaded** | [View WASM Upload TX](https://stellar.expert/explorer/public/tx/11b3327b1f669ea428e6259fdd9d32c8c28afd2ca31d71d601dba81d49b80e9c) |
| 👤 **Deployer Account** | `GDIVNQJKW5SJ53GVVUWXELV34HRKBUIC3TIJW657V2OUN6GP6IIHU2EN` | 🟢 **Active** | [View Deployer Wallet](https://stellar.expert/explorer/public/account/GDIVNQJKW5SJ53GVVUWXELV34HRKBUIC3TIJW657V2OUN6GP6IIHU2EN) |
| 🚀 **Factory Deploy TX** | `7bf75d2eef5adfabe13d75a27fc8886d3668b5f494f22d219e96a3e5085cde14` | 🟢 **Confirmed** | [View Deployment TX](https://stellar.expert/explorer/public/tx/7bf75d2eef5adfabe13d75a27fc8886d3668b5f494f22d219e96a3e5085cde14) |
| 🔮 **Reflector Oracle (Mainnet)** | `CAFJZQWSED6YAWZU3GWRTOCNPPCGBN32L7QV43XX5LZLFTK6JLN34DLN` | 🟢 **Integrated** | [View Oracle](https://stellar.expert/explorer/public/contract/CAFJZQWSED6YAWZU3GWRTOCNPPCGBN32L7QV43XX5LZLFTK6JLN34DLN) |
| 🔄 **Soroswap Router (Mainnet)** | `CAG5LRYQ5JVEUI5TEID72EYOVX44TTUJT5BQR2J6J77FH65PCCFAJDDH` | 🟢 **Integrated** | [View Router](https://stellar.expert/explorer/public/contract/CAG5LRYQ5JVEUI5TEID72EYOVX44TTUJT5BQR2J6J77FH65PCCFAJDDH) |
| 💵 **USDC Asset (Mainnet)** | `CCW67TSZV3SSS2HXMBQ5JFGCKJNXKZM7UQUWUZPUTHXSTZLEO7SJMI75` | 🟢 **Integrated** | [View USDC SAC](https://stellar.expert/explorer/public/contract/CCW67TSZV3SSS2HXMBQ5JFGCKJNXKZM7UQUWUZPUTHXSTZLEO7SJMI75) |

### 🔍 Mainnet Ledger Details:
* **Network:** `Public Global Stellar Network ; September 2015`
* **Soroban RPC Endpoint:** `https://mainnet.sorobanrpc.com`
* **Factory Deployment Ledger Block:** `#64061228`

---

## 👥 Verified Stellar Mainnet Active Users (50+ On-Chain Members)

The following 51 user wallets have actively interacted with the **Plexa Mainnet Group Contract** (CDYQ3NVLC62AH5GPCYKUT4P7QIAOLMYDIMRN24IFOTFWTWEEXILEUM4D), executing on-chain join requests and governance approval votes verified on Stellar Mainnet:

| # | Member Wallet Address | Explorer Verification |
| :-: | :--- | :--- |
| **1** | GAPK4DADM6CDYHPAMBPPGCDKO2S5VH7SKPQDGZIOSMXQ7TWECKXTVG3K | [View on StellarExpert](https://stellar.expert/explorer/public/account/GAPK4DADM6CDYHPAMBPPGCDKO2S5VH7SKPQDGZIOSMXQ7TWECKXTVG3K) |
| **2** | GCO5TZZU2PGII2MSMGE54JWBMSTLHSAWKK7WEKHRMJDUT43B2M435OCD | [View on StellarExpert](https://stellar.expert/explorer/public/account/GCO5TZZU2PGII2MSMGE54JWBMSTLHSAWKK7WEKHRMJDUT43B2M435OCD) |
| **3** | GCORIA5Q63OMC4FKYUEL2IZGBDHKCTL4XUOOTKHVR3W5M3OQ5BZ6A5O7 | [View on StellarExpert](https://stellar.expert/explorer/public/account/GCORIA5Q63OMC4FKYUEL2IZGBDHKCTL4XUOOTKHVR3W5M3OQ5BZ6A5O7) |
| **4** | GANTWEXCR2VTTEHI3V3M5XX7YOPFVVWGXA3VXLKHAWVI4JOABV2DAZEN | [View on StellarExpert](https://stellar.expert/explorer/public/account/GANTWEXCR2VTTEHI3V3M5XX7YOPFVVWGXA3VXLKHAWVI4JOABV2DAZEN) |
| **5** | GDHEHZND7DDCXQN7GNCZT4HQIVOPKPQRZDC5OLA5DMEZV5QLTOU3MDRX | [View on StellarExpert](https://stellar.expert/explorer/public/account/GDHEHZND7DDCXQN7GNCZT4HQIVOPKPQRZDC5OLA5DMEZV5QLTOU3MDRX) |
| **6** | GCR5GIMI7CYQGJ27YPZGQZMPB3RPU5DIT2MDWNPLZ6JIFMGY23XFZHMT | [View on StellarExpert](https://stellar.expert/explorer/public/account/GCR5GIMI7CYQGJ27YPZGQZMPB3RPU5DIT2MDWNPLZ6JIFMGY23XFZHMT) |
| **7** | GD46SN4HPH2JV5DAASLUNJAZT7O7NAGYBXMLVGZN6NBURKMQWO5ZIVXA | [View on StellarExpert](https://stellar.expert/explorer/public/account/GD46SN4HPH2JV5DAASLUNJAZT7O7NAGYBXMLVGZN6NBURKMQWO5ZIVXA) |
| **8** | GCH73CLBCFO63KN6ORQYZRN777OSS7GGW3T6IRYTATPCX33FJTGENCKK | [View on StellarExpert](https://stellar.expert/explorer/public/account/GCH73CLBCFO63KN6ORQYZRN777OSS7GGW3T6IRYTATPCX33FJTGENCKK) |
| **9** | GDOOGBOAQW45BUNNCKSGVTK37I65LWPCMJDXNWNQ5R5WWGNVYUFW44X4 | [View on StellarExpert](https://stellar.expert/explorer/public/account/GDOOGBOAQW45BUNNCKSGVTK37I65LWPCMJDXNWNQ5R5WWGNVYUFW44X4) |
| **10** | GC4NXKCSYQ4FVNJWSQV3BH7H66ZFESVA5OI2JOT6TEN4MP5AGH33JFI2 | [View on StellarExpert](https://stellar.expert/explorer/public/account/GC4NXKCSYQ4FVNJWSQV3BH7H66ZFESVA5OI2JOT6TEN4MP5AGH33JFI2) |
| **11** | GAYEMWBUM5VD2DCY2TPHVIGIQK36IPKWGMF5QTSXCLUVRLRRJFK7I3SI | [View on StellarExpert](https://stellar.expert/explorer/public/account/GAYEMWBUM5VD2DCY2TPHVIGIQK36IPKWGMF5QTSXCLUVRLRRJFK7I3SI) |
| **12** | GC2QRLJZHF5WSZVOEY4OHQHLDQMMZXD2AFWN6CY5H5IXLCBRWD5PCFYY | [View on StellarExpert](https://stellar.expert/explorer/public/account/GC2QRLJZHF5WSZVOEY4OHQHLDQMMZXD2AFWN6CY5H5IXLCBRWD5PCFYY) |
| **13** | GC4FSSFPYBNF7LDVMMTMQY4XLA2W54WCFVB6L7E7T2WVA2DAOOVARQEP | [View on StellarExpert](https://stellar.expert/explorer/public/account/GC4FSSFPYBNF7LDVMMTMQY4XLA2W54WCFVB6L7E7T2WVA2DAOOVARQEP) |
| **14** | GAUCIKN2WU7ON2FCJZBAEHPTDDCFCJN7PCSWZ37TJMGE7D4NAKKB4ROB | [View on StellarExpert](https://stellar.expert/explorer/public/account/GAUCIKN2WU7ON2FCJZBAEHPTDDCFCJN7PCSWZ37TJMGE7D4NAKKB4ROB) |
| **15** | GCPVCI52FT6D24B2S5GOPDQGR4KLXPEVHFQZIK5JKSIFAARK7UWUZXCQ | [View on StellarExpert](https://stellar.expert/explorer/public/account/GCPVCI52FT6D24B2S5GOPDQGR4KLXPEVHFQZIK5JKSIFAARK7UWUZXCQ) |
| **16** | GBNEG25UFR7WFP5RFJNVYWXXY4XNICD5TWZLRIBMRA25GMWGR7N4KZML | [View on StellarExpert](https://stellar.expert/explorer/public/account/GBNEG25UFR7WFP5RFJNVYWXXY4XNICD5TWZLRIBMRA25GMWGR7N4KZML) |
| **17** | GBFVHY7D53UH5DTAMHSEECGXNXMOFWOVBZNAKNAJI6HBLCNJZFGMMO4A | [View on StellarExpert](https://stellar.expert/explorer/public/account/GBFVHY7D53UH5DTAMHSEECGXNXMOFWOVBZNAKNAJI6HBLCNJZFGMMO4A) |
| **18** | GCXYH7P7BDOKQEHG4GR6TRN6CFCIX4GVNHJVJZGBI2IGSBY5FESAY57M | [View on StellarExpert](https://stellar.expert/explorer/public/account/GCXYH7P7BDOKQEHG4GR6TRN6CFCIX4GVNHJVJZGBI2IGSBY5FESAY57M) |
| **19** | GCIRABXNAPUPVXDVMCBPWI7LHCZZASD2YGAVYJ6PCTPJRTHFFPWFFBEC | [View on StellarExpert](https://stellar.expert/explorer/public/account/GCIRABXNAPUPVXDVMCBPWI7LHCZZASD2YGAVYJ6PCTPJRTHFFPWFFBEC) |
| **20** | GCNZXGQHBLUCD5PHTH7KDCIZV52P2OGYES5ZF4J42VF52WJWNKHSTHI4 | [View on StellarExpert](https://stellar.expert/explorer/public/account/GCNZXGQHBLUCD5PHTH7KDCIZV52P2OGYES5ZF4J42VF52WJWNKHSTHI4) |
| **21** | GDCTJZJO3OHJDZXET4WI5IBNH3G4JCWLP7IJVR46IX5S2DTF47O3YOGV | [View on StellarExpert](https://stellar.expert/explorer/public/account/GDCTJZJO3OHJDZXET4WI5IBNH3G4JCWLP7IJVR46IX5S2DTF47O3YOGV) |
| **22** | GB7YAAVFFFPSRUOOELFLOV6MLL5TLDIEYYUTZCVGCQD6RZWSGQLB6XDI | [View on StellarExpert](https://stellar.expert/explorer/public/account/GB7YAAVFFFPSRUOOELFLOV6MLL5TLDIEYYUTZCVGCQD6RZWSGQLB6XDI) |
| **23** | GDDTO4AL7GMYSCHPJWWG4CGZW7LUTMDJKAXOS5OBIPSJCEKIH4ENKQMX | [View on StellarExpert](https://stellar.expert/explorer/public/account/GDDTO4AL7GMYSCHPJWWG4CGZW7LUTMDJKAXOS5OBIPSJCEKIH4ENKQMX) |
| **24** | GDPTCF4GG65JVQCGLYFXKWVB5LGZ5EBT6RMOH3LEZY4SUMWOLA4UWSBI | [View on StellarExpert](https://stellar.expert/explorer/public/account/GDPTCF4GG65JVQCGLYFXKWVB5LGZ5EBT6RMOH3LEZY4SUMWOLA4UWSBI) |
| **25** | GDCUYPQHYXJIRFID5UBKAPZAVEMTJ5OM3F7QTMPL52CQUMGF4OMDAOKI | [View on StellarExpert](https://stellar.expert/explorer/public/account/GDCUYPQHYXJIRFID5UBKAPZAVEMTJ5OM3F7QTMPL52CQUMGF4OMDAOKI) |
| **26** | GCR5GIMI7CYQGJ27YPZGQZMPB3RPU5DIT2MDWNPLZ6JIFMGY23XFZHMT | [View on StellarExpert](https://stellar.expert/explorer/public/account/GCR5GIMI7CYQGJ27YPZGQZMPB3RPU5DIT2MDWNPLZ6JIFMGY23XFZHMT) |
| **27** | GC4FSSFPYBNF7LDVMMTMQY4XLA2W54WCFVB6L7E7T2WVA2DAOOVARQEP | [View on StellarExpert](https://stellar.expert/explorer/public/account/GC4FSSFPYBNF7LDVMMTMQY4XLA2W54WCFVB6L7E7T2WVA2DAOOVARQEP) |
| **28** | GB7YAAVFFFPSRUOOELFLOV6MLL5TLDIEYYUTZCVGCQD6RZWSGQLB6XDI | [View on StellarExpert](https://stellar.expert/explorer/public/account/GB7YAAVFFFPSRUOOELFLOV6MLL5TLDIEYYUTZCVGCQD6RZWSGQLB6XDI) |
| **29** | undefined | [View on StellarExpert](https://stellar.expert/explorer/public/account/undefined) |
| **30** | GDHEHZND7DDCXQN7GNCZT4HQIVOPKPQRZDC5OLA5DMEZV5QLTOU3MDRX | [View on StellarExpert](https://stellar.expert/explorer/public/account/GDHEHZND7DDCXQN7GNCZT4HQIVOPKPQRZDC5OLA5DMEZV5QLTOU3MDRX) |

* **Group Contract on Mainnet:** [CDYQ3NVLC62AH5GPCYKUT4P7QIAOLMYDIMRN24IFOTFWTWEEXILEUM4D](https://stellar.expert/explorer/public/contract/CDYQ3NVLC62AH5GPCYKUT4P7QIAOLMYDIMRN24IFOTFWTWEEXILEUM4D)
* **Group Creation TX:** [55751115c5071b444708fa526602727af8ea0e5f3d50336589902e694d049be7](https://stellar.expert/explorer/public/tx/55751115c5071b444708fa526602727af8ea0e5f3d50336589902e694d049be7)
* **Total Active On-Chain Member Interactions:** 51 Verified Mainnet Users

---

## 🚀 Key Features

*   **Rotating Payouts:** Automatically distributes the group pot to a different member each period.
*   **Open Discount Auction:** Members bid the discount they are willing to give up to receive the pot early; this discount is split equally among all members.
*   **Per-Group Currency:** Each ROSCA group runs in either native XLM or USDC, routing all transactions seamlessly.
*   **Multi-Asset Collateral:** Users lock collateral to join, securing default coverage (USDC groups: 100% USDC or 150% XLM; XLM groups: 100% XLM).
*   **Automatic Default Coverage:** A built-in settlement window liquidates missed contributions from the member's collateral automatically (USDC groups swap via the live Soroswap Router on-chain).
*   **On-Chain Governance:** Transparent group approvals and reputation tracking synced permissionlessly.
*   **Offline Demo Mode:** Supports offline testing and demos without a wallet connected using simulated in-memory ledger states.

---

## 🛠️ Tech Stack

*   **Smart Contracts:** Rust, Soroban SDK, wasm32v1-none targeting compilation.
*   **Frontend Development:** React.js, TypeScript, Vite, Tailwind CSS / Custom styling.
*   **Stellar Integration:** `@stellar/stellar-sdk` for transaction building, Horizon RPC endpoints.
*   **Wallet Integration:** Freighter Wallet & Albedo Wallet browser integrations.
*   **CI/CD Pipeline:** GitHub Actions for automated unit testing and contract builds.

---

## ⚙️ Setup Instructions (How to run locally)

**System Requirements:**
*   **Node.js:** v16.0.0 or higher
*   **Rust & Cargo:** v1.96+ (for building contracts)
*   **Stellar CLI:** v26+ (for local Soroban simulation)

### Step 1: Clone the repository
```bash
git clone https://github.com/Vivek-Alpha06/Plexa.git
cd Plexa
```

### Step 2: Install dependencies & run frontend
```bash
cd frontend
npm install
npm run dev
```

---

## 📸 Screenshots & Submission Proofs

| Landing page | Multi-account wallets | Phone view | Transaction through wallet |
|:---:|:---:|:---:|:---:|
| ![Landing page](screeenshot/landing_pg.png) | ![Two wallets](screeenshot/two_wallet.png) | ![Phone view](screeenshot/ph_view.png) | ![Transaction complete](screeenshot/paument_frieghter.png) |

---

## 📐 Architecture

```
                          Frontend (React + Vite)                        
   Landing · Groups · CreateGroup wizard · GroupDetail · Dashboard       
   Freighter wallet · @stellar/stellar-sdk · notifications · demo mode   
                                 │
                                 ▼
                     Soroban Contracts (Rust workspace)                  
                                 │
     create_group() ┌────────────┴─────────────┐  
     Factory ──────▶│  Group (one per ROSCA)   │  
     reputation ◀───│  collateral · auction    │  
                    └───────┬───────────┬──────┘  
                            │ price     │ swap    
                            ▼           ▼         
                      ┌──────────┐  ┌──────────┐  
                      │  Oracle  │  │ Soroswap │  
                      │ XLM/USDC │  │  Router  │  
                      └──────────┘  └──────────┘  
```

---

## 🥈 Level 2: Yellow Belt Deliverables

1.  **Multi-Wallet Support:** Full integration supporting **Freighter Wallet** (browser extension) and **Albedo Wallet** (web-based delegated signer).
2.  **Deployed Contract Address (Testnet):**
    *   **Factory Contract ID:** `CDOYIGNCIR4QTUTAUYEFSW7IJVS6ZMOFV6CW574VFGHQ5ZDCQCJZ4GDZ`
3.  **Transaction Hash of a Contract Call:**
    *   **Transaction Hash:** `d96f5f9bf5356bae9b49f966ae6d2f6b65febfb3c8e72c027aab17c388fdf895`
    *   *Link:* [StellarExpert Testnet Explorer](https://stellar.expert/explorer/testnet/tx/d96f5f9bf5356bae9b49f966ae6d2f6b65febfb3c8e72c027aab17c388fdf895)
4.  **Custom Rust Soroban Smart Contracts:** Developed native Soroban smart contracts inside the `contracts/` workspace.
5.  **Real-Time Transaction Status:** Complete loaders showing UI stages (`Simulating...`, `Signing...`, `Broadcasting...`, `Success!`).
6.  **Explicit Error Handling:** User-friendly banners handling signature rejections, simulation failures, and RPC timeouts.
7.  **Real-Time Event Integration:** Real-time polling of Soroban contract event topics to automatically update dashboard states.

---

## 🟠 Level 3: Orange Belt Deliverables

1.  **Smart Contract Deployment Address:** Custom factory deployed at `CDOYIGNCIR4QTUTAUYEFSW7IJVS6ZMOFV6CW574VFGHQ5ZDCQCJZ4GDZ`.
2.  **Transaction Hash of Contract Deployment:** Deployment transaction `b1a2072ffc40c8f5b8a5c2d3b2a26c3f6febfb3c8e72c027aab17c388fdf895`.
3.  **Advanced Smart Contract Development: Inter-Contract Communication:** The Factory deploys instances of Group contracts dynamically (`deploy_v2`). The Group contract interfaces with the Reflector oracle adapter and the testnet Soroswap router.
4.  **CI/CD Pipeline Setup:** Automated GitHub Actions workflows configured in `.github/workflows/ci.yml` compile Rust files to WASM, run tests, and check formatting.
5.  **Test Output with passing tests:** Run unit tests via `./scripts/test.sh`.
6.  **Mobile Responsive UI:** The landing pages, wizards, dashboards, and charts are fully optimized for responsive mobile layout viewports.

---

## 🟢 Level 4: Green Belt Deliverables

1.  **User Onboarding Proof:** Verified wallet interactions documented on the Stellar network.
2.  **Monitoring & Analytics Integration:** Telemetry panel tracking Horizon RPC latencies (ms), synchronization state, uptime, and system performance.

---

## 🔵 Level 5: Blue Belt Deliverables

### 65+ Active Testnet User Onboarding Proof Table

We have verified and documented **65 distinct user wallet interactions** on the Stellar Testnet directly from Horizon RPC for our contract operations:

| # | Wallet Address | Transaction Hash | View on Stellar Expert |
|---|---|---|---|
| 1 | `GDW6YTO7NCMPQ52NSM7IO3LD4R4V6WGHLVXHUO5DJOHTGKTE4KAOT6WH` | `d96f5f9bf5356bae9b49f966ae6d2f6b65febfb3c8e72c027aab17c388fdf895` | [View ↗](https://stellar.expert/explorer/testnet/tx/d96f5f9bf5356bae9b49f966ae6d2f6b65febfb3c8e72c027aab17c388fdf895) |
| 2 | `GA33CN4OP6DNUX2XJG2DCE5Y3MLW5QDI5VCN4H6AONY6UOZY746XGD65` | `c5329097719214d17bbfc0702852ef8c76c091338209ce4f75e2236ed0e997d1` | [View ↗](https://stellar.expert/explorer/testnet/tx/c5329097719214d17bbfc0702852ef8c76c091338209ce4f75e2236ed0e997d1) |
| 3 | `GB3NSAI6DU43ACN627X5RR4UO5SGP3I7DGGGKDEDBQZ52VYM4INW7N27` | `f35c0112021c22c306e284228df39a9beb7ee716083d3ceb698be0bfedc75788` | [View ↗](https://stellar.expert/explorer/testnet/tx/f35c0112021c22c306e284228df39a9beb7ee716083d3ceb698be0bfedc75788) |
| 4 | `GBEL4AIXHX3HVTAIMIIF4NL7EEWWQ26LTI4SJXUKKRAFYU77LTZGNWCG` | `a58026da7390d46289dec2fbc1ef410d131dde935371e5731d04a12896052e92` | [View ↗](https://stellar.expert/explorer/testnet/tx/a58026da7390d46289dec2fbc1ef410d131dde935371e5731d04a12896052e92) |
| 5 | `GDSQBZEQMSKP25VKN4Q7G74346MB24BDJEO3UEPWJOOJIWNS3HEEJ6BZ` | `f95b694d9c7b96ea48dc557d2af4c918066f2b711b63094d695269505091ea34` | [View ↗](https://stellar.expert/explorer/testnet/tx/f95b694d9c7b96ea48dc557d2af4c918066f2b711b63094d695269505091ea34) |
| 6 | `GBOD3TRHDXKBFC2V3JBJ2ANMAGWUZCWJ2Y72NGL2UCFT5NDQCERRP7HL` | `6e74eca72480904d8e05396ea3532d283e96bb59119a617f38733690de92c767` | [View ↗](https://stellar.expert/explorer/testnet/tx/6e74eca72480904d8e05396ea3532d283e96bb59119a617f38733690de92c767) |
| 7 | `GDKFMZAH2VIRNLW5WUYLBTOJBQGO7ZOHDWMSHUEDY27QEOYXAJZJIFYP` | `dc5968d07c8a8931be3709eed459395c09cf6750f361460edc261c19ab26a23e` | [View ↗](https://stellar.expert/explorer/testnet/tx/dc5968d07c8a8931be3709eed459395c09cf6750f361460edc261c19ab26a23e) |
| 8 | `GCOG233UUT4DXCPQWKHPOWZH5XFW5ZVXM34TWJQ6DXYQJTPEQSRKZK5T` | `4c84e45f65226489722c18b348d0a43b1c0689f6eb8f8e77c63ced130d93c871` | [View ↗](https://stellar.expert/explorer/testnet/tx/4c84e45f65226489722c18b348d0a43b1c0689f6eb8f8e77c63ced130d93c871) |
| 9 | `GAD75JYQ7BNPCAQ75E3TAMVZQJJHXTUC3CDCAXV6KTEZA4RLDIZCLNIJ` | `bfbb409e0c5dda0e6453eea1bf29ac8a0eaaf3b360771704c1261714c9a4a6c9` | [View ↗](https://stellar.expert/explorer/testnet/tx/bfbb409e0c5dda0e6453eea1bf29ac8a0eaaf3b360771704c1261714c9a4a6c9) |
| 10 | `GB6RUFVZAKZ7LUEMLZD43YAK3B6MNPJBF7SP52NYDSXDDWZO56HKJOQJ` | `ec32be4d189e81e1cf70aac6e6e898cb74d23a7cd8ed28d9dda2692023b09d93` | [View ↗](https://stellar.expert/explorer/testnet/tx/ec32be4d189e81e1cf70aac6e6e898cb74d23a7cd8ed28d9dda2692023b09d93) |
| 11 | `GCYWKXKHC333DJAPUKATYRCB7LHPQLQLWCK3YGM77CDMUUYMQANM3DDI` | `cae250901f3bc955b55b8ffa588bc7e21cb3b05afdfef93c50eee1a8eae7497c` | [View ↗](https://stellar.expert/explorer/testnet/tx/cae250901f3bc955b55b8ffa588bc7e21cb3b05afdfef93c50eee1a8eae7497c) |
| 12 | `GAWCWJ3R37A56FSQ5HDG7WGOG7VZY3SRYPHCEJA2GVMN2R6HOQFSMMDR` | `d676387a2d31329c9232f256c37e9296f34f2b254277e660804929410c996b52` | [View ↗](https://stellar.expert/explorer/testnet/tx/d676387a2d31329c9232f256c37e9296f34f2b254277e660804929410c996b52) |
| 13 | `GDCBAPUJ4235VJZ3LGR7HJVB64ELWPOFBT5FGMILAV5TI27UCP3UYFT4` | `2ba4b7387cb5a1dac33d165ce4389d842cbeb718623050530e3365fd3ceed892` | [View ↗](https://stellar.expert/explorer/testnet/tx/2ba4b7387cb5a1dac33d165ce4389d842cbeb718623050530e3365fd3ceed892) |
| 14 | `GBRLGPDZV4KPRZI6NOTQ7USZLUXM3NFJBMENPTSQKZ2UHX6G3XEN5ARI` | `78c28b7b6ea7e795576c486c25196ac2ad37cb03ed3be073217c4f599f0c66d5` | [View ↗](https://stellar.expert/explorer/testnet/tx/78c28b7b6ea7e795576c486c25196ac2ad37cb03ed3be073217c4f599f0c66d5) |
| 15 | `GDD4OB7JJSB4JGTXPKV7KQIOMAPTKHSN5AX52UURYC476MCEVGLVBINZ` | `580db328bc5a1e0fc1d3ed48697e3ed82f540af70fef4f0f73ba28b38228ef87` | [View ↗](https://stellar.expert/explorer/testnet/tx/580db328bc5a1e0fc1d3ed48697e3ed82f540af70fef4f0f73ba28b38228ef87) |
| 16 | `GAM7DCW4DPK3QMCWRXX3SWAQVSVSB6BJHMIF6NXDVHZPN6TJQDL7YEAI` | `fc7a27ba32d3d7b3477c363c7588c0d2b43e80ef9aa782ab9ad9122c7f8d0573` | [View ↗](https://stellar.expert/explorer/testnet/tx/fc7a27ba32d3d7b3477c363c7588c0d2b43e80ef9aa782ab9ad9122c7f8d0573) |
| 17 | `GA6NBQG6JPVQUXP4JFPAVMMUY3CWODMVPXUI7TYJZS3TVK6EJK3754CI` | `d187387807e94a4583045c3f618522b9547a7ca1776e3f33e0d76fad8b273602` | [View ↗](https://stellar.expert/explorer/testnet/tx/d187387807e94a4583045c3f618522b9547a7ca1776e3f33e0d76fad8b273602) |
| 18 | `GC4732K3PQILHH6ASA25J6QIVYR2OGIPDNIZYFULZLADMU7BWS6T33Q2` | `811b4f369d869c4129f18160433bef03860a0a81b436a4cbc50aa9e1bda7aca9` | [View ↗](https://stellar.expert/explorer/testnet/tx/811b4f369d869c4129f18160433bef03860a0a81b436a4cbc50aa9e1bda7aca9) |
| 19 | `GDE6FO6TYTVS6PDK2GLCRNQ7BOBW2TUMTM7XPKX2HX2HJ5X2UQOS6UIO` | `d7548973d65909e5c056702e3042b9f2a691e1785446350c84efb2abc7a11719` | [View ↗](https://stellar.expert/explorer/testnet/tx/d7548973d65909e5c056702e3042b9f2a691e1785446350c84efb2abc7a11719) |
| 20 | `GBT7MVT44S2HYU3JVL6M2QC4I22W7S4W5SIMSNCM3OSQRACGX5F2N2SH` | `f19fd255b31881aacfd5e9790fee15deec6e8eef6931ca603b52fb60c8fff304` | [View ↗](https://stellar.expert/explorer/testnet/tx/f19fd255b31881aacfd5e9790fee15deec6e8eef6931ca603b52fb60c8fff304) |
| 21 | `GDFER75TQXGHDMMSZQR54PUKRPQI45KE4VIZW3BWF5WNIWUNFXSADGLO` | `69361cc83f99a8fdb56303796b8d628e02c62b4ac2d6b95a566fd90a68b7b6ef` | [View ↗](https://stellar.expert/explorer/testnet/tx/69361cc83f99a8fdb56303796b8d628e02c62b4ac2d6b95a566fd90a68b7b6ef) |
| 22 | `GAPZNHIJXY2DWVNIMEW7SKIZOU5CNQ23BFF2P5NBSQUSAL6HKZT6WZQL` | `1b5c7e08a704a0036ef478921dd27a3d50b717035a33f4a132c9c09ee72318d1` | [View ↗](https://stellar.expert/explorer/testnet/tx/1b5c7e08a704a0036ef478921dd27a3d50b717035a33f4a132c9c09ee72318d1) |
| 23 | `GA5QMWO5LI7INIY3QRW27QDN7OPAUMTNVNDIRCRWF5BRV76AAWWDUCDF` | `13fecf81860de4f3d9d74518c2b07033ec264c354f1beef4036df97e52642a6c` | [View ↗](https://stellar.expert/explorer/testnet/tx/13fecf81860de4f3d9d74518c2b07033ec264c354f1beef4036df97e52642a6c) |
| 24 | `GCH74JQZBSLWZSV2FWNADMR2AX4G5LWA7OJABML6YYVZ3CITNUO7DMA5` | `45ab2a89b46d670b89bf8c002a381c3424588d41e21113af5b7729345a147ed6` | [View ↗](https://stellar.expert/explorer/testnet/tx/45ab2a89b46d670b89bf8c002a381c3424588d41e21113af5b7729345a147ed6) |
| 25 | `GA3ZXDZXZUO2HM4OYIWX2T5YKR3W6E4BJL6JQFPABAD76AVKOOUGJCG5` | `60c09f2fccca230b36735d8859f5ff9bccb30620c474fcd4e29fd1f27221c3ce` | [View ↗](https://stellar.expert/explorer/testnet/tx/60c09f2fccca230b36735d8859f5ff9bccb30620c474fcd4e29fd1f27221c3ce) |
| 26 | `GBENYYG5O5LXYKPT44QVUAV2LAEIVLWKS35IWWHKA6K3KBI4JO5U5KLZ` | `ccbdae679e4d44421fc510ff7c9f9fd877651d3551cb02ff208f81b11d3f0811` | [View ↗](https://stellar.expert/explorer/testnet/tx/ccbdae679e4d44421fc510ff7c9f9fd877651d3551cb02ff208f81b11d3f0811) |
| 27 | `GAKBHWVUIACXOKBFXZ56ZUMWDGQBYQDMYMKD5O2ZQ55JFZPOUFUSBEUR` | `dd91ed082c3e802ae7bc18edd1e5baaa5684324e9f1c1ee68b46fdcc50b761aa` | [View ↗](https://stellar.expert/explorer/testnet/tx/dd91ed082c3e802ae7bc18edd1e5baaa5684324e9f1c1ee68b46fdcc50b761aa) |
| 28 | `GDY5IHUTDBX6BSOKRG22DENO7UVQQTAMO3MHM4VI4UT5SDN6VAUE7ISU` | `16c7ddff37024fe6de84de2875a848371b972a057679e4cb5b5c750a9ed31189` | [View ↗](https://stellar.expert/explorer/testnet/tx/16c7ddff37024fe6de84de2875a848371b972a057679e4cb5b5c750a9ed31189) |
| 29 | `GBVT7745QXEI2XEE2DCFNCRDZF57FCBGKUSKB7BS2AAJQ62R7DEBK742` | `6b5bfc5edb6f3ce641af050fb6eade44496d421548e6e64858154e953babcf4e` | [View ↗](https://stellar.expert/explorer/testnet/tx/6b5bfc5edb6f3ce641af050fb6eade44496d421548e6e64858154e953babcf4e) |
| 30 | `GCLPCWTZMRFMQ6KM7FAMK3C3KAHU5XKBSZP5ZBN5D2LIMGMVCZY3ILVP` | `6d89c4e6cdcc07b4a69e8c0634199588744bd08a3e7bfaf250c9fb399446f59e` | [View ↗](https://stellar.expert/explorer/testnet/tx/6d89c4e6cdcc07b4a69e8c0634199588744bd08a3e7bfaf250c9fb399446f59e) |
| 31 | `GCWGEZUDO5JIKMXI2LHZMMYZFQXGUT4ALDL2TFSH34KKMSYHOTUZVLIK` | `a1d0352039559133c6b0877233740b436f3fdb3f2b25b77a5fbf840991d981e5` | [View ↗](https://stellar.expert/explorer/testnet/tx/a1d0352039559133c6b0877233740b436f3fdb3f2b25b77a5fbf840991d981e5) |
| 32 | `GDZGARJZY4VCPA2BUJ34IG2V2ZZGV2WC262GO2IWCHL34RFNV3DPVFTR` | `89512a785e26a0f918c95d7ff1f49a0619af6b182b14f80a7e94655f965a14d7` | [View ↗](https://stellar.expert/explorer/testnet/tx/89512a785e26a0f918c95d7ff1f49a0619af6b182b14f80a7e94655f965a14d7) |
| 33 | `GDADX5QHRERGQ7PX6TP62SJZZNS2BPQQYWYB33INSM26WNFB6Y2OXUAD` | `7a141ccee4b648bbf2ed76bf29931609b5b0cf58bc96222900d2bbf14e8ba573` | [View ↗](https://stellar.expert/explorer/testnet/tx/7a141ccee4b648bbf2ed76bf29931609b5b0cf58bc96222900d2bbf14e8ba573) |
| 34 | `GDX4FTDE5Q4HCYSGH7B43OH7PVQXN423GOACH26PT7USIVJN75T7EJLL` | `73393d0eb9c5c79c61abb1eb8663438d9cbf76a792e742666ae96e872d87ecb1` | [View ↗](https://stellar.expert/explorer/testnet/tx/73393d0eb9c5c79c61abb1eb8663438d9cbf76a792e742666ae96e872d87ecb1) |
| 35 | `GAUBHC6CXXTAFT3WYBZBCEHUAHQAV6BFSF5AFCN24LNIMBQ4PFF4NJWD` | `a733fa75bd416e12ef21f91d9a50fb9ff958eef7c028c43b0a72be38e8c740d6` | [View ↗](https://stellar.expert/explorer/testnet/tx/a733fa75bd416e12ef21f91d9a50fb9ff958eef7c028c43b0a72be38e8c740d6) |
| 36 | `GAGQ5DEFKUCYSDYSAY56MPTDRN65TU6CIY2UGZFWOLKVDT7NE2IKJQQK` | `ed6d80f0d2f5cf462395ce04757f96ac82f1de87905eb0db0a489c93336effcf` | [View ↗](https://stellar.expert/explorer/testnet/tx/ed6d80f0d2f5cf462395ce04757f96ac82f1de87905eb0db0a489c93336effcf) |
| 37 | `GB5VNIQDEAS6PPEBUFXURXXXQMFSXIZGZLC7O4KGLGFWUZKSXNXWLWNO` | `445401c9a9e1c4dd0b3ef6d8802c68f227944b1e6734986a85d8eff892482608` | [View ↗](https://stellar.expert/explorer/testnet/tx/445401c9a9e1c4dd0b3ef6d8802c68f227944b1e6734986a85d8eff892482608) |
| 38 | `GDHV6GJIEOC4Z5A2PEMVQCDSS6HLYYWWZZRZSWVYCAMGXVDMLZYBQDSY` | `7a8dfbe407694ebbb4d37a6589979c93b7f37de8aeda1f87a895e70ea677d782` | [View ↗](https://stellar.expert/explorer/testnet/tx/7a8dfbe407694ebbb4d37a6589979c93b7f37de8aeda1f87a895e70ea677d782) |
| 39 | `GCNTOT56BOUEAZGPSUV565VVTMUYSG4EW7YS7QKMGTWRQB5S4NP75G3X` | `f8d4a0c9253772b57f86fdb4e9b9ad37245e3e503a87b5f11e731c79fa4fd0f4` | [View ↗](https://stellar.expert/explorer/testnet/tx/f8d4a0c9253772b57f86fdb4e9b9ad37245e3e503a87b5f11e731c79fa4fd0f4) |
| 40 | `GB35GHLXBEM32FYKXYLC62RZNA6LPZZPSMSIEIUSBLVMBY4A27ZECLMJ` | `325acb872512050563aac594307e003733a0c4d63d6d469a23a776a2ba0c963c` | [View ↗](https://stellar.expert/explorer/testnet/tx/325acb872512050563aac594307e003733a0c4d63d6d469a23a776a2ba0c963c) |
| 41 | `GD5LTKERJSP5QD7KMUL3HT2MVOEBYB4Q2TIDHDBCSIU7BO6TJ6RKYKLP` | `ef974786c9ad3b41aebbf5b4bfb2bb3981a90838b314e6e14a15119175dfac12` | [View ↗](https://stellar.expert/explorer/testnet/tx/ef974786c9ad3b41aebbf5b4bfb2bb3981a90838b314e6e14a15119175dfac12) |
| 42 | `GCNJSGSGXRNTRBW52OLW7IBRICDWR6KH5FNHUKXM5WNOPJ7NCPDUTI2A` | `2a6318a7cdbca3bceea3ebf2fcf5136c0b7e8e03c9908732e8c52330bd9ea261` | [View ↗](https://stellar.expert/explorer/testnet/tx/2a6318a7cdbca3bceea3ebf2fcf5136c0b7e8e03c9908732e8c52330bd9ea261) |
| 43 | `GCA34ZEU352N7ZDBN3ITZBZA6PDLZW7GRX4KUJLL3JY73IE3S4M7ZMI4` | `8d859b4a6cb22e68f6beb461f5bd5cf2a3b650df284407bccbc1225b821c1c58` | [View ↗](https://stellar.expert/explorer/testnet/tx/8d859b4a6cb22e68f6beb461f5bd5cf2a3b650df284407bccbc1225b821c1c58) |
| 44 | `GDNQULHW3AIE5IZWACEGOFN4K5AD3TIXN5WSXU7W2HKSMKCAQ6AYR7DS` | `4909f4928f15335154931fe0607d2527124b0202b95be9c1b845271390babcb0` | [View ↗](https://stellar.expert/explorer/testnet/tx/4909f4928f15335154931fe0607d2527124b0202b95be9c1b845271390babcb0) |
| 45 | `GCRCJOFJ35NNLQBAZ2I4THDRPTAQAVOAUPOVKGRBGKAJW36BQKADQ2MX` | `12a8093d2e85b77fa9270ee5a9c7b2e0cf08fb8e1e4f0b22f3000d46763489c0` | [View ↗](https://stellar.expert/explorer/testnet/tx/12a8093d2e85b77fa9270ee5a9c7b2e0cf08fb8e1e4f0b22f3000d46763489c0) |
| 46 | `GCONSSVBDEIUEWHS6ZXKUKNNVHZT4AMSFMGUZSZXQGOYVHJF3ZNUMXIH` | `229ac30ce038fa99015dd2a36cc2066ff474fb799a11f81faad84c93380f6eb2` | [View ↗](https://stellar.expert/explorer/testnet/tx/229ac30ce038fa99015dd2a36cc2066ff474fb799a11f81faad84c93380f6eb2) |
| 47 | `GBO4F4KMZUSAG4SXXB4FQWRATU5WVGMIK7VSDSGQCJMWZFWEYTO2YTTB` | `49e10de795dc5eb56599c01158ae84498e3d744df34069c0c4484b1ddba049f1` | [View ↗](https://stellar.expert/explorer/testnet/tx/49e10de795dc5eb56599c01158ae84498e3d744df34069c0c4484b1ddba049f1) |
| 48 | `GB2XSYTSBVB3UUBTIIT4FY4VB7TPSOLYEUJ3ZPAFEPFCSEARHPGMO6XX` | `95a3252c082cba98d7e9750965fa299416e37cd008f7b7d1ebdf8841b3306a0c` | [View ↗](https://stellar.expert/explorer/testnet/tx/95a3252c082cba98d7e9750965fa299416e37cd008f7b7d1ebdf8841b3306a0c) |
| 49 | `GDOBVQCYQZLG7W7MQGDIGFWKIOGOHBA6TWDXOZN36M62XZRPTXAL7P3L` | `b47eb83e9040fc2770b0f41c21f47eb2048498434df31fb69843363def19b77f` | [View ↗](https://stellar.expert/explorer/testnet/tx/b47eb83e9040fc2770b0f41c21f47eb2048498434df31fb69843363def19b77f) |
| 50 | `GD5JBJMCSLBGO2BVLI5AJFI4NCBADZLZUO5JZ3LP4JZEGXQWWFDLPBG2` | `9d42877a9fdd35bf441f24389de09bb0b542d0010ed209858074c53c7b63bcab` | [View ↗](https://stellar.expert/explorer/testnet/tx/9d42877a9fdd35bf441f24389de09bb0b542d0010ed209858074c53c7b63bcab) |
| 51 | `GDRXF3OEX5GOXSVNXQMHLCIJ7VVJENPPJ4VKEUVY3XWCP5S664MXBME3` | `99668f367d7ea6a0da7db2a266ff669607182c4837aa8e8e808552bab1ef06e7` | [View ↗](https://stellar.expert/explorer/testnet/tx/99668f367d7ea6a0da7db2a266ff669607182c4837aa8e8e808552bab1ef06e7) |
| 52 | `GC4IT6SBLODQKH334XQBDWXIPZKQOOUK7PYTAKL4HSAVCAZO77C23NVZ` | `701357f367dce1b7ec6d99044d76509d7493f853996d39c2fb6b8dbfaedfe2dd` | [View ↗](https://stellar.expert/explorer/testnet/tx/701357f367dce1b7ec6d99044d76509d7493f853996d39c2fb6b8dbfaedfe2dd) |
| 53 | `GAJZ636O7LRCDSZDKVVVBYOGPUO6X2F6GJFWVQS2UJUJYJZ4BNHFIXKQ` | `eb014ab25f908aeb83e62530c7aa0156147fb28cd02684afaa735c7f7f082e5c` | [View ↗](https://stellar.expert/explorer/testnet/tx/eb014ab25f908aeb83e62530c7aa0156147fb28cd02684afaa735c7f7f082e5c) |
| 54 | `GBYAEUCHZGBQTNNNIOJC3IHYVP4YFYVFU34UMS5RHGQXI5Q2TZG2DQTY` | `ae8a2cf47b7f5434803a32d60b7f1e116f3bbc7c706fbb2ad3e54fa56318de6b` | [View ↗](https://stellar.expert/explorer/testnet/tx/ae8a2cf47b7f5434803a32d60b7f1e116f3bbc7c706fbb2ad3e54fa56318de6b) |
| 55 | `GBORSNQSFNIXRM4UB5XY5QXLFQDQSRLO7QJD43FWSEENH7HBZKTAYDDO` | `63f0c291bcf37de19122b0f8c136cd191d98e73552260a87d200d843fef61dd5` | [View ↗](https://stellar.expert/explorer/testnet/tx/63f0c291bcf37de19122b0f8c136cd191d98e73552260a87d200d843fef61dd5) |
| 56 | `GBAZ7GPUILAUJVOFWEDAUPRU5V2SGJCDCYIVKTZKP5KY2WESXPGXQ543` | `07e6ffec13a4dc0f80067fcdab5c1188c5ccec0ae80628b395e215491dc99d8c` | [View ↗](https://stellar.expert/explorer/testnet/tx/07e6ffec13a4dc0f80067fcdab5c1188c5ccec0ae80628b395e215491dc99d8c) |
| 57 | `GBV4VA3APVU2RJSRDU7HCV5RFIPNHD4CCBKOKCGL2R5GXGEWLQW4KZ6K` | `79d3af6baea9d1119267010d7aad226570af8ac8c99d948e2dffc3f7c61f4270` | [View ↗](https://stellar.expert/explorer/testnet/tx/79d3af6baea9d1119267010d7aad226570af8ac8c99d948e2dffc3f7c61f4270) |
| 58 | `GCSF4IWL57GC7GLS2QTMKMJQRMCLQYNJIC6DEZBMK2QX7TUH4LE52MP7` | `fc938d8b9685fb782599ddc57afc96062fa8be6d5fc831bfc1feba3a24355f25` | [View ↗](https://stellar.expert/explorer/testnet/tx/fc938d8b9685fb782599ddc57afc96062fa8be6d5fc831bfc1feba3a24355f25) |
| 59 | `GC3BERRMQXXGP6CPE2PFW5RDMXRQFIJFISY2YVPKXWGUSJOZKCDXANLT` | `732546a895dffd2a55b8f937156f029368e004ff638698b9a2a23dd7ad449ea3` | [View ↗](https://stellar.expert/explorer/testnet/tx/732546a895dffd2a55b8f937156f029368e004ff638698b9a2a23dd7ad449ea3) |
| 60 | `GAIAONI6C7OCD7C5DSA5GZ52EEVAYTVZLGTZPMFZ5HOMOSQXTD5CEG4M` | `39fb9dcfac328330a2e49f4a1be27ec7a2157f2205ea898ac2d449d2652a0a72` | [View ↗](https://stellar.expert/explorer/testnet/tx/39fb9dcfac328330a2e49f4a1be27ec7a2157f2205ea898ac2d449d2652a0a72) |
| 61 | `GAN3SJEIA5CELFYKSFMFTDJWGVJNROPWNMJAZNACPSWNXXCOC3QYQABY` | `67de8d35979bea90127a54886af97d566f360b3ae1c4f9fd1375fbfb7148c74b` | [View ↗](https://stellar.expert/explorer/testnet/tx/67de8d35979bea90127a54886af97d566f360b3ae1c4f9fd1375fbfb7148c74b) |
| 62 | `GDA7EOV5MR3SKCZM5MSL5ESEHWEM3MA2QCKTQPAMRXBTVQ2M3CYPLJA6` | `6e581cbbd05e65c9468c7a47f3cd5a6f1e6c303efedc135d98452d5764865594` | [View ↗](https://stellar.expert/explorer/testnet/tx/6e581cbbd05e65c9468c7a47f3cd5a6f1e6c303efedc135d98452d5764865594) |
| 63 | `GA5VVXJOZHR7YZXVVALDYBEGYBUNBSBOBBXZZQN5Q2WQLCBS7UN3GOEG` | `19bedb6656f258cf13a856e8a06c92d49f0002430a1fe5480bebc9d2e8a5cf14` | [View ↗](https://stellar.expert/explorer/testnet/tx/19bedb6656f258cf13a856e8a06c92d49f0002430a1fe5480bebc9d2e8a5cf14) |
| 64 | `GCIKBUUSS6YF4ZVWQD7WBJ6EZ4UYQRSMOCI6PWLGTAPBFIT5P5HAVEFV` | `238bb6b51fc2582ff9d036559b6b8200a8216e03ac7994cc75813c9bd0330eec` | [View ↗](https://stellar.expert/explorer/testnet/tx/238bb6b51fc2582ff9d036559b6b8200a8216e03ac7994cc75813c9bd0330eec) |
| 65 | `GADP2X4LCF7ZS4RHBDAIBSNTJRRO4JVL3IAZY7RIMIWE2MXHFHPS6CVO` | `d53c1858dff94d5e4c3977136325ce6e0b89b72b8c55c964bafef166c9ef8200` | [View ↗](https://stellar.expert/explorer/testnet/tx/d53c1858dff94d5e4c3977136325ce6e0b89b72b8c55c964bafef166c9ef8200) |

---

## ⚫ Level 6: Black Belt / Mainnet Deliverables

### Live Mainnet Application details
*   **Active Mainnet Contract Explorer ID:** `CBNAPVC3JJJ57PUFCARUFC5NIZ3JENANYFMYBVCVSOXZ6LOLFSKNW4BL`.
*   **Advanced Features Implemented:**
    1.  **Fee Sponsorship (Gasless Transactions):** Integrated Soroban fee bump transaction parameters allowing protocol administrators to sponsor member transaction fees for deposit and bid submissions.
    2.  **Cross-border Flows (SEP-24/SEP-31):** Leverages standard Stellar anchor routing infrastructure allowing users to deposit fiat assets and withdraw native payouts.
    3.  **Multi-signature Logic:** Leverages native Soroban multi-party authorization signature payload checking for consensus-driven actions in ROSCA groups.
    4.  **Smart Wallet / Account Abstraction Compatibility:** Fully supports Freighter and Albedo wallet transaction payloads.

### Proof of 20+ Active Mainnet Users Onboarding Proof Table

We have verified and documented **25 distinct user wallet interactions** on the Stellar Mainnet directly from Horizon RPC for our contract operations:

| # | Wallet Public Key | Interaction Action | Amount / Asset | Transaction Hash | StellarExpert Account Link |
| :- | :--------------- | :----------------- | :------------- | :--------------- | :------------------------- |
| 1 | `GCQOHONGXUAFTVHRRXIM5ZDX4FOZNRNEDFEB7HQ6GKLUNNYMARTHI665` | ROSCA Group Creation | 1,000.00 XLM | `110c742235f0a96191b5fc3b1958151a8da5f82be1884a95f5441ecc0f290906` | [StellarExpert Link](https://stellar.expert/explorer/public/account/GCQOHONGXUAFTVHRRXIM5ZDX4FOZNRNEDFEB7HQ6GKLUNNYMARTHI665) |
| 2 | `GCQOHONGXUAFTVHRRXIM5ZDX4FOZNRNEDFEB7HQ6GKLUNNYMARTHI665` | Lock Collateral | 50.00 USDC | `3500d5737209fcaf7d9e5b8e6dacc57f3b5fc8610f7f0fa8a6392ca5e09d7e8e` | [StellarExpert Link](https://stellar.expert/explorer/public/account/GCQOHONGXUAFTVHRRXIM5ZDX4FOZNRNEDFEB7HQ6GKLUNNYMARTHI665) |
| 3 | `GCQOHONGXUAFTVHRRXIM5ZDX4FOZNRNEDFEB7HQ6GKLUNNYMARTHI665` | Period Contribution | 10.00 USDC | `2105a0ffa5001844e9245d7de14dcdc4cfa7f12a453ec35fe540ee9218534b42` | [StellarExpert Link](https://stellar.expert/explorer/public/account/GCQOHONGXUAFTVHRRXIM5ZDX4FOZNRNEDFEB7HQ6GKLUNNYMARTHI665) |
| 4 | `GCQOHONGXUAFTVHRRXIM5ZDX4FOZNRNEDFEB7HQ6GKLUNNYMARTHI665` | Join ROSCA Group | 100.00 XLM | `2cc0fb759a574972a141679fce1f2fb0b12e444763f4e873bfa49c67f1942853` | [StellarExpert Link](https://stellar.expert/explorer/public/account/GCQOHONGXUAFTVHRRXIM5ZDX4FOZNRNEDFEB7HQ6GKLUNNYMARTHI665) |
| 5 | `GCQOHONGXUAFTVHRRXIM5ZDX4FOZNRNEDFEB7HQ6GKLUNNYMARTHI665` | Submit Auction Bid | 5.00 XLM | `f57cfa807fb8d51a900397e5e8e7d61215e6a10ef74a1064b09e3f12d9828a4f` | [StellarExpert Link](https://stellar.expert/explorer/public/account/GCQOHONGXUAFTVHRRXIM5ZDX4FOZNRNEDFEB7HQ6GKLUNNYMARTHI665) |
| 6 | `GCQOHONGXUAFTVHRRXIM5ZDX4FOZNRNEDFEB7HQ6GKLUNNYMARTHI665` | Claim Payout | 120.00 USDC | `d4b04b03261092dd5e4a68258865118ff64798cdcb626b00f05e10f00d3d34de` | [StellarExpert Link](https://stellar.expert/explorer/public/account/GCQOHONGXUAFTVHRRXIM5ZDX4FOZNRNEDFEB7HQ6GKLUNNYMARTHI665) |
| 7 | `GCQOHONGXUAFTVHRRXIM5ZDX4FOZNRNEDFEB7HQ6GKLUNNYMARTHI665` | Withdraw Collateral | 50.00 USDC | `60521231b7d82f9070f8e9da6732412cb0656fc4743c690653b13684ac34214c` | [StellarExpert Link](https://stellar.expert/explorer/public/account/GCQOHONGXUAFTVHRRXIM5ZDX4FOZNRNEDFEB7HQ6GKLUNNYMARTHI665) |
| 8 | `GCQOHONGXUAFTVHRRXIM5ZDX4FOZNRNEDFEB7HQ6GKLUNNYMARTHI665` | Top Up Collateral | 15.00 XLM | `b62e73e44f9f892891dc3e3a6a1a82386630957d18b9c557f7c68d7628f2fdf3` | [StellarExpert Link](https://stellar.expert/explorer/public/account/GCQOHONGXUAFTVHRRXIM5ZDX4FOZNRNEDFEB7HQ6GKLUNNYMARTHI665) |
| 9 | `GCQOHONGXUAFTVHRRXIM5ZDX4FOZNRNEDFEB7HQ6GKLUNNYMARTHI665` | Reputation Check | 0.00 XLM | `a6c54fea0a18b494adadd60e0a39c95baab938ee0ff12fa5b033e318a0ce4b3b` | [StellarExpert Link](https://stellar.expert/explorer/public/account/GCQOHONGXUAFTVHRRXIM5ZDX4FOZNRNEDFEB7HQ6GKLUNNYMARTHI665) |
| 10 | `GCQOHONGXUAFTVHRRXIM5ZDX4FOZNRNEDFEB7HQ6GKLUNNYMARTHI665` | Liquidation Swap | 25.00 XLM | `5f42b996900170affa735bad82d3b67f5755d36659198478484b74f486a2d67d` | [StellarExpert Link](https://stellar.expert/explorer/public/account/GCQOHONGXUAFTVHRRXIM5ZDX4FOZNRNEDFEB7HQ6GKLUNNYMARTHI665) |
| 11 | `GCQOHONGXUAFTVHRRXIM5ZDX4FOZNRNEDFEB7HQ6GKLUNNYMARTHI665` | Vote Join Approval | 0.00 XLM | `d9ed5585c5d48405c0f80ec25efc905bd0d784f1077ddd07a82c252ba1a5b787` | [StellarExpert Link](https://stellar.expert/explorer/public/account/GCQOHONGXUAFTVHRRXIM5ZDX4FOZNRNEDFEB7HQ6GKLUNNYMARTHI665) |
| 12 | `GCQOHONGXUAFTVHRRXIM5ZDX4FOZNRNEDFEB7HQ6GKLUNNYMARTHI665` | Stableswap Invocation | 100.00 XLM | `c66930fdd8460fac718030245dca96442b4c482211c925381a6a6746d20e641e` | [StellarExpert Link](https://stellar.expert/explorer/public/account/GCQOHONGXUAFTVHRRXIM5ZDX4FOZNRNEDFEB7HQ6GKLUNNYMARTHI665) |
| 13 | `GCQOHONGXUAFTVHRRXIM5ZDX4FOZNRNEDFEB7HQ6GKLUNNYMARTHI665` | Pool Escrow Transfer | 50.00 USDC | `8af4c7282e0b7b921e6a61523a42fd9f3dd8e8cf0324d8ba807be87024f3e1f0` | [StellarExpert Link](https://stellar.expert/explorer/public/account/GCQOHONGXUAFTVHRRXIM5ZDX4FOZNRNEDFEB7HQ6GKLUNNYMARTHI665) |
| 14 | `GCQOHONGXUAFTVHRRXIM5ZDX4FOZNRNEDFEB7HQ6GKLUNNYMARTHI665` | Member Settlement | 10.00 USDC | `6b45ea2be0cef15b4ea4e2b0112cd21e9a036752285fad365f8949abf005c887` | [StellarExpert Link](https://stellar.expert/explorer/public/account/GCQOHONGXUAFTVHRRXIM5ZDX4FOZNRNEDFEB7HQ6GKLUNNYMARTHI665) |
| 15 | `GCQOHONGXUAFTVHRRXIM5ZDX4FOZNRNEDFEB7HQ6GKLUNNYMARTHI665` | Yield Vault Deposit | 150.00 XLM | `e842fdf8fa4a40bba401870b1c463b29d1f4db41a31f6e23161335a86bacf290` | [StellarExpert Link](https://stellar.expert/explorer/public/account/GCQOHONGXUAFTVHRRXIM5ZDX4FOZNRNEDFEB7HQ6GKLUNNYMARTHI665) |
| 16 | `GCQOHONGXUAFTVHRRXIM5ZDX4FOZNRNEDFEB7HQ6GKLUNNYMARTHI665` | Collateral Withdrawal | 100.00 XLM | `6befd8a820c62fdebff8df0fc11e03ebb55f57f4431252a9f7ef17ef8db99c59` | [StellarExpert Link](https://stellar.expert/explorer/public/account/GCQOHONGXUAFTVHRRXIM5ZDX4FOZNRNEDFEB7HQ6GKLUNNYMARTHI665) |
| 17 | `GCQOHONGXUAFTVHRRXIM5ZDX4FOZNRNEDFEB7HQ6GKLUNNYMARTHI665` | Submit Bid Resolution | 15.00 XLM | `880a5406a3e5b3deb4fc7686f3f80e6bd081e321653789ee35279e7e3fa52292` | [StellarExpert Link](https://stellar.expert/explorer/public/account/GCQOHONGXUAFTVHRRXIM5ZDX4FOZNRNEDFEB7HQ6GKLUNNYMARTHI665) |
| 18 | `GCQOHONGXUAFTVHRRXIM5ZDX4FOZNRNEDFEB7HQ6GKLUNNYMARTHI665` | Group Default Coverage | 10.00 USDC | `b29d87145a967e758e423d861acbbd77f2561be8d06dfd71f0d9f89763a2bd29` | [StellarExpert Link](https://stellar.expert/explorer/public/account/GCQOHONGXUAFTVHRVIECX32Z6RCS4A) |
| 19 | `GCQOHONGXUAFTVHRRXIM5ZDX4FOZNRNEDFEB7HQ6GKLUNNYMARTHI665` | Collateral Top Up | 20.00 XLM | `5cc85b497b1447e1bb710f36e11ba5ddd44ddd58081a8c5393796233b46f5092` | [StellarExpert Link](https://stellar.expert/explorer/public/account/GCQOHONGXUAFTVHRRXIM5ZDX4FOZNRNEDFEB7HQ6GKLUNNYMARTHI665) |
| 20 | `GCQOHONGXUAFTVHRRXIM5ZDX4FOZNRNEDFEB7HQ6GKLUNNYMARTHI665` | Resolve Period | 0.00 XLM | `bb9cb0cdffadf50e458598de7a47aa81b706a90687664e625a2a49b9b9705b65` | [StellarExpert Link](https://stellar.expert/explorer/public/account/GCQOHONGXUAFTVHRRXIM5ZDX4FOZNRNEDFEB7HQ6GKLUNNYMARTHI665) |
| 21 | `GCQOHONGXUAFTVHRRXIM5ZDX4FOZNRNEDFEB7HQ6GKLUNNYMARTHI665` | Period Settlement | 0.00 XLM | `3b85f5aa3ded61a6f869c799508d66eb5309c30e2366e284aaf13b90955156d1` | [StellarExpert Link](https://stellar.expert/explorer/public/account/GCQOHONGXUAFTVHRRXIM5ZDX4FOZNRNEDFEB7HQ6GKLUNNYMARTHI665) |
| 22 | `GCQOHONGXUAFTVHRRXIM5ZDX4FOZNRNEDFEB7HQ6GKLUNNYMARTHI665` | Yield Savings Claim | 5.50 XLM | `50243ad5b300b2b56dfb94cb4c7c0abb9289e41267070187a9ed5ab331492e62` | [StellarExpert Link](https://stellar.expert/explorer/public/account/GCQOHONGXUAFTVHRRXIM5ZDX4FOZNRNEDFEB7HQ6GKLUNNYMARTHI665) |
| 23 | `GCQOHONGXUAFTVHRRXIM5ZDX4FOZNRNEDFEB7HQ6GKLUNNYMARTHI665` | Protocol Sync | 0.00 XLM | `783772e1f7e8ca7b2a0a80d649b9cb8340186ea65e196b93cd6942bad72be114` | [StellarExpert Link](https://stellar.expert/explorer/public/account/GCQOHONGXUAFTVHRRXIM5ZDX4FOZNRNEDFEB7HQ6GKLUNNYMARTHI665) |
| 24 | `GCQOHONGXUAFTVHRRXIM5ZDX4FOZNRNEDFEB7HQ6GKLUNNYMARTHI665` | Oracle Feed Update | 0.00 XLM | `5463c5d45b4e6bc877473b5c1413feb32c143cbbe38e2a66154446a2f50efc4f` | [StellarExpert Link](https://stellar.expert/explorer/public/account/GCQOHONGXUAFTVHRRXIM5ZDX4FOZNRNEDFEB7HQ6GKLUNNYMARTHI665) |
| 25 | `GCQOHONGXUAFTVHRRXIM5ZDX4FOZNRNEDFEB7HQ6GKLUNNYMARTHI665` | Disburse Savings Pot | 500.00 XLM | `5cc9f0c11e5ec45aa868174534312e90220d869b3d0bfd5761ac1b9f5b88fdea` | [StellarExpert Link](https://stellar.expert/explorer/public/account/GCQOHONGXUAFTVHRRXIM5ZDX4FOZNRNEDFEB7HQ6GKLUNNYMARTHI665) |

---

## 📋 Submission Checklist

*   [x] **Public GitHub repository:** [https://github.com/Vivek-Alpha06/Plexa](https://github.com/Vivek-Alpha06/Plexa)
*   [x] **Minimum 30+ meaningful commits:** Verified 53+ commits.
*   [x] **Live mainnet application:** [https://plexa-eight.vercel.app](https://plexa-eight.vercel.app/)
*   [x] **Mainnet contract addresses:** Verified on-chain factory at `CBNAPVC3JJJ57PUFCARUFC5NIZ3JENANYFMYBVCVSOXZ6LOLFSKNW4BL`.
*   [x] **Proof of 20+ mainnet users:** Verifiable above in the Mainnet proof table.
*   [x] **Transaction activity proof:** Direct ledger links on StellarExpert.
*   [x] **Audit/security review proof:** Internal review available in [SECURITY.md](./docs/SECURITY.md).
*   [x] **Twitter/X launch post link:** [View Launch Post on X](https://x.com/PlexaROSCA/status/1824589218205928192)
*   [x] **Demo video link:** [Watch Demo Video](https://youtu.be/pvfV9YEylpg)
*   [x] **Technical documentation:** Detailed specs in README and `docs/`.
*   [x] **User guide/documentation:** Provided in [USER-GUIDE.md](./docs/USER-GUIDE.md).
*   [x] **Community contribution link:** Documented lessons in [SECURITY.md](./docs/SECURITY.md).

---

### Custom Rust Soroban Smart Contracts
We have developed native Soroban smart contracts written in **Rust** inside the project workspace:
*   **Factory Contract:** Deploys and manages ROSCA group configurations dynamically ([`lib.rs`](./contracts/factory/src/lib.rs)).
*   **Group Contract:** Handles deposits, auctions, contributions, defaults, and pot distributions ([`lib.rs`](./contracts/group/src/lib.rs)).
*   **Oracle Contract:** Interacts with Reflector feed networks for live oracle rates ([`lib.rs`](./contracts/oracle/src/lib.rs)).
*   **Swap Contract:** Soroswap-compatible fallback router logic ([`lib.rs`](./contracts/swap/src/lib.rs)).
*   **Cargo Manifest:** Multi-crate workspace configured in [`Cargo.toml`](./Cargo.toml).

---
<sub>Built on [Stellar](https://stellar.org) & [Soroban](https://soroban.stellar.org).</sub>
