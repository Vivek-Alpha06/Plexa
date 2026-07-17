import { USDC_DECIMALS } from "./config";

const SCALE = 10n ** BigInt(USDC_DECIMALS);

/** Parse a human USDC string ("10", "10.5") into base units (bigint, 7dp). */
export function usdcToUnits(human: string): bigint {
  const trimmed = (human ?? "").trim();
  if (!trimmed) return 0n;
  const neg = trimmed.startsWith("-");
  const [whole, frac = ""] = trimmed.replace("-", "").split(".");
  const fracPadded = (frac + "0".repeat(USDC_DECIMALS)).slice(0, USDC_DECIMALS);
  const units = BigInt(whole || "0") * SCALE + BigInt(fracPadded || "0");
  return neg ? -units : units;
}

/** Format base units (bigint) as a human USDC string, trimming trailing zeros. */
export function unitsToUsdc(units: bigint): string {
  const neg = units < 0n;
  const abs = neg ? -units : units;
  const whole = abs / SCALE;
  const frac = (abs % SCALE).toString().padStart(USDC_DECIMALS, "0").replace(/0+$/, "");
  const s = frac ? `${whole}.${frac}` : `${whole}`;
  return neg ? `-${s}` : s;
}

export function fmtUsdc(units: bigint): string {
  return `${unitsToUsdc(units)} USDC`;
}

/** XLM shares the 7dp scale with USDC. */
export function fmtXlm(units: bigint): string {
  return `${unitsToUsdc(units)} XLM`;
}

/** Display ticker for a group currency ("Usdc" | "Xlm"). */
export function currencyLabel(currency: "Usdc" | "Xlm"): string {
  return currency === "Xlm" ? "XLM" : "USDC";
}

/** Format base units in a group's own currency (7dp for both tokens). */
export function fmtAmount(units: bigint, currency: "Usdc" | "Xlm"): string {
  return `${unitsToUsdc(units)} ${currencyLabel(currency)}`;
}

/** USDC value of an XLM amount at a given oracle price (USDC per 1 XLM, 7dp). */
export function xlmValueInUsdc(xlmUnits: bigint, price: bigint): bigint {
  return (xlmUnits * price) / SCALE;
}

/** Health factor comes off-chain as basis-of-10_000 (10_000 = 1.00). */
export function fmtHealthFactor(hf: number): string {
  return (hf / 10_000).toFixed(2);
}

export interface Duration {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
}

export function secondsToDuration(total: number): Duration {
  let t = Math.max(0, Math.floor(total));
  const days = Math.floor(t / 86400);
  t -= days * 86400;
  const hours = Math.floor(t / 3600);
  t -= hours * 3600;
  const minutes = Math.floor(t / 60);
  const seconds = t - minutes * 60;
  return { days, hours, minutes, seconds };
}

export function durationToSeconds(d: Duration): number {
  return d.days * 86400 + d.hours * 3600 + d.minutes * 60 + d.seconds;
}

/** Compact human label like "2d 4h 30m 0s", dropping leading zero units. */
export function fmtDuration(totalSeconds: number | bigint): string {
  const n = typeof totalSeconds === "bigint" ? Number(totalSeconds) : totalSeconds;
  const { days, hours, minutes, seconds } = secondsToDuration(n);
  const parts: string[] = [];
  if (days) parts.push(`${days}d`);
  if (hours || days) parts.push(`${hours}h`);
  if (minutes || hours || days) parts.push(`${minutes}m`);
  parts.push(`${seconds}s`);
  return parts.join(" ");
}

export function shortAddr(addr: string): string {
  if (!addr || addr.length < 10) return addr;
  return `${addr.slice(0, 4)}…${addr.slice(-4)}`;
}
