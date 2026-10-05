// Bundles the lab preview runtime (src/lab/runtime/entry.ts) into public/lab-runtime/runtime.js.
// It runs inside a sandboxed iframe, so it must be ONE classic script (no ES modules / CORS).
// Used by astro.config.mjs: built once when Astro starts, rebuilt in dev when runtime files change.
import { buildSync } from 'esbuild';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

// absolute paths: works whatever folder the dev server / build is started from
const ROOT = fileURLToPath(new URL('..', import.meta.url));
const OUTFILE = fileURLToPath(new URL('../public/lab-runtime/runtime.js', import.meta.url));

export function buildLabRuntime() {
  buildSync({
    absWorkingDir: ROOT,
    entryPoints: [fileURLToPath(new URL('../src/lab/runtime/entry.ts', import.meta.url))],
    outfile: OUTFILE,
    bundle: true,
    format: 'iife',
    platform: 'browser',
    target: 'es2020',
    minify: true,
    legalComments: 'none',
    // any library asking for 'react-native' gets react-native-web (the real package can't run in a browser)
    alias: { 'react-native': 'react-native-web' },
    define: { 'process.env.NODE_ENV': '"production"', __DEV__: 'false' },
    logLevel: 'warning',
  });
  return createHash('sha256').update(readFileSync(OUTFILE)).digest('hex').slice(0, 10);
}

/** Vite plugin: exposes __LAB_RUNTIME_VERSION__ (cache-busting) and rebuilds on change in dev. */
export function labRuntime() {
  let version = buildLabRuntime();
  return {
    name: 'lab-runtime',
    config() {
      return { define: { __LAB_RUNTIME_VERSION__: JSON.stringify(version) } };
    },
    configureServer(server) {
      server.watcher.on('change', (file) => {
        if (!file.replace(/\\/g, '/').includes('/src/lab/runtime/')) return;
        try {
          version = buildLabRuntime();
          server.ws.send({ type: 'full-reload' });
        } catch (error) {
          console.error('[lab-runtime] build failed:', error.message);
        }
      });
    },
  };
}
