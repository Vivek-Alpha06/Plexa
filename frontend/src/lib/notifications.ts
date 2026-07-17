// Persistent, per-address notification center. Every toast that flows through
// the notify() bus is captured here and stored in localStorage keyed by the
// connected address, so members can review past protocol events (auction/
// contribution windows, governance outcomes, winners, health-factor warnings,
// liquidations, collateral availability, …) across reloads.
//
// The <Toasts /> component still shows the transient pop-ups; this layer is the
// durable history behind the header's bell icon.
import { onNotify, type ToastKind } from "./notify";

export interface StoredNotif {
  id: number;
  title: string;
  body?: string;
  kind: ToastKind;
  ts: number; // ms epoch
  read: boolean;
}

const MAX = 100;
let activeAddress: string | null = null;
let seq = 0;

const changeListeners = new Set<() => void>();
function emit(): void {
  changeListeners.forEach((fn) => fn());
}

const keyFor = (addr: string) => `plexa_notifs_${addr}`;

function load(addr: string): StoredNotif[] {
  try {
    const raw = localStorage.getItem(keyFor(addr));
    return raw ? (JSON.parse(raw) as StoredNotif[]) : [];
  } catch {
    return [];
  }
}
function save(addr: string, list: StoredNotif[]): void {
  localStorage.setItem(keyFor(addr), JSON.stringify(list.slice(0, MAX)));
}

/** Tell the store which member's log to append to (call on connect/disconnect). */
export function setActiveAddress(addr: string | null): void {
  if (activeAddress === addr) return;
  activeAddress = addr;
  emit();
}

export function listNotifications(addr: string | null): StoredNotif[] {
  return addr ? load(addr) : [];
}
export function unreadCount(addr: string | null): number {
  return listNotifications(addr).filter((n) => !n.read).length;
}
export function markAllRead(addr: string | null): void {
  if (!addr) return;
  save(addr, load(addr).map((n) => ({ ...n, read: true })));
  emit();
}
export function clearNotifications(addr: string | null): void {
  if (!addr) return;
  save(addr, []);
  emit();
}
export function onNotificationsChange(fn: () => void): () => void {
  changeListeners.add(fn);
  return () => changeListeners.delete(fn);
}

// Capture every toast into the active address's persistent log. Module-level so
// it's wired exactly once for the app's lifetime.
onNotify((t) => {
  if (!activeAddress) return;
  const list = load(activeAddress);
  list.unshift({
    id: Date.now() * 1000 + (seq++ % 1000),
    title: t.title,
    body: t.body,
    kind: t.kind,
    ts: Date.now(),
    read: false,
  });
  save(activeAddress, list);
  emit();
});
