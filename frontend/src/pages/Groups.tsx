import { useState } from "react";
import { Link } from "react-router-dom";
import { useWallet } from "../context/WalletContext";
import { useGroups } from "../lib/useGroups";
import { CONFIGURED } from "../lib/config";
import { GroupCard } from "../components/GroupCard";
import type { GroupView } from "../types";

type Category = "all" | "forming" | "active" | "completed";

const CATEGORIES: { key: Category; label: string }[] = [
  { key: "all", label: "Total Groups" },
  { key: "forming", label: "Forming Groups" },
  { key: "active", label: "Active Groups" },
  { key: "completed", label: "Completed Groups" },
];

type CurrencyFilter = "all" | "Usdc" | "Xlm";

export function Groups() {
  const { address } = useWallet();
  const { views, loading, error } = useGroups();
  const [category, setCategory] = useState<Category>("all");
  const [query, setQuery] = useState("");
  const [currency, setCurrency] = useState<CurrencyFilter>("all");

  const isMine = (g: GroupView) => !!address && g.members.some((m) => m.addr === address);

  const matchesSearch = (g: GroupView) => {
    if (currency !== "all" && g.config.currency !== currency) return false;
    const q = query.trim().toLowerCase();
    if (!q) return true;
    const cur = g.config.currency === "Xlm" ? "xlm" : "usdc";
    return (
      g.config.name.toLowerCase().includes(q) ||
      g.config.description.toLowerCase().includes(q) ||
      cur.includes(q)
    );
  };

  const counts = {
    all: views.length,
    forming: views.filter((g) => g.state.status === "Forming").length,
    active: views.filter((g) => g.state.status === "Active").length,
    completed: views.filter((g) => g.state.status === "Completed").length,
  };

  const inCategory = (g: GroupView) =>
    category === "all" ||
    (category === "forming" && g.state.status === "Forming") ||
    (category === "active" && g.state.status === "Active") ||
    (category === "completed" && g.state.status === "Completed");

  const visible = views.filter((g) => inCategory(g) && matchesSearch(g));
  const mine = visible.filter((g) => isMine(g) && g.state.status !== "Completed");
  const completed = visible.filter((g) => isMine(g) && g.state.status === "Completed");
  const discover = visible.filter(
    (g) => g.config.visibility === "Public" && !isMine(g) && g.state.status !== "Completed"
  );

  return (
    <div>
      <div className="row between" style={{ marginBottom: 20 }}>
        <div>
          <h1 style={{ marginBottom: 4 }}>Groups</h1>
          <p className="muted" style={{ margin: 0 }}>
            Your rotating savings groups and public ones you can join.
          </p>
        </div>
        <Link to="/app/create" className="btn primary">
          + Create Group
        </Link>
      </div>

      {!CONFIGURED && (
        <div className="banner error">
          No factory configured. Set <code>VITE_FACTORY_ID</code> in <code>.env</code> after
          deploying the contracts, or set <code>VITE_DEMO=true</code> to use local demo mode.
        </div>
      )}
      {error && <div className="banner error">{error}</div>}

      {/* Search + currency filter — groups display and match by their currency. */}
      <div className="row" style={{ gap: 10, marginBottom: 16 }}>
        <input
          value={query}
          placeholder="Search groups by name, description or currency (XLM / USDC)…"
          onChange={(e) => setQuery(e.target.value)}
          style={{ flex: 1 }}
        />
        <select
          value={currency}
          onChange={(e) => setCurrency(e.target.value as CurrencyFilter)}
          style={{ width: 180 }}
        >
          <option value="all">All currencies</option>
          <option value="Usdc">USDC groups</option>
          <option value="Xlm">XLM groups</option>
        </select>
      </div>

      {/* Category navigation — click a tile to filter. */}
      <div className="grid cols-4" style={{ marginBottom: 16 }}>
        {CATEGORIES.map((c) => (
          <button
            key={c.key}
            className="card"
            onClick={() => setCategory(c.key)}
            style={{
              textAlign: "left",
              cursor: "pointer",
              borderColor: category === c.key ? "var(--accent)" : undefined,
              background: category === c.key ? "var(--bg-elev-2)" : undefined,
            }}
          >
            <div className="muted">{c.label}</div>
            <div className="stat">{counts[c.key]}</div>
          </button>
        ))}
      </div>

      {loading ? (
        <div className="center muted">Loading groups…</div>
      ) : (
        <>
          <div className="section-title">Your groups</div>
          {mine.length ? (
            <div className="grid cols-3">
              {mine.map((g) => (
                <GroupCard key={g.id} g={g} youAreMember />
              ))}
            </div>
          ) : (
            <div className="card muted">
              {address
                ? "No groups in this category. Create one or join from discovery below."
                : "Connect your wallet to see your groups."}
            </div>
          )}

          <div className="section-title">Discover public groups</div>
          {discover.length ? (
            <div className="grid cols-3">
              {discover.map((g) => (
                <GroupCard key={g.id} g={g} />
              ))}
            </div>
          ) : (
            <div className="card muted">No public groups to discover in this category.</div>
          )}

          {completed.length > 0 && (
            <>
              <div className="section-title">Completed groups</div>
              <div className="grid cols-3">
                {completed.map((g) => (
                  <GroupCard key={g.id} g={g} youAreMember />
                ))}
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}
