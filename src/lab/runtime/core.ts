/**
 * The preview runtime: loads the student's compiled files, renders the app, reports errors
 * and answers check requests. Runs inside the sandboxed iframe (entry.ts) and in Node tests.
 */
import { Component, createElement, type ReactNode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import * as RN from './rn-shim.ts';
import { createBuiltins } from './builtins.ts';
import { createModuleSystem, LabError, locate } from './modules.ts';
import { createDomDriver } from './driver-dom.ts';
import type { FromRuntime, LabErrorInfo, LogLevel, RunRequest } from './protocol.ts';

type Outgoing = FromRuntime extends infer M ? (M extends { __lab: 1 } ? Omit<M, '__lab'> : never) : never;
export type Post = (message: Outgoing) => void;

const PHONE_INSETS = { top: 44, bottom: 20, left: 0, right: 0 };
const NO_INSETS = { top: 0, bottom: 0, left: 0, right: 0 };

/** Turns common JavaScript/React errors into one sentence a beginner can act on. */
export function friendlyHint(message: string): string | undefined {
  let m: RegExpExecArray | null;
  if ((m = /^(\w+) is not defined/.exec(message))) {
    const name = m[1];
    if (/^use[A-Z]/.test(name)) return `Import the hook first: import { ${name} } from 'react';`;
    if (/^[A-Z]/.test(name)) return `Did you import ${name}? e.g. import { ${name} } from 'react-native';`;
    return `${name} isn't declared — check the spelling, or create it with const.`;
  }
  if (/Element type is invalid/.test(message)) return 'One of your components is undefined — usually a missing or misspelled import, or a missing export default.';
  if (/Objects are not valid as a React child/.test(message)) return 'You tried to show a whole object. Show one of its fields instead, e.g. {user.name}.';
  if (/Too many re-renders|Maximum update depth/.test(message)) return 'State is set while rendering (or in an effect with no dependency array), so it loops forever. Set state inside an event such as onPress, or give useEffect a dependency array.';
  if (/is not a function/.test(message)) return 'You called something that is not a function — check the name, and pass a function (not its result) to props like onPress.';
  if (/Cannot read propert(y|ies) of (undefined|null)/.test(message)) return 'You read a field of something that is undefined — check the prop or variable name.';
  return undefined;
}

export function describeError(error: unknown): LabErrorInfo {
  const e = error instanceof Error ? error : new Error(String(error));
  const where = locate(e);
  const hint = (e as Error & { hint?: string }).hint ?? friendlyHint(e.message);
  return { message: e.message, ...(hint ? { hint } : null), ...(where ?? null) };
}

function pickComponent(exports: Record<string, unknown>): unknown {
  const isComponent = (v: unknown) => typeof v === 'function' || (typeof v === 'object' && v !== null && '$$typeof' in v);
  if (isComponent(exports.default)) return exports.default;
  if (isComponent(exports.App)) return exports.App;
  return Object.entries(exports).find(([k, v]) => /^[A-Z]/.test(k) && isComponent(v))?.[1];
}

function ErrorScreen({ info }: { info: LabErrorInfo }) {
  const where = info.file ? `${info.file}${info.line ? ` · line ${info.line}` : ''}` : '';
  return createElement(
    'div',
    { className: 'lab-redbox', role: 'alert' },
    createElement('b', null, 'Error'),
    createElement('p', null, info.message),
    info.hint ? createElement('p', { className: 'lab-redbox-hint' }, info.hint) : null,
    where ? createElement('small', null, where) : null,
  );
}

export function createRuntime(opts: { container: HTMLElement; post: Post; onFrame?: (frame: RunRequest['frame']) => void }) {
  const { container, post } = opts;
  let root: Root | null = null;
  let last: RunRequest | null = null;
  let current = 0;
  let errored = false;
  const logs: string[] = [];

  function report(error: unknown, id: number | undefined = current) {
    errored = true;
    const info = describeError(error);
    post({ type: 'error', id, error: info });
    return info;
  }

  class Boundary extends Component<{ children?: ReactNode }, { info: LabErrorInfo | null }> {
    state = { info: null as LabErrorInfo | null };
    static getDerivedStateFromError(error: unknown) {
      return { info: describeError(error) };
    }
    componentDidCatch(error: unknown) {
      report(error);
    }
    render() {
      return this.state.info ? createElement(ErrorScreen, { info: this.state.info }) : this.props.children;
    }
  }

  function unmount() {
    try {
      root?.unmount();
    } catch {
      /* already gone */
    }
    root = null;
    container.innerHTML = '';
  }

  function mount(node: ReactNode) {
    unmount();
    root = createRoot(container, {
      onCaughtError: () => {}, // the Boundary reports it
      onUncaughtError: (error: unknown) => report(error),
      onRecoverableError: () => {},
    });
    root.render(createElement(Boundary, null, node));
  }

  function run(request: RunRequest): Promise<void> {
    last = request;
    current = request.id;
    errored = false;
    logs.length = 0;
    unmount();
    RN.resetClassWarnings();
    RN.setInsets(request.frame === 'phone' ? PHONE_INSETS : NO_INSETS);
    opts.onFrame?.(request.frame);

    let renderedByCode = false;
    let modules: ReturnType<typeof createModuleSystem> | null = null;
    const builtins = createBuiltins({
      requireFile: (spec) => modules?.requireFile(spec) ?? null,
      createRoot: () => ({
        render(node) {
          renderedByCode = true;
          mount(node as ReactNode);
        },
        unmount,
      }),
    });
    modules = createModuleSystem(builtins, request.files);

    try {
      const exports = modules.load(request.entry);
      if (!renderedByCode) {
        const App = pickComponent(exports);
        if (!App) throw new LabError('Nothing to show yet.', 'Export your component: export default function App() { … }');
        mount(createElement(App as never));
      }
    } catch (error) {
      const info = report(error, request.id);
      mount(createElement(ErrorScreen, { info }));
      return Promise.resolve();
    }
    return new Promise((resolve) =>
      setTimeout(() => {
        if (!errored) post({ type: 'rendered', id: request.id });
        resolve();
      }, 40),
    );
  }

  const driver = createDomDriver(() => container);

  async function rpc(method: string, args: unknown[]): Promise<unknown> {
    switch (method) {
      case 'text':
        return driver.text();
      case 'find':
        return driver.find(args[0] as never);
      case 'count':
        return driver.count(args[0] as never);
      case 'press':
        return driver.press(args[0] as never);
      case 'type':
        return driver.type(args[0] as never, String(args[1] ?? ''));
      case 'wait':
        return driver.wait(Number(args[0]) || 0);
      case 'logs':
        return [...logs];
      case 'rerun':
        if (last) await run({ ...last, id: last.id });
        return null;
      default:
        throw new Error(`Unknown preview method: ${method}`);
    }
  }

  function log(level: LogLevel, args: unknown[]) {
    const text = args
      .map((a) => {
        if (typeof a === 'string') return a;
        if (a instanceof Error) return a.message;
        try {
          return JSON.stringify(a);
        } catch {
          return String(a);
        }
      })
      .join(' ');
    logs.push(text);
    if (logs.length > 200) logs.shift();
    post({ type: 'log', level, text });
  }

  return { run, rpc, log, report, unmount, driver };
}
