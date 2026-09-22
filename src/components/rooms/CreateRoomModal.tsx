"use client";

import { useRef, useState } from "react";
import type { DragEvent } from "react";
import { ROOM_CATEGORIES } from "@/lib/rooms";
import type { Room } from "@/lib/rooms";
import { useStaggerEntrance } from "@/hooks/useStaggerEntrance";
import { compressImageToDataUrl } from "@/lib/compressImage";
import ModalShell from "./ModalShell";

// Generous — actual upload size is capped by compressImageToDataUrl
// downscaling every image before it's stored, not by this raw-file check.
const MAX_IMAGE_BYTES = 20 * 1024 * 1024;

// Mirrors MAX_IMAGE_DATA_URL_LENGTH in src/app/api/rooms/route.ts — kept in
// sync so an unsupported-format fallback fails clearly here instead of
// after a round trip to the server.
const MAX_IMAGE_DATA_URL_LENGTH = 5_600_000;

type FormErrors = Partial<Record<"image" | "name" | "date" | "category" | "form", string>>;

type CreateRoomModalProps = {
  onClose: () => void;
  onCreated: (room: Room) => void;
};

export default function CreateRoomModal({ onClose, onCreated }: CreateRoomModalProps) {
  const entrance = useStaggerEntrance();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [isDraggingOver, setIsDraggingOver] = useState(false);
  const [name, setName] = useState("");
  const [date, setDate] = useState("");
  const [category, setCategory] = useState("");
  const [errors, setErrors] = useState<FormErrors>({});
  const [submitting, setSubmitting] = useState(false);

  // Called once per render, in render order, so each field gets the next
  // stagger step — capture each result once and reuse it (never call twice
  // for the same field, or the delays and index skip out of sync).
  const titleEntrance = entrance();
  const uploadEntrance = entrance();
  const nameEntrance = entrance();
  const dateEntrance = entrance();
  const categoryEntrance = entrance();
  const submitEntrance = entrance();

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

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();

    const nextErrors: FormErrors = {};
    if (!imagePreview) nextErrors.image = "Please upload a thumbnail image.";
    if (!name.trim()) nextErrors.name = "Room name is required.";
    if (!date) {
      nextErrors.date = "Please choose a date.";
    } else if (new Date(date).getTime() <= Date.now()) {
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
      const response = await fetch("/api/rooms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), date, category, imageUrl: imagePreview }),
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
            ) : null}
          </div>

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

        <div className={`w-full ${submitEntrance.className}`} style={submitEntrance.style}>
          <button
            type="submit"
            disabled={submitting}
            className="relative flex w-full flex-col items-center justify-center overflow-hidden rounded-[10px] bg-white p-px shadow-[0px_1px_4px_0px_rgba(0,0,0,0.2)] disabled:opacity-60"
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
      </form>
    </ModalShell>
  );
}
