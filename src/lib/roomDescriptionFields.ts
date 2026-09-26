// The optional description + CTA trio shared by room creation (POST
// /api/rooms) and editing (PATCH /api/rooms/[id]) — one set of rules, used
// by both routes, with the limits also mirrored in the forms.

export const MAX_DESCRIPTION_LENGTH = 1000;
// Mirrors the "15 characters max" hint shown under the CTA Text field.
export const MAX_CTA_TEXT_LENGTH = 15;
export const MAX_CTA_LINK_LENGTH = 500;

export type DescriptionFields = {
  description: string | null;
  ctaText: string | null;
  ctaLink: string | null;
};

type OptionalTextField = { value: string | null; error?: string };

/** Trims an optional string field down to null-or-non-empty, enforcing a max
 * length — the "leave it blank or give me a valid string" shape all three
 * fields share. */
function parseOptionalText(raw: unknown, maxLength: number, label: string): OptionalTextField {
  if (raw === null || raw === undefined || raw === "") return { value: null };
  if (typeof raw !== "string") return { value: null, error: `Invalid ${label}.` };
  const trimmed = raw.trim();
  if (!trimmed) return { value: null };
  if (trimmed.length > maxLength) {
    return { value: null, error: `${label} must be ${maxLength} characters or fewer.` };
  }
  return { value: trimmed };
}

/** Whether a CTA link is an ordinary web address. Anything else — notably a
 * `javascript:` URL — would run in the viewer's browser when the CTA button
 * is clicked, so it's rejected on save and never rendered as a link. */
export function isSafeCtaLink(link: string): boolean {
  try {
    const { protocol } = new URL(link);
    return protocol === "https:" || protocol === "http:";
  } catch {
    return false;
  }
}

export function parseDescriptionFields(
  body: Record<string, unknown>,
): { ok: true; fields: DescriptionFields } | { ok: false; error: string } {
  const description = parseOptionalText(body.description, MAX_DESCRIPTION_LENGTH, "Description");
  if (description.error) return { ok: false, error: description.error };
  const ctaText = parseOptionalText(body.ctaText, MAX_CTA_TEXT_LENGTH, "CTA Text");
  if (ctaText.error) return { ok: false, error: ctaText.error };
  const ctaLink = parseOptionalText(body.ctaLink, MAX_CTA_LINK_LENGTH, "CTA Link");
  if (ctaLink.error) return { ok: false, error: ctaLink.error };
  if (ctaLink.value && !isSafeCtaLink(ctaLink.value)) {
    return { ok: false, error: "CTA Link must be a web address starting with https://." };
  }
  // The CTA only makes sense attached to a description — the forms already
  // keep these fields disabled until one is entered; this is the
  // server-side backstop for that rule.
  if (!description.value && (ctaText.value || ctaLink.value)) {
    return { ok: false, error: "Add a description before setting a CTA." };
  }
  return {
    ok: true,
    fields: { description: description.value, ctaText: ctaText.value, ctaLink: ctaLink.value },
  };
}
