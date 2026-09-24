import type { CSSProperties } from "react";
import type { GlowingSeed } from "@/lib/roomPresence";

// A simplified stand-in for the Figma design's ~150 hand-placed decorative
// dots: a deterministic golden-angle spiral (not Math.random — that would
// mismatch between server and client render) inside a few concentric rings.
// One dot per participant, capped at MAX_DOTS — a room with 3,000 people
// waiting still only ever renders 500 dots, not 3,000.
const GOLDEN_ANGLE_DEG = 137.50776;
const VIEWBOX = 260;
const CENTER = VIEWBOX / 2;
const MAX_DOTS = 500;

// A different color per glowing identity (picked deterministically from
// their seed below), so several people glowing at once are visibly distinct
// from each other, not just from the non-glowing crowd.
const GLOW_COLORS = ["#ffcf6b", "#7ce8ff", "#ff8fd1", "#8fffb0", "#c58fff", "#ffb17c"];

function getDotCount(participantCount: number): number {
  return Math.min(MAX_DOTS, Math.max(0, participantCount));
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
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

    // Randomized drift — varied durations so it never reads as a mechanical
    // loop, quick enough to notice while staying gentle rather than jittery.
    const dx = round2(2 + pseudoRandom(i * 7 + 1) * 5);
    const dy = round2(2 + pseudoRandom(i * 7 + 2) * 5);
    const duration = round2(3.5 + pseudoRandom(i * 7 + 3) * 4.5);
    const delay = round2(pseudoRandom(i * 7 + 4) * 10);

    // A much quicker, independent breathing cycle — dims toward a fraction
    // of the dot's own resting opacity and back, each on its own timing so
    // the swarm never pulses in unison.
    const pulseOpacity = round2(opacity * (0.4 + pseudoRandom(i * 7 + 5) * 0.25));
    const pulseDuration = round2(2.6 + pseudoRandom(i * 7 + 6) * 3.2);
    const pulseDelay = round2(pseudoRandom(i * 7 + 7) * 4);

    return { x, y, size, opacity, dx, dy, duration, delay, pulseOpacity, pulseDuration, pulseDelay };
  });
}

type LobbySwarmProps = {
  participantCount: number;
  /** Anonymous seeds for everyone currently checked in (including the
   * viewer, once their own check-in round-trips) — hashed into a dot index
   * and color below so the same identity always lights the same dot for
   * every viewer, not just their own. */
  glowingDots: GlowingSeed[];
};

export default function LobbySwarm({ participantCount, glowingDots }: LobbySwarmProps) {
  const dotCount = getDotCount(participantCount);
  const dots = buildDots(dotCount);

  // Map each glowing identity onto a dot index + color, both derived purely
  // from its seed — deterministic, so it looks identical on every viewer's
  // screen without ever needing to know who anyone actually is. In a small
  // room, dotCount is small too, so a plain `dotSeed % dotCount` collides
  // often (e.g. 4 dots for 4 glowing people lands on ~2 unique slots on
  // average) — linear-probe to the next free slot instead, sorted by seed
  // first so every viewer resolves collisions the exact same way. Every
  // glowing identity gets its own dot as long as there are at least as many
  // dots as glowing people, which holds whenever presence hasn't outlived
  // room membership (i.e. basically always).
  const glowByDotIndex = new Map<number, string>();
  if (dotCount > 0) {
    const sorted = [...glowingDots].sort((a, b) => a.dotSeed - b.dotSeed);
    for (const { dotSeed, colorSeed } of sorted) {
      let index = dotSeed % dotCount;
      for (let attempts = 0; attempts < dotCount && glowByDotIndex.has(index); attempts++) {
        index = (index + 1) % dotCount;
      }
      glowByDotIndex.set(index, GLOW_COLORS[colorSeed % GLOW_COLORS.length]);
    }
  }

  return (
    <svg viewBox={`0 0 ${VIEWBOX} ${VIEWBOX}`} className="block w-full max-w-[260px]" aria-hidden>
      <defs>
        <filter id="lobby-center-glow" x="-60%" y="-60%" width="220%" height="220%">
          <feGaussianBlur stdDeviation="12" />
        </filter>
      </defs>

      {/* The two orbit guide rings breathe subtly too, on their own slightly
          offset timing so they don't pulse in perfect unison. */}
      <circle
        className="lobby-ring"
        cx={CENTER}
        cy={CENTER}
        r={CENTER - 8}
        stroke="rgba(255,255,255,0.07)"
        fill="none"
        style={{ animationDuration: "5s", animationDelay: "0s" }}
      />
      <circle
        className="lobby-ring"
        cx={CENTER}
        cy={CENTER}
        r={CENTER * 0.66}
        stroke="rgba(255,255,255,0.08)"
        fill="none"
        style={{ animationDuration: "6.5s", animationDelay: "1.2s" }}
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
        // A dot only stands out while the identity it hashed to is actually
        // glowing (checked in within the last hour) — otherwise it looks
        // like any other dot, so there's no permanent "this one is someone"
        // tell for a person who's no longer active.
        const glowColor = glowByDotIndex.get(i);
        const isDotGlowing = glowColor !== undefined;
        // --dx/--dy/--o-base/--o-pulse (read via var() inside the keyframes)
        // work fine as custom properties. animationDuration/animationDelay do
        // NOT — set as plain literal values instead (see the note in
        // globals.css). A glowing dot pairs its own drift timing with the
        // glow's fixed 1.8s/0s; every other dot pairs drift with its own
        // independent breathing-pulse timing instead.
        const driftStyle: CSSProperties = {
          ["--dx" as string]: `${dot.dx}px`,
          ["--dy" as string]: `${dot.dy}px`,
          ["--o-base" as string]: `${dot.opacity}`,
          ["--o-pulse" as string]: `${dot.pulseOpacity}`,
          animationDuration: isDotGlowing
            ? `${dot.duration}s, 1.8s`
            : `${dot.duration}s, ${dot.pulseDuration}s`,
          animationDelay: isDotGlowing ? `${dot.delay}s, 0s` : `${dot.delay}s, ${dot.pulseDelay}s`,
        };
        return (
          <circle
            key={i}
            className={`lobby-dot${isDotGlowing ? " lobby-dot-glowing" : ""}`}
            cx={dot.x}
            cy={dot.y}
            r={isDotGlowing ? dot.size / 2 + 1.5 : dot.size / 2}
            fill={isDotGlowing ? glowColor : "white"}
            opacity={isDotGlowing ? 1 : dot.opacity}
            style={driftStyle}
          />
        );
      })}
    </svg>
  );
}
