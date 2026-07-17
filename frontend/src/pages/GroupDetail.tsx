import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import { useWallet } from "../context/WalletContext";
import { group, xlmPrice } from "../lib/contracts";
import {
  fmtUsdc,
  fmtXlm,
  fmtAmount,
  currencyLabel,
  shortAddr,
  usdcToUnits,
  xlmValueInUsdc,
  fmtHealthFactor,
} from "../lib/format";
import { Countdown } from "../components/Countdown";
import { usePeriodClock } from "../lib/usePeriodClock";
import { notify } from "../lib/notify";
import type {
  GroupConfig,
  GroupState,
  Member,
  Bid,
  JoinRequest,
  HistoryEntry,
  Phase,
  CollateralAsset,
} from "../types";

/** Poll cadence while a group is live (leaderboard, paid flags, resolves). */
const POLL_MS = 10_000;

interface Loaded {
  config: GroupConfig;
  state: GroupState;
  members: Member[];
  phase: Phase;
  claimable: bigint;
  bid: Bid | null;
  history: HistoryEntry[];
  pending: { addr: string; req: JoinRequest | null }[];
  myReq: JoinRequest | null;
  settled: boolean; // current period settled?
  unlockAt: number; // collateral unlock ts (from contract)
  price: bigint; // live XLM price (USDC per XLM, 7dp)
  reqUsdc: bigint; // USDC collateral to lock
  reqXlm: bigint; // XLM collateral to lock (oracle-sized)
  myHf: number | null; // my health factor (10_000 = 1.0) or null (USDC)
}

export function GroupDetail() {
  const { id = "" } = useParams();
  const { address, refreshBalance } = useWallet();
  const g = useMemo(() => group(id), [id]);
  const [data, setData] = useState<Loaded | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [bidInput, setBidInput] = useState("");
  const [lockAsset, setLockAsset] = useState<CollateralAsset>("Usdc");
  const [topUpAmount, setTopUpAmount] = useState("");
  const [topUpAsset, setTopUpAsset] = useState<CollateralAsset>("Usdc");
  // Period numbers we've already auto-submitted settle/resolve for.
  const autoResolved = useRef(0);
  const autoSettled = useRef(0);
  // One-shot notification guards.
  const hfNotified = useRef(0);
  const collNotified = useRef(false);

  const load = useCallback(async () => {
    try {
      const [config, state, members, phase, bid, history, pendingIds] = await Promise.all([
        g.getConfig(),
        g.getState(),
        g.getMembers(),
        g.getPhase(),
        g.getCurrentBid(),
        g.getHistory(),
        g.getPendingJoins(),
      ]);
      const claimable = address ? await g.getClaimable(address) : 0n;
      const myReq = address ? await g.getJoinRequest(address) : null;
      const pending = await Promise.all(
        pendingIds.map(async (addr) => ({ addr, req: await g.getJoinRequest(addr) }))
      );
      // XLM groups take same-asset collateral only, so the USDC quote is
      // meaningless there (and the contract rejects asset 0).
      const xlmGroup = config.currency === "Xlm";
      const [settled, unlockAtRaw, price, reqUsdc, reqXlm] = await Promise.all([
        state.status === "Active" ? g.getSettled(state.current_period) : Promise.resolve(false),
        g.collateralUnlockAt(),
        xlmPrice(),
        xlmGroup ? Promise.resolve(0n) : g.requiredCollateral("Usdc"),
        g.requiredCollateral("Xlm"),
      ]);
      const me = address ? members.find((m) => m.addr === address) : undefined;
      // Health factors only exist for cross-asset collateral (XLM in a USDC group).
      const myHf =
        me && !xlmGroup && me.collateral_asset === "Xlm" && address
          ? await g.healthFactor(address)
          : null;
      setData({
        config,
        state,
        members,
        phase,
        claimable,
        bid,
        history,
        pending,
        myReq,
        settled,
        unlockAt: Number(unlockAtRaw),
        price,
        reqUsdc,
        reqXlm,
        myHf,
      });
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, [g, address]);

  useEffect(() => {
    void load();
  }, [load]);

  // Authoritative live clock derived from on-chain start_time.
  const clock = usePeriodClock(data?.config ?? null, data?.state ?? null);

  // Poll while the group is live so bids / paid flags / resolves from other
  // members appear without a refresh (Soroban RPC has no push channel).
  const status = data?.state.status;
  useEffect(() => {
    if (status !== "Active" && status !== "Forming") return;
    const t = setInterval(() => void load(), POLL_MS);
    return () => clearInterval(t);
  }, [status, load]);

  // Refresh data the moment the phase flips so windows open/close crisply.
  const livePhase = clock?.phase;
  const liveBefore = clock?.beforeStart;
  useEffect(() => {
    if (livePhase !== undefined) void load();
  }, [livePhase, liveBefore, load]);

  const run = useCallback(
    async (key: string, fn: () => Promise<unknown>) => {
      setBusy(key);
      setError(null);
      try {
        await fn();
        await load();
        await refreshBalance();
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      } finally {
        setBusy(null);
      }
    },
    [load, refreshBalance]
  );

  const members = data?.members ?? [];
  const isMember = !!address && members.some((m) => m.addr === address);

  // ---- Automatic settlement. When the settlement window opens and nobody has
  // settled the period yet, the first member online signs settle() so the
  // auction starts from a finalized pool. Races are harmless (idempotent).
  useEffect(() => {
    if (!data || !clock || !address || !isMember || busy) return;
    if (data.state.status !== "Active" || !clock.settleDue || data.settled) return;
    const period = data.state.current_period;
    if (autoSettled.current >= period) return;
    autoSettled.current = period;
    void (async () => {
      setBusy("settle");
      try {
        await g.settle(address);
        notify("Settlement Complete", `Period ${period} pool finalized — auction can begin.`, "success");
      } catch {
        // Another member likely settled first — fine.
      } finally {
        setBusy(null);
        await load();
        await refreshBalance();
      }
    })();
  }, [data, clock, address, isMember, busy, g, load, refreshBalance]);

  // ---- Automatic period advancement. The chain can't schedule its own
  // transactions, so the first member online after the auction window closes
  // auto-submits resolve_period (they sign once). Races are fine.
  useEffect(() => {
    if (!data || !clock || !address || !isMember || busy) return;
    if (data.state.status !== "Active" || !clock.resolveDue) return;
    const period = data.state.current_period;
    if (autoResolved.current >= period) return;
    autoResolved.current = period;
    notify("Auction Closed", `Resolving period ${period} — please sign to advance the group.`, "info");
    void (async () => {
      setBusy("resolve");
      try {
        await g.resolvePeriod(address);
        notify("Period Completed", `Period ${period} resolved — winner selected.`, "success");
      } catch (e) {
        try {
          const st = await g.getState();
          if (st.status === "Active" && st.current_period === period) {
            setError(e instanceof Error ? e.message : String(e));
          }
        } catch {
          setError(e instanceof Error ? e.message : String(e));
        }
      } finally {
        setBusy(null);
        await load();
        await refreshBalance();
      }
    })();
  }, [data, clock, address, isMember, busy, g, load, refreshBalance]);

  // Health-factor warning for the connected XLM-collateral member (once per breach).
  useEffect(() => {
    if (!data || !address) return;
    const meRec = data.members.find((m) => m.addr === address);
    if (!meRec || meRec.collateral_asset !== "Xlm") return;
    const bp = meRec.hf_breach_period;
    if (bp !== 0 && hfNotified.current !== bp) {
      hfNotified.current = bp;
      notify(
        "Health Factor Warning",
        "Your XLM collateral fell below the required level — top up before the next settlement or you'll be removed.",
        "warn"
      );
    }
  }, [data, address]);

  // Collateral-available notification (once, when it unlocks).
  useEffect(() => {
    if (!data || !address) return;
    const meRec = data.members.find((m) => m.addr === address);
    if (!meRec) return;
    const total = meRec.collateral_usdc + meRec.collateral_xlm;
    const ready = data.unlockAt > 0 && Math.floor(Date.now() / 1000) >= data.unlockAt;
    if (data.state.status === "Completed" && ready && total > 0n && !collNotified.current) {
      collNotified.current = true;
      notify("Collateral Available", "Your collateral is unlocked and ready to withdraw.", "success");
    }
  }, [data, address]);

  if (error && !data) return <div className="banner error">{error}</div>;
  if (!data || !clock) return <div className="center muted">Loading group…</div>;

  const { config, state, claimable, bid, history, pending, myReq, price } = data;
  const cur = config.currency; // group currency, "Usdc" | "Xlm"
  const xlmGroup = cur === "Xlm";
  const inCur = (units: bigint) => fmtAmount(units, cur);
  const me = members.find((m) => m.addr === address);
  const isOwner = address === config.owner;
  const approvedToLock = isOwner || (!!myReq && myReq.resolved && myReq.approved);
  const pendingVote = !!myReq && !myReq.resolved;
  const myHasWon = me?.has_won ?? false;
  const myRemoved = me?.removed ?? false;
  const phase = clock.phase;

  // ---- Contribution progress for the current period.
  const period = state.current_period;
  const paidSet = new Set(
    history.filter((h) => h.kind === "contrib" && h.period === period).map((h) => h.actor)
  );
  const paidCount = members.filter((m) => paidSet.has(m.addr)).length;
  const myContributed = !!address && paidSet.has(address);

  // ---- Leaderboard from on-chain bid history.
  const bidsThisPeriod = history.filter((h) => h.kind === "bid" && h.period === period);
  const bestByMember = new Map<string, bigint>();
  for (const b of bidsThisPeriod) {
    const cur = bestByMember.get(b.actor) ?? 0n;
    if (b.amount > cur) bestByMember.set(b.actor, b.amount);
  }
  const leaderboard = [...bestByMember.entries()].sort((a, b) => (b[1] > a[1] ? 1 : -1));
  const eligibleBidders = members.filter((m) => !m.has_won && !m.removed);

  // ---- Most recent winner.
  const lastResolved = [...history].reverse().find((h) => h.kind === "resolved");
  const winnerDiscount = lastResolved
    ? history
        .filter((h) => h.kind === "bid" && h.period === lastResolved.period)
        .reduce((max, h) => (h.amount > max ? h.amount : max), 0n)
    : 0n;
  const showWinnerCard =
    !!lastResolved &&
    (state.status === "Completed" ||
      clock.beforeStart ||
      lastResolved.period === period - 1 ||
      state.status === "Active");

  const remainingPeriods = config.target_members - state.completed_periods;
  const canAct = state.status !== "Completed";

  // Collateral unlock time comes straight from the contract (Bug 1 fix): the UI
  // no longer re-derives the grace rule, so it can't disagree with on-chain.
  const collateralUnlockAt = data.unlockAt;
  const collateralReady = collateralUnlockAt > 0 && clock.now >= collateralUnlockAt;
  const myCollateralTotal = (me?.collateral_usdc ?? 0n) + (me?.collateral_xlm ?? 0n);

  // Health factor state for the connected member (XLM collateral only).
  const hfBelow1 = data.myHf !== null && data.myHf < 10_000;
  const hfBreached = (me?.hf_breach_period ?? 0) !== 0;

  return (
    <div>
      {error && <div className="banner error">{error}</div>}

      <div className="row between wrap" style={{ marginBottom: 14 }}>
        <div>
          <h1 style={{ marginBottom: 4 }}>{config.name}</h1>
          <p className="muted" style={{ margin: 0, maxWidth: 620 }}>
            {config.description}
          </p>
        </div>
        <div className="row">
          <span className="pill amber">{currencyLabel(cur)}</span>
          <span className="pill">{config.visibility}</span>
          <span
            className={`pill ${
              state.status === "Active" ? "green" : state.status === "Completed" ? "purple" : "amber"
            }`}
          >
            {state.status}
          </span>
        </div>
      </div>

      {/* Health-factor warning for the connected XLM-collateral member. */}
      {isMember && !myRemoved && hfBelow1 && (
        <div className="banner error">
          ⚠ Your health factor is {data.myHf !== null ? fmtHealthFactor(data.myHf) : "—"} (below
          1.00). {hfBreached
            ? "You have until the next settlement to top up your collateral, or you'll be removed and liquidated."
            : "Top up your XLM or USDC collateral to stay above 1.00."}
        </div>
      )}
      {isMember && myRemoved && (
        <div className="banner error">
          You were removed from this group after your collateral fell below the required health
          factor for a full cycle. Your remaining collateral was liquidated per protocol rules.
        </div>
      )}

      <div className="split">
        <div>
          {/* ----------------------------------------------- status / period */}
          <div className="card pad-lg">
            {state.status === "Forming" && <FormingPanel config={config} members={members} />}
            {state.status === "Active" && (
              <>
                <div className="row between">
                  <div className="muted">
                    Period <b style={{ color: "var(--text)" }}>{period}</b> of{" "}
                    {config.target_members}
                  </div>
                  <div className="muted">
                    {state.members_won} won · {remainingPeriods} period
                    {remainingPeriods === 1 ? "" : "s"} remaining
                  </div>
                </div>

                {clock.beforeStart ? (
                  <div className="row between" style={{ marginTop: 12 }}>
                    <div className="muted">Payout window — Period {period} starts in</div>
                    <Countdown target={clock.periodStart} />
                  </div>
                ) : (
                  <>
                    <div className="phase-track">
                      {(["Contribution", "Settlement", "Auction", "Payout"] as Phase[]).map((p) => (
                        <div key={p} className={`seg ${phase === p ? "on" : ""}`}>
                          {p}
                        </div>
                      ))}
                    </div>
                    <div className="progressbar">
                      <div style={{ width: `${Math.round(clock.progress * 100)}%` }} />
                    </div>
                    <div className="row between">
                      <div className="muted">{phase} window ends in</div>
                      <Countdown target={clock.countdownTarget} />
                    </div>
                  </>
                )}

                {phase === "Settlement" && (
                  <div className="banner info" style={{ marginBottom: 0, marginTop: 12 }}>
                    {data.settled
                      ? "✓ Settlement complete — the contribution pool is finalized for this period."
                      : busy === "settle"
                        ? "⏳ Running settlement — verifying contributions and liquidating misses…"
                        : "Settlement window open. Contributions are being verified before the auction."}
                  </div>
                )}

                {clock.resolveDue && (
                  <div className="banner info" style={{ marginBottom: 0, marginTop: 12 }}>
                    {busy === "resolve"
                      ? "⏳ Advancing period — selecting the winner on-chain…"
                      : "Auction closed. Waiting for a member to sign the period resolution."}
                  </div>
                )}
              </>
            )}
            {state.status === "Completed" && (
              <div className="banner info" style={{ margin: 0 }}>
                🎉 ROSCA Cycle Completed — every member has won once. Claim any remaining payout,
                then withdraw collateral (unlocks after the settlement grace).
              </div>
            )}
          </div>

          {/* ----------------------------------------------- winner */}
          {showWinnerCard && lastResolved && (
            <div className="card" style={{ marginTop: 16 }}>
              <div className="section-title" style={{ marginTop: 0 }}>
                Latest Winner — Period {lastResolved.period}
              </div>
              <div className="row between wrap">
                <div>
                  <div className="muted">Winner</div>
                  <div className="stat" style={{ fontSize: 20 }}>
                    {shortAddr(lastResolved.actor)}
                    {lastResolved.actor === address && (
                      <span className="pill green" style={{ marginLeft: 8 }}>
                        you 🎉
                      </span>
                    )}
                  </div>
                </div>
                <div>
                  <div className="muted">Winning discount</div>
                  <div className="stat" style={{ fontSize: 20 }}>
                    {winnerDiscount > 0n ? inCur(winnerDiscount) : "— (random pick)"}
                  </div>
                </div>
                <div style={{ textAlign: "right" }}>
                  <div className="muted">Payout credited</div>
                  <div className="stat" style={{ fontSize: 20 }}>{inCur(lastResolved.amount)}</div>
                </div>
              </div>
            </div>
          )}

          {/* ----------------------------------------------- auction */}
          {state.status === "Active" && !clock.beforeStart && (
            <div className="card" style={{ marginTop: 16 }}>
              <div className="row between">
                <div className="section-title" style={{ marginTop: 0 }}>
                  Live Auction
                </div>
                <div className="faint">
                  {bidsThisPeriod.length} bid{bidsThisPeriod.length === 1 ? "" : "s"} ·{" "}
                  {eligibleBidders.length} eligible bidder
                  {eligibleBidders.length === 1 ? "" : "s"}
                </div>
              </div>
              <div className="row between">
                <div>
                  <div className="muted">Leading discount</div>
                  <div className="stat">{bid ? inCur(bid.discount) : "—"}</div>
                  {bid && <div className="faint">by {shortAddr(bid.bidder)}</div>}
                </div>
                <div style={{ textAlign: "right" }}>
                  <div className="muted">If you win, you receive</div>
                  <div className="stat">{inCur(config.pot_size - (bid?.discount ?? 0n))}</div>
                </div>
              </div>

              {leaderboard.length > 0 && (
                <>
                  <div className="section-title">Leaderboard</div>
                  <table className="list">
                    <tbody>
                      {leaderboard.map(([who, amt], i) => (
                        <tr key={who}>
                          <td style={{ width: 34 }} className="faint">
                            #{i + 1}
                          </td>
                          <td>
                            {shortAddr(who)}
                            {who === address && <span className="faint"> · you</span>}
                          </td>
                          <td style={{ textAlign: "right" }}>
                            {inCur(amt)}
                            {i === 0 && (
                              <span className="pill green" style={{ marginLeft: 8 }}>
                                leading
                              </span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </>
              )}

              {isMember && !myHasWon && !myRemoved && phase === "Auction" && (
                <div className="row" style={{ marginTop: 14 }}>
                  <input
                    type="number"
                    placeholder={
                      bid
                        ? `Beat ${inCur(bid.discount)} to lead`
                        : `Discount in ${currencyLabel(cur)} (higher leads)`
                    }
                    value={bidInput}
                    onChange={(e) => setBidInput(e.target.value)}
                  />
                  <button
                    className="btn primary"
                    disabled={busy === "bid" || !bidInput}
                    onClick={() =>
                      run("bid", () => g.placeBid(address!, usdcToUnits(bidInput))).then(() =>
                        setBidInput("")
                      )
                    }
                  >
                    {busy === "bid" ? "Bidding…" : "Place Bid"}
                  </button>
                </div>
              )}
              {isMember && !myHasWon && !myRemoved && phase !== "Auction" && (
                <div className="muted" style={{ marginTop: 10 }}>
                  Bidding opens during the Auction window (after settlement).
                </div>
              )}
              {myHasWon && (
                <div className="muted" style={{ marginTop: 10 }}>
                  You've already won this cycle — you can't bid again.
                </div>
              )}
            </div>
          )}

          {/* ----------------------------------------------- members */}
          <div className="card" style={{ marginTop: 16 }}>
            <div className="row between">
              <div className="section-title" style={{ marginTop: 0 }}>
                Members ({members.length}/{config.target_members})
              </div>
              {state.status !== "Completed" && (
                <div className="faint">
                  Paid this period: {paidCount} / {members.length}
                </div>
              )}
            </div>
            <table className="list">
              <thead>
                <tr>
                  <th>Member</th>
                  <th>Collateral</th>
                  {state.status !== "Completed" && <th>Contribution</th>}
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {members.map((m) => (
                  <tr key={m.addr}>
                    <td>
                      {shortAddr(m.addr)}
                      {m.addr === config.owner && <span className="faint"> · owner</span>}
                      {m.addr === address && <span className="faint"> · you</span>}
                    </td>
                    <td>
                      <CollateralCell m={m} price={price} xlmGroup={xlmGroup} />
                    </td>
                    {state.status !== "Completed" && (
                      <td>
                        {m.removed ? (
                          <span className="faint">—</span>
                        ) : paidSet.has(m.addr) ? (
                          <span className="pill green">paid</span>
                        ) : (
                          <span className="pill amber">unpaid</span>
                        )}
                      </td>
                    )}
                    <td>
                      {m.removed && <span className="pill red">removed</span>}
                      {!m.removed && m.has_won && <span className="pill purple">won</span>}{" "}
                      {!m.removed && m.in_default && <span className="pill red">default</span>}
                      {!m.removed && !m.has_won && !m.in_default && (
                        <span className="pill green">active</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* ----------------------------------------------- governance */}
          <GovernancePanel
            pending={pending}
            history={history}
            currency={cur}
            isMember={isMember}
            address={address}
            busy={busy}
            onVote={(applicant, approve) =>
              run(`vote-${applicant}`, () => g.voteOnJoin(address!, applicant, approve))
            }
          />
        </div>

        {/* ------------------------------------------------- action sidebar */}
        <div className="card" style={{ position: "sticky", top: 20 }}>
          <div className="section-title" style={{ marginTop: 0 }}>
            Your Actions
          </div>

          {!address && <p className="muted">Connect your wallet to participate.</p>}

          {address && (
            <>
              <div className="summary-row">
                <span className="k">Group currency</span>
                <span className="v">{currencyLabel(cur)}</span>
              </div>
              <div className="summary-row">
                <span className="k">Pending balance</span>
                <span className="v">{inCur(claimable)}</span>
              </div>
              <div className="summary-row">
                <span className="k">Total pot</span>
                <span className="v">{inCur(config.pot_size)}</span>
              </div>
              {me && me.collateral_asset === "Xlm" && data.myHf !== null && (
                <div className="summary-row">
                  <span className="k">Health factor</span>
                  <span className={`v ${hfBelow1 ? "danger-text" : ""}`}>
                    {fmtHealthFactor(data.myHf)}
                  </span>
                </div>
              )}
              {state.status === "Active" && (
                <div className="summary-row">
                  <span className="k">Periods remaining</span>
                  <span className="v">{remainingPeriods}</span>
                </div>
              )}
            </>
          )}

          <div style={{ display: "grid", gap: 10, marginTop: 16 }}>
            {/* Join flow */}
            {address && !isMember && canAct && (
              <>
                {pendingVote && (
                  <div className="banner info" style={{ margin: 0 }}>
                    Join request pending — {myReq!.yes_votes} yes / {myReq!.no_votes} no.
                  </div>
                )}
                {!pendingVote && approvedToLock && (
                  <>
                    <div className="field" style={{ marginBottom: 4 }}>
                      <span className="muted" style={{ fontSize: 13 }}>
                        Collateral asset
                      </span>
                      {xlmGroup ? (
                        <select value="Xlm" disabled>
                          <option value="Xlm">XLM — 100% of pot ({fmtXlm(data.reqXlm)})</option>
                        </select>
                      ) : (
                        <select
                          value={lockAsset}
                          onChange={(e) => setLockAsset(e.target.value as CollateralAsset)}
                        >
                          <option value="Usdc">USDC — 100% of pot ({fmtUsdc(data.reqUsdc)})</option>
                          <option value="Xlm">XLM — 150% of pot (≈ {fmtXlm(data.reqXlm)})</option>
                        </select>
                      )}
                    </div>
                    <button
                      className="btn primary"
                      disabled={busy === "lock"}
                      onClick={() =>
                        run("lock", () => g.lockCollateral(address, xlmGroup ? "Xlm" : lockAsset))
                      }
                    >
                      {busy === "lock"
                        ? "Locking…"
                        : !xlmGroup && lockAsset === "Usdc"
                          ? `Lock ${fmtUsdc(data.reqUsdc)}`
                          : `Lock ${fmtXlm(data.reqXlm)}`}
                    </button>
                  </>
                )}
                {!pendingVote && !approvedToLock && (
                  <button
                    className="btn primary"
                    disabled={busy === "join"}
                    onClick={() => run("join", () => g.requestJoin(address))}
                  >
                    {busy === "join" ? "Requesting…" : "Join Now"}
                  </button>
                )}
              </>
            )}

            {/* Member actions */}
            {isMember && !myRemoved && (
              <>
                {canAct &&
                  (state.status === "Forming" ||
                    (phase === "Contribution" && !clock.beforeStart)) &&
                  (myContributed ? (
                    <div className="pill green">Contribution paid this period</div>
                  ) : (
                    <button
                      className="btn primary"
                      disabled={busy === "contribute"}
                      onClick={() => run("contribute", () => g.contribute(address!))}
                    >
                      {busy === "contribute"
                        ? "Paying…"
                        : `Deposit Contribution (${inCur(config.contribution_amount)})`}
                    </button>
                  ))}

                {/* Settlement: permissionless, offered during the window. */}
                {clock.settleDue && !data.settled && busy !== "settle" && (
                  <button className="btn" onClick={() => run("settle", () => g.settle(address!))}>
                    Run Settlement
                  </button>
                )}

                {/* Top-up collateral (any member, before completion). */}
                {canAct && (
                  <div className="field" style={{ marginTop: 4 }}>
                    <span className="muted" style={{ fontSize: 13 }}>
                      Top up collateral {hfBelow1 && <b className="danger-text">· HF low</b>}
                    </span>
                    <div className="row">
                      <input
                        type="number"
                        placeholder="Amount"
                        value={topUpAmount}
                        onChange={(e) => setTopUpAmount(e.target.value)}
                      />
                      {xlmGroup ? (
                        <select value="Xlm" disabled>
                          <option value="Xlm">XLM</option>
                        </select>
                      ) : (
                        <select
                          value={topUpAsset}
                          onChange={(e) => setTopUpAsset(e.target.value as CollateralAsset)}
                        >
                          <option value="Usdc">USDC</option>
                          <option value="Xlm">XLM</option>
                        </select>
                      )}
                    </div>
                    <button
                      className="btn sm"
                      disabled={busy === "topup" || !topUpAmount}
                      onClick={() =>
                        run("topup", () =>
                          g.topUp(address!, xlmGroup ? "Xlm" : topUpAsset, usdcToUnits(topUpAmount))
                        ).then(() => setTopUpAmount(""))
                      }
                    >
                      {busy === "topup" ? "Adding…" : "Add Collateral"}
                    </button>
                  </div>
                )}

                {clock.resolveDue && busy !== "resolve" && (
                  <button
                    className="btn"
                    onClick={() => {
                      autoResolved.current = period;
                      void run("resolve", () => g.resolvePeriod(address!));
                    }}
                  >
                    Resolve Now (fallback)
                  </button>
                )}

                {claimable > 0n && (
                  <button
                    className="btn primary"
                    disabled={busy === "claim"}
                    onClick={() => run("claim", () => g.claimPayout(address!))}
                  >
                    {busy === "claim" ? "Claiming…" : `Claim Payout (${inCur(claimable)})`}
                  </button>
                )}

                {state.status === "Completed" &&
                  myCollateralTotal > 0n &&
                  (collateralReady ? (
                    <button
                      className="btn"
                      disabled={busy === "withdraw"}
                      onClick={() => run("withdraw", () => g.withdrawCollateral(address!))}
                    >
                      {busy === "withdraw" ? "Withdrawing…" : "Claim Collateral"}
                    </button>
                  ) : (
                    <div className="banner info" style={{ margin: 0 }}>
                      Collateral unlocks in <Countdown target={collateralUnlockAt} />
                      <div className="faint">settlement grace period</div>
                    </div>
                  ))}
              </>
            )}

            {/* Removed member can still reclaim any leftover collateral. */}
            {isMember &&
              myRemoved &&
              state.status === "Completed" &&
              myCollateralTotal > 0n &&
              collateralReady && (
                <button
                  className="btn"
                  disabled={busy === "withdraw"}
                  onClick={() => run("withdraw", () => g.withdrawCollateral(address!))}
                >
                  {busy === "withdraw" ? "Withdrawing…" : "Claim Remaining Collateral"}
                </button>
              )}
          </div>

          <div className="section-title">Invite link</div>
          <input readOnly value={window.location.href} onFocus={(e) => e.target.select()} />
        </div>
      </div>
    </div>
  );
}

// --------------------------------------------------------------- sub-panels
function CollateralCell({
  m,
  price,
  xlmGroup,
}: {
  m: Member;
  price: bigint;
  xlmGroup: boolean;
}) {
  // Same-asset collateral in an XLM group — no USDC conversion to show.
  if (xlmGroup) return <div>{fmtXlm(m.collateral_xlm)}</div>;
  if (m.collateral_asset === "Xlm") {
    const value = xlmValueInUsdc(m.collateral_xlm, price);
    return (
      <div>
        <div>{fmtXlm(m.collateral_xlm)}</div>
        <div className="faint" style={{ fontSize: 12 }}>
          ≈ {fmtUsdc(value)} · XLM
          {m.collateral_usdc > 0n && ` · +${fmtUsdc(m.collateral_usdc)}`}
        </div>
      </div>
    );
  }
  return <div>{fmtUsdc(m.collateral_usdc)}</div>;
}

function FormingPanel({ config, members }: { config: GroupConfig; members: Member[] }) {
  const locked = members.length;
  return (
    <div>
      <div className="row between">
        <div className="muted">Waiting to fill — auto-starts when full & funded</div>
        <span className="countdown">
          {locked}/{config.target_members}
        </span>
      </div>
      <p className="muted" style={{ marginBottom: 0 }}>
        The clock starts automatically the instant all {config.target_members} members have
        joined, locked their collateral, and paid the first contribution. No fixed start date.
      </p>
    </div>
  );
}

function GovernancePanel({
  pending,
  history,
  currency,
  isMember,
  address,
  busy,
  onVote,
}: {
  pending: { addr: string; req: JoinRequest | null }[];
  history: HistoryEntry[];
  currency: CollateralAsset;
  isMember: boolean;
  address: string | null;
  busy: string | null;
  onVote: (applicant: string, approve: boolean) => void;
}) {
  return (
    <div className="card" style={{ marginTop: 16 }}>
      <div className="section-title" style={{ marginTop: 0 }}>
        Governance & History
      </div>

      {pending.length > 0 && (
        <>
          <div className="muted" style={{ marginBottom: 8 }}>
            Pending join requests
          </div>
          {pending.map(({ addr, req }) => {
            const alreadyVoted = !!(address && req?.voters?.includes(address));
            const isSelf = addr === address;
            return (
              <div className="row between" key={addr} style={{ marginBottom: 8 }}>
                <span>
                  {shortAddr(addr)}{" "}
                  <span className="faint">
                    {req ? `· ${req.yes_votes} yes / ${req.no_votes} no` : ""}
                  </span>
                </span>
                {isMember && !isSelf && !alreadyVoted ? (
                  <span className="row">
                    <button
                      className="btn sm"
                      disabled={busy === `vote-${addr}`}
                      onClick={() => onVote(addr, true)}
                    >
                      Approve
                    </button>
                    <button
                      className="btn sm danger"
                      disabled={busy === `vote-${addr}`}
                      onClick={() => onVote(addr, false)}
                    >
                      Reject
                    </button>
                  </span>
                ) : (
                  <span className="faint">{alreadyVoted ? "voted" : ""}</span>
                )}
              </div>
            );
          })}
          <div className="section-title">Activity log</div>
        </>
      )}

      {history.length === 0 ? (
        <p className="muted">No activity yet.</p>
      ) : (
        <table className="list">
          <tbody>
            {[...history].reverse().map((h, i) => (
              <tr key={i}>
                <td style={{ width: 90 }}>
                  <span className="pill">{labelFor(h.kind)}</span>
                </td>
                <td>
                  <div>{h.detail}</div>
                  <div className="faint" style={{ fontSize: 12 }}>
                    {shortAddr(h.actor)} · period {h.period}
                    {h.amount > 0n ? ` · ${fmtAmount(h.amount, currency)}` : ""}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

function labelFor(kind: string): string {
  const map: Record<string, string> = {
    join_req: "join req",
    join_ok: "approved",
    join_no: "rejected",
    joined: "joined",
    contrib: "contrib",
    bid: "bid",
    resolved: "resolved",
    default: "default",
    withdraw: "withdraw",
    started: "started",
    settled: "settled",
    liquid: "liquidated",
    hf_warn: "HF warning",
    removed: "removed",
    topup: "top-up",
  };
  return map[kind] ?? kind;
}
