"use client";

import { useEffect, useRef, useState } from "react";
import type { DragEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ROOM_CATEGORIES } from "@/lib/rooms";
import type { Room } from "@/lib/rooms";
import { useStaggerEntrance } from "@/hooks/useStaggerEntrance";
import { compressImageToDataUrl } from "@/lib/compressImage";
import { findLikelyDuplicates } from "@/lib/roomDuplicates";
import type { DuplicateMatch } from "@/lib/roomDuplicates";
import { getRoomEndTime } from "@/lib/roomTime";
import ModalShell from "./ModalShell";
import DeleteRoomModal from "./DeleteRoomModal";

// How long to wait after the last keystroke before checking for
// near-duplicate rooms — avoids re-running the comparison on every
// character typed.
const DUPLICATE_CHECK_DEBOUNCE_MS = 350;

// Generous — actual upload size is capped by compressImageToDataUrl
// downscaling every image before it's stored, not by this raw-file check.
const MAX_IMAGE_BYTES = 20 * 1024 * 1024;

// Mirrors MAX_IMAGE_DATA_URL_LENGTH in src/app/api/rooms/[id]/route.ts —
// kept in sync so an unsupported-format fallback fails clearly here instead
// of after a round trip to the server.
const MAX_IMAGE_DATA_URL_LENGTH = 5_600_000;

type FormErrors = Partial<Record<"image" | "name" | "date" | "category" | "form", string>>;

type EditRoomModalProps = {
  room: Room;
  onClose: () => void;
  onSaved: (room: Room) => void;
};

export default function EditRoomModal({ room, onClose, onSaved }: EditRoomModalProps) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const entrance = useStaggerEntrance();
  const titleEntrance = entrance();
  const uploadEntrance = entrance();
  const nameEntrance = entrance();
  const dateEntrance = entrance();
  const timeEntrance = entrance();
  const categoryEntrance = entrance();
  const actionsEntrance = entrance();

  const [imagePreview, setImagePreview] = useState<string | null>(room.imageUrl);
  const [isDraggingOver, setIsDraggingOver] = useState(false);
  const [name, setName] = useState(room.name);
  const [date, setDate] = useState(room.date);
  const [time, setTime] = useState(room.time ?? "");
  const [category, setCategory] = useState<string>(room.category);
  const [errors, setErrors] = useState<FormErrors>({});
  const [submitting, setSubmitting] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [existingRooms, setExistingRooms] = useState<Room[]>([]);
  const [duplicateMatches, setDuplicateMatches] = useState<DuplicateMatch[]>([]);

  // Fetched once, when the modal opens — this app's room count is small
  // enough that comparing against the full list client-side is simpler
  // than adding a dedicated search endpoint for it.
  useEffect(() => {
    let cancelled = false;
    fetch("/api/rooms")
      .then((res) => res.json())
      .then((data) => {
        if (!cancelled && Array.isArray(data.rooms)) setExistingRooms(data.rooms);
      })
      .catch(() => {
        // Non-fatal — duplicate detection just has nothing to compare against.
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Flags likely duplicates as a heads-up, not a block — the creator can
  // still save either way. Excludes this room itself, since editing it
  // obviously "matches" its own current name/date.
  useEffect(() => {
    const id = setTimeout(() => {
      setDuplicateMatches(findLikelyDuplicates(name, date || null, existingRooms, room.id));
    }, DUPLICATE_CHECK_DEBOUNCE_MS);
    return () => clearTimeout(id);
  }, [name, date, existingRooms, room.id]);

  async function readImageFile(file: File) {
    if (!file.type.startsWith("image/")) {
      setErrors((prev) => ({ ...prev, image: "Please upload an image file." }));
      return;
    }
    if (file.size > MAX_IMAGE_BYTES) {
      setErrors((prev) => ({ ...prev, image: "Image must be under 20MB." }));
      return;
    }
    setErrors((prev) => ({ ...prev, image: undefined }));
    try {
      setImagePreview(await compressImageToDataUrl(file, MAX_IMAGE_DATA_URL_LENGTH));
    } catch (err) {
      console.error("EditRoomModal: compressImageToDataUrl failed", err);
      const detail = err instanceof Error ? err.message : String(err);
      setErrors((prev) => ({ ...prev, image: `Could not process that image: ${detail}` }));
    }
  }

  function handleFileInputChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (file) readImageFile(file);
    event.target.value = "";
  }

  function handleDrop(event: DragEvent<HTMLButtonElement>) {
    event.preventDefault();
    setIsDraggingOver(false);
    const file = event.dataTransfer.files?.[0];
    if (file) readImageFile(file);
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();

    const nextErrors: FormErrors = {};
    if (!imagePreview) nextErrors.image = "Please upload a thumbnail image.";
    if (!name.trim()) nextErrors.name = "Room name is required.";
    if (!date) {
      nextErrors.date = "Please choose a date.";
    } else if (getRoomEndTime({ date, time: time || null }).getTime() <= Date.now()) {
      nextErrors.date = "Date must be in the future.";
    }
    if (!category) nextErrors.category = "Please select a category.";

    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors);
      return;
    }

    setSubmitting(true);
    setErrors({});
    try {
      const response = await fetch(`/api/rooms/${room.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          date,
          time: time || null,
          category,
          imageUrl: imagePreview,
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        setErrors({ form: data.error ?? "Something went wrong. Please try again." });
        return;
      }
      onSaved(data.room as Room);
      router.refresh();
    } catch {
      setErrors({ form: "Network error — please try again." });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <ModalShell onClose={onClose} labelledBy="edit-room-title">
      <button
        type="button"
        onClick={onClose}
        aria-label="Close"
        className="absolute right-5 top-5 size-5 cursor-pointer"
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img alt="" className="block size-full" src="/icons/cancel-01.svg" />
      </button>

      <form onSubmit={handleSubmit} className="flex flex-col items-start gap-5">
        <h2
          id="edit-room-title"
          className={`font-satoshi text-[18px] text-white ${titleEntrance.className}`}
          style={titleEntrance.style}
        >
          Edit Room
        </h2>

        <div className="flex w-full flex-col gap-3.5">
          <div className={uploadEntrance.className} style={uploadEntrance.style}>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              onDragOver={(event) => {
                event.preventDefault();
                setIsDraggingOver(true);
              }}
              onDragLeave={() => setIsDraggingOver(false)}
              onDrop={handleDrop}
              className={`relative block h-[126px] w-full overflow-hidden rounded-[8px] border border-dashed transition-colors ${
                isDraggingOver ? "border-white" : "border-[#2b2d30]"
              }`}
              style={{
                backgroundImage: imagePreview
                  ? undefined
                  : "linear-gradient(180deg, #1a1b20, #15161a)",
              }}
            >
              {imagePreview ? (
                <>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    alt=""
                    src={imagePreview}
                    className="absolute inset-0 size-full object-cover"
                  />
                  <span
                    role="button"
                    tabIndex={0}
                    aria-label="Remove image"
                    onClick={(event) => {
                      event.stopPropagation();
                      setImagePreview(null);
                    }}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.stopPropagation();
                        setImagePreview(null);
                      }
                    }}
                    className="absolute right-2 top-2 flex size-6 cursor-pointer items-center justify-center rounded-full bg-black/60"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img alt="" className="size-3" src="/icons/cancel-01.svg" />
                  </span>
                </>
              ) : (
                <span className="absolute left-1/2 top-1/2 flex w-[184px] -translate-x-1/2 -translate-y-1/2 flex-col items-center gap-1.5">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img alt="" className="size-5" src="/icons/upload-circle-01.svg" />
                  <span className="font-satoshi text-[12px] leading-[1.2] tracking-[0.24px] text-[#adadad]">
                    <span className="block">Click to upload</span>
                    <span className="block">or drag and drop a clear thumbnail image</span>
                  </span>
                </span>
              )}
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleFileInputChange}
              className="hidden"
            />
            {errors.image ? (
              <p className="mt-1.5 font-inter text-[11px] text-red-400">{errors.image}</p>
            ) : null}
          </div>

          <div className={`flex w-full flex-col gap-1.5 ${nameEntrance.className}`} style={nameEntrance.style}>
            <label htmlFor="edit-room-name" className="font-satoshi text-[12px] text-white">
              Room Name
            </label>
            <input
              id="edit-room-name"
              type="text"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="What's happening?..."
              maxLength={100}
              className="h-9 w-full rounded-[8px] border border-[#2b2d30] bg-[#1b1c21] px-2.5 font-satoshi text-[12px] text-white placeholder:text-white/50 focus:outline-none focus:ring-1 focus:ring-white/30"
            />
            {errors.name ? (
              <p className="font-inter text-[11px] text-red-400">{errors.name}</p>
            ) : duplicateMatches.length > 0 ? (
              <div className="flex flex-col gap-1 rounded-[8px] border border-amber-400/30 bg-amber-400/10 px-2.5 py-2">
                <p className="font-inter text-[11px] text-amber-300">
                  {duplicateMatches[0].sameDate
                    ? `This looks like it might be the same event as "${duplicateMatches[0].room.name}" — which ends on the same date.`
                    : `This looks similar to an existing room: "${duplicateMatches[0].room.name}".`}
                </p>
                <Link
                  href={`/rooms/${duplicateMatches[0].room.id}`}
                  target="_blank"
                  className="w-fit font-inter text-[11px] text-amber-200 underline underline-offset-2 hover:text-amber-100"
                >
                  View that room →
                </Link>
              </div>
            ) : null}
          </div>

          <div className="flex w-full items-start gap-2.5">
            <div
              className={`flex w-full flex-col gap-1.5 ${dateEntrance.className}`}
              style={dateEntrance.style}
            >
              <label htmlFor="edit-room-date" className="font-satoshi text-[12px] text-white">
                Date
              </label>
              <div className="relative h-9 w-full">
                <input
                  id="edit-room-date"
                  type="date"
                  value={date}
                  min={new Date(Date.now() + 86_400_000).toISOString().slice(0, 10)}
                  onChange={(event) => setDate(event.target.value)}
                  className="h-9 w-full appearance-none rounded-[8px] border border-[#2b2d30] bg-[#1b1c21] px-2.5 font-satoshi text-[12px] text-white [color-scheme:dark] focus:outline-none focus:ring-1 focus:ring-white/30 [&::-webkit-calendar-picker-indicator]:absolute [&::-webkit-calendar-picker-indicator]:inset-0 [&::-webkit-calendar-picker-indicator]:h-full [&::-webkit-calendar-picker-indicator]:w-full [&::-webkit-calendar-picker-indicator]:cursor-pointer [&::-webkit-calendar-picker-indicator]:opacity-0"
                />
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  alt=""
                  aria-hidden
                  className="pointer-events-none absolute right-1.5 top-1/2 size-5 -translate-y-1/2"
                  src="/icons/calendar-03.svg"
                />
              </div>
              {errors.date ? (
                <p className="font-inter text-[11px] text-red-400">{errors.date}</p>
              ) : null}
            </div>

            <div
              className={`flex w-full flex-col gap-1.5 ${timeEntrance.className}`}
              style={timeEntrance.style}
            >
              <label htmlFor="edit-room-time" className="font-satoshi text-[12px] text-white">
                Time <span className="text-white/40">(optional)</span>
              </label>
              <div className="relative h-9 w-full">
                <input
                  id="edit-room-time"
                  type="time"
                  value={time}
                  onChange={(event) => setTime(event.target.value)}
                  className="h-9 w-full appearance-none rounded-[8px] border border-[#2b2d30] bg-[#1b1c21] px-2.5 font-satoshi text-[12px] text-white [color-scheme:dark] focus:outline-none focus:ring-1 focus:ring-white/30 [&::-webkit-calendar-picker-indicator]:absolute [&::-webkit-calendar-picker-indicator]:inset-0 [&::-webkit-calendar-picker-indicator]:h-full [&::-webkit-calendar-picker-indicator]:w-full [&::-webkit-calendar-picker-indicator]:cursor-pointer [&::-webkit-calendar-picker-indicator]:opacity-0"
                />
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  alt=""
                  aria-hidden
                  className="pointer-events-none absolute right-1.5 top-1/2 size-5 -translate-y-1/2"
                  src="/icons/time-04.svg"
                />
              </div>
            </div>
          </div>

          <div
            className={`flex w-full flex-col gap-1.5 ${categoryEntrance.className}`}
            style={categoryEntrance.style}
          >
            <label htmlFor="edit-room-category" className="font-satoshi text-[12px] text-white">
              Category
            </label>
            <div className="relative h-9 w-full">
              <select
                id="edit-room-category"
                value={category}
                onChange={(event) => setCategory(event.target.value)}
                className="h-9 w-full appearance-none rounded-[8px] border border-[#2b2d30] bg-[#1b1c21] px-2.5 font-satoshi text-[12px] text-white focus:outline-none focus:ring-1 focus:ring-white/30"
              >
                {ROOM_CATEGORIES.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                alt=""
                aria-hidden
                className="pointer-events-none absolute right-1.5 top-1/2 size-5 -translate-y-1/2"
                src="/icons/arrow-down-01.svg"
              />
            </div>
            {errors.category ? (
              <p className="font-inter text-[11px] text-red-400">{errors.category}</p>
            ) : null}
          </div>
        </div>

        {errors.form ? (
          <p className="w-full font-inter text-[12px] text-red-400">{errors.form}</p>
        ) : null}

        <div
          className={`flex w-full flex-col items-stretch gap-2 sm:flex-row sm:gap-[4px] ${actionsEntrance.className}`}
          style={actionsEntrance.style}
        >
          <button
            type="button"
            onClick={() => setConfirmingDelete(true)}
            className="relative flex w-full flex-col items-center justify-center overflow-hidden rounded-[10px] bg-[#ff8282] p-px shadow-[0px_1px_4px_0px_rgba(0,0,0,0.2)] sm:w-[152px] sm:shrink-0"
          >
            <span className="relative flex w-full items-center justify-center overflow-hidden rounded-[9px] px-[30px] py-2">
              <span
                aria-hidden
                className="absolute inset-0 rounded-[9px]"
                style={{
                  backgroundImage:
                    "linear-gradient(180.65deg, rgb(255,73,73) 19.37%, rgb(255,39,39) 40.857%, rgb(255,33,33) 65.087%, rgb(255,30,30) 97.546%)",
                }}
              />
              <span className="relative whitespace-nowrap font-figtree text-[14px] font-medium text-white">
                Delete Room
              </span>
              <span
                aria-hidden
                className="pointer-events-none absolute inset-0 rounded-[inherit] shadow-[inset_0px_1px_0px_0px_rgba(28,28,28,0.05)]"
              />
            </span>
          </button>

          <button
            type="submit"
            disabled={submitting}
            className="relative flex flex-1 flex-col items-center justify-center overflow-hidden rounded-[10px] bg-white p-px shadow-[0px_1px_4px_0px_rgba(0,0,0,0.2)] disabled:opacity-60"
          >
            <span className="relative flex w-full items-center justify-center overflow-hidden rounded-[9px] px-[30px] py-2">
              <span
                aria-hidden
                className="absolute inset-0 rounded-[9px]"
                style={{
                  backgroundImage:
                    "linear-gradient(180.22deg, rgb(228,221,221) 19.37%, rgb(220,220,220) 40.857%, rgb(216,213,213) 65.087%, rgb(209,209,209) 97.546%)",
                }}
              />
              <span className="relative font-figtree text-[14px] font-medium text-black">
                {submitting ? "Saving…" : "Save Changes"}
              </span>
              <span
                aria-hidden
                className="pointer-events-none absolute inset-0 rounded-[inherit] shadow-[inset_0px_1px_0px_0px_rgba(28,28,28,0.05)]"
              />
            </span>
          </button>
        </div>
      </form>

      {confirmingDelete ? (
        <DeleteRoomModal room={room} onClose={() => setConfirmingDelete(false)} />
      ) : null}
    </ModalShell>
  );
}
