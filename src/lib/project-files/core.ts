/**
 * PROJECT SUBMISSIONS — rules. Items the teaching team publishes on /project (e.g. "Project proposal
 * submission"), optionally with a PDF, and the PDFs students hand in for them on /submit/[id].
 * Pure functions only, so they are unit-tested (tests/project-files.test.ts).
 */

/** Admin attachments (briefs, forms). */
export const MAX_PDF_BYTES = 20 * 1024 * 1024;
/** Student hand-ins. 200 students × 4 MB stays under Vercel Blob's free 1 GB. */
export const MAX_ENTRY_BYTES = 4 * 1024 * 1024;
/** How long a newly published item is announced (banner + NEW badge). */
export const NEW_FOR_MS = 14 * 24 * 60 * 60 * 1000;

export const KINDS = ['proposal', 'brief', 'template', 'other'] as const;
export type Kind = (typeof KINDS)[number];
export const KIND_LABEL: Record<Kind, string> = { proposal: 'Proposal submission', brief: 'Brief', template: 'Template', other: 'Document' };

export type ProjectFile = {
  id: string;
  title: string;
  description: string;
  kind: Kind;
  due_at: string | null;
  /** The attached PDF; all three are null when the admin published without a file. */
  url: string | null;
  pathname: string | null;
  size: number | null;
  /** Students can hand in a PDF on /submit/[id]. */
  accepting: boolean;
  published_by: string;
  created_at: string;
};

export type Entry = {
  id: string;
  file_id: string;
  student_id: string;
  name: string;
  group_name: string;
  note: string;
  url: string;
  pathname: string;
  size: number;
  created_at: string;
  updated_at: string;
};

export type FileMeta = { title: string; description: string; kind: Kind; dueAt: string | null; accepting: boolean };
type Result<T> = { ok: true; value: T } | { ok: false; error: string };

const text = (v: unknown) => (typeof v === 'string' ? v.trim() : '');
const flag = (v: unknown, fallback: boolean) =>
  typeof v === 'boolean' ? v : v === 'on' || v === 'true' ? true : v === 'false' || v === 'off' ? false : fallback;

/** Validates the admin's form fields. Returns the cleaned values or the first problem. */
export function parseMeta(input: Record<string, unknown>): Result<FileMeta> {
  const title = text(input.title).replace(/\s+/g, ' ');
  const description = text(input.description);
  const kind = text(input.kind) || 'proposal';
  const due = text(input.dueAt);
  if (!title) return { ok: false, error: 'Give it a title.' };
  if (title.length > 120) return { ok: false, error: 'Keep the title under 120 characters.' };
  if (description.length > 2000) return { ok: false, error: 'Keep the description under 2000 characters.' };
  if (!(KINDS as readonly string[]).includes(kind)) return { ok: false, error: 'Unknown type.' };
  let dueAt: string | null = null;
  if (due) {
    const t = Date.parse(due);
    if (Number.isNaN(t)) return { ok: false, error: 'The due date is not a valid date.' };
    dueAt = new Date(t).toISOString();
  }
  return { ok: true, value: { title, description, kind: kind as Kind, dueAt, accepting: flag(input.accepting, kind === 'proposal') } };
}

/* Same rules as the lab identity (src/lab/ui/store.ts), so a student types the same details everywhere. */
export const NAME_RE = /^[\p{L}\p{M}][\p{L}\p{M}'’. -]*[\p{L}\p{M}.]$/u;
export const ID_RE = /^[A-Za-z0-9-]{3,20}$/;
export const DEVICE_RE = /^[A-Za-z0-9_-]{16,64}$/;

export type EntryInput = { name: string; studentId: string; group: string; note: string; deviceKey: string };

/** Validates a student's hand-in details. The student ID is the key: one hand-in per student per item. */
export function parseEntry(input: Record<string, unknown>): Result<EntryInput> {
  const name = text(input.name).normalize('NFC').replace(/\s+/g, ' ');
  const studentId = text(input.studentId).toUpperCase();
  const group = text(input.group).replace(/\s+/g, ' ');
  const note = text(input.note);
  const deviceKey = text(input.deviceKey);
  if (name.length < 2 || name.length > 60 || !NAME_RE.test(name)) return { ok: false, error: 'Please type your full name (letters only).' };
  if (!ID_RE.test(studentId)) return { ok: false, error: 'Your student ID should be 3–20 letters or numbers.' };
  if (!group || group.length > 30) return { ok: false, error: 'Enter your group or team (for example, G1).' };
  if (note.length > 500) return { ok: false, error: 'Keep the note under 500 characters.' };
  if (!DEVICE_RE.test(deviceKey)) return { ok: false, error: 'Refresh the page and try again.' };
  return { ok: true, value: { name, studentId, group, note, deviceKey } };
}

/** Whether students may hand in right now. Late hand-ins are accepted (and flagged) until the admin closes it. */
export const canSubmit = (file: Pick<ProjectFile, 'accepting'>) => file.accepting;
export const isLate = (file: Pick<ProjectFile, 'due_at'>, at: string) => Boolean(file.due_at && Date.parse(at) > Date.parse(file.due_at));
/** Announced with the banner and NEW badge: recently published, still accepting, not past due. */
export const isNew = (file: Pick<ProjectFile, 'accepting' | 'due_at' | 'created_at'>, now: number) =>
  file.accepting && now - Date.parse(file.created_at) < NEW_FOR_MS && !(file.due_at && Date.parse(file.due_at) < now);

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

/** CSV for the admin export (RFC 4180 quoting; formulas neutralised for spreadsheet apps). */
export function entriesCsv(file: Pick<ProjectFile, 'due_at'>, entries: Entry[]): string {
  const cell = (v: string) => {
    const safe = /^[=+\-@\t\r]/.test(v) ? `'${v}` : v;
    return /[",\n\r]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
  };
  const rows = [['Name', 'Student ID', 'Group', 'Submitted at', 'Late', 'Size (KB)', 'Note', 'PDF']];
  for (const e of entries) {
    rows.push([e.name, e.student_id, e.group_name, e.updated_at, isLate(file, e.updated_at) ? 'yes' : 'no', String(Math.round(e.size / 1024)), e.note, e.url]);
  }
  return rows.map((r) => r.map(cell).join(',')).join('\r\n') + '\r\n';
}

/**
 * Path of one hand-in inside a batch ZIP: `G1/23CS0042 - Sara Ali.pdf`. Characters that are illegal in
 * Windows/macOS file names are dropped, and duplicates get " (2)", " (3)"… via `used`.
 */
export function zipPath(e: Pick<Entry, 'group_name' | 'student_id' | 'name'>, used: Set<string>): string {
  const clean = (s: string) => s.normalize('NFC').replace(/[\/:*?"<>|\u0000-\u001f]/g, '').replace(/\s+/g, ' ').trim().replace(/^\.+/, '').slice(0, 60);
  const folder = clean(e.group_name) || 'No group';
  const base = `${folder}/${clean(e.student_id)} - ${clean(e.name) || 'Student'}`;
  let path = `${base}.pdf`;
  for (let n = 2; used.has(path.toLowerCase()); n++) path = `${base} (${n}).pdf`;
  used.add(path.toLowerCase());
  return path;
}
