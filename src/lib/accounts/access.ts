/**
 * What the current visitor may do: their platform role, their module roles (module staff table, plus any
 * builder module naming their email as module leader) and the super admin's permission matrix.
 * One database round trip per call; use it in admin pages and APIs that need fine-grained checks.
 */
import type { AstroCookies } from 'astro';
import { masterAdmin } from '@/lib/attendance/server';
import { compileModule } from '@/lib/platform/core';
import { getPlatformStore } from '@/lib/platform/server';
import { DEFAULT_STORED, permitted, type ModuleRole, type Permission, type Who } from './permissions';
import { getAccountStore, viewer } from './server';

export async function access(cookies: AstroCookies) {
  const master = masterAdmin(cookies);
  const store = getAccountStore();
  const claims = viewer(cookies);
  const found = claims && store ? await store.byId(claims.u).catch(() => null) : null;
  const user = found?.active ? found : null;
  const modules: Record<string, ModuleRole> = user && store ? await store.staffFor(user.email).catch(() => ({})) : {};
  if (user) {
    const builder = (await getPlatformStore()?.listModules().catch(() => [])) ?? [];
    for (const m of builder) if ((compileModule(m.flow).meta.leader ?? '').trim().toLowerCase() === user.email) modules[m.slug] = 'leader';
  }
  const matrix = store ? await store.getMatrix().catch(() => DEFAULT_STORED) : DEFAULT_STORED;
  const who: Who = { platformRole: user?.role ?? null, master, modules };
  return {
    user, who, matrix, master,
    /** display name for audit fields */
    by: user?.name ?? (master ? 'Admin password' : ''),
    can: (perm: Permission, module?: string) => permitted(matrix, who, perm, module),
  };
}
export type Access = Awaited<ReturnType<typeof access>>;
