"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { CalendarIcon, ChevronLeftIcon, ChevronRightIcon, ClockIcon } from "./icons";
import { Popover, SelectButton, cx } from "./ui";

// Room end dates are plain calendar days ("2026-10-31") and times are UTC —
// everything here works in UTC so a day never shifts under the admin's own
// timezone.

const WEEKDAYS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

function toIsoDay(year: number, month: number, day: number): string {
  return new Date(Date.UTC(year, month, day)).toISOString().slice(0, 10);
}

function localTodayIso(): string {
  const now = new Date();
  return toIsoDay(now.getFullYear(), now.getMonth(), now.getDate());
}

export function formatPickedDate(iso: string): string {
  const today = localTodayIso();
  const tomorrow = new Date(Date.parse(`${today}T00:00:00Z`) + 86_400_000).toISOString().slice(0, 10);
  if (iso === today) return "Today";
  if (iso === tomorrow) return "Tomorrow";
  const date = new Date(`${iso}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleDateString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
}

export function Calendar({
  value,
  onSelect,
  min,
}: {
  value: string | null;
  onSelect: (iso: string) => void;
  min?: string;
}) {
  const initial = value ? new Date(`${value}T00:00:00Z`) : new Date(`${localTodayIso()}T00:00:00Z`);
  const [cursor, setCursor] = useState({ year: initial.getUTCFullYear(), month: initial.getUTCMonth() });
  const today = localTodayIso();

  const cells = useMemo(() => {
    const first = new Date(Date.UTC(cursor.year, cursor.month, 1));
    const daysInMonth = new Date(Date.UTC(cursor.year, cursor.month + 1, 0)).getUTCDate();
    const blanks = first.getUTCDay();
    return [
      ...Array.from({ length: blanks }, () => null),
      ...Array.from({ length: daysInMonth }, (_, i) => toIsoDay(cursor.year, cursor.month, i + 1)),
    ];
  }, [cursor]);

  const title = new Date(Date.UTC(cursor.year, cursor.month, 1)).toLocaleDateString("en-GB", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });

  function shift(delta: number) {
    setCursor(({ year, month }) => {
      const next = new Date(Date.UTC(year, month + delta, 1));
      return { year: next.getUTCFullYear(), month: next.getUTCMonth() };
    });
  }

  return (
    <div className="w-[292px] p-2.5">
      <div className="mb-2 flex items-center justify-between px-1">
        <button
          type="button"
          aria-label="Previous month"
          onClick={() => shift(-1)}
          className="flex size-8 items-center justify-center rounded-[9px] text-white/55 transition-colors hover:bg-white/[0.07] hover:text-white"
        >
          <ChevronLeftIcon size={16} />
        </button>
        <span className="text-[14px] font-medium">{title}</span>
        <button
          type="button"
          aria-label="Next month"
          onClick={() => shift(1)}
          className="flex size-8 items-center justify-center rounded-[9px] text-white/55 transition-colors hover:bg-white/[0.07] hover:text-white"
        >
          <ChevronRightIcon size={16} />
        </button>
      </div>
      <div className="grid grid-cols-7 gap-y-1 text-center">
        {WEEKDAYS.map((day) => (
          <span key={day} className="pb-1 text-[11.5px] font-medium text-white/35">
            {day}
          </span>
        ))}
        {cells.map((iso, i) =>
          iso ? (
            <button
              key={iso}
              type="button"
              disabled={!!min && iso < min}
              onClick={() => onSelect(iso)}
              className={cx(
                "mx-auto flex size-9 items-center justify-center rounded-[10px] text-[13px] tabular-nums outline-none transition-colors focus-visible:ring-2 focus-visible:ring-[#8fb2ff]/50 disabled:pointer-events-none disabled:text-white/15",
                iso === value
                  ? "bg-white font-semibold text-[#111114] shadow-[0_2px_8px_rgba(0,0,0,0.4)]"
                  : iso === today
                    ? "text-white ring-1 ring-inset ring-white/25 hover:bg-white/[0.08]"
                    : "text-white/75 hover:bg-white/[0.08] hover:text-white",
              )}
            >
              {Number(iso.slice(8))}
            </button>
          ) : (
            <span key={`blank-${i}`} />
          ),
        )}
      </div>
    </div>
  );
}

export function DatePicker({
  value,
  onChange,
  min,
  placeholder = "Pick a date",
  id,
}: {
  value: string | null;
  onChange: (iso: string) => void;
  min?: string;
  placeholder?: string;
  id?: string;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLButtonElement>(null);
  return (
    <>
      <SelectButton
        id={id}
        ref={ref}
        open={open}
        leading={<CalendarIcon size={15} />}
        placeholder={!value}
        onClick={() => setOpen((current) => !current)}
      >
        {value ? formatPickedDate(value) : placeholder}
      </SelectButton>
      <Popover open={open} onClose={() => setOpen(false)} anchorRef={ref} className="p-0">
        <Calendar
          value={value}
          min={min}
          onSelect={(iso) => {
            onChange(iso);
            setOpen(false);
          }}
        />
      </Popover>
    </>
  );
}

const TIME_OPTIONS = Array.from({ length: 96 }, (_, i) => {
  const hours = String(Math.floor(i / 4)).padStart(2, "0");
  const minutes = String((i % 4) * 15).padStart(2, "0");
  return `${hours}:${minutes}`;
});

export function formatTime12(time: string): string {
  const [hours, minutes] = time.split(":").map(Number);
  const suffix = hours >= 12 ? "PM" : "AM";
  return `${hours % 12 === 0 ? 12 : hours % 12}:${String(minutes).padStart(2, "0")} ${suffix}`;
}

/** Picks a UTC "HH:mm" — or none, which means midnight UTC. */
export function TimePicker({
  value,
  onChange,
  id,
}: {
  value: string | null;
  onChange: (time: string | null) => void;
  id?: string;
}) {
  const [open, setOpen] = useState(false);
  const [typed, setTyped] = useState("");
  const ref = useRef<HTMLButtonElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    setTyped("");
    // Scroll the chosen time (or the current UTC hour) to the middle of the list.
    const target = value ?? `${String(new Date().getUTCHours()).padStart(2, "0")}:00`;
    const [hours, minutes] = target.split(":").map(Number);
    const slot = `${String(hours).padStart(2, "0")}:${String(Math.floor(minutes / 15) * 15).padStart(2, "0")}`;
    const id = requestAnimationFrame(() => {
      const list = listRef.current;
      const node =
        list?.querySelector<HTMLElement>(`[data-time="${target}"]`) ??
        list?.querySelector<HTMLElement>(`[data-time="${slot}"]`);
      if (list && node) list.scrollTop = node.offsetTop - list.clientHeight / 2 + node.offsetHeight / 2;
    });
    return () => cancelAnimationFrame(id);
  }, [open, value]);

  const typedValid = /^([01]\d|2[0-3]):([0-5]\d)$/.test(typed);

  return (
    <>
      <SelectButton
        id={id}
        ref={ref}
        open={open}
        leading={<ClockIcon size={15} />}
        placeholder={!value}
        onClick={() => setOpen((current) => !current)}
      >
        {value ? `${formatTime12(value)} UTC` : "No set time"}
      </SelectButton>
      <Popover open={open} onClose={() => setOpen(false)} anchorRef={ref} matchWidth className="w-[220px]">
        <div className="p-1">
          <input
            autoFocus
            value={typed}
            onChange={(event) => setTyped(event.target.value.replace(/[^\d:]/g, "").slice(0, 5))}
            onKeyDown={(event) => {
              if (event.key === "Enter" && typedValid) {
                onChange(typed);
                setOpen(false);
              }
            }}
            placeholder="Type a time, e.g. 18:45"
            className="h-8 w-full rounded-[9px] border border-white/[0.08] bg-white/[0.04] px-2.5 text-[12.5px] text-white outline-none placeholder:text-white/30 focus:border-[#8fb2ff]/50"
          />
        </div>
        <div ref={listRef} className="admin-scroll relative mt-1 max-h-[260px] overflow-y-auto">
          <button
            type="button"
            onClick={() => {
              onChange(null);
              setOpen(false);
            }}
            className={cx(
              "flex w-full items-center rounded-[9px] px-2.5 py-1.5 text-left text-[13px] transition-colors",
              value === null ? "bg-white/[0.1] text-white" : "text-white/60 hover:bg-white/[0.07] hover:text-white",
            )}
          >
            No set time (midnight UTC)
          </button>
          {(typedValid && !TIME_OPTIONS.includes(typed) ? [typed] : []).concat(TIME_OPTIONS).map((time) => (
            <button
              key={time}
              type="button"
              data-time={time}
              onClick={() => {
                onChange(time);
                setOpen(false);
              }}
              className={cx(
                "flex w-full items-center justify-between rounded-[9px] px-2.5 py-1.5 text-left text-[13px] tabular-nums transition-colors",
                time === value ? "bg-white/[0.1] text-white" : "text-white/75 hover:bg-white/[0.07] hover:text-white",
              )}
            >
              <span>{formatTime12(time)}</span>
              <span className="text-[11.5px] text-white/30">{time}</span>
            </button>
          ))}
        </div>
      </Popover>
    </>
  );
}
