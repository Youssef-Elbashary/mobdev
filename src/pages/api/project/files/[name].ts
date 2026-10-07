/** GET /api/project/files/[name] — serves PDFs saved to .uploads/ when running without Vercel Blob (laptops only). */
import type { APIRoute } from 'astro';
import { readLocal, storageMode } from '@/lib/project-files/server';

export const prerender = false;

export const GET: APIRoute = async ({ params }) => {
  const bytes = storageMode() === 'local' ? await readLocal(params.name ?? '') : null;
  if (!bytes) return new Response('Not found', { status: 404 });
  return new Response(new Uint8Array(bytes), {
    headers: { 'content-type': 'application/pdf', 'content-disposition': 'inline', 'x-content-type-options': 'nosniff', 'cache-control': 'no-store' },
  });
};
