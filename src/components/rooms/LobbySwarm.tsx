import type { CSSProperties } from "react";

// A simplified stand-in for the Figma design's ~150 hand-placed decorative
// dots: a deterministic golden-angle spiral (not Math.random — that would
// mismatch between server and client render) inside a few concentric rings.
// Dot count scales gently with participantCount (never 1:1 — a room with a
// million waiting shouldn't render a million dots, just "a lot" of them),
// and each dot drifts slowly along its own small loop via CSS.
const GOLDEN_ANGLE_DEG = 137.50776;
const VIEWBOX = 260;
const CENTER = VIEWBOX / 2;
const MIN_DOTS = 8;
const MAX_DOTS = 60;

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

/** Small deterministic string hash (djb2-ish) — picks a stable dot per identity. */
function hashString(value: string): number {
  let hash = 5381;
  for (let i = 0; i < value.length; i++) {
    hash = (hash * 33 + value.charCodeAt(i)) >>> 0;
  }
  return hash;
}

/** Deterministic 0..1 "random" from an integer seed (mulberry32-style mix) —
 * looks random per dot, but is a pure function of its index, so server and
 * client always render the exact same markup. */
function pseudoRandom(seed: number): number {
  let t = (seed + 0x6d2b79f5) | 0;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

// Dots orbit in the ring between the solid center disc and the outer edge —
// none of them start inside the disc, so nothing overlaps the "are waiting"
// text.
const DISC_RADIUS = 64;
const DOT_MIN_RADIUS = DISC_RADIUS + 8;
const DOT_MAX_RADIUS = CENTER - 8;

function buildDots(count: number) {
  return Array.from({ length: count }, (_, i) => {
    // Start from the golden-angle spiral for even coverage, then jitter each
    // dot's angle/radius so the layout reads as scattered, not a neat spiral.
    const baseAngle = (i * GOLDEN_ANGLE_DEG * Math.PI) / 180;
    const baseRadiusT = Math.sqrt((i + 1) / count);
    const angle = baseAngle + (pseudoRandom(i * 4 + 1) - 0.5) * 1.1;
    const radiusT = Math.min(1, Math.max(0, baseRadiusT + (pseudoRandom(i * 4 + 2) - 0.5) * 0.35));

    const r = DOT_MIN_RADIUS + radiusT * (DOT_MAX_RADIUS - DOT_MIN_RADIUS);
    const x = round2(CENTER + Math.cos(angle) * r);
    const y = round2(CENTER + Math.sin(angle) * r);

    const size = round2(2.5 + pseudoRandom(i * 4 + 3) * 4);
    const opacity = round2(0.22 + pseudoRandom(i * 4) * 0.55);

    // Slow, randomized drift — long, varied durations so it never reads as
    // a mechanical loop, and stays gentle rather than jittery.
    const dx = round2(2 + pseudoRandom(i * 7 + 1) * 5);
    const dy = round2(2 + pseudoRandom(i * 7 + 2) * 5);
    const duration = round2(28 + pseudoRandom(i * 7 + 3) * 34);
    const delay = round2(pseudoRandom(i * 7 + 4) * 10);

    return { x, y, size, opacity, dx, dy, duration, delay };
  });
}

type LobbySwarmProps = {
  participantCount: number;
  /** Stable identity string used to deterministically pick "your" dot. */
  identity: string | null;
  /** Whether "your" dot should currently glow (recently checked in). */
  isGlowing: boolean;
};

export default function LobbySwarm({ participantCount, identity, isGlowing }: LobbySwarmProps) {
  const dotCount = Math.min(
    MAX_DOTS,
    Math.max(MIN_DOTS, Math.round(Math.sqrt(Math.max(participantCount, 0)) * 6)),
  );
  const dots = buildDots(dotCount);
  const meIndex = identity ? hashString(identity) % dotCount : -1;

  return (
    <svg viewBox={`0 0 ${VIEWBOX} ${VIEWBOX}`} className="block w-full max-w-[260px]" aria-hidden>
      <defs>
        <filter id="lobby-center-glow" x="-60%" y="-60%" width="220%" height="220%">
          <feGaussianBlur stdDeviation="12" />
        </filter>
      </defs>

      <circle cx={CENTER} cy={CENTER} r={CENTER - 8} stroke="rgba(255,255,255,0.07)" fill="none" />
      <circle
        cx={CENTER}
        cy={CENTER}
        r={CENTER * 0.66}
        stroke="rgba(255,255,255,0.08)"
        fill="none"
      />

      {/* Subtle glow halo behind the center disc. */}
      <circle
        cx={CENTER}
        cy={CENTER}
        r={DISC_RADIUS + 14}
        fill="rgba(150, 160, 190, 0.22)"
        filter="url(#lobby-center-glow)"
      />
      {/* Solid (non-transparent) disc, sized to comfortably hold the count
          + "are waiting" text rendered on top of it in LobbyCard. */}
      <circle cx={CENTER} cy={CENTER} r={DISC_RADIUS} fill="#1c1d22" />
      <circle
        cx={CENTER}
        cy={CENTER}
        r={DISC_RADIUS}
        fill="none"
        stroke="rgba(255,255,255,0.06)"
      />

      {dots.map((dot, i) => {
        // The viewer's own dot only stands out while it's actually glowing
        // (recently checked in) — otherwise it looks like any other dot, so
        // there's no permanent "this one is you" tell.
        const isMeGlowing = i === meIndex && isGlowing;
        const driftStyle: CSSProperties = {
          ["--dx" as string]: `${dot.dx}px`,
          ["--dy" as string]: `${dot.dy}px`,
          ["--drift-duration" as string]: `${dot.duration}s`,
          ["--drift-delay" as string]: `${dot.delay}s`,
        };
        return (
          <circle
            key={i}
            className={`lobby-dot${isMeGlowing ? " lobby-dot-me" : ""}`}
            cx={dot.x}
            cy={dot.y}
            r={isMeGlowing ? dot.size / 2 + 1.5 : dot.size / 2}
            fill={isMeGlowing ? "#ffcf6b" : "white"}
            opacity={isMeGlowing ? 1 : dot.opacity}
            style={driftStyle}
          />
        );
      })}
    </svg>
  );
}
