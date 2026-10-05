/**
 * CMS — server glue (Astro + Vercel).
 *
 * Needs, in Vercel → Project → Settings → Environment Variables:
 *   GITHUB_TOKEN  fine-grained token for this repo only: Contents (read/write), Pull requests (read/write), Deployments (read)
 *   GITHUB_REPO   owner/name, e.g. Youssef-Elbashary/mobdev
 *   (optional) CMS_BASE = main, CMS_DRAFTS = cms-drafts
 * On a laptop without a token, saves are written straight into the project files (local mode).
 */
import type { AstroCookies } from 'astro';
import { getSecret } from 'astro:env/server';
import { isAdmin, noStore } from '@/lib/attendance/server';
import { team } from '@/site.config';
import * as schemas from '@/content/schemas';
import { GitHubRepo, LocalRepo, RepoError, type ContentRepo } from './repo';
import type { ListName } from './fields';

const env = (key: string) => getSecret(key) || undefined;
const onVercel = () => Boolean(env('VERCEL'));

let repo: ContentRepo | null | undefined;
export function getRepo(): ContentRepo | null {
  if (repo !== undefined) return repo;
  const token = env('GITHUB_TOKEN');
  const name = env('GITHUB_REPO');
  if (token && name) repo = new GitHubRepo({ token, repo: name, base: env('CMS_BASE') ?? 'main', drafts: env('CMS_DRAFTS') ?? 'cms-drafts' });
  else repo = onVercel() ? null : new LocalRepo(process.cwd());
  return repo;
}

export const cmsSetup = () => ({ github: Boolean(env('GITHUB_TOKEN') && env('GITHUB_REPO')), local: !onVercel() });

/* ----------------------------------------------------------------- editor */

export const EDITOR_COOKIE = 'cms_editor';
export const editors = () => team.map((t) => ({ name: t.name, role: t.role }));

export function currentEditor(cookies: AstroCookies): string | null {
  const name = cookies.get(EDITOR_COOKIE)?.value;
  return name && team.some((t) => t.name === name) ? name : null;
}

export function setEditor(cookies: AstroCookies, name: string, secure: boolean) {
  cookies.set(EDITOR_COOKIE, name, { httpOnly: true, secure, sameSite: 'strict', path: '/', maxAge: 12 * 60 * 60 });
}

export const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json', ...noStore } });

/** Admin + chosen editor + a configured repo, or the response explaining what is missing. */
export function guard(cookies: AstroCookies): { editor: string; repo: ContentRepo } | Response {
  if (!isAdmin(cookies)) return json({ error: 'unauthorised' }, 401);
  const r = getRepo();
  if (!r) return json({ error: 'setup', message: 'Add GITHUB_TOKEN and GITHUB_REPO in Vercel to enable the CMS.' }, 503);
  const editor = currentEditor(cookies);
  if (!editor) return json({ error: 'editor', message: 'Choose who is editing first.' }, 403);
  return { editor, repo: r };
}

export function errorResponse(err: unknown) {
  if (err instanceof RepoError) return json({ error: err.status === 409 ? 'conflict' : 'repo', message: err.message, info: err.info ?? null }, err.status);
  console.error('[cms]', err);
  return json({ error: 'server', message: (err as Error)?.message ?? 'Something went wrong.' }, 500);
}

export const commitMessage = (summary: string, editor: string) => `CMS: ${summary} (by ${editor})`;

/* ------------------------------------------------------------------ data */

export const SITE_PATH = 'src/content/data/site.yaml';

export const LISTS: Record<ListName, { path: string; label: string; singular: string; schema: { safeParse(v: unknown): any } }> = {
  commands: { path: 'src/content/data/commands.yaml', label: 'Commands', singular: 'command', schema: schemas.commandSchema },
  troubleshooting: { path: 'src/content/data/troubleshooting.yaml', label: 'Troubleshooting', singular: 'problem', schema: schemas.troubleshootingSchema },
  resources: { path: 'src/content/data/resources.yaml', label: 'Resources', singular: 'resource', schema: schemas.resourceSchema },
  extra: { path: 'src/content/data/extra.yaml', label: 'Extra learning', singular: 'topic', schema: schemas.extraSchema },
  roadmap: { path: 'src/content/data/roadmap.yaml', label: 'Roadmap', singular: 'stage', schema: schemas.roadmapSchema },
  checklist: { path: 'src/content/data/checklist.yaml', label: 'Setup checklist', singular: 'item', schema: schemas.checklistSchema },
};

/** Zod issues → { "team.1.email": "Invalid email" } for showing under the right field. */
export function fieldErrors(result: { success: boolean; error?: { issues: { path: (string | number)[]; message: string }[] } }) {
  if (result.success) return null;
  const out: Record<string, string> = {};
  for (const i of result.error!.issues) out[i.path.join('.') || '_'] ??= i.message;
  return out;
}

/** Forms send "" for empty optional fields: drop them (and empty lists the entry didn't have) so the YAML stays tidy. */
export function clean(value: Record<string, unknown>, before: Record<string, unknown> = {}): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(value)) {
    if (v === '' || v === undefined || v === null) continue;
    if (Array.isArray(v) && v.length === 0 && !(k in before)) continue;
    if (Array.isArray(v)) out[k] = v.map((x) => (x && typeof x === 'object' && !Array.isArray(x) ? clean(x as Record<string, unknown>) : x)).filter((x) => x !== '');
    else out[k] = v;
  }
  return out;
}
