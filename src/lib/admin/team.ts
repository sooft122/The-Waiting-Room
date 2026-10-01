import { getRedis } from "@/lib/redis";
import { AdminError } from "./errors";
import { normalizePermissions } from "./permissions";
import type { AdminMember } from "./types";

// The admins the owner has added from the dashboard, each with only the
// permissions picked for them. (The owner isn't stored here — it's the account
// in ADMIN_EMAILS, so nothing on the dashboard can change or remove it.)
const MEMBERS_KEY = "waiting-room:admin:members"; // hash: email → AdminMember

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function toMember(email: string, raw: unknown): AdminMember | null {
  if (!raw || typeof raw !== "object") return null;
  const stored = raw as Partial<AdminMember>;
  return {
    email,
    permissions: normalizePermissions(stored.permissions),
    addedAt: typeof stored.addedAt === "string" ? stored.addedAt : new Date(0).toISOString(),
    addedBy: typeof stored.addedBy === "string" ? stored.addedBy : "",
    updatedAt: typeof stored.updatedAt === "string" ? stored.updatedAt : null,
  };
}

function requireRedis() {
  const redis = getRedis();
  if (!redis) throw new AdminError("Storage isn't configured.", 503);
  return redis;
}

/** Every added admin, longest-serving first. */
export async function listMembers(): Promise<AdminMember[]> {
  const redis = getRedis();
  if (!redis) return [];
  const stored = (await redis.hgetall<Record<string, unknown>>(MEMBERS_KEY)) ?? {};
  return Object.entries(stored)
    .map(([email, raw]) => toMember(email, raw))
    .filter((member): member is AdminMember => !!member)
    .sort((a, b) => a.addedAt.localeCompare(b.addedAt));
}

export async function getMember(email: string): Promise<AdminMember | null> {
  const redis = getRedis();
  if (!redis) return null;
  const key = normalizeEmail(email);
  return toMember(key, await redis.hget<unknown>(MEMBERS_KEY, key));
}

export async function saveMember(member: AdminMember): Promise<void> {
  await requireRedis().hset(MEMBERS_KEY, { [normalizeEmail(member.email)]: member });
}

export async function deleteMember(email: string): Promise<void> {
  await requireRedis().hdel(MEMBERS_KEY, normalizeEmail(email));
}
