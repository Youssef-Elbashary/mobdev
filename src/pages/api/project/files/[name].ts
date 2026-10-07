/** GET /api/project/files/[name] — serves files saved to .uploads/ when running without Vercel Blob (laptops only). */
import type { APIRoute } from 'astro';
import { readLocal, storageMode } from '@/lib/project-files/server';

export const prerender = false;

export const GET: APIRoute = async ({ params }) => {
  const file = storageMode() === 'local' ? await readLocal(params.name ?? '') : null;
  if (!file) return new Response('Not found', { status: 404 });
  const inline = file.type === 'application/pdf' || file.type.startsWith('image/');
  return new Response(new Uint8Array(file.bytes), {
    headers: { 'content-type': file.type, 'content-disposition': inline ? 'inline' : 'attachment', 'x-content-type-options': 'nosniff', 'cache-control': 'no-store' },
  });
};
