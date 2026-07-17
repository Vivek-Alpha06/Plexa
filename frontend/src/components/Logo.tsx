import { useId } from "react";

/* Plexa brand mark — a folded "P" monogram inside a 4-node orbital ring
   (members orbiting the pooled protocol). Teal→cyan gradient, tuned to the
   Plexa logo. Flat vector, crisp from 24px to 256px. Reused as navbar logo,
   app header, wallet modal, loading states and favicon. */

// Orbital nodes at the four cardinal points on the ring (viewBox 0 0 64 64).
const NODES: [number, number][] = [
  [32, 6],
  [58, 32],
  [32, 58],
  [6, 32],
];

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
  const gP = `plexa-p-${uid}`;
  const gRing = `plexa-ring-${uid}`;

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
        <linearGradient id={gP} x1="18" y1="12" x2="42" y2="52" gradientUnits="userSpaceOnUse">
          <stop stopColor="#6ee7d6" />
          <stop offset="0.55" stopColor="#22d3ee" />
          <stop offset="1" stopColor="#0e9bb8" />
        </linearGradient>
        <linearGradient id={gRing} x1="6" y1="6" x2="58" y2="58" gradientUnits="userSpaceOnUse">
          <stop stopColor="#5eead4" />
          <stop offset="1" stopColor="#38bdf8" />
        </linearGradient>
      </defs>

      {/* orbital ring — segmented for a technical, in-motion feel */}
      <circle
        cx="32"
        cy="32"
        r="26"
        stroke={`url(#${gRing})`}
        strokeWidth="1.6"
        strokeDasharray="30 12"
        strokeLinecap="round"
        opacity="0.75"
      />

      {/* cardinal member nodes with a soft halo */}
      {NODES.map(([x, y], i) => (
        <g key={i}>
          <circle cx={x} cy={y} r="5.5" fill={`url(#${gRing})`} opacity="0.18" />
          <circle cx={x} cy={y} r="3" fill={`url(#${gRing})`} />
        </g>
      ))}

      {/* P monogram */}
      <g
        stroke={`url(#${gP})`}
        strokeWidth="7.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      >
        <path d="M22 16 V48" />
        <path d="M22 16 H30 A10 10 0 0 1 30 36 H22" />
      </g>

      {/* folded inner facet — the darker ribbon edge on the stem */}
      <path
        d="M20.4 19 V45"
        stroke="#0b6b73"
        strokeWidth="3"
        strokeLinecap="round"
        opacity="0.5"
      />
    </svg>
  );
}
