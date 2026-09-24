// Pure helpers for turning an ISO 3166-1 alpha-2 country code into display
// text — dependency-free (uses the platform's own Intl support, available in
// both Node and every browser) so this can be imported from client
// components without pulling in anything server-only.

const regionNames = typeof Intl !== "undefined" && "DisplayNames" in Intl
  ? new Intl.DisplayNames(["en"], { type: "region" })
  : null;

/** "NG" -> "Nigeria". Falls back to the raw code if it isn't recognized. */
export function getCountryName(code: string): string {
  try {
    return regionNames?.of(code.toUpperCase()) ?? code;
  } catch {
    return code;
  }
}

/** "NG" -> "🇳🇬" — built from the Unicode regional indicator symbols, so
 * this works for any ISO code without shipping a single flag image. */
export function getCountryFlagEmoji(code: string): string {
  const upper = code.toUpperCase();
  if (!/^[A-Z]{2}$/.test(upper)) return "🏳️";
  return String.fromCodePoint(...upper.split("").map((char) => 127397 + char.charCodeAt(0)));
}
