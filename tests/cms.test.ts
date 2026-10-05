// Run with: node --test tests/
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { parse } from 'yaml';
import { siteSchema } from '../src/content/schemas.ts';

/* ---------------- content refactors ---------------- */

test('site.yaml holds valid course info, team and assessment', () => {
  const site = siteSchema.parse(parse(fs.readFileSync(new URL('../src/content/data/site.yaml', import.meta.url), 'utf8')));
  assert.equal(site.course.code, '25CSCI38H');
  assert.ok(site.team.length >= 1);
  assert.equal(site.assessment.reduce((a, r) => a + r.weight, 0), 100);
});

test('site schema rejects a broken team or weights that do not add up', () => {
  const site = parse(fs.readFileSync(new URL('../src/content/data/site.yaml', import.meta.url), 'utf8'));
  assert.equal(siteSchema.safeParse({ ...site, team: [{ role: 'TA', name: 'X', email: 'not-an-email' }] }).success, false);
  assert.equal(siteSchema.safeParse({ ...site, assessment: [{ label: 'Exam', weight: 90, sub: '' }] }).success, false);
});

/* ---------------- helpers ---------------- */

import { execFileSync } from 'node:child_process';
import { blobSha } from '../src/lib/cms/sha.ts';
import { lineDiff } from '../src/lib/cms/diff.ts';
import { listEntries, setEntry, addEntry, removeEntry, moveEntry, setSite } from '../src/lib/cms/yaml-list.ts';
import { LIST_FIELDS, SITE_FIELDS } from '../src/lib/cms/fields.ts';
import * as schemas from '../src/content/schemas.ts';

const data = (f: string) => fs.readFileSync(new URL(`../src/content/data/${f}.yaml`, import.meta.url), 'utf8');

test('blobSha equals git hash-object', () => {
  assert.equal(blobSha('hello\n'), 'ce013625030ba8dba906f756967f9e9ca394464a');
  const text = 'café — ✓\n';
  assert.equal(blobSha(text), execFileSync('git', ['hash-object', '--stdin'], { input: text }).toString().trim());
});

test('lineDiff shows changes with a little context', () => {
  assert.deepEqual(lineDiff('a\nb\nc', 'a\nb\nc').filter((l) => l.type === '+' || l.type === '-'), []);
  const d = lineDiff('1\n2\n3\n4\n5\n6\n7\n8\n9\n10', '1\n2\n3\n4\n5\nFIVE\n7\n8\n9\n10');
  assert.deepEqual(d.filter((l) => l.type === '+' || l.type === '-').map((l) => l.type + l.text), ['-6', '+FIVE']);
  assert.ok(d.length < 12); // trimmed context
  assert.deepEqual(lineDiff('', 'x').map((l) => l.type + l.text), ['+x']);
});

test('yaml-list reads every data file', () => {
  for (const f of ['commands', 'troubleshooting', 'resources', 'extra', 'roadmap', 'checklist']) {
    const entries = listEntries(data(f));
    assert.ok(entries.length > 0, f);
    assert.ok(entries.every((e) => typeof e.id === 'string' && e.id), f);
  }
});

test('setEntry rewrites only that entry: every other line and every comment stays', () => {
  const src = data('commands');
  const cd = listEntries(src).find((e) => e.id === 'cd')!;
  const out = setEntry(src, 'cd', { ...cd.value, title: 'Change folder', related: ['ls', 'pwd'] });
  const changed = lineDiff(src.replace(/\r\n/g, '\n'), out.replace(/\r\n/g, '\n')).filter((l) => l.type === '+' || l.type === '-');
  assert.ok(changed.every((l) => /title|related/.test(l.text)), JSON.stringify(changed));
  for (const comment of src.split(/\r?\n/).filter((l) => l.trim().startsWith('#'))) assert.ok(out.includes(comment.trim()), comment);
  assert.equal(listEntries(out).find((e) => e.id === 'cd')!.value.title, 'Change folder');
  assert.equal(out.includes('\r\n'), src.includes('\r\n')); // keeps the file's line endings
});

test('addEntry / removeEntry / moveEntry', () => {
  const src = data('checklist');
  const n = listEntries(src).length;
  const added = addEntry(src, { id: 'new-one', label: 'Brand new' }, listEntries(src)[0].id);
  assert.equal(listEntries(added)[1].id, 'new-one');
  assert.throws(() => addEntry(src, { id: listEntries(src)[0].id, label: 'dup' }), /already/);
  const removed = removeEntry(added, 'new-one');
  assert.deepEqual(listEntries(removed).map((e) => e.id), listEntries(src).map((e) => e.id));
  const ids = listEntries(src).map((e) => e.id);
  const moved = moveEntry(src, ids[0], n - 1);
  assert.deepEqual(listEntries(moved).map((e) => e.id), [...ids.slice(1), ids[0]]);
  for (const comment of src.split(/\r?\n/).filter((l) => l.trim().startsWith('#'))) assert.ok(moved.includes(comment.trim()));
});

test('setSite changes values and keeps the comments', () => {
  const src = data('site');
  const site = parse(src);
  const out = setSite(src, { ...site, course: { ...site.course, term: '2027–2028 · Semester Two' } });
  assert.equal(parse(out).course.term, '2027–2028 · Semester Two');
  assert.ok(out.includes('# Teaching team'));
  assert.equal(lineDiff(src, out).filter((l) => l.type === '+' || l.type === '-').length, 2);
});

test('form fields match the schemas exactly', () => {
  const shapes: Record<string, any> = {
    commands: schemas.commandSchema, troubleshooting: schemas.troubleshootingSchema, resources: schemas.resourceSchema,
    extra: schemas.extraSchema, roadmap: schemas.roadmapSchema, checklist: schemas.checklistSchema,
  };
  for (const [name, schema] of Object.entries(shapes)) {
    const keys = LIST_FIELDS[name as keyof typeof LIST_FIELDS].map((f) => f.key).filter((k) => k !== 'id').sort();
    assert.deepEqual(keys, Object.keys(schema.shape).sort(), name);
  }
  assert.deepEqual(SITE_FIELDS.map((f) => f.key).sort(), Object.keys(schemas.siteSchema.innerType?.().shape ?? schemas.siteSchema.shape).sort());
});

test('setEntry can add and remove fields, and the file still parses', () => {
  const src = data('resources');
  const first = listEntries(src)[0];
  const { description: _drop, ...rest } = first.value;
  const out = setEntry(src, first.id, { ...rest, source: 'Our notes' });
  const after = listEntries(out).find((e) => e.id === first.id)!.value;
  assert.equal(after.source, 'Our notes');
  assert.equal('description' in after, false);
  assert.equal(listEntries(out).length, listEntries(src).length);
  assert.deepEqual(listEntries(out).slice(1), listEntries(src).slice(1)); // others untouched
});
