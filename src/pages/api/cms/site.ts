/**
 * GET  /api/cms/site — course info, team and assessment (src/content/data/site.yaml) + form fields.
 * POST /api/cms/site { value, baseSha, dryRun } — validate; dryRun → { diff }, else commit.
 */
import type { APIRoute } from 'astro';
import { parse } from 'yaml';
import { siteSchema } from '@/content/schemas';
import { lineDiff } from '@/lib/cms/diff';
import { SITE_FIELDS } from '@/lib/cms/fields';
import { setSite } from '@/lib/cms/yaml-list';
import { SITE_PATH, commitMessage, errorResponse, fieldErrors, guard, json } from '@/lib/cms/server';

export const prerender = false;

export const GET: APIRoute = async ({ cookies }) => {
  const g = await guard(cookies);
  if (g instanceof Response) return g;
  try {
    const file = await g.repo.read(SITE_PATH);
    if (!file) return json({ error: 'missing', message: `${SITE_PATH} not found.` }, 404);
    return json({ value: parse(file.content), sha: file.sha, fields: SITE_FIELDS });
  } catch (e) {
    return errorResponse(e);
  }
};

export const POST: APIRoute = async ({ cookies, request }) => {
  const g = await guard(cookies);
  if (g instanceof Response) return g;
  const body = (await request.json().catch(() => null)) as { value?: unknown; baseSha?: string; dryRun?: boolean } | null;
  const check = siteSchema.safeParse(body?.value);
  if (!check.success) return json({ error: 'invalid', errors: fieldErrors(check) }, 400);
  try {
    const file = await g.repo.read(SITE_PATH);
    if (!file) return json({ error: 'missing' }, 404);
    const next = setSite(file.content, check.data);
    if (next === file.content) return json({ ok: true, unchanged: true, sha: file.sha });
    const message = commitMessage('update course info', g.editor);
    if (body?.dryRun) return json({ diff: lineDiff(file.content, next), path: SITE_PATH, message });
    const r = await g.repo.commit([{ path: SITE_PATH, content: next, baseSha: body?.baseSha ?? null }], message);
    return json({ ok: true, commit: r.sha });
  } catch (e) {
    return errorResponse(e);
  }
};
