/** Messages between a playground on the lab page (parent) and the sandboxed runner iframe. */
export type Files = Record<string, string>;

/** One action or assertion a check performs on the running app, like a student would. */
export type Step =
  | { press: string } // tap the element showing this text (or with this testID)
  | { type: string; into: string } // type into the input with this placeholder (or testID)
  | { expectText: string; exact?: boolean } // exact: some element's whole text equals it
  | { expectNoText: string; exact?: boolean }
  | { expectFocused: string } // input (placeholder or testID) has keyboard focus
  | { expectStyle: { text: string; prop: string; includes: string } } // computed CSS, e.g. text-decoration-line
  | { expectCode: string; flags?: string; message: string } // regex over the student's source
  | { wait: number };
export type Check = { name: string; steps: Step[] };
export type CheckResult = { name: string; pass: boolean; detail?: string };

export type ToRunner =
  | { type: 'run'; files: Files }
  | { type: 'check'; files: Files; checks: Check[] }
  | { type: 'navigate'; href: string };

export type FromRunner =
  | { type: 'ready' }
  | { type: 'rendered' }
  | { type: 'console'; level: 'log' | 'info' | 'warn' | 'error'; text: string }
  | { type: 'error'; message: string }
  | { type: 'route'; href: string }
  | { type: 'check-result'; results: CheckResult[] };
