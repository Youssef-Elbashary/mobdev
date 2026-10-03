/**
 * Grading for the non-code exercises (order, match, label, predict, flexbox).
 * Pure functions → the same Outcome shape as code checks, with a teaching message per mistake.
 */
import type { CheckResult, Outcome } from './checks.ts';
import { scoreOf } from './checks.ts';
import type { FlexExercise, FlexLayout, LabelExercise, MatchExercise, OrderExercise, PredictExercise } from '../exercises/types.ts';

const finish = (results: CheckResult[]): Outcome => ({ ...scoreOf(results), results });

/** `order` = the student's current sequence of item texts. */
export function gradeOrder(ex: OrderExercise, order: string[]): Outcome {
  const results = ex.items.map((item, i) => ({
    id: `pos${i + 1}`,
    label: `step ${i + 1}`,
    pass: order[i] === item,
    message: order[i] === item ? undefined : `Step ${i + 1} isn’t in the right place yet.`,
  }));
  const firstWrong = results.findIndex((r) => !r.pass);
  if (firstWrong > 0) results[firstWrong].message = `Steps 1–${firstWrong} are right. Step ${firstWrong + 1} isn’t yet.`;
  if (firstWrong === 0) results[0].message = 'The first step isn’t right yet.';
  return finish(results);
}

/** `placed` maps a target text → the chip dropped on it. */
export function gradeMatch(ex: MatchExercise, placed: Record<string, string | undefined>): Outcome {
  const decoys = new Map((ex.decoys ?? []).map((d) => [d.chip, d.why]));
  const owner = new Map(ex.pairs.map((p) => [p.chip, p.target]));
  return finish(
    ex.pairs.map((pair, i) => {
      const chip = placed[pair.target];
      const pass = chip === pair.chip;
      let message: string | undefined;
      if (!pass) {
        if (!chip) message = `“${pair.target}” is still empty.`;
        else if (decoys.has(chip)) message = `\`${chip}\` isn’t a real class — ${decoys.get(chip)}`;
        else if (owner.has(chip)) message = `\`${chip}\` doesn’t do “${pair.target}”.`;
        else message = `\`${chip}\` doesn’t belong there.`;
      }
      return { id: `pair${i + 1}`, label: pair.target, pass, message };
    }),
  );
}

/** `placed` maps a zone id → the chip dropped on it. */
export function gradeLabel(ex: LabelExercise, placed: Record<string, string | undefined>): Outcome {
  return finish(
    ex.zones.map((zone) => {
      const chip = placed[zone.id];
      const pass = chip === zone.answer;
      return {
        id: zone.id,
        label: zone.label,
        pass,
        message: pass ? undefined : chip ? `“${chip}” isn’t the best name for the ${zone.label}. ${zone.why}` : `The ${zone.label} has no name yet.`,
      };
    }),
  );
}

/** `answers[i]` = index of the option picked for question i (or -1). */
export function gradePredict(ex: PredictExercise, answers: number[]): Outcome {
  return finish(
    ex.questions.map((q, i) => {
      const picked = q.options[answers[i]];
      const pass = !!picked?.correct;
      return { id: `q${i + 1}`, label: `question ${i + 1}`, pass, message: pass ? picked.why : picked ? `Not quite: ${picked.why}` : `Pick an answer for question ${i + 1}.` };
    }),
  );
}

const PROP_NAMES: Record<keyof FlexLayout, string> = { flexDirection: 'flexDirection', justifyContent: 'justifyContent', alignItems: 'alignItems' };

/** One flexbox round: which properties still differ from the target? */
export function gradeFlexRound(ex: FlexExercise, round: number, layout: FlexLayout): { pass: boolean; message?: string } {
  const target = ex.rounds[round];
  const wrong = (Object.keys(target) as (keyof FlexLayout)[]).filter((k) => target[k] !== layout[k]);
  if (!wrong.length) return { pass: true };
  if (wrong.includes('flexDirection')) return { pass: false, message: 'Look at the outlines: are the boxes stacked (column) or side by side (row)?' };
  return { pass: false, message: `Close! Now adjust \`${PROP_NAMES[wrong[0]]}\`.` };
}

/** Whole flex exercise: one result per round. */
export function gradeFlex(ex: FlexExercise, layouts: FlexLayout[]): Outcome {
  return finish(
    ex.rounds.map((_, i) => {
      const r = layouts[i] ? gradeFlexRound(ex, i, layouts[i]) : { pass: false, message: `Round ${i + 1} isn’t done yet.` };
      return { id: `round${i + 1}`, label: `round ${i + 1}`, pass: r.pass, message: r.message };
    }),
  );
}
