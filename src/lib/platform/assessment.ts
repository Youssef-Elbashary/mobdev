/**
 * Who may set a module's assessment: whoever has the `module.assessment` permission for it — by default its
 * module leader (module staff role, or the leader email on the module node), the super admin and the master
 * admin password. Everyone else on the staff can only read it.
 */
import type { AstroCookies } from 'astro';
import { access } from '@/lib/accounts/access';
import { assessment as courseAssessment } from '@/site.config';
import type { AssessmentItem } from './core';
import { BUILT_IN_MODULE, getPlatformStore, leaderEmail } from './server';

export async function canSetAssessment(cookies: AstroCookies, module: string): Promise<{ ok: boolean; leader: string; by: string }> {
  const [leader, a] = await Promise.all([leaderEmail(module), access(cookies)]);
  return { ok: a.can('module.assessment', module), leader, by: a.by };
}

/** The assessment shown for a module: the leader's version, or (built-in course) the CMS default. */
export async function moduleAssessment(module: string): Promise<{ items: AssessmentItem[]; updated_by: string; updated_at: string | null }> {
  const saved = await getPlatformStore()?.getAssessment(module).catch(() => null);
  if (saved) return saved;
  if (module === BUILT_IN_MODULE.slug) return { items: courseAssessment.map((a) => ({ label: a.label, weight: a.weight, detail: a.sub ?? '' })), updated_by: '', updated_at: null };
  return { items: [], updated_by: '', updated_at: null };
}
