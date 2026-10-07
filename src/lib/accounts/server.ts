/**
 * ACCOUNTS — storage and cookies. Rules: ./core.ts · passwords and tokens: ./tokens.ts.
 * Users, platform settings (years, specializations, built-in module audience) live in the progress
 * PostgreSQL database (accounts_* in production, accounts_dev_* elsewhere), created on first use.
 * The signing secret is SESSION_SECRET, or derived from ADMIN_PASSWORD when that is not set.
 * The ADMIN_PASSWORD login on /admin keeps working and counts as a doctor (it is how the first doctor
 * account gets created).
 */
import type { AstroCookies } from 'astro';
import { randomBytes } from 'node:crypto';
import { getSecret } from 'astro:env/server';
import { createHash, randomUUID } from 'node:crypto';
import { neon } from '@neondatabase/serverless';
import { Pool } from 'pg';
import { BUILT_IN_AUDIENCE, DEFAULT_SETTINGS, SUPER_ADMINS, type NewAccount, type Profile, type PublicUser, type Role, type Settings } from './core';
import { DEFAULT_STORED, type ModuleRole, type StoredMatrix } from './permissions';
import { course, team } from '@/site.config';
import { hashPassword, signToken, verifyPassword, verifyToken, type TokenClaims } from './tokens';

const env = (key: string) => getSecret(key) || undefined;
const onVercel = () => Boolean(env('VERCEL'));
const databaseUrl = () => onVercel()
  ? env('DATABASE_URL') ?? env('POSTGRES_URL')
  : env('LOCAL_DATABASE_URL') ?? env('DATABASE_URL') ?? env('POSTGRES_URL');

export const USER_COOKIE = 'mdx_user';
const TTL = { super_admin: 12, doctor: 12, ta: 12, student: 24 * 30 } as const; // hours
const INVITE_DAYS = 14;

export type Invite = { token: string; email: string; name: string; platform_role: Role; module: string | null; module_role: ModuleRole | null; invited_by: string; created_at: string; expires_at: string; accepted_at: string | null };
export type StaffRow = { module: string; email: string; role: ModuleRole; added_by: string; created_at: string };
const toInvite = (r: any): Invite => ({ ...r, created_at: iso(r.created_at)!, expires_at: iso(r.expires_at)!, accepted_at: iso(r.accepted_at) });
const toStaff = (r: any): StaffRow => ({ ...r, created_at: iso(r.created_at)! });

/** The Mobile Development teaching team (site.yaml) — seeded as staff of the built-in module. */
const BUILT_IN = 'mobile-development';
function teamSeed() {
  return team.filter((t) => t.email).map((t) => {
    const email = t.email!.toLowerCase();
    const leader = /leader/i.test(t.role) || email === (course.contact ?? '').toLowerCase();
    return { email, name: t.name.replace(/^Dr\.\s*/, ''), module_role: (leader ? 'leader' : 'admin') as ModuleRole,
      platform_role: (SUPER_ADMINS.includes(email) ? 'super_admin' : leader || /^dr\.?\s/i.test(t.name) ? 'doctor' : 'ta') as Role };
  });
}

/** Secret for signing account tokens; null when neither SESSION_SECRET nor ADMIN_PASSWORD is set. */
export function tokenSecret(): string | null {
  const own = env('SESSION_SECRET');
  if (own) return own;
  const pw = env('ADMIN_PASSWORD');
  return pw ? createHash('sha256').update(`mdx-accounts:${pw}`).digest('hex') : null;
}

/** The signed-in account from the cookie (no database call), or null. */
export function viewer(cookies: AstroCookies): TokenClaims | null {
  const secret = tokenSecret();
  return secret ? verifyToken(cookies.get(USER_COOKIE)?.value, secret) : null;
}

export function startUserSession(cookies: AstroCookies, user: { id: string; role: Role; name: string; token_version: number }, secure: boolean) {
  const secret = tokenSecret();
  if (!secret) return;
  const ttl = TTL[user.role] * 3600_000;
  cookies.set(USER_COOKIE, signToken({ u: user.id, r: user.role, n: user.name, v: user.token_version }, secret, ttl), {
    httpOnly: true, secure, sameSite: 'lax', path: '/', maxAge: ttl / 1000,
  });
}
export const endUserSession = (cookies: AstroCookies) => cookies.delete(USER_COOKIE, { path: '/' });

/* ------------------------------------------------------------------ store */

type UserRow = PublicUser & { password_hash: string; token_version: number };
const iso = (v: unknown) => (v instanceof Date ? v.toISOString() : v == null ? null : String(v));
const toUser = (r: any): UserRow => ({
  id: r.id, role: r.role, name: r.name, email: r.email, studentId: r.student_id ?? null,
  profile: { year: r.year ?? '', specialization: r.specialization ?? '', modules: Array.isArray(r.modules) ? r.modules : [] },
  active: Boolean(r.active), created_at: iso(r.created_at)!, last_login: iso(r.last_login),
  password_hash: r.password_hash, token_version: Number(r.token_version ?? 0),
});
export const publicUser = ({ password_hash, token_version, ...u }: UserRow): PublicUser => u;

class AccountStore {
  private run: (text: string, params?: unknown[]) => Promise<any[]>;
  private ready: Promise<void> | null = null;
  private users: string;
  private settings: string;
  private staff: string;
  private invites: string;
  private enrollments: string;

  constructor(url: string, prefix: string, driver: 'neon' | 'postgres') {
    if (driver === 'postgres') {
      const pool = new Pool({ connectionString: url, allowExitOnIdle: true });
      this.run = async (text, params = []) => (await pool.query(text, params)).rows;
    } else {
      const sql = neon(url);
      this.run = async (text, params = []) => (await sql.query(text, params)) as any[];
    }
    this.users = `${prefix}_users`;
    this.settings = `${prefix}_settings`;
    this.staff = `${prefix}_module_staff`;
    this.invites = `${prefix}_invites`;
    this.enrollments = `${prefix}_enrollments`;
  }

  private async migrate() {
    for (const s of [
      `create table if not exists ${this.users} (
        id text primary key, role text not null, name text not null, email text not null unique, password_hash text not null,
        student_id text unique, year text, specialization text, modules text[] not null default '{}',
        active boolean not null default true, token_version int not null default 0,
        created_at timestamptz not null default now(), last_login timestamptz)`,
      `create table if not exists ${this.settings} (key text primary key, value jsonb not null, updated_at timestamptz not null default now())`,
      `create table if not exists ${this.staff} (
        module text not null, email text not null, role text not null, added_by text not null default '',
        created_at timestamptz not null default now(), primary key (module, email))`,
      `create table if not exists ${this.invites} (
        token text primary key, email text not null, name text not null default '', platform_role text not null,
        module text, module_role text, invited_by text not null default '',
        created_at timestamptz not null default now(), expires_at timestamptz not null, accepted_at timestamptz)`,
      // students in a module: added by module staff or by accepting an invite (Mobile Development is self-chosen instead)
      `create table if not exists ${this.enrollments} (
        module text not null, email text not null, source text not null, added_by text not null default '',
        created_at timestamptz not null default now(), primary key (module, email))`,
    ]) await this.run(s);
    await this.seed();
  }

  /** First run: the Mobile Development team become staff of that module, super admins are promoted, and
   *  everyone without an account gets an invite link (shown to super admins in Admin → Accounts). */
  private async seed() {
    for (const t of teamSeed()) {
      await this.run(`insert into ${this.staff} (module, email, role, added_by) values ($1, $2, $3, 'site.yaml') on conflict do nothing`, [BUILT_IN, t.email, t.module_role]);
      const [user] = await this.run(`select id, role from ${this.users} where email = $1`, [t.email]);
      if (user) continue;
      const [pending] = await this.run(`select token from ${this.invites} where email = $1 and accepted_at is null and expires_at > now()`, [t.email]);
      if (pending) continue;
      await this.run(`insert into ${this.invites} (token, email, name, platform_role, module, module_role, invited_by, expires_at)
        values ($1, $2, $3, $4, $5, $6, 'site.yaml', now() + interval '${INVITE_DAYS} days')`,
        [randomBytes(24).toString('base64url'), t.email, t.name, t.platform_role, BUILT_IN, t.module_role]);
    }
    await this.run(`update ${this.users} set role = 'super_admin', token_version = token_version + 1 where email = any($1) and role <> 'super_admin'`, [SUPER_ADMINS]);
  }
  private async q(text: string, params: unknown[] = []) {
    await (this.ready ??= this.migrate().catch((e) => { this.ready = null; throw e; }));
    return this.run(text, params);
  }

  async byEmail(email: string): Promise<UserRow | null> {
    const [r] = await this.q(`select * from ${this.users} where email = $1`, [email]);
    return r ? toUser(r) : null;
  }
  async byId(id: string): Promise<UserRow | null> {
    const [r] = await this.q(`select * from ${this.users} where id = $1`, [id]);
    return r ? toUser(r) : null;
  }
  async list(): Promise<UserRow[]> {
    return (await this.q(`select * from ${this.users} order by role, name`)).map(toUser);
  }
  /** null when the email (or student ID) is already registered */
  async create(a: NewAccount, profile?: Profile): Promise<UserRow | null> {
    try {
      const [r] = await this.q(
        `insert into ${this.users} (id, role, name, email, password_hash, student_id, year, specialization, modules)
         values ($1, $2, $3, $4, $5, $6, $7, $8, $9) returning *`,
        [randomUUID(), SUPER_ADMINS.includes(a.email) ? 'super_admin' : a.role, a.name, a.email, hashPassword(a.password), a.studentId, profile?.year ?? null, profile?.specialization ?? null, profile?.modules ?? []],
      );
      return toUser(r);
    } catch (error) {
      if (String((error as { code?: string }).code) === '23505') return null; // unique violation
      throw error;
    }
  }
  async login(email: string, password: string): Promise<UserRow | null> {
    const u = await this.byEmail(email);
    if (!u || !u.active || !verifyPassword(password, u.password_hash)) return null;
    await this.q(`update ${this.users} set last_login = now() where id = $1`, [u.id]);
    return u;
  }
  async setProfile(id: string, p: Profile): Promise<UserRow | null> {
    const [r] = await this.q(`update ${this.users} set year = $2, specialization = $3, modules = $4 where id = $1 returning *`, [id, p.year, p.specialization, p.modules]);
    return r ? toUser(r) : null;
  }
  /** deactivating or changing the password bumps the token version, which signs the account out everywhere */
  async update(id: string, patch: { active?: boolean; role?: Role; password?: string; name?: string }): Promise<UserRow | null> {
    const cur = await this.byId(id);
    if (!cur) return null;
    const revoke = patch.active === false || patch.password !== undefined || (patch.role !== undefined && patch.role !== cur.role);
    const [r] = await this.q(
      `update ${this.users} set active = $2, role = $3, name = $4, password_hash = $5, token_version = token_version + $6 where id = $1 returning *`,
      [id, patch.active ?? cur.active, patch.role ?? cur.role, patch.name ?? cur.name, patch.password ? hashPassword(patch.password) : cur.password_hash, revoke ? 1 : 0],
    );
    return r ? toUser(r) : null;
  }
  async remove(id: string): Promise<boolean> {
    return (await this.q(`delete from ${this.users} where id = $1 returning id`, [id])).length > 0;
  }
  async isCurrent(claims: TokenClaims): Promise<boolean> {
    const u = await this.byId(claims.u);
    return Boolean(u && u.active && u.token_version === claims.v && u.role === claims.r);
  }

  /* ------------------------------------------------- module staff */

  /** module → role for this email (staff table, plus modules naming this email as leader on their node) */
  async staffFor(email: string): Promise<Record<string, ModuleRole>> {
    const rows = await this.q(`select module, role from ${this.staff} where email = $1`, [email.toLowerCase()]);
    return Object.fromEntries(rows.map((r) => [r.module, r.role as ModuleRole]));
  }
  async listStaff(module?: string): Promise<StaffRow[]> {
    return (module
      ? await this.q(`select * from ${this.staff} where module = $1 order by role, email`, [module])
      : await this.q(`select * from ${this.staff} order by module, role, email`)).map(toStaff);
  }
  async setStaff(module: string, email: string, role: ModuleRole, by: string) {
    await this.q(`insert into ${this.staff} (module, email, role, added_by) values ($1, $2, $3, $4)
      on conflict (module, email) do update set role = excluded.role, added_by = excluded.added_by`, [module, email.toLowerCase(), role, by]);
  }
  async removeStaff(module: string, email: string): Promise<boolean> {
    return (await this.q(`delete from ${this.staff} where module = $1 and email = $2 returning email`, [module, email.toLowerCase()])).length > 0;
  }

  /* -------------------------------------------------- enrollments */

  async enrollmentsFor(email: string): Promise<string[]> {
    return (await this.q(`select module from ${this.enrollments} where email = $1 order by created_at`, [email.toLowerCase()])).map((r) => r.module);
  }
  async listEnrollments(module: string): Promise<{ email: string; source: string; added_by: string; created_at: string; name: string | null; student_id: string | null }[]> {
    return (await this.q(
      `select e.*, u.name, u.student_id from ${this.enrollments} e left join ${this.users} u on u.email = e.email where e.module = $1 order by e.created_at desc`, [module],
    )).map((r) => ({ email: r.email, source: r.source, added_by: r.added_by, created_at: iso(r.created_at)!, name: r.name ?? null, student_id: r.student_id ?? null }));
  }
  async enroll(module: string, email: string, source: 'staff' | 'invite', by: string) {
    await this.q(`insert into ${this.enrollments} (module, email, source, added_by) values ($1, $2, $3, $4) on conflict do nothing`, [module, email.toLowerCase(), source, by]);
  }
  async unenroll(module: string, email: string): Promise<boolean> {
    return (await this.q(`delete from ${this.enrollments} where module = $1 and email = $2 returning email`, [module, email.toLowerCase()])).length > 0;
  }

  /* ------------------------------------------------------ invites */

  async createInvite(i: { email: string; name: string; platform_role: Role; module: string | null; module_role: ModuleRole | null; invited_by: string }): Promise<Invite> {
    const [r] = await this.q(`insert into ${this.invites} (token, email, name, platform_role, module, module_role, invited_by, expires_at)
      values ($1, $2, $3, $4, $5, $6, $7, now() + interval '${INVITE_DAYS} days') returning *`,
      [randomBytes(24).toString('base64url'), i.email.toLowerCase(), i.name, i.platform_role, i.module, i.module_role, i.invited_by]);
    return toInvite(r);
  }
  async listInvites(module?: string): Promise<Invite[]> {
    return (module
      ? await this.q(`select * from ${this.invites} where module = $1 and accepted_at is null and expires_at > now() order by created_at desc`, [module])
      : await this.q(`select * from ${this.invites} where accepted_at is null and expires_at > now() order by created_at desc`)).map(toInvite);
  }
  async getInvite(token: string): Promise<Invite | null> {
    const [r] = await this.q(`select * from ${this.invites} where token = $1 and accepted_at is null and expires_at > now()`, [token]);
    return r ? toInvite(r) : null;
  }
  async closeInvite(token: string) {
    await this.q(`update ${this.invites} set accepted_at = now() where token = $1`, [token]);
  }
  async revokeInvite(token: string): Promise<Invite | null> {
    const [r] = await this.q(`delete from ${this.invites} where token = $1 and accepted_at is null returning *`, [token]);
    return r ? toInvite(r) : null;
  }

  /* ---------------------------------------------------- permissions */

  async getMatrix(): Promise<StoredMatrix> {
    const [r] = await this.q(`select value from ${this.settings} where key = 'matrix'`);
    return r?.value ?? DEFAULT_STORED;
  }
  async setMatrix(m: StoredMatrix) {
    await this.q(`insert into ${this.settings} (key, value) values ('matrix', $1) on conflict (key) do update set value = excluded.value, updated_at = now()`, [JSON.stringify(m)]);
  }

  async getSettings(): Promise<Settings & { builtIn: { category: string; years: string; specializations: string; semester: string } }> {
    const rows = await this.q(`select key, value from ${this.settings}`);
    const get = (k: string) => rows.find((r) => r.key === k)?.value;
    return {
      years: get('years') ?? DEFAULT_SETTINGS.years,
      specializations: get('specializations') ?? DEFAULT_SETTINGS.specializations,
      activeSemester: get('activeSemester') ?? DEFAULT_SETTINGS.activeSemester,
      specFrom: get('specFrom') ?? DEFAULT_SETTINGS.specFrom,
      builtIn: { ...BUILT_IN_AUDIENCE, ...(get('builtIn') ?? {}) },
    };
  }
  async setSetting(key: 'years' | 'specializations' | 'builtIn' | 'activeSemester' | 'specFrom', value: unknown) {
    await this.q(`insert into ${this.settings} (key, value) values ($1, $2) on conflict (key) do update set value = excluded.value, updated_at = now()`, [key, JSON.stringify(value)]);
  }
}

let store: AccountStore | null | undefined;
export function getAccountStore(): AccountStore | null {
  if (store !== undefined) return store;
  const url = databaseUrl();
  store = url && tokenSecret() ? new AccountStore(url, env('VERCEL_ENV') === 'production' ? 'accounts' : 'accounts_dev', onVercel() ? 'neon' : 'postgres') : null;
  return store;
}
