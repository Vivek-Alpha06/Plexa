import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useWallet } from "../context/WalletContext";
import { useGroups } from "../lib/useGroups";
import { factory } from "../lib/contracts";
import { CONFIGURED } from "../lib/config";
import { fmtUsdc, fmtXlm, shortAddr } from "../lib/format";

export function Profile() {
  const { address, provider, balance } = useWallet();
  const { views, loading } = useGroups();
  const [rep, setRep] = useState<number | null>(null);

  useEffect(() => {
    if (!address || !CONFIGURED) return;
    factory
      .repOf(address)
      .then(setRep)
      .catch(() => setRep(null));
  }, [address]);

  if (!address) {
    return (
      <div className="center">
        <div>
          <h1>Profile</h1>
          <p className="muted">Connect your wallet to view your profile.</p>
        </div>
      </div>
    );
  }

  const mine = views.filter((v) => v.members.some((m) => m.addr === address));
  const wonCount = mine.filter((v) =>
    v.members.find((m) => m.addr === address)?.has_won
  ).length;

  return (
    <div>
      <h1 style={{ marginBottom: 4 }}>Profile</h1>
      <p className="muted" style={{ marginTop: 0 }}>
        Your Plexa identity, reputation and memberships.
      </p>

      <div className="split">
        <div>
          <div className="card">
            <div className="row" style={{ gap: 16 }}>
              <div className="wglyph" style={{ width: 56, height: 56, fontSize: 28 }}>
                👤
              </div>
              <div>
                <div className="stat" style={{ fontSize: 22 }}>
                  {shortAddr(address)}
                </div>
                <div className="faint">
                  Connected via {provider ?? "wallet"}
                </div>
              </div>
            </div>
            <div style={{ marginTop: 16 }}>
              <div className="summary-row">
                <span className="k">Full address</span>
                <span className="v" style={{ fontSize: 12, maxWidth: 240, wordBreak: "break-all" }}>
                  {address}
                </span>
              </div>
              <div className="summary-row">
                <span className="k">USDC balance</span>
                <span className="v">{fmtUsdc(balance)}</span>
              </div>
            </div>
          </div>

          <div className="section-title">Memberships</div>
          {loading ? (
            <div className="center muted">Loading…</div>
          ) : mine.length === 0 ? (
            <div className="card muted">
              You haven't joined any groups. <Link to="/app/groups">Browse groups</Link>.
            </div>
          ) : (
            <table className="list">
              <thead>
                <tr>
                  <th>Group</th>
                  <th>Status</th>
                  <th>You</th>
                  <th>Collateral</th>
                </tr>
              </thead>
              <tbody>
                {mine.map((v) => {
                  const me = v.members.find((m) => m.addr === address)!;
                  return (
                    <tr key={v.id}>
                      <td>
                        <Link to={`/app/group/${v.id}`}>{v.config.name}</Link>
                      </td>
                      <td>
                        <span className="pill">{v.state.status}</span>
                      </td>
                      <td>
                        {me.removed ? (
                          <span className="pill red">removed</span>
                        ) : me.has_won ? (
                          <span className="pill purple">won</span>
                        ) : me.in_default ? (
                          <span className="pill red">default</span>
                        ) : (
                          <span className="pill green">active</span>
                        )}
                      </td>
                      <td>
                        {me.collateral_asset === "Xlm"
                          ? fmtXlm(me.collateral_xlm) +
                            (me.collateral_usdc > 0n ? ` + ${fmtUsdc(me.collateral_usdc)}` : "")
                          : fmtUsdc(me.collateral_usdc)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        <div className="card" style={{ position: "sticky", top: 20 }}>
          <div className="section-title" style={{ marginTop: 0 }}>
            Reputation
          </div>
          <div className="stat" style={{ fontSize: 40 }}>
            {rep ?? 0}
          </div>
          <p className="muted">
            Cleanly-completed cycles (finished without ever defaulting). Some groups require a
            minimum reputation to join.
          </p>
          <div className="summary-row">
            <span className="k">Groups joined</span>
            <span className="v">{mine.length}</span>
          </div>
          <div className="summary-row">
            <span className="k">Pots won</span>
            <span className="v">{wonCount}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
