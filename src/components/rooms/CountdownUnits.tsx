import { ONE_DAY_MS } from "@/hooks/useCountdown";

// Reused by RoomCard and the trending carousel. The label sits stacked
// below its number with its own breathing room, rather than overlapping the
// number's corner — the tighter overlap read as congested at these sizes.
export function CountdownUnit({ value, label }: { value: number; label: string }) {
  return (
    <div className="flex flex-col items-center gap-0.5 leading-none">
      <span className="text-[18px] font-medium sm:text-[24px]">{String(value).padStart(2, "0")}</span>
      <span className="text-[10px] opacity-65 sm:text-[11px]">{label}</span>
    </div>
  );
}

export function CountdownRow({
  countdown,
}: {
  countdown: { days: number; hrs: number; mins: number; secs: number; totalMs: number };
}) {
  // Under a day left, "days" is always 0 and not worth showing — swap it
  // for seconds instead, so the final hours count down smoothly.
  const isLastDay = countdown.totalMs < ONE_DAY_MS;

  return (
    <div className="flex items-start gap-2.5">
      {isLastDay ? (
        <>
          <CountdownUnit value={countdown.hrs} label="hrs" />
          <span className="pt-0.5 text-[15px] opacity-65 sm:text-[20px]">:</span>
          <CountdownUnit value={countdown.mins} label="mins" />
          <span className="pt-0.5 text-[15px] opacity-65 sm:text-[20px]">:</span>
          <CountdownUnit value={countdown.secs} label="secs" />
        </>
      ) : (
        <>
          <CountdownUnit value={countdown.days} label="days" />
          <span className="pt-0.5 text-[15px] opacity-65 sm:text-[20px]">:</span>
          <CountdownUnit value={countdown.hrs} label="hrs" />
          <span className="pt-0.5 text-[15px] opacity-65 sm:text-[20px]">:</span>
          <CountdownUnit value={countdown.mins} label="mins" />
        </>
      )}
    </div>
  );
}
