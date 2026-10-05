/**
 * Builds the playground runtime (src/runner/runtime.tsx → public/runner/runtime.js) with esbuild,
 * on `astro dev` (and rebuilds on change) and `astro build`.
 * Separate from Vite on purpose: it bundles the *development* build of React so students
 * get readable errors and warnings (e.g. a missing `key`) in the playgrounds.
 */
import * as esbuild from 'esbuild';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

export default function runner() {
  let ctx;
  let outfile = '';
  return {
    name: 'lab-runner',
    hooks: {
      'astro:config:setup': async ({ config, command, logger, updateConfig }) => {
        if (command !== 'dev' && command !== 'build') return;
        outfile = fileURLToPath(new URL('public/runner/runtime.js', config.root));
        updateConfig({
          vite: {
            plugins: [serveRuntimeInDev(() => outfile)],
            // the playground editor is imported lazily; pre-bundle it so the dev server
            // doesn't reload the page the first time a playground scrolls into view
            optimizeDeps: {
              include: ['@codemirror/view', '@codemirror/state', '@codemirror/commands', '@codemirror/language', '@codemirror/lang-javascript', '@codemirror/autocomplete', '@lezer/highlight'],
            },
          },
        });
        const options = {
          entryPoints: [fileURLToPath(new URL('src/runner/runtime.tsx', config.root))],
          outfile,
          bundle: true,
          format: 'iife',
          minify: true,
          target: 'es2020',
          jsx: 'automatic',
          define: { 'process.env.NODE_ENV': '"development"' },
          logLevel: 'warning',
        };
        // the previous watcher (before a config restart) is replaced, not left running
        await ctx?.dispose();
        if (command === 'dev') {
          ctx = await esbuild.context(options);
          await ctx.rebuild();
          await ctx.watch();
        } else await esbuild.build(options);
        logger.info('playground runtime built → public/runner/runtime.js');
      },
    },
  };
}

/**
 * In dev, Astro answers 403 to cross-origin <script> loads (its sec-fetch check), and the sandboxed
 * iframe has an opaque ("null") origin. Serve just this one file ourselves, in front of that check:
 * Astro unshifts its check in a configureServer post-hook, so this 'post' plugin's post-hook runs
 * afterwards and unshifts in front of it. Static hosting (Vercel) is unaffected.
 */
function serveRuntimeInDev(file) {
  const handle = (req, res, next) => {
    if (req.url?.split('?')[0] !== '/runner/runtime.js') return next();
    res.setHeader('Content-Type', 'text/javascript; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache');
    fs.createReadStream(file())
      .on('error', () => {
        res.statusCode = 404;
        res.end();
      })
      .pipe(res);
  };
  return {
    name: 'lab-runner:serve',
    enforce: 'post',
    configureServer(server) {
      return () => server.middlewares.stack.unshift({ route: '', handle });
    },
  };
}
