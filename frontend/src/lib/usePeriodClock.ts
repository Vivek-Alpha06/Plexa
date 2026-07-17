// Live period clock: re-derives the current phase every second from the
// on-chain start_time (authoritative), so the UI transitions phases with no
// refresh and survives reloads. Fires in-app notifications on phase changes.
import { useEffect, useRef, useState } from "react";
import { notify } from "./notify";
import type { GroupConfig, GroupState, Phase } from "../types";

export interface PeriodClock {
  now: number; // unix seconds, ticking
  phase: Phase; // mirrors the contract's current_phase()
  /** Active, but the (already-advanced) current period hasn't started yet —
   * i.e. we're inside the previous period's payout window. */
  beforeStart: boolean;
  periodStart: number;
  contribEnd: number;
  settleEnd: number;
  auctionEnd: number;
  periodEnd: number;
  /** Unix ts the visible countdown should target. */
  countdownTarget: number;
  /** 0..1 fraction of the current period elapsed. */
  progress: number;
  /** Settlement window open (contribution closed) — settle() may run. */
  settleDue: boolean;
  /** Auction window closed but resolve_period not yet executed on-chain. */
  resolveDue: boolean;
}

export function usePeriodClock(
  config: GroupConfig | null,
  state: GroupState | null
): PeriodClock | null {
  const [now, setNow] = useState(() => Math.floor(Date.now() / 1000));
  const prevKey = useRef<string | null>(null);

  useEffect(() => {
    const t = setInterval(() => setNow(Math.floor(Date.now() / 1000)), 1000);
    return () => clearInterval(t);
  }, []);

  let clock: PeriodClock | null = null;
  if (config && state) {
    const start = Number(state.start_time);
    const plen = Number(config.period_length);
    const periodStart = start + (state.current_period - 1) * plen;
    const contribEnd = periodStart + Number(config.contribution_window);
    const settleEnd = contribEnd + Number(config.settlement_window);
    const auctionEnd = settleEnd + Number(config.auction_window);
    const periodEnd = periodStart + plen;
    const active = state.status === "Active";
    const beforeStart = active && now < periodStart;

    let phase: Phase = "Contribution";
    if (active && !beforeStart) {
      if (now < contribEnd) phase = "Contribution";
      else if (now < settleEnd) phase = "Settlement";
      else if (now < auctionEnd) phase = "Auction";
      else phase = "Payout";
    }

    const settleDue = active && !beforeStart && now >= contribEnd && now < auctionEnd;
    const resolveDue = active && now >= auctionEnd;
    const progress =
      active && !beforeStart
        ? Math.min(1, Math.max(0, (now - periodStart) / plen))
        : 0;
    const countdownTarget = beforeStart
      ? periodStart
      : phase === "Contribution"
        ? contribEnd
        : phase === "Settlement"
          ? settleEnd
          : phase === "Auction"
            ? auctionEnd
            : periodEnd;

    clock = {
      now,
      phase,
      beforeStart,
      periodStart,
      contribEnd,
      settleEnd,
      auctionEnd,
      periodEnd,
      countdownTarget,
      progress,
      settleDue,
      resolveDue,
    };
  }

  // -------- phase-change notifications (Step 5). Skips the initial render so
  // opening a page mid-phase doesn't announce it as "just started".
  const status = state?.status;
  const period = state?.current_period;
  const phase = clock?.phase;
  const beforeStart = clock?.beforeStart;
  useEffect(() => {
    if (!status || period === undefined || phase === undefined) return;
    const key = `${status}:${period}:${phase}:${beforeStart}`;
    if (prevKey.current === null) {
      prevKey.current = key;
      return;
    }
    if (prevKey.current === key) return;
    const [pStatus, pPeriodStr] = prevKey.current.split(":");
    prevKey.current = key;

    if (status === "Completed") {
      if (pStatus !== "Completed") {
        notify(
          "ROSCA Cycle Completed",
          "Every member has won once. Collateral unlocks after the 24h settlement grace.",
          "success"
        );
      }
      return;
    }
    if (status !== "Active") {
      if (status === "Forming" || pStatus === status) return;
      return;
    }
    if (pStatus === "Forming") {
      notify("Group Started", "Period 1 is underway — the contribution window is open.", "success");
      return;
    }
    if (Number(pPeriodStr) !== period) {
      notify("Next Period Started", `Period ${period} is now underway.`, "success");
    }
    if (beforeStart) return; // still in the previous period's payout window
    if (phase === "Contribution") {
      notify("Contribution Phase Started", "The contribution window is now open.", "info");
    } else if (phase === "Settlement") {
      notify("Settlement Phase Started", "Verifying contributions and liquidating misses before the auction.", "info");
    } else if (phase === "Auction") {
      notify("Auction Phase Started", "Place your discount bid now — highest discount wins.", "info");
    } else {
      notify("Payout Phase Started", "The winner can claim the payout now.", "info");
    }
  }, [status, period, phase, beforeStart]);

  return clock;
}
