export type LabForMarking = {
  number: number;
  title: string;
  skills: string[];
  objectives: string[];
};

export type MarkingCriterion = { criterion: string; weight: number; detail: string };

const AREAS = [
  {
    criterion: 'Mobile app foundations & delivery',
    pattern: /react native|expo|typescript|npm|npx|tool|setup|run|mobile app/i,
  },
  {
    criterion: 'Interface, components & styling',
    pattern: /jsx|component|prop|screen|view|text|image|input|pressable|flatlist|ui|style|nativewind|flexbox/i,
  },
  {
    criterion: 'State, data flow & interactivity',
    pattern: /state|hook|useeffect|useref|usememo|context|condition|list|data|interactive/i,
  },
  {
    criterion: 'Navigation & application structure',
    pattern: /router|route|navigation|stack|tab|page|structure|architecture|multi-page/i,
  },
  {
    criterion: 'Version control & team workflow',
    pattern: /git|github|branch|merge|commit|repository|repo|team|collaborat/i,
  },
] as const;

/** Distribute an integer total proportionally using largest remainders, with at least one mark per area. */
function allocate(total: number, scores: number[]): number[] {
  const base = scores.map(() => 1);
  const remaining = total - base.length;
  const sum = scores.reduce((a, b) => a + b, 0);
  const exact = scores.map((score) => (score / sum) * remaining);
  const out = exact.map((n, i) => base[i] + Math.floor(n));
  let left = total - out.reduce((a, b) => a + b, 0);
  const order = exact.map((n, i) => ({ i, remainder: n - Math.floor(n) })).sort((a, b) => b.remainder - a.remainder || a.i - b.i);
  for (let i = 0; i < left; i++) out[order[i].i]++;
  return out;
}

/**
 * Builds guidance from the published lab curriculum rather than a hand-written rubric.
 * Only areas evidenced by lab skills/objectives appear and the result always totals 60 module marks.
 */
export function generateExpectedMarkingScheme(labs: LabForMarking[], total = 60): MarkingCriterion[] {
  const evidence = labs.flatMap((lab) => [...lab.skills, ...lab.objectives].map((text) => ({ lab: lab.number, text })));
  const matched = AREAS.map((area) => {
    const hits = evidence.filter(({ text }) => area.pattern.test(text));
    return { ...area, hits };
  }).filter((area) => area.hits.length > 0);

  if (!matched.length) {
    return [{ criterion: 'Application of taught lab outcomes', weight: total, detail: 'Demonstrate the skills and objectives covered by the published module labs.' }];
  }

  const weights = allocate(total, matched.map((area) => area.hits.length));
  return matched.map((area, index) => {
    const labsUsed = [...new Set(area.hits.map((hit) => hit.lab))].sort((a, b) => a - b).map((n) => `Lab ${String(n).padStart(2, '0')}`).join(', ');
    const topics = [...new Set(area.hits.map((hit) => hit.text.replace(/[*`]/g, '')))].slice(0, 3).join('; ');
    return {
      criterion: area.criterion,
      weight: weights[index],
      detail: `${labsUsed}: ${topics}`,
    };
  });
}
