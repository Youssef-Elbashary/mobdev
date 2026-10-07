// Run with: node --test tests/
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  acceptAttr, canSubmit, describeTypes, entriesCsv, isBlobUrl, isLate, isNew, looksLikePdf, matchesSignature, mimesFor, parseEntry, parseMeta,
  parseSettings, safePdfName, typeForName, zipPath, type Entry, type ProjectFile,
} from '../src/lib/project-files/core.ts';

/** A fixed clock, so date rules don't start failing once real time passes the test dates. */
const NOW = Date.parse('2026-10-07T12:00:00Z');

test('parseMeta cleans valid fields and applies defaults', () => {
  const r = parseMeta({ title: '  Project   proposal ', description: ' Fill it in ', dueAt: '2026-10-20T23:59:00Z' }, NOW);
  assert.deepEqual(r, { ok: true, value: {
    title: 'Project proposal', description: 'Fill it in', kind: 'proposal', dueAt: '2026-10-20T23:59:00.000Z',
    cutoffAt: null, accepting: true, acceptTypes: ['pdf'], maxMb: 4,
  } });
  assert.equal(parseMeta({ title: 'x', dueAt: '' }, NOW).ok && parseMeta({ title: 'x' }, NOW).ok, true);
});

test('a due date or cut-off being set must be in the future', () => {
  const r = parseMeta({ title: 'x', dueAt: '2026-10-04T20:59:00Z' }, NOW);
  assert.deepEqual(r, { ok: false, error: 'The due date is in the past. Pick a future date and time.' });
  assert.equal(parseMeta({ title: 'x', cutoffAt: '2026-10-01T00:00:00Z' }, NOW).ok, false);
});

const published: ProjectFile = {
  id: 'f1', title: 'Proposal', description: 'Old', kind: 'proposal', due_at: '2026-10-04T20:59:00.000Z', cutoff_at: null,
  url: null, pathname: null, size: null, accepting: true, accept_types: ['pdf'], max_mb: 4, published_by: '', created_at: '2026-10-01T00:00:00.000Z',
};

test('parseSettings (editing) keeps omitted fields and an unchanged past due date', () => {
  const r = parseSettings({ description: 'New', dueAt: '2026-10-04T20:59' + ':30Z' }, published, NOW);
  assert.equal(r.ok, true);
  if (r.ok) {
    assert.equal(r.value.title, 'Proposal');
    assert.equal(r.value.description, 'New');
    assert.equal(r.value.dueAt, published.due_at, 'same minute counts as unchanged');
  }
});

test('parseSettings (editing) fixes a past due date, sets a cut-off, file types and size', () => {
  const r = parseSettings({ dueAt: '2026-10-14T20:59:00Z', cutoffAt: '2026-10-16T20:59:00Z', acceptTypes: ['word', 'pdf'], maxMb: '8' }, published, NOW);
  assert.deepEqual(r.ok && [r.value.dueAt, r.value.cutoffAt, r.value.acceptTypes, r.value.maxMb], ['2026-10-14T20:59:00.000Z', '2026-10-16T20:59:00.000Z', ['pdf', 'word'], 8]);
});

test('parseSettings rejects a cut-off before the due date, no file types, unknown types and bad sizes', () => {
  assert.equal(parseSettings({ dueAt: '2026-10-14T00:00:00Z', cutoffAt: '2026-10-13T00:00:00Z' }, published, NOW).ok, false);
  assert.equal(parseSettings({ acceptTypes: [] }, published, NOW).ok, false);
  assert.equal(parseSettings({ acceptTypes: ['exe'] }, published, NOW).ok, false);
  assert.equal(parseSettings({ maxMb: 0 }, published, NOW).ok, false);
  assert.equal(parseSettings({ maxMb: 11 }, published, NOW).ok, false);
  assert.equal(parseSettings({ maxMb: 2.5 }, published, NOW).ok, false);
  assert.equal(parseSettings({ dueAt: '' }, published, NOW).ok, true, 'clearing the due date is allowed');
});

test('canSubmit closes at the cut-off; late hand-ins before it are allowed', () => {
  const f = { accepting: true, cutoff_at: '2026-10-10T00:00:00.000Z' };
  assert.equal(canSubmit(f, Date.parse('2026-10-09T23:59:00Z')), true);
  assert.equal(canSubmit(f, Date.parse('2026-10-10T00:00:01Z')), false);
  assert.equal(canSubmit({ accepting: false, cutoff_at: null }, NOW), false);
  assert.equal(canSubmit({ accepting: true, cutoff_at: null }, NOW), true);
});

test('file types: names, MIME types, signatures and labels', () => {
  assert.deepEqual(typeForName('Report.DOCX', ['pdf', 'word']), { type: 'word', ext: 'docx', mime: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' });
  assert.equal(typeForName('report.docx', ['pdf']), null);
  assert.equal(typeForName('photo.jpeg', ['image'])?.mime, 'image/jpeg');
  assert.equal(matchesSignature('docx', new Uint8Array([0x50, 0x4b, 0x03, 0x04, 0]), ['word']), true);
  assert.equal(matchesSignature('docx', new TextEncoder().encode('%PDF-1.7'), ['word']), false);
  assert.equal(matchesSignature('png', new Uint8Array([0x89, 0x50, 0x4e, 0x47]), ['image']), true);
  assert.deepEqual(mimesFor(['image']), ['image/png', 'image/jpeg']);
  assert.equal(acceptAttr(['pdf', 'zip']), '.pdf,.zip');
  assert.equal(describeTypes(['pdf']), 'PDF');
  assert.equal(describeTypes(['pdf', 'word', 'zip']), 'PDF, Word (.docx) or ZIP');
  assert.equal(isBlobUrl('https://a.public.blob.vercel-storage.com/x/y.docx', ['docx']), true);
  assert.equal(isBlobUrl('https://a.public.blob.vercel-storage.com/x/y.docx'), false);
});

test('parseMeta rejects a missing title, unknown kind, bad date and long text', () => {
  assert.equal(parseMeta({ title: '   ' }, NOW).ok, false);
  assert.equal(parseMeta({ title: 'x', kind: 'exe' }, NOW).ok, false);
  assert.equal(parseMeta({ title: 'x', dueAt: 'next week' }, NOW).ok, false);
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
  const accepting = (input: Record<string, unknown>) => { const r = parseMeta({ title: 'x', ...input }, NOW); return r.ok && r.value.accepting; };
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
  assert.equal(isNew({ ...base, cutoff_at: '2026-10-10T00:00:00Z' }, now), false, 'cut-off passed');
});

test('entriesCsv quotes fields, flags late hand-ins and neutralises spreadsheet formulas', () => {
  const e: Entry = { id: '1', file_id: 'f', student_id: '23CS1', name: 'Ali, Omar', group_name: 'G1', note: '=HYPERLINK("x")', url: 'https://x/y.pdf', pathname: 'p', size: 2048, created_at: '2026-10-21T00:00:00.000Z', updated_at: '2026-10-21T00:00:00.000Z' };
  const csv = entriesCsv({ due_at: '2026-10-20T00:00:00.000Z' }, [e]).split('\r\n');
  assert.equal(csv[0], 'Name,Student ID,Group,Submitted at,Late,Size (KB),Note,File');
  assert.equal(csv[1], `"Ali, Omar",23CS1,G1,2026-10-21T00:00:00.000Z,yes,2,"'=HYPERLINK(""x"")",https://x/y.pdf`);
});

test('zipPath groups by team, strips illegal characters and keeps names unique', () => {
  const used = new Set<string>();
  assert.equal(zipPath({ group_name: 'G1', student_id: '23CS0042', name: 'Sara Ali' }, used), 'G1/23CS0042 - Sara Ali.pdf');
  assert.equal(zipPath({ group_name: 'G1', student_id: '23CS0042', name: 'Sara Ali' }, used), 'G1/23CS0042 - Sara Ali (2).pdf');
  assert.equal(zipPath({ group_name: '../G:2*', student_id: '23CS1', name: 'A/B' }, used), 'G2/23CS1 - AB.pdf');
  assert.equal(zipPath({ group_name: '', student_id: '23CS2', name: 'Omar' }, used), 'No group/23CS2 - Omar.pdf');
  assert.equal(zipPath({ group_name: 'G3', student_id: '23CS3', name: 'Laila', pathname: 'x/entries/f/23cs3-Ab12.docx' }, used), 'G3/23CS3 - Laila.docx');
});
