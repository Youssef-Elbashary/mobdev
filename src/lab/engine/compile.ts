/**
 * Compiles the student's TSX/JSX files to CommonJS for the preview runtime (Sucrase).
 * Sucrase keeps line numbers, so runtime errors point at the student's own lines.
 */
import { transform } from 'sucrase';

export type CompileError = { file: string; message: string; line: number; column: number };
export type CompileResult = { ok: true; files: Record<string, string> } | { ok: false; errors: CompileError[] };

function tidy(message: string) {
  return message
    .replace(/^Error transforming [^:]+:\s*/, '')
    .replace(/\s*\(\d+:\d+\)\s*$/, '')
    .trim();
}

export function compileFile(path: string, code: string): { ok: true; code: string } | { ok: false; error: CompileError } {
  try {
    const out = transform(code, {
      transforms: ['typescript', 'jsx', 'imports'],
      jsxRuntime: 'automatic',
      production: true,
      filePath: path,
    });
    return { ok: true, code: out.code };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const m = /\((\d+):(\d+)\)/.exec(message);
    return {
      ok: false,
      error: { file: path, message: tidy(message) || 'Syntax error', line: m ? Number(m[1]) : 1, column: m ? Number(m[2]) + 1 : 1 },
    };
  }
}

export function compileAll(files: Record<string, string>): CompileResult {
  const out: Record<string, string> = {};
  const errors: CompileError[] = [];
  for (const [path, code] of Object.entries(files)) {
    if (!/\.(tsx?|jsx?)$/.test(path)) continue; // e.g. index.html shown for reading only
    const result = compileFile(path, code);
    if (result.ok) out[path] = result.code;
    else errors.push(result.error);
  }
  return errors.length ? { ok: false, errors } : { ok: true, files: out };
}
