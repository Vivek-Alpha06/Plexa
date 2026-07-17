// Synthetic XLM/USDC price path. Used by the price chart (live + history) and,
// in demo mode, as the oracle feed so the collateral/health-factor system has a
// moving price to react to. Deterministic in time so history and live agree and
// reloads are stable.

const BASE = 0.115; // USDC per 1 XLM, roughly testnet-plausible
const SCALE = 10_000_000; // 7dp

/** Smoothly wandering price (USDC per XLM) at a given unix-seconds timestamp. */
export function priceAtSeconds(tsSec: number): number {
  const h = tsSec / 3600;
  const wave =
    Math.sin(h / 6.0) * 0.012 +
    Math.sin(h / 1.5 + 1.3) * 0.006 +
    Math.sin(h / 0.4 + 2.1) * 0.003;
  return Math.max(0.02, BASE + wave);
}

/** Same path expressed in 7dp base units (bigint), matching the oracle. */
export function priceUnitsAtSeconds(tsSec: number): bigint {
  return BigInt(Math.round(priceAtSeconds(tsSec) * SCALE));
}

export interface PricePoint {
  t: number; // unix seconds
  price: number; // USDC per XLM
}

/** A backward-looking series of `points` samples spanning `hours`. */
export function historicalSeries(hours: number, points: number): PricePoint[] {
  const now = Math.floor(Date.now() / 1000);
  const span = hours * 3600;
  const step = Math.max(1, Math.floor(span / points));
  const out: PricePoint[] = [];
  for (let i = points; i >= 0; i--) {
    const t = now - i * step;
    out.push({ t, price: priceAtSeconds(t) });
  }
  return out;
}
