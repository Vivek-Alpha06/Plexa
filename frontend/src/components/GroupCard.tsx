import { Link } from "react-router-dom";
import type { GroupView } from "../types";
import { fmtAmount, fmtDuration, currencyLabel } from "../lib/format";

const STATUS_PILL: Record<string, string> = {
  Forming: "amber",
  Active: "green",
  Completed: "purple",
};

export function GroupCard({ g, youAreMember }: { g: GroupView; youAreMember?: boolean }) {
  return (
    <Link to={`/app/group/${g.id}`} className="card" style={{ display: "block", color: "inherit" }}>
      <div className="row between">
        <div className="stat" style={{ fontSize: 19 }}>
          {g.config.name}
        </div>
        <span className={`pill ${STATUS_PILL[g.state.status] ?? ""}`}>{g.state.status}</span>
      </div>
      <p className="muted" style={{ minHeight: 38, fontSize: 14 }}>
        {g.config.description}
      </p>
      <div className="summary-row">
        <span className="k">Members</span>
        <span className="v">
          {g.members.length}/{g.config.target_members}
        </span>
      </div>
      <div className="summary-row">
        <span className="k">Currency</span>
        <span className="v">{currencyLabel(g.config.currency)}</span>
      </div>
      <div className="summary-row">
        <span className="k">Pot</span>
        <span className="v">{fmtAmount(g.config.pot_size, g.config.currency)}</span>
      </div>
      <div className="summary-row">
        <span className="k">Contribution</span>
        <span className="v">{fmtAmount(g.config.contribution_amount, g.config.currency)}</span>
      </div>
      <div className="summary-row">
        <span className="k">Period</span>
        <span className="v">{fmtDuration(g.config.period_length)}</span>
      </div>
      <div className="row" style={{ marginTop: 12, gap: 8 }}>
        {youAreMember && <span className="pill green">You're in</span>}
        <span className="pill amber">{currencyLabel(g.config.currency)}</span>
        <span className={`pill ${g.config.visibility === "Public" ? "" : "purple"}`}>
          {g.config.visibility}
        </span>
      </div>
    </Link>
  );
}
