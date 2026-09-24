import { getCountryFlagEmoji, getCountryName } from "@/lib/countries";
import type { CountryBreakdown } from "@/lib/roomCountry";
import CountryMap from "./CountryMap";

type CountriesCardProps = {
  countries: CountryBreakdown[];
};

export default function CountriesCard({ countries }: CountriesCardProps) {
  const activeCountryCodes = new Set(countries.map((entry) => entry.code));

  return (
    <div className="flex w-full flex-col overflow-hidden rounded-[20px] bg-[#08090b]">
      <div className="flex h-[50px] w-full shrink-0 items-center bg-[#101113] px-[17px]">
        <h2 className="font-figtree text-[14px] text-white">Where the World Is Waiting</h2>
      </div>

      <div className="flex flex-col gap-[17px] p-[17px] lg:flex-row">
        <div className="flex min-w-0 flex-1 items-center justify-center">
          <CountryMap activeCountryCodes={activeCountryCodes} />
        </div>

        <div className="relative w-full shrink-0 overflow-hidden rounded-[10px] border border-[rgba(41,41,41,0.42)] lg:w-[392px]">
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 bg-gradient-to-b from-[#08090b] to-[#0c0d0f]"
          />
          <div className="relative flex h-[50px] w-full shrink-0 items-center justify-between bg-[#101113] px-[9px]">
            <p className="font-figtree text-[14px] text-white">Top Countries</p>
            <div className="flex h-[32px] items-center rounded-[6px] bg-[#16171a] px-[12px] py-[6px]">
              <p className="font-figtree text-[12px] text-white opacity-70">{countries.length}</p>
            </div>
          </div>

          {countries.length > 0 ? (
            <div className="relative flex flex-col gap-[6px] p-[9px]">
              {countries.map((entry) => (
                <div
                  key={entry.code}
                  className="flex h-[54px] items-center justify-between rounded-[6px] bg-[rgba(22,23,26,0.14)] px-[12px] py-[6px]"
                >
                  <div className="flex items-center gap-[10px]">
                    <div className="flex size-[33px] shrink-0 items-center justify-center rounded-full bg-[#101113] text-[16px]">
                      {getCountryFlagEmoji(entry.code)}
                    </div>
                    <div className="flex flex-col items-start gap-[4px] font-figtree text-[12px]">
                      <p className="text-[rgba(255,255,255,0.4)] opacity-70">
                        {getCountryName(entry.code)}
                      </p>
                      <p className="text-white">{entry.count}</p>
                    </div>
                  </div>
                  <p className="font-figtree text-[12px] text-white opacity-70">{entry.percent}%</p>
                </div>
              ))}
            </div>
          ) : (
            <p className="relative px-[18px] py-[20px] font-inter text-[12px] text-white/40">
              No one’s checked in from anywhere yet.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
