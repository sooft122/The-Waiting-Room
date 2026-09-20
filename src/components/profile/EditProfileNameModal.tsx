"use client";

import { useState } from "react";
import type { FormEvent } from "react";
import ModalShell from "@/components/rooms/ModalShell";
import ProfileAvatar from "./ProfileAvatar";

type EditProfileNameModalProps = {
  currentName: string;
  email: string;
  avatarUrl: string | null;
  onClose: () => void;
  onSaved: (updates: { displayName?: string; avatarUrl?: string }) => void;
};

async function patchProfile(updates: Record<string, string>) {
  const response = await fetch("/api/profile", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(updates),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error ?? "Something went wrong.");
  return data.profile;
}

export default function EditProfileNameModal({
  currentName,
  email,
  avatarUrl,
  onClose,
  onSaved,
}: EditProfileNameModalProps) {
  const [name, setName] = useState(currentName);
  const [pendingAvatar, setPendingAvatar] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleAvatarChange(dataUrl: string) {
    setPendingAvatar(dataUrl);
    try {
      await patchProfile({ avatarUrl: dataUrl });
      onSaved({ avatarUrl: dataUrl });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not update photo.");
      setPendingAvatar(null);
    }
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) {
      setError("Name cannot be empty.");
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      await patchProfile({ displayName: trimmed });
      onSaved({ displayName: trimmed });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <ModalShell onClose={onClose} labelledBy="edit-profile-title">
      <button
        type="button"
        onClick={onClose}
        aria-label="Close"
        className="absolute right-5 top-5 size-5 cursor-pointer"
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img alt="" className="block size-full" src="/icons/cancel-01.svg" />
      </button>

      <h2 id="edit-profile-title" className="sr-only">
        Edit Profile
      </h2>

      <div className="flex flex-col gap-5">
        <div className="flex items-center gap-[11px]">
          <ProfileAvatar
            src={pendingAvatar ?? avatarUrl}
            anonymous={false}
            onChange={handleAvatarChange}
          />
          <div className="flex flex-col gap-0.5">
            <p className="font-satoshi text-[18px] text-white">{currentName}</p>
            <p className="font-satoshi text-[14px] text-white/60">{email}</p>
          </div>
        </div>

        <div className="h-px w-full bg-white/10" />

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="profile-name" className="font-satoshi text-[12px] text-white">
              Change Profile Name
            </label>
            <input
              id="profile-name"
              type="text"
              value={name}
              onChange={(event) => setName(event.target.value)}
              maxLength={40}
              className="h-9 w-full rounded-[8px] border border-[#2b2d30] bg-[#1b1c21] px-2.5 font-satoshi text-[12px] text-white focus:outline-none focus:ring-1 focus:ring-white/30"
            />
            {error ? <p className="font-inter text-[11px] text-red-400">{error}</p> : null}
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="relative flex w-full flex-col items-center overflow-hidden rounded-[10px] bg-white p-px shadow-[0px_1px_4px_0px_rgba(0,0,0,0.2)] disabled:opacity-60"
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
                {submitting ? "Saving…" : "Save Changes"}
              </span>
            </span>
          </button>
        </form>
      </div>
    </ModalShell>
  );
}
