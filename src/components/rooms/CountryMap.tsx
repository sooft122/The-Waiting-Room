import { WORLD_MAP_PATHS, WORLD_MAP_VIEWBOX } from "./worldMapPaths";

// Matches the source design's highlight exactly: a duplicate of the
// country's own outline, stroked in this green instead of the map's normal
// grey, with a soft glow (see #country-glow below) layered on top of the
// base map.
const HIGHLIGHT_COLOR = "#77FF75";

type CountryMapProps = {
  /** ISO 3166-1 alpha-2 codes to light up — anything not matching one of
   * the map's own labeled paths (see worldMapPaths.ts) has no effect. */
  activeCountryCodes: ReadonlySet<string>;
};

export default function CountryMap({ activeCountryCodes }: CountryMapProps) {
  const highlighted = WORLD_MAP_PATHS.filter((path) => activeCountryCodes.has(path.id));

  return (
    <svg viewBox={WORLD_MAP_VIEWBOX} className="block w-full" aria-hidden>
      <defs>
        {/* Same drop-shadow + inner-shadow combination the design uses for
            its own per-country glow, generalized to one shared filter with
            a filter region sized to the whole map (rather than a bounding
            box unique to each country) so any highlighted country can reuse
            it instead of needing one filter per country. */}
        <filter
          id="country-glow"
          x="-40"
          y="-40"
          width="800"
          height="389"
          filterUnits="userSpaceOnUse"
          colorInterpolationFilters="sRGB"
        >
          <feFlood floodOpacity="0" result="BackgroundImageFix" />
          <feColorMatrix
            in="SourceAlpha"
            type="matrix"
            values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 127 0"
            result="hardAlpha"
          />
          <feOffset />
          <feGaussianBlur stdDeviation="4.85" />
          <feComposite in2="hardAlpha" operator="out" />
          <feColorMatrix
            type="matrix"
            values="0 0 0 0 0.466667 0 0 0 0 1 0 0 0 0 0.458824 0 0 0 0.25 0"
          />
          <feBlend mode="normal" in2="BackgroundImageFix" result="effect1_dropShadow" />
          <feBlend mode="normal" in="SourceGraphic" in2="effect1_dropShadow" result="shape" />
          <feColorMatrix
            in="SourceAlpha"
            type="matrix"
            values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 127 0"
            result="hardAlpha"
          />
          <feOffset dy="-6" />
          <feGaussianBlur stdDeviation="1.25" />
          <feComposite in2="hardAlpha" operator="arithmetic" k2="-1" k3="1" />
          <feColorMatrix
            type="matrix"
            values="0 0 0 0 0.466667 0 0 0 0 1 0 0 0 0 0.458824 0 0 0 0.05 0"
          />
          <feBlend mode="normal" in2="shape" result="effect2_innerShadow" />
        </filter>
      </defs>

      {WORLD_MAP_PATHS.map((path) => (
        <path
          key={path.id}
          d={path.d}
          fill="#020408"
          stroke="#A7A7A7"
          strokeWidth="0.2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      ))}

      {/* Glowing outlines layered on top, in their own pass, so a
          highlighted country's glow is never hidden behind a later
          neighboring country's base fill. */}
      {highlighted.map((path) => (
        <g key={path.id} filter="url(#country-glow)">
          <path
            d={path.d}
            fill="none"
            stroke={HIGHLIGHT_COLOR}
            strokeWidth="0.2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </g>
      ))}
    </svg>
  );
}
