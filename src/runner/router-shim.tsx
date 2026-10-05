/**
 * Just enough of expo-router to run the lab apps in the browser:
 * Stack / Tabs layouts, Stack.Screen options, Link, router and route params.
 */
import React, { Children, cloneElement, createContext, isValidElement, useCallback, useContext, useLayoutEffect, useMemo, useState, type ComponentType, type ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native-web';
import { buildHref, buildRoutes, childName, hrefOf, isDynamicRoute, matchRoute, type Href, type Match, type Route } from './routes.ts';

type Options = {
  title?: string;
  headerShown?: boolean;
  headerStyle?: object;
  headerTintColor?: string;
  tabBarIcon?: (p: { color: string; size: number; focused: boolean }) => ReactNode;
  tabBarActiveTintColor?: string;
  tabBarInactiveTintColor?: string;
};
type Nav = { href: string; history: string[]; push(h: Href): void; replace(h: Href): void; back(): void; goTo(h: string): void };
type Ctx = { nav: Nav; routes: Route[]; match: Match; chain: ComponentType[] };

const RouterCtx = createContext<Ctx | null>(null);
const LevelCtx = createContext(0);
const OptionsCtx = createContext<((o: Options) => void) | null>(null);

let active: Nav | null = null;
export const router = {
  push: (h: Href) => active?.push(h),
  navigate: (h: Href) => active?.push(h),
  replace: (h: Href) => active?.replace(h),
  back: () => active?.back(),
  canGoBack: () => (active?.history.length ?? 0) > 1,
};
export const goTo = (href: string) => active?.goTo(href);
export const useRouter = () => router;

function useRouterCtx() {
  const c = useContext(RouterCtx);
  if (!c) throw new Error('expo-router hooks only work in files inside the app/ folder.');
  return c;
}
export const useLocalSearchParams = () => useRouterCtx().match.params;
export const useGlobalSearchParams = useLocalSearchParams;
export const usePathname = () => useRouterCtx().nav.href.split('?')[0];

function Level({ depth }: { depth: number }) {
  const Comp = useRouterCtx().chain[depth];
  return Comp ? <LevelCtx.Provider value={depth}><Comp /></LevelCtx.Provider> : null;
}
export function Slot() {
  return <Level depth={useContext(LevelCtx) + 1} />;
}

/** In a layout: <Stack.Screen name="…" options={…} />. In a screen: <Stack.Screen options={…} />. */
function ScreenConfig({ options }: { name?: string; options?: Options }) {
  const set = useContext(OptionsCtx);
  const key = JSON.stringify(options ?? {});
  useLayoutEffect(() => {
    if (options) set?.(options);
  }, [set, key]);
  return null;
}

function configsFrom(children: ReactNode) {
  const map = new Map<string, Options>();
  Children.forEach(children, (c) => {
    if (isValidElement<{ name?: string; options?: Options }>(c) && c.props.name) map.set(c.props.name, c.props.options ?? {});
  });
  return map;
}

function useNavigator(children: ReactNode, screenOptions: Options = {}) {
  const ctx = useRouterCtx();
  const depth = useContext(LevelCtx);
  const name = childName(ctx.match.route, depth);
  const [own, setOwn] = useState<{ href: string; opts: Options }>({ href: '', opts: {} });
  const setOptions = useCallback((opts: Options) => setOwn({ href: ctx.nav.href, opts }), [ctx.nav.href]);
  const configs = configsFrom(children);
  const options: Options = { ...screenOptions, ...configs.get(name), ...(own.href === ctx.nav.href ? own.opts : {}) };
  return { ...ctx, depth, name, options, setOptions, configs };
}

function Header({ title, back, options }: { title: string; back: boolean; options: Options }) {
  return (
    <View style={[s.header, options.headerStyle]}>
      {back && (
        <Pressable onPress={() => router.back()} style={s.back} accessibilityLabel="Back">
          <Text style={[s.backText, { color: options.headerTintColor ?? '#2563eb' }]}>‹ Back</Text>
        </Pressable>
      )}
      <Text style={[s.title, { color: options.headerTintColor ?? '#11181c' }]} numberOfLines={1}>{title}</Text>
    </View>
  );
}

type NavProps = { children?: ReactNode; screenOptions?: Options };

function StackNavigator({ children, screenOptions }: NavProps) {
  const { depth, name, options, setOptions, nav } = useNavigator(children, screenOptions);
  return (
    <View style={s.fill}>
      {options.headerShown !== false && <Header title={options.title ?? name} back={nav.history.length > 1} options={options} />}
      <OptionsCtx.Provider value={setOptions}>
        <View style={s.fill}><Level depth={depth + 1} /></View>
      </OptionsCtx.Provider>
    </View>
  );
}
export const Stack = Object.assign(StackNavigator, { Screen: ScreenConfig });

function TabsNavigator({ children, screenOptions }: NavProps) {
  const { depth, name, options, setOptions, configs, nav, match, routes } = useNavigator(children, screenOptions);
  const layout = match.route.layouts[depth];
  const order = [...configs.keys()];
  const rank = (n: string) => (order.indexOf(n) === -1 ? 999 : order.indexOf(n));
  const tabs = routes
    .filter((r) => r.layouts[depth] === layout && r.layouts.length === depth + 1 && !isDynamicRoute(r))
    .sort((a, b) => rank(a.name) - rank(b.name));
  const on = options.tabBarActiveTintColor ?? '#2563eb';
  const off = options.tabBarInactiveTintColor ?? '#8e8e93';
  return (
    <View style={s.fill}>
      {options.headerShown !== false && <Header title={options.title ?? name} back={false} options={options} />}
      <OptionsCtx.Provider value={setOptions}>
        <View style={s.fill}><Level depth={depth + 1} /></View>
      </OptionsCtx.Provider>
      <View style={s.tabbar} accessibilityRole="tablist">
        {tabs.map((t) => {
          const o = { ...screenOptions, ...configs.get(t.name) };
          const focused = t.name === name;
          const color = focused ? on : off;
          return (
            <Pressable key={t.file} style={s.tab} onPress={() => nav.replace(hrefOf(t))} accessibilityRole="tab" accessibilityState={{ selected: focused }}>
              {o.tabBarIcon?.({ color, size: 20, focused })}
              <Text style={[s.tabLabel, { color }]}>{o.title ?? t.name}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}
export const Tabs = Object.assign(TabsNavigator, { Screen: ScreenConfig });

type LinkProps = { href: Href; replace?: boolean; asChild?: boolean; children?: ReactNode; style?: any; [k: string]: any };
export function Link({ href, replace, asChild, children, style, ...rest }: LinkProps) {
  const go = () => (replace ? router.replace(href) : router.push(href));
  if (asChild && isValidElement(children)) return cloneElement(children as React.ReactElement<any>, { onPress: go });
  return <Text accessibilityRole="link" style={[{ color: '#2563eb' }, style]} onPress={go} {...rest}>{children}</Text>;
}

/** Builds the root component for a project that has an app/ folder. */
export function createRouterApp(fileNames: string[], load: (file: string) => any, onRoute: (href: string) => void) {
  const routes = buildRoutes(fileNames);
  return function RouterApp() {
    const [history, setHistory] = useState<string[]>(['/']);
    const href = history[history.length - 1];
    const nav = useMemo<Nav>(() => ({
      href,
      history,
      push: (h) => setHistory((hs) => [...hs, buildHref(h)]),
      replace: (h) => setHistory((hs) => [...hs.slice(0, -1), buildHref(h)]),
      back: () => setHistory((hs) => (hs.length > 1 ? hs.slice(0, -1) : hs)),
      goTo: (h) => setHistory((hs) => {
        if (hs[hs.length - 1] === h) return hs;
        const m = matchRoute(routes, h);
        return m && !isDynamicRoute(m.route) ? [h] : [...hs, h];
      }),
    }), [history]);
    active = nav;
    useLayoutEffect(() => onRoute(href), [href]);
    const match = matchRoute(routes, href);
    if (!match) return <View style={s.center}><Text style={s.title}>Unmatched route</Text><Text>{href}</Text></View>;
    const chain = [...match.route.layouts, match.route.file].map((f) => {
      const Comp = load(f).default;
      if (typeof Comp !== 'function') throw new Error(`${f} must "export default" a component.`);
      return Comp as ComponentType;
    });
    return <RouterCtx.Provider value={{ nav, routes, match, chain }}><Level depth={0} /></RouterCtx.Provider>;
  };
}

const s = StyleSheet.create({
  fill: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 6 },
  header: { height: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', borderBottomWidth: 1, borderBottomColor: '#e5e7eb', backgroundColor: '#fff', paddingHorizontal: 64 },
  back: { position: 'absolute', left: 6, top: 0, bottom: 0, justifyContent: 'center', paddingHorizontal: 6 },
  backText: { fontSize: 15 },
  title: { fontSize: 16, fontWeight: '600' },
  tabbar: { flexDirection: 'row', borderTopWidth: 1, borderTopColor: '#e5e7eb', backgroundColor: '#fff', paddingTop: 6, paddingBottom: 10 },
  tab: { flex: 1, alignItems: 'center', gap: 2 },
  tabLabel: { fontSize: 11, fontWeight: '500' },
});
