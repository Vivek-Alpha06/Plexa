import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useWallet } from "../context/WalletContext";
import { Steps } from "../components/Steps";
import { DurationInput } from "../components/DurationInput";
import { factory } from "../lib/contracts";
import { usdcToUnits, fmtAmount, currencyLabel, fmtDuration, shortAddr } from "../lib/format";
import type { CreateGroupForm, Visibility, Currency } from "../types";

const STEP_LABELS = ["Basics", "Cadence & Cycles", "Finance", "Review & Deploy"];

const DEFAULT_FORM: CreateGroupForm = {
  name: "",
  description: "",
  targetMembers: 5,
  visibility: "Public",
  currency: "Usdc",
  periodLength: 7 * 86400, // 7 days
  contributionWindow: 3 * 86400,
  settlementWindow: 1 * 86400,
  auctionWindow: 2 * 86400,
  contributionAmount: "10",
  minReputation: 0,
};

export function CreateGroup() {
  const { address, openPicker } = useWallet();
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [form, setForm] = useState<CreateGroupForm>(DEFAULT_FORM);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const set = <K extends keyof CreateGroupForm>(k: K, v: CreateGroupForm[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  // Derived finance / cadence values.
  const d = useMemo(() => {
    const contribUnits = usdcToUnits(form.contributionAmount);
    const pot = contribUnits * BigInt(form.targetMembers || 0);
    const payoutWindow =
      form.periodLength -
      form.contributionWindow -
      form.settlementWindow -
      form.auctionWindow;
    return {
      contribUnits,
      pot,
      collateral: pot, // USDC option: 100% of pot
      cycles: form.targetMembers,
      payoutWindow,
      total: form.periodLength * form.targetMembers,
      windowsValid:
        payoutWindow > 0 &&
        form.contributionWindow > 0 &&
        form.settlementWindow > 0 &&
        form.auctionWindow > 0,
    };
  }, [form]);

  const stepValid = (s: number): boolean => {
    switch (s) {
      case 0:
        return (
          !!address &&
          form.name.trim().length > 0 &&
          form.description.trim().length > 0 &&
          form.targetMembers >= 2 &&
          form.targetMembers <= 255
        );
      case 1:
        return form.periodLength > 0 && d.windowsValid;
      case 2:
        return d.contribUnits > 0n;
      default:
        return true;
    }
  };

  async function deploy() {
    if (!address) return;
    setBusy(true);
    setError(null);
    try {
      const id = await factory.createGroup(address, {
        owner: address,
        name: form.name.trim(),
        description: form.description.trim(),
        targetMembers: form.targetMembers,
        visibility: form.visibility,
        currency: form.currency,
        periodLength: form.periodLength,
        contributionWindow: form.contributionWindow,
        settlementWindow: form.settlementWindow,
        auctionWindow: form.auctionWindow,
        contributionAmount: d.contribUnits,
        minReputation: form.minReputation,
      });
      navigate(`/app/group/${id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <h1 style={{ marginBottom: 6 }}>Create a Group</h1>
      <p className="muted" style={{ marginTop: 0, marginBottom: 24 }}>
        Four quick steps. Everything financial and time-based locks permanently when you deploy.
      </p>

      <Steps labels={STEP_LABELS} current={step} onJump={setStep} />

      {!address && (
        <div className="banner info">
          Connect your wallet to set the owner and deploy.{" "}
          <button className="btn sm" onClick={openPicker} style={{ marginLeft: 8 }}>
            Connect
          </button>
        </div>
      )}
      {error && <div className="banner error">{error}</div>}

      <div className="split">
        <div className="card pad-lg">
          {step === 0 && <PhaseBasics form={form} set={set} owner={address} />}
          {step === 1 && <PhaseCadence form={form} set={set} d={d} />}
          {step === 2 && <PhaseFinance form={form} set={set} d={d} />}
          {step === 3 && <PhaseReview form={form} d={d} owner={address} />}

          <div className="row between" style={{ marginTop: 24 }}>
            <button
              className="btn ghost"
              disabled={step === 0}
              onClick={() => setStep((s) => s - 1)}
            >
              ← Back{step > 0 ? ` · ${STEP_LABELS[step - 1]}` : ""}
            </button>
            {step < 3 ? (
              <button
                className="btn primary"
                disabled={!stepValid(step)}
                onClick={() => setStep((s) => s + 1)}
              >
                Next · {STEP_LABELS[step + 1]} →
              </button>
            ) : (
              <button className="btn primary" disabled={busy || !address} onClick={deploy}>
                {busy ? "Deploying…" : "Sign & Deploy"}
              </button>
            )}
          </div>
        </div>

        <SidePanel step={step} form={form} d={d} owner={address} />
      </div>
    </div>
  );
}

// ----------------------------------------------------------------- Phase 1
function PhaseBasics({
  form,
  set,
  owner,
}: {
  form: CreateGroupForm;
  set: <K extends keyof CreateGroupForm>(k: K, v: CreateGroupForm[K]) => void;
  owner: string | null;
}) {
  async function onImage(file: File) {
    const dataUrl = await resizeImage(file, 256);
    set("imageDataUrl", dataUrl);
  }
  return (
    <div>
      <h2>Basics</h2>
      <p className="muted">Shown to people you invite.</p>
      <label className="field">
        <span>Group name *</span>
        <input
          value={form.name}
          maxLength={48}
          placeholder="Sunday Savers"
          onChange={(e) => set("name", e.target.value)}
        />
      </label>
      <label className="field">
        <span>Description *</span>
        <textarea
          value={form.description}
          maxLength={280}
          placeholder="What's this group for and what do you expect from members?"
          onChange={(e) => set("description", e.target.value)}
        />
      </label>
      <label className="field">
        <span>Group image (optional)</span>
        <input
          type="file"
          accept="image/*"
          onChange={(e) => e.target.files?.[0] && onImage(e.target.files[0])}
        />
      </label>
      <div className="grid cols-2">
        <label className="field">
          <span>Target members (incl. you) — locks at deploy *</span>
          <input
            type="number"
            min={2}
            max={255}
            value={form.targetMembers}
            onChange={(e) =>
              set("targetMembers", Math.min(255, Math.max(2, Number(e.target.value) || 2)))
            }
          />
        </label>
        <label className="field">
          <span>Visibility</span>
          <select
            value={form.visibility}
            onChange={(e) => set("visibility", e.target.value as Visibility)}
          >
            <option value="Public">Public — in discovery feed</option>
            <option value="Private">Private — invite link only</option>
          </select>
        </label>
      </div>
      <label className="field">
        <span>Owner (read-only)</span>
        <input value={owner ?? "Connect wallet…"} readOnly />
      </label>
    </div>
  );
}

// ----------------------------------------------------------------- Phase 2
function PhaseCadence({
  form,
  set,
  d,
}: {
  form: CreateGroupForm;
  set: <K extends keyof CreateGroupForm>(k: K, v: CreateGroupForm[K]) => void;
  d: Derived;
}) {
  return (
    <div>
      <h2>Cadence & Cycles</h2>
      <p className="muted">
        Each period splits into <b>four</b> windows. The group auto-starts the moment all
        members have joined, locked collateral and paid their first contribution — there is no
        fixed start date.
      </p>
      <label className="field">
        <span>Period length</span>
        <DurationInput seconds={form.periodLength} onChange={(s) => set("periodLength", s)} />
      </label>
      <label className="field">
        <span>Contribution window</span>
        <DurationInput
          seconds={form.contributionWindow}
          onChange={(s) => set("contributionWindow", s)}
        />
      </label>
      <label className="field">
        <span>
          Settlement window{" "}
          <span className="faint">— dev-configurable; a fixed protocol value in production</span>
        </span>
        <DurationInput
          seconds={form.settlementWindow}
          onChange={(s) => set("settlementWindow", s)}
        />
      </label>
      <label className="field">
        <span>Auction window</span>
        <DurationInput seconds={form.auctionWindow} onChange={(s) => set("auctionWindow", s)} />
      </label>
      <label className="field">
        <span>Payout window (derived = period − contribution − settlement − auction)</span>
        <input
          readOnly
          value={d.payoutWindow > 0 ? fmtDuration(d.payoutWindow) : "⚠ windows exceed period"}
          style={{ color: d.payoutWindow > 0 ? undefined : "var(--danger)" }}
        />
      </label>
      {d.payoutWindow <= 0 && (
        <div className="banner error" style={{ marginTop: 8 }}>
          Contribution + settlement + auction windows exceed the period length. Reduce a window
          or extend the period so the payout window is positive.
        </div>
      )}
    </div>
  );
}

// ----------------------------------------------------------------- Phase 3
function PhaseFinance({
  form,
  set,
  d,
}: {
  form: CreateGroupForm;
  set: <K extends keyof CreateGroupForm>(k: K, v: CreateGroupForm[K]) => void;
  d: Derived;
}) {
  const cur = currencyLabel(form.currency);
  return (
    <div>
      <h2>Finance</h2>
      <p className="muted">
        Pick the group currency first — every contribution and payout flows in that token.
        {form.currency === "Usdc"
          ? " Each member then chooses their collateral asset when they join: USDC at 100% of the pot, or XLM at 150% (priced live by the oracle)."
          : " Members lock XLM collateral at 100% of the pot (same asset — no price risk)."}
      </p>
      <label className="field">
        <span>Group currency — locks at deploy *</span>
        <select
          value={form.currency}
          onChange={(e) => set("currency", e.target.value as Currency)}
        >
          <option value="Usdc">USDC — contributions & payouts in USDC</option>
          <option value="Xlm">XLM — contributions & payouts in XLM</option>
        </select>
      </label>
      <label className="field">
        <span>Contribution amount per period ({cur})</span>
        <input
          type="number"
          min={0}
          step="0.01"
          value={form.contributionAmount}
          onChange={(e) => set("contributionAmount", e.target.value)}
        />
      </label>
      <div className="grid cols-2">
        <div className="card" style={{ background: "var(--bg-elev-2)", boxShadow: "none" }}>
          <div className="muted">Pot size (auto)</div>
          <div className="stat">{fmtAmount(d.pot, form.currency)}</div>
          <div className="faint">{form.contributionAmount || 0} × {form.targetMembers} members</div>
        </div>
        <div className="card" style={{ background: "var(--bg-elev-2)", boxShadow: "none" }}>
          <div className="muted">Collateral / member</div>
          <div className="stat">{fmtAmount(d.collateral, form.currency)}</div>
          <div className="faint">
            {form.currency === "Usdc"
              ? "USDC 100% · or 150% of value in XLM"
              : "XLM 100% — same asset as the pot"}
          </div>
        </div>
      </div>
      <label className="field" style={{ marginTop: 16 }}>
        <span>Reputation gate — min. completed cycles to join (0 disables)</span>
        <input
          type="number"
          min={0}
          value={form.minReputation}
          onChange={(e) => set("minReputation", Math.max(0, Number(e.target.value) || 0))}
        />
      </label>
      <div className="banner info" style={{ marginTop: 8 }}>
        <strong>Platform fee:</strong> none. v1 takes no fee from the pot at payout.
      </div>
    </div>
  );
}

// ----------------------------------------------------------------- Phase 4
function PhaseReview({
  form,
  d,
  owner,
}: {
  form: CreateGroupForm;
  d: Derived;
  owner: string | null;
}) {
  return (
    <div>
      <h2>Review & Deploy</h2>
      <p className="muted">
        After signing, Target Members, period timing, contribution amount and collateral are
        immutable.
      </p>
      <div className="section-title">Basics</div>
      <SummaryRow k="Name" v={form.name} />
      <SummaryRow k="Description" v={form.description} />
      <SummaryRow k="Members" v={`${form.targetMembers}`} />
      <SummaryRow k="Visibility" v={form.visibility} />
      <SummaryRow k="Owner" v={owner ? shortAddr(owner) : "—"} />
      <div className="section-title">Cadence</div>
      <SummaryRow k="Period" v={fmtDuration(form.periodLength)} />
      <SummaryRow k="Contribution" v={fmtDuration(form.contributionWindow)} />
      <SummaryRow k="Settlement" v={fmtDuration(form.settlementWindow)} />
      <SummaryRow k="Auction" v={fmtDuration(form.auctionWindow)} />
      <SummaryRow k="Payout (derived)" v={fmtDuration(d.payoutWindow)} />
      <SummaryRow k="Cycles" v={`${d.cycles}`} />
      <SummaryRow k="Total duration" v={fmtDuration(d.total)} />
      <div className="section-title">Finance</div>
      <SummaryRow k="Currency" v={currencyLabel(form.currency)} />
      <SummaryRow k="Contribution / period" v={fmtAmount(d.contribUnits, form.currency)} />
      <SummaryRow k="Pot size" v={fmtAmount(d.pot, form.currency)} />
      <SummaryRow k="Collateral / member" v={fmtAmount(d.collateral, form.currency)} />
      <SummaryRow k="Reputation gate" v={form.minReputation ? `${form.minReputation}+ cycles` : "disabled"} />
    </div>
  );
}

// ----------------------------------------------------------------- side panel
function SidePanel({
  step,
  form,
  d,
  owner,
}: {
  step: number;
  form: CreateGroupForm;
  d: Derived;
  owner: string | null;
}) {
  return (
    <div className="card" style={{ position: "sticky", top: 20 }}>
      {step >= 1 ? (
        <>
          <div className="section-title" style={{ marginTop: 0 }}>
            Cadence Summary
          </div>
          <SummaryRow k="Period" v={fmtDuration(form.periodLength)} />
          <SummaryRow k="Contribution" v={fmtDuration(form.contributionWindow)} />
          <SummaryRow k="Settlement" v={fmtDuration(form.settlementWindow)} />
          <SummaryRow k="Auction" v={fmtDuration(form.auctionWindow)} />
          <SummaryRow
            k="Payout"
            v={d.payoutWindow > 0 ? fmtDuration(d.payoutWindow) : "⚠ invalid"}
          />
          <SummaryRow k="Cycles" v={`${d.cycles}`} />
          <SummaryRow k="Total" v={fmtDuration(d.total)} />
          <div className="section-title">Finance</div>
          <SummaryRow k="Currency" v={currencyLabel(form.currency)} />
          <SummaryRow k="Pot" v={fmtAmount(d.pot, form.currency)} />
          <SummaryRow k="Collateral" v={fmtAmount(d.collateral, form.currency)} />
        </>
      ) : (
        <>
          <div className="section-title" style={{ marginTop: 0 }}>
            Group Preview
          </div>
          {form.imageDataUrl && (
            <img
              src={form.imageDataUrl}
              alt=""
              style={{ width: "100%", borderRadius: 10, marginBottom: 12 }}
            />
          )}
          <div className="stat" style={{ fontSize: 22 }}>
            {form.name || "Untitled group"}
          </div>
          <p className="muted" style={{ minHeight: 36 }}>
            {form.description || "Your description appears here."}
          </p>
          <SummaryRow k="Members" v={`${form.targetMembers}`} />
          <SummaryRow k="Owner" v={owner ? shortAddr(owner) : "—"} />
          <SummaryRow k="Visibility" v={form.visibility} />
        </>
      )}
    </div>
  );
}

function SummaryRow({ k, v }: { k: string; v: string }) {
  return (
    <div className="summary-row">
      <span className="k">{k}</span>
      <span className="v" style={{ maxWidth: 200, textAlign: "right" }}>
        {v || "—"}
      </span>
    </div>
  );
}

type Derived = {
  contribUnits: bigint;
  pot: bigint;
  collateral: bigint;
  cycles: number;
  payoutWindow: number;
  total: number;
  windowsValid: boolean;
};

// Resize an uploaded image to a max dimension via canvas, returning a data URL.
async function resizeImage(file: File, max: number): Promise<string> {
  const dataUrl = await new Promise<string>((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(r.result as string);
    r.onerror = rej;
    r.readAsDataURL(file);
  });
  return new Promise<string>((res) => {
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, max / Math.max(img.width, img.height));
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(img.width * scale);
      canvas.height = Math.round(img.height * scale);
      const ctx = canvas.getContext("2d");
      ctx?.drawImage(img, 0, 0, canvas.width, canvas.height);
      res(canvas.toDataURL("image/jpeg", 0.85));
    };
    img.src = dataUrl;
  });
}
