"use client";

import { useEffect, useState } from "react";
import { MAX_LOCK_MESSAGE_LENGTH, ROOM_CREATION_LOCKED_MESSAGE, SITE_STATE_POLL_MS } from "@/lib/siteStateShared";
import { useAdmin } from "./AdminContext";
import { plural } from "./format";
import { CopyIcon, LinkIcon, LockIcon, RefreshIcon, ShieldIcon, TrashIcon, UnlockIcon } from "./icons";
import { Button, Card, CardHeader, Segmented, TextArea } from "./ui";

/** Open / Locked for room creation, plus the message people see while it's locked. */
export function RoomCreationCard() {
  const { snapshot, change } = useAdmin();
  const setting = snapshot?.site.roomCreation;
  const [pending, setPending] = useState<boolean | null>(null);
  const [message, setMessage] = useState(setting?.message ?? "");
  const [savingMessage, setSavingMessage] = useState(false);

  useEffect(() => setMessage(setting?.message ?? ""), [setting?.message]);

  const locked = pending ?? setting?.locked ?? false;
  const messageChanged = (message.trim() || null) !== (setting?.message ?? null);

  return (
    <Card className="p-5 sm:p-6">
      <CardHeader
        title="Room creation"
        subtitle="Choose whether people can create new rooms. You can always create them from here."
      />
      <Segmented
        size="lg"
        fullWidth
        className="mt-5"
        ariaLabel="Room creation"
        value={locked ? "locked" : "open"}
        onChange={async (value) => {
          const next = value === "locked";
          if (next === (setting?.locked ?? false)) return;
          setPending(next);
          await change("settings.roomCreation", { locked: next });
          setPending(null);
        }}
        options={[
          { value: "open", label: "Open", icon: <UnlockIcon size={16} /> },
          { value: "locked", label: "Locked", icon: <LockIcon size={16} /> },
        ]}
      />
      <p className="mt-3 text-[12.5px] leading-[1.5] text-white/40">
        {locked
          ? "Create Room buttons across the site show a lock, and anyone who taps one sees the message below."
          : "Anyone signed in with Google can create a room."}
      </p>

      {locked ? (
        <div className="animate-admin-rise mt-4 flex flex-col gap-2">
          <label htmlFor="lock-message" className="text-[12.5px] font-medium text-white/70">
            Message people see
          </label>
          <TextArea
            id="lock-message"
            value={message}
            maxLength={MAX_LOCK_MESSAGE_LENGTH}
            onChange={(event) => setMessage(event.target.value)}
            placeholder={ROOM_CREATION_LOCKED_MESSAGE}
            className="min-h-[76px]"
          />
          <div className="flex items-center justify-between">
            <span className="text-[11.5px] tabular-nums text-white/30">
              {message.length}/{MAX_LOCK_MESSAGE_LENGTH}
            </span>
            <Button
              size="sm"
              variant="primary"
              disabled={!messageChanged}
              loading={savingMessage}
              onClick={async () => {
                setSavingMessage(true);
                await change("settings.roomCreation", { message: message.trim() || null });
                setSavingMessage(false);
              }}
            >
              Save message
            </Button>
          </div>
        </div>
      ) : null}
    </Card>
  );
}

export function RefreshEveryoneButton({ size = "md" }: { size?: "sm" | "md" }) {
  const { change, confirm } = useAdmin();
  const [busy, setBusy] = useState(false);
  return (
    <Button
      size={size}
      icon={<RefreshIcon size={15} />}
      loading={busy}
      onClick={async () => {
        const ok = await confirm({
          title: "Refresh every open page?",
          body: "Everyone with the site open gets its latest data within a few seconds. Nothing they're typing is lost.",
          confirmLabel: "Refresh everyone",
        });
        if (!ok) return;
        setBusy(true);
        await change("site.refresh", {});
        setBusy(false);
      }}
    >
      Refresh everyone&apos;s pages
    </Button>
  );
}

export default function SettingsView() {
  const { snapshot, adminKey, change, confirm, notify } = useAdmin();
  const [emptying, setEmptying] = useState(false);
  const trashed = (snapshot?.rooms ?? []).filter((room) => room.trashedAt);
  const dashboardUrl = typeof window !== "undefined" ? `${window.location.origin}/admin/${adminKey}` : "";

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      <RoomCreationCard />

      <Card className="p-5 sm:p-6">
        <CardHeader
          title="Live updates"
          subtitle={`Every open page checks for your changes every ${SITE_STATE_POLL_MS / 1000} seconds and updates in place — no reload, nothing lost.`}
        />
        <div className="mt-5 flex flex-wrap items-center gap-3">
          <RefreshEveryoneButton />
          <span className="flex items-center gap-2 text-[12.5px] text-white/40">
            <span className="admin-live-dot size-2 rounded-full bg-[#34d399]" />
            Connected
          </span>
        </div>
      </Card>

      <Card className="p-5 sm:p-6">
        <CardHeader
          title="Your dashboard link"
          subtitle="Keep it to yourself. Even with the link, it only opens for the admin Google accounts below — everyone else gets a plain “page not found”."
        />
        <div className="mt-5 flex items-center gap-2 rounded-[13px] border border-white/[0.07] bg-black/25 p-1.5 pl-3">
          <span className="shrink-0 text-white/35">
            <LinkIcon size={15} />
          </span>
          <span className="min-w-0 flex-1 truncate font-mono text-[12px] text-white/60">{dashboardUrl}</span>
          <Button
            size="sm"
            icon={<CopyIcon size={14} />}
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(dashboardUrl);
                notify("Dashboard link copied", "success");
              } catch {
                notify("Couldn't copy — your browser blocked it.", "error");
              }
            }}
          >
            Copy
          </Button>
        </div>
      </Card>

      <Card className="p-5 sm:p-6">
        <CardHeader
          title="Admin accounts"
          subtitle="Signed in as one of these, the link above opens this dashboard."
        />
        <div className="mt-5 flex flex-col gap-2">
          {(snapshot?.admins ?? []).map((email) => (
            <div key={email} className="flex items-center gap-2.5 rounded-[12px] bg-white/[0.03] px-3 py-2.5 text-[13px]">
              <span className="text-[#c4b5fd]">
                <ShieldIcon size={15} />
              </span>
              <span className="truncate">{email}</span>
            </div>
          ))}
        </div>
        <p className="mt-3 text-[12.5px] leading-[1.5] text-white/40">
          To add or remove one, change <span className="font-mono text-white/60">ADMIN_EMAILS</span> in Vercel → Settings →
          Environment Variables, then redeploy.
        </p>
      </Card>

      <Card className="p-5 sm:p-6 lg:col-span-2">
        <CardHeader
          title="Trash"
          subtitle={
            trashed.length === 0
              ? "Empty. Rooms you delete wait here, restorable, until you empty it."
              : `${plural(trashed.length, "room")} waiting to be restored or deleted for good.`
          }
          action={
            <Button
              variant="dangerGhost"
              icon={<TrashIcon size={15} />}
              disabled={trashed.length === 0}
              loading={emptying}
              onClick={async () => {
                const ok = await confirm({
                  title: `Permanently delete ${plural(trashed.length, "room")}?`,
                  body: "Everything in the trash — chats, participants and all — is deleted for good. This can't be undone.",
                  confirmLabel: "Empty trash",
                  tone: "danger",
                });
                if (!ok) return;
                setEmptying(true);
                for (const room of trashed) await change("room.purge", { id: room.id }, { quiet: true });
                setEmptying(false);
                notify(`Deleted ${plural(trashed.length, "room")} permanently`, "success");
              }}
            >
              Empty trash
            </Button>
          }
        />
      </Card>
    </div>
  );
}
