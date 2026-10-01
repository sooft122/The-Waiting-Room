// Shapes passed between the admin API (lib/admin, api/admin) and the
// dashboard in the browser (components/admin). Types only — safe to import
// from client components.

import type { RoomCategory } from "@/lib/rooms";
import type { SiteState } from "@/lib/siteStateShared";
import type { AdminPermission, AdminRole } from "./permissions";

export type PersonKind = "google" | "anonymous" | "system";

export type AdminRoom = {
  id: string;
  name: string;
  date: string;
  time: string | null;
  /** ISO — when the wait ends (date + time, UTC). */
  endsAt: string;
  category: RoomCategory;
  createdBy: string;
  createdByLabel: string;
  createdByCountry: string | null;
  createdAt: string;
  description: string | null;
  ctaText: string | null;
  ctaLink: string | null;
  isPrivate: boolean;
  participantCount: number;
  messageCount: number;
  /** Set while the room sits in the trash (hidden from everyone, restorable). */
  trashedAt: string | null;
  /** Changes whenever the image does — part of the thumbnail URL, so browsers re-fetch it. */
  imageVersion: string;
};

export type AdminParticipant = {
  identity: string;
  kind: PersonKind;
  name: string;
  image: string | null;
  joinedAt: string | null;
  country: string | null;
  mood: string | null;
  lastCheckIn: string | null;
  messageCount: number;
  isHost: boolean;
  suspended: boolean;
};

export type AdminMessage = {
  id: string;
  roomId: string;
  identity: string;
  kind: PersonKind;
  /** The name the message was sent under. */
  displayName: string;
  color: string;
  text: string;
  createdAt: string;
};

export type AdminRoomDetail = {
  room: AdminRoom;
  participants: AdminParticipant[];
  messages: AdminMessage[];
  moods: { mood: string; count: number }[];
  countries: { code: string; count: number }[];
};

export type AdminPerson = {
  identity: string;
  kind: PersonKind;
  name: string;
  /** Google account email — null for Anonymous visitors. */
  email: string | null;
  anonNumber: number | null;
  /** Photo to show: their uploaded one (via the admin image route) or Google's. */
  image: string | null;
  /** A name they (or the admin) set, replacing their default one. */
  nameOverride: string | null;
  hasUploadedPhoto: boolean;
  firstSeenAt: string | null;
  lastSeenAt: string | null;
  roomsJoined: number;
  roomsCreated: number;
  suspended: boolean;
};

export type AdminPersonRoom = {
  room: AdminRoom;
  joinedAt: string | null;
  mood: string | null;
  country: string | null;
  lastCheckIn: string | null;
  messageCount: number;
  isHost: boolean;
};

export type AdminPersonDetail = {
  person: AdminPerson;
  rooms: AdminPersonRoom[];
  messages: (AdminMessage & { roomName: string })[];
  totalWaitMs: number;
};

export type AdminActionKind =
  | "room.create"
  | "room.update"
  | "room.end"
  | "room.trash"
  | "room.restore"
  | "room.purge"
  | "room.removePerson"
  | "chat.post"
  | "chat.delete"
  | "chat.clear"
  | "person.update"
  | "person.suspend"
  | "person.unsuspend"
  | "person.leaveAll"
  | "settings.roomCreation"
  | "site.refresh"
  | "admin.add"
  | "admin.update"
  | "admin.remove";

export type AdminLogEntry = {
  id: string;
  at: string;
  actor: string;
  kind: AdminActionKind;
  targetType: "room" | "person" | "settings" | "site" | "admin";
  targetId: string;
  targetLabel: string;
  summary: string;
  undoable: boolean;
  status: "done" | "undone";
  /** When it was last undone or redone. */
  changedAt: string | null;
};

/** Someone the owner has made an admin, and what they're allowed to do. */
export type AdminMember = {
  /** Their Google account, lowercased. */
  email: string;
  permissions: AdminPermission[];
  addedAt: string;
  addedBy: string;
  /** When the owner last changed their permissions. */
  updatedAt: string | null;
};

/** Everyone who can open the dashboard: the owner (ADMIN_EMAILS) and the
 * admins they've added. */
export type AdminTeam = { owners: string[]; members: AdminMember[] };

/** The admin using the dashboard. It comes with every snapshot, so a change
 * to their access shows up on their screen within seconds. */
export type AdminMe = { email: string; role: AdminRole; permissions: AdminPermission[] };

export type AdminSnapshot = {
  rooms: AdminRoom[];
  log: AdminLogEntry[];
  site: SiteState;
  team: AdminTeam;
  me: AdminMe;
  serverTime: string;
};

/** Returned by every change, so the dashboard can offer "Undo" right away. */
export type AdminChangeResult = { entry: AdminLogEntry };
