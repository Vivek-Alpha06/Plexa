import { useEffect, useState } from "react";
import { Link, NavLink } from "react-router-dom";
import { useWallet } from "../context/WalletContext";
import { fmtUsdc, shortAddr } from "../lib/format";
import { DEMO, NETWORK } from "../lib/config";
import { demoNameFor } from "../lib/demo";
import { sponsorHealth } from "../lib/sponsor";
import { NotificationBell } from "./NotificationBell";
import { PlexaMark } from "./Logo";

export function Header() {
  const { address, balance, provider, openPicker, disconnect } = useWallet();
  const [copied, setCopied] = useState(false);

  const handleCopy = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (address) {
      navigator.clipboard.writeText(address);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const isMainnet = NETWORK === "public" || NETWORK === "mainnet";

  // Only advertise gasless transactions when the relayer actually answers and
  // is funded — a badge promising sponsorship that then fails is worse than no
  // badge, since the member has no XLM to fall back on.
  const [gasless, setGasless] = useState<string | null>(null);
  useEffect(() => {
    let live = true;
    sponsorHealth().then((h) => {
      if (live && h?.status === "ok") setGasless(h.sponsor);
    });
    return () => {
      live = false;
    };
  }, []);

  return (
    <header className="header">
      <div className="row" style={{ gap: 22 }}>
        <Link to="/app/groups" className="brand">
          <PlexaMark size={24} />
          PLEXA
        </Link>
        <nav className="nav-links">
          <NavLink to="/" end>
            Home
          </NavLink>
          <NavLink to="/app/groups">Groups</NavLink>
          <NavLink to="/app/dashboard">Dashboard</NavLink>
          <NavLink to="/app/profile">Profile</NavLink>
          <NavLink to="/docs">Docs</NavLink>
        </nav>
      </div>
      <div className="row" style={{ gap: 8 }}>
        <span
          className={`pill ${isMainnet ? "green" : "amber"}`}
          title={`Active Stellar Network: ${isMainnet ? "Public Mainnet" : "Testnet"}`}
          style={{ display: "inline-flex", alignItems: "center", gap: 5 }}
        >
          <span
            style={{
              width: 7,
              height: 7,
              borderRadius: "50%",
              backgroundColor: isMainnet ? "#10b981" : "#f59e0b",
              display: "inline-block",
            }}
          />
          {DEMO ? "Demo" : isMainnet ? "Mainnet" : "Testnet"}
        </span>
        {gasless && (
          <span
            className="pill green"
            title={`Network fees are sponsored by ${gasless}. You do not need XLM to transact.`}
            style={{ display: "inline-flex", alignItems: "center", gap: 5 }}
          >
            ⚡ Gasless
          </span>
        )}
        {address ? (
          <>
            <NotificationBell address={address} />
            <span className="pill green" title="Your USDC balance">
              {fmtUsdc(balance)}
            </span>
            <div className="row" style={{ gap: 4 }}>
              <button
                className="btn sm"
                onClick={disconnect}
                title={`${address} · ${provider ?? ""} — click to switch account`}
              >
                {(DEMO && demoNameFor(address)) || shortAddr(address)}
              </button>
              <button
                className="btn sm secondary"
                onClick={handleCopy}
                title="Copy wallet address"
                style={{ padding: "4px 8px", fontSize: 12 }}
              >
                {copied ? "✓ Copied" : "📋 Copy"}
              </button>
            </div>
          </>
        ) : (
          <button className="btn primary" onClick={openPicker}>
            Connect Wallet
          </button>
        )}
      </div>
    </header>
  );
}
