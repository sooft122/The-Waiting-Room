"use client";

import { useState } from "react";
import { getCountryFlagEmoji } from "@/lib/countries";

type CountryFlagProps = {
  code: string;
};

/**
 * A real flag image (flagcdn.com, by ISO code) rather than the Unicode
 * flag emoji — Windows' emoji font has no colored flag glyphs (regional
 * indicator pairs render as two letter tiles, or nothing), so the emoji
 * version was invisible on desktop even though it looked fine on iOS/macOS.
 * Falls back to the emoji only if the image itself fails to load.
 */
export default function CountryFlag({ code }: CountryFlagProps) {
  const [errored, setErrored] = useState(false);

  if (errored) {
    return <span className="text-[16px]">{getCountryFlagEmoji(code)}</span>;
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      alt=""
      src={`https://flagcdn.com/${code.toLowerCase()}.svg`}
      className="size-full object-cover"
      onError={() => setErrored(true)}
    />
  );
}
