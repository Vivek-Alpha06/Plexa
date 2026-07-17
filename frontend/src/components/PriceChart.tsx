import { useEffect, useMemo, useRef, useState } from "react";
import { xlmPrice } from "../lib/contracts";
import { historicalSeries, type PricePoint } from "../lib/price";

// Single-series price chart (XLM/USDC): live current price + historical path,
// with a range toggle and a crosshair+tooltip hover layer. One hue only, so no
// legend is needed — the title names the series (per the dataviz method).

const RANGES: { key: string; label: string; hours: number; points: number }[] = [
  { key: "24h", label: "24H", hours: 24, points: 96 },
  { key: "7d", label: "7D", hours: 24 * 7, points: 120 },
  { key: "30d", label: "30D", hours: 24 * 30, points: 150 },
];

const H = 240; // chart height (px)
const PAD = { top: 16, right: 12, bottom: 24, left: 52 };

const fmtPrice = (p: number) => `$${p.toFixed(4)}`;

export function PriceChart() {
  const [rangeKey, setRangeKey] = useState("7d");
  const [width, setWidth] = useState(720);
  const [live, setLive] = useState<number | null>(null);
  const [tick, setTick] = useState(0); // advances the synthetic path over time
  const [hoverX, setHoverX] = useState<number | null>(null);
  const wrapRef = useRef<HTMLDivElement>(null);

  const range = RANGES.find((r) => r.key === rangeKey)!;

  // Track container width for a responsive SVG.
  useEffect(() => {
    if (!wrapRef.current) return;
    const el = wrapRef.current;
    const ro = new ResizeObserver(() => setWidth(el.clientWidth));
    ro.observe(el);
    setWidth(el.clientWidth);
    return () => ro.disconnect();
  }, []);

  // Poll the oracle for the live price and advance the path every 15s.
  useEffect(() => {
    let cancelled = false;
    const pull = async () => {
      try {
        const p = await xlmPrice();
        if (!cancelled && p > 0n) setLive(Number(p) / 1e7);
      } catch {
        /* keep last */
      }
    };
    void pull();
    const t = setInterval(() => {
      setTick((n) => n + 1);
      void pull();
    }, 15_000);
    return () => {
      cancelled = true;
      clearInterval(t);
    };
  }, []);

  // Synthetic historical path, anchored so its final point equals the real
  // current oracle price (so the shape is plausible and ends at the truth).
  const series: PricePoint[] = useMemo(() => {
    const raw = historicalSeries(range.hours, range.points);
    if (live !== null && raw.length > 0) {
      const offset = live - raw[raw.length - 1].price;
      return raw.map((p) => ({ t: p.t, price: p.price + offset }));
    }
    return raw;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [range.hours, range.points, live, tick]);

  const iw = Math.max(120, width - PAD.left - PAD.right);
  const ih = H - PAD.top - PAD.bottom;

  const { minP, maxP, path, area, xOf, yOf } = useMemo(() => {
    const prices = series.map((p) => p.price);
    let lo = Math.min(...prices);
    let hi = Math.max(...prices);
    if (lo === hi) {
      lo -= 0.01;
      hi += 0.01;
    }
    const padY = (hi - lo) * 0.12;
    lo -= padY;
    hi += padY;
    const t0 = series[0]?.t ?? 0;
    const t1 = series[series.length - 1]?.t ?? 1;
    const xOf = (t: number) => PAD.left + (iw * (t - t0)) / Math.max(1, t1 - t0);
    const yOf = (p: number) => PAD.top + ih * (1 - (p - lo) / (hi - lo));
    const path = series
      .map((p, i) => `${i === 0 ? "M" : "L"}${xOf(p.t).toFixed(1)},${yOf(p.price).toFixed(1)}`)
      .join(" ");
    const area =
      `M${xOf(t0).toFixed(1)},${(PAD.top + ih).toFixed(1)} ` +
      series.map((p) => `L${xOf(p.t).toFixed(1)},${yOf(p.price).toFixed(1)}`).join(" ") +
      ` L${xOf(t1).toFixed(1)},${(PAD.top + ih).toFixed(1)} Z`;
    return { minP: lo, maxP: hi, path, area, xOf, yOf };
  }, [series, iw, ih]);

  const current = live ?? series[series.length - 1]?.price ?? 0;
  const first = series[0]?.price ?? current;
  const change = current - first;
  const changePct = first ? (change / first) * 100 : 0;

  // Nearest point to the hovered x, for the crosshair + tooltip.
  const hovered = useMemo(() => {
    if (hoverX === null || series.length === 0) return null;
    let best = series[0];
    let bestDx = Infinity;
    for (const p of series) {
      const dx = Math.abs(xOf(p.t) - hoverX);
      if (dx < bestDx) {
        bestDx = dx;
        best = p;
      }
    }
    return best;
  }, [hoverX, series, xOf]);

  // Y-axis gridlines / labels.
  const yTicks = [0, 0.25, 0.5, 0.75, 1].map((f) => minP + (maxP - minP) * f);

  return (
    <div className="card">
      <div className="row between wrap" style={{ marginBottom: 6 }}>
        <div>
          <div className="section-title" style={{ margin: 0 }}>
            XLM / USDC price
          </div>
          <div className="row" style={{ gap: 10, alignItems: "baseline" }}>
            <div className="stat" style={{ fontSize: 26 }}>
              {fmtPrice(current)}
            </div>
            <span
              className="pill"
              style={{ color: change >= 0 ? "var(--accent)" : "var(--danger)" }}
            >
              {change >= 0 ? "▲" : "▼"} {Math.abs(changePct).toFixed(2)}% · {range.label}
            </span>
          </div>
          <div className="faint" style={{ fontSize: 12 }}>
            Backs XLM collateral. Watch it to keep your health factor above 1.00.
          </div>
        </div>
        <div className="row" style={{ gap: 6 }}>
          {RANGES.map((r) => (
            <button
              key={r.key}
              className={`btn sm ${r.key === rangeKey ? "primary" : "ghost"}`}
              onClick={() => setRangeKey(r.key)}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>

      <div ref={wrapRef} style={{ position: "relative", width: "100%" }}>
        <svg
          width={width}
          height={H}
          onMouseMove={(e) => {
            const rect = (e.currentTarget as SVGSVGElement).getBoundingClientRect();
            setHoverX(e.clientX - rect.left);
          }}
          onMouseLeave={() => setHoverX(null)}
          style={{ display: "block", cursor: "crosshair" }}
        >
          <defs>
            <linearGradient id="priceArea" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--accent)" stopOpacity="0.22" />
              <stop offset="100%" stopColor="var(--accent)" stopOpacity="0" />
            </linearGradient>
          </defs>

          {/* Recessive gridlines + y labels. */}
          {yTicks.map((p, i) => (
            <g key={i}>
              <line
                x1={PAD.left}
                y1={yOf(p)}
                x2={PAD.left + iw}
                y2={yOf(p)}
                stroke="var(--border)"
                strokeWidth={1}
              />
              <text
                x={PAD.left - 8}
                y={yOf(p) + 4}
                textAnchor="end"
                fontSize={11}
                fill="var(--text-faint)"
              >
                {p.toFixed(3)}
              </text>
            </g>
          ))}

          <path d={area} fill="url(#priceArea)" />
          <path d={path} fill="none" stroke="var(--accent)" strokeWidth={2} strokeLinejoin="round" />

          {/* Crosshair + marker. */}
          {hovered && (
            <>
              <line
                x1={xOf(hovered.t)}
                y1={PAD.top}
                x2={xOf(hovered.t)}
                y2={PAD.top + ih}
                stroke="var(--text-faint)"
                strokeWidth={1}
                strokeDasharray="3 3"
              />
              <circle
                cx={xOf(hovered.t)}
                cy={yOf(hovered.price)}
                r={4.5}
                fill="var(--accent)"
                stroke="var(--bg-elev)"
                strokeWidth={2}
              />
            </>
          )}
        </svg>

        {hovered && (
          <div
            className="price-tip"
            style={{
              position: "absolute",
              left: Math.min(width - 130, Math.max(0, xOf(hovered.t) + 8)),
              top: PAD.top,
            }}
          >
            <div style={{ fontWeight: 700 }}>{fmtPrice(hovered.price)}</div>
            <div className="faint" style={{ fontSize: 11 }}>
              {new Date(hovered.t * 1000).toLocaleString()}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
