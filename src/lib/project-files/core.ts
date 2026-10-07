/**
 * PROJECT FILES — rules. PDFs the teaching team publishes on /project (e.g. the proposal
 * submission form). Pure functions only, so they are unit-tested (tests/project-files.test.ts).
 */

export const MAX_PDF_BYTES = 20 * 1024 * 1024;
export const KINDS = ['proposal', 'brief', 'template', 'other'] as const;
export type Kind = (typeof KINDS)[number];
export const KIND_LABEL: Record<Kind, string> = { proposal: 'Proposal submission', brief: 'Brief', template: 'Template', other: 'Document' };

export type ProjectFile = {
  id: string;
  title: string;
  description: string;
  kind: Kind;
  due_at: string | null;
  url: string;
  pathname: string;
  size: number;
  published_by: string;
  created_at: string;
};

export type FileMeta = { title: string; description: string; kind: Kind; dueAt: string | null };

/** Validates the admin's form fields. Returns the cleaned values or the first problem. */
export function parseMeta(input: Record<string, unknown>): { ok: true; value: FileMeta } | { ok: false; error: string } {
  const text = (v: unknown) => (typeof v === 'string' ? v.trim() : '');
  const title = text(input.title).replace(/\s+/g, ' ');
  const description = text(input.description);
  const kind = text(input.kind) || 'proposal';
  const due = text(input.dueAt);
  if (!title) return { ok: false, error: 'Give the file a title.' };
  if (title.length > 120) return { ok: false, error: 'Keep the title under 120 characters.' };
  if (description.length > 600) return { ok: false, error: 'Keep the description under 600 characters.' };
  if (!(KINDS as readonly string[]).includes(kind)) return { ok: false, error: 'Unknown file type.' };
  let dueAt: string | null = null;
  if (due) {
    const t = Date.parse(due);
    if (Number.isNaN(t)) return { ok: false, error: 'The due date is not a valid date.' };
    dueAt = new Date(t).toISOString();
  }
  return { ok: true, value: { title, description, kind: kind as Kind, dueAt } };
}

/** True when the bytes start with the PDF signature `%PDF-`. */
export const looksLikePdf = (head: Uint8Array) =>
  head.length >= 5 && head[0] === 0x25 && head[1] === 0x50 && head[2] === 0x44 && head[3] === 0x46 && head[4] === 0x2d;

/** A safe storage name: lowercase slug of the original name, always ending in .pdf. */
export function safePdfName(original: string): string {
  const base = original.replace(/\.pdf$/i, '').normalize('NFKD').replace(/[^\w\s-]/g, '').trim().toLowerCase().replace(/[\s_-]+/g, '-').slice(0, 60);
  return `${base || 'document'}.pdf`;
}

/** Only accept URLs that point at our own Vercel Blob store (never an arbitrary link). */
export function isBlobUrl(url: string): boolean {
  try {
    const u = new URL(url);
    return u.protocol === 'https:' && u.hostname.endsWith('.public.blob.vercel-storage.com') && u.pathname.toLowerCase().endsWith('.pdf');
  } catch {
    return false;
  }
}
