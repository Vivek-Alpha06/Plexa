import { Link, NavLink } from "react-router-dom";
import { useWallet } from "../context/WalletContext";
import { fmtUsdc, shortAddr } from "../lib/format";
import { DEMO } from "../lib/config";
import { demoNameFor } from "../lib/demo";
import { NotificationBell } from "./NotificationBell";
import { PlexaMark } from "./Logo";

export function Header() {
  const { address, balance, provider, openPicker, disconnect } = useWallet();
  return (
    <header className="header">
      <div className="row" style={{ gap: 22 }}>
        <Link to="/app/groups" className="brand">
          <PlexaMark size={24} />
          Plexa<sup>™</sup>
        </Link>
        <nav className="nav-links">
          <NavLink to="/" end>
            Home
          </NavLink>
          <NavLink to="/app/groups">Groups</NavLink>
          <NavLink to="/app/dashboard">Dashboard</NavLink>
          <NavLink to="/app/profile">Profile</NavLink>
        </nav>
      </div>
      <div className="row">
        {address ? (
          <>
            {DEMO && (
              <span className="pill" title="Demo mode — simulated funds, no real network">
                Demo
              </span>
            )}
            <NotificationBell address={address} />
            <span className="pill green" title="Your USDC balance">
              {fmtUsdc(balance)}
            </span>
            <button
              className="btn sm"
              onClick={disconnect}
              title={`${address} · ${provider ?? ""} — click to disconnect / switch account`}
            >
              {(DEMO && demoNameFor(address)) || shortAddr(address)}
            </button>
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
