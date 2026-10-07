/**
 * POST /api/admin/project/upload — issues short-lived Vercel Blob tokens so the admin's browser can
 * upload a PDF straight to Blob (see @vercel/blob/client `upload`). Admin only; PDFs only, 20 MB max.
 */
import type { APIRoute } from 'astro';
import { handleUpload, type HandleUploadBody } from '@vercel/blob/client';
import { isAdmin } from '@/lib/attendance/server';
import { json } from '@/lib/progress/server';
import { MAX_PDF_BYTES } from '@/lib/project-files/core';
import { blobFolder, blobToken } from '@/lib/project-files/server';

export const prerender = false;

export const POST: APIRoute = async ({ request, cookies }) => {
  if (!isAdmin(cookies)) return json({ error: 'Unauthorized' }, 401);
  if (!blobToken()) return json({ error: 'Vercel Blob is not connected.' }, 503);
  try {
    const body = (await request.json()) as HandleUploadBody;
    const result = await handleUpload({
      body,
      request,
      token: blobToken(),
      onBeforeGenerateToken: async (pathname) => {
        if (!pathname.startsWith(`${blobFolder()}/`) || !pathname.toLowerCase().endsWith('.pdf')) throw new Error('Invalid file path.');
        return { allowedContentTypes: ['application/pdf'], maximumSizeInBytes: MAX_PDF_BYTES, addRandomSuffix: true };
      },
    });
    return json(result);
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : 'Upload failed.' }, 400);
  }
};
