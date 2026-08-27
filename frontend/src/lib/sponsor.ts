// Fee sponsorship client — lets a member transact with zero XLM.
//
// The member still signs the inner transaction, so their authorisation of the
// contract call is unchanged and the sponsor gains no power over their funds.
// All the relayer does is wrap that signed envelope in a Stellar fee-bump
// transaction and pay the network fee on their behalf.
//
// Sponsorship is best-effort by design. If the relayer is down, out of funds,
// or declines the call, `trySponsoredSubmit` returns null and the caller falls
// back to submitting the transaction normally — a member who does hold XLM is
// never blocked by a relayer outage.
import { SPONSOR_URL } from "./config";

export interface SponsorResult {
  hash: string;
  sponsoredBy: string;
}

/** True when the build is configured to offer gasless transactions. */
export function sponsorshipConfigured(): boolean {
  return !!SPONSOR_URL;
}

interface HealthResponse {
  status: "ok" | "paused";
  sponsor: string;
  network: string;
  balanceXlm: number;
}

/**
 * Ask the relayer whether it is currently accepting work. Cached for a minute
 * so a page full of components does not stampede the endpoint; the UI uses
 * this only to decide whether to show the "fees sponsored" badge.
 */
let healthCache: { at: number; value: HealthResponse | null } | null = null;

export async function sponsorHealth(): Promise<HealthResponse | null> {
  if (!SPONSOR_URL) return null;
  if (healthCache && Date.now() - healthCache.at < 60_000) {
    return healthCache.value;
  }
  try {
    const res = await fetch(`${SPONSOR_URL}/health`, {
      signal: AbortSignal.timeout(5_000),
    });
    const value = res.ok ? ((await res.json()) as HealthResponse) : null;
    healthCache = { at: Date.now(), value };
    return value;
  } catch {
    healthCache = { at: Date.now(), value: null };
    return null;
  }
}

/**
 * Submit a member-signed transaction through the relayer so the member pays no
 * fee. Resolves to null whenever sponsorship is unavailable or refused, which
 * the caller should treat as "submit it yourself" rather than as an error.
 */
export async function trySponsoredSubmit(
  signedXdr: string
): Promise<SponsorResult | null> {
  if (!SPONSOR_URL) return null;

  try {
    const res = await fetch(`${SPONSOR_URL}/sponsor`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ xdr: signedXdr }),
      signal: AbortSignal.timeout(20_000),
    });

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      console.info(
        `[sponsor] relayer declined, paying own fee: ${body.error ?? res.status}`
      );
      return null;
    }
    return (await res.json()) as SponsorResult;
  } catch (err) {
    console.info(`[sponsor] relayer unreachable, paying own fee: ${err}`);
    return null;
  }
}
