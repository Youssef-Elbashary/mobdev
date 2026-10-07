/**
 * Markdown for builder-made labs, rendered on the server with the site's own pipeline:
 * the same Shiki themes (light + dark) and GitHub-style callouts as the file-based labs.
 * Text comes from admins only (/admin/builder is password-protected).
 */
import { createMarkdownProcessor } from '@astrojs/markdown-remark';
import { transformerMetaHighlight, transformerNotationDiff, transformerNotationFocus, transformerNotationHighlight } from '@shikijs/transformers';
import rehypeCallouts from '../../plugins/rehype-callouts.mjs';
import type { Block } from './core';

let renderer: ReturnType<typeof createMarkdownProcessor> | null = null;

export async function markdown(source: string): Promise<string> {
  if (!source.trim()) return '';
  renderer ??= createMarkdownProcessor({
    shikiConfig: {
      themes: { light: 'github-light', dark: 'github-dark-default' }, defaultColor: false, wrap: false,
      transformers: [
        {
          // ```tsx title="App.tsx" → filename in the code header (same as astro.config.mjs)
          name: 'meta-title',
          pre(node) {
            const m = (this.options.meta as { __raw?: string } | undefined)?.__raw?.match(/title="([^"]+)"/);
            if (m) node.properties['data-title'] = m[1];
          },
        },
        transformerMetaHighlight(), transformerNotationHighlight(), transformerNotationDiff(), transformerNotationFocus(),
      ],
    },
    rehypePlugins: [rehypeCallouts],
  });
  return (await (await renderer).render(source)).code;
}

/** A block with its markdown pre-rendered to HTML (Astro components render synchronously). */
export type RenderedBlock = Block & { html?: string; children?: RenderedBlock[] };

export async function renderBlocks(blocks: Block[]): Promise<RenderedBlock[]> {
  return Promise.all(blocks.map(async (b): Promise<RenderedBlock> => {
    switch (b.kind) {
      case 'task': return { ...b, html: await markdown(b.body), children: await renderBlocks(b.children) };
      case 'text': case 'checkpoint': return { ...b, html: await markdown(b.body) };
      case 'callout': return { ...b, html: await markdown(`> [!${b.tone}]\n${b.body.split('\n').map((l) => `> ${l}`).join('\n')}`) };
      case 'code': {
        const fence = b.code.includes('```') ? '````' : '```';
        const meta = b.title ? ` title="${b.title.replace(/"/g, '')}"` : '';
        return { ...b, html: await markdown(`${fence}${b.lang}${meta}\n${b.code}\n${fence}`) };
      }
      default: return b;
    }
  }));
}
