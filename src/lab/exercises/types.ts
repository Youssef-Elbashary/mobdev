/**
 * Exercise definitions for interactive labs. Text fields accept a tiny markdown:
 * `code`, **bold**, and line breaks.
 */
import type { Check } from '../engine/checks.ts';
import type { Frame } from '../runtime/protocol.ts';

type Base = {
  /** stable id used for progress tracking, e.g. 'ex05' */
  id: string;
  /** 1-based number shown to students */
  n: number;
  title: string;
  minutes: number;
  /** difficulty level from the lab's 1–10 progression */
  level?: number;
  /** what to do, in one or two short sentences */
  prompt: string;
  /** unlocked one at a time; never the full answer */
  hints: string[];
  /** shown when solved: why it works */
  success: string;
  /** optional extra mini-challenge after solving */
  challenge?: string;
};

export type CodeExercise = Base & {
  kind: 'code' | 'fix';
  frame: Frame;
  /** file that is rendered (its default export) */
  entry: string;
  /** starter files: path → code. The first file opens first. */
  files: Record<string, string>;
  checks: Check[];
  /** optional picture of the goal (small HTML mock drawn next to the task) */
  target?: { html: string; caption: string };
};

export type OrderExercise = Base & {
  kind: 'order';
  /** the items in the CORRECT order (shown shuffled) */
  items: string[];
  /** render items as code */
  mono?: boolean;
};

export type MatchExercise = Base & {
  kind: 'match';
  /** each chip belongs on one target */
  pairs: { chip: string; target: string; why: string }[];
  /** wrong chips, each with the reason it's wrong */
  decoys?: { chip: string; why: string }[];
  mono?: boolean;
};

export type LabelZone = { id: string; answer: string; label: string; why: string };
export type LabelExercise = Base & {
  kind: 'label';
  /** which mock screen to draw */
  screen: 'shop';
  zones: LabelZone[];
  chips: string[];
};

export type PredictQuestion = { code: string; question: string; options: { text: string; correct?: boolean; why: string }[] };
export type PredictExercise = Base & { kind: 'predict'; questions: PredictQuestion[] };

export type FlexLayout = { flexDirection: 'column' | 'row'; justifyContent: string; alignItems: string };
export type FlexExercise = Base & { kind: 'flex'; rounds: FlexLayout[] };

export type Exercise = CodeExercise | OrderExercise | MatchExercise | LabelExercise | PredictExercise | FlexExercise;

export type Demo = {
  id: string;
  title: string;
  frame: Frame;
  entry: string;
  files: Record<string, string>;
  /** files shown read-only (e.g. index.html) */
  readOnly?: string[];
  /** "Try this" suggestions for the live demo */
  tryThis?: string[];
};
