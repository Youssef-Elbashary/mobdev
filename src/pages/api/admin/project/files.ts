/**
 * Admin: publish, open/close or remove an item on /project.
 *   GET                                                     every item with its hand-in count
 *   POST   JSON { title, description, kind, dueAt, accepting, url? }   url = optional PDF already uploaded to Blob
 *   POST   multipart (same fields + optional file)          on a laptop without Blob (saved to .uploads/)
 *   PATCH  ?id=… JSON { accepting }                         open or close student hand-ins
 *   DELETE ?id=…                                            removes the item, its hand-ins and every stored PDF
 */
import type { APIRoute } from 'astro';
import { isAdmin } from '@/lib/attendance/server';
import { currentEditor } from '@/lib/cms/server';
import { json } from '@/lib/progress/server';
import { MAX_PDF_BYTES, isBlobUrl, looksLikePdf, parseMeta, safePdfName } from '@/lib/project-files/core';
import { blobFolder, blobToken, deleteStored, getFilesStore, saveLocal, storageMode, verifyUpload } from '@/lib/project-files/server';

export const prerender = false;

export const GET: APIRoute = async ({ cookies }) => {
  if (!isAdmin(cookies)) return json({ error: 'Unauthorized' }, 401);
  const store = getFilesStore();
  if (!store) return json({ error: 'No database is connected.' }, 503);
  try {
    const [files, stats] = await Promise.all([store.list(), store.entryStats()]);
    return json({ files: files.map((f) => ({ ...f, entries: stats[f.id]?.count ?? 0, entryBytes: stats[f.id]?.bytes ?? 0 })) });
  } catch (error) {
    console.error('[project-files] could not list files', error);
    return json({ error: 'Could not load files.' }, 500);
  }
};

export const POST: APIRoute = async ({ request, cookies }) => {
  if (!isAdmin(cookies)) return json({ error: 'Unauthorized' }, 401);
  const store = getFilesStore();
  if (!store) return json({ error: 'No database is connected.' }, 503);
  const by = currentEditor(cookies) ?? '';

  try {
    if ((request.headers.get('content-type') ?? '').startsWith('multipart/form-data')) {
      if (storageMode() !== 'local') return json({ error: 'Upload through Vercel Blob on this deployment.' }, 400);
      const form = await request.formData();
      const meta = parseMeta(Object.fromEntries([...form.entries()].filter(([, v]) => typeof v === 'string')));
      if (!meta.ok) return json({ error: meta.error }, 400);
      const file = form.get('file');
      if (!(file instanceof File) || !file.size) return json({ file: await store.add(meta.value, null, by) }, 201);
      if (file.size > MAX_PDF_BYTES) return json({ error: 'The PDF must be 20 MB or smaller.' }, 400);
      const bytes = new Uint8Array(await file.arrayBuffer());
      if (!looksLikePdf(bytes)) return json({ error: 'That file is not a PDF.' }, 400);
      const saved = await saveLocal(safePdfName(file.name), bytes);
      return json({ file: await store.add(meta.value, { ...saved, size: file.size }, by) }, 201);
    }

    const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
    if (!body) return json({ error: 'Invalid request.' }, 400);
    const meta = parseMeta(body);
    if (!meta.ok) return json({ error: meta.error }, 400);
    const url = typeof body.url === 'string' ? body.url : '';
    if (!url) return json({ file: await store.add(meta.value, null, by) }, 201);
    if (!blobToken() || !isBlobUrl(url)) return json({ error: 'Upload the PDF first.' }, 400);
    const upload = await verifyUpload(url, blobFolder(), MAX_PDF_BYTES);
    if (!upload.ok) return json({ error: upload.error }, 400);
    return json({ file: await store.add(meta.value, upload.file, by) }, 201);
  } catch (error) {
    console.error('[project-files] could not publish file', error);
    return json({ error: 'Could not publish.' }, 500);
  }
};

export const PATCH: APIRoute = async ({ url, request, cookies }) => {
  if (!isAdmin(cookies)) return json({ error: 'Unauthorized' }, 401);
  const store = getFilesStore();
  if (!store) return json({ error: 'No database is connected.' }, 503);
  const body = (await request.json().catch(() => null)) as { accepting?: unknown } | null;
  if (typeof body?.accepting !== 'boolean') return json({ error: 'Invalid request.' }, 400);
  try {
    const file = await store.setAccepting(url.searchParams.get('id') ?? '', body.accepting);
    return file ? json({ file }) : json({ error: 'Not found.' }, 404);
  } catch (error) {
    console.error('[project-files] could not update file', error);
    return json({ error: 'Could not save.' }, 500);
  }
};

export const DELETE: APIRoute = async ({ url, cookies }) => {
  if (!isAdmin(cookies)) return json({ error: 'Unauthorized' }, 401);
  const store = getFilesStore();
  if (!store) return json({ error: 'No database is connected.' }, 503);
  try {
    const removed = await store.remove(url.searchParams.get('id') ?? '');
    if (!removed) return json({ error: 'Not found.' }, 404);
    await Promise.all([removed.file, ...removed.entries].map(deleteStored));
    return json({ ok: true, entriesRemoved: removed.entries.length });
  } catch (error) {
    console.error('[project-files] could not delete file', error);
    return json({ error: 'Could not delete.' }, 500);
  }
};
