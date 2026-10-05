/**
 * A tiny CommonJS module system for student code: each file is compiled with Sucrase
 * (TypeScript + JSX → plain JS) and evaluated on demand. A fresh system per run.
 */
import { transform } from 'sucrase';
import type { Files } from './protocol.ts';

const EXT = ['', '.tsx', '.ts', '.jsx', '.js', '/index.tsx', '/index.ts', '/index.js'];

export function compile(code: string, filePath: string): string {
  return transform(code, { transforms: ['typescript', 'jsx', 'imports'], jsxRuntime: 'automatic', production: true, filePath }).code;
}

function normalize(path: string): string {
  const out: string[] = [];
  for (const part of path.split('/')) {
    if (!part || part === '.') continue;
    if (part === '..') out.pop();
    else out.push(part);
  }
  return out.join('/');
}

/** './x', '../x' and '@/x' (project root, like the Expo template) → a file in `files`. */
export function resolve(from: string, spec: string, files: Files): string | null {
  let base: string;
  if (spec.startsWith('@/')) base = normalize(spec.slice(2));
  else if (spec.startsWith('./') || spec.startsWith('../')) base = normalize([...from.split('/').slice(0, -1), spec].join('/'));
  else return null;
  for (const ext of EXT) if (files[base + ext] != null) return base + ext;
  return null;
}

export type ModuleSystem = { require: (spec: string, from?: string) => any };

export function createModuleSystem(files: Files, builtins: Record<string, unknown>): ModuleSystem {
  const cache = new Map<string, { exports: any }>();
  const load = (path: string) => {
    const hit = cache.get(path);
    if (hit) return hit.exports;
    let code: string;
    try {
      code = compile(files[path], path);
    } catch (e) {
      // Sucrase: "Error transforming App.tsx: Unexpected token (3:5)" → "App.tsx: Unexpected token (3:5)"
      throw new Error(`${path}: ${(e as Error).message.replace(/^Error transforming [^:]+: /, '')}`);
    }
    const module = { exports: {} as any };
    cache.set(path, module);
    const fn = new Function('require', 'module', 'exports', `${code}\n//# sourceURL=${path}`);
    fn((spec: string) => requireFrom(spec, path), module, module.exports);
    return module.exports;
  };
  const requireFrom = (spec: string, from: string): any => {
    if (Object.prototype.hasOwnProperty.call(builtins, spec)) return builtins[spec];
    if (files[spec] != null) return load(spec);
    const path = resolve(from, spec, files);
    if (path) return load(path);
    if (/^(\.|@\/)/.test(spec)) throw new Error(`Can't find file "${spec}" imported from "${from}".`);
    throw new Error(`The package "${spec}" isn't available in the browser runner. You can import: react, react-native, expo-router.`);
  };
  return { require: (spec, from = '') => requireFrom(spec, from) };
}
