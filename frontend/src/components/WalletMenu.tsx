// Connected-wallet control: the address button, and the menu behind it.
//
// The address used to disconnect on click, with a separate copy button beside
// it — so the destructive action was the easy one to hit by accident and the
// harmless one took up header width. Both now live in a menu the click opens.

import { useEffect, useRef, useState } from "react";
import { Check, Copy, LogOut } from "lucide-react";
import { useWallet } from "../context/WalletContext";
import { shortAddr } from "../lib/format";
import { DEMO } from "../lib/config";
import { demoNameFor } from "../lib/demo";

export function WalletMenu() {
  const { address, provider, disconnect } = useWallet();
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

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

  // Clear the "Copied" state when the menu closes, so reopening it doesn't
  // show a stale confirmation.
  useEffect(() => {
    if (!open) setCopied(false);
  }, [open]);

  if (!address) return null;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(address);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard blocked (insecure origin, denied permission) — the full
      // address is on screen in the menu, so it can still be selected by hand.
      setCopied(false);
    }
  };

  const label = (DEMO && demoNameFor(address)) || shortAddr(address);

  return (
    <div className="wmenu-wrap" ref={ref}>
      <button
        className={`btn sm wmenu-btn ${open ? "open" : ""}`}
        onClick={() => setOpen(!open)}
        aria-haspopup="menu"
        aria-expanded={open}
        title="Wallet options"
      >
        {label}
      </button>

      {open && (
        <div className="wmenu-panel card" role="menu">
          <div className="wmenu-head">
            <span className="wmenu-provider">{provider ?? "wallet"}</span>
            <span className="wmenu-addr">{address}</span>
          </div>
          <button className="wmenu-item" role="menuitem" onClick={copy}>
            {copied ? <Check size={14} /> : <Copy size={14} />}
            {copied ? "Copied" : "Copy address"}
          </button>
          <button
            className="wmenu-item danger"
            role="menuitem"
            onClick={() => {
              setOpen(false);
              disconnect();
            }}
          >
            <LogOut size={14} />
            Disconnect
          </button>
        </div>
      )}
    </div>
  );
}
