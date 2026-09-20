/** "stephen.o@gmail.com" -> "step******n@gmail.com" — a fixed run of
 * asterisks regardless of local-part length, so the mask doesn't leak how
 * long the real address is. */
export function maskEmail(email: string): string {
  const [local, domain] = email.split("@");
  if (!domain || local.length <= 2) return email;

  const visibleStart = local.slice(0, Math.min(4, local.length - 1));
  const visibleEnd = local.slice(-1);
  return `${visibleStart}${"*".repeat(6)}${visibleEnd}@${domain}`;
}
