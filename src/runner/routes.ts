/**
 * expo-router's file-based routing, reduced to what the labs use:
 * app/_layout.tsx, groups like (tabs), index routes and [param] segments.
 */
export type Route = { file: string; name: string; segments: string[]; layouts: string[] };
export type Match = { route: Route; params: Record<string, string> };
export type Href = string | { pathname: string; params?: Record<string, string | number> };

const CODE = /\.(tsx|ts|jsx|js)$/;
const strip = (f: string) => f.replace(CODE, '');
const dirOf = (f: string) => f.slice(0, f.lastIndexOf('/'));
const isGroup = (s: string) => /^\(.*\)$/.test(s);
const isDynamic = (s: string) => /^\[.+\]$/.test(s);

/** What a navigator at `level` of the route's layout chain is currently showing. */
export function childName(route: Route, level: number): string {
  const dir = dirOf(route.layouts[level]);
  const next = route.layouts[level + 1];
  return next ? dirOf(next).slice(dir.length + 1) : strip(route.file).slice(dir.length + 1);
}

export function buildRoutes(fileNames: string[]): Route[] {
  const layoutIn = new Map<string, string>();
  for (const f of fileNames) if (/^app\/(.*\/)?_layout\.(tsx|ts|jsx|js)$/.test(f)) layoutIn.set(dirOf(f), f);
  const routes: Route[] = [];
  for (const file of fileNames) {
    if (!file.startsWith('app/') || !CODE.test(file) || /(^|\/)_layout\.\w+$/.test(file)) continue;
    const parts = strip(file).split('/').slice(1);
    const layouts: string[] = [];
    let dir = 'app';
    if (layoutIn.has(dir)) layouts.push(layoutIn.get(dir)!);
    for (const p of parts.slice(0, -1)) {
      dir += `/${p}`;
      if (layoutIn.has(dir)) layouts.push(layoutIn.get(dir)!);
    }
    const segments = parts.filter((p) => !isGroup(p));
    if (segments[segments.length - 1] === 'index') segments.pop();
    const base = layouts.length ? dirOf(layouts[layouts.length - 1]) : 'app';
    routes.push({ file, name: strip(file).slice(base.length + 1), segments, layouts });
  }
  const dyn = (r: Route) => r.segments.filter(isDynamic).length;
  return routes.sort((a, b) => dyn(a) - dyn(b));
}

export function matchRoute(routes: Route[], href: string): Match | null {
  const [path, query = ''] = href.split('?');
  const parts = path.split('/').filter(Boolean).map(decodeURIComponent);
  for (const route of routes) {
    if (route.segments.length !== parts.length) continue;
    const params: Record<string, string> = {};
    const ok = route.segments.every((seg, i) => {
      if (!isDynamic(seg)) return seg === parts[i];
      params[seg.slice(1, -1)] = parts[i];
      return true;
    });
    if (!ok) continue;
    new URLSearchParams(query).forEach((v, k) => {
      if (!(k in params)) params[k] = v;
    });
    return { route, params };
  }
  return null;
}

export const hrefOf = (route: Route) => `/${route.segments.join('/')}`;
export const isDynamicRoute = (route: Route) => route.segments.some(isDynamic);

export function buildHref(href: Href): string {
  if (typeof href === 'string') return href;
  const params: Record<string, string | number> = { ...(href.params ?? {}) };
  const path = href.pathname.replace(/\[(\w+)\]/g, (_, k: string) => {
    const v = params[k];
    delete params[k];
    return encodeURIComponent(String(v));
  });
  const q = new URLSearchParams(Object.entries(params).map(([k, v]) => [k, String(v)])).toString();
  return q ? `${path}?${q}` : path;
}
