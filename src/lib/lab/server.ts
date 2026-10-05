/**
 * Picks where lab progress is stored: Supabase on Vercel (live site → real tables, previews → *_dev),
 * an in-memory store on a laptop. Uses the same SUPABASE_URL / SUPABASE_SECRET_KEY as attendance.
 */
import { getSecret } from 'astro:env/server';
import { findSupabaseEnv } from '../attendance/core';
import { getProgressStore } from '../progress/server';
import { MemoryLabBackend, type LabBackend } from './core';
import { ProgressLabBackend } from './progress-backend';
import { SupabaseLabBackend } from './supabase';

const env = (key: string) => getSecret(key) || undefined;

let backend: LabBackend | null | undefined;
let memory: MemoryLabBackend | undefined;

export function getLabBackend(): LabBackend | null {
  if (backend !== undefined) return backend;
  // Prefer the existing progress database. Its Neon tables are created on
  // first use, so production does not get stuck on a missing manual SQL step.
  const progress = getProgressStore();
  if (progress) return (backend = new ProgressLabBackend(progress));
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
