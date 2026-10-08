export type ModuleBannerInput = {
  title: string;
  message: string;
  ctaLabel: string;
  ctaHref: string;
};

type Result<T> = { ok: true; value: T } | { ok: false; error: string };

/** Validate module-owned announcements. Links stay inside this site. */
export function parseModuleBanner(input: unknown): Result<ModuleBannerInput> {
  const body = (input && typeof input === 'object' ? input : {}) as Record<string, unknown>;
  const title = String(body.title ?? '').trim().replace(/\s+/g, ' ');
  const message = String(body.message ?? '').trim().replace(/\s+/g, ' ');
  const ctaLabel = String(body.ctaLabel ?? '').trim().replace(/\s+/g, ' ');
  const ctaHref = String(body.ctaHref ?? '').trim();
  if (!title || title.length > 100) return { ok: false, error: 'Give the banner a title of up to 100 characters.' };
  if (!message || message.length > 240) return { ok: false, error: 'Give the banner a message of up to 240 characters.' };
  if (ctaLabel.length > 30) return { ok: false, error: 'The button label can be up to 30 characters.' };
  if (ctaHref && (!ctaHref.startsWith('/') || ctaHref.startsWith('//') || ctaHref.length > 300)) {
    return { ok: false, error: 'The button link must be a site path beginning with /.' };
  }
  if (Boolean(ctaLabel) !== Boolean(ctaHref)) return { ok: false, error: 'Provide both a button label and its link, or leave both empty.' };
  return { ok: true, value: { title, message, ctaLabel, ctaHref } };
}
