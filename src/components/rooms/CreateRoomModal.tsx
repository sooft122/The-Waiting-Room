"use client";

import { useEffect, useRef, useState } from "react";
import type { DragEvent } from "react";
import Link from "next/link";
import { ROOM_CATEGORIES } from "@/lib/rooms";
import type { Room } from "@/lib/rooms";
import { useStaggerEntrance } from "@/hooks/useStaggerEntrance";
import { compressImageToDataUrl } from "@/lib/compressImage";
import { findLikelyDuplicates } from "@/lib/roomDuplicates";
import type { DuplicateMatch } from "@/lib/roomDuplicates";
import { getRoomEndTime } from "@/lib/roomTime";
import { MAX_CTA_TEXT_LENGTH } from "@/lib/roomDescriptionFields";
import ModalShell from "./ModalShell";
import RoomDescriptionFields from "./RoomDescriptionFields";

// How long to wait after the last keystroke before checking for
// near-duplicate rooms — avoids re-running the comparison on every
// character typed.
const DUPLICATE_CHECK_DEBOUNCE_MS = 350;

// Generous — actual upload size is capped by compressImageToDataUrl
// downscaling every image before it's stored, not by this raw-file check.
const MAX_IMAGE_BYTES = 20 * 1024 * 1024;

// Mirrors MAX_IMAGE_DATA_URL_LENGTH in src/app/api/rooms/route.ts — kept in
// sync so an unsupported-format fallback fails clearly here instead of
// after a round trip to the server.
const MAX_IMAGE_DATA_URL_LENGTH = 5_600_000;

type FormErrors = Partial<Record<"image" | "name" | "date" | "category" | "ctaText" | "form", string>>;

type CreateRoomModalProps = {
  onClose: () => void;
  onCreated: (room: Room) => void;
};

export default function CreateRoomModal({ onClose, onCreated }: CreateRoomModalProps) {
  const entrance = useStaggerEntrance();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [step, setStep] = useState<1 | 2>(1);

  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [isDraggingOver, setIsDraggingOver] = useState(false);
  const [name, setName] = useState("");
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [category, setCategory] = useState("");
  const [description, setDescription] = useState("");
  const [ctaText, setCtaText] = useState("");
  const [ctaLink, setCtaLink] = useState("");
  const [errors, setErrors] = useState<FormErrors>({});
  const [submitting, setSubmitting] = useState(false);
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
  // still submit either way.
  useEffect(() => {
    const id = setTimeout(() => {
      setDuplicateMatches(findLikelyDuplicates(name, date || null, existingRooms));
    }, DUPLICATE_CHECK_DEBOUNCE_MS);
    return () => clearTimeout(id);
  }, [name, date, existingRooms]);

  // Called once per render, in render order, so each field gets the next
  // stagger step — capture each result once and reuse it (never call twice
  // for the same field, or the delays and index skip out of sync). Both
  // steps' fields are claimed every render (even though only one step's
  // worth is actually shown) so the index order — and therefore each
  // field's delay — stays fixed regardless of which step is active.
  const titleEntrance = entrance();
  const uploadEntrance = entrance();
  const nameEntrance = entrance();
  const dateEntrance = entrance();
  const timeEntrance = entrance();
  const categoryEntrance = entrance();
  const step1ActionsEntrance = entrance();
  const descriptionEntrance = entrance();
  const ctaTextEntrance = entrance();
  const ctaLinkEntrance = entrance();
  const step2ActionsEntrance = entrance();

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
      console.error("CreateRoomModal: compressImageToDataUrl failed", err);
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

  function validateStep1(): FormErrors {
    const nextErrors: FormErrors = {};
    if (!imagePreview) nextErrors.image = "Please upload a thumbnail image.";
    if (!name.trim()) nextErrors.name = "Room name is required.";
    if (!date) {
      nextErrors.date = "Please choose a date.";
    } else if (getRoomEndTime({ date, time: time || null }).getTime() <= Date.now()) {
      nextErrors.date = "Date must be in the future.";
    }
    if (!category) nextErrors.category = "Please select a category.";
    return nextErrors;
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();

    if (step === 1) {
      const nextErrors = validateStep1();
      if (Object.keys(nextErrors).length > 0) {
        setErrors(nextErrors);
        return;
      }
      setErrors({});
      setStep(2);
      return;
    }

    const nextErrors: FormErrors = {};
    if (ctaText.trim().length > MAX_CTA_TEXT_LENGTH) {
      nextErrors.ctaText = `CTA Text must be ${MAX_CTA_TEXT_LENGTH} characters or fewer.`;
    }
    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors);
      return;
    }

    setSubmitting(true);
    setErrors({});
    try {
      const trimmedDescription = description.trim();
      const response = await fetch("/api/rooms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          date,
          time: time || null,
          category,
          imageUrl: imagePreview,
          description: trimmedDescription || null,
          ctaText: trimmedDescription ? ctaText.trim() || null : null,
          ctaLink: trimmedDescription ? ctaLink.trim() || null : null,
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        setErrors({ form: data.error ?? "Something went wrong. Please try again." });
        return;
      }
      onCreated(data.room as Room);
    } catch {
      setErrors({ form: "Network error — please try again." });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <ModalShell onClose={onClose} labelledBy="create-room-title">
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
          id="create-room-title"
          className={`font-satoshi text-[18px] text-white ${titleEntrance.className}`}
          style={titleEntrance.style}
        >
          Create Room
        </h2>

        {step === 1 ? (
          <>
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

              <div
                className={`flex w-full flex-col gap-1.5 ${nameEntrance.className}`}
                style={nameEntrance.style}
              >
                <label htmlFor="room-name" className="font-satoshi text-[12px] text-white">
                  Room Name
                </label>
                <input
                  id="room-name"
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
                  <label htmlFor="room-date" className="font-satoshi text-[12px] text-white">
                    Date
                  </label>
                  <div className="relative h-9 w-full">
                    <input
                      id="room-date"
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
                  <label htmlFor="room-time" className="font-satoshi text-[12px] text-white">
                    Time <span className="text-white/40">(optional)</span>
                  </label>
                  <div className="relative h-9 w-full">
                    <input
                      id="room-time"
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
                <label htmlFor="room-category" className="font-satoshi text-[12px] text-white">
                  Category
                </label>
                <div className="relative h-9 w-full">
                  <select
                    id="room-category"
                    value={category}
                    onChange={(event) => setCategory(event.target.value)}
                    className="h-9 w-full appearance-none rounded-[8px] border border-[#2b2d30] bg-[#1b1c21] px-2.5 font-satoshi text-[12px] text-white focus:outline-none focus:ring-1 focus:ring-white/30"
                  >
                    <option value="" disabled hidden className="text-white/50">
                      Select Category
                    </option>
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
              className={`flex w-full flex-col items-stretch gap-2 sm:flex-row sm:gap-[6px] ${step1ActionsEntrance.className}`}
              style={step1ActionsEntrance.style}
            >
              <button
                type="button"
                onClick={onClose}
                className="relative flex h-[32px] w-full items-center justify-center overflow-hidden rounded-[10px] p-px shadow-[0px_2px_2.7px_rgba(0,0,0,0.05)] sm:flex-1"
              >
                <span
                  className="flex size-full items-center justify-center overflow-hidden rounded-[9px] shadow-[0px_4px_27px_0px_rgba(0,0,0,0.18)]"
                  style={{ backgroundImage: "linear-gradient(180deg, #16171b, #17181b)" }}
                >
                  <span className="font-figtree text-[12px] font-medium text-[#b8b8b8]">
                    Cancel
                  </span>
                </span>
              </button>
              <button
                type="submit"
                className="relative flex h-[32px] w-full items-center justify-center overflow-hidden rounded-[10px] bg-white p-px shadow-[0px_1px_4px_0px_rgba(0,0,0,0.2)] sm:w-[247px] sm:shrink-0"
              >
                <span className="relative flex size-full items-center justify-center overflow-hidden rounded-[9px]">
                  <span
                    aria-hidden
                    className="absolute inset-0 rounded-[9px]"
                    style={{
                      backgroundImage:
                        "linear-gradient(180.36deg, rgb(228,221,221) 19.37%, rgb(220,220,220) 40.857%, rgb(216,213,213) 65.087%, rgb(209,209,209) 97.546%)",
                    }}
                  />
                  <span className="relative font-figtree text-[12px] font-medium text-black">
                    Next
                  </span>
                  <span
                    aria-hidden
                    className="pointer-events-none absolute inset-0 rounded-[inherit] shadow-[inset_0px_1px_0px_0px_rgba(28,28,28,0.05)]"
                  />
                </span>
              </button>
            </div>
          </>
        ) : (
          <>
            <RoomDescriptionFields
              idPrefix="room"
              roomName={name}
              category={category}
              date={date}
              description={description}
              onDescriptionChange={setDescription}
              ctaText={ctaText}
              onCtaTextChange={setCtaText}
              ctaLink={ctaLink}
              onCtaLinkChange={setCtaLink}
              ctaTextError={errors.ctaText}
              entrances={{ description: descriptionEntrance, ctaText: ctaTextEntrance, ctaLink: ctaLinkEntrance }}
            />

            {errors.form ? (
              <p className="w-full font-inter text-[12px] text-red-400">{errors.form}</p>
            ) : null}

            <div
              className={`flex w-full flex-col items-stretch gap-2 sm:flex-row sm:gap-[6px] ${step2ActionsEntrance.className}`}
              style={step2ActionsEntrance.style}
            >
              <button
                type="button"
                onClick={() => setStep(1)}
                className="relative flex h-[32px] w-full items-center justify-center overflow-hidden rounded-[10px] p-px shadow-[0px_2px_2.7px_rgba(0,0,0,0.05)] sm:flex-1"
              >
                <span
                  className="flex size-full items-center justify-center overflow-hidden rounded-[9px] shadow-[0px_4px_27px_0px_rgba(0,0,0,0.18)]"
                  style={{ backgroundImage: "linear-gradient(180deg, #16171b, #17181b)" }}
                >
                  <span className="font-figtree text-[12px] font-medium text-[#b8b8b8]">Back</span>
                </span>
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="relative flex h-[32px] w-full items-center justify-center overflow-hidden rounded-[10px] bg-white p-px shadow-[0px_1px_4px_0px_rgba(0,0,0,0.2)] disabled:opacity-60 sm:w-[247px] sm:shrink-0"
              >
                <span className="relative flex size-full items-center justify-center overflow-hidden rounded-[9px]">
                  <span
                    aria-hidden
                    className="absolute inset-0 rounded-[9px]"
                    style={{
                      backgroundImage:
                        "linear-gradient(180.55deg, rgb(228,221,221) 19.37%, rgb(220,220,220) 40.857%, rgb(216,213,213) 65.087%, rgb(209,209,209) 97.546%)",
                    }}
                  />
                  <span className="relative font-figtree text-[12px] font-medium text-black">
                    {submitting ? "Creating…" : "Create Room"}
                  </span>
                  <span
                    aria-hidden
                    className="pointer-events-none absolute inset-0 rounded-[inherit] shadow-[inset_0px_1px_0px_0px_rgba(28,28,28,0.05)]"
                  />
                </span>
              </button>
            </div>
          </>
        )}
      </form>
    </ModalShell>
  );
}
