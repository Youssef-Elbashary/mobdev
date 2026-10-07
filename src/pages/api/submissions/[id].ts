/**
 * A student's hand-in for one published item (public; one per student ID, replaceable from the same browser).
 *   GET  ?studentId=…&deviceKey=…   { submitted, at, late, locked } so the page can warn before uploading
 *   POST JSON { name, studentId, group, note, deviceKey, url }   url = the PDF already uploaded to Blob
 *   POST multipart (same fields + file)                          on a laptop without Blob
 */
import type { APIRoute } from 'astro';
import { clientIp } from '@/lib/attendance/server';
import { getProgressStore, json } from '@/lib/progress/server';
import { ID_RE, MAX_ENTRY_BYTES, canSubmit, isBlobUrl, isLate, looksLikePdf, parseEntry, safePdfName } from '@/lib/project-files/core';
import { deleteStored, entryFolder, getFilesStore, saveLocal, storageMode, verifyUpload } from '@/lib/project-files/server';

export const prerender = false;

const WRITES_PER_WINDOW = 30;
const WINDOW_SEC = 10 * 60;
const LOCKED = 'This student ID already handed in from another browser. Use the same browser, or ask your TA.';

export const GET: APIRoute = async ({ params, url }) => {
  const store = getFilesStore();
  if (!store) return json({ error: 'Submissions are not available yet.' }, 503);
  const studentId = (url.searchParams.get('studentId') ?? '').trim().toUpperCase();
  if (!ID_RE.test(studentId)) return json({ submitted: false });
  try {
    const file = await store.get(params.id ?? '');
    if (!file) return json({ error: 'Not found.' }, 404);
    const entry = await store.findEntry(file.id, studentId);
    if (!entry) return json({ submitted: false });
    // Only the browser that handed in learns the details; anyone else just learns the ID is taken.
    if (entry.device_key !== url.searchParams.get('deviceKey')) return json({ submitted: true, locked: true });
    return json({ submitted: true, locked: false, at: entry.updated_at, late: isLate(file, entry.updated_at), size: entry.size });
  } catch (error) {
    console.error('[submissions] status failed', error);
    return json({ error: 'Could not check your submission.' }, 500);
  }
};

export const POST: APIRoute = async ({ params, request, clientAddress }) => {
  const store = getFilesStore();
  if (!store) return json({ error: 'Submissions are not available yet.' }, 503);
  const tries = (await getProgressStore()?.hit(`submit:${clientIp(request, clientAddress)}`, WINDOW_SEC).catch(() => 0)) ?? 0;
  if (tries > WRITES_PER_WINDOW) return json({ error: 'Too many attempts. Wait a few minutes and try again.' }, 429);

  try {
    const file = await store.get(params.id ?? '');
    if (!file) return json({ error: 'Not found.' }, 404);

    let fields: Record<string, unknown>;
    let local: { name: string; bytes: Uint8Array } | null = null;
    if ((request.headers.get('content-type') ?? '').startsWith('multipart/form-data')) {
      if (storageMode() !== 'local') return json({ error: 'Invalid request.' }, 400);
      const form = await request.formData();
      fields = Object.fromEntries([...form.entries()].filter(([, v]) => typeof v === 'string'));
      const pdf = form.get('file');
      if (!(pdf instanceof File) || !pdf.size) return json({ error: 'Choose your PDF.' }, 400);
      if (pdf.size > MAX_ENTRY_BYTES) return json({ error: 'The PDF must be 4 MB or smaller.' }, 400);
      const bytes = new Uint8Array(await pdf.arrayBuffer());
      if (!looksLikePdf(bytes)) return json({ error: 'That file is not a PDF.' }, 400);
      local = { name: safePdfName(pdf.name), bytes };
    } else {
      fields = ((await request.json().catch(() => null)) as Record<string, unknown> | null) ?? {};
    }

    // Anything rejected below leaves an orphan upload behind; remove it (only ever inside this item's folder).
    const url = typeof fields.url === 'string' ? fields.url : '';
    const reject = async (error: string, status: number) => {
      if (url && isBlobUrl(url) && new URL(url).pathname.slice(1).startsWith(`${entryFolder(file.id)}/`)) await deleteStored({ url, pathname: url });
      return json({ error }, status);
    };

    if (!canSubmit(file)) return reject('This submission is closed.', 403);
    const who = parseEntry(fields);
    if (!who.ok) return reject(who.error, 400);
    const existing = await store.findEntry(file.id, who.value.studentId);
    if (existing && existing.device_key !== who.value.deviceKey) return reject(LOCKED, 409);

    let stored: { url: string; pathname: string; size: number };
    if (local) {
      stored = { ...(await saveLocal(local.name, local.bytes)), size: local.bytes.length };
    } else {
      if (!isBlobUrl(url)) return json({ error: 'Upload your PDF first.' }, 400);
      const upload = await verifyUpload(url, entryFolder(file.id), MAX_ENTRY_BYTES);
      if (!upload.ok) return json({ error: upload.error }, 400);
      stored = upload.file;
    }

    const { entry, replaced } = await store.saveEntry(file.id, who.value, stored);
    if (replaced) await deleteStored(replaced);
    return json({ ok: true, at: entry.updated_at, late: isLate(file, entry.updated_at), replaced: Boolean(existing) }, existing ? 200 : 201);
  } catch (error) {
    console.error('[submissions] hand-in failed', error);
    return json({ error: 'Could not save your submission. Try again.' }, 500);
  }
};
