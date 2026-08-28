// XLM <-> USDC swap widget.
//
// Used in two places with the same code: the landing page (where nobody is
// connected yet, so it acts as a live quote with a connect prompt) and
// /app/swap (where it executes). Quoting needs no wallet, so the landing
// version is a real quote off the live router, not a mock-up.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ArrowDownUp, ExternalLink, Loader2, RefreshCw } from "lucide-react";
import { useWallet } from "../context/WalletContext";
import { DEMO, IS_MAINNET, USDC_ID } from "../lib/config";
import { unitsToUsdc, usdcToUnits } from "../lib/format";
import { usdcBalance, xlmBalance } from "../lib/contracts";
import { explorerTxUrl } from "../lib/txlog";
import { notify } from "../lib/notify";
import {
  DEFAULT_SLIPPAGE_BPS,
  SLIPPAGE_CHOICES,
  SWAP_AVAILABLE,
  canReceiveUsdc,
  directionAvailable,
  flip,
  legs,
  minReceived,
  quote as quoteSwap,
  routerUsdcLiquidity,
  swap as executeSwap,
  type Direction,
  type Quote,
} from "../lib/swap";

/**
 * Held back from "Max" when selling XLM, so the swap can still pay its fee and
 * stay above the account's base reserve. Stellar's minimum is 1 XLM plus
 * reserves; 1.5 leaves room for the fee and a following action.
 */
const XLM_HEADROOM = 15_000_000n; // 1.5 XLM (7dp)

export function SwapCard({ variant = "app" }: { variant?: "app" | "landing" }) {
  const { address, openPicker, refreshBalance } = useWallet();

  const [dir, setDir] = useState<Direction>("xlm_to_usdc");
  const [amount, setAmount] = useState("");
  const [slippageBps, setSlippageBps] = useState<number>(DEFAULT_SLIPPAGE_BPS);
  const [quote, setQuote] = useState<Quote | null>(null);
  const [quoting, setQuoting] = useState(false);
  const [quoteErr, setQuoteErr] = useState<string | null>(null);

  const [xlm, setXlm] = useState<bigint | null>(null);
  const [usdc, setUsdc] = useState<bigint | null>(null);
  const [liquidity, setLiquidity] = useState<bigint | null>(null);
  const [trustline, setTrustline] = useState<boolean | null>(null);

  const [busy, setBusy] = useState(false);
  const [txHash, setTxHash] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const { from, to } = legs(dir);
  const routable = directionAvailable(dir);

  // XLM and USDC share the 7dp scale, so one parser covers both legs.
  const amountIn = useMemo(() => {
    try {
      return usdcToUnits(amount);
    } catch {
      return 0n;
    }
  }, [amount]);

  const valid = amountIn > 0n;
  const fromBalance = dir === "xlm_to_usdc" ? xlm : usdc;

  // ------------------------------------------------------------ balances
  const loadBalances = useCallback(async () => {
    if (!address) {
      setXlm(null);
      setUsdc(null);
      return;
    }
    const [x, u] = await Promise.all([
      xlmBalance(address).catch(() => null),
      usdcBalance(address).catch(() => null),
    ]);
    setXlm(x);
    setUsdc(u);
  }, [address]);

  useEffect(() => {
    void loadBalances();
  }, [loadBalances]);

  useEffect(() => {
    if (!SWAP_AVAILABLE) return;
    void routerUsdcLiquidity().then(setLiquidity);
  }, []);

  useEffect(() => {
    if (!address || !USDC_ID) {
      setTrustline(null);
      return;
    }
    let live = true;
    void canReceiveUsdc(address).then((ok) => {
      if (live) setTrustline(ok);
    });
    return () => {
      live = false;
    };
  }, [address]);

  // -------------------------------------------------------------- quoting
  // Sequence guard: a slow quote for an old amount or direction must never
  // overwrite a fast one for what is currently in the box.
  const seq = useRef(0);

  const runQuote = useCallback(async (d: Direction, units: bigint) => {
    const mine = ++seq.current;
    if (units <= 0n || !directionAvailable(d)) {
      setQuote(null);
      setQuoteErr(null);
      setQuoting(false);
      return;
    }
    setQuoting(true);
    setQuoteErr(null);
    try {
      const q = await quoteSwap(d, units);
      if (seq.current === mine) setQuote(q);
    } catch (e) {
      if (seq.current === mine) {
        setQuote(null);
        setQuoteErr(e instanceof Error ? e.message : String(e));
      }
    } finally {
      if (seq.current === mine) setQuoting(false);
    }
  }, []);

  useEffect(() => {
    if (!SWAP_AVAILABLE) return;
    const t = setTimeout(() => void runQuote(dir, amountIn), 400);
    return () => clearTimeout(t);
  }, [dir, amountIn, runQuote]);

  // -------------------------------------------------------------- derived
  const outMin = quote ? minReceived(quote.amountOut, slippageBps) : 0n;
  const overBalance = fromBalance !== null && amountIn > fromBalance;
  // Only meaningful for the leg that pays out USDC, and only when the venue
  // reports a reserve at all (a Soroswap router does not).
  const overLiquidity =
    dir === "xlm_to_usdc" && liquidity !== null && quote !== null && quote.amountOut > liquidity;
  const needsTrustline = dir === "xlm_to_usdc" && trustline === false;

  const setMax = () => {
    if (fromBalance === null) return;
    const usable =
      dir === "xlm_to_usdc"
        ? fromBalance > XLM_HEADROOM
          ? fromBalance - XLM_HEADROOM
          : 0n
        : fromBalance;
    setAmount(unitsToUsdc(usable));
  };

  const onFlip = () => {
    setDir(flip(dir));
    setQuote(null);
    setQuoteErr(null);
    setErr(null);
  };

  // ------------------------------------------------------------- execute
  const onSwap = async () => {
    if (!address || !quote) return;
    setBusy(true);
    setErr(null);
    setTxHash(null);
    try {
      const hash = await executeSwap(dir, address, quote.amountIn, outMin);
      setTxHash(hash);
      setAmount("");
      setQuote(null);
      notify("Swap complete", `Received at least ${unitsToUsdc(outMin)} ${to}.`, "success");
      await Promise.all([loadBalances(), refreshBalance()]);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setErr(msg);
      notify("Swap failed", msg, "warn");
    } finally {
      setBusy(false);
    }
  };

  // --------------------------------------------------------------- render
  const blockedReason = (): string | null => {
    if (DEMO)
      return "Demo mode simulates a single balance, so there is nothing to swap between. Run against testnet to try this.";
    if (!SWAP_AVAILABLE) return "No swap router is configured for this network.";
    if (!routable) return "This direction is not routable on the current network.";
    if (!address || !valid) return null;
    if (overBalance) return `Not enough ${from} in this wallet.`;
    if (needsTrustline)
      return "This account has no USDC trustline, so it cannot receive USDC yet.";
    if (overLiquidity)
      return `The venue only holds ${unitsToUsdc(liquidity ?? 0n)} USDC right now.`;
    return null;
  };

  const blocked = blockedReason();
  const canSwap = !!address && valid && !!quote && !busy && !blocked;

  return (
    <div className={`swap-card card pad-lg ${variant}`}>
      <div className="row between" style={{ marginBottom: 14 }}>
        <div>
          <h3 style={{ margin: 0 }}>Swap</h3>
          <span className="muted">
            {from} to {to} · {IS_MAINNET ? "mainnet" : "testnet"}
          </span>
        </div>
        <button
          className="btn sm secondary"
          onClick={() => void runQuote(dir, amountIn)}
          disabled={!valid || quoting}
          title="Refresh quote"
          aria-label="Refresh quote"
        >
          <RefreshCw size={13} className={quoting ? "spin" : undefined} />
        </button>
      </div>

      {/* ------------------------------------------------------------- pay */}
      <div className="swap-leg">
        <div className="row between">
          <span className="swap-lbl">You pay</span>
          {fromBalance !== null && (
            <span className="swap-bal">
              Balance {unitsToUsdc(fromBalance)} {from}
              <button className="swap-max" onClick={setMax} type="button">
                Max
              </button>
            </span>
          )}
        </div>
        <div className="swap-input">
          <input
            inputMode="decimal"
            placeholder="0.00"
            value={amount}
            onChange={(e) => setAmount(e.target.value.replace(/[^0-9.]/g, ""))}
            aria-label={`${from} amount to swap`}
          />
          <span className="swap-ticker">{from}</span>
        </div>
      </div>

      <div className="swap-arrow">
        <button
          type="button"
          className="swap-flip"
          onClick={onFlip}
          title={`Swap direction — sell ${to} for ${from} instead`}
          aria-label="Reverse swap direction"
        >
          <ArrowDownUp size={15} />
        </button>
      </div>

      {/* --------------------------------------------------------- receive */}
      <div className="swap-leg">
        <span className="swap-lbl">You receive</span>
        <div className="swap-input readonly">
          <span className="swap-out">
            {quoting && !quote ? "…" : quote ? unitsToUsdc(quote.amountOut) : "0.00"}
          </span>
          <span className="swap-ticker">{to}</span>
        </div>
      </div>

      {/* ----------------------------------------------------------- terms */}
      {quote && (
        <div className="swap-terms">
          <div className="row between">
            <span>Rate</span>
            <span>
              1 {from} ≈ {quote.rate.toFixed(6)} {to}
            </span>
          </div>
          <div className="row between">
            <span>Minimum received</span>
            <span>
              {unitsToUsdc(outMin)} {to}
            </span>
          </div>
          <div className="row between">
            <span>Price source</span>
            <span
              title={
                quote.source === "router"
                  ? "Quoted by the router itself — includes pool fees and price impact."
                  : "The router gave no exact-input quote, so this is the oracle mid-price: it excludes pool fees and price impact."
              }
            >
              {quote.source === "router" ? "Router" : "Oracle mid-price"}
            </span>
          </div>
          <div className="row between">
            <span>Slippage</span>
            <span className="swap-slip">
              {SLIPPAGE_CHOICES.map((bps) => (
                <button
                  key={bps}
                  type="button"
                  className={bps === slippageBps ? "active" : ""}
                  onClick={() => setSlippageBps(bps)}
                >
                  {bps / 100}%
                </button>
              ))}
            </span>
          </div>
        </div>
      )}

      {/* -------------------------------------------------------- messages */}
      {quoteErr && routable && <div className="banner error">{quoteErr}</div>}
      {blocked && <div className="banner info">{blocked}</div>}
      {needsTrustline && (
        <div className="banner info">
          Add a USDC trustline in your wallet (Freighter → Manage Assets → add USDC), then
          reload. Without it the network rejects the incoming USDC.
        </div>
      )}
      {IS_MAINNET && valid && (
        <div className="banner error">
          Mainnet: this spends real {from}. Plexa is unaudited — try a small amount first.
        </div>
      )}
      {err && <div className="banner error">{err}</div>}
      {txHash && (
        <div className="banner info">
          Swap confirmed.{" "}
          <a href={explorerTxUrl(txHash)} target="_blank" rel="noreferrer">
            View on stellar.expert <ExternalLink size={11} />
          </a>
        </div>
      )}

      {/* ---------------------------------------------------------- action */}
      {address ? (
        <button className="btn primary lg swap-go" onClick={onSwap} disabled={!canSwap}>
          {busy ? (
            <>
              <Loader2 size={15} className="spin" /> Swapping…
            </>
          ) : (
            `Swap ${from} for ${to}`
          )}
        </button>
      ) : (
        <button className="btn primary lg swap-go" onClick={openPicker}>
          Connect Wallet to Swap
        </button>
      )}

      <p className="swap-foot">
        Routed through {IS_MAINNET ? "Soroswap" : "the Plexa testnet swap venue"}. Plexa
        takes no fee — you pay the network fee and the venue's own spread.
      </p>
    </div>
  );
}
