import { headers } from "next/headers";
import { waitUntil } from "@vercel/functions";
import {
  ROOM_CATEGORIES,
  createRoom,
  getRoomEndTime,
  isRoomCategory,
  joinRoom,
  parseRoomTime,
  type Room,
} from "@/lib/rooms";
import { parseDescriptionFields } from "@/lib/roomDescriptionFields";
import { isCountryCode, setParticipantCountry } from "@/lib/roomCountry";
import { notifyRoomChat } from "@/lib/roomChatNotifier";
import {
  bumpContentVersion,
  bumpPeopleVersion,
  getSiteState,
  setRoomCreationSetting,
  type RoomCreationSetting,
} from "@/lib/siteState";
import { MAX_LOCK_MESSAGE_LENGTH } from "@/lib/siteStateShared";
import { isAnySuspended, setSuspended } from "@/lib/suspension";
import type { Profile } from "@/lib/profile";
import { getAdminAccess, getOwnerEmails, isOwnerEmail, type AdminUser } from "./auth";
import { AdminError } from "./errors";
import { UNDO_WINDOW_DAYS, getAction, listActions, recordAction, setActionStatus } from "./log";
import {
  PERMISSION_FOR_KIND,
  deniedMessage,
  describeAccess,
  hasPermission,
  normalizePermissions,
  permissionPhrase,
  type AdminPermission,
  type OwnerOnly,
} from "./permissions";
import { deleteMember, getMember, listMembers, normalizeEmail, saveMember } from "./team";
import {
  MAX_CHAT_TEXT_LENGTH,
  clearRoomChat,
  findMessage,
  getAdminRoomDetail,
  listAdminRooms,
  postSystemMessage,
  purgeRoom,
  reinsertRawMessages,
  removeMembership,
  removeRawMessages,
  requireRoom,
  restoreMembership,
  restoreRoom,
  snapshotMembership,
  trashRoom,
  writeRoomRecord,
  type MembershipSnapshot,
  type StoredRoom,
} from "./rooms";
import {
  MAX_NAME_LENGTH,
  getAdminPerson,
  getAdminPersonDetail,
  getJoinedRoomIdsFor,
  listAdminPeople,
  personKind,
  readProfileForEdit,
  resolvePeople,
  writeProfile,
} from "./people";
import type { AdminActionKind, AdminChangeResult, AdminLogEntry, AdminMember, AdminSnapshot } from "./types";

type Args = Record<string, unknown>;

// Mirrors the user-facing room routes' limits.
const MAX_ROOM_NAME_LENGTH = 100;
const MAX_HOST_LABEL_LENGTH = 60;
const MAX_IMAGE_DATA_URL_LENGTH = 5_600_000;
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

function text(value: unknown, label: string): string {
  if (typeof value !== "string" || !value.trim()) throw new AdminError(`${label} is required.`);
  return value.trim();
}

function quote(name: string): string {
  return `“${name}”`;
}

/** An admin's own account is the owner's to change — other admins can change
 * everyone else's (as far as their permissions go), and their own. */
async function assertCanChangeAccount(admin: AdminUser, identity: string): Promise<void> {
  if (admin.role === "owner" || normalizeEmail(identity) === normalizeEmail(admin.email)) return;
  if (await getAdminAccess(identity)) {
    throw new AdminError("Only the owner can change another admin's account.", 403);
  }
}

// ---------------------------------------------------------------------------
// Rooms

type RoomFields = Pick<
  StoredRoom,
  "name" | "date" | "time" | "category" | "description" | "ctaText" | "ctaLink" | "isPrivate" | "createdByLabel"
> & { imageUrl?: string };

/** The dashboard's room form — the same rules as the user-facing forms,
 * except that an edit may move the end into the past (to end a room early). */
function parseRoomFields(args: Args, mode: "create" | "update"): RoomFields {
  const name = text(args.name, "A room name");
  if (name.length > MAX_ROOM_NAME_LENGTH) {
    throw new AdminError(`The name must be ${MAX_ROOM_NAME_LENGTH} characters or fewer.`);
  }
  const date = typeof args.date === "string" ? args.date : "";
  if (!ISO_DATE.test(date) || Number.isNaN(Date.parse(date))) throw new AdminError("Pick a valid end date.");
  const parsedTime = parseRoomTime(args.time);
  if (!parsedTime.ok) throw new AdminError("The time must look like 18:30.");
  if (mode === "create" && getRoomEndTime({ date, time: parsedTime.time }).getTime() <= Date.now()) {
    throw new AdminError("A new room has to end in the future.");
  }
  if (!isRoomCategory(args.category)) {
    throw new AdminError(`Pick a category: ${ROOM_CATEGORIES.join(", ")}.`);
  }
  const description = parseDescriptionFields(args);
  if (!description.ok) throw new AdminError(description.error);
  const createdByLabel = text(args.createdByLabel, "A host name");
  if (createdByLabel.length > MAX_HOST_LABEL_LENGTH) {
    throw new AdminError(`The host name must be ${MAX_HOST_LABEL_LENGTH} characters or fewer.`);
  }

  const fields: RoomFields = {
    name,
    date,
    time: parsedTime.time,
    category: args.category,
    ...description.fields,
    isPrivate: args.isPrivate === true,
    createdByLabel,
  };
  if (args.imageUrl !== undefined || mode === "create") {
    if (typeof args.imageUrl !== "string" || !args.imageUrl.startsWith("data:image/")) {
      throw new AdminError("Add a thumbnail image.");
    }
    if (args.imageUrl.length > MAX_IMAGE_DATA_URL_LENGTH) {
      throw new AdminError("That image is too large — please use a file under 4MB.");
    }
    fields.imageUrl = args.imageUrl;
  }
  return fields;
}

const FIELD_LABELS: [keyof StoredRoom, string][] = [
  ["name", "name"],
  ["date", "end date"],
  ["time", "end time"],
  ["category", "category"],
  ["imageUrl", "image"],
  ["description", "description"],
  ["ctaText", "button text"],
  ["ctaLink", "button link"],
  ["isPrivate", "privacy"],
  ["createdByLabel", "host name"],
];

function describeChanges(before: StoredRoom, after: StoredRoom): string[] {
  return FIELD_LABELS.filter(([field]) => (before[field] ?? null) !== (after[field] ?? null)).map(
    ([, label]) => label,
  );
}

/** Room edits keep both versions for undo/redo; an unchanged image is kept
 * only once, since it can be megabytes. */
type RoomEditSnapshot = { before: StoredRoom; after: Omit<StoredRoom, "imageUrl"> & { imageUrl?: string } };

function roomEditSnapshot(before: StoredRoom, after: StoredRoom): RoomEditSnapshot {
  if (before.imageUrl !== after.imageUrl) return { before, after };
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { imageUrl, ...rest } = after;
  return { before, after: rest };
}

async function createRoomOp(admin: AdminUser, args: Args): Promise<AdminChangeResult & { roomId: string }> {
  const fields = parseRoomFields(args, "create");
  const countryCode = headers().get("x-vercel-ip-country");
  const room = await createRoom({
    name: fields.name,
    date: fields.date,
    time: fields.time,
    category: fields.category,
    imageUrl: fields.imageUrl!,
    createdBy: admin.email,
    createdByLabel: fields.createdByLabel,
    createdByCountry: isCountryCode(countryCode) ? countryCode : null,
    description: fields.description,
    ctaText: fields.ctaText,
    ctaLink: fields.ctaLink,
    isPrivate: fields.isPrivate,
  });
  // Like any room: its creator is its first participant.
  await Promise.all([
    joinRoom(admin.email, room.id),
    isCountryCode(countryCode) ? setParticipantCountry(room.id, admin.email, countryCode) : null,
  ]);
  const entry = await recordAction(
    {
      actor: admin.email,
      kind: "room.create",
      targetType: "room",
      targetId: room.id,
      targetLabel: room.name,
      summary: `Created ${quote(room.name)}${room.isPrivate ? " as a private room" : ""}`,
      undoable: true,
    },
    { roomId: room.id },
  );
  await bumpContentVersion();
  return { entry, roomId: room.id };
}

async function saveRoomEdit(
  admin: AdminUser,
  kind: "room.update" | "room.end",
  before: StoredRoom,
  after: StoredRoom,
  summary: string,
): Promise<AdminChangeResult> {
  await writeRoomRecord(before.id, after);
  const entry = await recordAction(
    {
      actor: admin.email,
      kind,
      targetType: "room",
      targetId: before.id,
      targetLabel: after.name,
      summary,
      undoable: true,
    },
    roomEditSnapshot(before, after),
  );
  await bumpContentVersion();
  return { entry };
}

async function updateRoomOp(admin: AdminUser, args: Args): Promise<AdminChangeResult | { entry: null }> {
  const id = text(args.id, "A room id");
  const { room: before } = await requireRoom(id);
  const fields = parseRoomFields(args, "update");
  const after: StoredRoom = { ...before, ...fields, imageUrl: fields.imageUrl ?? before.imageUrl };
  const changes = describeChanges(before, after);
  if (changes.length === 0) return { entry: null };
  const summary =
    before.name !== after.name
      ? `Renamed ${quote(before.name)} to ${quote(after.name)}${changes.length > 1 ? ` (and changed ${changes.filter((c) => c !== "name").join(", ")})` : ""}`
      : `Edited ${quote(after.name)} — ${changes.join(", ")}`;
  return saveRoomEdit(admin, "room.update", before, after, summary);
}

async function endRoomOp(admin: AdminUser, args: Args): Promise<AdminChangeResult> {
  const id = text(args.id, "A room id");
  const { room: before } = await requireRoom(id);
  if (getRoomEndTime({ date: before.date, time: before.time ?? null }).getTime() <= Date.now()) {
    throw new AdminError("That room has already ended.");
  }
  // Ends it now, to the minute (room times are stored in UTC).
  const now = new Date(Date.now() - 60_000);
  const after: StoredRoom = {
    ...before,
    date: now.toISOString().slice(0, 10),
    time: now.toISOString().slice(11, 16),
  };
  return saveRoomEdit(admin, "room.end", before, after, `Ended ${quote(before.name)} early`);
}

async function trashRoomOp(admin: AdminUser, args: Args): Promise<AdminChangeResult> {
  const id = text(args.id, "A room id");
  const room = await trashRoom(id, admin.email);
  const entry = await recordAction({
    actor: admin.email,
    kind: "room.trash",
    targetType: "room",
    targetId: id,
    targetLabel: room.name,
    summary: `Moved ${quote(room.name)} to the trash`,
    undoable: true,
  });
  await bumpContentVersion();
  return { entry };
}

async function restoreRoomOp(admin: AdminUser, args: Args): Promise<AdminChangeResult> {
  const id = text(args.id, "A room id");
  const room = await restoreRoom(id);
  const entry = await recordAction({
    actor: admin.email,
    kind: "room.restore",
    targetType: "room",
    targetId: id,
    targetLabel: room.name,
    summary: `Restored ${quote(room.name)} from the trash`,
    undoable: true,
  });
  await bumpContentVersion();
  return { entry };
}

async function purgeRoomOp(admin: AdminUser, args: Args): Promise<AdminChangeResult> {
  const id = text(args.id, "A room id");
  const room = await purgeRoom(id);
  const entry = await recordAction({
    actor: admin.email,
    kind: "room.purge",
    targetType: "room",
    targetId: id,
    targetLabel: room.name,
    summary: `Deleted ${quote(room.name)} permanently`,
    undoable: false,
  });
  await bumpContentVersion();
  return { entry };
}

async function removePersonOp(admin: AdminUser, args: Args): Promise<AdminChangeResult> {
  const roomId = text(args.roomId, "A room id");
  const identity = text(args.identity, "A person");
  const { room } = await requireRoom(roomId);
  if (room.createdBy === identity) {
    throw new AdminError("A room's host can't be removed from their own room.");
  }
  await assertCanChangeAccount(admin, identity);
  const snapshot = await snapshotMembership(roomId, identity);
  if (!snapshot.joinedAt) throw new AdminError("They're not in that room anymore.", 409);
  const person = await getAdminPerson(identity, []).catch(() => null);
  const personName = person?.name ?? identity;
  await removeMembership(snapshot);
  const entry = await recordAction(
    {
      actor: admin.email,
      kind: "room.removePerson",
      targetType: "person",
      targetId: identity,
      targetLabel: personName,
      summary: `Removed ${personName} from ${quote(room.name)}`,
      undoable: true,
    },
    snapshot,
  );
  await Promise.all([bumpContentVersion(), bumpPeopleVersion()]);
  return { entry };
}

async function leaveAllOp(admin: AdminUser, args: Args): Promise<AdminChangeResult> {
  const identity = text(args.identity, "A person");
  await assertCanChangeAccount(admin, identity);
  const rooms = await listAdminRooms();
  const hosted = new Set(rooms.filter((room) => room.createdBy === identity).map((room) => room.id));
  const roomIds = (await getJoinedRoomIdsFor(identity)).filter((id) => !hosted.has(id));
  const snapshots = (await Promise.all(roomIds.map((roomId) => snapshotMembership(roomId, identity)))).filter(
    (snapshot) => snapshot.joinedAt,
  );
  if (snapshots.length === 0) throw new AdminError("They're not in any rooms they don't host.");
  const person = await getAdminPerson(identity, rooms);
  await Promise.all(snapshots.map(removeMembership));
  const entry = await recordAction(
    {
      actor: admin.email,
      kind: "person.leaveAll",
      targetType: "person",
      targetId: identity,
      targetLabel: person.name,
      summary: `Removed ${person.name} from ${snapshots.length} room${snapshots.length === 1 ? "" : "s"}`,
      undoable: true,
    },
    snapshots,
  );
  await Promise.all([bumpContentVersion(), bumpPeopleVersion()]);
  return { entry };
}

// ---------------------------------------------------------------------------
// Chat

type ChatSnapshot = { roomId: string; raws: string[] };

async function postMessageOp(admin: AdminUser, args: Args): Promise<AdminChangeResult> {
  const roomId = text(args.roomId, "A room id");
  const body = text(args.text, "A message").slice(0, MAX_CHAT_TEXT_LENGTH);
  const located = await requireRoom(roomId);
  if (located.where === "trash") throw new AdminError("Restore the room before posting in it.");
  const { raw, message } = await postSystemMessage(roomId, body);
  // Same alerts as any new message, for everyone who turned them on.
  waitUntil(notifyRoomChat({ ...located.room, participantCount: 0 } as Room, message));
  const entry = await recordAction(
    {
      actor: admin.email,
      kind: "chat.post",
      targetType: "room",
      targetId: roomId,
      targetLabel: located.room.name,
      summary: `Posted in ${quote(located.room.name)}: “${body.length > 60 ? `${body.slice(0, 57)}…` : body}”`,
      undoable: true,
    },
    { roomId, raws: [raw] } satisfies ChatSnapshot,
  );
  await bumpContentVersion();
  return { entry };
}

async function deleteMessageOp(admin: AdminUser, args: Args): Promise<AdminChangeResult> {
  const roomId = text(args.roomId, "A room id");
  const messageId = text(args.messageId, "A message id");
  const { room } = await requireRoom(roomId);
  const { raw, message } = await findMessage(roomId, messageId);
  await removeRawMessages(roomId, [raw]);
  const entry = await recordAction(
    {
      actor: admin.email,
      kind: "chat.delete",
      targetType: "room",
      targetId: roomId,
      targetLabel: room.name,
      summary: `Deleted ${message.displayName}'s message in ${quote(room.name)}`,
      undoable: true,
    },
    { roomId, raws: [raw] } satisfies ChatSnapshot,
  );
  await bumpContentVersion();
  return { entry };
}

async function clearChatOp(admin: AdminUser, args: Args): Promise<AdminChangeResult> {
  const roomId = text(args.roomId, "A room id");
  const { room } = await requireRoom(roomId);
  const raws = await clearRoomChat(roomId);
  const entry = await recordAction(
    {
      actor: admin.email,
      kind: "chat.clear",
      targetType: "room",
      targetId: roomId,
      targetLabel: room.name,
      summary: `Cleared ${raws.length} message${raws.length === 1 ? "" : "s"} from ${quote(room.name)}`,
      undoable: true,
    },
    { roomId, raws } satisfies ChatSnapshot,
  );
  await bumpContentVersion();
  return { entry };
}

// ---------------------------------------------------------------------------
// People

type ProfileSnapshot = { before: Profile; after: Profile };

async function updatePersonOp(admin: AdminUser, args: Args): Promise<AdminChangeResult | { entry: null }> {
  const identity = text(args.identity, "A person");
  if (personKind(identity) === "system") throw new AdminError("That isn't a person.");
  await assertCanChangeAccount(admin, identity);
  const before = await readProfileForEdit(identity);
  const after: Profile = { ...before };

  if (args.displayName !== undefined) {
    if (args.displayName === null || args.displayName === "") {
      after.displayName = null;
    } else {
      const name = text(args.displayName, "A name");
      if (name.length > MAX_NAME_LENGTH) {
        throw new AdminError(`Names must be ${MAX_NAME_LENGTH} characters or fewer.`);
      }
      after.displayName = name;
    }
  }
  if (args.removePhoto === true) after.avatarUrl = null;

  const renamed = before.displayName !== after.displayName;
  const photoRemoved = !!before.avatarUrl && !after.avatarUrl;
  if (!renamed && !photoRemoved) return { entry: null };

  const person = await getAdminPerson(identity, []);
  const parts: string[] = [];
  if (renamed) {
    parts.push(
      after.displayName
        ? `Renamed ${person.name} to ${after.displayName}`
        : `Reset ${person.name}'s name to their default`,
    );
  }
  if (photoRemoved) parts.push(renamed ? "removed their photo" : `Removed ${person.name}'s photo`);

  await writeProfile(after);
  const entry = await recordAction(
    {
      actor: admin.email,
      kind: "person.update",
      targetType: "person",
      targetId: identity,
      targetLabel: after.displayName ?? person.name,
      summary: parts.join(" and "),
      undoable: true,
    },
    { before, after } satisfies ProfileSnapshot,
  );
  await bumpPeopleVersion();
  return { entry };
}

async function suspendOp(admin: AdminUser, args: Args): Promise<AdminChangeResult> {
  const identity = text(args.identity, "A person");
  if (personKind(identity) === "system") throw new AdminError("That isn't a person.");
  const theirAccess = await getAdminAccess(identity);
  if (theirAccess) {
    throw new AdminError(
      theirAccess.role === "admin" && admin.role === "owner"
        ? "Admins can't be suspended — remove their admin access first."
        : "An admin account can't be suspended.",
    );
  }
  const suspended = args.suspended === true;
  const person = await getAdminPerson(identity, []);
  if (person.suspended === suspended) {
    throw new AdminError(suspended ? "They're already suspended." : "They aren't suspended.", 409);
  }
  await setSuspended(identity, suspended);
  const entry = await recordAction({
    actor: admin.email,
    kind: suspended ? "person.suspend" : "person.unsuspend",
    targetType: "person",
    targetId: identity,
    targetLabel: person.name,
    summary: suspended ? `Suspended ${person.name}` : `Lifted ${person.name}'s suspension`,
    undoable: true,
  });
  await bumpPeopleVersion();
  return { entry };
}

// ---------------------------------------------------------------------------
// Site

type SettingSnapshot = { before: RoomCreationSetting; after: RoomCreationSetting };

async function roomCreationOp(admin: AdminUser, args: Args): Promise<AdminChangeResult | { entry: null }> {
  const before = (await getSiteState()).roomCreation;
  const locked = typeof args.locked === "boolean" ? args.locked : before.locked;
  let message = before.message;
  if (args.message !== undefined) {
    if (args.message !== null && typeof args.message !== "string") throw new AdminError("Invalid message.");
    const trimmed = typeof args.message === "string" ? args.message.trim() : "";
    if (trimmed.length > MAX_LOCK_MESSAGE_LENGTH) {
      throw new AdminError(`Keep the message to ${MAX_LOCK_MESSAGE_LENGTH} characters or fewer.`);
    }
    message = trimmed || null;
  }
  if (locked === before.locked && message === before.message) return { entry: null };

  const after = await setRoomCreationSetting({ locked, message });
  const summary =
    locked !== before.locked
      ? locked
        ? "Locked room creation"
        : "Unlocked room creation"
      : message
        ? "Changed the “room creation is locked” message"
        : "Reset the “room creation is locked” message";
  const entry = await recordAction(
    {
      actor: admin.email,
      kind: "settings.roomCreation",
      targetType: "settings",
      targetId: "roomCreation",
      targetLabel: "Room creation",
      summary,
      undoable: true,
    },
    { before, after } satisfies SettingSnapshot,
  );
  return { entry };
}

async function refreshEveryoneOp(admin: AdminUser): Promise<AdminChangeResult> {
  await Promise.all([bumpContentVersion(), bumpPeopleVersion()]);
  const entry = await recordAction({
    actor: admin.email,
    kind: "site.refresh",
    targetType: "site",
    targetId: "site",
    targetLabel: "Everyone",
    summary: "Refreshed every open page",
    undoable: false,
  });
  return { entry };
}

// ---------------------------------------------------------------------------
// Admins — adding, changing and removing them is the owner's alone (see
// OP_PERMISSIONS), and it never touches what visitors see.

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_EMAIL_LENGTH = 254;

/** Before and after, either of which may be "not an admin". */
type MemberSnapshot = { before: AdminMember | null; after: AdminMember | null };

function parseEmail(value: unknown): string {
  const email = normalizeEmail(text(value, "An email address"));
  if (email.length > MAX_EMAIL_LENGTH || !EMAIL_PATTERN.test(email)) {
    throw new AdminError("That doesn't look like an email address.");
  }
  return email;
}

function parsePermissions(value: unknown): AdminPermission[] {
  if (!Array.isArray(value)) throw new AdminError("Pick what they're allowed to do.");
  return normalizePermissions(value);
}

/** Their name if they've signed in before, otherwise their email. */
async function accountLabel(email: string): Promise<string> {
  const basics = (await resolvePeople([email]).catch(() => null))?.get(email);
  return basics?.profile?.displayName || basics?.account?.name || email;
}

async function recordMemberChange(
  admin: AdminUser,
  kind: "admin.add" | "admin.update" | "admin.remove",
  email: string,
  summary: (label: string) => string,
  snapshot: MemberSnapshot,
): Promise<AdminChangeResult> {
  const label = await accountLabel(email);
  const entry = await recordAction(
    {
      actor: admin.email,
      kind,
      targetType: "admin",
      targetId: email,
      targetLabel: label,
      summary: summary(label),
      undoable: true,
    },
    snapshot,
  );
  return { entry };
}

async function addAdminOp(admin: AdminUser, args: Args): Promise<AdminChangeResult> {
  const email = parseEmail(args.email);
  const permissions = parsePermissions(args.permissions);
  if (isOwnerEmail(email)) throw new AdminError("That's the owner account — it already has full access.", 409);
  if (await getMember(email)) throw new AdminError("They're already an admin — edit their access instead.", 409);
  if (await isAnySuspended([email])) throw new AdminError("They're suspended — lift their suspension first.", 409);

  const member: AdminMember = {
    email,
    permissions,
    addedAt: new Date().toISOString(),
    addedBy: admin.email,
    updatedAt: null,
  };
  await saveMember(member);
  return recordMemberChange(
    admin,
    "admin.add",
    email,
    (label) => `Made ${label} an admin (${describeAccess(permissions).toLowerCase()})`,
    { before: null, after: member },
  );
}

async function updateAdminOp(admin: AdminUser, args: Args): Promise<AdminChangeResult | { entry: null }> {
  const email = parseEmail(args.email);
  const permissions = parsePermissions(args.permissions);
  if (isOwnerEmail(email)) throw new AdminError("The owner always has full access.");
  const before = await getMember(email);
  if (!before) throw new AdminError("They aren't an admin anymore.", 409);

  const granted = permissions.filter((id) => !before.permissions.includes(id));
  const revoked = before.permissions.filter((id) => !permissions.includes(id));
  if (granted.length === 0 && revoked.length === 0) return { entry: null };

  const after: AdminMember = { ...before, permissions, updatedAt: new Date().toISOString() };
  await saveMember(after);
  const changes = [
    ...granted.map((id) => `can now ${permissionPhrase(id)}`),
    ...revoked.map((id) => `can no longer ${permissionPhrase(id)}`),
  ];
  return recordMemberChange(
    admin,
    "admin.update",
    email,
    (label) =>
      changes.length <= 2
        ? `Changed ${label}'s access — ${changes.join(", ")}`
        : `Changed ${label}'s access (now ${describeAccess(permissions).toLowerCase()})`,
    { before, after },
  );
}

async function removeAdminOp(admin: AdminUser, args: Args): Promise<AdminChangeResult> {
  const email = parseEmail(args.email);
  if (isOwnerEmail(email)) throw new AdminError("The owner can't be removed.");
  const before = await getMember(email);
  if (!before) throw new AdminError("They aren't an admin anymore.", 409);
  await deleteMember(email);
  return recordMemberChange(admin, "admin.remove", email, (label) => `Removed ${label} as an admin`, {
    before,
    after: null,
  });
}

// ---------------------------------------------------------------------------
// Undo / redo — each change knows how to put things back, and how to do itself again.

type Direction = "undo" | "redo";

async function applyDirection(entry: AdminLogEntry, snapshot: unknown, direction: Direction, admin: AdminUser) {
  const undo = direction === "undo";
  const missingSnapshot = () =>
    new AdminError(`This change is more than ${UNDO_WINDOW_DAYS} days old, so it can't be reversed anymore.`, 410);

  switch (entry.kind) {
    case "room.create":
    case "room.restore":
      if (undo) await trashRoom(entry.targetId, admin.email);
      else await restoreRoom(entry.targetId);
      return;
    case "room.trash":
      if (undo) await restoreRoom(entry.targetId);
      else await trashRoom(entry.targetId, admin.email);
      return;
    case "room.update":
    case "room.end": {
      const snap = snapshot as RoomEditSnapshot | null;
      if (!snap?.before) throw missingSnapshot();
      const { room: current } = await requireRoom(entry.targetId);
      // Only the fields this change touched are rewound (or re-applied), so
      // anything edited since — by the room's host, or another change — stays.
      const next: Record<string, unknown> = { ...current };
      const after = snap.after as Record<string, unknown>;
      for (const [field] of FIELD_LABELS) {
        if (field === "imageUrl" && after.imageUrl === undefined) continue; // image wasn't changed
        const from = snap.before[field] ?? null;
        const to = after[field] ?? null;
        if (from !== to) next[field] = undo ? from : to;
      }
      await writeRoomRecord(entry.targetId, next as StoredRoom);
      return;
    }
    case "room.removePerson": {
      const snap = snapshot as MembershipSnapshot | null;
      if (!snap?.roomId) throw missingSnapshot();
      if (undo) await restoreMembership(snap);
      else await removeMembership(await snapshotMembership(snap.roomId, snap.identity));
      return;
    }
    case "person.leaveAll": {
      const snaps = snapshot as MembershipSnapshot[] | null;
      if (!Array.isArray(snaps)) throw missingSnapshot();
      if (undo) await Promise.all(snaps.map(restoreMembership));
      else {
        const fresh = await Promise.all(snaps.map((snap) => snapshotMembership(snap.roomId, snap.identity)));
        await Promise.all(fresh.filter((snap) => snap.joinedAt).map(removeMembership));
      }
      return;
    }
    case "chat.post":
    case "chat.delete":
    case "chat.clear": {
      const snap = snapshot as ChatSnapshot | null;
      if (!snap?.roomId) throw missingSnapshot();
      await requireRoom(snap.roomId);
      // Posting is undone by removing; deleting and clearing by putting back.
      const putBack = entry.kind === "chat.post" ? !undo : undo;
      if (putBack) await reinsertRawMessages(snap.roomId, snap.raws);
      else await removeRawMessages(snap.roomId, snap.raws);
      return;
    }
    case "person.update": {
      const snap = snapshot as ProfileSnapshot | null;
      if (!snap?.before) throw missingSnapshot();
      const current = await readProfileForEdit(entry.targetId);
      const target = undo ? snap.before : snap.after;
      await writeProfile({ ...current, displayName: target.displayName, avatarUrl: target.avatarUrl });
      return;
    }
    case "person.suspend":
      await setSuspended(entry.targetId, !undo);
      return;
    case "person.unsuspend":
      await setSuspended(entry.targetId, undo);
      return;
    case "settings.roomCreation": {
      const snap = snapshot as SettingSnapshot | null;
      if (!snap?.before) throw missingSnapshot();
      await setRoomCreationSetting(undo ? snap.before : snap.after);
      return;
    }
    case "admin.add":
    case "admin.update":
    case "admin.remove": {
      const snap = snapshot as MemberSnapshot | null;
      if (!snap || !("before" in snap)) throw missingSnapshot();
      if (isOwnerEmail(entry.targetId)) throw new AdminError("That's the owner account now, so its access can't change.");
      // Rewinding a permission change mustn't bring back someone removed since.
      if (entry.kind === "admin.update" && !(await getMember(entry.targetId))) {
        throw new AdminError("They aren't an admin anymore.", 409);
      }
      const target = undo ? snap.before : snap.after;
      if (target) await saveMember(target);
      else await deleteMember(entry.targetId);
      return;
    }
    default:
      throw new AdminError("This change can't be reversed.");
  }
}

const PEOPLE_KINDS: AdminActionKind[] = ["person.update", "person.suspend", "person.unsuspend"];
const MEMBERSHIP_KINDS: AdminActionKind[] = ["room.removePerson", "person.leaveAll"];
// Open pages read these straight from the site state (or never see them at
// all), so there's nothing for them to refresh.
const UNSEEN_KINDS: AdminActionKind[] = ["settings.roomCreation", "admin.add", "admin.update", "admin.remove"];

async function reverseOp(admin: AdminUser, args: Args, direction: Direction): Promise<AdminChangeResult> {
  const id = text(args.id, "A change");
  const found = await getAction(id);
  if (!found) throw new AdminError("That change isn't in the log anymore.", 404);
  const { entry, snapshot } = found;
  // Undoing or redoing a change takes the same permission as making it.
  const needed: AdminPermission | OwnerOnly = PERMISSION_FOR_KIND[entry.kind] ?? "owner";
  if (!hasPermission(admin, needed)) throw new AdminError(deniedMessage(needed), 403);
  if (!entry.undoable) throw new AdminError("This change can't be reversed.");
  if (direction === "undo" && entry.status === "undone") throw new AdminError("That's already been undone.", 409);
  if (direction === "redo" && entry.status === "done") throw new AdminError("That's already in effect.", 409);

  await applyDirection(entry, snapshot, direction, admin);
  const next = await setActionStatus(entry, direction === "undo" ? "undone" : "done");

  if (PEOPLE_KINDS.includes(entry.kind)) await bumpPeopleVersion();
  else if (MEMBERSHIP_KINDS.includes(entry.kind)) await Promise.all([bumpContentVersion(), bumpPeopleVersion()]);
  else if (!UNSEEN_KINDS.includes(entry.kind)) await bumpContentVersion();
  return { entry: next };
}

// ---------------------------------------------------------------------------

async function getSnapshot(admin: AdminUser): Promise<AdminSnapshot> {
  const [rooms, log, site, members] = await Promise.all([
    listAdminRooms(),
    listActions(300),
    getSiteState(),
    listMembers(),
  ]);
  return {
    rooms,
    log,
    site,
    team: { owners: getOwnerEmails(), members },
    me: { email: admin.email, role: admin.role, permissions: admin.permissions },
    serverTime: new Date().toISOString(),
  };
}

/** What each request needs. Every admin can read everything; undo and redo
 * are checked against the change itself (in reverseOp). */
const OP_PERMISSIONS: Record<string, AdminPermission | OwnerOnly | null> = {
  snapshot: null,
  "room.get": null,
  "people.list": null,
  "person.get": null,
  "log.undo": null,
  "log.redo": null,
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
  "settings.roomCreation": "site.roomCreation",
  "site.refresh": "site.refresh",
  "admin.add": "owner",
  "admin.update": "owner",
  "admin.remove": "owner",
};

/** Every dashboard request lands here: one of the reads below, or a change
 * — which is logged (so it can be undone) and announced to open pages.
 * Nothing runs unless the admin's permissions cover it. */
export async function runAdminOp(admin: AdminUser, op: string, args: Args): Promise<unknown> {
  if (!Object.hasOwn(OP_PERMISSIONS, op)) throw new AdminError("Unknown request.", 400);
  const needed = OP_PERMISSIONS[op];
  if (needed && !hasPermission(admin, needed)) throw new AdminError(deniedMessage(needed), 403);

  switch (op) {
    case "snapshot":
      return getSnapshot(admin);
    case "room.get":
      return getAdminRoomDetail(text(args.id, "A room id"));
    case "room.create":
      return createRoomOp(admin, args);
    case "room.update":
      return updateRoomOp(admin, args);
    case "room.end":
      return endRoomOp(admin, args);
    case "room.trash":
      return trashRoomOp(admin, args);
    case "room.restore":
      return restoreRoomOp(admin, args);
    case "room.purge":
      return purgeRoomOp(admin, args);
    case "room.removePerson":
      return removePersonOp(admin, args);
    case "chat.post":
      return postMessageOp(admin, args);
    case "chat.delete":
      return deleteMessageOp(admin, args);
    case "chat.clear":
      return clearChatOp(admin, args);
    case "people.list":
      return listAdminPeople(await listAdminRooms());
    case "person.get":
      return getAdminPersonDetail(text(args.identity, "A person"), await listAdminRooms());
    case "person.update":
      return updatePersonOp(admin, args);
    case "person.suspend":
      return suspendOp(admin, args);
    case "person.leaveAll":
      return leaveAllOp(admin, args);
    case "settings.roomCreation":
      return roomCreationOp(admin, args);
    case "site.refresh":
      return refreshEveryoneOp(admin);
    case "log.undo":
      return reverseOp(admin, args, "undo");
    case "log.redo":
      return reverseOp(admin, args, "redo");
    case "admin.add":
      return addAdminOp(admin, args);
    case "admin.update":
      return updateAdminOp(admin, args);
    case "admin.remove":
      return removeAdminOp(admin, args);
    default:
      throw new AdminError("Unknown request.", 400);
  }
}
