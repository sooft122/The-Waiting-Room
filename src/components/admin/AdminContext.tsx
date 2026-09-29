"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import type { AdminLogEntry, AdminPerson, AdminRoom, AdminSnapshot } from "@/lib/admin/types";
import { UndoIcon, RedoIcon, XIcon, CheckIcon } from "./icons";
import { Button, Dialog, cx } from "./ui";

export type AdminTab = "overview" | "rooms" | "people" | "activity" | "settings";

export class AdminApiError extends Error {}

export type AdminCall = <T>(op: string, args?: Record<string, unknown>) => Promise<T>;

export function createAdminCall(adminKey: string): AdminCall {
  return async function call<T>(op: string, args: Record<string, unknown> = {}): Promise<T> {
    let response: Response;
    try {
      response = await fetch("/api/admin", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-admin-key": adminKey },
        body: JSON.stringify({ op, args }),
        cache: "no-store",
      });
    } catch {
      throw new AdminApiError("You seem to be offline — check your connection.");
    }
    if (response.status === 404) {
      throw new AdminApiError("Your admin session has ended. Reload the page and sign in again.");
    }
    const data = await response.json().catch(() => null);
    if (!response.ok) throw new AdminApiError(data?.error ?? "Something went wrong — please try again.");
    return data as T;
  };
}

// ---------------------------------------------------------------------------

type Toast = {
  id: number;
  message: string;
  tone: "default" | "error" | "success";
  /** A logged change — the toast offers to undo it (or redo, if it was an undo). */
  entry?: AdminLogEntry;
};

type ConfirmOptions = {
  title: string;
  body?: ReactNode;
  confirmLabel: string;
  tone?: "default" | "danger";
};

type FocusTarget = { tab: "rooms"; roomId: string } | { tab: "people"; identity: string };

type AdminContextValue = {
  call: AdminCall;
  admin: { email: string; name: string; image: string | null };
  adminKey: string;
  snapshot: AdminSnapshot | null;
  people: AdminPerson[] | null;
  now: number;
  tab: AdminTab;
  setTab: (tab: AdminTab) => void;
  /** Re-fetch rooms, the log and settings (and people, if loaded). */
  refresh: () => Promise<void>;
  refreshPeople: () => Promise<void>;
  /** Runs a change, shows a toast that can undo it, and refreshes the
   * dashboard — waiting for that refresh unless `background` is set. */
  change: <T extends { entry: AdminLogEntry | null }>(
    op: string,
    args: Record<string, unknown>,
    options?: { quiet?: boolean; background?: boolean },
  ) => Promise<T | null>;
  reverse: (entry: AdminLogEntry) => Promise<void>;
  notify: (message: string, tone?: Toast["tone"]) => void;
  confirm: (options: ConfirmOptions) => Promise<boolean>;
  openEditor: (room: AdminRoom | "new") => void;
  openPalette: () => void;
  focus: FocusTarget | null;
  focusOn: (target: FocusTarget) => void;
  clearFocus: () => void;
  /** Bumps whenever any change lands, so open detail panels re-fetch. */
  changeCount: number;
};

const AdminContext = createContext<AdminContextValue | null>(null);

export function useAdmin(): AdminContextValue {
  const ctx = useContext(AdminContext);
  if (!ctx) throw new Error("useAdmin must be used inside the admin dashboard");
  return ctx;
}

export function AdminContextProvider({
  value,
  children,
}: {
  value: Omit<AdminContextValue, "change" | "reverse" | "notify" | "confirm" | "changeCount">;
  children: ReactNode;
}) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [changeCount, setChangeCount] = useState(0);
  const [confirmState, setConfirmState] = useState<(ConfirmOptions & { resolve: (ok: boolean) => void }) | null>(
    null,
  );
  const nextToastId = useRef(1);
  const { call, refresh, refreshPeople, people } = value;

  const dismiss = useCallback((id: number) => setToasts((current) => current.filter((toast) => toast.id !== id)), []);

  const push = useCallback((toast: Omit<Toast, "id">) => {
    const id = nextToastId.current++;
    setToasts((current) => [...current.slice(-3), { ...toast, id }]);
    return id;
  }, []);

  const notify = useCallback((message: string, tone: Toast["tone"] = "default") => {
    push({ message, tone });
  }, [push]);

  // Only the room list and log are waited on — they're quick, and what the
  // caller shows next depends on them. The people list is heavier and
  // refreshes in the background, so a saved change never feels slow.
  const afterChange = useCallback(async () => {
    setChangeCount((count) => count + 1);
    if (people) void refreshPeople();
    await refresh();
  }, [refresh, refreshPeople, people]);

  const change = useCallback(
    async <T extends { entry: AdminLogEntry | null }>(
      op: string,
      args: Record<string, unknown>,
      options?: { quiet?: boolean; background?: boolean },
    ): Promise<T | null> => {
      let result: T;
      try {
        result = await call<T>(op, args);
      } catch (error) {
        push({ message: error instanceof Error ? error.message : "Something went wrong.", tone: "error" });
        return null;
      }
      // The toast goes up straight away. Normally the promise settles once the
      // dashboard's own data has caught up, so whatever the caller shows next
      // already reflects the change; `background` skips that wait for callers
      // that are simply closing (the editor).
      if (result.entry && !options?.quiet) push({ message: result.entry.summary, tone: "default", entry: result.entry });
      const refreshed = afterChange().catch(() => undefined);
      if (!options?.background) await refreshed;
      return result;
    },
    [call, afterChange, push],
  );

  const reverse = useCallback(
    async (entry: AdminLogEntry) => {
      const undoing = entry.status === "done";
      let result: { entry: AdminLogEntry };
      try {
        result = await call<{ entry: AdminLogEntry }>(undoing ? "log.undo" : "log.redo", { id: entry.id });
      } catch (error) {
        push({ message: error instanceof Error ? error.message : "Something went wrong.", tone: "error" });
        return;
      }
      push({
        message: `${undoing ? "Undone" : "Redone"}: ${entry.summary}`,
        tone: "success",
        entry: result.entry,
      });
      await afterChange().catch(() => undefined);
    },
    [call, afterChange, push],
  );

  const confirm = useCallback(
    (options: ConfirmOptions) => new Promise<boolean>((resolve) => setConfirmState({ ...options, resolve })),
    [],
  );

  const closeConfirm = useCallback(
    (ok: boolean) => {
      confirmState?.resolve(ok);
      setConfirmState(null);
    },
    [confirmState],
  );

  return (
    <AdminContext.Provider value={{ ...value, change, reverse, notify, confirm, changeCount }}>
      {children}
      <Toasts toasts={toasts} onDismiss={dismiss} onReverse={reverse} />
      <Dialog open={!!confirmState} onClose={() => closeConfirm(false)} labelledBy="admin-confirm-title" width={420}>
        {confirmState ? (
          <div className="p-6">
            <h2 id="admin-confirm-title" className="text-[17px] font-semibold tracking-[-0.01em]">
              {confirmState.title}
            </h2>
            {confirmState.body ? (
              <div className="mt-2 text-[13.5px] leading-[1.55] text-white/55">{confirmState.body}</div>
            ) : null}
            <div className="mt-6 flex justify-end gap-2">
              <Button variant="ghost" onClick={() => closeConfirm(false)}>
                Cancel
              </Button>
              <Button
                autoFocus
                variant={confirmState.tone === "danger" ? "danger" : "primary"}
                onClick={() => closeConfirm(true)}
              >
                {confirmState.confirmLabel}
              </Button>
            </div>
          </div>
        ) : null}
      </Dialog>
    </AdminContext.Provider>
  );
}

// ---------------------------------------------------------------------------

// Toasts with an Undo button stay up longer, so there's time to use it
// (hovering pauses them; the Activity tab can undo any time).
const TOAST_MS = 5000;
const UNDO_TOAST_MS = 10_000;

function ToastItem({
  toast,
  onDismiss,
  onReverse,
}: {
  toast: Toast;
  onDismiss: (id: number) => void;
  onReverse: (entry: AdminLogEntry) => void;
}) {
  const [paused, setPaused] = useState(false);
  useEffect(() => {
    if (paused) return;
    const id = setTimeout(() => onDismiss(toast.id), toast.entry?.undoable ? UNDO_TOAST_MS : TOAST_MS);
    return () => clearTimeout(id);
  }, [paused, toast.id, toast.entry, onDismiss]);

  const canReverse = toast.entry?.undoable;
  const reversingUndo = toast.entry?.status === "undone";

  return (
    <div
      role="status"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      className="animate-admin-toast pointer-events-auto flex w-full max-w-[460px] items-center gap-3 rounded-[16px] border border-white/[0.09] bg-[#1d1d22]/95 py-2.5 pl-4 pr-2 text-[13px] text-white shadow-[0_24px_50px_-12px_rgba(0,0,0,0.85),inset_0_1px_0_rgba(255,255,255,0.05)] backdrop-blur-2xl"
    >
      <span
        className={cx(
          "flex size-5 shrink-0 items-center justify-center rounded-full",
          toast.tone === "error" ? "bg-[#ff5a5f]/15 text-[#ff8a8e]" : "bg-[#34d399]/15 text-[#6ee7b7]",
        )}
      >
        {toast.tone === "error" ? <XIcon size={12} /> : <CheckIcon size={12} />}
      </span>
      <span className="min-w-0 flex-1 leading-[1.4] text-white/85">{toast.message}</span>
      {canReverse ? (
        <Button
          size="sm"
          variant="secondary"
          icon={reversingUndo ? <RedoIcon size={13} /> : <UndoIcon size={13} />}
          onClick={() => {
            onDismiss(toast.id);
            onReverse(toast.entry!);
          }}
        >
          {reversingUndo ? "Redo" : "Undo"}
        </Button>
      ) : null}
      <button
        type="button"
        aria-label="Dismiss"
        onClick={() => onDismiss(toast.id)}
        className="flex size-7 shrink-0 items-center justify-center rounded-[8px] text-white/35 transition-colors hover:bg-white/[0.07] hover:text-white/80"
      >
        <XIcon size={14} />
      </button>
    </div>
  );
}

function Toasts({
  toasts,
  onDismiss,
  onReverse,
}: {
  toasts: Toast[];
  onDismiss: (id: number) => void;
  onReverse: (entry: AdminLogEntry) => void;
}) {
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-4 z-[95] flex flex-col items-center gap-2 px-4 font-inter sm:bottom-6">
      {toasts.map((toast) => (
        <ToastItem key={toast.id} toast={toast} onDismiss={onDismiss} onReverse={onReverse} />
      ))}
    </div>
  );
}
