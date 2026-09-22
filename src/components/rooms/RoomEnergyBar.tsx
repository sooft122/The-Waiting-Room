export default function RoomEnergyBar({ energy }: { energy: number }) {
  const clamped = Math.max(0, Math.min(100, energy));

  return (
    <div className="flex w-[161px] flex-col gap-[10px]">
      <div className="flex items-center gap-[6px]">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img alt="" className="size-[18px]" src="/icons/flash.svg" />
        <span className="font-figtree text-[14px] font-medium text-[#dcdcdc]">Room Energy</span>
      </div>
      <div className="flex items-center gap-[5px]">
        <div className="relative h-[9px] w-[130px] shrink-0 rounded-full bg-white/10">
          <div
            className="h-full rounded-full transition-[width] duration-[1200ms] ease-out"
            style={{
              width: `${clamped}%`,
              backgroundImage: "linear-gradient(90deg, #b8791f, #f2c94c, #ffe9b8)",
            }}
          />
          {/* Micro-interaction: a few tiny bubbles drift near the fill's leading
              edge, tracking the current energy level as it changes. */}
          <div
            aria-hidden
            className="pointer-events-none absolute top-1/2 h-0 w-0 transition-[left] duration-[1200ms] ease-out"
            style={{ left: `${clamped}%` }}
          >
            <span className="energy-bubble energy-bubble-a absolute rounded-full bg-[#ffe9b8]" />
            <span className="energy-bubble energy-bubble-b absolute rounded-full bg-white/80" />
            <span className="energy-bubble energy-bubble-c absolute rounded-full bg-[#f2c94c]" />
          </div>
        </div>
        <span className="w-[26px] shrink-0 text-right font-figtree text-[12px] font-medium text-[#dcdcdc]">
          {clamped}%
        </span>
      </div>
    </div>
  );
}
