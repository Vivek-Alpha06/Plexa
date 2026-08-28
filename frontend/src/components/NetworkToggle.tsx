// Runtime testnet <-> mainnet switch, as a dropdown.
//
// The whole app is configured for both networks (lib/config.ts), so picking one
// only records the choice and reloads. Moving *onto* mainnet asks first:
// everything downstream of that click spends real money, and a mis-click is not
// something the user can undo from inside the app.

import { useEffect, useRef, useState } from "react";
import { Check, ChevronDown } from "lucide-react";
import { ACTIVE_NETWORK, DEMO, NETWORKS, setNetwork, type NetworkId } from "../lib/config";

const OPTIONS: { id: NetworkId; label: string; blurb: string }[] = [
  {
    id: "testnet",
    label: "Testnet",
    blurb: "Free test XLM. Nothing real at stake.",
  },
  {
    id: "mainnet",
    label: "Mainnet",
    blurb: "Stellar public network. Real funds.",
  },
];

export function NetworkToggle({ compact = false }: { compact?: boolean }) {
  const [open, setOpen] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Close when attention moves elsewhere, so a half-answered "switch to
  // mainnet?" never sits waiting to be clicked.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  useEffect(() => {
    if (!open) setConfirming(false);
  }, [open]);

  // In demo mode there is no network to pick — say so rather than offering a
  // switch that would do nothing.
  if (DEMO) {
    return (
      <span className="pill purple" title="Demo mode: no Stellar network is used.">
        Demo
      </span>
    );
  }

  const active = OPTIONS.find((o) => o.id === ACTIVE_NETWORK) ?? OPTIONS[0];

  const choose = (id: NetworkId) => {
    if (id === ACTIVE_NETWORK) {
      setOpen(false);
      return;
    }
    if (id === "mainnet") {
      setConfirming(true);
      return;
    }
    setNetwork(id);
  };

  return (
    <div className={`netsw-wrap ${compact ? "compact" : ""}`} ref={ref}>
      <button
        type="button"
        className={`netsw-trigger ${ACTIVE_NETWORK} ${open ? "open" : ""}`}
        onClick={() => setOpen(!open)}
        aria-haspopup="menu"
        aria-expanded={open}
        title={`Network: ${active.label} — ${NETWORKS[ACTIVE_NETWORK].rpcUrl}`}
      >
        <span className="netsw-dot" aria-hidden />
        {active.label}
        <ChevronDown size={13} className="netsw-chev" aria-hidden />
      </button>

      {open && (
        <div className="netsw-menu card" role="menu">
          {confirming ? (
            <div className="netsw-confirm">
              <strong>Switch to Mainnet?</strong>
              <p>
                Mainnet moves <em>real</em> XLM and USDC, and every action is
                irreversible. Plexa has not been externally audited — the testnet build
                is identical and costs nothing.
              </p>
              <p className="netsw-hint">
                Set your wallet extension to the Stellar public network too, or signing
                will fail.
              </p>
              <div className="row" style={{ gap: 8 }}>
                <button className="btn sm danger" onClick={() => setNetwork("mainnet")}>
                  Use Mainnet
                </button>
                <button className="btn sm secondary" onClick={() => setConfirming(false)}>
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            OPTIONS.map((o) => {
              const isActive = o.id === ACTIVE_NETWORK;
              return (
                <button
                  key={o.id}
                  type="button"
                  role="menuitem"
                  className={`netsw-item ${o.id} ${isActive ? "active" : ""}`}
                  onClick={() => choose(o.id)}
                >
                  <span className="netsw-dot" aria-hidden />
                  <span className="netsw-text">
                    <span className="netsw-name">{o.label}</span>
                    <span className="netsw-blurb">{o.blurb}</span>
                  </span>
                  {isActive && <Check size={14} className="netsw-check" aria-hidden />}
                </button>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
