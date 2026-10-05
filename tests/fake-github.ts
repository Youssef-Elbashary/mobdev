/** A tiny in-memory GitHub (just the REST endpoints the CMS uses), for unit tests. */
import { createHash } from 'node:crypto';
import { blobSha } from '../src/lib/cms/sha.ts';

type Commit = { tree: string; parents: string[]; message: string; date: string };
type Pull = { number: number; head: string; base: string; state: 'open' | 'closed'; html_url: string };

export class FakeGitHub {
  blobs = new Map<string, string>();
  trees = new Map<string, Map<string, string>>();
  commits = new Map<string, Commit>();
  refs = new Map<string, string>();
  pulls: Pull[] = [];
  forceConflict = false;
  calls: string[] = [];
  private clock = Date.parse('2026-10-05T10:00:00Z');

  constructor(files: Record<string, string>) {
    const tree = new Map<string, string>();
    for (const [p, c] of Object.entries(files)) tree.set(p, this.putBlob(c));
    const t = this.putTree(tree);
    this.refs.set('main', this.putCommit({ tree: t, parents: [], message: 'Initial', date: this.tick() }));
  }

  private tick() {
    this.clock += 60_000;
    return new Date(this.clock).toISOString();
  }
  private hash(x: unknown) {
    return createHash('sha1').update(JSON.stringify(x)).digest('hex');
  }
  putBlob(content: string) {
    const sha = blobSha(content);
    this.blobs.set(sha, content);
    return sha;
  }
  putTree(tree: Map<string, string>) {
    const sha = this.hash([...tree].sort());
    this.trees.set(sha, new Map(tree));
    return sha;
  }
  putCommit(c: Commit) {
    const sha = this.hash(c);
    this.commits.set(sha, c);
    return sha;
  }
  /** Read a file on a branch (test helper). */
  file(branch: string, p: string) {
    const head = this.refs.get(branch);
    if (!head) return null;
    const sha = this.trees.get(this.commits.get(head)!.tree)!.get(p);
    return sha ? this.blobs.get(sha)! : null;
  }
  /** Simulate someone pushing to a branch outside the CMS. */
  push(branch: string, p: string, content: string, message = 'Edit from VS Code') {
    const head = this.refs.get(branch)!;
    const tree = new Map(this.trees.get(this.commits.get(head)!.tree)!);
    tree.set(p, this.putBlob(content));
    this.refs.set(branch, this.putCommit({ tree: this.putTree(tree), parents: [head], message, date: this.tick() }));
  }
  private treeOf(commit: string) {
    return this.trees.get(this.commits.get(commit)!.tree)!;
  }
  private ancestors(sha: string) {
    const seen = new Set<string>();
    const stack = [sha];
    while (stack.length) {
      const s = stack.pop()!;
      if (seen.has(s)) continue;
      seen.add(s);
      stack.push(...this.commits.get(s)!.parents);
    }
    return seen;
  }

  fetch = async (input: string | URL | Request, init: RequestInit = {}): Promise<Response> => {
    const url = new URL(String(input));
    const method = (init.method ?? 'GET').toUpperCase();
    const p = url.pathname.replace(/^\/repos\/[^/]+\/[^/]+/, '');
    const body = init.body ? JSON.parse(String(init.body)) : undefined;
    const q = url.searchParams;
    this.calls.push(`${method} ${p}`);
    const json = (status: number, data?: unknown) => new Response(data === undefined ? null : JSON.stringify(data), { status, headers: { 'content-type': 'application/json' } });
    let m: RegExpMatchArray | null;

    if (method === 'GET' && (m = p.match(/^\/git\/ref\/heads\/(.+)$/))) {
      const sha = this.refs.get(decodeURIComponent(m[1]));
      return sha ? json(200, { object: { sha } }) : json(404, { message: 'Not Found' });
    }
    if (method === 'POST' && p === '/git/refs') {
      const name = body.ref.replace('refs/heads/', '');
      if (this.refs.has(name)) return json(422, { message: 'Reference already exists' });
      this.refs.set(name, body.sha);
      return json(201, { ref: body.ref });
    }
    if (method === 'PATCH' && (m = p.match(/^\/git\/refs\/heads\/(.+)$/))) {
      const name = decodeURIComponent(m[1]);
      const cur = this.refs.get(name);
      if (!body.force && cur && !this.ancestors(body.sha).has(cur)) return json(422, { message: 'Update is not a fast forward' });
      this.refs.set(name, body.sha);
      return json(200, {});
    }
    if (method === 'DELETE' && (m = p.match(/^\/git\/refs\/heads\/(.+)$/))) {
      return this.refs.delete(decodeURIComponent(m[1])) ? json(204) : json(422, { message: 'Reference does not exist' });
    }
    if (method === 'GET' && (m = p.match(/^\/git\/commits\/(\w+)$/))) return json(200, { sha: m[1], tree: { sha: this.commits.get(m[1])!.tree } });
    if (method === 'POST' && p === '/git/blobs') return json(201, { sha: this.putBlob(body.content) });
    if (method === 'POST' && p === '/git/trees') {
      const tree = new Map(this.trees.get(body.base_tree)!);
      for (const e of body.tree) e.sha === null ? tree.delete(e.path) : tree.set(e.path, e.sha);
      return json(201, { sha: this.putTree(tree) });
    }
    if (method === 'POST' && p === '/git/commits') return json(201, { sha: this.putCommit({ tree: body.tree, parents: body.parents, message: body.message, date: this.tick() }) });
    if (method === 'GET' && (m = p.match(/^\/contents\/(.+)$/))) {
      const content = this.file(q.get('ref')!, decodeURI(m[1]));
      return content === null ? json(404, { message: 'Not Found' }) : json(200, { sha: blobSha(content), content: Buffer.from(content).toString('base64'), encoding: 'base64' });
    }
    if (method === 'GET' && p === '/commits') {
      const out = [];
      let sha: string | undefined = this.refs.get(q.get('sha')!);
      const prefix = q.get('path') ?? '';
      while (sha) {
        const c = this.commits.get(sha)!;
        const parent = c.parents[0];
        const now = this.treeOf(sha);
        const before = parent ? this.treeOf(parent) : new Map();
        const touched = [...new Set([...now.keys(), ...before.keys()])].some((k) => k.startsWith(prefix) && now.get(k) !== before.get(k));
        if (touched) out.push({ sha, html_url: `https://github.com/x/y/commit/${sha}`, commit: { message: c.message, author: { name: 'CMS', date: c.date } } });
        sha = parent;
      }
      return json(200, out.slice(0, Number(q.get('per_page') ?? 30)));
    }
    if (method === 'GET' && (m = p.match(/^\/compare\/(.+)\.\.\.(.+)$/))) {
      const [b, h] = [this.refs.get(decodeURIComponent(m[1]))!, this.refs.get(decodeURIComponent(m[2]))];
      if (!h) return json(404, { message: 'Not Found' });
      const bt = this.treeOf(b);
      const ht = this.treeOf(h);
      const files = [...new Set([...bt.keys(), ...ht.keys()])]
        .filter((k) => bt.get(k) !== ht.get(k))
        .map((k) => ({ filename: k, status: !bt.has(k) ? 'added' : !ht.has(k) ? 'removed' : 'modified' }));
      const baseSet = this.ancestors(b);
      return json(200, { ahead_by: [...this.ancestors(h)].filter((s) => !baseSet.has(s)).length, files });
    }
    if (method === 'GET' && p === '/pulls') return json(200, this.pulls.filter((x) => x.state === 'open' && `owner:${x.head}` === q.get('head')));
    if (method === 'POST' && p === '/pulls') {
      const pr: Pull = { number: this.pulls.length + 1, head: body.head, base: body.base, state: 'open', html_url: `https://github.com/x/y/pull/${this.pulls.length + 1}` };
      this.pulls.push(pr);
      return json(201, pr);
    }
    if (method === 'PUT' && (m = p.match(/^\/pulls\/(\d+)\/merge$/))) {
      const pr = this.pulls[Number(m[1]) - 1];
      if (this.forceConflict) return json(405, { message: 'Pull Request is not mergeable' });
      const base = this.refs.get(pr.base)!;
      const head = this.refs.get(pr.head)!;
      const tree = new Map(this.treeOf(base));
      const fork = this.treeOf([...this.ancestors(head)].find((s) => this.ancestors(base).has(s) && this.commits.get(s)) ?? base);
      for (const [k, v] of this.treeOf(head)) if (fork.get(k) !== v) tree.set(k, v);
      this.refs.set(pr.base, this.putCommit({ tree: this.putTree(tree), parents: [base, head], message: body.commit_title, date: this.tick() }));
      pr.state = 'closed';
      return json(200, { merged: true });
    }
    if (method === 'PATCH' && (m = p.match(/^\/pulls\/(\d+)$/))) {
      this.pulls[Number(m[1]) - 1].state = body.state;
      return json(200, {});
    }
    if (method === 'GET' && p === '/deployments') return json(200, q.get('ref') === 'cms-drafts' ? [{ id: 7 }] : []);
    if (method === 'GET' && p === '/deployments/7/statuses') return json(200, [{ state: 'success', environment_url: 'https://mobdev-git-cms-drafts.vercel.app' }]);
    return json(404, { message: `fake: no route for ${method} ${p}` });
  };
}
