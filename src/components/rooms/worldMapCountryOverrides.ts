// Manual corrections for world map fragments the Figma export left with a
// generic "Vector_N" layer name instead of a proper ISO code — every
// country made of several disconnected pieces (a mainland plus islands, or
// several separate landmasses) came out of the export this way, since the
// exporter only auto-named single, cleanly-closed shapes after their real
// country. Each entry below was identified by isolating the fragment,
// rendering it against the map's own coordinate space (calibrated against
// already-labeled countries as reference points, e.g. Nigeria/India/Brazil),
// and visually confirming the shape and position genuinely match — not
// guessed from position alone.
//
// This only covers the largest, highest-impact fragments (the mainlands of
// the biggest countries missing an id). Plenty of smaller islands and other
// multi-part countries (Indonesia, Philippines, Norway, and others) remain
// unidentified and simply render as part of the base map without ever being
// able to highlight — narrowing that further would mean tracking down each
// remaining fragment the same way, one at a time.
export const WORLD_MAP_COUNTRY_OVERRIDES: Record<string, string> = {
  Vector_97: "RU", // Russia — main landmass
  Vector_91: "RU", // Sakhalin Island
  Vector_19: "CA", // Canada — main landmass
  Vector_112: "US", // Alaska
  Vector_108: "US", // Contiguous United States
  Vector_40: "CN", // China — main landmass
  Vector_6: "AU", // Australia
  Vector_4: "AR", // Argentina
  Vector_90: "CL", // Chile
  Vector_62: "IT", // Italy
  Vector_64: "JP", // Japan — main islands
  Vector_102: "FR", // France — mainland
  Vector_87: "NZ", // New Zealand — South Island
  Vector_44: "GB", // United Kingdom — Great Britain
};
