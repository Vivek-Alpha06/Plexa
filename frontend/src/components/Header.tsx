import { useEffect, useState } from "react";
import { Link, NavLink } from "react-router-dom";
import { useWallet } from "../context/WalletContext";
import { fmtUsdc } from "../lib/format";
import { sponsorHealth } from "../lib/sponsor";
import { NotificationBell } from "./NotificationBell";
import { NetworkToggle } from "./NetworkToggle";
import { WalletMenu } from "./WalletMenu";
import { PlexaMark } from "./Logo";

export function Header() {
  const { address, balance, openPicker } = useWallet();

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
          <NavLink to="/app/swap">Swap</NavLink>
          <NavLink to="/app/dashboard">Dashboard</NavLink>
          <NavLink to="/app/profile">Profile</NavLink>
        </nav>
      </div>
      <div className="row" style={{ gap: 8 }}>
        <NetworkToggle compact />
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
            <WalletMenu />
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
