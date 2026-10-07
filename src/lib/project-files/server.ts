/**
 * PROJECT FILES — server glue. Rules live in ./core.ts.
 *
 * Files:    Vercel Blob (free on Hobby). Vercel → Project → Storage → Create → Blob, connect it
 *           to all environments (adds BLOB_READ_WRITE_TOKEN), then redeploy. The admin's browser
 *           uploads straight to Blob, so PDFs are not limited by the 4.5 MB function body limit.
 *           Without a token (a laptop), files are written to .uploads/ and served by /api/project/files/[name].
 * Metadata: the same PostgreSQL database as progress tracking (project_files / project_dev_files).
 */
import { getSecret } from 'astro:env/server';
import { neon } from '@neondatabase/serverless';
import { Pool } from 'pg';
import { randomUUID } from 'node:crypto';
import { mkdir, readFile, unlink, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { del } from '@vercel/blob';
import type { FileMeta, ProjectFile } from './core';

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

/* ------------------------------------------------------------------ store */

type Row = Omit<ProjectFile, 'created_at' | 'due_at'> & { created_at: unknown; due_at: unknown };
const iso = (v: unknown) => (v instanceof Date ? v.toISOString() : v == null ? null : String(v));
const toFile = (r: Row): ProjectFile => ({ ...r, size: Number(r.size), due_at: iso(r.due_at), created_at: iso(r.created_at)! });

class FilesStore {
  private run: (text: string, params?: unknown[]) => Promise<any[]>;
  private ready: Promise<unknown> | null = null;
  private table: string;

  constructor(url: string, table: string, driver: 'neon' | 'postgres') {
    if (driver === 'postgres') {
      const pool = new Pool({ connectionString: url, allowExitOnIdle: true });
      this.run = async (text, params = []) => (await pool.query(text, params)).rows;
    } else {
      const sql = neon(url);
      this.run = async (text, params = []) => (await sql.query(text, params)) as any[];
    }
    this.table = table;
  }

  /** The table is created on first use (idempotent). */
  private async q(text: string, params: unknown[] = []) {
    await (this.ready ??= this.run(`create table if not exists ${this.table} (
      id text primary key, title text not null, description text not null default '', kind text not null,
      due_at timestamptz, url text not null, pathname text not null, size bigint not null,
      published_by text not null default '', created_at timestamptz not null default now())`).catch((e) => { this.ready = null; throw e; }));
    return this.run(text, params);
  }

  async list(): Promise<ProjectFile[]> {
    return (await this.q(`select * from ${this.table} order by created_at desc`)).map(toFile);
  }

  async get(id: string): Promise<ProjectFile | null> {
    const [row] = await this.q(`select * from ${this.table} where id = $1`, [id]);
    return row ? toFile(row) : null;
  }

  async add(meta: FileMeta, file: { url: string; pathname: string; size: number }, by: string): Promise<ProjectFile> {
    const [row] = await this.q(
      `insert into ${this.table} (id, title, description, kind, due_at, url, pathname, size, published_by)
       values ($1, $2, $3, $4, $5, $6, $7, $8, $9) returning *`,
      [randomUUID(), meta.title, meta.description, meta.kind, meta.dueAt, file.url, file.pathname, file.size, by],
    );
    return toFile(row);
  }

  async remove(id: string): Promise<ProjectFile | null> {
    const [row] = await this.q(`delete from ${this.table} where id = $1 returning *`, [id]);
    return row ? toFile(row) : null;
  }
}

let store: FilesStore | null | undefined;

export function getFilesStore(): FilesStore | null {
  if (store !== undefined) return store;
  const url = databaseUrl();
  store = url ? new FilesStore(url, env('VERCEL_ENV') === 'production' ? 'project_files' : 'project_dev_files', onVercel() ? 'neon' : 'postgres') : null;
  return store;
}

/* ------------------------------------------------------------ local files */

const LOCAL_DIR = path.resolve('.uploads', 'project-files');
const LOCAL_NAME = /^[0-9a-f-]{36}-[a-z0-9-]+\.pdf$/;

export async function saveLocal(name: string, bytes: Uint8Array) {
  const file = `${randomUUID()}-${name}`;
  await mkdir(LOCAL_DIR, { recursive: true });
  await writeFile(path.join(LOCAL_DIR, file), bytes);
  return { url: `/api/project/files/${file}`, pathname: `local/${file}` };
}

export async function readLocal(name: string): Promise<Buffer | null> {
  if (!LOCAL_NAME.test(name)) return null;
  return readFile(path.join(LOCAL_DIR, name)).catch(() => null);
}

/** Removes the stored PDF. Failures are logged, not thrown: the listing is already gone. */
export async function deleteStored(file: Pick<ProjectFile, 'url' | 'pathname'>) {
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
