import { useEffect, useState } from "react";
import { fmtDuration } from "../lib/format";

/** Live countdown to a unix timestamp (seconds). Renders "ended" when passed. */
export function Countdown({ target }: { target: number }) {
  const [now, setNow] = useState(() => Math.floor(Date.now() / 1000));
  useEffect(() => {
    const t = setInterval(() => setNow(Math.floor(Date.now() / 1000)), 1000);
    return () => clearInterval(t);
  }, []);
  const remaining = target - now;
  if (remaining <= 0) return <span className="countdown faint">ended</span>;
  return <span className="countdown">{fmtDuration(remaining)}</span>;
}
