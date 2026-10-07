/**
 * Admin: publish, open/close or remove an item on /project.
 *   GET                                                     every item with its hand-in count
 *   POST   JSON { title, description, kind, dueAt, accepting, url? }   url = optional PDF already uploaded to Blob
 *   POST   multipart (same fields + optional file)          on a laptop without Blob (saved to .uploads/)
 *   PATCH  ?id=… JSON { any settings field, attachmentUrl?, removeAttachment? }   edit a published item
 *          (title, description, kind, dueAt, cutoffAt, accepting, acceptTypes, maxMb; omitted fields keep their value)
 *   DELETE ?id=…                                            removes the item, its hand-ins and every stored PDF
 */
import type { APIRoute } from 'astro';
import { canManageSubmissions } from '@/lib/accounts/labscope';
import { isAdmin } from '@/lib/attendance/server';
import { currentEditor } from '@/lib/cms/server';
import { json } from '@/lib/progress/server';
import { MAX_PDF_BYTES, isBlobUrl, looksLikePdf, parseMeta, parseSettings, safePdfName } from '@/lib/project-files/core';
import { blobFolder, blobToken, deleteStored, getFilesStore, saveLocal, storageMode, verifyUpload } from '@/lib/project-files/server';

export const prerender = false;

export const GET: APIRoute = async ({ cookies }) => {
  if (!(await canManageSubmissions(cookies))) return json({ error: 'Unauthorized' }, 401);
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
  if (!(await canManageSubmissions(cookies))) return json({ error: 'Unauthorized' }, 401);
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
  if (!(await canManageSubmissions(cookies))) return json({ error: 'Unauthorized' }, 401);
  const store = getFilesStore();
  if (!store) return json({ error: 'No database is connected.' }, 503);
  try {
    const current = await store.get(url.searchParams.get('id') ?? '');
    if (!current) return json({ error: 'Not found.' }, 404);

    // Fields come as JSON (Blob mode: a replacement PDF is uploaded first and sent as `attachmentUrl`)
    // or as multipart on a laptop (the replacement PDF is the `file` field).
    let body: Record<string, unknown>;
    let localPdf: File | null = null;
    if ((request.headers.get('content-type') ?? '').startsWith('multipart/form-data')) {
      if (storageMode() !== 'local') return json({ error: 'Invalid request.' }, 400);
      const form = await request.formData();
      body = Object.fromEntries([...form.entries()].filter(([, v]) => typeof v === 'string'));
      if (typeof body.acceptTypes === 'string') body.acceptTypes = (body.acceptTypes as string).split(',');
      const f = form.get('file');
      localPdf = f instanceof File && f.size ? f : null;
    } else {
      body = ((await request.json().catch(() => null)) as Record<string, unknown> | null) ?? {};
    }

    const settings = parseSettings(body, current);
    if (!settings.ok) return json({ error: settings.error }, 400);

    // undefined = keep the attachment, null = remove it, a value = replace it
    let attachment: { url: string; pathname: string; size: number } | null | undefined;
    if (body.removeAttachment === true || body.removeAttachment === 'true') attachment = null;
    if (localPdf) {
      if (localPdf.size > MAX_PDF_BYTES) return json({ error: 'The PDF must be 20 MB or smaller.' }, 400);
      const bytes = new Uint8Array(await localPdf.arrayBuffer());
      if (!looksLikePdf(bytes)) return json({ error: 'That file is not a PDF.' }, 400);
      attachment = { ...(await saveLocal(safePdfName(localPdf.name), bytes)), size: bytes.length };
    } else if (typeof body.attachmentUrl === 'string' && body.attachmentUrl) {
      if (!blobToken() || !isBlobUrl(body.attachmentUrl)) return json({ error: 'Upload the PDF first.' }, 400);
      const upload = await verifyUpload(body.attachmentUrl, blobFolder(), MAX_PDF_BYTES);
      if (!upload.ok) return json({ error: upload.error }, 400);
      attachment = upload.file;
    }

    const saved = await store.update(current.id, settings.value, attachment);
    if (!saved) return json({ error: 'Not found.' }, 404);
    if (saved.dropped) await deleteStored(saved.dropped);
    return json({ file: saved.file });
  } catch (error) {
    console.error('[project-files] could not update file', error);
    return json({ error: 'Could not save.' }, 500);
  }
};

export const DELETE: APIRoute = async ({ url, cookies }) => {
  if (!(await canManageSubmissions(cookies))) return json({ error: 'Unauthorized' }, 401);
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
