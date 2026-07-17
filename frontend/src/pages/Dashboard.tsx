import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useWallet } from "../context/WalletContext";
import { useGroups } from "../lib/useGroups";
import { group } from "../lib/contracts";
import { fmtAmount, shortAddr } from "../lib/format";
import { Countdown } from "../components/Countdown";
import { GroupCard } from "../components/GroupCard";
import { PriceChart } from "../components/PriceChart";
import type { HistoryEntry, GroupStatus, GroupView, Currency } from "../types";

interface Row extends HistoryEntry {
  groupId: string;
  groupName: string;
  currency: Currency; // the group's currency — amounts are in this token
}

/** Per-group money the connected wallet can pull back. */
interface Pending {
  groupId: string;
  groupName: string;
  status: GroupStatus;
  currency: Currency;
  claimable: bigint;
  collateral: bigint; // total locked (USDC + XLM buckets)
  unlockAt: number; // from the contract (Bug 1 fix — no local re-derivation)
  withdrawReady: boolean;
}

/** Groups can run on different currencies, so totals are kept per token. */
type Totals = { Usdc: bigint; Xlm: bigint };
const ZERO_TOTALS: Totals = { Usdc: 0n, Xlm: 0n };
function addTotal(t: Totals, currency: Currency, amount: bigint): Totals {
  return { ...t, [currency]: t[currency] + amount };
}
function fmtTotals(t: Totals): string {
  const parts: string[] = [];
  if (t.Usdc > 0n) parts.push(fmtAmount(t.Usdc, "Usdc"));
  if (t.Xlm > 0n) parts.push(fmtAmount(t.Xlm, "Xlm"));
  return parts.length ? parts.join(" + ") : fmtAmount(0n, "Usdc");
}

const KIND_LABEL: Record<string, string> = {
  join_req: "Join requested",
  join_ok: "Join approved",
  join_no: "Join rejected",
  joined: "Joined / locked",
  contrib: "Contribution",
  bid: "Bid placed",
  resolved: "Won the pot",
  default: "Default covered",
  withdraw: "Collateral out",
  started: "Group started",
  settled: "Settlement",
  liquid: "Liquidation",
  hf_warn: "Health warning",
  removed: "Removed",
  topup: "Collateral top-up",
};

export function Dashboard() {
  const { address, refreshBalance } = useWallet();
  const { views, loading, reload } = useGroups();
  const [rows, setRows] = useState<Row[]>([]);
  const [busy, setBusy] = useState(false);
  const [pending, setPending] = useState<Pending[]>([]);
  const [loadingPending, setLoadingPending] = useState(false);
  const [acting, setActing] = useState<string | null>(null);
  const [actError, setActError] = useState<string | null>(null);
  const [pendingApproval, setPendingApproval] = useState<GroupView[]>([]);

  useEffect(() => {
    if (!address || views.length === 0) {
      setRows([]);
      return;
    }
    let cancelled = false;
    (async () => {
      setBusy(true);
      const all: Row[] = [];
      await Promise.all(
        views.map(async (v) => {
          try {
            const hist = await group(v.id).getHistory();
            for (const h of hist) {
              if (h.actor === address) {
                all.push({
                  ...h,
                  groupId: v.id,
                  groupName: v.config.name,
                  currency: v.config.currency,
                });
              }
            }
          } catch {
            /* ignore a single group's failure */
          }
        })
      );
      all.sort((a, b) => Number(b.timestamp - a.timestamp));
      if (!cancelled) {
        setRows(all);
        setBusy(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [address, views]);

  // Aggregate claimable payouts + returnable collateral across my groups. The
  // unlock time comes straight from the contract so it can't disagree.
  useEffect(() => {
    if (!address || views.length === 0) {
      setPending([]);
      return;
    }
    let cancelled = false;
    (async () => {
      setLoadingPending(true);
      const now = Math.floor(Date.now() / 1000);
      const mine = views.filter((v) => v.members.some((m) => m.addr === address));
      const out = await Promise.all(
        mine.map(async (v) => {
          const client = group(v.id);
          let claimable = 0n;
          let unlockAt = 0;
          try {
            claimable = await client.getClaimable(address);
          } catch {
            /* nothing claimable */
          }
          try {
            unlockAt = Number(await client.collateralUnlockAt());
          } catch {
            /* leave 0 */
          }
          const me = v.members.find((m) => m.addr === address);
          const collateral = (me?.collateral_usdc ?? 0n) + (me?.collateral_xlm ?? 0n);
          const withdrawReady =
            v.state.status === "Completed" && unlockAt > 0 && now >= unlockAt;
          return {
            groupId: v.id,
            groupName: v.config.name,
            status: v.state.status,
            currency: v.config.currency,
            claimable,
            collateral,
            unlockAt,
            withdrawReady,
          } as Pending;
        })
      );
      if (!cancelled) {
        setPending(
          out.filter(
            (p) => p.claimable > 0n || (p.status === "Completed" && p.collateral > 0n)
          )
        );
        setLoadingPending(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [address, views]);

  // Groups I've requested to join but haven't been confirmed in yet.
  useEffect(() => {
    if (!address || views.length === 0) {
      setPendingApproval([]);
      return;
    }
    let cancelled = false;
    (async () => {
      const notMine = views.filter(
        (v) => !v.members.some((m) => m.addr === address) && v.state.status !== "Completed"
      );
      const results = await Promise.all(
        notMine.map(async (v) => {
          try {
            const req = await group(v.id).getJoinRequest(address);
            // Pending = requested and not yet rejected (approved-but-not-locked
            // still shows here until they lock collateral and become a member).
            if (req && !(req.resolved && !req.approved)) return v;
          } catch {
            /* ignore */
          }
          return null;
        })
      );
      if (!cancelled) {
        setPendingApproval(results.filter((v): v is GroupView => v !== null));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [address, views]);

  async function act(key: string, fn: () => Promise<unknown>) {
    setActing(key);
    setActError(null);
    try {
      await fn();
      await reload();
      await refreshBalance();
    } catch (e) {
      setActError(e instanceof Error ? e.message : String(e));
    } finally {
      setActing(null);
    }
  }

  const myGroups = views.filter(
    (v) => address && v.members.some((m) => m.addr === address)
  );
  const activeGroups = myGroups.filter((v) => v.state.status !== "Completed");
  const completedGroupsList = myGroups.filter((v) => v.state.status === "Completed");
  const wins = rows.filter((r) => r.kind === "resolved").length;
  const contributions = rows.filter((r) => r.kind === "contrib").length;
  const defaults = rows.filter((r) => r.kind === "default").length;
  const totalContributed = rows
    .filter((r) => r.kind === "contrib")
    .reduce((t, r) => addTotal(t, r.currency, r.amount), ZERO_TOTALS);
  const totalWon = rows
    .filter((r) => r.kind === "resolved")
    .reduce((t, r) => addTotal(t, r.currency, r.amount), ZERO_TOTALS);

  const availableNow = pending.reduce(
    (t, p) =>
      addTotal(t, p.currency, p.claimable + (p.withdrawReady ? p.collateral : 0n)),
    ZERO_TOTALS
  );

  if (!address) {
    return (
      <div className="center">
        <div>
          <h1>Dashboard</h1>
          <p className="muted">Connect your wallet to see your full activity history.</p>
        </div>
      </div>
    );
  }

  return (
    <div>
      <h1 style={{ marginBottom: 4 }}>Dashboard</h1>
      <p className="muted" style={{ marginTop: 0 }}>
        Your complete on-chain activity across every Plexa group.
      </p>

      <div className="grid cols-3" style={{ marginBottom: 8 }}>
        <Stat label="Groups joined" value={`${myGroups.length}`} />
        <Stat label="Pots won" value={`${wins}`} />
        <Stat label="Available to withdraw" value={fmtTotals(availableNow)} />
      </div>
      {defaults > 0 && (
        <div className="banner error">
          {defaults} contribution{defaults > 1 ? "s were" : " was"} covered from your collateral
          (default). Keep your balance topped up.
        </div>
      )}

      {/* ---------------------------------------------------------- Markets */}
      <div className="section-title">XLM market</div>
      <PriceChart />

      {/* -------------------------------------------------------- My Groups */}
      <div className="section-title">My groups</div>
      {loading ? (
        <div className="center muted">Loading your groups…</div>
      ) : (
        <>
          <MyGroupsBlock title="Active" empty="No active groups." groups={activeGroups} />
          {pendingApproval.length > 0 && (
            <MyGroupsBlock
              title="Pending approval"
              empty=""
              groups={pendingApproval}
            />
          )}
          {completedGroupsList.length > 0 && (
            <MyGroupsBlock title="Completed" empty="" groups={completedGroupsList} />
          )}
          {myGroups.length === 0 && pendingApproval.length === 0 && (
            <div className="card muted">
              You're not in any groups yet. <Link to="/app/groups">Browse or create a group</Link>{" "}
              to get started.
            </div>
          )}
        </>
      )}

      {/* --------------------------------------------------- Withdraw & claim */}
      <div className="section-title">Withdraw &amp; claim</div>
      {actError && <div className="banner error">{actError}</div>}
      {loading || loadingPending ? (
        <div className="center muted">Loading your balances…</div>
      ) : pending.length === 0 ? (
        <div className="card muted">
          Nothing to withdraw right now. Won pots and returned collateral will appear here.
        </div>
      ) : (
        <div className="grid cols-2">
          {pending.map((p) => (
            <div className="card" key={p.groupId}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                <Link to={`/app/group/${p.groupId}`}>
                  <strong>{p.groupName || shortAddr(p.groupId)}</strong>
                </Link>
                <span className="pill">{p.status}</span>
              </div>

              {p.claimable > 0n && (
                <div className="row between" style={{ marginTop: 10 }}>
                  <div>
                    <div className="muted">Payout ready</div>
                    <div className="stat">{fmtAmount(p.claimable, p.currency)}</div>
                  </div>
                  <button
                    className="btn primary"
                    disabled={acting === `claim-${p.groupId}`}
                    onClick={() =>
                      act(`claim-${p.groupId}`, () => group(p.groupId).claimPayout(address))
                    }
                  >
                    {acting === `claim-${p.groupId}` ? "Claiming…" : "Claim to wallet"}
                  </button>
                </div>
              )}

              {p.status === "Completed" && p.collateral > 0n && (
                <div className="row between" style={{ marginTop: 10 }}>
                  <div>
                    <div className="muted">Collateral</div>
                    <div className="stat">{fmtAmount(p.collateral, p.currency)}</div>
                  </div>
                  {p.withdrawReady ? (
                    <button
                      className="btn"
                      disabled={acting === `wd-${p.groupId}`}
                      onClick={() =>
                        act(`wd-${p.groupId}`, () => group(p.groupId).withdrawCollateral(address))
                      }
                    >
                      {acting === `wd-${p.groupId}` ? "Withdrawing…" : "Withdraw to wallet"}
                    </button>
                  ) : (
                    <div className="muted" style={{ textAlign: "right" }}>
                      Unlocks in <Countdown target={p.unlockAt} />
                      <div className="faint">settlement grace</div>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <div className="grid cols-3" style={{ marginTop: 16, marginBottom: 8 }}>
        <Stat label={`Contributions made (${contributions})`} value={fmtTotals(totalContributed)} />
        <Stat label="Total payout received" value={fmtTotals(totalWon)} />
        <Stat label="Completed groups" value={`${completedGroupsList.length}`} />
      </div>

      <div className="section-title">Activity history</div>
      {loading || busy ? (
        <div className="center muted">Loading your history…</div>
      ) : rows.length === 0 ? (
        <div className="card muted">
          No activity yet. <Link to="/app/groups">Join or create a group</Link> to get started.
        </div>
      ) : (
        <table className="list">
          <thead>
            <tr>
              <th>When</th>
              <th>Action</th>
              <th>Group</th>
              <th>Period</th>
              <th>Amount</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={i}>
                <td className="faint">
                  {new Date(Number(r.timestamp) * 1000).toLocaleString()}
                </td>
                <td>
                  <span className="pill">{KIND_LABEL[r.kind] ?? r.kind}</span>
                </td>
                <td>
                  <Link to={`/app/group/${r.groupId}`}>{r.groupName || shortAddr(r.groupId)}</Link>
                </td>
                <td>{r.period}</td>
                <td>{r.amount > 0n ? fmtAmount(r.amount, r.currency) : "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

function MyGroupsBlock({
  title,
  empty,
  groups,
}: {
  title: string;
  empty: string;
  groups: GroupView[];
}) {
  if (groups.length === 0 && !empty) return null;
  return (
    <div style={{ marginBottom: 8 }}>
      <div className="muted" style={{ margin: "6px 0" }}>
        {title} <span className="faint">· {groups.length}</span>
      </div>
      {groups.length === 0 ? (
        <div className="card muted">{empty}</div>
      ) : (
        <div className="grid cols-3">
          {groups.map((g) => (
            <GroupCard key={g.id} g={g} youAreMember={title !== "Pending approval"} />
          ))}
        </div>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="card">
      <div className="muted">{label}</div>
      <div className="stat">{value}</div>
    </div>
  );
}
