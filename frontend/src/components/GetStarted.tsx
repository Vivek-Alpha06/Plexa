// One-click testnet setup.
//
// Shown to a connected wallet that is not yet ready to use the app. The whole
// point is that a newcomer presses one button instead of following a six-step
// guide across three websites.
import { useCallback, useEffect, useState } from "react";
import { useWallet } from "../context/WalletContext";
import { isTestnet, runOnboarding, accountExists, type Step } from "../lib/onboarding";
import { xlmBalance } from "../lib/contracts";
import { DEMO } from "../lib/config";

const ICON: Record<Step["status"], string> = {
  pending: "○",
  running: "◐",
  done: "✓",
  skipped: "–",
  failed: "✕",
};

export function GetStarted({ onDone }: { onDone?: () => void }) {
  const { address, refreshBalance } = useWallet();
  const [steps, setSteps] = useState<Step[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [ready, setReady] = useState<boolean | null>(null);

  // Decide whether this account still needs setup at all.
  const check = useCallback(async () => {
    if (!address || DEMO || !isTestnet) return setReady(true);
    try {
      if (!(await accountExists(address))) return setReady(false);
      setReady((await xlmBalance(address)) >= 50_000_000n);
    } catch {
      setReady(null); // unknown — offer setup rather than hide it
    }
  }, [address]);

  useEffect(() => {
    void check();
  }, [check]);

  const run = async () => {
    if (!address) return;
    setBusy(true);
    try {
      const res = await runOnboarding(address, setSteps);
      if (res.ok) {
        await refreshBalance();
        await check();
        onDone?.();
      }
    } finally {
      setBusy(false);
    }
  };

  if (!address || DEMO || !isTestnet) return null;
  // Already usable and nothing in flight — stay out of the way.
  if (ready === true && !steps) return null;

  return (
    <div className="card" style={{ marginBottom: 16 }}>
      <div className="section-title" style={{ marginTop: 0 }}>
        Finish setting up
      </div>
      <p className="muted" style={{ marginTop: 0, fontSize: 14 }}>
        Plexa runs on Stellar's test network, so everything here uses free test
        funds — nothing costs real money. One click sets your account up.
      </p>

      {steps && (
        <ul style={{ listStyle: "none", padding: 0, margin: "12px 0", fontSize: 14 }}>
          {steps.map((s) => (
            <li key={s.id} style={{ padding: "3px 0" }}>
              <span
                style={{
                  display: "inline-block",
                  width: 20,
                  color:
                    s.status === "failed"
                      ? "var(--danger, #f87171)"
                      : s.status === "done"
                        ? "var(--success, #4ade80)"
                        : "inherit",
                }}
              >
                {ICON[s.status]}
              </span>
              {s.label}
              {s.detail && <span className="faint"> — {s.detail}</span>}
            </li>
          ))}
        </ul>
      )}

      <button className="btn primary" onClick={() => void run()} disabled={busy}>
        {busy ? "Setting up…" : "Get me set up"}
      </button>

      <p className="faint" style={{ fontSize: 12, marginTop: 10, marginBottom: 0 }}>
        ℹ️ <b>Network Reserve & Fee Note:</b> Stellar accounts require a small base reserve (~1–2 XLM) to exist on-chain. Soroban contract transaction fees are tiny fractions of a cent (~0.00001 XLM).
      </p>

      {ready === true && steps && (
        <p className="muted" style={{ fontSize: 13, marginBottom: 0, marginTop: 8 }}>
          You're ready — join a group to get started.
        </p>
      )}
    </div>
  );
}
