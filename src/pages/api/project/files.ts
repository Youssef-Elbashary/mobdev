/** GET /api/project/files — the PDFs published on /project (public, read-only). */
import type { APIRoute } from 'astro';
import { json } from '@/lib/progress/server';
import { getFilesStore } from '@/lib/project-files/server';

export const prerender = false;

export const GET: APIRoute = async () => {
  const store = getFilesStore();
  if (!store) return json({ files: [] });
  try {
    const files = (await store.list()).map(({ pathname, published_by, ...file }) => file);
    return json({ files });
  } catch (error) {
    console.error('[project-files] could not list files', error);
    return json({ error: 'Could not load files.' }, 500);
  }
};
