/** Data for onboarding and "my modules": platform settings + every visible module with its audience. */
import { getLabs } from '@/lib/content';
import { BUILT_IN_AUDIENCE, DEFAULT_SETTINGS } from './core';
import { getAccountStore } from './server';
import { moduleCards } from '@/lib/platform/server';

export async function hubData() {
  const store = getAccountStore();
  const settings = store
    ? await store.getSettings().catch(() => ({ ...DEFAULT_SETTINGS, builtIn: BUILT_IN_AUDIENCE }))
    : { ...DEFAULT_SETTINGS, builtIn: BUILT_IN_AUDIENCE };
  const cards = await moduleCards(settings.builtIn, (await getLabs()).length, settings.categories);
  // Students may choose only open electives themselves (Mobile Development by default); every other module
  // needs an invitation or enrolment by its staff.
  return { settings, cards, optional: cards.filter((c) => c.kind === 'elective' && c.open).map((c) => c.slug) };
}
