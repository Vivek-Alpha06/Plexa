// Numbered phase indicator for the create-group wizard.
export function Steps({
  labels,
  current,
  onJump,
}: {
  labels: string[];
  current: number;
  onJump?: (i: number) => void;
}) {
  return (
    <div className="steps">
      {labels.map((label, i) => {
        const cls = i === current ? "active" : i < current ? "done" : "";
        return (
          <div
            key={label}
            className={`step ${cls}`}
            style={{ cursor: onJump && i <= current ? "pointer" : "default" }}
            onClick={() => onJump && i <= current && onJump(i)}
          >
            <span className="num">{i < current ? "✓" : i + 1}</span>
            {label}
          </div>
        );
      })}
    </div>
  );
}
