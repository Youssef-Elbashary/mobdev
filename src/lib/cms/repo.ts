/**
 * Where CMS saves go.
 *   GitHubRepo — commits to a `cms-drafts` branch through the GitHub REST API; Publish merges it into `main`
 *                with a pull request (Vercel then deploys). Used on Vercel when GITHUB_TOKEN is set.
 *   LocalRepo  — writes straight into the project folder (laptop dev): the dev server shows changes at once.
 * Both refuse a save when the file changed since it was opened (optimistic concurrency on the blob sha).
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import { blobSha } from './sha.ts';

export type FileRef = { path: string; sha: string; content: string };
export type Change = { path: string; content: string | null; baseSha: string | null };
export type Status = {
  mode: 'github' | 'local';
  changed: { path: string; status: string }[];
  ahead: number;
  previewUrl: string | null;
  prUrl: string | null;
};
export type HistoryItem = { sha: string; message: string; date: string; url: string | null };

export class RepoError extends Error {
  status: number;
  info?: Record<string, unknown>;
  constructor(status: number, message: string, info?: Record<string, unknown>) {
    super(message);
    this.status = status;
    this.info = info;
  }
}

export interface ContentRepo {
  mode: 'github' | 'local';
  read(path: string): Promise<FileRef | null>;
  commit(changes: Change[], message: string): Promise<{ sha: string }>;
  status(): Promise<Status>;
  publish(): Promise<{ merged: true; prUrl: string } | { conflict: true; prUrl: string }>;
  discard(): Promise<void>;
  history(limit?: number): Promise<HistoryItem[]>;
}

/** The CMS may only ever write course content. */
export function assertContentPath(p: string) {
  if (!/^src\/content\/[\w./-]+$/.test(p) || p.split('/').some((s) => s === '..' || s === '.')) {
    throw new RepoError(400, `The CMS can't write "${p}".`);
  }
}

const editorOf = (message: string) => message.match(/\(by ([^)]+)\)\s*$/)?.[1] ?? null;

/* ------------------------------------------------------------------ local */

export class LocalRepo implements ContentRepo {
  mode = 'local' as const;
  private root: string;
  private log: (HistoryItem & { paths: string[] })[] = [];
  constructor(root: string) {
    this.root = root;
  }

  private file(p: string) {
    assertContentPath(p);
    return path.join(this.root, ...p.split('/'));
  }

  async read(p: string): Promise<FileRef | null> {
    try {
      const content = await fs.readFile(this.file(p), 'utf8');
      return { path: p, sha: blobSha(content), content };
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code === 'ENOENT') return null;
      throw e;
    }
  }

  async commit(changes: Change[], message: string) {
    for (const c of changes) {
      const now = await this.read(c.path);
      if ((now?.sha ?? null) !== c.baseSha) {
        const last = this.log.find((h) => h.paths.includes(c.path));
        throw new RepoError(409, `${c.path} was changed since you opened it.`, {
          path: c.path,
          by: last ? editorOf(last.message) : 'someone (outside the CMS)',
          at: last?.date ?? null,
        });
      }
    }
    for (const c of changes) {
      const file = this.file(c.path);
      if (c.content === null) await fs.rm(file, { force: true });
      else {
        await fs.mkdir(path.dirname(file), { recursive: true });
        await fs.writeFile(file, c.content, 'utf8');
      }
    }
    const date = new Date().toISOString();
    const sha = blobSha(message + date);
    this.log.unshift({ sha, message, date, url: null, paths: changes.map((c) => c.path) });
    this.log = this.log.slice(0, 50);
    return { sha };
  }

  async status(): Promise<Status> {
    return { mode: 'local', changed: [], ahead: 0, previewUrl: null, prUrl: null };
  }
  async publish(): Promise<never> {
    throw new RepoError(400, 'Publishing works on the live site. In local mode your saves are already in the project files.');
  }
  async discard(): Promise<never> {
    throw new RepoError(400, 'Nothing to discard in local mode: use git to undo file changes.');
  }
  async history(limit = 20) {
    return this.log.slice(0, limit).map(({ paths: _p, ...h }) => h);
  }
}

/* ----------------------------------------------------------------- github */

type GitHubOptions = { token: string; repo: string; base?: string; drafts?: string; fetch?: typeof fetch; api?: string };

export class GitHubRepo implements ContentRepo {
  mode = 'github' as const;
  private token: string;
  private repo: string;
  private base: string;
  private drafts: string;
  private fetchImpl: typeof fetch;
  private api: string;

  constructor(o: GitHubOptions) {
    this.token = o.token;
    this.repo = o.repo;
    this.base = o.base ?? 'main';
    this.drafts = o.drafts ?? 'cms-drafts';
    this.fetchImpl = o.fetch ?? fetch;
    this.api = o.api ?? 'https://api.github.com';
  }

  private async gh(method: string, url: string, body?: unknown): Promise<{ status: number; data: any }> {
    let res: Response;
    try {
      res = await this.fetchImpl(`${this.api}/repos/${this.repo}${url}`, {
        method,
        headers: {
          authorization: `Bearer ${this.token}`,
          accept: 'application/vnd.github+json',
          'x-github-api-version': '2022-11-28',
          ...(body ? { 'content-type': 'application/json' } : {}),
        },
        body: body ? JSON.stringify(body) : undefined,
      });
    } catch {
      throw new RepoError(502, 'Could not reach GitHub. Try again in a moment.');
    }
    const data = res.status === 204 ? null : await res.json().catch(() => null);
    if (res.status === 401) throw new RepoError(503, 'The GitHub token is missing or expired.', { setup: true });
    if (res.status === 403 && !/rate limit/i.test(data?.message ?? '')) throw new RepoError(503, `The GitHub token can't do this: ${data?.message ?? 'forbidden'}.`, { setup: true });
    if (res.status >= 500) throw new RepoError(502, 'GitHub is having trouble. Try again in a moment.');
    return { status: res.status, data };
  }

  private async head(branch: string): Promise<string | null> {
    const r = await this.gh('GET', `/git/ref/heads/${encodeURIComponent(branch)}`);
    return r.status === 200 ? r.data.object.sha : null;
  }

  private async shaOn(p: string, branch: string): Promise<string | null> {
    const r = await this.gh('GET', `/contents/${encodeURI(p)}?ref=${encodeURIComponent(branch)}`);
    return r.status === 200 ? r.data.sha : null;
  }

  async read(p: string): Promise<FileRef | null> {
    assertContentPath(p);
    const ref = (await this.head(this.drafts)) ? this.drafts : this.base;
    const r = await this.gh('GET', `/contents/${encodeURI(p)}?ref=${encodeURIComponent(ref)}`);
    if (r.status === 404) return null;
    if (r.status !== 200) throw new RepoError(r.status, `Could not read ${p}.`);
    return { path: p, sha: r.data.sha, content: Buffer.from(r.data.content, 'base64').toString('utf8') };
  }

  async commit(changes: Change[], message: string) {
    changes.forEach((c) => assertContentPath(c.path));
    let head = await this.head(this.drafts);
    if (!head) {
      const baseHead = await this.head(this.base);
      if (!baseHead) throw new RepoError(500, `Branch "${this.base}" not found.`);
      const made = await this.gh('POST', '/git/refs', { ref: `refs/heads/${this.drafts}`, sha: baseHead });
      if (made.status !== 201) throw new RepoError(500, 'Could not create the drafts branch.');
      head = baseHead;
    }
    for (const c of changes) {
      const now = await this.shaOn(c.path, this.drafts);
      if (now !== c.baseSha) {
        const last = await this.gh('GET', `/commits?sha=${encodeURIComponent(this.drafts)}&path=${encodeURIComponent(c.path)}&per_page=1`);
        const commit = last.data?.[0]?.commit;
        throw new RepoError(409, `${c.path} was changed since you opened it.`, {
          path: c.path,
          by: commit ? (editorOf(commit.message) ?? commit.author?.name ?? 'someone') : 'someone',
          at: commit?.author?.date ?? null,
        });
      }
    }
    const parent = await this.gh('GET', `/git/commits/${head}`);
    const tree = [];
    for (const c of changes) {
      if (c.content === null) tree.push({ path: c.path, mode: '100644', type: 'blob', sha: null });
      else {
        const blob = await this.gh('POST', '/git/blobs', { content: c.content, encoding: 'utf-8' });
        tree.push({ path: c.path, mode: '100644', type: 'blob', sha: blob.data.sha });
      }
    }
    const newTree = await this.gh('POST', '/git/trees', { base_tree: parent.data.tree.sha, tree });
    const commit = await this.gh('POST', '/git/commits', { message, tree: newTree.data.sha, parents: [head] });
    const moved = await this.gh('PATCH', `/git/refs/heads/${encodeURIComponent(this.drafts)}`, { sha: commit.data.sha, force: false });
    if (moved.status !== 200) throw new RepoError(409, 'Someone saved at the same moment. Reload and try again.', { by: 'someone', at: null });
    return { sha: commit.data.sha as string };
  }

  private async openPr(): Promise<{ number: number; html_url: string } | null> {
    const owner = this.repo.split('/')[0];
    const r = await this.gh('GET', `/pulls?head=${encodeURIComponent(`${owner}:${this.drafts}`)}&base=${encodeURIComponent(this.base)}&state=open`);
    return r.data?.[0] ?? null;
  }

  async status(): Promise<Status> {
    const empty: Status = { mode: 'github', changed: [], ahead: 0, previewUrl: null, prUrl: null };
    if (!(await this.head(this.drafts))) return empty;
    const cmp = await this.gh('GET', `/compare/${encodeURIComponent(this.base)}...${encodeURIComponent(this.drafts)}`);
    if (cmp.status !== 200) return empty;
    const pr = await this.openPr();
    let previewUrl: string | null = null;
    const deps = await this.gh('GET', `/deployments?ref=${encodeURIComponent(this.drafts)}&per_page=1`);
    if (deps.data?.[0]) {
      const st = await this.gh('GET', `/deployments/${deps.data[0].id}/statuses?per_page=5`);
      previewUrl = st.data?.find((s: any) => s.environment_url)?.environment_url ?? null;
    }
    return {
      mode: 'github',
      changed: (cmp.data.files ?? []).map((f: any) => ({ path: f.filename, status: f.status })),
      ahead: cmp.data.ahead_by ?? 0,
      previewUrl,
      prUrl: pr?.html_url ?? null,
    };
  }

  async publish() {
    if (!(await this.head(this.drafts))) throw new RepoError(400, 'There is nothing to publish.');
    let pr = await this.openPr();
    if (!pr) {
      const made = await this.gh('POST', '/pulls', {
        title: 'CMS: publish drafts',
        head: this.drafts,
        base: this.base,
        body: 'Changes made in the admin CMS (/admin/cms).',
      });
      if (made.status !== 201) throw new RepoError(500, made.data?.message ?? 'Could not open the pull request.');
      pr = made.data;
    }
    const merged = await this.gh('PUT', `/pulls/${pr!.number}/merge`, { merge_method: 'merge', commit_title: 'CMS: publish drafts' });
    if (merged.status === 405 || merged.status === 409) return { conflict: true as const, prUrl: pr!.html_url };
    if (merged.status !== 200) throw new RepoError(500, merged.data?.message ?? 'Could not publish.');
    await this.gh('DELETE', `/git/refs/heads/${encodeURIComponent(this.drafts)}`);
    return { merged: true as const, prUrl: pr!.html_url };
  }

  async discard() {
    const pr = await this.openPr();
    if (pr) await this.gh('PATCH', `/pulls/${pr.number}`, { state: 'closed' });
    await this.gh('DELETE', `/git/refs/heads/${encodeURIComponent(this.drafts)}`);
  }

  async history(limit = 20) {
    const branch = (await this.head(this.drafts)) ? this.drafts : this.base;
    const r = await this.gh('GET', `/commits?sha=${encodeURIComponent(branch)}&path=src/content&per_page=50`);
    return ((r.data ?? []) as any[])
      .filter((c) => String(c.commit?.message ?? '').startsWith('CMS:'))
      .slice(0, limit)
      .map((c) => ({ sha: c.sha, message: String(c.commit.message).split('\n')[0], date: c.commit.author?.date ?? '', url: c.html_url ?? null }));
  }
}
