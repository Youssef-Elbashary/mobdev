/**
 * ROLES & PERMISSIONS — pure rules (shared with the browser; tested in tests/accounts.test.ts).
 *   Platform roles: super_admin (everything, fixed) · doctor · ta · student
 *   Module roles:   leader · admin · ta  (per module, keyed by email so they apply as soon as the account exists)
 * A permission is granted by the platform role (for every module) or by the module role (for that module).
 * The super admin edits the matrix in Admin → Accounts → Roles & permissions.
 */

export const PLATFORM_ROLES = ['super_admin', 'doctor', 'ta', 'student'] as const;
export type PlatformRole = (typeof PLATFORM_ROLES)[number];
export const MODULE_ROLES = ['leader', 'admin', 'ta'] as const;
export type ModuleRole = (typeof MODULE_ROLES)[number];
export const ROLE_NAMES: Record<PlatformRole | ModuleRole, string> = {
  super_admin: 'Super admin', doctor: 'Doctor', ta: 'TA', student: 'Student', leader: 'Module leader', admin: 'Module admin',
};

export const PERMISSIONS = {
  'platform.roles': { label: 'Manage roles & permissions', scope: 'platform', fixed: true },
  'accounts.staff': { label: 'Create teaching-staff accounts', scope: 'platform' },
  'accounts.manage': { label: 'Disable, reset and delete accounts', scope: 'platform' },
  'platform.settings': { label: 'Years, specializations, course audience', scope: 'platform' },
  'modules.create': { label: 'Create modules', scope: 'platform' },
  'cms.edit': { label: 'Edit course content (CMS)', scope: 'platform' },
  'module.build': { label: 'Build the module and its labs', scope: 'module' },
  'module.assessment': { label: 'Set the assessment', scope: 'module' },
  'module.invite': { label: 'Invite staff and create accounts for the module', scope: 'module' },
  'module.sessions': { label: 'Run lab sessions and attendance', scope: 'module' },
  'module.progress': { label: 'View student progress', scope: 'module' },
  'module.submissions': { label: 'Manage project submissions', scope: 'module' },
} as const;
export type Permission = keyof typeof PERMISSIONS;
export const PERMISSION_KEYS = Object.keys(PERMISSIONS) as Permission[];

/** Which permissions each role grants (super_admin always has everything and is not stored). */
export type StoredMatrix = { platform: Record<'doctor' | 'ta' | 'student', Permission[]>; module: Record<ModuleRole, Permission[]> };
export const MATRIX_ROLES = [
  { kind: 'platform', key: 'doctor' }, { kind: 'platform', key: 'ta' }, { kind: 'platform', key: 'student' },
  { kind: 'module', key: 'leader' }, { kind: 'module', key: 'admin' }, { kind: 'module', key: 'ta' },
] as const;

export const DEFAULT_STORED: StoredMatrix = {
  platform: {
    doctor: ['modules.create', 'cms.edit', 'module.sessions', 'module.progress', 'module.submissions'],
    ta: ['module.sessions', 'module.progress', 'module.submissions'],
    student: [],
  },
  module: {
    leader: ['module.build', 'module.assessment', 'module.invite', 'module.sessions', 'module.progress', 'module.submissions'],
    admin: ['module.build', 'module.sessions', 'module.progress', 'module.submissions'],
    ta: ['module.sessions', 'module.progress'],
  },
};

/** Validates a matrix from the editor: known permissions only; platform-scope permissions can't be given to module roles; fixed ones stay super-admin-only. */
export function parseMatrix(input: unknown): StoredMatrix | null {
  const o = (input && typeof input === 'object' ? input : {}) as { platform?: Record<string, unknown>; module?: Record<string, unknown> };
  const clean = (v: unknown, scope: 'any' | 'module') =>
    (Array.isArray(v) ? v : []).map(String).filter((p): p is Permission =>
      (PERMISSION_KEYS as string[]).includes(p) && !('fixed' in PERMISSIONS[p as Permission]) && (scope === 'any' || PERMISSIONS[p as Permission].scope === 'module'));
  if (!o.platform || !o.module) return null;
  return {
    platform: { doctor: clean(o.platform.doctor, 'any'), ta: clean(o.platform.ta, 'any'), student: clean(o.platform.student, 'any') },
    module: { leader: clean(o.module.leader, 'module'), admin: clean(o.module.admin, 'module'), ta: clean(o.module.ta, 'module') },
  };
}

export type Who = { platformRole: PlatformRole | null; master: boolean; modules: Record<string, ModuleRole> };

/** Does this person have `perm` (for `module`, when it's module-scoped)? */
export function permitted(m: StoredMatrix, who: Who, perm: Permission, module?: string): boolean {
  if (who.master || who.platformRole === 'super_admin') return true;
  if ('fixed' in PERMISSIONS[perm]) return false;
  const role = who.platformRole;
  if (role && role !== 'super_admin' && m.platform[role]?.includes(perm)) return true;
  if (PERMISSIONS[perm].scope !== 'module') return false;
  if (module) {
    const mr = who.modules[module];
    return Boolean(mr && m.module[mr]?.includes(perm));
  }
  // "any module": e.g. may this person see the builder at all
  return Object.values(who.modules).some((mr) => m.module[mr]?.includes(perm));
}

/** Modules where the person has `perm` through a module role. */
export const modulesWith = (m: StoredMatrix, who: Who, perm: Permission) =>
  Object.entries(who.modules).filter(([, r]) => m.module[r]?.includes(perm)).map(([mod]) => mod);

