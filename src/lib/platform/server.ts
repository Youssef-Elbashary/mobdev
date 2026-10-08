/**
 * MODULE PLATFORM — storage. Rules live in ./core.ts.
 * Modules and labs built in /admin/builder are stored in the progress PostgreSQL database
 * (platform_modules + platform_labs in production, platform_dev_* elsewhere), created on first use.
 * The file-based course (src/content) is the built-in module and is not stored here.
 */
import { getSecret } from 'astro:env/server';
import { neon } from '@neondatabase/serverless';
import { Pool } from 'pg';
import { course } from '@/site.config';
import { compileLab, compileModule, emptyFlow, labKey, type AssessmentItem, type CompiledLab, type Flow } from './core';
import { DEFAULT_SETTINGS, kindOf, listOf, type Audience, type Category } from '@/lib/accounts/core';
import type { ModuleBannerInput } from './banner';

const env = (key: string) => getSecret(key) || undefined;
const onVercel = () => Boolean(env('VERCEL'));
const databaseUrl = () => onVercel()
  ? env('DATABASE_URL') ?? env('POSTGRES_URL')
  : env('LOCAL_DATABASE_URL') ?? env('DATABASE_URL') ?? env('POSTGRES_URL');

/** The file-based course, shown as the first module and linked to its existing pages. */
export const BUILT_IN_MODULE = {
  slug: 'mobile-development',
  code: course.code,
  title: course.name,
  term: course.term ?? '',
  description: course.tagline ?? '',
  color: '#c8ff4d',
  href: '/course',
};

export type ModuleRow = { slug: string; title: string; published: boolean; flow: Flow; created_at: string; updated_at: string };
export type LabRow = { module: string; slug: string; title: string; published: boolean; flow: Flow; created_at: string; updated_at: string };
export type ModuleBannerRow = ModuleBannerInput & { id: string; module: string; published: boolean; created_by: string; created_at: string; updated_at: string };

const iso = (v: unknown) => (v instanceof Date ? v.toISOString() : String(v));
const json = (v: unknown): Flow => (typeof v === 'string' ? JSON.parse(v) : (v as Flow));
const toModule = (r: any): ModuleRow => ({ slug: r.slug, title: r.title, published: Boolean(r.published), flow: json(r.flow), created_at: iso(r.created_at), updated_at: iso(r.updated_at) });
const toLab = (r: any): LabRow => ({ module: r.module, slug: r.slug, title: r.title, published: Boolean(r.published), flow: json(r.flow), created_at: iso(r.created_at), updated_at: iso(r.updated_at) });
const toBanner = (r: any): ModuleBannerRow => ({ id: r.id, module: r.module, title: r.title, message: r.message, ctaLabel: r.cta_label, ctaHref: r.cta_href, published: Boolean(r.published), created_by: r.created_by, created_at: iso(r.created_at), updated_at: iso(r.updated_at) });

class PlatformStore {
  private run: (text: string, params?: unknown[]) => Promise<any[]>;
  private ready: Promise<void> | null = null;
  private modules: string;
  private labs: string;
  private assessment: string;
  private banners: string;

  constructor(url: string, prefix: string, driver: 'neon' | 'postgres') {
    if (driver === 'postgres') {
      const pool = new Pool({ connectionString: url, allowExitOnIdle: true });
      this.run = async (text, params = []) => (await pool.query(text, params)).rows;
    } else {
      const sql = neon(url);
      this.run = async (text, params = []) => (await sql.query(text, params)) as any[];
    }
    this.modules = `${prefix}_modules`;
    this.labs = `${prefix}_labs`;
    this.assessment = `${prefix}_assessment`;
    this.banners = `${prefix}_banners`;
  }

  private async migrate() {
    for (const s of [
      `create table if not exists ${this.modules} (
        slug text primary key, title text not null, published boolean not null default false, flow jsonb not null,
        created_at timestamptz not null default now(), updated_at timestamptz not null default now())`,
      `create table if not exists ${this.labs} (
        module text not null references ${this.modules}(slug) on delete cascade on update cascade, slug text not null,
        title text not null, published boolean not null default false, flow jsonb not null,
        created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
        primary key (module, slug))`,
      // set by each module's leader; the built-in course is "mobile-development" (no row in modules)
      `create table if not exists ${this.assessment} (
        module text primary key, items jsonb not null, updated_by text not null default '', updated_at timestamptz not null default now())`,
      `create table if not exists ${this.banners} (
        id text primary key, module text not null, title text not null, message text not null,
        cta_label text not null default '', cta_href text not null default '', published boolean not null default false,
        created_by text not null default '', created_at timestamptz not null default now(), updated_at timestamptz not null default now())`,
      `create index if not exists ${this.banners}_module_idx on ${this.banners} (module, updated_at desc)`,
    ]) await this.run(s);
  }

  private async q(text: string, params: unknown[] = []) {
    await (this.ready ??= this.migrate().catch((e) => { this.ready = null; throw e; }));
    return this.run(text, params);
  }

  async listModules(): Promise<ModuleRow[]> {
    return (await this.q(`select * from ${this.modules} order by created_at`)).map(toModule);
  }
  async getModule(slug: string): Promise<ModuleRow | null> {
    const [r] = await this.q(`select * from ${this.modules} where slug = $1`, [slug]);
    return r ? toModule(r) : null;
  }
  /** Creates a module; returns null if the slug is taken. */
  async createModule(slug: string, title: string): Promise<ModuleRow | null> {
    const [r] = await this.q(
      `insert into ${this.modules} (slug, title, flow) values ($1, $2, $3) on conflict (slug) do nothing returning *`,
      [slug, title, JSON.stringify(emptyFlow('module', { title }))],
    );
    return r ? toModule(r) : null;
  }
  async saveModule(slug: string, patch: { flow?: Flow; published?: boolean }): Promise<ModuleRow | null> {
    const cur = await this.getModule(slug);
    if (!cur) return null;
    const flow = patch.flow ?? cur.flow;
    const title = compileModule(flow).meta.title || cur.title;
    const [r] = await this.q(
      `update ${this.modules} set flow = $2, title = $3, published = $4, updated_at = now() where slug = $1 returning *`,
      [slug, JSON.stringify(flow), title, patch.published ?? cur.published],
    );
    return r ? toModule(r) : null;
  }
  async deleteModule(slug: string): Promise<boolean> {
    return (await this.q(`delete from ${this.modules} where slug = $1 returning slug`, [slug])).length > 0;
  }

  async listLabs(module?: string): Promise<LabRow[]> {
    return (module
      ? await this.q(`select * from ${this.labs} where module = $1 order by created_at`, [module])
      : await this.q(`select * from ${this.labs} order by module, created_at`)).map(toLab);
  }
  async getLab(module: string, slug: string): Promise<LabRow | null> {
    const [r] = await this.q(`select * from ${this.labs} where module = $1 and slug = $2`, [module, slug]);
    return r ? toLab(r) : null;
  }
  async createLab(module: string, slug: string, title: string): Promise<LabRow | null> {
    const [r] = await this.q(
      `insert into ${this.labs} (module, slug, title, flow) values ($1, $2, $3, $4) on conflict (module, slug) do nothing returning *`,
      [module, slug, title, JSON.stringify(emptyFlow('lab', { title }))],
    );
    return r ? toLab(r) : null;
  }
  async saveLab(module: string, slug: string, patch: { flow?: Flow; published?: boolean }): Promise<LabRow | null> {
    const cur = await this.getLab(module, slug);
    if (!cur) return null;
    const flow = patch.flow ?? cur.flow;
    const title = compileLab(flow, labKey(module, slug)).meta.title || cur.title;
    const [r] = await this.q(
      `update ${this.labs} set flow = $3, title = $4, published = $5, updated_at = now() where module = $1 and slug = $2 returning *`,
      [module, slug, JSON.stringify(flow), title, patch.published ?? cur.published],
    );
    return r ? toLab(r) : null;
  }
  async getAssessment(module: string): Promise<{ items: AssessmentItem[]; updated_by: string; updated_at: string } | null> {
    const [r] = await this.q(`select * from ${this.assessment} where module = $1`, [module]);
    return r ? { items: typeof r.items === 'string' ? JSON.parse(r.items) : r.items, updated_by: r.updated_by, updated_at: iso(r.updated_at) } : null;
  }
  async setAssessment(module: string, items: AssessmentItem[], by: string) {
    await this.q(`insert into ${this.assessment} (module, items, updated_by) values ($1, $2, $3)
      on conflict (module) do update set items = excluded.items, updated_by = excluded.updated_by, updated_at = now()`, [module, JSON.stringify(items), by]);
  }

  async listBanners(module: string): Promise<ModuleBannerRow[]> {
    return (await this.q(`select * from ${this.banners} where module = $1 order by updated_at desc`, [module])).map(toBanner);
  }
  async publishedBanner(module: string): Promise<ModuleBannerRow | null> {
    const [row] = await this.q(`select * from ${this.banners} where module = $1 and published = true order by updated_at desc limit 1`, [module]);
    return row ? toBanner(row) : null;
  }
  async createBanner(id: string, module: string, input: ModuleBannerInput, by: string): Promise<ModuleBannerRow> {
    const [row] = await this.q(`insert into ${this.banners} (id, module, title, message, cta_label, cta_href, created_by)
      values ($1, $2, $3, $4, $5, $6, $7) returning *`, [id, module, input.title, input.message, input.ctaLabel, input.ctaHref, by]);
    return toBanner(row);
  }
  async updateBanner(module: string, id: string, input: ModuleBannerInput): Promise<ModuleBannerRow | null> {
    const [row] = await this.q(`update ${this.banners} set title = $3, message = $4, cta_label = $5, cta_href = $6, updated_at = now()
      where module = $1 and id = $2 returning *`, [module, id, input.title, input.message, input.ctaLabel, input.ctaHref]);
    return row ? toBanner(row) : null;
  }
  async publishBanner(module: string, id: string, published: boolean): Promise<ModuleBannerRow | null> {
    if (published) await this.q(`update ${this.banners} set published = false where module = $1 and id <> $2 and published = true`, [module, id]);
    const [row] = await this.q(`update ${this.banners} set published = $3, updated_at = now() where module = $1 and id = $2 returning *`, [module, id, published]);
    return row ? toBanner(row) : null;
  }
  async deleteBanner(module: string, id: string): Promise<boolean> {
    return (await this.q(`delete from ${this.banners} where module = $1 and id = $2 returning id`, [module, id])).length > 0;
  }

  async deleteLab(module: string, slug: string): Promise<boolean> {
    return (await this.q(`delete from ${this.labs} where module = $1 and slug = $2 returning slug`, [module, slug])).length > 0;
  }
}

let store: PlatformStore | null | undefined;
export function getPlatformStore(): PlatformStore | null {
  if (store !== undefined) return store;
  const url = databaseUrl();
  store = url ? new PlatformStore(url, env('VERCEL_ENV') === 'production' ? 'platform' : 'platform_dev', onVercel() ? 'neon' : 'postgres') : null;
  return store;
}

/**
 * Creates the database-backed canvas for the original course on first use.
 * Its existing MDX labs remain available while new visual-builder labs can be
 * authored alongside them.
 */
export async function ensureBuiltInBuilder(): Promise<ModuleRow | null> {
  const s = getPlatformStore();
  if (!s) return null;
  const existing = await s.getModule(BUILT_IN_MODULE.slug);
  if (existing) return existing;
  const created = await s.createModule(BUILT_IN_MODULE.slug, BUILT_IN_MODULE.title);
  if (!created) return s.getModule(BUILT_IN_MODULE.slug);
  return s.saveModule(BUILT_IN_MODULE.slug, {
    flow: emptyFlow('module', {
      code: BUILT_IN_MODULE.code,
      title: BUILT_IN_MODULE.title,
      term: BUILT_IN_MODULE.term,
      description: BUILT_IN_MODULE.description,
      color: BUILT_IN_MODULE.color,
      open: 'Yes',
      category: 'Elective',
    }),
  });
}

/** A published module with its published labs, in builder order. */
export async function loadModule(slug: string, opts: { drafts?: boolean } = {}) {
  const s = getPlatformStore();
  const mod = s ? await s.getModule(slug) : null;
  if (!mod || (!mod.published && !opts.drafts)) return null;
  const compiled = compileModule(mod.flow);
  const labs = new Map((await s!.listLabs(slug)).filter((l) => l.published || opts.drafts).map((l) => [l.slug, l]));
  let week = '';
  const items: { lab: LabRow; compiled: CompiledLab; week: string; n: number }[] = [];
  for (const it of compiled.items) {
    if (it.kind === 'week') { week = it.title; continue; }
    const lab = labs.get(it.slug);
    if (lab) items.push({ lab, compiled: compileLab(lab.flow, labKey(slug, lab.slug)), week, n: items.length + 1 });
  }
  return { module: mod, meta: compiled.meta, items };
}

/**
 * Every published builder lab as a progress-tracking structure source (used by getStructures):
 * the compiled outline is parsed by the same labStructure() as file-based labs.
 */
export async function publishedLabSources(): Promise<{ key: string; title: string; outline: string; exercises: CompiledLab['exercises'] }[]> {
  const s = getPlatformStore();
  if (!s) return [];
  const modules = new Map((await s.listModules()).filter((m) => m.published).map((m) => [m.slug, m]));
  return (await s.listLabs())
    .filter((l) => l.published && modules.has(l.module))
    .map((l) => {
      const key = labKey(l.module, l.slug);
      const c = compileLab(l.flow, key);
      return { key, title: `${modules.get(l.module)!.title}: ${c.meta.title}`, outline: c.outline, exercises: c.exercises };
    });
}

export type ModuleCard = Audience & { code: string; title: string; term: string; description: string; color: string; href: string; labs: number; builtIn: boolean };

/**
 * Every module students can see — the built-in course and the published builder modules — with its audience
 * (category, years, specializations) for onboarding and "my modules". The built-in module's audience is set
 * in /admin/accounts → Platform settings.
 */
export async function moduleCards(builtInAudience: { category: string; years: string; specializations: string; semester?: string; open?: boolean }, builtInLabs: number, categories: Category[] = DEFAULT_SETTINGS.categories): Promise<ModuleCard[]> {
  const s = getPlatformStore();
  const [rows, labs] = s ? await Promise.all([s.listModules().catch(() => []), s.listLabs().catch(() => [])]) : [[], []];
  const cat = (v: string | undefined) => (v || 'Core').trim();
  const sem = (v: string | undefined) => (v === 'Semester 2' || v === 'Both' ? v : 'Semester 1') as Audience['semester'];
  return [
    { ...BUILT_IN_MODULE, labs: builtInLabs, builtIn: true, category: cat(builtInAudience.category), kind: kindOf(categories, cat(builtInAudience.category)), open: builtInAudience.open !== false,
      years: listOf(builtInAudience.years), specializations: listOf(builtInAudience.specializations), semester: sem(builtInAudience.semester) },
    ...rows.filter((m) => m.slug !== BUILT_IN_MODULE.slug && m.published).map((m) => {
      const c = compileModule(m.flow);
      const published = new Set(labs.filter((l) => l.module === m.slug && l.published).map((l) => l.slug));
      return {
        slug: m.slug, code: c.meta.code ?? '', title: c.meta.title || m.title, term: c.meta.term ?? '', description: c.meta.description ?? '',
        color: c.meta.color || '#7cb1ff', href: `/m/${m.slug}`, builtIn: false,
        labs: c.items.filter((i) => i.kind === 'lab' && published.has(i.slug)).length,
        category: cat(c.meta.category), kind: kindOf(categories, cat(c.meta.category)), open: c.meta.open === 'Yes',
        years: listOf(c.meta.years), specializations: listOf(c.meta.specializations), semester: sem(c.meta.semester),
      };
    }),
  ];
}

/** The module leader's email: set on the module node; for the built-in course, the course contact (site.yaml). */
export async function leaderEmail(module: string): Promise<string> {
  if (module === BUILT_IN_MODULE.slug) return (course.contact ?? '').toLowerCase();
  const m = await getPlatformStore()?.getModule(module);
  return m ? (compileModule(m.flow).meta.leader ?? '').trim().toLowerCase() : '';
}
