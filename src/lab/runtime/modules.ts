/**
 * A tiny CommonJS module system for the student's files (already compiled by Sucrase).
 * Paths look like 'App.tsx', 'components/Card.tsx', 'app/index.tsx'.
 */
export class LabError extends Error {
  hint?: string;
  constructor(message: string, hint?: string) {
    super(message);
    this.name = 'LabError';
    this.hint = hint;
  }
}

export type Builtins = Record<string, unknown>;

const EXTENSIONS = ['', '.tsx', '.ts', '.jsx', '.js', '/index.tsx', '/index.ts', '/index.jsx', '/index.js'];
const own = (obj: object, key: string) => Object.prototype.hasOwnProperty.call(obj, key);

function dirname(path: string) {
  const i = path.lastIndexOf('/');
  return i === -1 ? '' : path.slice(0, i);
}

function join(base: string, relative: string) {
  const parts = base ? base.split('/') : [];
  for (const segment of relative.split('/')) {
    if (segment === '' || segment === '.') continue;
    if (segment === '..') parts.pop();
    else parts.push(segment);
  }
  return parts.join('/');
}

let lineOffset: number | undefined;
/** How many lines `new Function` adds before the body in this JS engine (2 in Chrome, varies elsewhere). */
export function functionLineOffset(): number {
  if (lineOffset !== undefined) return lineOffset;
  try {
    new Function('throw new Error("probe")\n//# sourceURL=lab:///__probe')();
  } catch (error) {
    const m = /lab:\/\/\/__probe:(\d+)/.exec(String((error as Error).stack ?? ''));
    lineOffset = m ? Number(m[1]) - 1 : 2;
  }
  return lineOffset ?? 2;
}

/** Where an error happened in the student's own files (1-based line in their code), if we can tell. */
export function locate(error: unknown): { file: string; line: number; column: number } | null {
  const stack = error instanceof Error ? String(error.stack ?? '') : '';
  const m = /lab:\/\/\/([^\s:()]+):(\d+):(\d+)/.exec(stack);
  if (!m || m[1] === '__probe') return null;
  return { file: m[1], line: Math.max(1, Number(m[2]) - functionLineOffset()), column: Number(m[3]) };
}

/**
 * Browsers have global `Text` and `Image` classes (DOM nodes). Without this, forgetting
 * `import { Text } from 'react-native'` would silently use the DOM class and fail with a confusing
 * "Class constructor Text cannot be invoked" error. Student code gets these names shadowed instead.
 */
function missingImport(name: string) {
  const Missing = () => {
    throw new LabError(`${name} is not defined.`, `Did you import ${name}? e.g. import { ${name} } from 'react-native';`);
  };
  Missing.displayName = `Missing${name}`;
  return Missing;
}
const SHADOWED = ['Text', 'Image'] as const;

export function createModuleSystem(builtins: Builtins, files: Record<string, string>) {
  const cache = new Map<string, { exports: Record<string, unknown> }>();
  const shadows = SHADOWED.map(missingImport);

  function resolveFile(from: string, spec: string): string | null {
    const target = spec.startsWith('@/') ? spec.slice(2) : spec.startsWith('/') ? spec.slice(1) : join(dirname(from), spec);
    for (const ext of EXTENSIONS) if (own(files, target + ext)) return target + ext;
    return null;
  }

  function requireFrom(from: string) {
    return (spec: string): unknown => {
      if (own(builtins, spec)) return builtins[spec];
      if (/\.(css|scss|sass)$/.test(spec)) return {};
      if (/^(\.|\/|@\/)/.test(spec)) {
        const file = resolveFile(from, spec);
        if (file) return load(file);
        throw new LabError(`Cannot find '${spec}' (imported in ${from}).`, 'Check the file name and that the path starts with ./');
      }
      const packages = Object.keys(builtins).filter((k) => !k.includes('/') || k.startsWith('@'));
      throw new LabError(`The package '${spec}' isn't available in this lab.`, `You can import from: ${packages.join(', ')}.`);
    };
  }

  function load(path: string): Record<string, unknown> {
    const hit = cache.get(path);
    if (hit) return hit.exports;
    const code = files[path];
    if (code === undefined) throw new LabError(`The file '${path}' doesn't exist.`);
    const module = { exports: {} as Record<string, unknown> };
    cache.set(path, module);
    const factory = new Function('require', 'module', 'exports', ...SHADOWED, `${code}\n//# sourceURL=lab:///${path}`);
    factory(requireFrom(path), module, module.exports, ...shadows);
    return module.exports;
  }

  return {
    load,
    /** require a file relative to the project root, e.g. requireFile('app/index') */
    requireFile(spec: string) {
      const file = resolveFile('', spec);
      return file ? load(file) : null;
    },
  };
}
