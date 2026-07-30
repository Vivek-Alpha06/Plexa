// Verifiable transaction receipts for a group.
//
// Reads the contract's own events back off Soroban RPC, so it lists every
// action by every member *and* the keeper — each with the transaction hash
// that produced it, linked to a block explorer. Anyone can check the chain
// themselves rather than taking the UI's word for it.
import { useCallback, useEffect, useState } from "react";
import { fetchOnChainTxs, explorerContractUrl, explorerTxUrl, type ChainTx } from "../lib/txlog";
import { DEMO } from "../lib/config";

/** Contract event topic → human label. */
const LABEL: Record<string, string> = {
  resolved: "Period resolved",
  settled: "Settlement",
  contrib: "Contribution",
  default: "Default covered",
  liquid: "Collateral liquidated",
  claim: "Payout claimed",
  bid: "Auction bid",
  locked: "Collateral locked",
  joined: "Member joined",
  hf_warn: "Health factor warning",
  withdraw: "Collateral withdrawn",
};

export function TxReceipts({ contractId }: { contractId: string }) {
  const [txs, setTxs] = useState<ChainTx[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    if (DEMO) return;
    setBusy(true);
    try {
      setTxs(await fetchOnChainTxs(contractId));
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }, [contractId]);

  useEffect(() => {
    void load();
    // A local write finishing means there's a new event to pick up.
    const onTx = () => void load();
    window.addEventListener("plexa:tx", onTx);
    return () => window.removeEventListener("plexa:tx", onTx);
  }, [load]);

  if (DEMO) {
    return (
      <p className="muted" style={{ fontSize: 13 }}>
        Demo mode — nothing is submitted to the chain, so there are no verifiable
        transaction hashes. Set <code>VITE_DEMO=false</code> to use testnet.
      </p>
    );
  }

  return (
    <div>
      <div className="row" style={{ justifyContent: "space-between", alignItems: "center" }}>
        <a href={explorerContractUrl(contractId)} target="_blank" rel="noreferrer">
          View contract on Stellar Expert ↗
        </a>
        <button className="btn sm" onClick={() => void load()} disabled={busy}>
          {busy ? "Loading…" : "Refresh"}
        </button>
      </div>

      {error && <div className="banner error" style={{ marginTop: 8 }}>{error}</div>}

      {txs && txs.length === 0 && (
        <p className="muted" style={{ fontSize: 13 }}>
          No on-chain activity in the RPC retention window (roughly the last week).
          Older transactions still exist on the ledger — check the contract link above.
        </p>
      )}

      {txs && txs.length > 0 && (
        <table className="table" style={{ marginTop: 8 }}>
          <thead>
            <tr>
              <th>Action</th>
              <th>When</th>
              <th>Transaction hash</th>
            </tr>
          </thead>
          <tbody>
            {txs.map((t, i) => (
              <tr key={`${t.hash}-${i}`}>
                <td>{LABEL[t.kind] ?? t.kind}</td>
                <td className="muted">{new Date(t.ts * 1000).toLocaleString()}</td>
                <td>
                  <a
                    href={explorerTxUrl(t.hash)}
                    target="_blank"
                    rel="noreferrer"
                    title={t.hash}
                    style={{ fontFamily: "monospace", fontSize: 12 }}
                  >
                    {t.hash.slice(0, 10)}…{t.hash.slice(-8)} ↗
                  </a>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
