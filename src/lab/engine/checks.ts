/**
 * Exercise checking. A check is either `static` (reads the code's syntax tree) or `run`
 * (uses the running app: press, type, read the screen). Each failing check carries a
 * teaching message, so feedback says *what* to fix — never just "wrong".
 */
import type { Frame, LabErrorInfo, PreviewDriver } from '../runtime/protocol.ts';
import { compileAll } from './compile.ts';
import { parseCode, undefinedComponents, unimportedHooks, type Parsed } from './analyze.ts';

export type Files = Record<string, string>;

export type CheckContext = {
  files: Files;
  /** parsed file by path; defaults to the exercise's entry file */
  file(path?: string): Parsed;
  /** every parsed file */
  all: Parsed[];
};
export type RunContext = CheckContext & { app: PreviewDriver };

/** true = pass · false = fail with the check's own message · string = fail with this message */
export type Verdict = boolean | string;

export type Check = {
  id: string;
  /** checklist label, e.g. "uses useState" */
  label: string;
  /** teaching message when it fails */
  fail: string;
  static?: (c: CheckContext) => Verdict;
  run?: (c: RunContext) => Promise<Verdict>;
};

export type CheckResult = { id: string; label: string; pass: boolean; message?: string };
export type Status = 'pass' | 'partial' | 'fail';
export type Blocker = { message: string; hint?: string; file?: string; line?: number };
export type Outcome = { status: Status; score: number; results: CheckResult[]; blocker?: Blocker };

/** Runs the student's app. LabPreview in the browser; a happy-dom harness in tests. */
export interface AppRunner {
  run(files: Files, entry: string, frame: Frame): Promise<{ ok: boolean; error?: LabErrorInfo }>;
  driver: PreviewDriver;
}

export type Diagnostic = { file: string; line: number; column: number; message: string; severity: 'error' | 'warning' };

/** Editor diagnostics: syntax errors, plus components/hooks used without importing them. */
export function lintFiles(files: Files): Diagnostic[] {
  const out: Diagnostic[] = [];
  const compiled = compileAll(files);
  if (!compiled.ok) {
    for (const e of compiled.errors) out.push({ file: e.file, line: e.line, column: e.column, message: e.message, severity: 'error' });
    return out;
  }
  for (const [file, code] of Object.entries(files)) {
    if (!isCode(file)) continue;
    const p = parseCode(code);
    for (const u of undefinedComponents(p)) {
      out.push({ file, line: u.line, column: 1, severity: 'error', message: `<${u.name}> is used but never imported or declared. ${/^(View|Text|Image|TextInput|Pressable|ScrollView|FlatList|SafeAreaView|Button|Switch)$/.test(u.name) ? `Add it to: import { … } from 'react-native';` : `Import or create the ${u.name} component.`}` });
    }
    for (const h of unimportedHooks(p)) {
      out.push({ file, line: h.line, column: 1, severity: 'error', message: `${h.name} isn't imported. Add: import { ${h.name} } from 'react';` });
    }
  }
  return out;
}

export const isCode = (path: string) => /\.(tsx?|jsx?)$/.test(path);

function makeContext(files: Files, entry: string): CheckContext {
  const parsed: Record<string, Parsed> = {};
  for (const [path, code] of Object.entries(files)) if (isCode(path)) parsed[path] = parseCode(code);
  return {
    files,
    file: (path = entry) => parsed[path] ?? parseCode(''),
    all: Object.values(parsed),
  };
}

function settle(verdict: Verdict, check: Check): CheckResult {
  if (verdict === true) return { id: check.id, label: check.label, pass: true };
  return { id: check.id, label: check.label, pass: false, message: typeof verdict === 'string' ? verdict : check.fail };
}

export function scoreOf(results: CheckResult[]): { status: Status; score: number } {
  const passed = results.filter((r) => r.pass).length;
  const score = results.length ? passed / results.length : 0;
  return { status: passed === results.length && results.length > 0 ? 'pass' : passed > 0 ? 'partial' : 'fail', score };
}

export async function evaluate(exercise: { checks: Check[]; entry: string; frame: Frame }, files: Files, runner: AppRunner): Promise<Outcome> {
  const { checks, entry, frame } = exercise;

  const compiled = compileAll(files);
  if (!compiled.ok) {
    const e = compiled.errors[0];
    return {
      status: 'fail',
      score: 0,
      results: checks.map((c) => ({ id: c.id, label: c.label, pass: false })),
      blocker: { message: `Syntax error: ${e.message}`, hint: 'Fix the line underlined in red, then check again.', file: e.file, line: e.line },
    };
  }

  const ctx = makeContext(files, entry);
  const results: CheckResult[] = [];
  let blocker: Blocker | undefined;

  for (const check of checks) {
    if (!check.static) continue;
    let verdict: Verdict;
    try {
      verdict = check.static(ctx);
    } catch (error) {
      console.error(`[lab] static check ${check.id} crashed`, error);
      verdict = false;
    }
    results.push(settle(verdict, check));
  }

  const runChecks = checks.filter((c) => c.run && !c.static);
  if (runChecks.length) {
    const lint = lintFiles(files).find((d) => d.severity === 'error');
    const started = await runner.run(compiled.files, entry, frame);
    const problem = !started.ok ? started.error : lint ? { message: lint.message, file: lint.file, line: lint.line } : undefined;
    if (problem) {
      blocker = { message: problem.message, hint: 'hint' in problem ? problem.hint : undefined, file: problem.file, line: problem.line };
      for (const check of runChecks) results.push({ id: check.id, label: check.label, pass: false, message: `Your app shows an error, so this couldn't be tested yet: ${problem.message}` });
    } else {
      let first = true;
      for (const check of runChecks) {
        if (!first) await runner.driver.rerun();
        first = false;
        let verdict: Verdict;
        try {
          verdict = await check.run!({ ...ctx, app: runner.driver });
        } catch (error) {
          console.error(`[lab] run check ${check.id} crashed`, error);
          verdict = false;
        }
        results.push(settle(verdict, check));
      }
    }
  }

  // keep the checklist in the exercise's order
  const order = new Map(checks.map((c, i) => [c.id, i]));
  results.sort((a, b) => order.get(a.id)! - order.get(b.id)!);
  return { ...scoreOf(results), results, ...(blocker ? { blocker } : null) };
}
