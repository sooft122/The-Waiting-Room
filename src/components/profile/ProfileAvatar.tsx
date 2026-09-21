"use client";

import { useRef, useState } from "react";
import { compressImageToDataUrl } from "@/lib/compressImage";

// Generous — actual upload size is capped by compressImageToDataUrl
// downscaling every image before it's stored, not by this raw-file check.
const MAX_AVATAR_BYTES = 20 * 1024 * 1024;

type ProfileAvatarProps = {
  src: string | null;
  anonymous: boolean;
  size?: number;
  onChange?: (dataUrl: string) => void;
};

function AvatarImage({ src, anonymous }: { src: string | null; anonymous: boolean }) {
  if (anonymous) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        alt=""
        className="absolute inset-0 m-auto size-1/2 object-contain"
        src="/icons/logo-avatar.svg"
      />
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      alt=""
      className="absolute inset-0 size-full object-cover"
      src={src ?? "/images/default-avatar.png"}
    />
  );
}

/**
 * The design's "Image Change" component, extended with a hover affordance:
 * hovering the avatar itself reveals a change-photo overlay you can click
 * directly — a shortcut alongside opening the edit modal via the pencil
 * icon. Anonymous accounts render read-only (no hover, no upload).
 */
export default function ProfileAvatar({
  src,
  anonymous,
  size = 80,
  onChange,
}: ProfileAvatarProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [hovering, setHovering] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canEdit = !anonymous && !!onChange;

  async function handleFile(file: File) {
    if (!file.type.startsWith("image/")) {
      setError("Please choose an image file.");
      return;
    }
    if (file.size > MAX_AVATAR_BYTES) {
      setError("Image must be under 20MB.");
      return;
    }
    setError(null);
    try {
      onChange?.(await compressImageToDataUrl(file));
    } catch (err) {
      console.error("ProfileAvatar: compressImageToDataUrl failed", err);
      const detail = err instanceof Error ? err.message : String(err);
      setError(`Could not process that image: ${detail}`);
    }
  }

  return (
    <div className="flex flex-col items-center gap-1">
      <div
        className="relative shrink-0 overflow-hidden rounded-full bg-[#232323]"
        style={{ width: size, height: size }}
        onMouseEnter={() => canEdit && setHovering(true)}
        onMouseLeave={() => setHovering(false)}
      >
        <AvatarImage src={src} anonymous={anonymous} />

        {canEdit ? (
          <>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              aria-label="Change profile picture"
              className={`absolute inset-0 flex items-center justify-center bg-black/55 transition-opacity ${
                hovering ? "opacity-100" : "opacity-0"
              }`}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img alt="" className="size-1/3" src="/icons/camera-01.svg" />
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) handleFile(file);
                event.target.value = "";
              }}
            />
          </>
        ) : null}
      </div>
      {error ? <p className="max-w-[120px] text-center font-inter text-[10px] text-red-400">{error}</p> : null}
    </div>
  );
}
