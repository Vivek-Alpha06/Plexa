import { useEffect, useState, useRef } from "react";
import { fmtDuration } from "../lib/format";

/** Live countdown to a unix timestamp (seconds). Triggers onEnd callback when timer expires. */
export function Countdown({ target, onEnd }: { target: number; onEnd?: () => void }) {
  const [now, setNow] = useState(() => Math.floor(Date.now() / 1000));
  const hasTriggered = useRef(false);

  useEffect(() => {
    const t = setInterval(() => {
      const current = Math.floor(Date.now() / 1000);
      setNow(current);
      if (current >= target && !hasTriggered.current) {
        hasTriggered.current = true;
        if (onEnd) onEnd();
      }
    }, 1000);
    return () => clearInterval(t);
  }, [target, onEnd]);

  const remaining = target - now;
  if (remaining <= 0) return <span className="countdown faint">ended (syncing…)</span>;
  return <span className="countdown">{fmtDuration(remaining)}</span>;
}
