import { useEffect, useState } from "react";
import { onNotify, type Toast } from "../lib/notify";

const TOAST_TTL_MS = 6000;

/** Fixed-position notification stack; subscribes to the notify() bus. */
export function Toasts() {
  const [toasts, setToasts] = useState<Toast[]>([]);

  useEffect(() => {
    return onNotify((t) => {
      setToasts((prev) => [...prev.slice(-4), t]); // keep at most 5 visible
      setTimeout(
        () => setToasts((prev) => prev.filter((x) => x.id !== t.id)),
        TOAST_TTL_MS
      );
    });
  }, []);

  if (toasts.length === 0) return null;
  return (
    <div className="toasts">
      {toasts.map((t) => (
        <div key={t.id} className={`toast ${t.kind}`}>
          <div className="toast-title">{t.title}</div>
          {t.body && <div className="toast-body">{t.body}</div>}
          <button
            className="toast-close"
            aria-label="Dismiss"
            onClick={() => setToasts((prev) => prev.filter((x) => x.id !== t.id))}
          >
            ×
          </button>
        </div>
      ))}
    </div>
  );
}
