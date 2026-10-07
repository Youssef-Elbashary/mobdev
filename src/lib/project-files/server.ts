/**
 * PROJECT SUBMISSIONS — server glue. Rules live in ./core.ts.
 *
 * Files:    Vercel Blob (free on Hobby: 1 GB). Store `mobdev-project-files` is connected to the project
 *           and provides BLOB_READ_WRITE_TOKEN. Browsers upload straight to Blob (admin attachments and
 *           student hand-ins alike), so PDFs are not limited by the 4.5 MB function body limit.
 *           Without a token (a laptop), files are written to .uploads/ and served by /api/project/files/[name].
 * Metadata: the same PostgreSQL database as progress tracking
 *           (project_files + project_entries in production, project_dev_* elsewhere).
 */
import { getSecret } from 'astro:env/server';
import { neon } from '@neondatabase/serverless';
import { Pool } from 'pg';
import { randomUUID } from 'node:crypto';
import { mkdir, readFile, unlink, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { del, head } from '@vercel/blob';
import { TYPE_KEYS, matchesSignature, mimesFor, typeForName, type Entry, type EntryInput, type FileType, type ProjectFile, type Settings } from './core';

const env = (key: string) => getSecret(key) || undefined;
const onVercel = () => Boolean(env('VERCEL'));
const databaseUrl = () => onVercel()
  ? env('DATABASE_URL') ?? env('POSTGRES_URL')
  : env('LOCAL_DATABASE_URL') ?? env('DATABASE_URL') ?? env('POSTGRES_URL');

export const blobToken = () => env('BLOB_READ_WRITE_TOKEN');
/** 'blob' when Vercel Blob is connected, 'local' on a laptop without it, null when a deployment can't store files. */
export const storageMode = (): 'blob' | 'local' | null => (blobToken() ? 'blob' : onVercel() ? null : 'local');
export const projectFilesSetup = () => ({ database: Boolean(databaseUrl()), storage: storageMode() });
/** Blob folder; previews and production share one store, so keep them apart. */
export const blobFolder = () => (env('VERCEL_ENV') === 'production' ? 'project-files' : 'project-files-dev');
/** Where one item's student hand-ins live inside the Blob folder. */
export const entryFolder = (fileId: string) => `${blobFolder()}/entries/${fileId}`;

/* ------------------------------------------------------------------ store */

const iso = (v: unknown) => (v instanceof Date ? v.toISOString() : v == null ? null : String(v));
const toFile = (r: any): ProjectFile => ({
  id: r.id, title: r.title, description: r.description, kind: r.kind, due_at: iso(r.due_at), cutoff_at: iso(r.cutoff_at),
  url: r.url ?? null, pathname: r.pathname ?? null, size: r.size == null ? null : Number(r.size),
  accepting: Boolean(r.accepting),
  accept_types: (Array.isArray(r.accept_types) && r.accept_types.length ? r.accept_types : ['pdf']).filter((t: string) => (TYPE_KEYS as string[]).includes(t)) as FileType[],
  max_mb: r.max_mb == null ? 4 : Number(r.max_mb),
  published_by: r.published_by, created_at: iso(r.created_at)!,
});
const toEntry = (r: any): Entry => ({ ...r, size: Number(r.size), created_at: iso(r.created_at)!, updated_at: iso(r.updated_at)! });

type Stored = { url: string; pathname: string; size: number };

class FilesStore {
  private run: (text: string, params?: unknown[]) => Promise<any[]>;
  private ready: Promise<void> | null = null;
  private files: string;
  private entries: string;

  constructor(url: string, prefix: string, driver: 'neon' | 'postgres') {
    if (driver === 'postgres') {
      const pool = new Pool({ connectionString: url, allowExitOnIdle: true });
      this.run = async (text, params = []) => (await pool.query(text, params)).rows;
    } else {
      const sql = neon(url);
      this.run = async (text, params = []) => (await sql.query(text, params)) as any[];
    }
    this.files = `${prefix}_files`;
    this.entries = `${prefix}_entries`;
  }

  /** Tables are created and migrated on first use (idempotent). */
  private async migrate() {
    const statements = [
      `create table if not exists ${this.files} (
        id text primary key, title text not null, description text not null default '', kind text not null,
        due_at timestamptz, url text, pathname text, size bigint,
        published_by text not null default '', created_at timestamptz not null default now())`,
      // v2: the attachment is optional, and items can collect student hand-ins
      `alter table ${this.files} alter column url drop not null`,
      `alter table ${this.files} alter column pathname drop not null`,
      `alter table ${this.files} alter column size drop not null`,
      `alter table ${this.files} add column if not exists accepting boolean not null default false`,
      // v3: managed settings — hard cut-off, accepted file types, per-file size limit
      `alter table ${this.files} add column if not exists cutoff_at timestamptz`,
      `alter table ${this.files} add column if not exists accept_types text[] not null default '{pdf}'`,
      `alter table ${this.files} add column if not exists max_mb int not null default 4`,
      `create table if not exists ${this.entries} (
        id text primary key, file_id text not null references ${this.files}(id) on delete cascade,
        student_id text not null, name text not null, group_name text not null, note text not null default '',
        device_key text not null, url text not null, pathname text not null, size bigint not null,
        created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
        unique (file_id, student_id))`,
    ];
    for (const s of statements) await this.run(s);
  }

  private async q(text: string, params: unknown[] = []) {
    await (this.ready ??= this.migrate().catch((e) => { this.ready = null; throw e; }));
    return this.run(text, params);
  }

  async list(): Promise<ProjectFile[]> {
    return (await this.q(`select * from ${this.files} order by created_at desc`)).map(toFile);
  }

  async get(id: string): Promise<ProjectFile | null> {
    const [row] = await this.q(`select * from ${this.files} where id = $1`, [id]);
    return row ? toFile(row) : null;
  }

  async add(meta: Settings, file: Stored | null, by: string): Promise<ProjectFile> {
    const [row] = await this.q(
      `insert into ${this.files} (id, title, description, kind, due_at, cutoff_at, url, pathname, size, accepting, accept_types, max_mb, published_by)
       values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13) returning *`,
      [randomUUID(), meta.title, meta.description, meta.kind, meta.dueAt, meta.cutoffAt, file?.url ?? null, file?.pathname ?? null, file?.size ?? null,
        meta.accepting, meta.acceptTypes, meta.maxMb, by],
    );
    return toFile(row);
  }

  /**
   * Saves edited settings. `attachment`: undefined keeps the current PDF, null removes it, a value replaces it.
   * Returns the updated item and the previous attachment if it was replaced or removed (to delete from storage).
   */
  async update(id: string, s: Settings, attachment?: Stored | null): Promise<{ file: ProjectFile; dropped: Stored | null } | null> {
    const before = await this.get(id);
    if (!before) return null;
    const keep = attachment === undefined;
    const [row] = await this.q(
      `update ${this.files} set title = $2, description = $3, kind = $4, due_at = $5, cutoff_at = $6, accepting = $7,
         accept_types = $8, max_mb = $9${keep ? '' : ', url = $10, pathname = $11, size = $12'}
       where id = $1 returning *`,
      [id, s.title, s.description, s.kind, s.dueAt, s.cutoffAt, s.accepting, s.acceptTypes, s.maxMb,
        ...(keep ? [] : [attachment?.url ?? null, attachment?.pathname ?? null, attachment?.size ?? null])],
    );
    const dropped = !keep && before.url && before.pathname && before.pathname !== attachment?.pathname
      ? { url: before.url, pathname: before.pathname, size: before.size ?? 0 } : null;
    return { file: toFile(row), dropped };
  }

  /** Removes the item; its hand-ins go with it (cascade). Returns everything whose PDF must be deleted. */
  async remove(id: string): Promise<{ file: ProjectFile; entries: Entry[] } | null> {
    const entries = (await this.q(`select * from ${this.entries} where file_id = $1`, [id])).map(toEntry);
    const [row] = await this.q(`delete from ${this.files} where id = $1 returning *`, [id]);
    return row ? { file: toFile(row), entries } : null;
  }

  /** Hand-in count and bytes per item. */
  async entryStats(): Promise<Record<string, { count: number; bytes: number }>> {
    const rows = await this.q(`select file_id, count(*)::int as count, coalesce(sum(size), 0)::bigint as bytes from ${this.entries} group by file_id`);
    return Object.fromEntries(rows.map((r) => [r.file_id, { count: Number(r.count), bytes: Number(r.bytes) }]));
  }

  async listEntries(fileId: string): Promise<Entry[]> {
    return (await this.q(`select * from ${this.entries} where file_id = $1 order by updated_at desc`, [fileId])).map(toEntry);
  }

  async findEntry(fileId: string, studentId: string): Promise<(Entry & { device_key: string }) | null> {
    const [row] = await this.q(`select * from ${this.entries} where file_id = $1 and student_id = $2`, [fileId, studentId]);
    return row ? { ...toEntry(row), device_key: row.device_key } : null;
  }

  /** Creates or replaces a student's hand-in. Returns the replaced PDF (to delete) if there was one. */
  async saveEntry(fileId: string, who: EntryInput, file: Stored): Promise<{ entry: Entry; replaced: Stored | null }> {
    const old = await this.findEntry(fileId, who.studentId);
    const [row] = await this.q(
      `insert into ${this.entries} (id, file_id, student_id, name, group_name, note, device_key, url, pathname, size)
       values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       on conflict (file_id, student_id) do update set name = excluded.name, group_name = excluded.group_name,
         note = excluded.note, url = excluded.url, pathname = excluded.pathname, size = excluded.size, updated_at = now()
       returning *`,
      [randomUUID(), fileId, who.studentId, who.name, who.group, who.note, who.deviceKey, file.url, file.pathname, file.size],
    );
    return { entry: toEntry(row), replaced: old && old.pathname !== file.pathname ? old : null };
  }

  /** Finds hand-ins across every item by name, student ID, group or note (case-insensitive, newest first). */
  async searchEntries(query: string, limit = 50): Promise<(Entry & { file_title: string; due_at: string | null })[]> {
    // Escape LIKE wildcards so "%" or "_" in the query match literally.
    const like = `%${query.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
    const rows = await this.q(
      `select e.*, f.title as file_title, f.due_at from ${this.entries} e join ${this.files} f on f.id = e.file_id
       where e.name ilike $1 or e.student_id ilike $1 or e.group_name ilike $1 or e.note ilike $1
       order by e.updated_at desc limit $2`,
      [like, limit],
    );
    return rows.map((r) => ({ ...toEntry(r), file_title: r.file_title, due_at: iso(r.due_at) }));
  }

  async removeEntry(id: string): Promise<Entry | null> {
    const [row] = await this.q(`delete from ${this.entries} where id = $1 returning *`, [id]);
    return row ? toEntry(row) : null;
  }
}

let store: FilesStore | null | undefined;

export function getFilesStore(): FilesStore | null {
  if (store !== undefined) return store;
  const url = databaseUrl();
  store = url ? new FilesStore(url, env('VERCEL_ENV') === 'production' ? 'project' : 'project_dev', onVercel() ? 'neon' : 'postgres') : null;
  return store;
}

/* ------------------------------------------------------------ blob checks */

/**
 * Confirms a browser upload really landed in our store, inside `folder`, as one of `types` (extension, MIME type
 * and file signature all agree) and no bigger than `maxBytes`. head() only finds blobs in our own store, so links
 * to anywhere else are rejected. A bad upload is deleted.
 */
export async function verifyUpload(url: string, folder: string, maxBytes: number, types: readonly FileType[] = ['pdf']): Promise<{ ok: true; file: Stored } | { ok: false; error: string }> {
  const blob = await head(url, { token: blobToken() }).catch(() => null);
  if (!blob || !blob.pathname.startsWith(`${folder}/`)) return { ok: false, error: 'The uploaded file was not found.' };
  const bad = async (error: string) => { await deleteStored(blob); return { ok: false as const, error }; };
  const kind = typeForName(blob.pathname, types);
  if (!kind || !mimesFor(types).includes(blob.contentType)) return bad('That file type is not accepted here.');
  if (blob.size > maxBytes) return bad(`The file must be ${Math.round(maxBytes / 1024 / 1024)} MB or smaller.`);
  const start = await fetch(blob.url, { headers: { range: 'bytes=0-7' } }).then((r) => r.arrayBuffer()).catch(() => null);
  if (!start || !matchesSignature(kind.ext, new Uint8Array(start), types)) return bad(`That file isn't a real ${kind.ext.toUpperCase()} file.`);
  return { ok: true, file: { url: blob.url, pathname: blob.pathname, size: blob.size } };
}

/* ------------------------------------------------------------ local files */

const LOCAL_DIR = path.resolve('.uploads', 'project-files');
const LOCAL_NAME = /^[0-9a-f-]{36}-[a-z0-9-]+\.(pdf|docx|pptx|zip|png|jpe?g)$/;

export async function saveLocal(name: string, bytes: Uint8Array) {
  const file = `${randomUUID()}-${name}`;
  await mkdir(LOCAL_DIR, { recursive: true });
  await writeFile(path.join(LOCAL_DIR, file), bytes);
  return { url: `/api/project/files/${file}`, pathname: `local/${file}` };
}

export async function readLocal(name: string): Promise<{ bytes: Buffer; type: string } | null> {
  if (!LOCAL_NAME.test(name)) return null;
  const bytes = await readFile(path.join(LOCAL_DIR, name)).catch(() => null);
  return bytes ? { bytes, type: typeForName(name, TYPE_KEYS)?.mime ?? 'application/octet-stream' } : null;
}

/** Removes a stored PDF. Failures are logged, not thrown: the listing is already gone. */
export async function deleteStored(file: { url: string | null; pathname: string | null }) {
  if (!file.url || !file.pathname) return;
  try {
    if (file.pathname.startsWith('local/')) {
      const name = file.pathname.slice('local/'.length);
      if (LOCAL_NAME.test(name)) await unlink(path.join(LOCAL_DIR, name));
    } else if (blobToken()) {
      await del(file.url, { token: blobToken() });
    }
  } catch (error) {
    console.error('[project-files] could not delete stored file', file.pathname, error);
  }
}
