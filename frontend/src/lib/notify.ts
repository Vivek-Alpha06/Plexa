// Tiny in-app notification bus. Any module (hooks, contract layer) can call
// notify(); the <Toasts /> component subscribes and renders the stack.
// Kept as a plain event bus (not React context) so non-React code can fire
// notifications without prop-drilling — same pattern as lib/wallet.ts.

export type ToastKind = "info" | "success" | "warn";

export interface Toast {
  id: number;
  title: string;
  body?: string;
  kind: ToastKind;
}

type Listener = (t: Toast) => void;

let nextId = 1;
const listeners = new Set<Listener>();

export function notify(title: string, body?: string, kind: ToastKind = "info"): void {
  const toast: Toast = { id: nextId++, title, body, kind };
  for (const fn of listeners) fn(toast);
}

export function onNotify(fn: Listener): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
