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

  const exportCsv = () => {
    if (!mine.length) return;
    const headers = [
      "Group Name",
      "Group ID",
      "Status",
      "Currency",
      "Your State",
      "Has Won",
      "Collateral Locked",
    ];
    const rowsData = mine.map((v) => {
      const me = v.members.find((m) => m.addr === address);
      return [
        `"${v.config.name.replace(/"/g, '""')}"`,
        v.id,
        v.state.status,
        v.config.currency,
        me?.removed ? "Removed" : me?.in_default ? "Default" : "Active Member",
        me?.has_won ? "Yes" : "No",
        me?.collateral_asset === "Xlm"
          ? `${fmtXlm(me.collateral_xlm)} XLM`
          : `${fmtUsdc(me?.collateral_usdc ?? 0n)} USDC`,
      ].join(",");
    });
    const csvContent = [headers.join(","), ...rowsData].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `plexa_rosca_history_${address?.slice(0, 8)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div>
      <div className="row between" style={{ marginBottom: 4 }}>
        <h1 style={{ margin: 0 }}>Profile</h1>
        {mine.length > 0 && (
          <button className="btn sm secondary" onClick={exportCsv} title="Download your ROSCA history as CSV">
            📥 Export History (CSV)
          </button>
        )}
      </div>
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
