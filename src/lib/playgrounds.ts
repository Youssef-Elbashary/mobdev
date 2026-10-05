/** Exercise / demo definitions live in src/playgrounds/<lab>/<id>.ts and are looked up by id. */
import type { Check, Files } from '@/runner/protocol';

export type Playground = { title: string; goal?: string; hint?: string; files: Files; solution?: Files; checks?: Check[] };
export type Walkthrough = Playground & { tree: { file: string; note: string; href?: string }[] };

const mods = import.meta.glob<{ default: Playground }>('/src/playgrounds/**/*.ts', { eager: true });

export function getPlayground<T extends Playground = Playground>(id: string): T & { checks: Check[] } {
  const hit = Object.entries(mods).find(([path]) => path.endsWith(`/${id}.ts`));
  if (!hit) throw new Error(`Playground "${id}" not found in src/playgrounds/`);
  const def = hit[1].default as T;
  return { ...def, checks: def.checks ?? [] };
}
