import React, { useState, useMemo } from "react";
import { Link, useParams, useNavigate } from "react-router-dom";
import {
  BookOpen,
  ShieldCheck,
  Cpu,
  Terminal,
  Users,
  TrendingUp,
  HelpCircle,
  CheckCircle2,
  ExternalLink,
  Copy,
  Check,
  Search,
  Menu,
  X,
  ChevronRight,
  Sparkles,
  ArrowRight,
  Lock,
  Scale,
  Zap,
  Award,
  FileCode,
  Workflow,
  AlertTriangle,
  Flame,
  Info,
  Globe,
  Sliders,
} from "lucide-react";
import { PlexaMark } from "../components/Logo";
import "../docs.css";

// ------------------------------------------------------------- Interactive Copy Component
function CopySnippet({ text, label }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = () => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <button className="docs-copy-pill" onClick={handleCopy} title="Click to copy to clipboard">
      <span>{label || text}</span>
      {copied ? <Check size={13} color="#34d399" /> : <Copy size={13} />}
    </button>
  );
}

// ------------------------------------------------------------- Code Block with Copy
function CodeBlock({ code, language = "bash", title }: { code: string; language?: string; title?: string }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <div className="docs-code-container">
      <div className="docs-code-header">
        <span>{title || language}</span>
        <button className="docs-code-copy-btn" onClick={handleCopy}>
          {copied ? (
            <>
              <Check size={12} color="#34d399" /> Copied
            </>
          ) : (
            <>
              <Copy size={12} /> Copy Code
            </>
          )}
        </button>
      </div>
      <pre className="docs-code-body">
        <code>{code}</code>
      </pre>
    </div>
  );
}

// ------------------------------------------------------------- Interactive Auction Calculator Widget
function AuctionCalculatorWidget() {
  const [potSize, setPotSize] = useState<number>(500);
  const [memberCount, setMemberCount] = useState<number>(5);
  const [discountPercent, setDiscountPercent] = useState<number>(10);
  const [asset, setAsset] = useState<string>("USDC");

  const calc = useMemo(() => {
    const discountAmount = (potSize * discountPercent) / 100;
    const netPayout = potSize - discountAmount;
    const dividendPerMember = discountAmount / memberCount;
    return {
      discountAmount: discountAmount.toFixed(2),
      netPayout: netPayout.toFixed(2),
      dividendPerMember: dividendPerMember.toFixed(2),
    };
  }, [potSize, memberCount, discountPercent]);

  return (
    <div className="docs-calc-widget">
      <div className="docs-calc-header">
        <div>
          <h4 style={{ margin: 0, fontSize: 16, display: "flex", alignItems: "center", gap: 8 }}>
            <Sliders size={18} color="#34d399" /> Live Auction Discount Simulator
          </h4>
          <span style={{ fontSize: 12, color: "var(--text-dim)" }}>
            Experiment with pot size, members, and discount bids to calculate real-time net payouts & dividends.
          </span>
        </div>
        <span className="docs-badge">Interactive Tool</span>
      </div>

      <div className="docs-calc-inputs">
        <div className="docs-calc-field">
          <label className="docs-calc-label">Pot Size ({asset})</label>
          <input
            type="number"
            className="docs-calc-input"
            value={potSize}
            min={1}
            onChange={(e) => setPotSize(Math.max(1, Number(e.target.value)))}
          />
        </div>
        <div className="docs-calc-field">
          <label className="docs-calc-label">Total Circle Members</label>
          <input
            type="number"
            className="docs-calc-input"
            value={memberCount}
            min={2}
            max={50}
            onChange={(e) => setMemberCount(Math.max(2, Number(e.target.value)))}
          />
        </div>
        <div className="docs-calc-field">
          <label className="docs-calc-label">Discount Bid ({discountPercent}%)</label>
          <input
            type="range"
            min={0}
            max={40}
            value={discountPercent}
            onChange={(e) => setDiscountPercent(Number(e.target.value))}
            style={{ accentColor: "var(--accent)", marginTop: 8 }}
          />
        </div>
        <div className="docs-calc-field">
          <label className="docs-calc-label">Asset</label>
          <select
            className="docs-calc-input"
            value={asset}
            onChange={(e) => setAsset(e.target.value)}
          >
            <option value="USDC">USDC (Stable)</option>
            <option value="XLM">XLM (Native)</option>
          </select>
        </div>
      </div>

      <div className="docs-calc-results">
        <div>
          <div className="docs-calc-stat-label">Net Winner Payout</div>
          <div className="docs-calc-stat-value">
            {calc.netPayout} {asset}
          </div>
        </div>
        <div>
          <div className="docs-calc-stat-label">Total Discount Pooled</div>
          <div className="docs-calc-stat-value" style={{ color: "#a78bfa" }}>
            {calc.discountAmount} {asset}
          </div>
        </div>
        <div>
          <div className="docs-calc-stat-label">Dividend per Member</div>
          <div className="docs-calc-stat-value" style={{ color: "#60a5fa" }}>
            +{calc.dividendPerMember} {asset}
          </div>
        </div>
      </div>
    </div>
  );
}

// ------------------------------------------------------------- Navigation Data Structure
const DOCS_NAV = [
  {
    category: "Getting Started",
    items: [
      { id: "overview", title: "Overview & Vision", icon: BookOpen, tag: "Intro" },
      { id: "quickstart", title: "Quickstart Guide", icon: Sparkles, tag: "5 min" },
      { id: "architecture", title: "Protocol Architecture", icon: Workflow, tag: "Core" },
    ],
  },
  {
    category: "Features & Mechanics",
    items: [
      { id: "features", title: "Core Features & Lifecycle", icon: Zap, tag: "Mechanics" },
      { id: "auction", title: "Discount Auction Engine", icon: Scale, tag: "Interactive" },
      { id: "advanced", title: "Advanced Black Belt Features", icon: Award, tag: "Level 6" },
    ],
  },
  {
    category: "Developer Documentation",
    items: [
      { id: "setup", title: "Installation & Setup", icon: Terminal, tag: "Dev" },
      { id: "contracts", title: "Smart Contracts & APIs", icon: FileCode, tag: "Rust" },
      { id: "testing", title: "Testing & Simulation", icon: Cpu, tag: "CI/CD" },
    ],
  },
  {
    category: "User & Security Guides",
    items: [
      { id: "user-guide", title: "Step-by-Step User Guide", icon: Users, tag: "Guide" },
      { id: "security", title: "Security Audit & Trust Model", icon: ShieldCheck, tag: "Audit" },
    ],
  },
  {
    category: "Challenge & Startup Growth",
    items: [
      { id: "compliance", title: "Level 6 & 7 Compliance", icon: Award, tag: "Matrix" },
      { id: "growth-report", title: "Monthly Growth Report", icon: TrendingUp, tag: "Level 7" },
      { id: "faq", title: "FAQ & Contract Registry", icon: HelpCircle, tag: "Help" },
    ],
  },
];

// ------------------------------------------------------------- Main Docs Component
export function Docs() {
  const { section: urlSection } = useParams();
  const navigate = useNavigate();
  const [activeSection, setActiveSection] = useState(urlSection || "overview");
  const [searchQuery, setSearchQuery] = useState("");
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  // Sync state with URL params
  React.useEffect(() => {
    if (urlSection && urlSection !== activeSection) {
      setActiveSection(urlSection);
    }
  }, [urlSection]);

  const handleSelectSection = (id: string) => {
    setActiveSection(id);
    navigate(`/docs/${id}`);
    setMobileNavOpen(false);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  // Filter navigation items
  const filteredNav = useMemo(() => {
    if (!searchQuery.trim()) return DOCS_NAV;
    const q = searchQuery.toLowerCase();
    return DOCS_NAV.map((cat) => ({
      ...cat,
      items: cat.items.filter(
        (item) =>
          item.title.toLowerCase().includes(q) ||
          item.id.toLowerCase().includes(q) ||
          (item.tag && item.tag.toLowerCase().includes(q))
      ),
    })).filter((cat) => cat.items.length > 0);
  }, [searchQuery]);

  return (
    <div className="docs-shell">
      {/* ----------------------------------------------------------- Header */}
      <header className="docs-header">
        <div className="docs-header-left">
          <button
            className="docs-mobile-toggle"
            onClick={() => setMobileNavOpen(!mobileNavOpen)}
            aria-label="Toggle navigation menu"
          >
            {mobileNavOpen ? <X size={18} /> : <Menu size={18} />}
          </button>
          <Link to="/" className="docs-brand">
            <PlexaMark size={24} />
            PLEXA <span style={{ color: "var(--text-faint)", fontWeight: 400 }}>DOCS</span>
          </Link>
          <span className="docs-badge">Mainnet v1.0</span>
        </div>

        <div className="docs-header-right">
          <div className="docs-search-bar">
            <Search size={14} color="var(--text-faint)" />
            <input
              type="text"
              className="docs-search-input"
              placeholder="Search documentation..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <Link to="/app/groups" className="btn sm primary" style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
            Launch App <ArrowRight size={13} />
          </Link>
        </div>
      </header>

      {/* ----------------------------------------------------------- Body */}
      <div className="docs-body">
        {/* ----------------------------------------------------------- Sidebar */}
        <aside className={`docs-sidebar ${mobileNavOpen ? "mobile-open" : ""}`}>
          {filteredNav.map((cat) => (
            <div key={cat.category} className="docs-nav-group">
              <div className="docs-nav-group-title">{cat.category}</div>
              {cat.items.map((item) => {
                const Icon = item.icon;
                const isActive = activeSection === item.id;
                return (
                  <button
                    key={item.id}
                    className={`docs-nav-item ${isActive ? "active" : ""}`}
                    onClick={() => handleSelectSection(item.id)}
                  >
                    <span className="docs-nav-item-icon">
                      <Icon size={16} />
                      {item.title}
                    </span>
                    {item.tag && (
                      <span
                        className={`docs-item-tag ${
                          item.tag.includes("Mainnet") || item.tag.includes("Level")
                            ? "accent"
                            : item.tag.includes("Interactive")
                            ? "purple"
                            : ""
                        }`}
                      >
                        {item.tag}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          ))}
        </aside>

        {/* ----------------------------------------------------------- Content Pane */}
        <main className="docs-content-pane">
          {/* ========================================================================= SECTION 1: OVERVIEW */}
          {activeSection === "overview" && (
            <div>
              <div className="docs-breadcrumb">
                <span>Docs</span> <ChevronRight size={12} /> <span>Getting Started</span> <ChevronRight size={12} />{" "}
                <span>Overview</span>
              </div>
              <h1 className="docs-section-title">Plexa — Decentralized ROSCA Protocol</h1>
              <p className="docs-section-desc">
                Plexa is a decentralized Rotating Savings and Credit Association (ROSCA) protocol built on Stellar's
                Soroban smart-contract platform. It digitizes centuries-old community savings circles (chit funds, susu,
                tanda, chammas) with trustless collateral escrow, open discount auctions, and transparent on-chain governance.
              </p>

              <div className="docs-callout tip">
                <Sparkles size={20} className="docs-callout-icon" />
                <div className="docs-callout-text">
                  <strong>Stellar Public Mainnet Launch Verified</strong>
                  Plexa is fully deployed and operational on Stellar Mainnet with over 50+ verified active users and 140+
                  meaningful git commits. Smart contracts are verified and publicly inspectable on StellarExpert.
                </div>
              </div>

              <h2 className="docs-h2">The Core Problem with Traditional ROSCAs</h2>
              <p className="docs-p">
                Over 1 billion people across Asia, Africa, and Latin America depend on informal peer-to-peer savings circles to
                pool capital, access emergency credit, and save collaboratively. However, traditional ROSCAs suffer from
                systemic vulnerabilities:
              </p>
              <div className="docs-grid-3">
                <div className="docs-card">
                  <div className="docs-card-icon" style={{ background: "rgba(248, 113, 113, 0.15)", color: "#f87171" }}>
                    <AlertTriangle size={18} />
                  </div>
                  <div className="docs-card-title">Organizer Embezzlement</div>
                  <div className="docs-card-desc">
                    Centralized organizers hold the total cash pot, creating single points of failure and theft risks.
                  </div>
                </div>
                <div className="docs-card">
                  <div className="docs-card-icon" style={{ background: "rgba(248, 113, 113, 0.15)", color: "#f87171" }}>
                    <Flame size={18} />
                  </div>
                  <div className="docs-card-title">Early Winner Default</div>
                  <div className="docs-card-desc">
                    Members who win early pots frequently vanish, leaving remaining members to absorb the losses.
                  </div>
                </div>
                <div className="docs-card">
                  <div className="docs-card-icon" style={{ background: "rgba(248, 113, 113, 0.15)", color: "#f87171" }}>
                    <Lock size={18} />
                  </div>
                  <div className="docs-card-title">Opaque Bookkeeping</div>
                  <div className="docs-card-desc">
                    Paper records lead to disputes over payment dates, auction bids, interest splits, and membership order.
                  </div>
                </div>
              </div>

              <h2 className="docs-h2">The Plexa On-Chain Solution</h2>
              <p className="docs-p">
                Plexa replaces the human organizer with immutable Soroban smart contracts. Every action—from member admission
                to periodic contributions, bidding, default liquidation, and final collateral returns—is enforced on the Stellar
                blockchain.
              </p>

              <div className="docs-grid-2">
                <div className="docs-card">
                  <div className="docs-card-icon">
                    <ShieldCheck size={18} />
                  </div>
                  <div className="docs-card-title">100% Non-Custodial Collateral</div>
                  <div className="docs-card-desc">
                    Members lock collateral equal to the full pot upfront. If a member misses a payment, the contract
                    liquidates their collateral automatically without breaking the circle.
                  </div>
                </div>
                <div className="docs-card">
                  <div className="docs-card-icon">
                    <Scale size={18} />
                  </div>
                  <div className="docs-card-title">Open Discount Auctions</div>
                  <div className="docs-card-desc">
                    Members bid the discount they are willing to give up to receive the pot early. The highest discount wins
                    and is distributed equally among all circle participants as a dividend.
                  </div>
                </div>
                <div className="docs-card">
                  <div className="docs-card-icon">
                    <Globe size={18} />
                  </div>
                  <div className="docs-card-title">Stellar Network Rails</div>
                  <div className="docs-card-desc">
                    5-second ledger finality and sub-cent transaction fees ($0.00001) allow micro-contributions in native XLM
                    or USDC stablecoins without financial friction.
                  </div>
                </div>
                <div className="docs-card">
                  <div className="docs-card-icon">
                    <Users size={18} />
                  </div>
                  <div className="docs-card-title">Decentralized Governance</div>
                  <div className="docs-card-desc">
                    New members must be approved by an on-chain majority vote of the circle. Completed cycles build a
                    portable on-chain reputation score.
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ========================================================================= SECTION 2: QUICKSTART */}
          {activeSection === "quickstart" && (
            <div>
              <div className="docs-breadcrumb">
                <span>Docs</span> <ChevronRight size={12} /> <span>Getting Started</span> <ChevronRight size={12} />{" "}
                <span>Quickstart</span>
              </div>
              <h1 className="docs-section-title">Quickstart: Join a Circle in 5 Minutes</h1>
              <p className="docs-section-desc">
                Follow this quick tutorial to connect your Stellar wallet, find or deploy a savings circle, lock collateral,
                and begin rotating funds on Stellar Mainnet.
              </p>

              <div className="docs-step">
                <div className="docs-step-number">1</div>
                <div className="docs-step-body">
                  <div className="docs-step-title">Install a Stellar Wallet</div>
                  <p className="docs-p">
                    Plexa natively supports <strong>Freighter Wallet</strong> (browser extension) and{" "}
                    <strong>Albedo Wallet</strong> (web-based delegated signer).
                  </p>
                  <div style={{ display: "flex", gap: 10, marginTop: 8 }}>
                    <a
                      href="https://www.freighter.app"
                      target="_blank"
                      rel="noreferrer"
                      className="btn sm"
                      style={{ display: "inline-flex", alignItems: "center", gap: 6 }}
                    >
                      Install Freighter <ExternalLink size={13} />
                    </a>
                    <a
                      href="https://albedo.link"
                      target="_blank"
                      rel="noreferrer"
                      className="btn sm secondary"
                      style={{ display: "inline-flex", alignItems: "center", gap: 6 }}
                    >
                      Open Albedo <ExternalLink size={13} />
                    </a>
                  </div>
                </div>
              </div>

              <div className="docs-step">
                <div className="docs-step-number">2</div>
                <div className="docs-step-body">
                  <div className="docs-step-title">Fund Your Wallet with XLM</div>
                  <p className="docs-p">
                    Every Stellar account requires a minimum base reserve of <strong>~1.5 - 2 XLM</strong> to exist on the
                    ledger. Pilot circles operate in XLM (e.g. 0.5 XLM per period), while production circles support USDC.
                  </p>
                  <div className="docs-callout info">
                    <Info size={18} className="docs-callout-icon" />
                    <div className="docs-callout-text">
                      <strong>Base Reserve Rule:</strong> Never send 100% of your XLM balance out. Keep at least 2 XLM in your
                      wallet to maintain account existence and cover transaction fees.
                    </div>
                  </div>
                </div>
              </div>

              <div className="docs-step">
                <div className="docs-step-number">3</div>
                <div className="docs-step-body">
                  <div className="docs-step-title">Find or Create a Circle</div>
                  <p className="docs-p">
                    Navigate to <Link to="/app/groups" style={{ color: "var(--accent)" }}>Groups</Link> to browse active
                    verified savings groups, or click <Link to="/app/create" style={{ color: "var(--accent)" }}>Create Group</Link>{" "}
                    to launch your own circle with custom contribution amounts, period durations, and member limits.
                  </p>
                </div>
              </div>

              <div className="docs-step">
                <div className="docs-step-number">4</div>
                <div className="docs-step-body">
                  <div className="docs-step-title">Lock Collateral & Start Saving</div>
                  <p className="docs-p">
                    Once accepted into a circle, click <strong>Lock Collateral</strong>. The smart contract holds your deposit
                    safely in escrow. After all members lock deposits and submit the first contribution, the automated cycle
                    begins!
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* ========================================================================= SECTION 3: ARCHITECTURE */}
          {activeSection === "architecture" && (
            <div>
              <div className="docs-breadcrumb">
                <span>Docs</span> <ChevronRight size={12} /> <span>Getting Started</span> <ChevronRight size={12} />{" "}
                <span>Architecture</span>
              </div>
              <h1 className="docs-section-title">Protocol Architecture & Data Flow</h1>
              <p className="docs-section-desc">
                Plexa is built as a multi-contract Soroban architecture prioritizing state rent minimization, non-custodial
                collateral security, and permissionless keeper execution.
              </p>

              <h2 className="docs-h2">Architectural Diagram</h2>
              <CodeBlock
                language="ascii"
                title="System Architecture Diagram"
                code={`                          Frontend DApp (React + Vite + TypeScript)
               ┌────────────────────────────────────────────────────────┐
               │  Freighter Wallet · Albedo · @stellar/stellar-sdk     │
               │  Landing · Groups · CreateGroup · GroupDetail · Docs   │
               └───────────────────────────┬────────────────────────────┘
                                           │ Soroban RPC / Horizon
                                           ▼
                           Soroban Smart Contract Workspace
               ┌────────────────────────────────────────────────────────┐
               │                  Factory Contract                      │
               │      CAOW3VCOWVX4VOM4IRG4QKFP7K5AQDXUPKTLSUMY3BIN...   │
               │  - Deterministic Salt Deployment                       │
               │  - Global Public Group Registry                        │
               │  - 48-Hour Timelocked Upgrades                         │
               │  - Cross-Circle Reputation Ledger                      │
               └───────────┬────────────────────────────┬───────────────┘
                           │ deploys                    │ registers
                           ▼                            ▼
               ┌────────────────────────┐   ┌───────────────────────────┐
               │     Group Contract     │   │   Registry & Reputation   │
               │ (One per Savings Circle│   │  Member completed cycles  │
               │  - Collateral Escrow   │   │  and trust ratings        │
               │  - Contribution Window │   └───────────────────────────┘
               │  - Discount Auction    │
               │  - Automated Default   │
               └───────────┬────────────┘
                           │
             ┌─────────────┴─────────────┐
             ▼                           ▼
 ┌──────────────────────┐    ┌──────────────────────┐
 │   Reflector Oracle   │    │   Soroswap Router    │
 │   Adapter Contract   │    │  Liquidation Swaps   │
 │   XLM / USDC Feeds   │    │  XLM -> USDC Swaps   │
 └──────────────────────┘    └──────────────────────┘`}
              />

              <h2 className="docs-h2">Core Protocol Contracts</h2>
              <div className="docs-table-wrapper">
                <table className="docs-table">
                  <thead>
                    <tr>
                      <th>Contract Name</th>
                      <th>Mainnet Contract ID</th>
                      <th>Primary Responsibility</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td><strong>Factory Contract</strong></td>
                      <td>
                        <CopySnippet
                          text="CAOW3VCOWVX4VOM4IRG4QKFP7K5AQDXUPKTLSUMY3BINI64VFBELJTFO"
                          label="CAOW...JTFO"
                        />
                      </td>
                      <td>Instantiates new groups, maintains discovery registry, handles 48h timelocked upgrades.</td>
                    </tr>
                    <tr>
                      <td><strong>Group WASM Hash</strong></td>
                      <td>
                        <CopySnippet
                          text="4602c2c29cc61b2a239c45fbf43e12b3d430d765ca33fa298ddab73e99cd3148"
                          label="4602...3148"
                        />
                      </td>
                      <td>WASM bytecode uploaded to Stellar ledger for lightweight instance creation.</td>
                    </tr>
                    <tr>
                      <td><strong>Active Mainnet Group</strong></td>
                      <td>
                        <CopySnippet
                          text="CDYQ3NVLC62AH5GPCYKUT4P7QIAOLMYDIMRN24IFOTFWTWEEXILEUM4D"
                          label="CDYQ...UM4D"
                        />
                      </td>
                      <td>Active savings circle custodying member deposits and managing auction rounds.</td>
                    </tr>
                    <tr>
                      <td><strong>Reflector Oracle</strong></td>
                      <td>
                        <CopySnippet
                          text="CAFJZQWSED6YAWZU3GWRTOCNPPCGBN32L7QV43XX5LZLFTK6JLN34DLN"
                          label="CAFJ...4DLN"
                        />
                      </td>
                      <td>Decentralized oracle adapter providing XLM/USD and USDC/USD division pricing.</td>
                    </tr>
                    <tr>
                      <td><strong>Soroswap Router</strong></td>
                      <td>
                        <CopySnippet
                          text="CAG5LRYQ5JVEUI5TEID72EYOVX44TTUJT5BQR2J6J77FH65PCCFAJDDH"
                          label="CAG5...JDDH"
                        />
                      </td>
                      <td>Decentralized AMM router executing collateral liquidation swaps for USDC groups.</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ========================================================================= SECTION 4: FEATURES & LIFECYCLE */}
          {activeSection === "features" && (
            <div>
              <div className="docs-breadcrumb">
                <span>Docs</span> <ChevronRight size={12} /> <span>Features & Mechanics</span> <ChevronRight size={12} />{" "}
                <span>Core Features</span>
              </div>
              <h1 className="docs-section-title">Core Features & Savings Lifecycle</h1>
              <p className="docs-section-desc">
                Plexa automates the entire lifecycle of a rotating savings circle through discrete, verifiable state machine
                transitions enforced on Soroban.
              </p>

              <h2 className="docs-h2">Lifecycle of a Savings Circle</h2>
              <div className="docs-step">
                <div className="docs-step-number">1</div>
                <div className="docs-step-body">
                  <div className="docs-step-title">Phase 1: Formation & Member Admission</div>
                  <p className="docs-p">
                    A creator defines the circle configuration: pot size, period duration (e.g. 7 days), token asset (XLM or
                    USDC), and target member count. New applicants submit a join request and must be approved by an on-chain
                    majority vote of existing members.
                  </p>
                </div>
              </div>

              <div className="docs-step">
                <div className="docs-step-number">2</div>
                <div className="docs-step-body">
                  <div className="docs-step-title">Phase 2: 100% Collateral Lock</div>
                  <p className="docs-p">
                    Every approved member locks 100% collateral into the group contract escrow before the circle begins. For
                    USDC groups, members can deposit 100% USDC or 150% overcollateralized XLM.
                  </p>
                </div>
              </div>

              <div className="docs-step">
                <div className="docs-step-number">3</div>
                <div className="docs-step-body">
                  <div className="docs-step-title">Phase 3: Periodic Contribution Window</div>
                  <p className="docs-p">
                    Each period opens with a timed contribution window. Every member pays their equal fraction of the pot
                    (e.g., in a 5-member circle with a 100 USDC pot, each contributes 20 USDC).
                  </p>
                </div>
              </div>

              <div className="docs-step">
                <div className="docs-step-number">4</div>
                <div className="docs-step-body">
                  <div className="docs-step-title">Phase 4: Automated Default Settlement</div>
                  <p className="docs-p">
                    If a member fails to contribute before the window closes, the contract automatically executes settlement,
                    drawing the missing contribution directly from the member's locked collateral. If collateral is in XLM for a
                    USDC circle, the contract performs a swap through Soroswap AMM.
                  </p>
                </div>
              </div>

              <div className="docs-step">
                <div className="docs-step-number">5</div>
                <div className="docs-step-body">
                  <div className="docs-step-title">Phase 5: Open Discount Auction</div>
                  <p className="docs-p">
                    Members who have not yet won a pot enter the auction, bidding the discount they are willing to forego to
                    receive the funds immediately. The highest bidder receives the net pot, and their discount is shared
                    equally with all members as a dividend.
                  </p>
                </div>
              </div>

              <div className="docs-step">
                <div className="docs-step-number">6</div>
                <div className="docs-step-body">
                  <div className="docs-step-title">Phase 6: Cycle Completion & Full Collateral Return</div>
                  <p className="docs-p">
                    Once every member has won exactly once, the cycle completes. After a standard 24-hour grace window, all
                    members can withdraw their full 100% collateral deposit back to their wallets.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* ========================================================================= SECTION 5: AUCTION ENGINE */}
          {activeSection === "auction" && (
            <div>
              <div className="docs-breadcrumb">
                <span>Docs</span> <ChevronRight size={12} /> <span>Features & Mechanics</span> <ChevronRight size={12} />{" "}
                <span>Auction Engine</span>
              </div>
              <h1 className="docs-section-title">The Open Discount Auction Engine</h1>
              <p className="docs-section-desc">
                Plexa replaces traditional lottery draws with an open, market-driven discount auction mechanism that prices
                urgency and rewards patience.
              </p>

              <h2 className="docs-h2">Mathematical Formulation</h2>
              <p className="docs-p">
                Let <strong>P</strong> be the total pot size, <strong>N</strong> be the total number of members in the
                circle, and <strong>D</strong> be the winning discount percentage (in basis points):
              </p>

              <div className="docs-grid-3">
                <div className="docs-card">
                  <div className="docs-card-title">1. Total Discount Slashed</div>
                  <div className="docs-inline-code">Discount = P * (D / 10000)</div>
                  <p className="docs-card-desc" style={{ marginTop: 8 }}>
                    The discount amount surrendered by the winning bidder.
                  </p>
                </div>
                <div className="docs-card">
                  <div className="docs-card-title">2. Net Winner Payout</div>
                  <div className="docs-inline-code">Net Payout = P - Discount</div>
                  <p className="docs-card-desc" style={{ marginTop: 8 }}>
                    The actual funds transferred to the auction winner.
                  </p>
                </div>
                <div className="docs-card">
                  <div className="docs-card-title">3. Dividend Per Member</div>
                  <div className="docs-inline-code">Dividend = Discount / N</div>
                  <p className="docs-card-desc" style={{ marginTop: 8 }}>
                    The yield distributed equally across all circle participants.
                  </p>
                </div>
              </div>

              <h2 className="docs-h2">Interactive Auction Simulator</h2>
              <AuctionCalculatorWidget />

              <h2 className="docs-h2">Deterministic Fallback: Join-Order Rotation</h2>
              <p className="docs-p">
                If no member places a bid during an auction window, the protocol falls back to a deterministic, zero-discount
                <strong>join-order rotation</strong>. The pot is awarded to the earliest-joined member who has not yet received a
                payout.
              </p>
              <div className="docs-callout tip">
                <CheckCircle2 size={18} className="docs-callout-icon" />
                <div className="docs-callout-text">
                  <strong>Why Fixed Join-Order Replaced PRNG:</strong> Earlier testnet versions utilized pseudo-random number
                  generation (`env.prng()`), which caused storage footprint mismatches between transaction preflight and
                  execution. Fixed join-order rotation guarantees 100% deterministic execution without host traps.
                </div>
              </div>
            </div>
          )}

          {/* ========================================================================= SECTION 6: ADVANCED BLACK BELT */}
          {activeSection === "advanced" && (
            <div>
              <div className="docs-breadcrumb">
                <span>Docs</span> <ChevronRight size={12} /> <span>Features & Mechanics</span> <ChevronRight size={12} />{" "}
                <span>Advanced Features</span>
              </div>
              <h1 className="docs-section-title">Level 6 Black Belt: Advanced Features</h1>
              <p className="docs-section-desc">
                Plexa incorporates four advanced institutional-grade Stellar capabilities satisfying the Stellar Builder
                Challenge Black Belt requirements.
              </p>

              <div className="docs-grid-2">
                <div className="docs-card">
                  <div className="docs-card-icon">
                    <Zap size={18} />
                  </div>
                  <div className="docs-card-title">1. Fee Sponsorship (Gasless Transactions)</div>
                  <p className="docs-card-desc">
                    Plexa supports Stellar <strong>Fee Bump Transactions</strong>. Protocol administrators or community relayers
                    can wrap user operations (such as initial join requests and collateral locking) in a fee-bump envelope,
                    sponsoring network fees so unbanked users can onboard with zero initial XLM.
                  </p>
                </div>

                <div className="docs-card">
                  <div className="docs-card-icon">
                    <Globe size={18} />
                  </div>
                  <div className="docs-card-title">2. Cross-Border Flows (SEP-24 & SEP-31)</div>
                  <p className="docs-card-desc">
                    By integrating with Stellar Anchor Protocols (SEP-24 interactive deposits and SEP-31 cross-border remittance
                    rails), Plexa allows diasporas and global families to contribute in local fiat currencies via MoneyGram Access
                    while settling securely into Soroban USDC pools.
                  </p>
                </div>

                <div className="docs-card">
                  <div className="docs-card-icon">
                    <Users size={18} />
                  </div>
                  <div className="docs-card-title">3. Multi-Signature Governance Logic</div>
                  <p className="docs-card-desc">
                    Plexa groups leverage native Soroban multi-party authorization. Critical actions—such as admitting a new
                    applicant or approving emergency pauses—require M-of-N threshold signatures from active circle participants.
                  </p>
                </div>

                <div className="docs-card">
                  <div className="docs-card-icon">
                    <Cpu size={18} />
                  </div>
                  <div className="docs-card-title">4. Account Abstraction & Smart Wallets</div>
                  <p className="docs-card-desc">
                    The protocol interfaces seamlessly with custom Soroban smart wallets and signers. Users can authenticate
                    via browser keys (Freighter, Albedo), passkeys, or multi-owner smart contracts without modifying protocol
                    rules.
                  </p>
                </div>
              </div>

              <h2 className="docs-h2">Fee Sponsorship Code Example</h2>
              <CodeBlock
                language="typescript"
                title="Stellar Fee Bump Envelope Construction"
                code={`import { TransactionBuilder, Horizon, Keypair } from "@stellar/stellar-sdk";

// User builds and signs their inner transaction (no fee required from user)
const innerTx = TransactionBuilder.fromXDR(userSignedXdr, "Public Global Stellar Network ; September 2015");

// Protocol Relayer sponsors the transaction with a Fee Bump
const relayerKeypair = Keypair.fromSecret(process.env.SPONSOR_SECRET_KEY);
const feeBumpTx = TransactionBuilder.buildFeeBumpTransaction(
  relayerKeypair,
  "1000000", // Sponsoring 0.1 XLM max fee
  innerTx,
  "Public Global Stellar Network ; September 2015"
);

feeBumpTx.sign(relayerKeypair);
const server = new Horizon.Server("https://horizon.stellar.org");
await server.submitTransaction(feeBumpTx);`}
              />
            </div>
          )}

          {/* ========================================================================= SECTION 7: SETUP & DEV */}
          {activeSection === "setup" && (
            <div>
              <div className="docs-breadcrumb">
                <span>Docs</span> <ChevronRight size={12} /> <span>Developer Documentation</span> <ChevronRight size={12} />{" "}
                <span>Installation & Setup</span>
              </div>
              <h1 className="docs-section-title">Developer Setup & Installation</h1>
              <p className="docs-section-desc">
                Follow this guide to clone the Plexa repository, set up your local development environment, build the Rust
                Soroban smart contracts, and run the frontend.
              </p>

              <h2 className="docs-h2">System Prerequisites</h2>
              <ul className="docs-p" style={{ paddingLeft: 20 }}>
                <li><strong>Node.js:</strong> v18.0.0 or higher</li>
                <li><strong>Rust & Cargo:</strong> v1.96+ with <code className="docs-inline-code">wasm32v1-none</code> compilation target</li>
                <li><strong>Stellar CLI:</strong> v26+ (for contract compilation and local network simulation)</li>
                <li><strong>Git:</strong> for version control</li>
              </ul>

              <h2 className="docs-h2">Step 1: Clone the Repository</h2>
              <CodeBlock
                language="bash"
                title="Terminal"
                code={`git clone https://github.com/Vivek-Alpha06/Plexa.git
cd Plexa`}
              />

              <h2 className="docs-h2">Step 2: Install Frontend Dependencies & Run Local Dev</h2>
              <CodeBlock
                language="bash"
                title="Terminal"
                code={`cd frontend
npm install
npm run dev`}
              />
              <p className="docs-p">
                Open <a href="http://localhost:5173" target="_blank" rel="noreferrer" style={{ color: "var(--accent)" }}>http://localhost:5173</a> in your browser.
              </p>

              <h2 className="docs-h2">Step 3: Compiling Smart Contracts to WASM</h2>
              <CodeBlock
                language="bash"
                title="Terminal (Root Directory)"
                code={`# Add wasm target if not already present
rustup target add wasm32v1-none

# Build release WASM for all workspace contracts
cargo build --target wasm32v1-none --release

# Optimize WASM bytecode for reduced Soroban state rent
stellar contract optimize --wasm target/wasm32v1-none/release/plexa_group.wasm`}
              />

              <h2 className="docs-h2">Environment Configuration</h2>
              <p className="docs-p">
                The frontend uses environment variables defined in <code className="docs-inline-code">frontend/.env</code> to point
                to the desired Stellar network:
              </p>
              <CodeBlock
                language="env"
                title="frontend/.env (Mainnet Configuration)"
                code={`VITE_STELLAR_NETWORK=public
VITE_HORIZON_URL=https://horizon.stellar.org
VITE_SOROBAN_RPC_URL=https://mainnet.sorobanrpc.com
VITE_FACTORY_CONTRACT_ID=CAOW3VCOWVX4VOM4IRG4QKFP7K5AQDXUPKTLSUMY3BINI64VFBELJTFO
VITE_USDC_CONTRACT_ID=CCW67TSZV3SSS2HXMBQ5JFGCKJNXKZM7UQUWUZPUTHXSTZLEO7SJMI75
VITE_DEMO_MODE=false`}
              />
            </div>
          )}

          {/* ========================================================================= SECTION 8: CONTRACTS & APIS */}
          {activeSection === "contracts" && (
            <div>
              <div className="docs-breadcrumb">
                <span>Docs</span> <ChevronRight size={12} /> <span>Developer Documentation</span> <ChevronRight size={12} />{" "}
                <span>Smart Contracts & APIs</span>
              </div>
              <h1 className="docs-section-title">Smart Contracts & Interface Reference</h1>
              <p className="docs-section-desc">
                Comprehensive API documentation and signature specifications for the Factory, Group, Oracle, and Swap contracts.
              </p>

              <h2 className="docs-h2">1. Factory Contract Interface</h2>
              <CodeBlock
                language="rust"
                title="contracts/factory/src/lib.rs"
                code={`pub trait FactoryTrait {
    /// Initialize the factory with admin authority and group WASM hash
    fn init(env: Env, admin: Address, group_wasm: BytesN<32>, registry: Address);

    /// Deploy a new ROSCA savings circle instance
    fn create_group(
        env: Env,
        creator: Address,
        name: Symbol,
        asset: Address,
        pot_size: i128,
        period_duration: u64,
        member_target: u32,
        salt: BytesN<32>,
    ) -> Address;

    /// Query all active groups registered in the protocol registry
    fn get_public_groups(env: Env, start_idx: u32, limit: u32) -> Vec<Address>;

    /// Verify whether a given address is a legitimate Plexa-deployed group
    fn is_group(env: Env, group_id: Address) -> bool;

    /// Propose contract code upgrade with 48-hour timelock delay
    fn propose_upgrade(env: Env, new_wasm_hash: BytesN<32>);

    /// Execute upgrade after 48-hour timelock has elapsed
    fn apply_upgrade(env: Env);
}`}
              />

              <h2 className="docs-h2">2. Group Contract Interface</h2>
              <CodeBlock
                language="rust"
                title="contracts/group/src/lib.rs"
                code={`pub trait GroupTrait {
    /// Submit request to join circle
    fn request_join(env: Env, applicant: Address);

    /// Existing member votes to approve or reject applicant
    fn vote_join(env: Env, voter: Address, applicant: Address, approve: bool);

    /// Lock 100% non-custodial collateral deposit
    fn deposit_collateral(env: Env, member: Address, asset: Address, amount: i128);

    /// Submit periodic savings contribution
    fn contribute(env: Env, member: Address, amount: i128);

    /// Place discount auction bid (in basis points, e.g. 1000 = 10%)
    fn place_bid(env: Env, bidder: Address, discount_bps: u32);

    /// Resolve period, settle defaults from collateral, and disburse net pot
    fn resolve_period(env: Env);

    /// Winner claims available net pot payout
    fn claim_payout(env: Env, winner: Address);

    /// Withdraw collateral upon cycle completion and 24h grace window
    fn withdraw_collateral(env: Env, member: Address);
}`}
              />
            </div>
          )}

          {/* ========================================================================= SECTION 9: TESTING & SIMULATION */}
          {activeSection === "testing" && (
            <div>
              <div className="docs-breadcrumb">
                <span>Docs</span> <ChevronRight size={12} /> <span>Developer Documentation</span> <ChevronRight size={12} />{" "}
                <span>Testing & Simulation</span>
              </div>
              <h1 className="docs-section-title">Automated Testing & End-to-End Suite</h1>
              <p className="docs-section-desc">
                Plexa maintains a rigorous testing regime including 28+ Rust unit test assertions and end-to-end integration tests
                executed against deployed WASM under real simulated ledger time.
              </p>

              <h2 className="docs-h2">Running Smart Contract Unit Tests</h2>
              <CodeBlock
                language="bash"
                title="Terminal"
                code={`# Run all unit tests across the contract workspace
bash scripts/test.sh

# Or using standard cargo test
cargo test --workspace`}
              />

              <h2 className="docs-h2">End-to-End Simulation Against Deployed WASM</h2>
              <CodeBlock
                language="bash"
                title="Terminal"
                code={`cd e2e
node e2e.mjs`}
              />
              <p className="docs-p">
                The e2e test suite simulates complete 5-period savings cycles, verifying collateral locking, discount auction
                splits, automated default coverage, and non-custodial collateral returns under exact Soroban storage footprints.
              </p>
            </div>
          )}

          {/* ========================================================================= SECTION 10: USER GUIDE */}
          {activeSection === "user-guide" && (
            <div>
              <div className="docs-breadcrumb">
                <span>Docs</span> <ChevronRight size={12} /> <span>User & Security Guides</span> <ChevronRight size={12} />{" "}
                <span>User Guide</span>
              </div>
              <h1 className="docs-section-title">Complete User Guide</h1>
              <p className="docs-section-desc">
                Detailed step-by-step instructions for participants joining a savings circle, placing auction bids, making
                periodic payments, and withdrawing collateral.
              </p>

              <h2 className="docs-h2">What is a Savings Circle?</h2>
              <p className="docs-p">
                Five people each put in a small amount every round. One person takes the whole pot that round. Next round,
                everyone pays in again and someone else takes it. After five rounds, everyone has paid in five times and taken
                the pot once.
              </p>

              <h2 className="docs-h2">How to Create a Group</h2>
              <div className="docs-step">
                <div className="docs-step-number">1</div>
                <div className="docs-step-body">
                  <div className="docs-step-title">Open Create Group Wizard</div>
                  <p className="docs-p">
                    Click <Link to="/app/create" style={{ color: "var(--accent)" }}>Create Group</Link> in the navigation header.
                  </p>
                </div>
              </div>
              <div className="docs-step">
                <div className="docs-step-number">2</div>
                <div className="docs-step-body">
                  <div className="docs-step-title">Configure Parameters</div>
                  <p className="docs-p">
                    Select currency (XLM or USDC), contribution per round (e.g. 10 USDC), period cadence (e.g. 7 days), and
                    maximum circle capacity (e.g. 5 members).
                  </p>
                </div>
              </div>
              <div className="docs-step">
                <div className="docs-step-number">3</div>
                <div className="docs-step-body">
                  <div className="docs-step-title">Sign Transaction</div>
                  <p className="docs-p">
                    Confirm the transaction in your Freighter or Albedo wallet. The Factory deploys your new group contract
                    instantly!
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* ========================================================================= SECTION 11: SECURITY AUDIT */}
          {activeSection === "security" && (
            <div>
              <div className="docs-breadcrumb">
                <span>Docs</span> <ChevronRight size={12} /> <span>User & Security Guides</span> <ChevronRight size={12} />{" "}
                <span>Security Audit</span>
              </div>
              <h1 className="docs-section-title">Security Review & Trust Model</h1>
              <p className="docs-section-desc">
                Comprehensive internal audit report documenting trust invariants, threat mitigation matrices, and 8 critical bugs
                found and resolved during development.
              </p>

              <div className="docs-callout warn">
                <AlertTriangle size={20} className="docs-callout-icon" />
                <div className="docs-callout-text">
                  <strong>Internal Audit Disclosure:</strong> This document represents a formal internal code audit and
                  invariant analysis. While all known vulnerabilities have been resolved and covered with regression tests,
                  users are encouraged to review the open-source code before depositing significant funds.
                </div>
              </div>

              <h2 className="docs-h2">8 Bugs Found & Fixed During Development</h2>
              <div className="docs-table-wrapper">
                <table className="docs-table">
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>Bug Description</th>
                      <th>Severity & Impact</th>
                      <th>Resolution & Hardening</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td><strong>1</strong></td>
                      <td>Soroswap Pull Target Mismatch</td>
                      <td><span className="docs-item-tag" style={{ background: "#ef4444", color: "#fff" }}>Critical</span></td>
                      <td>Corrected router authorization to name pair address rather than router contract.</td>
                    </tr>
                    <tr>
                      <td><strong>2</strong></td>
                      <td>Soroban Auth Argument Exact Matching</td>
                      <td><span className="docs-item-tag" style={{ background: "#ef4444", color: "#fff" }}>Critical</span></td>
                      <td>Sized auth payloads dynamically against live AMM reserve quotes.</td>
                    </tr>
                    <tr>
                      <td><strong>3</strong></td>
                      <td>Deadline Zero Sentinel Trapping</td>
                      <td><span className="docs-item-tag" style={{ background: "#f59e0b", color: "#fff" }}>High</span></td>
                      <td>Replaced default zero with current ledger timestamp + 300 seconds.</td>
                    </tr>
                    <tr>
                      <td><strong>4</strong></td>
                      <td>PRNG Non-Deterministic Storage Footprint</td>
                      <td><span className="docs-item-tag" style={{ background: "#ef4444", color: "#fff" }}>Critical</span></td>
                      <td>Replaced pseudo-random lottery with fixed join-order rotation.</td>
                    </tr>
                    <tr>
                      <td><strong>5</strong></td>
                      <td>Dry Router Trapping on Low Liquidity</td>
                      <td><span className="docs-item-tag" style={{ background: "#f59e0b", color: "#fff" }}>High</span></td>
                      <td>Implemented <code className="docs-inline-code">try_invoke_contract</code> fallback to member debt.</td>
                    </tr>
                    <tr>
                      <td><strong>6</strong></td>
                      <td>Client-Side Grace Period Re-Derivation</td>
                      <td><span className="docs-item-tag" style={{ background: "#3b82f6", color: "#fff" }}>Medium</span></td>
                      <td>Synchronized grace unlock checks directly with on-chain ledger timestamp.</td>
                    </tr>
                    <tr>
                      <td><strong>7</strong></td>
                      <td>Discount Split Winner Exclusion</td>
                      <td><span className="docs-item-tag" style={{ background: "#3b82f6", color: "#fff" }}>Medium</span></td>
                      <td>Corrected dividend divisor to distribute discount evenly to all N members.</td>
                    </tr>
                    <tr>
                      <td><strong>8</strong></td>
                      <td>Deploy Script Mock Venue Hardcoding</td>
                      <td><span className="docs-item-tag" style={{ background: "#f59e0b", color: "#fff" }}>High</span></td>
                      <td>Separated Mainnet production addresses from Testnet mock router environments.</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ========================================================================= SECTION 12: COMPLIANCE MATRIX */}
          {activeSection === "compliance" && (
            <div>
              <div className="docs-breadcrumb">
                <span>Docs</span> <ChevronRight size={12} /> <span>Challenge & Startup Growth</span> <ChevronRight size={12} />{" "}
                <span>Compliance Matrix</span>
              </div>
              <h1 className="docs-section-title">Level 6 & Level 7 Deliverables Matrix</h1>
              <p className="docs-section-desc">
                Verification matrix proving 100% fulfillment of all Level 6 (Black Belt) and Level 7 (Founder Belt) requirements
                for the Stellar Builder Challenge.
              </p>

              <h2 className="docs-h2">1. Level 6 (Black Belt) Checklist</h2>
              <div className="docs-table-wrapper">
                <table className="docs-table">
                  <thead>
                    <tr>
                      <th>Requirement</th>
                      <th>Benchmark</th>
                      <th>Plexa Fulfillment Status</th>
                      <th>Verification Proof</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td><strong>Mainnet Deployment</strong></td>
                      <td>Smart contracts on Mainnet</td>
                      <td><span className="docs-item-tag accent">✅ Verified Live</span></td>
                      <td>Factory: <code className="docs-inline-code">CAOW3VCOWV...ELJTFO</code></td>
                    </tr>
                    <tr>
                      <td><strong>Public Web App</strong></td>
                      <td>Live production application</td>
                      <td><span className="docs-item-tag accent">✅ Live on Vercel</span></td>
                      <td><a href="https://plexa-eight.vercel.app" target="_blank" rel="noreferrer" style={{ color: "var(--accent)" }}>plexa-eight.vercel.app</a></td>
                    </tr>
                    <tr>
                      <td><strong>Real Adoption</strong></td>
                      <td>20+ Mainnet Users</td>
                      <td><span className="docs-item-tag accent">✅ 51 Verified Users</span></td>
                      <td>On-chain table in README with StellarExpert links</td>
                    </tr>
                    <tr>
                      <td><strong>Security Review</strong></td>
                      <td>Mandatory audit / review</td>
                      <td><span className="docs-item-tag accent">✅ Completed</span></td>
                      <td>Formal internal audit in <code className="docs-inline-code">docs/SECURITY.md</code></td>
                    </tr>
                    <tr>
                      <td><strong>Social Promotion</strong></td>
                      <td>Launch thread on Twitter/X</td>
                      <td><span className="docs-item-tag accent">✅ Published</span></td>
                      <td><a href="https://x.com/Plexa_v1" target="_blank" rel="noreferrer" style={{ color: "var(--accent)" }}>@Plexa_v1 on X</a></td>
                    </tr>
                    <tr>
                      <td><strong>Technical Standards</strong></td>
                      <td>30+ Meaningful Commits</td>
                      <td><span className="docs-item-tag accent">✅ 144 Commits</span></td>
                      <td><code className="docs-inline-code">git rev-list --count HEAD</code></td>
                    </tr>
                    <tr>
                      <td><strong>Advanced Features</strong></td>
                      <td>At least 1 advanced feature</td>
                      <td><span className="docs-item-tag accent">✅ 4 Implemented</span></td>
                      <td>Fee Sponsorship, SEP-24/31, Multi-sig, Smart Wallets</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <h2 className="docs-h2">2. Level 7 (Founder Belt) Checklist</h2>
              <div className="docs-table-wrapper">
                <table className="docs-table">
                  <thead>
                    <tr>
                      <th>Requirement</th>
                      <th>Benchmark</th>
                      <th>Plexa Fulfillment Status</th>
                      <th>Verification Proof</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td><strong>Public Repository</strong></td>
                      <td>Public GitHub</td>
                      <td><span className="docs-item-tag accent">✅ Public</span></td>
                      <td><a href="https://github.com/Vivek-Alpha06/Plexa" target="_blank" rel="noreferrer" style={{ color: "var(--accent)" }}>GitHub/Vivek-Alpha06/Plexa</a></td>
                    </tr>
                    <tr>
                      <td><strong>50+ Mainnet Users</strong></td>
                      <td>50+ Verified Users</td>
                      <td><span className="docs-item-tag accent">✅ 51 Users</span></td>
                      <td>Documented on-chain interaction records</td>
                    </tr>
                    <tr>
                      <td><strong>User Feedback Sheet</strong></td>
                      <td>Excel/CSV Feedback Dataset</td>
                      <td><span className="docs-item-tag accent">✅ 50 Responses</span></td>
                      <td><a href="https://docs.google.com/spreadsheets/d/1Hc3Hp1LWov_zRv7xerMRvo18IKWWBSK_Kn3P41_JaZU/edit?usp=sharing" target="_blank" rel="noreferrer" style={{ color: "var(--accent)" }}>Google Sheet Feedback</a></td>
                    </tr>
                    <tr>
                      <td><strong>Improvement Commits</strong></td>
                      <td>Linked code improvements</td>
                      <td><span className="docs-item-tag accent">✅ 13 Shipped Commits</span></td>
                      <td>Full commit traceability table</td>
                    </tr>
                    <tr>
                      <td><strong>Monthly Growth Report</strong></td>
                      <td>Startup growth report</td>
                      <td><span className="docs-item-tag accent">✅ Published</span></td>
                      <td><code className="docs-inline-code">docs/GROWTH-REPORT.md</code> & Docs Portal</td>
                    </tr>
                    <tr>
                      <td><strong>Community Growth</strong></td>
                      <td>50+ Followers/Community</td>
                      <td><span className="docs-item-tag accent">✅ 200+ Engagements</span></td>
                      <td>Instagram & Twitter/X community growth</td>
                    </tr>
                    <tr>
                      <td><strong>Dedicated Docs Site</strong></td>
                      <td>Public documentation website</td>
                      <td><span className="docs-item-tag accent">✅ Live at /docs</span></td>
                      <td>Interactive documentation portal</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <h2 className="docs-h2">3. 13 Shipped User Feedback Improvements</h2>
              <div className="docs-table-wrapper">
                <table className="docs-table">
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>User Name</th>
                      <th>User Feedback / Friction Point</th>
                      <th>Code Implementation</th>
                      <th>Git Commit Hash</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td><strong>1</strong></td>
                      <td>Prisha Dey</td>
                      <td>Missing 1-click address copy in header</td>
                      <td>Implemented 1-click copy with "✓ Copied" feedback</td>
                      <td><a href="https://github.com/Vivek-Alpha06/Plexa/commit/9ab5bce" target="_blank" rel="noreferrer" style={{ color: "var(--accent)" }}><code>9ab5bce</code></a></td>
                    </tr>
                    <tr>
                      <td><strong>2</strong></td>
                      <td>Gour Majumdar</td>
                      <td>Net pot & dividend calculation unclear</td>
                      <td>Added real-time auction discount calculator</td>
                      <td><a href="https://github.com/Vivek-Alpha06/Plexa/commit/7085b14" target="_blank" rel="noreferrer" style={{ color: "var(--accent)" }}><code>7085b14</code></a></td>
                    </tr>
                    <tr>
                      <td><strong>3</strong></td>
                      <td>Lipika Dey</td>
                      <td>Active & completed groups mixed</td>
                      <td>Added multi-status tab filter & currency search</td>
                      <td><a href="https://github.com/Vivek-Alpha06/Plexa/commit/f6c2244" target="_blank" rel="noreferrer" style={{ color: "var(--accent)" }}><code>f6c2244</code></a></td>
                    </tr>
                    <tr>
                      <td><strong>4</strong></td>
                      <td>Susmita Sain</td>
                      <td>Collateral refund terms unclear</td>
                      <td>Added 100% Non-Custodial Refund Guarantee banner</td>
                      <td><a href="https://github.com/Vivek-Alpha06/Plexa/commit/55c8c10" target="_blank" rel="noreferrer" style={{ color: "var(--accent)" }}><code>55c8c10</code></a></td>
                    </tr>
                    <tr>
                      <td><strong>5</strong></td>
                      <td>Pabon Dey</td>
                      <td>Explorer link opening in same tab</td>
                      <td>Configured external target="_blank" rel="noreferrer"</td>
                      <td><a href="https://github.com/Vivek-Alpha06/Plexa/commit/e79b812" target="_blank" rel="noreferrer" style={{ color: "var(--accent)" }}><code>e79b812</code></a></td>
                    </tr>
                    <tr>
                      <td><strong>6</strong></td>
                      <td>Rahul Sharma</td>
                      <td>Missing validation on contribution amounts</td>
                      <td>Added strict boundary validation rules</td>
                      <td><a href="https://github.com/Vivek-Alpha06/Plexa/commit/2f2bf24" target="_blank" rel="noreferrer" style={{ color: "var(--accent)" }}><code>2f2bf24</code></a></td>
                    </tr>
                    <tr>
                      <td><strong>7</strong></td>
                      <td>Ananya Banerjee</td>
                      <td>Total savings summary missing on dashboard</td>
                      <td>Added cumulative savings & winnings metrics grid</td>
                      <td><a href="https://github.com/Vivek-Alpha06/Plexa/commit/81647af" target="_blank" rel="noreferrer" style={{ color: "var(--accent)" }}><code>81647af</code></a></td>
                    </tr>
                    <tr>
                      <td><strong>8</strong></td>
                      <td>Subhashis Mukherjee</td>
                      <td>Transaction fees & base reserve unclear</td>
                      <td>Added Network Reserve & Gas Fee Explainer banner</td>
                      <td><a href="https://github.com/Vivek-Alpha06/Plexa/commit/892d1c4" target="_blank" rel="noreferrer" style={{ color: "var(--accent)" }}><code>892d1c4</code></a></td>
                    </tr>
                    <tr>
                      <td><strong>9</strong></td>
                      <td>Puja Chakraborty</td>
                      <td>Timer end latency when period flips</td>
                      <td>Added automatic onEnd auto-sync callback</td>
                      <td><a href="https://github.com/Vivek-Alpha06/Plexa/commit/4c18500" target="_blank" rel="noreferrer" style={{ color: "var(--accent)" }}><code>4c18500</code></a></td>
                    </tr>
                    <tr>
                      <td><strong>10</strong></td>
                      <td>Amitav Sen</td>
                      <td>Network indicator pill not prominent</td>
                      <td>Added green/amber network status badge in header</td>
                      <td><a href="https://github.com/Vivek-Alpha06/Plexa/commit/167aa35" target="_blank" rel="noreferrer" style={{ color: "var(--accent)" }}><code>167aa35</code></a></td>
                    </tr>
                    <tr>
                      <td><strong>11</strong></td>
                      <td>Debasmita Roy</td>
                      <td>CSV export missing for tax records</td>
                      <td>Added 1-click CSV export on user profile</td>
                      <td><a href="https://github.com/Vivek-Alpha06/Plexa/commit/71fb4b2" target="_blank" rel="noreferrer" style={{ color: "var(--accent)" }}><code>71fb4b2</code></a></td>
                    </tr>
                    <tr>
                      <td><strong>12</strong></td>
                      <td>Sandip Bhattacharya</td>
                      <td>ROSCA rules inaccessible during bidding</td>
                      <td>Added collapsible ROSCA Rulebook modal</td>
                      <td><a href="https://github.com/Vivek-Alpha06/Plexa/commit/b4599c5" target="_blank" rel="noreferrer" style={{ color: "var(--accent)" }}><code>b4599c5</code></a></td>
                    </tr>
                    <tr>
                      <td><strong>13</strong></td>
                      <td>Sneha Ghosh</td>
                      <td>Albedo wallet popup blocker confusion</td>
                      <td>Added browser popup unblock guidance & retries</td>
                      <td><a href="https://github.com/Vivek-Alpha06/Plexa/commit/835407e" target="_blank" rel="noreferrer" style={{ color: "var(--accent)" }}><code>835407e</code></a></td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ========================================================================= SECTION 13: GROWTH REPORT */}
          {activeSection === "growth-report" && (
            <div>
              <div className="docs-breadcrumb">
                <span>Docs</span> <ChevronRight size={12} /> <span>Challenge & Startup Growth</span> <ChevronRight size={12} />{" "}
                <span>Monthly Growth Report</span>
              </div>
              <h1 className="docs-section-title">Level 7 Founder Belt: Monthly Growth Report</h1>
              <p className="docs-section-desc">
                Executive startup report detailing user acquisition funnels, unit economics, retention metrics, and future roadmap.
              </p>

              <div className="docs-grid-3">
                <div className="docs-card">
                  <div className="docs-card-title">Verified Users</div>
                  <div style={{ fontSize: 24, fontWeight: 700, color: "var(--accent)", margin: "8px 0" }}>51 Mainnet</div>
                  <p className="docs-card-desc">102% of Level 7 benchmark</p>
                </div>
                <div className="docs-card">
                  <div className="docs-card-title">User Satisfaction</div>
                  <div style={{ fontSize: 24, fontWeight: 700, color: "#a78bfa", margin: "8px 0" }}>4.8 / 5.0</div>
                  <p className="docs-card-desc">From 50 surveyed participants</p>
                </div>
                <div className="docs-card">
                  <div className="docs-card-title">Shipped Commits</div>
                  <div style={{ fontSize: 24, fontWeight: 700, color: "#60a5fa", margin: "8px 0" }}>144 Commits</div>
                  <p className="docs-card-desc">480% of challenge requirement</p>
                </div>
              </div>

              <h2 className="docs-h2">Startup Growth & Unit Economics</h2>
              <p className="docs-p">
                Plexa operates with virtually zero transaction overhead due to Stellar's ultra-low fee structure (~$0.00001 per TX).
                Contract code optimization reduces Soroban state rent by 22%, enabling sustainable long-term contract custody.
              </p>
              <p className="docs-p">
                <strong>V2 Monetization Model:</strong> Future protocol iterations will implement an opt-in 0.25% protocol fee
                on auction discount surpluses and integrate with Stellar yield protocols (e.g. Blend) to generate yield on escrowed
                collateral during active savings cycles.
              </p>
            </div>
          )}

          {/* ========================================================================= SECTION 14: FAQ & REGISTRY */}
          {activeSection === "faq" && (
            <div>
              <div className="docs-breadcrumb">
                <span>Docs</span> <ChevronRight size={12} /> <span>Challenge & Startup Growth</span> <ChevronRight size={12} />{" "}
                <span>FAQ & Registry</span>
              </div>
              <h1 className="docs-section-title">Frequently Asked Questions & Registry</h1>
              <p className="docs-section-desc">
                Answers to common user and developer questions, alongside one-click copyable mainnet contract addresses.
              </p>

              <h2 className="docs-h2">Official Stellar Mainnet Contract Registry</h2>
              <div className="docs-table-wrapper">
                <table className="docs-table">
                  <thead>
                    <tr>
                      <th>Resource</th>
                      <th>Address / Hash</th>
                      <th>Explorer Link</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td>Plexa Factory</td>
                      <td><CopySnippet text="CAOW3VCOWVX4VOM4IRG4QKFP7K5AQDXUPKTLSUMY3BINI64VFBELJTFO" /></td>
                      <td><a href="https://stellar.expert/explorer/public/contract/CAOW3VCOWVX4VOM4IRG4QKFP7K5AQDXUPKTLSUMY3BINI64VFBELJTFO" target="_blank" rel="noreferrer" style={{ color: "var(--accent)" }}>View on StellarExpert ↗</a></td>
                    </tr>
                    <tr>
                      <td>Group WASM Hash</td>
                      <td><CopySnippet text="4602c2c29cc61b2a239c45fbf43e12b3d430d765ca33fa298ddab73e99cd3148" /></td>
                      <td><a href="https://stellar.expert/explorer/public/tx/11b3327b1f669ea428e6259fdd9d32c8c28afd2ca31d71d601dba81d49b80e9c" target="_blank" rel="noreferrer" style={{ color: "var(--accent)" }}>View WASM Upload TX ↗</a></td>
                    </tr>
                    <tr>
                      <td>Mainnet Group Contract</td>
                      <td><CopySnippet text="CDYQ3NVLC62AH5GPCYKUT4P7QIAOLMYDIMRN24IFOTFWTWEEXILEUM4D" /></td>
                      <td><a href="https://stellar.expert/explorer/public/contract/CDYQ3NVLC62AH5GPCYKUT4P7QIAOLMYDIMRN24IFOTFWTWEEXILEUM4D" target="_blank" rel="noreferrer" style={{ color: "var(--accent)" }}>View Group on StellarExpert ↗</a></td>
                    </tr>
                    <tr>
                      <td>Reflector Oracle Adapter</td>
                      <td><CopySnippet text="CAFJZQWSED6YAWZU3GWRTOCNPPCGBN32L7QV43XX5LZLFTK6JLN34DLN" /></td>
                      <td><a href="https://stellar.expert/explorer/public/contract/CAFJZQWSED6YAWZU3GWRTOCNPPCGBN32L7QV43XX5LZLFTK6JLN34DLN" target="_blank" rel="noreferrer" style={{ color: "var(--accent)" }}>View Oracle on StellarExpert ↗</a></td>
                    </tr>
                    <tr>
                      <td>Soroswap Router</td>
                      <td><CopySnippet text="CAG5LRYQ5JVEUI5TEID72EYOVX44TTUJT5BQR2J6J77FH65PCCFAJDDH" /></td>
                      <td><a href="https://stellar.expert/explorer/public/contract/CAG5LRYQ5JVEUI5TEID72EYOVX44TTUJT5BQR2J6J77FH65PCCFAJDDH" target="_blank" rel="noreferrer" style={{ color: "var(--accent)" }}>View Router on StellarExpert ↗</a></td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <h2 className="docs-h2">Frequently Asked Questions</h2>
              <div className="docs-card" style={{ marginBottom: 14 }}>
                <div className="docs-card-title">Do I have to trust the group creator?</div>
                <div className="docs-card-desc">
                  No. The group creator holds no administrative privileges over member funds. Group parameters (contribution,
                  cadence, pot size) are permanently fixed in the smart contract at creation time.
                </div>
              </div>

              <div className="docs-card" style={{ marginBottom: 14 }}>
                <div className="docs-card-title">What happens if a member stops contributing?</div>
                <div className="docs-card-desc">
                  The protocol automatically executes default settlement during the settlement window, drawing the missing
                  contribution from the defaulting member's locked collateral. The circle never breaks.
                </div>
              </div>

              <div className="docs-card" style={{ marginBottom: 14 }}>
                <div className="docs-card-title">When can I withdraw my locked collateral?</div>
                <div className="docs-card-desc">
                  Collateral is released immediately upon cycle completion (once all members have won the pot once) following a
                  standard 24-hour grace window to ensure all pending settlements are fully cleared.
                </div>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
