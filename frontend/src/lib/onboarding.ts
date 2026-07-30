// One-click testnet onboarding.
//
// A new tester previously had to: install Freighter, create an account, switch
// it to testnet, fund it from Friendbot, add a USDC trustline, then find the
// Circle faucet — six steps before seeing anything happen. Most people quit at
// step two, which is the real reason a testnet product struggles to get users.
//
// This reduces it to: connect, then press one button. Everything here is
// idempotent and safe to re-run; each step reports what it did so the UI can
// show real progress rather than a spinner.
import { NETWORK, USDC_ID } from "./config";
import { xlmBalance } from "./contracts";

/** Minimum XLM before we consider an account able to do anything useful. */
const MIN_XLM = 50_000_000n; // 5 XLM (7dp)

const HORIZON =
  NETWORK === "public" || NETWORK === "mainnet"
    ? "https://horizon.stellar.org"
    : "https://horizon-testnet.stellar.org";
const FRIENDBOT = "https://friendbot.stellar.org";

export type StepStatus = "pending" | "running" | "done" | "skipped" | "failed";

export interface Step {
  id: string;
  label: string;
  status: StepStatus;
  detail?: string;
}

export const isTestnet = !(NETWORK === "public" || NETWORK === "mainnet");

/** Does this account exist on the ledger yet? */
export async function accountExists(address: string): Promise<boolean> {
  const res = await fetch(`${HORIZON}/accounts/${address}`);
  return res.ok;
}

/**
 * Fund an account from Friendbot.
 *
 * A 400 usually means "already funded", which is success for our purposes —
 * the goal is a usable account, not a fresh one.
 */
export async function fundAccount(address: string): Promise<"funded" | "already"> {
  const res = await fetch(`${FRIENDBOT}?addr=${encodeURIComponent(address)}`);
  if (res.ok) return "funded";
  if (res.status === 400) return "already";
  throw new Error(`Friendbot returned ${res.status}`);
}

/**
 * Does the account trust the group currency?
 *
 * Only classic assets need a trustline. Native XLM never does, so XLM groups
 * skip this entirely — which is why they are the better first experience.
 */
export async function hasTrustline(address: string, assetCode: string): Promise<boolean> {
  const res = await fetch(`${HORIZON}/accounts/${address}`);
  if (!res.ok) return false;
  const json = await res.json();
  return (json.balances ?? []).some(
    (b: { asset_code?: string }) => b.asset_code === assetCode
  );
}

/**
 * Run the whole setup, reporting progress as it goes.
 *
 * Deliberately does not add a USDC trustline: that requires the user to sign a
 * change-trust transaction, and Circle's faucet is a separate hop we cannot
 * automate. XLM groups need neither, so the fast path gets someone to a working
 * group without either detour. `usdcReady` tells the UI whether to offer the
 * USDC route at all.
 */
export async function runOnboarding(
  address: string,
  onProgress: (steps: Step[]) => void
): Promise<{ ok: boolean; usdcReady: boolean; steps: Step[] }> {
  const steps: Step[] = [
    { id: "account", label: "Checking your account", status: "pending" },
    { id: "fund", label: "Funding with test XLM", status: "pending" },
    { id: "usdc", label: "Checking USDC trustline", status: "pending" },
  ];
  const emit = () => onProgress(steps.map((s) => ({ ...s })));
  const set = (id: string, status: StepStatus, detail?: string) => {
    const s = steps.find((x) => x.id === id);
    if (s) {
      s.status = status;
      s.detail = detail;
    }
    emit();
  };

  emit();

  if (!isTestnet) {
    steps.forEach((s) => (s.status = "skipped"));
    emit();
    return { ok: false, usdcReady: false, steps };
  }

  // 1. Account exists?
  set("account", "running");
  let exists = false;
  try {
    exists = await accountExists(address);
    set("account", "done", exists ? "Account found" : "Not created yet");
  } catch (e) {
    set("account", "failed", e instanceof Error ? e.message : String(e));
    return { ok: false, usdcReady: false, steps };
  }

  // 2. Fund it if it is new or running low.
  set("fund", "running");
  try {
    let balance = exists ? await xlmBalance(address) : 0n;
    if (balance >= MIN_XLM) {
      set("fund", "skipped", `Already has ${(Number(balance) / 1e7).toFixed(1)} XLM`);
    } else {
      const result = await fundAccount(address);
      // Horizon lags the ledger slightly; poll rather than assume.
      for (let i = 0; i < 10 && balance < MIN_XLM; i++) {
        await new Promise((r) => setTimeout(r, 1000));
        balance = await xlmBalance(address).catch(() => balance);
      }
      set(
        "fund",
        balance > 0n ? "done" : "failed",
        balance > 0n
          ? `${(Number(balance) / 1e7).toFixed(1)} XLM available${result === "already" ? "" : " (funded)"}`
          : "Funding did not land — try again in a moment"
      );
      if (balance === 0n) return { ok: false, usdcReady: false, steps };
    }
  } catch (e) {
    set("fund", "failed", e instanceof Error ? e.message : String(e));
    return { ok: false, usdcReady: false, steps };
  }

  // 3. USDC is optional — report it, never block on it.
  set("usdc", "running");
  let usdcReady = false;
  try {
    usdcReady = USDC_ID ? await hasTrustline(address, "USDC") : false;
    set(
      "usdc",
      usdcReady ? "done" : "skipped",
      usdcReady ? "USDC ready" : "Not set up — XLM groups work without it"
    );
  } catch {
    set("usdc", "skipped", "Could not check — XLM groups work without it");
  }

  return { ok: true, usdcReady, steps };
}
