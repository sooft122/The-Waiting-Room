// Shared by the middleware (Edge runtime) and lib/suspension.ts — no Redis
// client import here, so both can use the same key and wording.

/** Set of identities ("someone@gmail.com" or "anon:<n>") the admin has suspended. */
export const SUSPENDED_IDENTITIES_KEY = "waiting-room:admin:suspended";

export const SUSPENDED_MESSAGE =
  "Your account has been suspended, so you can look around but can't do that right now.";
