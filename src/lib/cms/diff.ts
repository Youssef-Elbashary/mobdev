/** A small line diff for the CMS "Review changes" screen (longest common subsequence). */
export type DiffLine = { type: ' ' | '+' | '-' | '…'; text: string };

export function lineDiff(before: string, after: string, context = 3): DiffLine[] {
  const a = before === '' ? [] : before.replace(/\r\n/g, '\n').split('\n');
  const b = after === '' ? [] : after.replace(/\r\n/g, '\n').split('\n');
  // trim the shared start and end first: keeps the table small for big files with small edits
  let start = 0;
  while (start < a.length && start < b.length && a[start] === b[start]) start++;
  let endA = a.length;
  let endB = b.length;
  while (endA > start && endB > start && a[endA - 1] === b[endB - 1]) {
    endA--;
    endB--;
  }
  const x = a.slice(start, endA);
  const y = b.slice(start, endB);
  const lcs: number[][] = Array.from({ length: x.length + 1 }, () => new Array(y.length + 1).fill(0));
  for (let i = x.length - 1; i >= 0; i--) for (let j = y.length - 1; j >= 0; j--) lcs[i][j] = x[i] === y[j] ? lcs[i + 1][j + 1] + 1 : Math.max(lcs[i + 1][j], lcs[i][j + 1]);
  const mid: DiffLine[] = [];
  let i = 0;
  let j = 0;
  while (i < x.length || j < y.length) {
    if (i < x.length && j < y.length && x[i] === y[j]) mid.push({ type: ' ', text: x[i++] }), j++;
    else if (j < y.length && (i >= x.length || lcs[i][j + 1] > lcs[i + 1][j])) mid.push({ type: '+', text: y[j++] }); // removals first, like git
    else mid.push({ type: '-', text: x[i++] });
  }
  const all: DiffLine[] = [...a.slice(0, start).map((t) => ({ type: ' ' as const, text: t })), ...mid, ...a.slice(endA).map((t) => ({ type: ' ' as const, text: t }))];
  // keep `context` unchanged lines around each change, fold the rest into "…"
  const keep = all.map(() => false);
  all.forEach((l, k) => {
    if (l.type === ' ') return;
    for (let d = Math.max(0, k - context); d <= Math.min(all.length - 1, k + context); d++) keep[d] = true;
  });
  const out: DiffLine[] = [];
  all.forEach((l, k) => {
    if (keep[k]) out.push(l);
    else if (out[out.length - 1]?.type !== '…') out.push({ type: '…', text: '' });
  });
  return out;
}
