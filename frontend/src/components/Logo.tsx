import { useId } from "react";

/* Plexa brand mark — a geometric "P" built from a solid stem and a half-ring
   bowl (a torus segment, not a filled blob), set inside a faint single-node
   orbital path. Teal→cyan gradient (#27E0D7 → #0BA7C2). Flat vector, no blur
   or glow — reused as navbar logo, wallet modal, landing hero and favicon. */

export function PlexaMark({
  size = 40,
  className,
  title = "Plexa",
}: {
  size?: number;
  className?: string;
  title?: string;
}) {
  const uid = useId();
  const grad = `plexa-grad-${uid}`;

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-label={title}
      className={`plexa-mark ${className ?? ""}`}
    >
      <defs>
        <linearGradient id={grad} x1="0" y1="0" x2="64" y2="64" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#27E0D7" />
          <stop offset="100%" stopColor="#0BA7C2" />
        </linearGradient>
      </defs>

      {/* faint orbital path — a single satellite node, not a busy ring of dots */}
      <circle cx="32" cy="32" r="27" stroke={`url(#${grad})`} strokeWidth="1" opacity="0.3" />
      <circle cx="54" cy="17" r="3.2" fill={`url(#${grad})`} />

      {/* bowl — a half-ring (torus segment), giving the letterform an
          orbital cross-section instead of a plain filled counter */}
      <circle cx="30" cy="24" r="10.5" fill="none" stroke={`url(#${grad})`} strokeWidth="9" />

      {/* stem — drawn last so it cleanly covers the ring's left half,
          leaving only the bowl's outer arc visible */}
      <rect x="19" y="9" width="11" height="43" rx="3" fill={`url(#${grad})`} />

      {/* subtle depth accent — a single fold line, no blur/glow */}
      <line x1="21.6" y1="12.5" x2="21.6" y2="48.5" stroke="#0A7C8C" strokeWidth="1.3" strokeLinecap="round" opacity="0.35" />
    </svg>
  );
}
