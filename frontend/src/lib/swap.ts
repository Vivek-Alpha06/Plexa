// XLM <-> USDC swaps through the configured Soroswap-compatible router.
//
// `ROUTER_ID` is a live Soroswap router on both networks (verified read-only:
// both answer `router_get_amounts_out` in both directions), so one code path
// covers testnet and mainnet. The mock venue in `contracts/swap` implements the
// same interface and can be wired in its place — hence the fallbacks below for
// the entrypoints it does not have.
//
// Nothing here is Plexa-specific: it is the same path a USDC group takes when
// it sells XLM collateral, exposed so a member can convert their own balance
// before joining a circle.

import { nativeToScVal, xdr } from "@stellar/stellar-sdk";
import { DEMO, ROUTER_ID, UNIT_SCALE, USDC_ID, XLM_ID } from "./config";
import { invoke, read, xlmPrice } from "./contracts";
import { hasTrustline } from "./onboarding";

const addr = (a: string) => nativeToScVal(a, { type: "address" });
const i128 = (n: bigint) => nativeToScVal(n, { type: "i128" });
const u64 = (n: bigint) => nativeToScVal(n, { type: "u64" });

export type Direction = "xlm_to_usdc" | "usdc_to_xlm";

export type Ticker = "XLM" | "USDC";

export function legs(dir: Direction): { from: Ticker; to: Ticker } {
  return dir === "xlm_to_usdc" ? { from: "XLM", to: "USDC" } : { from: "USDC", to: "XLM" };
}

export function flip(dir: Direction): Direction {
  return dir === "xlm_to_usdc" ? "usdc_to_xlm" : "xlm_to_usdc";
}

/** Routers validate the path, so the order of these two ids is the direction. */
function swapPath(dir: Direction): xdr.ScVal {
  const ids = dir === "xlm_to_usdc" ? [XLM_ID, USDC_ID] : [USDC_ID, XLM_ID];
  return xdr.ScVal.scvVec(ids.map(addr));
}

/** True when a swap can be attempted at all on this network. */
export const SWAP_AVAILABLE = !DEMO && !!ROUTER_ID && !!XLM_ID && !!USDC_ID;

/**
 * Is this direction routable here?
 *
 * An AMM router swaps either way, and both configured routers do. The mock
 * venue in `contracts/swap` does not — it models collateral liquidation, so its
 * `check_path` accepts only XLM -> USDC — but it is not what either network
 * points at today. A quote failure surfaces the real answer either way; this is
 * only here so a swap the router cannot serve is refused before signing.
 */
export function directionAvailable(dir: Direction): boolean {
  return SWAP_AVAILABLE && (dir === "xlm_to_usdc" || dir === "usdc_to_xlm");
}

/** Default slippage tolerance, in basis points (50 = 0.50%). */
export const DEFAULT_SLIPPAGE_BPS = 50;

export const SLIPPAGE_CHOICES = [10, 50, 100, 300] as const;

/** How long a submitted swap stays valid, in seconds. */
export const DEADLINE_SECONDS = 180;

export interface Quote {
  dir: Direction;
  amountIn: bigint;
  amountOut: bigint;
  /**
   * Where the number came from. `router` is a real on-chain quote including
   * pool fees and price impact — this is the normal case on both networks.
   * `oracle` is the mid-price and includes neither; it is the fallback for a
   * venue with no exact-input quote entrypoint.
   */
  source: "router" | "oracle";
  /** Output per 1 unit of input, for display. */
  rate: number;
}

/**
 * Quote an exact-input swap.
 *
 * Tries the router's own `router_get_amounts_out` first so the number includes
 * pool fees and price impact against the real liquidity the swap will hit.
 * Both configured routers answer it. The oracle fallback exists for a venue
 * that only implements the exact-output quote (`router_get_amounts_in`), such
 * as the mock in `contracts/swap`, which fills at exactly the oracle price.
 */
export async function quote(dir: Direction, amountIn: bigint): Promise<Quote> {
  if (amountIn <= 0n) throw new Error("Enter an amount to swap.");
  if (!SWAP_AVAILABLE) throw new Error("No swap router is configured for this network.");
  if (!directionAvailable(dir)) {
    throw new Error("This direction is not routable on the current network.");
  }

  try {
    const amounts = await read<bigint[]>(ROUTER_ID, "router_get_amounts_out", [
      i128(amountIn),
      swapPath(dir),
    ]);
    const out = amounts?.[amounts.length - 1];
    if (typeof out === "bigint" && out > 0n) {
      return { dir, amountIn, amountOut: out, source: "router", rate: rateOf(amountIn, out) };
    }
  } catch {
    // Router has no exact-input quote, or is unreachable — the oracle path
    // below still gives the user a number to decide on.
  }

  // Oracle price is USDC per 1 XLM at 7dp, so one direction multiplies by it
  // and the other divides. This only answers where ORACLE_ID is the Plexa
  // adapter, which exposes `price()`; pointed straight at a Reflector feed it
  // returns 0 and the caller gets the error below rather than a wrong number.
  const price = await xlmPrice();
  if (price <= 0n) {
    throw new Error("Could not price this swap — the router and oracle both failed to answer.");
  }
  const amountOut =
    dir === "xlm_to_usdc"
      ? (amountIn * price) / UNIT_SCALE
      : (amountIn * UNIT_SCALE) / price;
  return { dir, amountIn, amountOut, source: "oracle", rate: rateOf(amountIn, amountOut) };
}

function rateOf(amountIn: bigint, amountOut: bigint): number {
  if (amountIn <= 0n) return 0;
  return Number(amountOut) / Number(amountIn);
}

/** Worst output the user is willing to accept, given a slippage tolerance. */
export function minReceived(amountOut: bigint, slippageBps: number): bigint {
  const bps = BigInt(Math.max(0, Math.min(10_000, Math.round(slippageBps))));
  return (amountOut * (10_000n - bps)) / 10_000n;
}

/**
 * USDC the venue can pay out, when it reports a reserve.
 *
 * Only the mock venue in `contracts/swap` exposes `usdc_liquidity`. A Soroswap
 * router holds no reserve itself (its pairs do) and simply has no such
 * function, so this returns null there and the caller skips the check.
 */
export async function routerUsdcLiquidity(): Promise<bigint | null> {
  if (!SWAP_AVAILABLE) return null;
  try {
    return await read<bigint>(ROUTER_ID, "usdc_liquidity", []);
  } catch {
    return null;
  }
}

/**
 * Can this account receive USDC?
 *
 * USDC is a classic Stellar asset on both networks, so the destination needs a
 * trustline before the transfer leg can land. Checking first turns a failed,
 * fee-burning transaction into an explanation. Native XLM never needs one, so
 * the reverse direction skips this.
 */
export async function canReceiveUsdc(address: string): Promise<boolean> {
  if (!address) return false;
  try {
    return await hasTrustline(address, "USDC");
  } catch {
    // Horizon down — don't block the swap on a check we couldn't complete.
    return true;
  }
}

/**
 * Execute the swap. Returns the transaction hash.
 *
 * `to` is the wallet itself, which is also the transaction source, so the
 * router's pull of the input token is authorised by the source-account
 * signature that `invoke` already collects — no separate approval step.
 */
export async function swap(
  dir: Direction,
  wallet: string,
  amountIn: bigint,
  amountOutMin: bigint
): Promise<string> {
  if (!directionAvailable(dir)) {
    throw new Error("This direction is not routable on the current network.");
  }
  if (amountIn <= 0n) throw new Error("Enter an amount to swap.");

  const deadline = BigInt(Math.floor(Date.now() / 1000) + DEADLINE_SECONDS);
  return invoke(
    ROUTER_ID,
    "swap_exact_tokens_for_tokens",
    [i128(amountIn), i128(amountOutMin), swapPath(dir), addr(wallet), u64(deadline)],
    wallet
  );
}
