// What each admin is allowed to change on the dashboard. Plain data and
// types only — shared by the API (which enforces it on every request) and the
// dashboard (which locks whatever someone can't use).
//
// The owner (ADMIN_EMAILS, see auth.ts) can do everything, and is the only one
// who can add, change or remove admins. That is deliberately not a permission,
// so it can never be handed to anyone else. Every admin can look around the
// whole dashboard; permissions only decide what they can change.

import type { AdminActionKind } from "./types";

export type AdminRole = "owner" | "admin";

export type AdminPermission =
  | "rooms.create"
  | "rooms.edit"
  | "rooms.trash"
  | "rooms.delete"
  | "rooms.people"
  | "chat.post"
  | "chat.moderate"
  | "people.edit"
  | "people.suspend"
  | "site.roomCreation"
  | "site.refresh";

/** Only the owner can do it. */
export type OwnerOnly = "owner";

export type PermissionInfo = {
  id: AdminPermission;
  /** Reads as an action — "You don't have permission to <label>." */
  label: string;
  description: string;
  /** Can't be undone, so it's flagged when picking permissions. */
  permanent?: boolean;
};

export const PERMISSION_GROUPS: { label: string; permissions: PermissionInfo[] }[] = [
  {
    label: "Rooms",
    permissions: [
      {
        id: "rooms.create",
        label: "Create rooms",
        description: "Start new rooms from the dashboard — even while room creation is locked.",
      },
      {
        id: "rooms.edit",
        label: "Edit rooms",
        description: "Change a room's name, time, image, description and privacy, or end it early.",
      },
      {
        id: "rooms.trash",
        label: "Trash and restore rooms",
        description: "Hide a room from everyone, and bring it back exactly as it was.",
      },
      {
        id: "rooms.delete",
        label: "Delete rooms permanently",
        description: "Delete rooms from the trash for good, chat and all.",
        permanent: true,
      },
      {
        id: "rooms.people",
        label: "Remove people from rooms",
        description: "Take someone out of a room, or out of every room they've joined.",
      },
    ],
  },
  {
    label: "Chat",
    permissions: [
      {
        id: "chat.post",
        label: "Post in chats",
        description: "Post as The Waiting Room. Everyone with alerts on gets notified.",
      },
      {
        id: "chat.moderate",
        label: "Delete messages",
        description: "Remove single messages, or clear a room's whole chat.",
      },
    ],
  },
  {
    label: "People",
    permissions: [
      {
        id: "people.edit",
        label: "Edit profiles",
        description: "Rename people, reset their names and remove their photos.",
      },
      {
        id: "people.suspend",
        label: "Suspend people",
        description: "Stop someone joining, chatting or creating rooms — and lift it again.",
      },
    ],
  },
  {
    label: "Site",
    permissions: [
      {
        id: "site.roomCreation",
        label: "Lock room creation",
        description: "Open or lock room creation for everyone, and set the message people see.",
      },
      {
        id: "site.refresh",
        label: "Refresh everyone's pages",
        description: "Make every open page fetch the latest data straight away.",
      },
    ],
  },
];

export const ALL_PERMISSIONS: AdminPermission[] = PERMISSION_GROUPS.flatMap((group) =>
  group.permissions.map((permission) => permission.id),
);

const INFO = new Map<AdminPermission, PermissionInfo>(
  PERMISSION_GROUPS.flatMap((group) => group.permissions.map((permission) => [permission.id, permission] as const)),
);

export function permissionInfo(id: AdminPermission): PermissionInfo {
  return INFO.get(id)!;
}

/** "Delete messages" → "delete messages", to use mid-sentence. */
export function permissionPhrase(id: AdminPermission): string {
  const { label } = permissionInfo(id);
  return label.charAt(0).toLowerCase() + label.slice(1);
}

/** Known permissions only, each once, in the order they're listed above —
 * so stored lists stay valid even if a permission is ever retired. */
export function normalizePermissions(values: unknown): AdminPermission[] {
  const given = new Set(Array.isArray(values) ? values : []);
  return ALL_PERMISSIONS.filter((id) => given.has(id));
}

/** One-click starting points when picking what someone can do. */
export const PERMISSION_PRESETS: { id: string; label: string; permissions: AdminPermission[] }[] = [
  { id: "full", label: "Full access", permissions: ALL_PERMISSIONS },
  { id: "moderator", label: "Moderator", permissions: ["rooms.people", "chat.moderate", "people.edit", "people.suspend"] },
  { id: "rooms", label: "Room manager", permissions: ["rooms.create", "rooms.edit", "rooms.trash", "chat.post"] },
  { id: "view", label: "View only", permissions: [] },
];

export function matchingPreset(permissions: AdminPermission[]) {
  const chosen = new Set(permissions);
  return (
    PERMISSION_PRESETS.find(
      (preset) => preset.permissions.length === chosen.size && preset.permissions.every((id) => chosen.has(id)),
    ) ?? null
  );
}

/** "Full access", "Moderator", "View only" — or "5 of 11 permissions". */
export function describeAccess(permissions: AdminPermission[]): string {
  return matchingPreset(permissions)?.label ?? `${permissions.length} of ${ALL_PERMISSIONS.length} permissions`;
}

/** What it takes to make each kind of change — and so to undo or redo it. */
export const PERMISSION_FOR_KIND: Record<AdminActionKind, AdminPermission | OwnerOnly> = {
  "room.create": "rooms.create",
  "room.update": "rooms.edit",
  "room.end": "rooms.edit",
  "room.trash": "rooms.trash",
  "room.restore": "rooms.trash",
  "room.purge": "rooms.delete",
  "room.removePerson": "rooms.people",
  "person.leaveAll": "rooms.people",
  "chat.post": "chat.post",
  "chat.delete": "chat.moderate",
  "chat.clear": "chat.moderate",
  "person.update": "people.edit",
  "person.suspend": "people.suspend",
  "person.unsuspend": "people.suspend",
  "settings.roomCreation": "site.roomCreation",
  "site.refresh": "site.refresh",
  "admin.add": "owner",
  "admin.update": "owner",
  "admin.remove": "owner",
};

export type AdminAccess = { role: AdminRole; permissions: AdminPermission[] };

export function hasPermission(access: AdminAccess, needed: AdminPermission | OwnerOnly): boolean {
  if (access.role === "owner") return true;
  return needed !== "owner" && access.permissions.includes(needed);
}

/** Why someone can't — the API's error, and the tooltip on a locked control. */
export function deniedMessage(needed: AdminPermission | OwnerOnly): string {
  if (needed === "owner") return "Only the owner can add, change or remove admins.";
  return `You don't have permission to ${permissionPhrase(needed)}.`;
}
