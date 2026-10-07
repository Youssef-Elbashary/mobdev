/**
 * GET  /api/cms/list/commands — entries of one YAML list + form fields.
 * POST /api/cms/list/commands { op: 'set' | 'add' | 'remove' | 'move', id?, value?, afterId?, toIndex?, baseSha, dryRun }
 */
import type { APIRoute } from 'astro';
import { lineDiff } from '@/lib/cms/diff';
import { LIST_FIELDS, type ListName } from '@/lib/cms/fields';
import { addEntry, listEntries, moveEntry, removeEntry, setEntry } from '@/lib/cms/yaml-list';
import { LISTS, clean, commitMessage, errorResponse, fieldErrors, guard, json } from '@/lib/cms/server';

export const prerender = false;

const listOf = (name: string | undefined) => (name && name in LISTS ? (name as ListName) : null);

export const GET: APIRoute = async ({ cookies, params }) => {
  const g = await guard(cookies);
  if (g instanceof Response) return g;
  const name = listOf(params.name);
  if (!name) return json({ error: 'not-found' }, 404);
  try {
    const file = await g.repo.read(LISTS[name].path);
    if (!file) return json({ error: 'missing' }, 404);
    return json({ entries: listEntries(file.content), sha: file.sha, fields: LIST_FIELDS[name], label: LISTS[name].label, singular: LISTS[name].singular });
  } catch (e) {
    return errorResponse(e);
  }
};

type Body = { op?: string; id?: string; value?: Record<string, unknown>; afterId?: string; toIndex?: number; baseSha?: string; dryRun?: boolean };

export const POST: APIRoute = async ({ cookies, params, request }) => {
  const g = await guard(cookies);
  if (g instanceof Response) return g;
  const name = listOf(params.name);
  if (!name) return json({ error: 'not-found' }, 404);
  const list = LISTS[name];
  const body = ((await request.json().catch(() => null)) ?? {}) as Body;
  try {
    const file = await g.repo.read(list.path);
    if (!file) return json({ error: 'missing' }, 404);
    const before = listEntries(file.content);
    const id = String(body.id ?? body.value?.id ?? '').trim();
    let next: string;
    let summary: string;
    if (body.op === 'set' || body.op === 'add') {
      const old = before.find((e) => e.id === id)?.value ?? {};
      const value = clean({ ...(body.value ?? {}), id }, old);
      const { id: _id, ...fields } = value;
      const check = list.schema.safeParse(fields);
      if (!check.success) return json({ error: 'invalid', errors: fieldErrors(check) }, 400);
      if (body.op === 'add') {
        if (!/^[a-z0-9][a-z0-9-]*$/i.test(id)) return json({ error: 'invalid', errors: { id: 'Use letters, numbers and hyphens.' } }, 400);
        if (before.some((e) => e.id === id)) return json({ error: 'invalid', errors: { id: `"${id}" is already used.` } }, 400);
      }
      next = body.op === 'set' ? setEntry(file.content, id, value) : addEntry(file.content, value, body.afterId);
      summary = `${body.op === 'set' ? 'edit' : 'add'} ${list.singular} "${id}"`;
    } else if (body.op === 'remove') {
      next = removeEntry(file.content, id);
      summary = `delete ${list.singular} "${id}"`;
    } else if (body.op === 'move') {
      next = moveEntry(file.content, id, Number(body.toIndex));
      summary = `reorder ${list.label.toLowerCase()} ("${id}")`;
    } else return json({ error: 'bad-request' }, 400);

    if (next === file.content) return json({ ok: true, unchanged: true });
    const message = commitMessage(summary, g.editor);
    if (body.dryRun) return json({ diff: lineDiff(file.content, next), path: list.path, message });
    const r = await g.repo.commit([{ path: list.path, content: next, baseSha: body.baseSha ?? null }], message);
    return json({ ok: true, commit: r.sha });
  } catch (e) {
    if (e instanceof Error && /No entry|already exists|letters, numbers/.test(e.message)) return json({ error: 'invalid', message: e.message }, 400);
    return errorResponse(e);
  }
};
