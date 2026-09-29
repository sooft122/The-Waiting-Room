import CountryFlag from "@/components/rooms/CountryFlag";
import { getCountryName } from "@/lib/countries";

/** A small flag image — the same one the site's own country list uses, since
 * Windows can't draw flag emoji. */
export default function Flag({ code }: { code: string }) {
  return (
    <span
      title={getCountryName(code)}
      className="inline-flex h-[11px] w-4 shrink-0 overflow-hidden rounded-[2px] align-[-1px] ring-1 ring-white/10"
    >
      <CountryFlag code={code} />
    </span>
  );
}
