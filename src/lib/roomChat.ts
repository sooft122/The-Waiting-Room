import { getRedis } from "./redis";

export const CHAT_SEND_COOLDOWN_MS = 10_000;
const MAX_STORED_MESSAGES = 100;
const MAX_MESSAGE_LENGTH = 300;

const chatKey = (roomId: string) => `waiting-room:rooms:chat:${roomId}`;
const chatColorKey = (roomId: string) => `waiting-room:rooms:chat-colors:${roomId}`;
const chatCountKey = (roomId: string) => `waiting-room:rooms:chat-count:${roomId}`;
const chatCooldownKey = (roomId: string, identity: string) =>
  `waiting-room:rooms:chat-cooldown:${roomId}:${identity}`;

export type ChatMessage = {
  id: string;
  identity: string;
  displayName: string;
  color: string;
  text: string;
  createdAt: string;
};

// A wide, high-contrast-on-dark palette — assigned once per identity per
// room (not per message), preferring a color nobody else in the room is
// currently using yet, so two people rarely end up looking the same.
const CHAT_COLORS = [
  "#de8383",
  "#efba8b",
  "#8befed",
  "#c2ef8b",
  "#c58fff",
  "#ffcf6b",
  "#7ce8ff",
  "#ff8fd1",
  "#8fffb0",
  "#f2a65a",
  "#9fb4ff",
  "#f4a0a0",
  "#a0e8c0",
  "#e8a0e0",
  "#c4d96b",
  "#8ad0ff",
];

async function getOrAssignColor(roomId: string, identity: string): Promise<string> {
  const redis = getRedis();
  if (!redis) return CHAT_COLORS[0];

  const existing = await redis.hget<string>(chatColorKey(roomId), identity);
  if (existing) return existing;

  const assigned = (await redis.hgetall<Record<string, string>>(chatColorKey(roomId))) ?? {};
  const used = new Set(Object.values(assigned));
  const available = CHAT_COLORS.filter((color) => !used.has(color));
  const pool = available.length > 0 ? available : CHAT_COLORS;
  const color = pool[Math.floor(Math.random() * pool.length)];

  // Race-safe: if two first-time senders in the same room land here at the
  // same instant, only the first HSETNX wins — the loser just re-reads
  // whatever color actually got stored instead of clobbering it.
  const stored = await redis.hsetnx(chatColorKey(roomId), identity, color);
  if (stored) return color;
  const settled = await redis.hget<string>(chatColorKey(roomId), identity);
  return settled ?? color;
}

export type SendMessageResult =
  | { ok: true; message: ChatMessage; cooldownMs: number }
  | { ok: false; error: string; retryAfterMs?: number };

export async function sendMessage(
  roomId: string,
  identity: string,
  displayName: string,
  rawText: string,
): Promise<SendMessageResult> {
  const redis = getRedis();
  if (!redis) return { ok: false, error: "Room storage is not configured." };

  const text = rawText.trim().slice(0, MAX_MESSAGE_LENGTH);
  if (!text) return { ok: false, error: "Message can't be empty." };

  const cooldownAcquired = await redis.set(chatCooldownKey(roomId, identity), "1", {
    px: CHAT_SEND_COOLDOWN_MS,
    nx: true,
  });
  if (!cooldownAcquired) {
    const ttlMs = await redis.pttl(chatCooldownKey(roomId, identity));
    return { ok: false, error: "Slow down a little.", retryAfterMs: Math.max(0, ttlMs) };
  }

  const color = await getOrAssignColor(roomId, identity);
  const message: ChatMessage = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    identity,
    displayName,
    color,
    text,
    createdAt: new Date().toISOString(),
  };

  await Promise.all([
    redis.lpush(chatKey(roomId), message),
    redis.ltrim(chatKey(roomId), 0, MAX_STORED_MESSAGES - 1),
    redis.hincrby(chatCountKey(roomId), identity, 1),
  ]);

  return { ok: true, message, cooldownMs: CHAT_SEND_COOLDOWN_MS };
}

/** Most recent messages, oldest first (ready to render top-to-bottom). */
export async function getMessages(roomId: string, limit = 50): Promise<ChatMessage[]> {
  const redis = getRedis();
  if (!redis) return [];
  const raw = (await redis.lrange<ChatMessage>(chatKey(roomId), 0, limit - 1)) ?? [];
  return raw.filter(Boolean).reverse();
}

/** Milliseconds until this identity can send again in this room, or 0. */
export async function getCooldownRemainingMs(roomId: string, identity: string): Promise<number> {
  const redis = getRedis();
  if (!redis) return 0;
  const ttl = await redis.pttl(chatCooldownKey(roomId, identity));
  return ttl > 0 ? ttl : 0;
}

/** Each identity's total message count in this room — the input to Room
 * Energy's chat contribution (see roomEnergy.ts), capped per person there. */
export async function getChatCounts(roomId: string): Promise<Record<string, number>> {
  const redis = getRedis();
  if (!redis) return {};
  const raw = (await redis.hgetall<Record<string, number | string>>(chatCountKey(roomId))) ?? {};
  const counts: Record<string, number> = {};
  for (const [identity, value] of Object.entries(raw)) {
    counts[identity] = Number(value) || 0;
  }
  return counts;
}
