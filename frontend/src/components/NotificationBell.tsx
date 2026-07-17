import { useEffect, useRef, useState } from "react";
import {
  listNotifications,
  markAllRead,
  clearNotifications,
  onNotificationsChange,
  setActiveAddress,
  unreadCount,
  type StoredNotif,
} from "../lib/notifications";

/** Header bell: unread badge + dropdown of the connected member's event log. */
export function NotificationBell({ address }: { address: string | null }) {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<StoredNotif[]>([]);
  const [unread, setUnread] = useState(0);
  const ref = useRef<HTMLDivElement>(null);

  // Point the store at the connected member.
  useEffect(() => {
    setActiveAddress(address);
  }, [address]);

  // Keep the list + badge in sync with the store.
  useEffect(() => {
    const refresh = () => {
      setItems(listNotifications(address));
      setUnread(unreadCount(address));
    };
    refresh();
    return onNotificationsChange(refresh);
  }, [address]);

  // Close on outside click.
  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  if (!address) return null;

  const toggle = () => {
    const next = !open;
    setOpen(next);
    if (next && unread > 0) markAllRead(address);
  };

  return (
    <div className="notif" ref={ref} style={{ position: "relative" }}>
      <button
        className="btn sm notif-bell"
        onClick={toggle}
        title="Notifications"
        aria-label="Notifications"
      >
        <BellIcon />
        {unread > 0 && <span className="notif-badge">{unread > 9 ? "9+" : unread}</span>}
      </button>

      {open && (
        <div className="notif-panel">
          <div className="row between" style={{ padding: "10px 12px", borderBottom: "1px solid var(--border)" }}>
            <strong>Notifications</strong>
            {items.length > 0 && (
              <button className="btn sm ghost" onClick={() => clearNotifications(address)}>
                Clear
              </button>
            )}
          </div>
          {items.length === 0 ? (
            <div className="muted" style={{ padding: 16, textAlign: "center" }}>
              No notifications yet. Protocol events will appear here.
            </div>
          ) : (
            <div className="notif-list">
              {items.map((n) => (
                <div key={n.id} className={`notif-item ${n.kind}`}>
                  <div className="notif-item-title">{n.title}</div>
                  {n.body && <div className="notif-item-body">{n.body}</div>}
                  <div className="faint" style={{ fontSize: 11, marginTop: 2 }}>
                    {new Date(n.ts).toLocaleString()}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function BellIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
      <path d="M13.73 21a2 2 0 0 1-3.46 0" />
    </svg>
  );
}
