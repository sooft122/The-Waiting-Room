// Reused by RoomCard and the trending carousel. The label sits stacked
// below its number with its own breathing room, rather than overlapping the
// number's corner — the tighter overlap read as congested at these sizes.
export function CountdownUnit({ value, label }: { value: number; label: string }) {
  return (
    <div className="flex flex-col items-center gap-0.5 leading-none">
      <span className="text-[24px] font-medium">{String(value).padStart(2, "0")}</span>
      <span className="text-[11px] opacity-65">{label}</span>
    </div>
  );
}

export function CountdownRow({
  countdown,
}: {
  countdown: { days: number; hrs: number; mins: number };
}) {
  return (
    <div className="flex items-start gap-2.5">
      <CountdownUnit value={countdown.days} label="days" />
      <span className="pt-0.5 text-[20px] opacity-65">:</span>
      <CountdownUnit value={countdown.hrs} label="hrs" />
      <span className="pt-0.5 text-[20px] opacity-65">:</span>
      <CountdownUnit value={countdown.mins} label="mins" />
    </div>
  );
}
