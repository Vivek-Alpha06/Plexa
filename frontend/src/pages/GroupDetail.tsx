import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import { useWallet } from "../context/WalletContext";
import { factory, group, xlmPrice } from "../lib/contracts";
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
import { TxReceipts, TxHashLink } from "../components/TxReceipts";
import { fetchOnChainTxs, buildTxIndex, type TxIndex } from "../lib/txlog";
import { DEMO } from "../lib/config";
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
/**
 * How long past the auction close before we stop saying "the keeper is on it"
 * and admit it isn't. Generous enough to absorb a late cron tick.
 */
const KEEPER_OVERDUE = 10 * 60;

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
  const [topUpAmount, setTopUpAmount] = useState("");
  const [topUpAsset, setTopUpAsset] = useState<CollateralAsset>("Usdc");
  // One-shot notification guards.
  const hfNotified = useRef(0);
  const collNotified = useRef(false);

  // Is this group registered in the configured factory?
  //
  // Anyone can deploy the official group wasm naming a factory they control,
  // which makes them its upgrade authority — and the deployed code is
  // byte-identical, so a wasm-hash check does not reveal it. Registry
  // membership is the only signal that distinguishes a real group from a
  // look-alike, and it must be checked before anyone is invited to fund one.
  const [registered, setRegistered] = useState<boolean | null>(null);
  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    void factory
      .isGroup(id)
      .then((ok) => !cancelled && setRegistered(ok))
      // Unknown is not the same as unsafe: on an RPC failure stay silent
      // rather than crying wolf at a legitimate group.
      .catch(() => !cancelled && setRegistered(null));
    return () => {
      cancelled = true;
    };
  }, [id]);

  // Pairs each on-chain history entry with the transaction that produced it,
  // so every row in the activity log is independently verifiable.
  const [txIndex, setTxIndex] = useState<TxIndex | null>(null);
  useEffect(() => {
    if (DEMO || !id) return;
    let cancelled = false;
    const refresh = () => {
      void fetchOnChainTxs(id, 200)
        .then((evs) => {
          if (!cancelled) setTxIndex(buildTxIndex(evs));
        })
        .catch(() => {
          // Rows fall back to "…"; never block the page on the indexer.
        });
    };
    refresh();
    window.addEventListener("plexa:tx", refresh);
    return () => {
      cancelled = true;
      window.removeEventListener("plexa:tx", refresh);
    };
  }, [id]);

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
      // Every write funnels through here, so this is the one place the registry
      // check can be enforced rather than merely displayed. An unregistered
      // group may run byte-identical code while pointing `config.factory` at a
      // contract the deployer controls — which hands them upgrade rights over,
      // and therefore the ability to drain, everything members put in. Warning
      // and still letting the transaction through is not a mitigation.
      if (registered === false) {
        setError(
          "This group is not registered with Plexa's factory. Transactions are blocked because upgrade control over your funds may belong to whoever deployed it."
        );
        return;
      }
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
    [load, refreshBalance, registered]
  );

  const members = data?.members ?? [];
  const isMember = !!address && members.some((m) => m.addr === address);

  // ---- Settlement and period advancement are NOT done here.
  //
  // They used to be: whichever member had the page open signed settle() and
  // resolve_period(). That made everyone's funds hostage to one person being
  // online, and every open tab raced to submit the same transaction — only one
  // could win, so the rest surfaced a confusing "transaction failed".
  //
  // Both calls are permissionless on the contract, so the keeper (see
  // `keeper/keeper.mjs`) drives them on a schedule and pays the fee. Members
  // only ever sign for their own money: contribute, bid, claim, withdraw.
  // The clock below just reflects on-chain state; it never submits.

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

      {registered === false && (
        <div className="banner error" style={{ marginBottom: 14 }}>
          <b>⚠ Unverified group — do not deposit funds.</b> This contract is not
          registered with Plexa's factory. It may run identical code while handing
          control of upgrades, and therefore of your collateral, to whoever deployed
          it. Only fund groups you reached through Plexa itself.
        </div>
      )}

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

                {clock.resolveDue &&
                  (clock.now - clock.auctionEnd > KEEPER_OVERDUE ? (
                    // Don't claim the keeper is working when it plainly isn't —
                    // a stuck group that says "in progress" is worse than one
                    // that admits it's stuck.
                    <div className="banner warn" style={{ marginBottom: 0, marginTop: 12 }}>
                      <b>Period overdue.</b> The auction closed{" "}
                      {Math.floor((clock.now - clock.auctionEnd) / 60)} min ago and the winner
                      still hasn't been selected, so the keeper isn't running. Nobody's funds
                      are at risk — the group resumes as soon as it comes back.
                    </div>
                  ) : (
                    <div className="banner info" style={{ marginBottom: 0, marginTop: 12 }}>
                      Auction closed. The keeper is selecting the winner on-chain — the payout
                      lands on their dashboard automatically.
                    </div>
                  ))}
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
            groupId={id}
            txIndex={txIndex}
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
                  <button
                    className="btn primary"
                    disabled={busy === "lock"}
                    onClick={() =>
                      run("lock", () => g.lockCollateral(address, "Usdc"))
                    }
                  >
                    {busy === "lock" ? "Confirming…" : "Complete Join"}
                  </button>
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

                {/* Settlement is run by the keeper — members never sign for it. */}

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

                {clock.resolveDue && (
                  <div style={{ marginTop: 8 }}>
                    <p className="muted" style={{ fontSize: 13, margin: "4px 0" }}>
                      {clock.now - clock.auctionEnd > KEEPER_OVERDUE
                        ? "Waiting on the keeper — this period is overdue."
                        : "Auction closed. The winner is being processed on-chain."}
                    </p>
                    {address && (
                      <button
                        className="btn primary"
                        disabled={busy === "resolve"}
                        onClick={() => run("resolve", () => g.resolvePeriod(address!))}
                      >
                        {busy === "resolve" ? "Resolving on-chain…" : "⚡ Announce Winner & Settle"}
                      </button>
                    )}
                  </div>
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
  groupId,
  txIndex,
  pending,
  history,
  currency,
  isMember,
  address,
  busy,
  onVote,
}: {
  groupId: string;
  txIndex: TxIndex | null;
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
            {[...history].reverse().map((h, i) => {
              const hash = txIndex?.find(h.kind, Number(h.timestamp)) ?? null;
              return (
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
                  <td style={{ width: 190, textAlign: "right" }}>
                    {hash ? (
                      <TxHashLink hash={hash} />
                    ) : (
                      <span
                        className="faint"
                        style={{ fontSize: 11 }}
                        title={
                          txIndex
                            ? "Outside the RPC event retention window (about a week). The entry is still on-chain."
                            : "Loading on-chain transactions…"
                        }
                      >
                        {txIndex ? "— archived" : "…"}
                      </span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}

      <div className="section-title">Verify on-chain</div>
      <p className="muted" style={{ fontSize: 13, marginTop: 0 }}>
        Every action below is a real Stellar transaction. Open any hash to confirm it
        independently on a block explorer.
      </p>
      <TxReceipts contractId={groupId} />
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
