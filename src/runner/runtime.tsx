/**
 * Runs inside the sandboxed iframe (public/runner/index.html).
 * Development React on purpose: students get readable errors and warnings (e.g. a missing `key`).
 */
import * as React from 'react';
import * as jsxRuntime from 'react/jsx-runtime';
import { createRoot, type Root } from 'react-dom/client';
import * as ReactNative from 'react-native-web';
import * as ExpoRouter from './router-shim.tsx';
import { createModuleSystem } from './modules.ts';
import { runCheck } from './checks.ts';
import type { CheckResult, Files, FromRunner, ToRunner } from './protocol.ts';

const post = (msg: FromRunner) => parent.postMessage(msg, '*');
const host = document.getElementById('root')!;
const redbox = document.getElementById('redbox')!;
const settle = (ms = 80) => new Promise<void>((r) => setTimeout(r, ms));

const builtins: Record<string, unknown> = {
  react: React,
  'react/jsx-runtime': jsxRuntime,
  'react-native': ReactNative,
  'react-native-web': ReactNative,
  'expo-router': ExpoRouter,
  'expo-status-bar': { StatusBar: () => null },
};

/* ---------- console → page ---------- */
const show = (v: unknown): string => {
  if (typeof v === 'string') return v;
  if (v instanceof Error) return v.message;
  try {
    return JSON.stringify(v) ?? String(v);
  } catch {
    return String(v);
  }
};
function format(args: unknown[]) {
  const rest = [...args];
  let first = rest.shift();
  if (typeof first === 'string') first = first.replace(/%[sdifoOc]/g, () => show(rest.shift()));
  return [first, ...rest].map(show).join(' ').slice(0, 800);
}
for (const level of ['log', 'info', 'warn', 'error'] as const) {
  const orig = console[level].bind(console);
  console[level] = (...args: unknown[]) => {
    orig(...args);
    const text = format(args);
    if (!/React DevTools/.test(text)) post({ type: 'console', level, text });
  };
}

/* ---------- red error screen, like React Native's ---------- */
let lastError: string | null = null;
function showError(e: unknown) {
  const message = e instanceof Error ? e.message : String(e);
  if (lastError === message) return;
  lastError = message;
  redbox.hidden = false;
  redbox.querySelector('pre')!.textContent = message;
  post({ type: 'error', message });
}
window.addEventListener('error', (e) => showError(e.error ?? e.message));
window.addEventListener('unhandledrejection', (e) => showError(e.reason));

/* ---------- mount ---------- */
let root: Root | null = null;
async function mount(files: Files) {
  root?.unmount();
  lastError = null;
  redbox.hidden = true;
  root = createRoot(host, { onUncaughtError: showError, onCaughtError: showError });
  try {
    const sys = createModuleSystem(files, builtins);
    const names = Object.keys(files);
    let App: React.ComponentType;
    if (names.some((f) => f.startsWith('app/'))) {
      App = ExpoRouter.createRouterApp(names, (f) => sys.require(f), (href) => post({ type: 'route', href }));
    } else {
      const entry = names.includes('App.tsx') ? 'App.tsx' : names[0];
      App = sys.require(entry).default;
      if (typeof App !== 'function') throw new Error(`${entry} must "export default" a component.`);
    }
    root.render(<ReactNative.View style={{ flex: 1 }}><App /></ReactNative.View>);
  } catch (e) {
    showError(e);
  }
  await settle(150);
  return host;
}

/* ---------- messages from the page ---------- */
window.addEventListener('message', async (e) => {
  if (e.source !== parent) return;
  const msg = e.data as ToRunner;
  if (msg.type === 'run') {
    await mount(msg.files);
    post({ type: 'rendered' });
  } else if (msg.type === 'navigate') {
    ExpoRouter.goTo(msg.href);
  } else if (msg.type === 'check') {
    const source = Object.values(msg.files).join('\n');
    const results: CheckResult[] = [];
    for (const check of msg.checks) {
      const el = await mount(msg.files);
      results.push(await runCheck(el, check, { source, settle: () => settle(), error: () => lastError }));
    }
    await mount(msg.files);
    post({ type: 'check-result', results });
  }
});
post({ type: 'ready' });
