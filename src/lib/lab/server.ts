/**
 * Picks where lab progress is stored: Supabase on Vercel (live site → real tables, previews → *_dev),
 * an in-memory store on a laptop. Uses the same SUPABASE_URL / SUPABASE_SECRET_KEY as attendance.
 */
import { getSecret } from 'astro:env/server';
import { findSupabaseEnv } from '../attendance/core';
import { MemoryLabBackend, type LabBackend } from './core';
import { SupabaseLabBackend } from './supabase';

const env = (key: string) => getSecret(key) || undefined;

let backend: LabBackend | null | undefined;
let memory: MemoryLabBackend | undefined;

export function getLabBackend(): LabBackend | null {
  if (backend !== undefined) return backend;
  const sb = findSupabaseEnv({
    SUPABASE_URL: env('SUPABASE_URL'),
    NEXT_PUBLIC_SUPABASE_URL: env('NEXT_PUBLIC_SUPABASE_URL'),
    SUPABASE_SECRET_KEY: env('SUPABASE_SECRET_KEY'),
    SUPABASE_SERVICE_ROLE_KEY: env('SUPABASE_SERVICE_ROLE_KEY'),
  });
  if (sb) backend = new SupabaseLabBackend(sb.url, sb.key, env('VERCEL_ENV') !== 'production');
  else if (!env('VERCEL')) backend = memory ??= new MemoryLabBackend();
  else backend = null;
  return backend;
}
