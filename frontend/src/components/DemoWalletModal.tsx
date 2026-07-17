// Demo-only wallet confirmation. Mirrors a real wallet's "approve / reject"
// signing prompt so demo actions feel real and show funds moving.
import { useEffect, useState } from "react";
import { DEMO } from "../lib/config";
import { useWallet } from "../context/WalletContext";
import { subscribeTx, resolveTx, getDemoBalance, type TxRequest } from "../lib/demoWallet";
import { DEMO_ADDRESS, demoNameFor } from "../lib/demo";
import { fmtUsdc, shortAddr } from "../lib/format";

export function DemoWalletModal() {
  const { address } = useWallet();
  const [req, setReq] = useState<TxRequest | null>(null);

  useEffect(() => {
    if (!DEMO) return;
    return subscribeTx(setReq);
  }, []);

  if (!DEMO || !req) return null;

  const acct = address ?? DEMO_ADDRESS;
  const outgoing = req.outgoing !== false;
  const balance = getDemoBalance(acct);

  return (
    <div className="modal-backdrop">
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="row between" style={{ marginBottom: 4 }}>
          <h3 style={{ margin: 0 }}>🪐 Demo Wallet</h3>
          <span className="pill">Simulated</span>
        </div>
        <p className="muted" style={{ marginTop: 4 }}>
          Confirm this transaction to continue. No real network or funds are involved.
        </p>

        <div
          className="card"
          style={{ background: "var(--bg-elev-2)", boxShadow: "none", marginTop: 8 }}
        >
          <div className="section-title" style={{ marginTop: 0 }}>
            {req.title}
          </div>
          <p className="muted" style={{ marginTop: 0 }}>
            {req.detail}
          </p>
          <div className="summary-row">
            <span className="k">Account</span>
            <span className="v">
              {demoNameFor(acct) ? `${demoNameFor(acct)} · ` : ""}
              {shortAddr(acct)}
            </span>
          </div>
          <div className="summary-row">
            <span className="k">Wallet balance</span>
            <span className="v">{fmtUsdc(balance)}</span>
          </div>
          {req.amount !== undefined && req.amount > 0n && (
            <div className="summary-row">
              <span className="k">{outgoing ? "You pay" : "You receive"}</span>
              <span
                className="v"
                style={{ color: outgoing ? "var(--danger)" : "var(--success, #16a34a)" }}
              >
                {outgoing ? "−" : "+"}
                {fmtUsdc(req.amount)}
              </span>
            </div>
          )}
        </div>

        <div className="row" style={{ gap: 10, marginTop: 16 }}>
          <button
            className="btn ghost"
            style={{ flex: 1 }}
            onClick={() => resolveTx(false)}
          >
            Reject
          </button>
          <button
            className="btn primary"
            style={{ flex: 1 }}
            onClick={() => resolveTx(true)}
          >
            Approve
          </button>
        </div>
      </div>
    </div>
  );
}
