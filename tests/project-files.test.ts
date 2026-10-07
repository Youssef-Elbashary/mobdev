// Run with: node --test tests/
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { entriesCsv, isBlobUrl, isLate, isNew, looksLikePdf, parseEntry, parseMeta, safePdfName, zipPath, type Entry } from '../src/lib/project-files/core.ts';

test('parseMeta cleans valid fields and defaults to a proposal', () => {
  const r = parseMeta({ title: '  Project   proposal ', description: ' Fill it in ', dueAt: '2026-10-20T23:59:00Z' });
  assert.deepEqual(r, { ok: true, value: { title: 'Project proposal', description: 'Fill it in', kind: 'proposal', dueAt: '2026-10-20T23:59:00.000Z', accepting: true } });
  assert.equal(parseMeta({ title: 'x', dueAt: '' }).ok && parseMeta({ title: 'x' }).ok, true);
});

test('parseMeta rejects a missing title, unknown kind, bad date and long text', () => {
  assert.equal(parseMeta({ title: '   ' }).ok, false);
  assert.equal(parseMeta({ title: 'x', kind: 'exe' }).ok, false);
  assert.equal(parseMeta({ title: 'x', dueAt: 'next week' }).ok, false);
  assert.equal(parseMeta({ title: 'x'.repeat(121) }).ok, false);
  assert.equal(parseMeta({ title: 'x', description: 'x'.repeat(2001) }).ok, false);
});

test('looksLikePdf checks the %PDF- signature', () => {
  assert.equal(looksLikePdf(new TextEncoder().encode('%PDF-1.7\n')), true);
  assert.equal(looksLikePdf(new TextEncoder().encode('<html>')), false);
  assert.equal(looksLikePdf(new Uint8Array()), false);
});

test('safePdfName produces a slug ending in .pdf', () => {
  assert.equal(safePdfName('Proposal Form (v2).PDF'), 'proposal-form-v2.pdf');
  assert.equal(safePdfName('../../etc/passwd'), 'etcpasswd.pdf');
  assert.equal(safePdfName('???.pdf'), 'document.pdf');
});

test('isBlobUrl accepts only https PDFs in a public Vercel Blob store', () => {
  assert.equal(isBlobUrl('https://abc123.public.blob.vercel-storage.com/project-files/form-x1.pdf'), true);
  assert.equal(isBlobUrl('http://abc123.public.blob.vercel-storage.com/a.pdf'), false);
  assert.equal(isBlobUrl('https://evil.example.com/a.pdf'), false);
  assert.equal(isBlobUrl('https://abc.public.blob.vercel-storage.com.evil.com/a.pdf'), false);
  assert.equal(isBlobUrl('https://abc.public.blob.vercel-storage.com/a.html'), false);
  assert.equal(isBlobUrl('not a url'), false);
});

test('parseMeta: proposals collect hand-ins by default, other kinds do not, and the admin can override', () => {
  const accepting = (input: Record<string, unknown>) => { const r = parseMeta({ title: 'x', ...input }); return r.ok && r.value.accepting; };
  assert.equal(accepting({}), true);
  assert.equal(accepting({ kind: 'brief' }), false);
  assert.equal(accepting({ kind: 'brief', accepting: true }), true);
  assert.equal(accepting({ kind: 'proposal', accepting: 'false' }), false);
  assert.equal(accepting({ kind: 'template', accepting: 'on' }), true);
});

const device = 'abcdefghijklmnop1234';
test('parseEntry cleans a valid hand-in and upper-cases the student ID', () => {
  const r = parseEntry({ name: '  Sara   Ali ', studentId: ' 23cs0042 ', group: ' G1 ', note: ' hi ', deviceKey: device });
  assert.deepEqual(r, { ok: true, value: { name: 'Sara Ali', studentId: '23CS0042', group: 'G1', note: 'hi', deviceKey: device } });
});

test('parseEntry rejects bad names, IDs, groups, long notes and missing device keys', () => {
  const ok = { name: 'Sara Ali', studentId: '23CS0042', group: 'G1', deviceKey: device };
  assert.equal(parseEntry({ ...ok, name: '<script>' }).ok, false);
  assert.equal(parseEntry({ ...ok, studentId: '12' }).ok, false);
  assert.equal(parseEntry({ ...ok, studentId: '23 CS 42' }).ok, false);
  assert.equal(parseEntry({ ...ok, group: '' }).ok, false);
  assert.equal(parseEntry({ ...ok, note: 'x'.repeat(501) }).ok, false);
  assert.equal(parseEntry({ ...ok, deviceKey: 'short' }).ok, false);
  assert.equal(parseEntry(ok).ok, true);
});

test('isLate compares the hand-in time with the due time', () => {
  const file = { due_at: '2026-10-20T21:59:00.000Z' };
  assert.equal(isLate(file, '2026-10-20T21:58:59.000Z'), false);
  assert.equal(isLate(file, '2026-10-20T22:00:00.000Z'), true);
  assert.equal(isLate({ due_at: null }, '2030-01-01T00:00:00.000Z'), false);
});

test('isNew announces open, recent, not-yet-due items only', () => {
  const now = Date.parse('2026-10-10T12:00:00Z');
  const base = { accepting: true, due_at: '2026-10-20T00:00:00Z', created_at: '2026-10-09T00:00:00Z' };
  assert.equal(isNew(base, now), true);
  assert.equal(isNew({ ...base, accepting: false }, now), false);
  assert.equal(isNew({ ...base, created_at: '2026-09-01T00:00:00Z' }, now), false);
  assert.equal(isNew({ ...base, due_at: '2026-10-09T00:00:00Z' }, now), false);
  assert.equal(isNew({ ...base, due_at: null }, now), true);
});

test('entriesCsv quotes fields, flags late hand-ins and neutralises spreadsheet formulas', () => {
  const e: Entry = { id: '1', file_id: 'f', student_id: '23CS1', name: 'Ali, Omar', group_name: 'G1', note: '=HYPERLINK("x")', url: 'https://x/y.pdf', pathname: 'p', size: 2048, created_at: '2026-10-21T00:00:00.000Z', updated_at: '2026-10-21T00:00:00.000Z' };
  const csv = entriesCsv({ due_at: '2026-10-20T00:00:00.000Z' }, [e]).split('\r\n');
  assert.equal(csv[0], 'Name,Student ID,Group,Submitted at,Late,Size (KB),Note,PDF');
  assert.equal(csv[1], `"Ali, Omar",23CS1,G1,2026-10-21T00:00:00.000Z,yes,2,"'=HYPERLINK(""x"")",https://x/y.pdf`);
});

test('zipPath groups by team, strips illegal characters and keeps names unique', () => {
  const used = new Set<string>();
  assert.equal(zipPath({ group_name: 'G1', student_id: '23CS0042', name: 'Sara Ali' }, used), 'G1/23CS0042 - Sara Ali.pdf');
  assert.equal(zipPath({ group_name: 'G1', student_id: '23CS0042', name: 'Sara Ali' }, used), 'G1/23CS0042 - Sara Ali (2).pdf');
  assert.equal(zipPath({ group_name: '../G:2*', student_id: '23CS1', name: 'A/B' }, used), 'G2/23CS1 - AB.pdf');
  assert.equal(zipPath({ group_name: '', student_id: '23CS2', name: 'Omar' }, used), 'No group/23CS2 - Omar.pdf');
});
