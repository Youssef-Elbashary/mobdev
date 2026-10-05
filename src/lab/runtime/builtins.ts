/**
 * Packages student code can import in the lab preview. Anything else gets a friendly
 * "isn't available in this lab" error from the module system.
 */
import React, { createElement } from 'react';
import * as jsxRuntime from 'react/jsx-runtime';
import * as RN from './rn-shim.ts';

type AnyProps = Record<string, any>;

export type BuiltinContext = {
  /** load a student file by root-relative path, e.g. 'app/index' (used by the expo-router stand-in) */
  requireFile: (spec: string) => Record<string, unknown> | null;
  /** react-dom/client createRoot stand-in, so a real `main.tsx` can render <App /> */
  createRoot: (element: unknown) => { render(node: unknown): void; unmount(): void };
};

export function createBuiltins(ctx: BuiltinContext): Record<string, unknown> {
  // expo-router: the root layout renders the current screen (always app/index in the lab).
  function Slot() {
    const screen = ctx.requireFile('app/index') as { default?: React.ComponentType } | null;
    return screen?.default ? createElement(screen.default) : createElement(RN.Text, null, 'Create app/index.tsx to show your first screen.');
  }
  const Stack = Object.assign(function Stack() { return createElement(Slot); }, { Screen: () => null });
  const Tabs = Object.assign(function Tabs() { return createElement(Slot); }, { Screen: () => null });
  function Link({ href: _href, children, style, ...rest }: AnyProps) {
    return createElement(RN.Text, { ...rest, style: [{ color: '#2563eb' }, style] }, children);
  }
  const router = { push() {}, replace() {}, back() {}, navigate() {} };

  return {
    react: React,
    'react/jsx-runtime': jsxRuntime,
    'react/jsx-dev-runtime': jsxRuntime,
    'react-native': RN,
    'react-dom/client': { createRoot: ctx.createRoot },
    'react-native-safe-area-context': {
      SafeAreaView: RN.SafeAreaView,
      SafeAreaProvider: ({ children }: AnyProps) => children ?? null,
      useSafeAreaInsets: () => ({ ...RN.insets }),
    },
    'expo-status-bar': { StatusBar: () => null },
    'expo-router': { Stack, Tabs, Slot, Link, router, useRouter: () => router, useLocalSearchParams: () => ({}) },
    nativewind: {},
  };
}
