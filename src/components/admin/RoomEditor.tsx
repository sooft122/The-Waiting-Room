"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type DragEvent } from "react";
import { ROOM_CATEGORIES, type RoomCategory } from "@/lib/rooms";
import type { AdminLogEntry, AdminRoom } from "@/lib/admin/types";
import { compressImageToDataUrl } from "@/lib/compressImage";
import {
  MAX_CTA_LINK_LENGTH,
  MAX_CTA_TEXT_LENGTH,
  MAX_DESCRIPTION_LENGTH,
  isSafeCtaLink,
} from "@/lib/roomDescriptionFields";
import { useAdmin } from "./AdminContext";
import { roomImageUrl } from "./format";
import { EyeOffIcon, ImageIcon, XIcon } from "./icons";
import { DatePicker, TimePicker } from "./pickers";
import { Button, Drawer, Field, IconButton, Switch, TextArea, TextInput, cx } from "./ui";

// Mirrors the server's own limits (lib/admin/ops.ts).
const MAX_NAME = 100;
const MAX_HOST = 60;
const MAX_IMAGE_DATA_URL_LENGTH = 5_600_000;

type FormState = {
  name: string;
  date: string | null;
  time: string | null;
  category: RoomCategory | null;
  createdByLabel: string;
  isPrivate: boolean;
  description: string;
  ctaText: string;
  ctaLink: string;
};

function initialState(room: AdminRoom | null, hostName: string): FormState {
  return {
    name: room?.name ?? "",
    date: room?.date ?? null,
    time: room?.time ?? null,
    category: room?.category ?? null,
    createdByLabel: room?.createdByLabel ?? hostName,
    isPrivate: room?.isPrivate ?? false,
    description: room?.description ?? "",
    ctaText: room?.ctaText ?? "",
    ctaLink: room?.ctaLink ?? "",
  };
}

function todayUtcIso(): string {
  return new Date().toISOString().slice(0, 10);
}

export default function RoomEditor({
  target,
  onClose,
  onCreated,
}: {
  target: AdminRoom | "new" | null;
  onClose: () => void;
  onCreated?: (roomId: string) => void;
}) {
  const { admin, change, confirm } = useAdmin();
  const room = target && target !== "new" ? target : null;
  const open = target !== null;

  const [form, setForm] = useState<FormState>(() => initialState(room, admin.name));
  const [image, setImage] = useState<string | null>(null);
  const [imageError, setImageError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showErrors, setShowErrors] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const baseline = useRef(form);

  // A fresh form each time the drawer opens (or switches rooms).
  const targetKey = target === "new" ? "new" : target?.id ?? null;
  useEffect(() => {
    if (!targetKey) return;
    const next = initialState(room, admin.name);
    baseline.current = next;
    setForm(next);
    setImage(null);
    setImageError(null);
    setShowErrors(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [targetKey]);

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((current) => ({ ...current, [key]: value }));

  const dirty = useMemo(
    () => image !== null || JSON.stringify(form) !== JSON.stringify(baseline.current),
    [form, image],
  );

  const endsAt = form.date ? new Date(`${form.date}T${form.time ?? "00:00"}:00Z`) : null;
  const endsInPast = endsAt ? endsAt.getTime() <= Date.now() : false;

  const errors = useMemo(() => {
    const result: Partial<Record<keyof FormState | "image", string>> = {};
    if (!form.name.trim()) result.name = "Give the room a name.";
    else if (form.name.trim().length > MAX_NAME) result.name = `Keep it to ${MAX_NAME} characters.`;
    if (!form.date) result.date = "Pick when the wait ends.";
    else if (!room && endsInPast) result.date = "A new room has to end in the future.";
    if (!form.category) result.category = "Pick a category.";
    if (!form.createdByLabel.trim()) result.createdByLabel = "Add a host name.";
    else if (form.createdByLabel.trim().length > MAX_HOST) result.createdByLabel = `Keep it to ${MAX_HOST} characters.`;
    if (!room && !image) result.image = "Add a thumbnail image.";
    if (form.description.length > MAX_DESCRIPTION_LENGTH) result.description = "That description is too long.";
    if (form.ctaText.trim().length > MAX_CTA_TEXT_LENGTH) result.ctaText = `Keep it to ${MAX_CTA_TEXT_LENGTH} characters.`;
    if (form.ctaLink.trim() && !isSafeCtaLink(form.ctaLink.trim())) {
      result.ctaLink = "Use a full web address starting with https://";
    }
    if (!form.description.trim() && (form.ctaText.trim() || form.ctaLink.trim())) {
      result.description = "Add a description to use a button.";
    }
    return result;
  }, [form, image, room, endsInPast]);

  const readFile = useCallback(async (file: File) => {
    if (!file.type.startsWith("image/")) {
      setImageError("That isn't an image file.");
      return;
    }
    setImageError(null);
    try {
      setImage(await compressImageToDataUrl(file, MAX_IMAGE_DATA_URL_LENGTH));
    } catch (error) {
      setImageError(error instanceof Error ? error.message : "Couldn't read that image.");
    }
  }, []);

  // Paste an image straight into the open editor.
  useEffect(() => {
    if (!open) return;
    function onPaste(event: ClipboardEvent) {
      const file = Array.from(event.clipboardData?.files ?? []).find((item) => item.type.startsWith("image/"));
      if (file) {
        event.preventDefault();
        void readFile(file);
      }
    }
    document.addEventListener("paste", onPaste);
    return () => document.removeEventListener("paste", onPaste);
  }, [open, readFile]);

  const requestClose = useCallback(async () => {
    if (saving) return;
    if (dirty) {
      const discard = await confirm({
        title: "Discard your changes?",
        body: "You've changed this room but haven't saved it yet.",
        confirmLabel: "Discard",
        tone: "danger",
      });
      if (!discard) return;
    }
    onClose();
  }, [dirty, saving, confirm, onClose]);

  async function submit() {
    setShowErrors(true);
    if (Object.keys(errors).length > 0) return;
    setSaving(true);
    const payload: Record<string, unknown> = {
      name: form.name.trim(),
      date: form.date,
      time: form.time,
      category: form.category,
      createdByLabel: form.createdByLabel.trim(),
      isPrivate: form.isPrivate,
      description: form.description.trim() || null,
      ctaText: form.description.trim() ? form.ctaText.trim() || null : null,
      ctaLink: form.description.trim() ? form.ctaLink.trim() || null : null,
    };
    if (image) payload.imageUrl = image;

    if (room) {
      if (!dirty) {
        setSaving(false);
        onClose();
        return;
      }
      const result = await change<{ entry: AdminLogEntry | null }>(
        "room.update",
        { id: room.id, ...payload },
        { background: true },
      );
      setSaving(false);
      if (result) onClose();
    } else {
      // The Rooms tab opens the new row as soon as it shows up in the list.
      const result = await change<{ entry: AdminLogEntry; roomId: string }>("room.create", payload, {
        background: true,
      });
      setSaving(false);
      if (result) {
        onClose();
        onCreated?.(result.roomId);
      }
    }
  }

  function onDrop(event: DragEvent) {
    event.preventDefault();
    setDragging(false);
    const file = event.dataTransfer.files?.[0];
    if (file) void readFile(file);
  }

  const preview = image ?? (room ? roomImageUrl(room) : null);
  const visibleError = (key: keyof FormState | "image") => (showErrors ? errors[key] ?? null : null);
  const localEnd =
    endsAt && !Number.isNaN(endsAt.getTime())
      ? endsAt.toLocaleString(undefined, {
          weekday: "short",
          day: "numeric",
          month: "short",
          hour: "numeric",
          minute: "2-digit",
        })
      : null;

  return (
    <Drawer open={open} onClose={requestClose} labelledBy="room-editor-title">
      <div className="flex items-center justify-between gap-3 border-b border-white/[0.07] px-5 py-4">
        <div className="min-w-0">
          <h2 id="room-editor-title" className="truncate text-[16px] font-semibold tracking-[-0.01em]">
            {room ? "Edit room" : "New room"}
          </h2>
          <p className="truncate text-[12.5px] text-white/45">
            {room ? `Changes show up for everyone within a few seconds.` : "It goes live the moment you create it."}
          </p>
        </div>
        <IconButton label="Close" onClick={requestClose}>
          <XIcon size={16} />
        </IconButton>
      </div>

      <form
        className="admin-scroll flex-1 overflow-y-auto px-5 py-5"
        onSubmit={(event) => {
          event.preventDefault();
          void submit();
        }}
      >
        <div className="flex flex-col gap-5">
          <div className="flex flex-col gap-1.5">
            <span className="text-[12.5px] font-medium text-white/70">Thumbnail</span>
            <div
              onDragOver={(event) => {
                event.preventDefault();
                setDragging(true);
              }}
              onDragLeave={() => setDragging(false)}
              onDrop={onDrop}
              className={cx(
                "group relative aspect-[16/9] w-full overflow-hidden rounded-[16px] border transition-colors",
                dragging ? "border-[#8fb2ff]/60 bg-[#8fb2ff]/[0.06]" : "border-white/[0.08] bg-white/[0.03]",
                visibleError("image") && "border-[#ff5a5f]/50",
              )}
            >
              {preview ? (
                <>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img alt="" src={preview} className="absolute inset-0 size-full object-cover" />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 transition-opacity group-hover:opacity-100" />
                  <div className="absolute bottom-3 right-3 flex gap-2 opacity-100 transition-opacity sm:opacity-0 sm:group-hover:opacity-100">
                    <Button size="sm" variant="secondary" className="bg-black/50 backdrop-blur" onClick={() => fileRef.current?.click()}>
                      Replace
                    </Button>
                  </div>
                </>
              ) : (
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-white/45 transition-colors hover:text-white/70"
                >
                  <span className="flex size-10 items-center justify-center rounded-[12px] border border-white/[0.08] bg-white/[0.04]">
                    <ImageIcon size={18} />
                  </span>
                  <span className="text-[13px]">Drop, paste or choose an image</span>
                  <span className="text-[11.5px] text-white/30">It&apos;s resized automatically</span>
                </button>
              )}
            </div>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) void readFile(file);
                event.target.value = "";
              }}
            />
            {imageError || visibleError("image") ? (
              <p className="text-[12px] text-[#ff9a9d]">{imageError ?? visibleError("image")}</p>
            ) : null}
          </div>

          <Field
            label="Name"
            htmlFor="room-editor-name"
            error={visibleError("name")}
            counter={`${form.name.trim().length}/${MAX_NAME}`}
          >
            <TextInput
              id="room-editor-name"
              value={form.name}
              maxLength={MAX_NAME + 20}
              placeholder="e.g. Lagos Fashion Week 2026"
              onChange={(event) => set("name", event.target.value)}
            />
          </Field>

          <div className="flex flex-col gap-1.5">
            <span className="text-[12.5px] font-medium text-white/70">Wait ends</span>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-[1.25fr_1fr]">
              <DatePicker
                value={form.date}
                onChange={(iso) => set("date", iso)}
                min={room ? undefined : todayUtcIso()}
              />
              <TimePicker value={form.time} onChange={(time) => set("time", time)} />
            </div>
            {visibleError("date") ? (
              <p className="text-[12px] text-[#ff9a9d]">{visibleError("date")}</p>
            ) : localEnd ? (
              <p className={cx("text-[12px]", endsInPast ? "text-[#fcd34d]" : "text-white/40")}>
                {endsInPast
                  ? `That's in the past — saving ends the room (${localEnd} your time).`
                  : `That's ${localEnd} your time.`}
              </p>
            ) : (
              <p className="text-[12px] text-white/40">Times are in UTC, like everywhere on the site.</p>
            )}
          </div>

          <div className="flex flex-col gap-1.5">
            <span className="text-[12.5px] font-medium text-white/70">Category</span>
            <div className="flex flex-wrap gap-1.5">
              {ROOM_CATEGORIES.map((category) => (
                <button
                  key={category}
                  type="button"
                  onClick={() => set("category", category)}
                  className={cx(
                    "h-8 rounded-[10px] px-3 text-[12.5px] font-medium transition-[background,color,box-shadow]",
                    form.category === category
                      ? "bg-gradient-to-b from-[#4a4a52] to-[#3b3b42] text-white shadow-[0_1px_3px_rgba(0,0,0,0.45),inset_0_1px_0_rgba(255,255,255,0.09)] ring-1 ring-white/[0.08]"
                      : "bg-white/[0.04] text-white/55 ring-1 ring-inset ring-white/[0.06] hover:bg-white/[0.07] hover:text-white/85",
                  )}
                >
                  {category}
                </button>
              ))}
            </div>
            {visibleError("category") ? <p className="text-[12px] text-[#ff9a9d]">{visibleError("category")}</p> : null}
          </div>

          <Field
            label="Host name"
            htmlFor="room-editor-host"
            hint="Shown on the room as who's hosting it."
            error={visibleError("createdByLabel")}
          >
            <TextInput
              id="room-editor-host"
              value={form.createdByLabel}
              onChange={(event) => set("createdByLabel", event.target.value)}
            />
          </Field>

          <div className="flex items-center justify-between gap-4 rounded-[14px] border border-white/[0.07] bg-white/[0.025] px-4 py-3">
            <div className="flex min-w-0 items-start gap-3">
              <span className="mt-0.5 text-white/45">
                <EyeOffIcon size={16} />
              </span>
              <div>
                <p className="text-[13.5px] font-medium">Private room</p>
                <p className="text-[12.5px] leading-[1.45] text-white/45">
                  Hidden from Discover and search — only people with the link can join.
                </p>
              </div>
            </div>
            <Switch checked={form.isPrivate} onChange={(value) => set("isPrivate", value)} label="Private room" />
          </div>

          <Field
            label="Description"
            htmlFor="room-editor-description"
            hint="Optional — shown on the room's Description tab."
            error={visibleError("description")}
            counter={`${form.description.length}/${MAX_DESCRIPTION_LENGTH}`}
          >
            <TextArea
              id="room-editor-description"
              value={form.description}
              onChange={(event) => set("description", event.target.value)}
              placeholder="What is everyone waiting for?"
            />
          </Field>

          <div className={cx("grid grid-cols-1 gap-3 sm:grid-cols-[0.8fr_1.2fr]", !form.description.trim() && "opacity-50")}>
            <Field
              label="Button text"
              htmlFor="room-editor-cta-text"
              error={visibleError("ctaText")}
              counter={`${form.ctaText.trim().length}/${MAX_CTA_TEXT_LENGTH}`}
            >
              <TextInput
                id="room-editor-cta-text"
                value={form.ctaText}
                disabled={!form.description.trim()}
                placeholder="Get tickets"
                onChange={(event) => set("ctaText", event.target.value)}
              />
            </Field>
            <Field label="Button link" htmlFor="room-editor-cta-link" error={visibleError("ctaLink")}>
              <TextInput
                id="room-editor-cta-link"
                value={form.ctaLink}
                maxLength={MAX_CTA_LINK_LENGTH}
                disabled={!form.description.trim()}
                placeholder="https://"
                onChange={(event) => set("ctaLink", event.target.value)}
              />
            </Field>
          </div>
        </div>
        <button type="submit" className="hidden" aria-hidden tabIndex={-1} />
      </form>

      <div className="flex items-center justify-between gap-3 border-t border-white/[0.07] px-5 py-4">
        <p className="hidden text-[12px] text-white/35 sm:block">
          {room ? (dirty ? "Unsaved changes" : "No changes yet") : "You'll be the room's first participant."}
        </p>
        <div className="ml-auto flex gap-2">
          <Button variant="ghost" onClick={requestClose}>
            Cancel
          </Button>
          <Button variant="primary" loading={saving} onClick={() => void submit()} disabled={!!room && !dirty}>
            {room ? "Save changes" : "Create room"}
          </Button>
        </div>
      </div>
    </Drawer>
  );
}
