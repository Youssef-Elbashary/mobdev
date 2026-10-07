/**
 * Which module a lab belongs to, so lab dashboards follow the permission matrix: builder labs carry their
 * module in their id ("<module>--<lab>"); the file-based labs (lab-01, lab-02…) are the built-in course's.
 */
import { splitLabKey } from '@/lib/platform/core';
import { access, type Access } from './access';
import type { Permission } from './permissions';

const BUILT_IN = 'mobile-development';
export const labModule = (lab: string) => splitLabKey(lab)?.module ?? BUILT_IN;

/** May this person use `perm` on this lab (through its module)? */
export const canOnLab = (a: Access, perm: Permission, lab: string) => a.can(perm, labModule(lab));

/** Lab dashboards (attendance, sessions, progress): either permission opens a lab; actions check their own. */
export const canSeeLab = (a: Access, lab: string) => canOnLab(a, 'module.progress', lab) || canOnLab(a, 'module.sessions', lab);

/** Project submissions belong to the built-in course: `module.submissions` on it. */
export async function canManageSubmissions(cookies: Parameters<typeof access>[0]) {
  return (await access(cookies)).can('module.submissions', BUILT_IN);
}
