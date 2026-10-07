/**
 * POST /api/submissions/upload — issues short-lived Vercel Blob tokens so a student's browser can upload
 * their PDF straight to Blob. Only for items accepting hand-ins; PDFs only, 4 MB max; rate-limited per IP.
 * The browser sends clientPayload = JSON { fileId }.
 */
import type { APIRoute } from 'astro';
import { handleUpload, type HandleUploadBody } from '@vercel/blob/client';
import { clientIp } from '@/lib/attendance/server';
import { getProgressStore, json } from '@/lib/progress/server';
import { MAX_ENTRY_BYTES, canSubmit } from '@/lib/project-files/core';
import { blobToken, entryFolder, getFilesStore } from '@/lib/project-files/server';

export const prerender = false;

const TOKENS_PER_WINDOW = 20;
const WINDOW_SEC = 10 * 60;

export const POST: APIRoute = async ({ request, clientAddress }) => {
  const store = getFilesStore();
  if (!blobToken() || !store) return json({ error: 'Submissions are not available yet.' }, 503);
  try {
    const body = (await request.json()) as HandleUploadBody;
    const result = await handleUpload({
      body,
      request,
      token: blobToken(),
      onBeforeGenerateToken: async (pathname, clientPayload) => {
        const fileId = String((JSON.parse(clientPayload ?? '{}') as { fileId?: unknown }).fileId ?? '');
        const file = fileId ? await store.get(fileId) : null;
        if (!file || !canSubmit(file)) throw new Error('This submission is closed.');
        if (!pathname.startsWith(`${entryFolder(file.id)}/`) || !pathname.toLowerCase().endsWith('.pdf')) throw new Error('Invalid file path.');
        const tries = (await getProgressStore()?.hit(`submit-upload:${clientIp(request, clientAddress)}`, WINDOW_SEC).catch(() => 0)) ?? 0;
        if (tries > TOKENS_PER_WINDOW) throw new Error('Too many uploads. Wait a few minutes and try again.');
        return { allowedContentTypes: ['application/pdf'], maximumSizeInBytes: MAX_ENTRY_BYTES, addRandomSuffix: true };
      },
    });
    return json(result);
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : 'Upload failed.' }, 400);
  }
};
