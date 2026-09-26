/** Web Push "VAPID" keys — the pair that proves to browsers' push services
 * that a notification really comes from this site. Without both, the feature
 * switches itself off: no bell in the chat, nothing sent. */
export type PushConfig = {
  publicKey: string;
  privateKey: string;
  /** How a push service can reach whoever runs the site (https: or mailto:). */
  subject: string;
};

const DEFAULT_SUBJECT = "https://thewaitingroom.space";

export function getPushConfig(): PushConfig | null {
  const publicKey = process.env.VAPID_PUBLIC_KEY?.trim();
  const privateKey = process.env.VAPID_PRIVATE_KEY?.trim();
  if (!publicKey || !privateKey) return null;

  return {
    publicKey,
    privateKey,
    subject: process.env.VAPID_SUBJECT?.trim() || DEFAULT_SUBJECT,
  };
}
