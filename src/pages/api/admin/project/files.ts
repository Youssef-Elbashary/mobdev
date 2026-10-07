/**
 * Admin: publish or remove a PDF on /project.
 *   POST   JSON { title, description, kind, dueAt, url }   after a browser upload to Vercel Blob
 *   POST   multipart (same fields + file)                   on a laptop without Blob (saved to .uploads/)
 *   DELETE ?id=…                                            removes the listing and the stored PDF
 */
import type { APIRoute } from 'astro';
import { head } from '@vercel/blob';
import { isAdmin } from '@/lib/attendance/server';
import { currentEditor } from '@/lib/cms/server';
import { json } from '@/lib/progress/server';
import { MAX_PDF_BYTES, isBlobUrl, looksLikePdf, parseMeta, safePdfName } from '@/lib/project-files/core';
import { blobFolder, blobToken, deleteStored, getFilesStore, saveLocal, storageMode } from '@/lib/project-files/server';

export const prerender = false;

export const GET: APIRoute = async ({ cookies }) => {
  if (!isAdmin(cookies)) return json({ error: 'Unauthorized' }, 401);
  const store = getFilesStore();
  if (!store) return json({ error: 'No database is connected.' }, 503);
  try {
    return json({ files: await store.list() });
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
      if (!(file instanceof File) || !file.size) return json({ error: 'Choose a PDF file.' }, 400);
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
    if (!blobToken() || !isBlobUrl(url)) return json({ error: 'Upload the PDF first.' }, 400);
    // head() only finds blobs in our own store, so this also rejects links to anywhere else.
    const blob = await head(url, { token: blobToken() }).catch(() => null);
    if (!blob || !blob.pathname.startsWith(`${blobFolder()}/`)) return json({ error: 'The uploaded file was not found.' }, 400);
    if (blob.contentType !== 'application/pdf') return json({ error: 'That file is not a PDF.' }, 400);
    const start = await fetch(blob.url, { headers: { range: 'bytes=0-4' } }).then((r) => r.arrayBuffer()).catch(() => null);
    if (!start || !looksLikePdf(new Uint8Array(start))) {
      await deleteStored(blob);
      return json({ error: 'That file is not a PDF.' }, 400);
    }
    return json({ file: await store.add(meta.value, { url: blob.url, pathname: blob.pathname, size: blob.size }, by) }, 201);
  } catch (error) {
    console.error('[project-files] could not publish file', error);
    return json({ error: 'Could not publish the file.' }, 500);
  }
};

export const DELETE: APIRoute = async ({ url, cookies }) => {
  if (!isAdmin(cookies)) return json({ error: 'Unauthorized' }, 401);
  const store = getFilesStore();
  if (!store) return json({ error: 'No database is connected.' }, 503);
  try {
    const removed = await store.remove(url.searchParams.get('id') ?? '');
    if (!removed) return json({ error: 'File not found.' }, 404);
    await deleteStored(removed);
    return json({ ok: true });
  } catch (error) {
    console.error('[project-files] could not delete file', error);
    return json({ error: 'Could not delete the file.' }, 500);
  }
};
