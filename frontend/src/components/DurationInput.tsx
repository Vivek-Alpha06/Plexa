import { secondsToDuration, durationToSeconds, type Duration } from "../lib/format";

// Unified days / hours / minutes / seconds input used everywhere a duration is
// configured (Section 10 — no calendar dates in the timing model).
export function DurationInput({
  seconds,
  onChange,
  disabled,
}: {
  seconds: number;
  onChange: (seconds: number) => void;
  disabled?: boolean;
}) {
  const d = secondsToDuration(seconds);
  const set = (patch: Partial<Duration>) =>
    onChange(durationToSeconds({ ...d, ...patch }));

  const units: { key: keyof Duration; label: string; max?: number }[] = [
    { key: "days", label: "Days" },
    { key: "hours", label: "Hours", max: 23 },
    { key: "minutes", label: "Mins", max: 59 },
    { key: "seconds", label: "Secs", max: 59 },
  ];

  return (
    <div className="duration">
      {units.map((u) => (
        <div className="unit" key={u.key}>
          <input
            type="number"
            min={0}
            max={u.max}
            disabled={disabled}
            value={d[u.key]}
            onChange={(e) =>
              set({ [u.key]: Math.max(0, Number(e.target.value) || 0) } as Partial<Duration>)
            }
          />
          <small>{u.label}</small>
        </div>
      ))}
    </div>
  );
}
