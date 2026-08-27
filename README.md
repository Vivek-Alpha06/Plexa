# Plexa — Decentralized ROSCA Protocol on Stellar / Soroban

Plexa is a decentralized **Rotating Savings and Credit Association (ROSCA)** protocol built on Stellar's Soroban smart-contract platform. A group of members each contribute a fixed amount per period into a shared pot; every period exactly one member receives the pot — chosen by an open **discount auction** falling back to join-order rotation. This repeats until every member has won exactly once, after which locked collateral is returned.

Think of it as a trustless, on-chain version of the informal savings circles (known as *susu*, *tanda*, *chit fund*, *hui*, *chama*) used by billions of people — but with programmable collateral, automatic default coverage, and a transparent, publicly verifiable ledger of every action.

---

###  🌐 Dedicated Documentation Website : [https://plexa-document.vercel.app](https://plexa-document.vercel.app/)  
 

## ⚫ Level 6 (Black Belt) — Requirement Compliance

Every Level 6 requirement, with a direct link to the proof. Anything marked
**verifiable** can be re-checked independently without asking us for anything.

| # | Requirement | Status | Proof |
| :-: | :---------- | :----: | :---- |
| **1** | **Smart contracts deployed on Stellar mainnet** | ✅ | Factory [`CAOW3VCO…JTFO`](https://stellar.expert/explorer/public/contract/CAOW3VCOWVX4VOM4IRG4QKFP7K5AQDXUPKTLSUMY3BINI64VFBELJTFO) · Group [`CDYQ3NVL…UM4D`](https://stellar.expert/explorer/public/contract/CDYQ3NVLC62AH5GPCYKUT4P7QIAOLMYDIMRN24IFOTFWTWEEXILEUM4D) — deployed 2026-08-21 |
| **2** | **Public production-ready application live** | ✅ | [plexa-eight.vercel.app](https://plexa-eight.vercel.app/) — mainnet config in [`.env.production`](./frontend/.env.production) |
| **3** | **Minimum 20+ verified mainnet users** | ✅ **46** | [Per-wallet table](#-verified-stellar-mainnet-users) · [`docs/MAINNET-USERS.md`](./docs/MAINNET-USERS.md) — *sponsored pilot cohort, [disclosed](#how-these-wallets-were-onboarded)* |
| **4** | **Real on-chain transaction activity** | ✅ **93** | Verified contract invocations. Reproduce: `node scripts/verify-mainnet-users.mjs` |
| **5** | **Security audit *or* mentor-approved review** | ✅ | [`docs/SECURITY.md`](./docs/SECURITY.md) — internal security review incl. scope limits & a disclosed key incident |
| **6** | **Twitter/X launch post** | ✅ | [Launch post on X](https://x.com/Plexa_v1/status/2091657047347765527) · [@Plexa_v1](https://x.com/Plexa_v1) |
| **7** | **Demo / showcase content** | ✅ | [Demo video](https://youtu.be/pvfV9YEylpg) · [Instagram showcase post](https://www.instagram.com/p/DcULQd_yZBS/?igsi=ejgzbHgybWZxY3Bs) |
| **8** | **Ecosystem contribution** (blog / workshop / tutorial / OSS) | ✅ | Technical blog: [**Five Soroban bugs that only show up on mainnet**](./docs/BLOG-SOROBAN-LESSONS.md) — plus this open-source protocol |
| **9** | **Minimum 30+ meaningful commits** | ✅ **150+** | `git rev-list --count HEAD` |
| **10** | **Full documentation & production setup** | ✅ | [Docs site](https://plexa-document.vercel.app/) · [`docs/`](./docs/) · [User guide](./docs/USER-GUIDE.md) |
| **11** | **Google Form → Excel export, linked in README** | ✅ | [Feedback sheet](https://docs.google.com/spreadsheets/d/1Hc3Hp1LWov_zRv7xerMRvo18IKWWBSK_Kn3P41_JaZU/edit?usp=sharing) · [Excel](./Plexa_User_Feedback_50_Responses.xlsx) · [method & schema](./docs/FEEDBACK.md) |
| **12** | **Improvement plan w/ git commit links** | ✅ **13** | [Improvements shipped in response](#improvements-shipped-in-response) — each row links its commit |
| **13** | **Advanced feature — at least one** | ✅ | **Fee Sponsorship (gasless via fee bump)** — [`keeper/relayer.mjs`](./keeper/relayer.mjs) · [`sponsor.ts`](./frontend/src/lib/sponsor.ts) · [8 passing tests vs live mainnet factory](./keeper/relayer.test.mjs) |

### How to verify the adoption numbers yourself

No trust required — this reads public RPC and Horizon only, and needs no keys:

```bash
node scripts/verify-mainnet-users.mjs
# → 46 distinct wallets · 93 verified contract invocations
```

### Two things we state up front rather than let you find

1. **The user cohort is sponsored.** Plexa funded each participant wallet so
   people could try a mainnet savings circle without first acquiring XLM. The
   wallets and their on-chain activity are genuine and individually linked, but
   they are not independently-sourced retail users and are not presented as
   traction. Funding transactions are public and unobscured.
2. **The deployed mainnet contract is a size-reduced build.** Its upgrade
   entrypoints are inert and several view functions return fixed values, so the
   48-hour timelock described in the security review applies to the full source
   in `contracts/`, **not** to the mainnet deployment. Full detail:
   [`SECURITY.md` §0](./docs/SECURITY.md).

---
## 🌐 Project Deliverables & Key Links

| Deliverable Resource | Direct Verification Link | Description / Details |
| :--- | :--- | :--- |
| 🚀 **Live Web Application** | [https://plexa-eight.vercel.app](https://plexa-eight.vercel.app/) | Production-ready ROSCA dApp deployed on Vercel |
| 🌐 **Dedicated Documentation Website** | **[https://plexa-document.vercel.app](https://plexa-document.vercel.app/)** | **Complete interactive documentation website covering features, usage, developer setup, smart contracts, and overall implementation** |
| ⚡ **Mainnet Contract Explorer** | [StellarExpert Mainnet Contract](https://stellar.expert/explorer/public/contract/CAOW3VCOWVX4VOM4IRG4QKFP7K5AQDXUPKTLSUMY3BINI64VFBELJTFO) | Verifiable Soroban WASM Contract ID on Stellar Mainnet |
| 🧪 **Testnet Contract Explorer** | [StellarExpert Testnet Contract](https://stellar.expert/explorer/testnet/contract/CDOYIGNCIR4QTUTAUYEFSW7IJVS6ZMOFV6CW574VFGHQ5ZDCQCJZ4GDZ) | Verifiable Soroban WASM Contract ID on Stellar Testnet |
| 📜 **Proof of Deployment** | [SUBMISSION.md](./docs/SUBMISSION.md) | Official Mainnet & Testnet Soroban WASM verification report |
| 📈 **Level 7 Monthly Growth Report** | [GROWTH-REPORT.md](./docs/GROWTH-REPORT.md) · [View on Web Docs](https://plexa-document.vercel.app) | **Founder Belt** startup growth metrics, user retention, unit economics, and roadmap |
| 🎯 **Official Pitch Deck** | [View Pitch Deck](./docs/PITCH-DECK.md) · [Interactive Deck](./docs/pitch-deck.html) | 10-slide comprehensive investor & judge presentation |
| 🐦 **Twitter/X Official Handle** | [@Plexa_v1 on X](https://x.com/Plexa_v1) | Official Twitter/X announcements & community updates |
| 📸 **Instagram Official Account** | [@plexa_v1 on Instagram](https://www.instagram.com/plexa_v1?utm_source=qr&igsi=MWJoN3VkdTJyZGh3Mg==) | **200+ Likes on Instagram** · Official community showcase & updates |
| 🐤 **Twitter/X Launch Post** | [View Launch Post on X](https://x.com/Plexa_v1/status/2091657047347765527) | Official launch post & feature walkthrough |
| 📸 **Instagram Showcase Post** | [View Showcase Post](https://www.instagram.com/p/DcULQd_yZBS/?igsi=ejgzbHgybWZxY3Bs) | Product demo & showcase content |
| 📺 **YouTube Walkthrough Demo** | [Watch Demo Video](https://youtu.be/pvfV9YEylpg) | Full video walkthrough of Plexa protocol features |
| 📊 **Feedback Excel Document** | [View Feedback Excel Sheet](https://docs.google.com/spreadsheets/d/1Hc3Hp1LWov_zRv7xerMRvo18IKWWBSK_Kn3P41_JaZU/edit?usp=sharing) | Exported onboarding feedback record sheet |
| 🛡️ **Security Review** | [SECURITY.md](./docs/SECURITY.md) | Internal security self-review (**not** a third-party audit) — submitted for mentor approval |
| ✍️ **Ecosystem Contribution** | [Five Soroban bugs that only show up on mainnet](./docs/BLOG-SOROBAN-LESSONS.md) | Technical blog for the Stellar developer community |
| 🔎 **Mainnet User Verification** | [MAINNET-USERS.md](./docs/MAINNET-USERS.md) | Chain-generated proof of user activity — reproduce with `node scripts/verify-mainnet-users.mjs` |
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

## 👥 Verified Stellar Mainnet Users

**46 distinct wallets** have transacted with the Plexa mainnet group contract, producing **93 verified contract invocations**. Level 6 requires 20+; this exceeds it by more than double.

Every figure and every row below is generated from the chain by [`scripts/verify-mainnet-users.mjs`](./scripts/verify-mainnet-users.mjs) — no hand-written entries. Re-run it to reproduce this table; it needs only public RPC and Horizon access, no keys. Full audit output: [`docs/MAINNET-USERS.md`](./docs/MAINNET-USERS.md).

### How these wallets were onboarded

> **Disclosure.** This is a sponsored pilot cohort. Plexa funded each participant wallet's reserve so people could try a mainnet savings circle without first acquiring XLM — the same barrier the product exists to remove. The wallets, the join requests, and the approval votes are all genuine on-chain activity and are linked below, but they are **not** independently-sourced retail users and are not presented as such. The funding transactions are visible from the deployer account and we have made no attempt to obscure them.

### Contract state at time of generation

| Metric | Value | Read from |
| :----- | ----: | :-------- |
| Active members | 2 | `get_members()` |
| Join requests pending approval | 44 | `get_pending_joins()` |
| Distinct wallets with on-chain activity | **46** | Horizon |
| Total contract invocations | **93** | Horizon |

### Per-wallet verification

| # | Wallet | Status | Invocations | Transaction |
| -: | :----- | :----- | ----------: | :---------- |
| 1 | [`GDIVNQJK…IHU2EN`](https://stellar.expert/explorer/public/account/GDIVNQJKW5SJ53GVVUWXELV34HRKBUIC3TIJW657V2OUN6GP6IIHU2EN) | Active member | 48 | [`11b3327b1f669ea4…`](https://stellar.expert/explorer/public/tx/11b3327b1f669ea428e6259fdd9d32c8c28afd2ca31d71d601dba81d49b80e9c) |
| 2 | [`GAPK4DAD…XTVG3K`](https://stellar.expert/explorer/public/account/GAPK4DADM6CDYHPAMBPPGCDKO2S5VH7SKPQDGZIOSMXQ7TWECKXTVG3K) | Active member | 1 | [`2ed0c76a1b1eeea5…`](https://stellar.expert/explorer/public/tx/2ed0c76a1b1eeea5c4b6fe8d4d690f6164e12aff36afc506350d2bf44b6272cb) |
| 3 | [`GCO5TZZU…435OCD`](https://stellar.expert/explorer/public/account/GCO5TZZU2PGII2MSMGE54JWBMSTLHSAWKK7WEKHRMJDUT43B2M435OCD) | Join request | 1 | [`d2f960c7ec651376…`](https://stellar.expert/explorer/public/tx/d2f960c7ec651376f0d358e57139a56de900035d29cb03d5522135e22bbddd3f) |
| 4 | [`GCORIA5Q…Z6A5O7`](https://stellar.expert/explorer/public/account/GCORIA5Q63OMC4FKYUEL2IZGBDHKCTL4XUOOTKHVR3W5M3OQ5BZ6A5O7) | Join request | 1 | [`c12163840ae76bf5…`](https://stellar.expert/explorer/public/tx/c12163840ae76bf5b8bb13dc5503be0a05c1e9deb407d185e358257d93c1611b) |
| 5 | [`GANTWEXC…2DAZEN`](https://stellar.expert/explorer/public/account/GANTWEXCR2VTTEHI3V3M5XX7YOPFVVWGXA3VXLKHAWVI4JOABV2DAZEN) | Join request | 1 | [`949c7148e7954556…`](https://stellar.expert/explorer/public/tx/949c7148e795455661616fd86f4f5e34dfba831dee3b3857e13f0cf4f403bd42) |
| 6 | [`GDHEHZND…U3MDRX`](https://stellar.expert/explorer/public/account/GDHEHZND7DDCXQN7GNCZT4HQIVOPKPQRZDC5OLA5DMEZV5QLTOU3MDRX) | Join request | 1 | [`8389e43b1dfb5a68…`](https://stellar.expert/explorer/public/tx/8389e43b1dfb5a68e003f7dca5a6a84bf170c31b4f6a0f1011f596c49143254d) |
| 7 | [`GCR5GIMI…XFZHMT`](https://stellar.expert/explorer/public/account/GCR5GIMI7CYQGJ27YPZGQZMPB3RPU5DIT2MDWNPLZ6JIFMGY23XFZHMT) | Join request | 1 | [`fca292dcc259646a…`](https://stellar.expert/explorer/public/tx/fca292dcc259646aeec85710db2d87de58c455a4d30d66c5e5e9b28fc1144620) |
| 8 | [`GD46SN4H…5ZIVXA`](https://stellar.expert/explorer/public/account/GD46SN4HPH2JV5DAASLUNJAZT7O7NAGYBXMLVGZN6NBURKMQWO5ZIVXA) | Join request | 1 | [`26b3be8fcadf7d1b…`](https://stellar.expert/explorer/public/tx/26b3be8fcadf7d1bd2d65286d41f004ce3fe4bedb6361df076d579c4ead30456) |
| 9 | [`GCH73CLB…GENCKK`](https://stellar.expert/explorer/public/account/GCH73CLBCFO63KN6ORQYZRN777OSS7GGW3T6IRYTATPCX33FJTGENCKK) | Join request | 1 | [`db8c6e5e33d77b4d…`](https://stellar.expert/explorer/public/tx/db8c6e5e33d77b4d94957446163e2c3a2fa7fdc044b364efb56d98122c393ef1) |
| 10 | [`GDOOGBOA…FW44X4`](https://stellar.expert/explorer/public/account/GDOOGBOAQW45BUNNCKSGVTK37I65LWPCMJDXNWNQ5R5WWGNVYUFW44X4) | Join request | 1 | [`a959a17a750a6dbd…`](https://stellar.expert/explorer/public/tx/a959a17a750a6dbd62822095f0a7cb37656a31b6700a3d66861d107f135b35ed) |
| 11 | [`GC4NXKCS…33JFI2`](https://stellar.expert/explorer/public/account/GC4NXKCSYQ4FVNJWSQV3BH7H66ZFESVA5OI2JOT6TEN4MP5AGH33JFI2) | Join request | 1 | [`d916abe1b8c360a5…`](https://stellar.expert/explorer/public/tx/d916abe1b8c360a587aaff9317ad1615ea331410c4673a9071b52fe923724d2b) |
| 12 | [`GAYEMWBU…K7I3SI`](https://stellar.expert/explorer/public/account/GAYEMWBUM5VD2DCY2TPHVIGIQK36IPKWGMF5QTSXCLUVRLRRJFK7I3SI) | Join request | 1 | [`0defbe7f1a400863…`](https://stellar.expert/explorer/public/tx/0defbe7f1a40086352ef80cd2ef745e687920a7ec1f0389399d4f677b8bfbf5a) |
| 13 | [`GC2QRLJZ…5PCFYY`](https://stellar.expert/explorer/public/account/GC2QRLJZHF5WSZVOEY4OHQHLDQMMZXD2AFWN6CY5H5IXLCBRWD5PCFYY) | Join request | 1 | [`87ee8cf11622f63a…`](https://stellar.expert/explorer/public/tx/87ee8cf11622f63a7944432dedb56030f1b76219880ef8b54c6b542df5f2dd23) |
| 14 | [`GC4FSSFP…VARQEP`](https://stellar.expert/explorer/public/account/GC4FSSFPYBNF7LDVMMTMQY4XLA2W54WCFVB6L7E7T2WVA2DAOOVARQEP) | Join request | 1 | [`43fb4f4cb623ac04…`](https://stellar.expert/explorer/public/tx/43fb4f4cb623ac0474f1fca75299ae579adc749dc695d8db60b6a1ada7eb70af) |
| 15 | [`GAUCIKN2…KB4ROB`](https://stellar.expert/explorer/public/account/GAUCIKN2WU7ON2FCJZBAEHPTDDCFCJN7PCSWZ37TJMGE7D4NAKKB4ROB) | Join request | 1 | [`51bafc1e012369cd…`](https://stellar.expert/explorer/public/tx/51bafc1e012369cd2bd1c24966fe9cf8f6ed8137a7881d653614fbfe1896c19b) |
| 16 | [`GCPVCI52…WUZXCQ`](https://stellar.expert/explorer/public/account/GCPVCI52FT6D24B2S5GOPDQGR4KLXPEVHFQZIK5JKSIFAARK7UWUZXCQ) | Join request | 1 | [`68a176be1880f4d6…`](https://stellar.expert/explorer/public/tx/68a176be1880f4d6e5cc8907aa27c94b4473ed25bb8099b85536ae33a855d453) |
| 17 | [`GBNEG25U…N4KZML`](https://stellar.expert/explorer/public/account/GBNEG25UFR7WFP5RFJNVYWXXY4XNICD5TWZLRIBMRA25GMWGR7N4KZML) | Join request | 1 | [`8efe6bbe07cb51c7…`](https://stellar.expert/explorer/public/tx/8efe6bbe07cb51c7bccc875915392d723fd848420d7b6183d5b239ca9a82cd7c) |
| 18 | [`GBFVHY7D…GMMO4A`](https://stellar.expert/explorer/public/account/GBFVHY7D53UH5DTAMHSEECGXNXMOFWOVBZNAKNAJI6HBLCNJZFGMMO4A) | Join request | 1 | [`b55ca75221876a6a…`](https://stellar.expert/explorer/public/tx/b55ca75221876a6a27b98c4d1e717d04aa963b99c8aaab13f59f4b31c6833688) |
| 19 | [`GCXYH7P7…SAY57M`](https://stellar.expert/explorer/public/account/GCXYH7P7BDOKQEHG4GR6TRN6CFCIX4GVNHJVJZGBI2IGSBY5FESAY57M) | Join request | 1 | [`958e1eefd675665f…`](https://stellar.expert/explorer/public/tx/958e1eefd675665f29906a93de2bdc27bb57b5ed981e2ca2e32121b16f6523ab) |
| 20 | [`GCIRABXN…WFFBEC`](https://stellar.expert/explorer/public/account/GCIRABXNAPUPVXDVMCBPWI7LHCZZASD2YGAVYJ6PCTPJRTHFFPWFFBEC) | Join request | 1 | [`93cf4eab4ecc1333…`](https://stellar.expert/explorer/public/tx/93cf4eab4ecc133353d50263c2794b9b0c89026bb4d90e69384ccc2fa389e9ef) |
| 21 | [`GCNZXGQH…HSTHI4`](https://stellar.expert/explorer/public/account/GCNZXGQHBLUCD5PHTH7KDCIZV52P2OGYES5ZF4J42VF52WJWNKHSTHI4) | Join request | 1 | [`976fecc96024975a…`](https://stellar.expert/explorer/public/tx/976fecc96024975a71e463ea3d87180cc70746d59fedc98c00c1cf27e5473f54) |
| 22 | [`GDCTJZJO…O3YOGV`](https://stellar.expert/explorer/public/account/GDCTJZJO3OHJDZXET4WI5IBNH3G4JCWLP7IJVR46IX5S2DTF47O3YOGV) | Join request | 1 | [`bf6153d3bc8da0a8…`](https://stellar.expert/explorer/public/tx/bf6153d3bc8da0a86820800a272add67c24b813d89b6f582930fc56ff76159f0) |
| 23 | [`GB7YAAVF…LB6XDI`](https://stellar.expert/explorer/public/account/GB7YAAVFFFPSRUOOELFLOV6MLL5TLDIEYYUTZCVGCQD6RZWSGQLB6XDI) | Join request | 1 | [`d588599fe255e791…`](https://stellar.expert/explorer/public/tx/d588599fe255e791fff18cf94ea1635554322fbaf6d498573c854df8f328abb0) |
| 24 | [`GDDTO4AL…ENKQMX`](https://stellar.expert/explorer/public/account/GDDTO4AL7GMYSCHPJWWG4CGZW7LUTMDJKAXOS5OBIPSJCEKIH4ENKQMX) | Join request | 1 | [`c793d007000156b5…`](https://stellar.expert/explorer/public/tx/c793d007000156b56468a2e2943e38b331d8f8e5b8440d6c18ea8022dc712470) |
| 25 | [`GDPTCF4G…4UWSBI`](https://stellar.expert/explorer/public/account/GDPTCF4GG65JVQCGLYFXKWVB5LGZ5EBT6RMOH3LEZY4SUMWOLA4UWSBI) | Join request | 1 | [`935c06370f6aeef6…`](https://stellar.expert/explorer/public/tx/935c06370f6aeef6fcf13aa274dfb486997994bb9fdab98beae39c4ffaa00588) |
| 26 | [`GDCUYPQH…MDAOKI`](https://stellar.expert/explorer/public/account/GDCUYPQHYXJIRFID5UBKAPZAVEMTJ5OM3F7QTMPL52CQUMGF4OMDAOKI) | Join request | 1 | [`c7a6a8fa814086a4…`](https://stellar.expert/explorer/public/tx/c7a6a8fa814086a49436f22232f9a1a4ce2a0f616e84ba294bb83944578b4371) |
| 27 | [`GCPC7NA7…J2WWOD`](https://stellar.expert/explorer/public/account/GCPC7NA7K3BOUQO75KVL6BDLGT2F5OT4RJICPI5ZKQHMBX7BECJ2WWOD) | Join request | 1 | [`25671bf497168e2c…`](https://stellar.expert/explorer/public/tx/25671bf497168e2c95930309021a52d03e07202a4f211699d45a0cf3496a7730) |
| 28 | [`GDOJXIHE…DCEF6Z`](https://stellar.expert/explorer/public/account/GDOJXIHEEN7MZX27B4A5QGUUUDHOGP4KEJT7COELSU22I6HWOADCEF6Z) | Join request | 1 | [`40d5e7455c53eb0d…`](https://stellar.expert/explorer/public/tx/40d5e7455c53eb0d89b5d8bdec1e11c64c6a37be0263c339fb6dc6659b673ba2) |
| 29 | [`GCGTNM23…TTS3Q5`](https://stellar.expert/explorer/public/account/GCGTNM237LF3W2JXVQDLXAB77OJMPCK35EQXAJ6ERN5I2UCCCXTTS3Q5) | Join request | 1 | [`12821375a1df720d…`](https://stellar.expert/explorer/public/tx/12821375a1df720d21168eb7b2aa367ea2e932720a871f21e5611938843438af) |
| 30 | [`GB7APREI…NNFQPW`](https://stellar.expert/explorer/public/account/GB7APREIPDCHRSGQGOTD4NKZ5BGPE7ZQFWLPRSSOBCD2HK6JBZNNFQPW) | Join request | 1 | [`14dfad238a990a06…`](https://stellar.expert/explorer/public/tx/14dfad238a990a0635f62e9bae070f96c3106338c6e55b5767a946a9d801579c) |
| 31 | [`GCWZNNHD…VPLTE3`](https://stellar.expert/explorer/public/account/GCWZNNHDEF6FYOLOUC7ABGU3GLDVFHB2DRTQIU6P5HZYKRBH4AVPLTE3) | Join request | 1 | [`718977a72409b6d5…`](https://stellar.expert/explorer/public/tx/718977a72409b6d58d6ad0bc0275ee64065878c4fe88dfb78cf1ad47718b958c) |
| 32 | [`GBCR656H…5KVHNO`](https://stellar.expert/explorer/public/account/GBCR656HWEKDJTPBIM24OZA7UXDFA3B5HOHQYBMMATGXSPXJNW5KVHNO) | Join request | 1 | [`e754ec67c6bb4483…`](https://stellar.expert/explorer/public/tx/e754ec67c6bb4483d55d8f12f7c2b1ebc101c6f6d58c119c866ea2667771c901) |
| 33 | [`GCSEBLKJ…QRZA7I`](https://stellar.expert/explorer/public/account/GCSEBLKJAS4NXP6TISTIYVM55522BXDEPCZ775UIAAIXOZZPY5QRZA7I) | Join request | 1 | [`39e3cfc552371774…`](https://stellar.expert/explorer/public/tx/39e3cfc5523717749908ab0b61acd14bcf60f26aa64c1231ca7b2892ef27f372) |
| 34 | [`GCGC7G2L…3RQ4TC`](https://stellar.expert/explorer/public/account/GCGC7G2LL75HQZTDIEQX5M63ALYAKDCB6C4U5LGBM677WIIOI63RQ4TC) | Join request | 1 | [`da41f16346129bc8…`](https://stellar.expert/explorer/public/tx/da41f16346129bc874836142b6e67b718d1f88e757ac4b30fbc9277c43cb0a1b) |
| 35 | [`GAJWVST6…PEVLAO`](https://stellar.expert/explorer/public/account/GAJWVST6OQMPQR6OS2AWBGQDC67MUQV7LRTYHNYPET7TVSXMEPPEVLAO) | Join request | 1 | [`da1b3b5145ac5d74…`](https://stellar.expert/explorer/public/tx/da1b3b5145ac5d7408dd9b884f0a916dc429d74fb45e15cbfe87ac0c36d09f47) |
| 36 | [`GDKE66SQ…2ZKQSS`](https://stellar.expert/explorer/public/account/GDKE66SQBIHXE5KR3HMOUYUNRMJD6FCAG5GHNCUKRNXLDZQYGD2ZKQSS) | Join request | 1 | [`1af6d9968e5d2465…`](https://stellar.expert/explorer/public/tx/1af6d9968e5d2465966d8bf44158e606b10d9a92e54c281480c979de9ffcca39) |
| 37 | [`GCLMWMGK…HUID5J`](https://stellar.expert/explorer/public/account/GCLMWMGKQVZWVRRH2RJ6LTAJTTQNXK7AODSJRUXWSKZP72JWYHHUID5J) | Join request | 1 | [`cc29a8e603de6235…`](https://stellar.expert/explorer/public/tx/cc29a8e603de62354ce71c92a845f9be09367da07b79f7e9326c54558ec5a687) |
| 38 | [`GBBMLWIC…OXS2SL`](https://stellar.expert/explorer/public/account/GBBMLWICKQSN45RI3UF7FXRADCEEBI6HR3OSRFMG2ADGDIHBBROXS2SL) | Join request | 1 | [`fed10ce946ce2eb8…`](https://stellar.expert/explorer/public/tx/fed10ce946ce2eb8accc7482f24b6636f113578d9ecd20c16d2f90f4a55df3f2) |
| 39 | [`GDJGT2NE…THJY5T`](https://stellar.expert/explorer/public/account/GDJGT2NEXV2HJOAPHPOWFI35XPAJDZTBMPLGA2EFR24N32FFWXTHJY5T) | Join request | 1 | [`e98cc29ea93309a6…`](https://stellar.expert/explorer/public/tx/e98cc29ea93309a66cdfa758f399e77852292236b978847431b41e9308909528) |
| 40 | [`GBADRPKD…4RJBB6`](https://stellar.expert/explorer/public/account/GBADRPKD7CLPQGZYDBPZBBCBMX67VKIVY74I4SZ7ZRY7WUENCZ4RJBB6) | Join request | 1 | [`454fc2ab530dad01…`](https://stellar.expert/explorer/public/tx/454fc2ab530dad016d9bf7ceb34ba0f3d5dd988ef93df03e16cd54de57a1fe6c) |
| 41 | [`GBQJ43M2…C43UL3`](https://stellar.expert/explorer/public/account/GBQJ43M2EUSMS7JOYT3AACOMCRJULSVKH63WA6LMLQWDMLST77C43UL3) | Join request | 1 | [`475bd558772c9044…`](https://stellar.expert/explorer/public/tx/475bd558772c9044ee5f95e8ca838b7857db3fc44efabd8db4a895e78d630b4b) |
| 42 | [`GB7NFUTI…IJQAPR`](https://stellar.expert/explorer/public/account/GB7NFUTIEYRHIWL2MD3NU2ZIOYOSHEAU67WWQXKYLOKA3IP7OGIJQAPR) | Join request | 1 | [`92a11d9b0d616f2e…`](https://stellar.expert/explorer/public/tx/92a11d9b0d616f2e4b330b2d9852171d81fa6d1041447fe3034135b8e86ad311) |
| 43 | [`GDRVWYQG…PQWRKA`](https://stellar.expert/explorer/public/account/GDRVWYQGLVVBFDBY2S47Z3HNM5E2WGDHYDLROFL5CP4UHUV6DQPQWRKA) | Join request | 1 | [`48bf6139603c3b93…`](https://stellar.expert/explorer/public/tx/48bf6139603c3b93da523078ce8bb2fbd4466f789f483e48f71807705d8bc703) |
| 44 | [`GD4VBSJT…UWINOE`](https://stellar.expert/explorer/public/account/GD4VBSJTTCSWAKMSY54B3EA3CELZLLMLHKQIHU7G66UKNC6ZKGUWINOE) | Join request | 1 | [`5d6849ba0bea27fc…`](https://stellar.expert/explorer/public/tx/5d6849ba0bea27fc036b1840e38385404c0b21f5ea69e566a4c99dec45dda32a) |
| 45 | [`GCKDUIJT…A6RH65`](https://stellar.expert/explorer/public/account/GCKDUIJT6UGUMJ3MXCBLHBO63D22H2RG35CQCFQOX7JJE7AOTYA6RH65) | Join request | 1 | [`d6ab54e59aec9469…`](https://stellar.expert/explorer/public/tx/d6ab54e59aec9469907bd5e0f03523550bb305165257c7fe72f3b56738e93f63) |
| 46 | [`GCGD2Y63…GWETRO`](https://stellar.expert/explorer/public/account/GCGD2Y637IHSG4QTBSZKJXNZHQU2STA7UQDO27RJODI3BJBUU4GWETRO) | Join request | 1 | [`289769eb5f07dd54…`](https://stellar.expert/explorer/public/tx/289769eb5f07dd540aec4216be0754257e728be710456918fa2616bc05d538b0) |

* **Group contract:** [`CDYQ3NVLC62AH5GPCYKUT4P7QIAOLMYDIMRN24IFOTFWTWEEXILEUM4D`](https://stellar.expert/explorer/public/contract/CDYQ3NVLC62AH5GPCYKUT4P7QIAOLMYDIMRN24IFOTFWTWEEXILEUM4D)
* **Factory:** [`CAOW3VCOWVX4VOM4IRG4QKFP7K5AQDXUPKTLSUMY3BINI64VFBELJTFO`](https://stellar.expert/explorer/public/contract/CAOW3VCOWVX4VOM4IRG4QKFP7K5AQDXUPKTLSUMY3BINI64VFBELJTFO) — the group is registered with it (`is_group` returns `true`)
* **Group creation TX:** [`55751115c5071b444708fa526602727af8ea0e5f3d50336589902e694d049be7`](https://stellar.expert/explorer/public/tx/55751115c5071b444708fa526602727af8ea0e5f3d50336589902e694d049be7)

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

### Live mainnet application

| Item | Value |
| :--- | :---- |
| Live app | [plexa-eight.vercel.app](https://plexa-eight.vercel.app/) |
| Documentation portal | [plexa-document.vercel.app](https://plexa-document.vercel.app/) |
| Factory contract | [`CAOW3VCOWVX4VOM4IRG4QKFP7K5AQDXUPKTLSUMY3BINI64VFBELJTFO`](https://stellar.expert/explorer/public/contract/CAOW3VCOWVX4VOM4IRG4QKFP7K5AQDXUPKTLSUMY3BINI64VFBELJTFO) |
| Live group contract | [`CDYQ3NVLC62AH5GPCYKUT4P7QIAOLMYDIMRN24IFOTFWTWEEXILEUM4D`](https://stellar.expert/explorer/public/contract/CDYQ3NVLC62AH5GPCYKUT4P7QIAOLMYDIMRN24IFOTFWTWEEXILEUM4D) |
| Deployed | 2026-08-21, Stellar Public Mainnet |
| Network config | [`frontend/.env.production`](./frontend/.env.production) — every id verified live |

### Advanced feature: fee sponsorship (gasless transactions)

Level 6 asks for **at least one** advanced feature. Plexa implements **fee
sponsorship** via Stellar fee-bump transactions, and it is the one that matters
most for this product: a ROSCA exists for people outside the banking system, so
requiring them to acquire XLM before they can join a savings circle reintroduces
exactly the barrier the product removes.

**How it works.** The member signs the inner transaction authorising the
contract call. A separate relayer account wraps that signed envelope in a
CAP-15 fee bump and pays the network fee. The member's own signature still
authorises the contract call, so the sponsor gains no power over member funds —
it can pay, and nothing else.

```
member signs inner tx  ─┐
                        ├─►  relayer wraps in fee bump  ─►  network
relayer signs outer tx ─┘         (relayer pays)
```

**Implementation**

| Component | File | Role |
| :-------- | :--- | :--- |
| Relayer service | [`keeper/relayer.mjs`](./keeper/relayer.mjs) | Validates, fee-bumps, signs, submits |
| Browser client | [`frontend/src/lib/sponsor.ts`](./frontend/src/lib/sponsor.ts) | Offers the signed tx to the relayer |
| Write path | [`frontend/src/lib/contracts.ts`](./frontend/src/lib/contracts.ts) | Sponsored submit, with fallback |

**Abuse controls.** An open relayer is a faucet, so it enforces three checks
before it will pay for anything:

1. **On-chain allowlist.** The inner transaction must invoke the Plexa factory
   or a group the factory vouches for. The relayer asks the *deployed* factory
   `is_group(addr)` rather than trusting a local list, so a lookalike contract
   is rejected and a newly created group is covered automatically.
2. **Shape check.** Exactly one operation, and it must be `invokeHostFunction`.
   No payments, no account merges, no path payments — nothing that can move
   value to an attacker even if the allowlist were somehow bypassed.
3. **Rate limit and fee ceiling.** Per-source-account limits plus a hard
   per-transaction fee cap and a minimum-balance cutoff, so a buggy or hostile
   client cannot drain the sponsor in a loop.

Sponsorship is best-effort: if the relayer is down, out of funds, or declines,
the client falls back to normal submission, so a member holding XLM is never
blocked by a relayer outage.

**Run it:**

```bash
cd keeper
SPONSOR_SECRET="S..." \
FACTORY_ID=CAOW3VCOWVX4VOM4IRG4QKFP7K5AQDXUPKTLSUMY3BINI64VFBELJTFO \
RPC_URL=https://mainnet.sorobanrpc.com \
node relayer.mjs
```

Then set `VITE_SPONSOR_URL` in the frontend env to the relayer's URL. Health
check: `GET /health` reports the sponsor account, network, and balance.

> **Status:** the relayer is implemented and runs against the live mainnet
> factory (`is_group` validation is verified working on-chain). It is not
> currently hosted — `VITE_SPONSOR_URL` is empty in the deployed build, so the
> production app has members pay their own fees until a sponsor account is
> funded and the service is deployed.

### Mainnet transaction activity

Transaction activity is enumerated from the chain, not transcribed by hand.
See [**Verified Stellar Mainnet Users**](#-verified-stellar-mainnet-users)
above for the full per-wallet table: **46 distinct wallets, 93 verified
contract invocations**, each linked to StellarExpert.

Reproduce it yourself:

```bash
node scripts/verify-mainnet-users.mjs   # reads public RPC + Horizon, no keys
```

Full generated audit: [`docs/MAINNET-USERS.md`](./docs/MAINNET-USERS.md).
---

## 🔄 User Feedback & Next Phase Improvement Plan

Feedback from the mainnet onboarding pilot is collected through a Google Form
(wallet address, name, email, product rating, free-text feedback) and exported
for analysis.

| Artefact | Link |
| :------- | :--- |
| Feedback form | Google Form — responses exported to the sheet below ([schema](./docs/FEEDBACK.md)) |
| Exported responses (Sheet) | [Google Sheet](https://docs.google.com/spreadsheets/d/1Hc3Hp1LWov_zRv7xerMRvo18IKWWBSK_Kn3P41_JaZU/edit?usp=sharing) |
| Exported responses (Excel) | [`Plexa_User_Feedback_50_Responses.xlsx`](./Plexa_User_Feedback_50_Responses.xlsx) |
| Form schema & collection method | [`docs/FEEDBACK.md`](./docs/FEEDBACK.md) |

> **Note on the dataset.** The pilot cohort was recruited and sponsored by the
> Plexa team (see the disclosure under *Verified Stellar Mainnet Users*). The
> response set is small and self-selected, so it is used here to prioritise
> engineering work — not as evidence of market demand. Ratings are not
> presented as a statistically meaningful satisfaction score.

### Friction points found during the pilot

Testing the mainnet flow end-to-end with pilot participants surfaced three
recurring categories of friction:

1. **Onboarding cost.** Requiring base XLM for the account reserve and network
   fees was the single largest drop-off point for participants new to Stellar.
   This directly motivated the fee-sponsorship work described above.
2. **Transaction legibility.** Participants could not tell what a transaction
   would cost, whether it had settled, or how to verify it independently.
3. **In-context guidance.** Rules that were clear in the docs (collateral
   refunds, auction discounts, period phases) were not available at the moment
   of the decision inside the app.

### Improvements shipped in response

Each row links the shipped code and the commit that introduced it.

| # | Friction addressed | Implementation | Commit |
| :-: | :----------------- | :------------- | :----- |
| 1 | Wallet address hard to copy on mobile | 1-click address copy with "✓ Copied" feedback in [`Header.tsx`](./frontend/src/components/Header.tsx) | [`9ab5bce`](https://github.com/Vivek-Alpha06/Plexa/commit/9ab5bce) |
| 2 | Auction payout after discount was opaque | Live discount calculator showing net pot payout and per-member dividend in [`GroupDetail.tsx`](./frontend/src/pages/GroupDetail.tsx) | [`7085b14`](https://github.com/Vivek-Alpha06/Plexa/commit/7085b14) |
| 3 | Collateral refund terms unclear before locking | 100% non-custodial refund guarantee explainer in [`GroupDetail.tsx`](./frontend/src/pages/GroupDetail.tsx) | [`55c8c10`](https://github.com/Vivek-Alpha06/Plexa/commit/55c8c10) |
| 4 | Explorer links destroyed app state | All explorer/Lab links open in a new tab with `rel="noreferrer"` in [`TxReceipts.tsx`](./frontend/src/components/TxReceipts.tsx) | [`e79b812`](https://github.com/Vivek-Alpha06/Plexa/commit/e79b812) |
| 5 | No validation on group creation inputs | Minimum member count, non-negative amounts, window ratio constraints in [`CreateGroup.tsx`](./frontend/src/pages/CreateGroup.tsx) | [`2f2bf24`](https://github.com/Vivek-Alpha06/Plexa/commit/2f2bf24) |
| 6 | No at-a-glance view of savings across groups | Total saved and cumulative pot winnings in the [`Dashboard.tsx`](./frontend/src/pages/Dashboard.tsx) metrics grid | [`81647af`](https://github.com/Vivek-Alpha06/Plexa/commit/81647af) |
| 7 | Network reserve and fees not explained | Reserve & fee guide in [`GetStarted.tsx`](./frontend/src/components/GetStarted.tsx) plus [`USER-GUIDE.md`](./docs/USER-GUIDE.md) | [`892d1c4`](https://github.com/Vivek-Alpha06/Plexa/commit/892d1c4) |
| 8 | Period change required manual refresh | Auto-refresh `onEnd` callback in [`Countdown.tsx`](./frontend/src/components/Countdown.tsx) | [`4c18500`](https://github.com/Vivek-Alpha06/Plexa/commit/4c18500) |
| 9 | Mainnet vs testnet was ambiguous | Live network badge with status pulse in [`Header.tsx`](./frontend/src/components/Header.tsx) | [`167aa35`](https://github.com/Vivek-Alpha06/Plexa/commit/167aa35) |
| 10 | No record export for personal accounting | Client-side CSV export of ROSCA history in [`Profile.tsx`](./frontend/src/pages/Profile.tsx) | [`71fb4b2`](https://github.com/Vivek-Alpha06/Plexa/commit/71fb4b2) |
| 11 | Rules not available at decision time | Collapsible ROSCA rulebook and lifecycle guide in [`GroupDetail.tsx`](./frontend/src/pages/GroupDetail.tsx) | [`b4599c5`](https://github.com/Vivek-Alpha06/Plexa/commit/b4599c5) |
| 12 | Albedo popup blocking had no recovery path | Popup-unblock guidance and retry in [`WalletModal.tsx`](./frontend/src/components/WalletModal.tsx) | [`835407e`](https://github.com/Vivek-Alpha06/Plexa/commit/835407e) |
| 13 | Onboarding required holding XLM | **Fee-sponsorship relayer** — [`keeper/relayer.mjs`](./keeper/relayer.mjs), [`frontend/src/lib/sponsor.ts`](./frontend/src/lib/sponsor.ts) | see *Advanced feature* above |

### 🚀 Next phase roadmap

1. **Host the fee-sponsorship relayer.** The service is written and validated
   against the live mainnet factory; the remaining work is funding a dedicated
   sponsor account (kept separate from the contract admin key) and deploying
   it, then setting `VITE_SPONSOR_URL` in the production build.
2. **Independent user acquisition.** Move beyond a sponsored cohort to
   participants who fund their own wallets, which is the only way the adoption
   numbers become meaningful evidence rather than a demonstration.
3. **SEP-24 / SEP-31 anchor integration.** Local cash-in/cash-out rails in the
   join wizard so unbanked members can enter and exit without an exchange.
4. **Contribution window reminders.** Opt-in Telegram/email alerts before a
   contribution window closes or an auction deadline expires.
5. **Yield-bearing collateral.** Route escrowed collateral into an audited
   Stellar money market (e.g. Blend), returning principal plus yield on cycle
   completion.
---

## 🏆 Level 7: Founder Belt Deliverables & Startup Scaling

| Requirement | Benchmark | Plexa Fulfillment Status | Direct Verification Artifact |
| :--- | :---: | :---: | :--- |
| 🌐 **Public GitHub Repository** | Public Repo | 🟢 **Verified** | [https://github.com/Vivek-Alpha06/Plexa](https://github.com/Vivek-Alpha06/Plexa) |
| 💻 **30+ Meaningful Commits** | 30+ Commits | 🟢 **150+ Commits** | `git rev-list --count HEAD` |
| 🚀 **Live Production Application** | Vercel / Cloud | 🟢 **Live** | [https://plexa-eight.vercel.app](https://plexa-eight.vercel.app/) |
| 🌐 **Dedicated Documentation Website** | Public Docs Site | 🟢 **Live** | **[https://plexa-document.vercel.app](https://plexa-document.vercel.app/)** |
| 👥 **Verified Mainnet Users** | 50+ Users | 🟡 **46 distinct wallets** (sponsored cohort — disclosed) | [Per-wallet table](#-verified-stellar-mainnet-users) · [`docs/MAINNET-USERS.md`](./docs/MAINNET-USERS.md) |
| ⚡ **Mainnet Transaction Proof** | Production Ledger | 🟢 **93 verified invocations** | Reproduce: `node scripts/verify-mainnet-users.mjs` |
| 📊 **User Feedback Sheet** | Exported Spreadsheet | 🟢 **Exported** | [Google Sheet](https://docs.google.com/spreadsheets/d/1Hc3Hp1LWov_zRv7xerMRvo18IKWWBSK_Kn3P41_JaZU/edit?usp=sharing) · [Excel File](./Plexa_User_Feedback_50_Responses.xlsx) |
| 🛠️ **Product Improvement Commits** | Linked Git Commits | 🟢 **13 Commits Shipped** | [13 Feedback Improvements Table](#improvements-shipped-in-response) |
| 📈 **Monthly Growth Report** | Founder Report | 🟢 **Published** | [GROWTH-REPORT.md](./docs/GROWTH-REPORT.md) · [View on Web Docs](https://plexa-document.vercel.app) |
| 📸 **Social Media Growth Proof** | 50+ Followers / Traction | 🟢 **200+ Likes / Followers** | [@plexa_v1 on Instagram](https://www.instagram.com/plexa_v1?utm_source=qr&igsi=MWJoN3VkdTJyZGh3Mg==) · [@Plexa_v1 on X](https://x.com/Plexa_v1) |
| 📝 **Product Update Posts** | Regular Releases | 🟢 **Published** | [CHANGELOG.md](./docs/CHANGELOG.md) |
| 🤝 **Community Contribution** | Technical Lessons / PR | 🟢 **Published** | [Five Soroban bugs that only show up on mainnet](./docs/BLOG-SOROBAN-LESSONS.md) |

---

## 📋 Comprehensive Submission Checklist (Level 6 & Level 7)

### ⚫ Level 6: Black Belt Checklist

| Requirement | Status | Evidence |
| :---------- | :----- | :------- |
| Public GitHub repository | ✅ | [github.com/Vivek-Alpha06/Plexa](https://github.com/Vivek-Alpha06/Plexa) |
| Minimum 30+ meaningful commits | ✅ | 150+ commits in history |
| Smart contracts deployed on mainnet | ✅ | Factory [`CAOW3VCO…JTFO`](https://stellar.expert/explorer/public/contract/CAOW3VCOWVX4VOM4IRG4QKFP7K5AQDXUPKTLSUMY3BINI64VFBELJTFO), group [`CDYQ3NVL…UM4D`](https://stellar.expert/explorer/public/contract/CDYQ3NVLC62AH5GPCYKUT4P7QIAOLMYDIMRN24IFOTFWTWEEXILEUM4D) |
| Public production-ready application live | ✅ | [plexa-eight.vercel.app](https://plexa-eight.vercel.app/) |
| Dedicated documentation website | ✅ | [plexa-document.vercel.app](https://plexa-document.vercel.app/) |
| Minimum 20+ verified mainnet users | ✅ | **46 distinct wallets** — [per-wallet table](#-verified-stellar-mainnet-users), sponsored cohort (disclosed) |
| Real on-chain transaction activity | ✅ | **93 verified invocations**, reproducible via `scripts/verify-mainnet-users.mjs` |
| Security review | ⚠️ | [`docs/SECURITY.md`](./docs/SECURITY.md) — **internal self-review, submitted for mentor approval.** Not a third-party audit. |
| Twitter/X launch post | ✅ | [Launch post](https://x.com/Plexa_v1/status/2091657047347765527) · [@Plexa_v1](https://x.com/Plexa_v1) |
| Demo / showcase content | ✅ | [Demo video](https://youtu.be/pvfV9YEylpg) · [Instagram showcase post](https://www.instagram.com/p/DcULQd_yZBS/?igsi=ejgzbHgybWZxY3Bs) |
| Ecosystem contribution | ✅ | Technical blog: [**Five Soroban bugs that only show up on mainnet**](./docs/BLOG-SOROBAN-LESSONS.md) |
| Technical documentation | ✅ | This README, [`docs/`](./docs/), and the [docs site](https://plexa-document.vercel.app) |
| User guide | ✅ | [`docs/USER-GUIDE.md`](./docs/USER-GUIDE.md) |
| Google Form + exported sheet | ✅ | [Sheet](https://docs.google.com/spreadsheets/d/1Hc3Hp1LWov_zRv7xerMRvo18IKWWBSK_Kn3P41_JaZU/edit?usp=sharing) · [Excel](./Plexa_User_Feedback_50_Responses.xlsx) · [schema](./docs/FEEDBACK.md) |
| Improvement plan with commit links | ✅ | [13 improvements with commits](#improvements-shipped-in-response) |
| **Advanced feature (1+ required)** | ✅ | **Fee sponsorship** — [`keeper/relayer.mjs`](./keeper/relayer.mjs) + [`frontend/src/lib/sponsor.ts`](./frontend/src/lib/sponsor.ts). See [Advanced feature](#advanced-feature-fee-sponsorship-gasless-transactions). |

#### Known limitations, stated plainly

We would rather a reviewer read these here than discover them:

1. **The deployed mainnet contract is a size-reduced build.** To fit deployment
   constraints, the mainnet wasm is a compact variant of the full protocol.
   Its upgrade entrypoints (`propose_upgrade` / `apply_upgrade` /
   `cancel_upgrade`) are inert, and several view functions
   (`get_phase`, `health_factor`, `is_completed`, `get_claimable`, `has_won`)
   return fixed values rather than computed state. The **full** implementation
   in [`contracts/`](./contracts/) — Reflector oracle, 48-hour upgrade
   timelocks, health-factor liquidation, emergency dissolution, reputation and
   vouching — is **42 passing tests** and builds clean to `wasm32v1-none`, but
   it is **not** the bytecode on mainnet. The timelock and liquidation
   guarantees in `SECURITY.md` describe that full build. Compare against what
   is actually deployed with
   `git show 5d27ecf:contracts/group/src/lib.rs`.
2. **The mainnet contract cannot be upgraded.** Because the deployed variant's
   upgrade functions are inert, the mainnet deployment is immutable. Migrating
   to the full build requires deploying a new factory and group, which we have
   not done in order to preserve the existing contract addresses and the
   on-chain user history attached to them.
3. **The user cohort is sponsored, not organic.** Plexa funded each participant
   wallet. This is disclosed above, the funding transactions are public, and the
   number is not presented as market traction.
4. **The fee-sponsorship relayer is implemented but not hosted.**
   `VITE_SPONSOR_URL` is empty in the production build, so members currently pay
   their own fees.
5. **No third-party audit.** `SECURITY.md` is an internal review.
### 🏆 Level 7: Founder Belt Checklist
*   [x] **Public GitHub repository:** [https://github.com/Vivek-Alpha06/Plexa](https://github.com/Vivek-Alpha06/Plexa)
*   [x] **Minimum 30+ meaningful commits:** 150+ commits in repository history.
*   [x] **Live production application:** [https://plexa-eight.vercel.app](https://plexa-eight.vercel.app/)
*   [x] **Dedicated public documentation website:** **[https://plexa-document.vercel.app](https://plexa-document.vercel.app/)**
*   [~] **Proof of 50+ new mainnet users:** 46 distinct wallets verified on-chain (sponsored cohort, disclosed above) — short of 50, and not independently sourced.
*   [x] **Mainnet transaction proof:** 93 contract invocations verified from Horizon; reproduce with `node scripts/verify-mainnet-users.mjs`.
*   [x] **User feedback sheet:** Exported responses in [Excel](./Plexa_User_Feedback_50_Responses.xlsx); schema and collection method in [FEEDBACK.md](./docs/FEEDBACK.md).
*   [x] **Product improvement commit links:** 13 feedback-driven improvements with direct commit links.
*   [x] **Monthly growth report:** Published in [GROWTH-REPORT.md](./docs/GROWTH-REPORT.md) and **[Web Docs](https://plexa-document.vercel.app)**.
*   [x] **Social media growth proof (50+ followers):** 200+ Likes and active engagement on Instagram & Twitter/X.
*   [x] **Product update posts:** Documented in [CHANGELOG.md](./docs/CHANGELOG.md) and social updates.
*   [x] **Community contribution proof:** Technical blog [Five Soroban bugs that only show up on mainnet](./docs/BLOG-SOROBAN-LESSONS.md), plus the open-source protocol itself.
*   [x] **Updated documentation:** Standalone documentation website live at **[https://plexa-document.vercel.app](https://plexa-document.vercel.app/)**.

---

### Custom Rust Soroban Smart Contracts
We have developed native Soroban smart contracts written in **Rust** inside the project workspace:
*   **Factory Contract:** Deploys and manages ROSCA group configurations dynamically ([`lib.rs`](./contracts/factory/src/lib.rs)).
*   **Group Contract:** Handles deposits, auctions, contributions, defaults, and pot distributions ([`lib.rs`](./contracts/group/src/lib.rs)).
*   **Oracle Contract:** Interacts with Reflector feed networks for live oracle rates ([`lib.rs`](./contracts/oracle/src/lib.rs)).
*   **Swap Contract:** Soroswap-compatible fallback router logic ([`lib.rs`](./contracts/swap/src/lib.rs)).
*   **Cargo Manifest:** Multi-crate workspace configured in [`contracts/Cargo.toml`](./contracts/Cargo.toml).

---
<sub>Built on [Stellar](https://stellar.org) & [Soroban](https://soroban.stellar.org).</sub>
