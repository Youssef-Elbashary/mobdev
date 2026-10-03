/**
 * Turns GitHub-style alert blockquotes into styled callouts.
 *
 *   > [!TIP]
 *   > Run the emulator before `npx expo start`.
 *
 * Supported: NOTE, TIP, IMPORTANT, WARNING, CAUTION
 */
const TYPES = {
  NOTE: 'Note',
  TIP: 'Tip',
  IMPORTANT: 'Important',
  WARNING: 'Warning',
  CAUTION: 'Caution',
};

function walk(node, fn) {
  fn(node);
  if (node.children) node.children.forEach((c) => walk(c, fn));
}

export default function rehypeCallouts() {
  return (tree) => {
    walk(tree, (node) => {
      // "## Step 3 — Title" → numbered step heading
      if (node.type === 'element' && node.tagName === 'h2') {
        const t = node.children[0];
        const sm = t && t.type === 'text' && t.value.match(/^Step\s+(\d+)\s*[—–:-]+\s*/i);
        if (sm) {
          t.value = t.value.slice(sm[0].length);
          const rest = t.value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
          node.properties = { ...(node.properties || {}), id: `step-${sm[1]}-${rest}`, className: ['step-h'], dataStep: sm[1].padStart(2, '0') };
          node.children.unshift({ type: 'element', tagName: 'span', properties: { className: ['step-num'], ariaHidden: 'true' }, children: [{ type: 'text', value: sm[1].padStart(2, '0') }] }, { type: 'element', tagName: 'span', properties: { className: ['sr-only'] }, children: [{ type: 'text', value: `Step ${sm[1]}: ` }] });
        }
        return;
      }
      if (node.type !== 'element' || node.tagName !== 'blockquote') return;
      const p = node.children.find((c) => c.type === 'element' && c.tagName === 'p');
      if (!p) return;
      const first = p.children[0];
      if (!first || first.type !== 'text') return;
      const m = first.value.match(/^\s*\[!(NOTE|TIP|IMPORTANT|WARNING|CAUTION)\]\s*/i);
      if (!m) return;
      const kind = m[1].toUpperCase();
      first.value = first.value.slice(m[0].length);
      node.tagName = 'aside';
      node.properties = { ...(node.properties || {}), className: ['callout', `callout-${kind.toLowerCase()}`], role: 'note' };
      node.children.unshift({
        type: 'element',
        tagName: 'p',
        properties: { className: ['callout-title'] },
        children: [{ type: 'text', value: TYPES[kind] }],
      });
    });
  };
}
