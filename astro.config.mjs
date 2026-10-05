// @ts-check
import { defineConfig } from 'astro/config';
import {
  transformerNotationHighlight,
  transformerNotationDiff,
  transformerNotationFocus,
  transformerMetaHighlight,
} from '@shikijs/transformers';
import { unified } from '@astrojs/markdown-remark';
import mdx from '@astrojs/mdx';
import vercel from '@astrojs/vercel';
import rehypeCallouts from './src/plugins/rehype-callouts.mjs';
import runner from './src/integrations/runner.mjs';

export default defineConfig({
  site: 'https://mobdev.vercel.app',
  prefetch: { prefetchAll: true, defaultStrategy: 'hover' },
  // runner(): builds the Lab playground runtime (public/runner/runtime.js)
  integrations: [mdx(), runner()],
  // Static site; only /admin and /api/* run on the server (they set `prerender = false`).
  adapter: vercel({ maxDuration: 60 }),
  markdown: {
    shikiConfig: {
      themes: { light: 'github-light', dark: 'github-dark-default' },
      defaultColor: false,
      wrap: false,
      transformers: [
        {
          // ```tsx title="App.tsx"  → shows the filename in the code header
          name: 'meta-title',
          pre(node) {
            const m = this.options.meta?.__raw?.match(/title="([^"]+)"/);
            if (m) node.properties['data-title'] = m[1];
          },
        },
        transformerMetaHighlight(),
        transformerNotationHighlight(),
        transformerNotationDiff(),
        transformerNotationFocus(),
      ],
    },
    processor: unified({ rehypePlugins: [rehypeCallouts] }),
  },
});
