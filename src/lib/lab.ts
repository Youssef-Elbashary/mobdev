/**
 * Reads a lab's outline straight from its MDX source:
 *   <Part n="1" title="Meet the course" time="10 min" />
 *   <Task n="1.1" title="Your teaching team" time="2 min">
 * Used for the lab tracker, the header part strip and search.
 */
export type LabTask = { n: string; title: string; time?: string; id: string };
export type LabPart = { n: string; title: string; time?: string; id: string; tasks: LabTask[] };

const attr = (src: string, name: string) => src.match(new RegExp(`\\b${name}="([^"]*)"`))?.[1];

export function parseLabOutline(body = ''): LabPart[] {
  const parts: LabPart[] = [];
  const re = /<(Part|Task)\b([^>]*)>/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(body))) {
    const [, kind, attrs] = m;
    const n = attr(attrs, 'n') ?? '';
    const title = attr(attrs, 'title') ?? '';
    const time = attr(attrs, 'time');
    if (kind === 'Part') parts.push({ n, title, time, id: `part-${n}`, tasks: [] });
    else {
      if (!parts.length) parts.push({ n: '0', title: 'Tasks', id: 'part-0', tasks: [] });
      parts[parts.length - 1].tasks.push({ n, title, time, id: `task-${n.replace(/\./g, '-')}` });
    }
  }
  return parts;
}

/** "10 min" + "4 min" … → total minutes */
export const minutes = (t?: string) => Number(t?.match(/\d+/)?.[0] ?? 0);
