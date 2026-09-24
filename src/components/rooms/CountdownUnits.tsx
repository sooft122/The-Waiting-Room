import { ONE_DAY_MS } from "@/hooks/useCountdown";

type CountdownSize = "default" | "compact";

// "compact" only shrinks below the sm breakpoint — used by RoomCard, where
// the fixed 24px number read oversized next to the card's own small title.
// The hero/thumbnail contexts (room detail page, trending carousel) keep
// the original fixed size at every width; "default" is unaffected either way.
const NUMBER_SIZE: Record<CountdownSize, string> = {
  default: "text-[24px]",
  compact: "text-[18px] sm:text-[24px]",
};
const LABEL_SIZE: Record<CountdownSize, string> = {
  default: "text-[11px]",
  compact: "text-[10px] sm:text-[11px]",
};
const SEPARATOR_SIZE: Record<CountdownSize, string> = {
  default: "text-[20px]",
  compact: "text-[15px] sm:text-[20px]",
};

// Reused by RoomCard and the trending carousel. The label sits stacked
// below its number with its own breathing room, rather than overlapping the
// number's corner — the tighter overlap read as congested at these sizes.
export function CountdownUnit({
  value,
  label,
  size = "default",
}: {
  value: number;
  label: string;
  size?: CountdownSize;
}) {
  return (
    <div className="flex flex-col items-center gap-0.5 leading-none">
      <span className={`font-medium ${NUMBER_SIZE[size]}`}>{String(value).padStart(2, "0")}</span>
      <span className={`opacity-65 ${LABEL_SIZE[size]}`}>{label}</span>
    </div>
  );
}

export function CountdownRow({
  countdown,
  size = "default",
}: {
  countdown: { days: number; hrs: number; mins: number; secs: number; totalMs: number };
  size?: CountdownSize;
}) {
  // Under a day left, "days" is always 0 and not worth showing — swap it
  // for seconds instead, so the final hours count down smoothly.
  const isLastDay = countdown.totalMs < ONE_DAY_MS;
  const separatorClass = `pt-0.5 opacity-65 ${SEPARATOR_SIZE[size]}`;

  return (
    <div className="flex items-start gap-2.5">
      {isLastDay ? (
        <>
          <CountdownUnit value={countdown.hrs} label="hrs" size={size} />
          <span className={separatorClass}>:</span>
          <CountdownUnit value={countdown.mins} label="mins" size={size} />
          <span className={separatorClass}>:</span>
          <CountdownUnit value={countdown.secs} label="secs" size={size} />
        </>
      ) : (
        <>
          <CountdownUnit value={countdown.days} label="days" size={size} />
          <span className={separatorClass}>:</span>
          <CountdownUnit value={countdown.hrs} label="hrs" size={size} />
          <span className={separatorClass}>:</span>
          <CountdownUnit value={countdown.mins} label="mins" size={size} />
        </>
      )}
    </div>
  );
}
