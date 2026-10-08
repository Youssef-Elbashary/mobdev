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

type AccessResult = {
  user: Awaited<ReturnType<NonNullable<ReturnType<typeof getAccountStore>>['byId']>>;
  who: Who;
  matrix: typeof DEFAULT_STORED;
  master: boolean;
  by: string;
  can: (perm: Permission, module?: string) => boolean;
};

// Astro passes the same cookies object to the page and its components. Reuse
// one permissions lookup within that request instead of making AdminShell run
// the same database queries again.
const perRequest = new WeakMap<AstroCookies, Promise<AccessResult>>();

async function loadAccess(cookies: AstroCookies): Promise<AccessResult> {
  const master = masterAdmin(cookies);
  const store = getAccountStore();
  const claims = viewer(cookies);
  const [found, matrix] = await Promise.all([
    claims && store ? store.byId(claims.u).catch(() => null) : null,
    store ? store.getMatrix().catch(() => DEFAULT_STORED) : DEFAULT_STORED,
  ]);
  const user = found?.active ? found : null;
  const [assigned, builder] = user
    ? await Promise.all([
        store ? store.staffFor(user.email).catch(() => ({})) : {},
        getPlatformStore()?.listModules().catch(() => []) ?? [],
      ])
    : [{}, []];
  const modules: Record<string, ModuleRole> = assigned;
  if (user) {
    for (const m of builder) if ((compileModule(m.flow).meta.leader ?? '').trim().toLowerCase() === user.email) modules[m.slug] = 'leader';
  }
  const who: Who = { platformRole: user?.role ?? null, master, modules };
  return {
    user, who, matrix, master,
    /** display name for audit fields */
    by: user?.name ?? (master ? 'Admin password' : ''),
    can: (perm: Permission, module?: string) => permitted(matrix, who, perm, module),
  };
}

export function access(cookies: AstroCookies): Promise<AccessResult> {
  let pending = perRequest.get(cookies);
  if (!pending) {
    pending = loadAccess(cookies);
    perRequest.set(cookies, pending);
  }
  return pending;
}
export type Access = AccessResult;
