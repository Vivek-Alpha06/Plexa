// Simulated wallet for demo mode: a per-address USDC balance (persisted) plus a
// promise-based "approve/reject" confirmation that a React modal renders, so
// every demo write feels like signing in a real wallet — including funds
// actually leaving / entering the balance.

const BAL_KEY = "plexa_demo_balances_v1";
export const DEMO_START_BALANCE = 10_000n * 10_000_000n; // 10,000 USDC at 7dp

// ------------------------------------------------------ bigint-aware persistence
const replacer = (_k: string, v: unknown) =>
  typeof v === "bigint" ? { __bigint: v.toString() } : v;
const reviver = (_k: string, v: unknown) =>
  v && typeof v === "object" && "__bigint" in (v as object)
    ? BigInt((v as { __bigint: string }).__bigint)
    : v;

type Balances = Record<string, bigint>;

function load(): Balances {
  try {
    const raw = localStorage.getItem(BAL_KEY);
    return raw ? (JSON.parse(raw, reviver) as Balances) : {};
  } catch {
    return {};
  }
}
function save(b: Balances): void {
  localStorage.setItem(BAL_KEY, JSON.stringify(b, replacer));
}

// ---------------------------------------------------------------------- balance
const balListeners = new Set<() => void>();
function emitBalance(): void {
  balListeners.forEach((fn) => fn());
}

/** Subscribe to balance changes (header refresh). Returns an unsubscribe fn. */
export function onDemoBalanceChange(fn: () => void): () => void {
  balListeners.add(fn);
  return () => balListeners.delete(fn);
}

export function getDemoBalance(addr: string): bigint {
  if (!addr) return 0n;
  const b = load();
  return addr in b ? b[addr] : DEMO_START_BALANCE;
}

function setBalance(addr: string, value: bigint): void {
  const b = load();
  b[addr] = value;
  save(b);
  emitBalance();
}

/** Move funds out of an address; throws if it can't cover the amount. */
export function debit(addr: string, amount: bigint): void {
  if (amount <= 0n) return;
  const bal = getDemoBalance(addr);
  if (bal < amount) throw new Error("Insufficient USDC balance in your wallet.");
  setBalance(addr, bal - amount);
}

/** Move funds into an address. */
export function credit(addr: string, amount: bigint): void {
  if (amount <= 0n) return;
  setBalance(addr, getDemoBalance(addr) + amount);
}

// ----------------------------------------------------------------- confirmation
export interface TxRequest {
  id: number;
  title: string; // e.g. "Lock collateral"
  detail: string; // human description
  amount?: bigint; // USDC moved by this tx, if any
  outgoing?: boolean; // true = leaves wallet (default), false = received
  resolve: (approved: boolean) => void;
}

let current: TxRequest | null = null;
let seq = 0;
const txListeners = new Set<(req: TxRequest | null) => void>();

/** A React modal subscribes here; immediately receives any pending request. */
export function subscribeTx(fn: (req: TxRequest | null) => void): () => void {
  txListeners.add(fn);
  fn(current);
  return () => txListeners.delete(fn);
}

/** Open the confirmation modal and resolve true/false on the user's choice. */
export function confirmTx(opts: {
  title: string;
  detail: string;
  amount?: bigint;
  outgoing?: boolean;
}): Promise<boolean> {
  return new Promise((resolve) => {
    current = { id: ++seq, ...opts, resolve };
    txListeners.forEach((fn) => fn(current));
  });
}

/** Called by the modal's Approve / Reject buttons. */
export function resolveTx(approved: boolean): void {
  const req = current;
  current = null;
  txListeners.forEach((fn) => fn(null));
  req?.resolve(approved);
}
