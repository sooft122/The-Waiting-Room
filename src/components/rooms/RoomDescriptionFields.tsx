"use client";

import { useEffect, useState } from "react";
import type { CSSProperties } from "react";
import { MAX_CTA_TEXT_LENGTH, MAX_DESCRIPTION_LENGTH } from "@/lib/roomDescriptionFields";

type Entrance = { className: string; style: CSSProperties };

type RoomDescriptionFieldsProps = {
  /** Prefix for the inputs' ids, so the create and edit forms never clash. */
  idPrefix: string;
  /** What "Generate using AI" writes the description from. */
  roomName: string;
  category: string;
  date: string;
  description: string;
  onDescriptionChange: (value: string) => void;
  ctaText: string;
  onCtaTextChange: (value: string) => void;
  ctaLink: string;
  onCtaLinkChange: (value: string) => void;
  ctaTextError?: string;
  entrances: { description: Entrance; ctaText: Entrance; ctaLink: Entrance };
};

/**
 * The second step shared by the Create Room and Edit Room modals: an
 * optional description (with "Generate using AI") and the optional CTA
 * button it can carry. The CTA fields stay disabled until there's a
 * description — a CTA only makes sense attached to one.
 */
export default function RoomDescriptionFields({
  idPrefix,
  roomName,
  category,
  date,
  description,
  onDescriptionChange,
  ctaText,
  onCtaTextChange,
  ctaLink,
  onCtaLinkChange,
  ctaTextError,
  entrances,
}: RoomDescriptionFieldsProps) {
  const [generating, setGenerating] = useState(false);
  const [generateError, setGenerateError] = useState<string | null>(null);

  // Once the description is cleared back out, drop whatever was in CTA
  // Text/Link too, rather than silently saving a CTA the form no longer
  // shows as editable.
  useEffect(() => {
    if (!description.trim()) {
      onCtaTextChange("");
      onCtaLinkChange("");
    }
  }, [description, onCtaTextChange, onCtaLinkChange]);

  async function handleGenerate() {
    if (!roomName.trim() || generating) return;
    setGenerating(true);
    setGenerateError(null);
    try {
      const response = await fetch("/api/rooms/generate-description", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: roomName.trim(),
          category: category || undefined,
          date: date || undefined,
          // lets the server hand back a different description on a re-roll
          previous: description.trim() || undefined,
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        setGenerateError(data.error ?? "Could not generate a description.");
        return;
      }
      onDescriptionChange(typeof data.description === "string" ? data.description : "");
    } catch {
      setGenerateError("Network error — please try again.");
    } finally {
      setGenerating(false);
    }
  }

  const hasDescription = Boolean(description.trim());

  return (
    <div className="flex w-full flex-col gap-3.5">
      <div
        className={`flex w-full flex-col gap-1.5 ${entrances.description.className}`}
        style={entrances.description.style}
      >
        <div className="flex w-full items-center justify-between">
          <label htmlFor={`${idPrefix}-description`} className="font-satoshi text-[12px] text-white">
            Description <span className="text-white/40">(Optional)</span>
          </label>
          <button
            type="button"
            onClick={handleGenerate}
            disabled={generating || !roomName.trim()}
            className="flex items-center gap-1.5 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img alt="" className="size-[15px]" src="/icons/artificial-intelligence-08.svg" />
            <span className="font-satoshi text-[12px] text-white">
              {generating ? "Generating…" : "Generate using AI"}
            </span>
          </button>
        </div>
        <textarea
          id={`${idPrefix}-description`}
          value={description}
          onChange={(event) => onDescriptionChange(event.target.value)}
          placeholder="Describe this event..."
          maxLength={MAX_DESCRIPTION_LENGTH}
          rows={5}
          className="h-[131px] w-full resize-none rounded-[8px] border border-[#2b2d30] bg-[#1b1c21] p-2.5 font-satoshi text-[12px] text-white placeholder:text-white/50 focus:outline-none focus:ring-1 focus:ring-white/30"
        />
        {generateError ? (
          <p className="font-inter text-[11px] text-red-400">{generateError}</p>
        ) : null}
      </div>

      <div
        className={`flex w-full flex-col gap-1.5 ${entrances.ctaText.className}`}
        style={entrances.ctaText.style}
      >
        <div className="flex h-4 w-full items-center justify-between">
          <label htmlFor={`${idPrefix}-cta-text`} className="font-satoshi text-[12px] text-white">
            CTA Text <span className="text-white/40">(Optional)</span>
          </label>
          <span className="font-satoshi text-[12px] text-white/50">
            {MAX_CTA_TEXT_LENGTH} characters max
          </span>
        </div>
        <input
          id={`${idPrefix}-cta-text`}
          type="text"
          value={ctaText}
          onChange={(event) => onCtaTextChange(event.target.value)}
          placeholder="What should your redirect button say..."
          maxLength={MAX_CTA_TEXT_LENGTH}
          disabled={!hasDescription}
          className="h-9 w-full rounded-[8px] border border-[#2b2d30] bg-[#1b1c21] px-2.5 font-satoshi text-[12px] text-white placeholder:text-white/50 focus:outline-none focus:ring-1 focus:ring-white/30 disabled:cursor-not-allowed disabled:opacity-40"
        />
        {ctaTextError ? <p className="font-inter text-[11px] text-red-400">{ctaTextError}</p> : null}
      </div>

      <div
        className={`flex w-full flex-col gap-1.5 ${entrances.ctaLink.className}`}
        style={entrances.ctaLink.style}
      >
        <label htmlFor={`${idPrefix}-cta-link`} className="font-satoshi text-[12px] text-white">
          CTA Link <span className="text-white/40">(Optional)</span>
        </label>
        <input
          id={`${idPrefix}-cta-link`}
          type="url"
          value={ctaLink}
          onChange={(event) => onCtaLinkChange(event.target.value)}
          placeholder="Where should your link redirect to..."
          disabled={!hasDescription}
          className="h-9 w-full rounded-[8px] border border-[#2b2d30] bg-[#1b1c21] px-2.5 font-satoshi text-[12px] text-white placeholder:text-white/50 focus:outline-none focus:ring-1 focus:ring-white/30 disabled:cursor-not-allowed disabled:opacity-40"
        />
      </div>
    </div>
  );
}
