/**
 * PROJECT SUBMISSIONS — rules. Items the teaching team publishes on /project (e.g. "Project proposal
 * submission"), optionally with a PDF attached, and the files students hand in for them on /submit/[id].
 * Pure functions only, so they are unit-tested (tests/project-files.test.ts).
 */

/** Admin attachments (briefs, forms) are always PDFs. */
export const MAX_PDF_BYTES = 20 * 1024 * 1024;
/** Student hand-ins: default and ceiling per file. 200 students × 4 MB stays under Vercel Blob's free 1 GB. */
export const DEFAULT_MAX_MB = 4;
export const MAX_MB_LIMIT = 10;
/** How long a newly published item is announced (banner + NEW badge). */
export const NEW_FOR_MS = 14 * 24 * 60 * 60 * 1000;

export const KINDS = ['proposal', 'brief', 'template', 'other'] as const;
export type Kind = (typeof KINDS)[number];
export const KIND_LABEL: Record<Kind, string> = { proposal: 'Proposal submission', brief: 'Brief', template: 'Template', other: 'Document' };

/* ------------------------------------------------------------- file types */

const PK = [0x50, 0x4b, 0x03, 0x04];
/** File types students may hand in. Each is checked by extension, MIME type and file signature. */
export const FILE_TYPES = {
  pdf: { label: 'PDF', exts: { pdf: 'application/pdf' }, magic: [[0x25, 0x50, 0x44, 0x46, 0x2d]] },
  word: { label: 'Word (.docx)', exts: { docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' }, magic: [PK] },
  slides: { label: 'PowerPoint (.pptx)', exts: { pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation' }, magic: [PK] },
  zip: { label: 'ZIP', exts: { zip: 'application/zip' }, magic: [PK] },
  image: { label: 'Image (PNG/JPG)', exts: { png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg' }, magic: [[0x89, 0x50, 0x4e, 0x47], [0xff, 0xd8, 0xff]] },
} as const satisfies Record<string, { label: string; exts: Record<string, string>; magic: number[][] }>;
export type FileType = keyof typeof FILE_TYPES;
export const TYPE_KEYS = Object.keys(FILE_TYPES) as FileType[];

const extOf = (name: string) => (/\.([a-z0-9]+)$/i.exec(name)?.[1] ?? '').toLowerCase();

/** The allowed type a file name belongs to, with its extension and MIME type, or null. */
export function typeForName(name: string, allowed: readonly FileType[]): { type: FileType; ext: string; mime: string } | null {
  const ext = extOf(name);
  for (const type of allowed) {
    const mime = (FILE_TYPES[type].exts as Record<string, string>)[ext];
    if (mime) return { type, ext, mime };
  }
  return null;
}
export const extensionsFor = (types: readonly FileType[]) => types.flatMap((t) => Object.keys(FILE_TYPES[t].exts));
export const mimesFor = (types: readonly FileType[]) => [...new Set(types.flatMap((t) => Object.values(FILE_TYPES[t].exts) as string[]))];
/** For <input accept>. */
export const acceptAttr = (types: readonly FileType[]) => extensionsFor(types).map((e) => `.${e}`).join(',');
/** "PDF", "PDF or Word (.docx)", "PDF, ZIP or Image (PNG/JPG)". */
export function describeTypes(types: readonly FileType[]): string {
  const labels = types.map((t) => FILE_TYPES[t].label);
  return labels.length <= 1 ? labels.join('') : `${labels.slice(0, -1).join(', ')} or ${labels.at(-1)}`;
}
/** True when the first bytes match the signature of the type the extension claims. */
export function matchesSignature(ext: string, head: Uint8Array, allowed: readonly FileType[]): boolean {
  const found = typeForName(`x.${ext}`, allowed);
  return Boolean(found && FILE_TYPES[found.type].magic.some((sig) => sig.every((b, i) => head[i] === b)));
}
/** True when the bytes start with the PDF signature `%PDF-`. */
export const looksLikePdf = (head: Uint8Array) => matchesSignature('pdf', head, ['pdf']);

/* ------------------------------------------------------------------ model */

export type ProjectFile = {
  id: string;
  title: string;
  description: string;
  kind: Kind;
  /** Hand-ins after this are marked late. */
  due_at: string | null;
  /** Hard deadline: no hand-ins after this. Null = late hand-ins are accepted until the item is closed. */
  cutoff_at: string | null;
  /** The attached PDF; all three are null when the admin published without a file. */
  url: string | null;
  pathname: string | null;
  size: number | null;
  /** Students can hand in on /submit/[id]. */
  accepting: boolean;
  accept_types: FileType[];
  max_mb: number;
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

export type Settings = {
  title: string;
  description: string;
  kind: Kind;
  dueAt: string | null;
  cutoffAt: string | null;
  accepting: boolean;
  acceptTypes: FileType[];
  maxMb: number;
};
/** Kept for the publish form. */
export type FileMeta = Settings;
type Result<T> = { ok: true; value: T } | { ok: false; error: string };

const text = (v: unknown) => (typeof v === 'string' ? v.trim() : '');
const flag = (v: unknown, fallback: boolean) =>
  typeof v === 'boolean' ? v : v === 'on' || v === 'true' ? true : v === 'false' || v === 'off' ? false : fallback;

/** An optional date. A date being *set* must be in the future (an unchanged one may already have passed). */
function parseDate(value: unknown, label: string, now: number, unchanged: string | null): Result<string | null> {
  const raw = text(value);
  if (!raw) return { ok: true, value: null };
  const t = Date.parse(raw);
  if (Number.isNaN(t)) return { ok: false, error: `The ${label} is not a valid date.` };
  // Date inputs carry minutes only, so an untouched date compares at minute precision (and keeps its stored value).
  if (unchanged && Math.floor(t / 60000) === Math.floor(Date.parse(unchanged) / 60000)) return { ok: true, value: unchanged };
  const iso = new Date(t).toISOString();
  if (t <= now) return { ok: false, error: `The ${label} is in the past. Pick a future date and time.` };
  return { ok: true, value: iso };
}

/** A due date on its own (kept for callers that only change the due date). */
export const parseDue = (value: unknown, now: number) => parseDate(value, 'due date', now, null);

function parseTypes(value: unknown): Result<FileType[]> {
  const list = Array.isArray(value) ? value : typeof value === 'string' ? value.split(',') : [];
  const types = [...new Set(list.map((v) => String(v).trim()).filter(Boolean))];
  if (!types.length) return { ok: false, error: 'Allow at least one file type.' };
  const bad = types.find((t) => !(TYPE_KEYS as string[]).includes(t));
  if (bad) return { ok: false, error: `Unknown file type “${bad}”.` };
  return { ok: true, value: TYPE_KEYS.filter((t) => types.includes(t)) };
}

/**
 * Validates submission settings. With `current` (editing), missing fields keep their current value and only
 * changed dates must be in the future; without it (publishing), defaults apply.
 */
export function parseSettings(input: Record<string, unknown>, current: ProjectFile | null, now = Date.now()): Result<Settings> {
  const has = (k: string) => k in input && input[k] !== undefined;
  const title = (has('title') ? text(input.title) : current?.title ?? '').replace(/\s+/g, ' ');
  const description = has('description') ? text(input.description) : current?.description ?? '';
  const kind = (has('kind') ? text(input.kind) : current?.kind) || 'proposal';
  if (!title) return { ok: false, error: 'Give it a title.' };
  if (title.length > 120) return { ok: false, error: 'Keep the title under 120 characters.' };
  if (description.length > 2000) return { ok: false, error: 'Keep the description under 2000 characters.' };
  if (!(KINDS as readonly string[]).includes(kind)) return { ok: false, error: 'Unknown type.' };

  const due = has('dueAt') ? parseDate(input.dueAt, 'due date', now, current?.due_at ?? null) : { ok: true as const, value: current?.due_at ?? null };
  if (!due.ok) return due;
  const cutoff = has('cutoffAt') ? parseDate(input.cutoffAt, 'cut-off', now, current?.cutoff_at ?? null) : { ok: true as const, value: current?.cutoff_at ?? null };
  if (!cutoff.ok) return cutoff;
  if (due.value && cutoff.value && Date.parse(cutoff.value) < Date.parse(due.value)) {
    return { ok: false, error: 'The cut-off must be at or after the due date.' };
  }

  const types = has('acceptTypes') ? parseTypes(input.acceptTypes) : { ok: true as const, value: current?.accept_types ?? (['pdf'] as FileType[]) };
  if (!types.ok) return types;
  const maxMb = has('maxMb') ? Number(input.maxMb) : current?.max_mb ?? DEFAULT_MAX_MB;
  if (!Number.isInteger(maxMb) || maxMb < 1 || maxMb > MAX_MB_LIMIT) return { ok: false, error: `The size limit must be a whole number from 1 to ${MAX_MB_LIMIT} MB.` };

  const accepting = has('accepting') ? flag(input.accepting, false) : current?.accepting ?? kind === 'proposal';
  return { ok: true, value: { title, description, kind: kind as Kind, dueAt: due.value, cutoffAt: cutoff.value, accepting, acceptTypes: types.value, maxMb } };
}

/** Publish form: settings with defaults. */
export const parseMeta = (input: Record<string, unknown>, now = Date.now()) => parseSettings(input, null, now);

/* ---------------------------------------------------------------- hand-ins */

/* Same rules as the lab identity (src/lab/ui/store.ts), so a student types the same details everywhere. */
export const NAME_RE = /^[\p{L}\p{M}][\p{L}\p{M}'’. -]*[\p{L}\p{M}.]$/u;
export const ID_RE = /^[A-Za-z0-9-]{3,20}$/;
export const DEVICE_RE = /^[A-Za-z0-9_-]{16,64}$/;

export type EntryInput = { name: string; studentId: string; note: string; deviceKey: string };

/** Validates a student's hand-in details. The student ID is the key: one hand-in per student per item. */
export function parseEntry(input: Record<string, unknown>): Result<EntryInput> {
  const name = text(input.name).normalize('NFC').replace(/\s+/g, ' ');
  const studentId = text(input.studentId).toUpperCase();
  const note = text(input.note);
  const deviceKey = text(input.deviceKey);
  if (name.length < 2 || name.length > 60 || !NAME_RE.test(name)) return { ok: false, error: 'Please type your full name (letters only).' };
  if (!ID_RE.test(studentId)) return { ok: false, error: 'Your student ID should be 3–20 letters or numbers.' };
  if (note.length > 500) return { ok: false, error: 'Keep the note under 500 characters.' };
  if (!DEVICE_RE.test(deviceKey)) return { ok: false, error: 'Refresh the page and try again.' };
  return { ok: true, value: { name, studentId, note, deviceKey } };
}

export const maxBytes = (file: Pick<ProjectFile, 'max_mb'>) => file.max_mb * 1024 * 1024;
export const pastCutoff = (file: Pick<ProjectFile, 'cutoff_at'>, now: number) => Boolean(file.cutoff_at && now > Date.parse(file.cutoff_at));
/** Whether students may hand in right now: open, and before the cut-off (if any). Late hand-ins are flagged. */
export const canSubmit = (file: Pick<ProjectFile, 'accepting' | 'cutoff_at'>, now = Date.now()) => file.accepting && !pastCutoff(file, now);
export const isLate = (file: Pick<ProjectFile, 'due_at'>, at: string) => Boolean(file.due_at && Date.parse(at) > Date.parse(file.due_at));
/** Announced with the banner and NEW badge: recently published, still accepting, not past due or cut-off. */
export const isNew = (file: Pick<ProjectFile, 'accepting' | 'due_at' | 'created_at'> & Partial<Pick<ProjectFile, 'cutoff_at'>>, now: number) =>
  canSubmit({ accepting: file.accepting, cutoff_at: file.cutoff_at ?? null }, now) &&
  now - Date.parse(file.created_at) < NEW_FOR_MS && !(file.due_at && Date.parse(file.due_at) < now);

/** A safe storage name: lowercase slug of the original name with the given extension. */
export function safeFileName(original: string, ext: string): string {
  const base = original.replace(/\.[a-z0-9]+$/i, '').normalize('NFKD').replace(/[^\w\s-]/g, '').trim().toLowerCase().replace(/[\s_-]+/g, '-').slice(0, 60);
  return `${base || 'document'}.${ext}`;
}
export const safePdfName = (original: string) => safeFileName(original, 'pdf');

/** Only accept URLs that point at our own Vercel Blob store (never an arbitrary link), with an allowed extension. */
export function isBlobUrl(url: string, exts: readonly string[] = ['pdf']): boolean {
  try {
    const u = new URL(url);
    return u.protocol === 'https:' && u.hostname.endsWith('.public.blob.vercel-storage.com') && exts.includes(extOf(u.pathname));
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
  const rows = [['Name', 'Student ID', 'Group', 'Submitted at', 'Late', 'Size (KB)', 'Note', 'File']];
  for (const e of entries) {
    rows.push([e.name, e.student_id, e.group_name, e.updated_at, isLate(file, e.updated_at) ? 'yes' : 'no', String(Math.round(e.size / 1024)), e.note, e.url]);
  }
  return rows.map((r) => r.map(cell).join(',')).join('\r\n') + '\r\n';
}

/**
 * Path of one hand-in inside a batch ZIP: `G1/23CS0042 - Sara Ali.pdf` (the extension follows the stored file).
 * Characters that are illegal in Windows/macOS file names are dropped, and duplicates get " (2)", " (3)"… via `used`.
 */
export function zipPath(e: Pick<Entry, 'group_name' | 'student_id' | 'name'> & Partial<Pick<Entry, 'pathname'>>, used: Set<string>): string {
  const clean = (s: string) => s.normalize('NFC').replace(/[\\/:*?"<>|\u0000-\u001f]/g, '').replace(/\s+/g, ' ').trim().replace(/^\.+/, '').slice(0, 60);
  const ext = extOf(e.pathname ?? '') || 'pdf';
  const folder = clean(e.group_name) || 'No group';
  const base = `${folder}/${clean(e.student_id)} - ${clean(e.name) || 'Student'}`;
  let path = `${base}.${ext}`;
  for (let n = 2; used.has(path.toLowerCase()); n++) path = `${base} (${n}).${ext}`;
  used.add(path.toLowerCase());
  return path;
}
