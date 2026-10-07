// Run with: node --test tests/
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isBlobUrl, looksLikePdf, parseMeta, safePdfName } from '../src/lib/project-files/core.ts';

test('parseMeta cleans valid fields and defaults to a proposal', () => {
  const r = parseMeta({ title: '  Project   proposal ', description: ' Fill it in ', dueAt: '2026-10-20T23:59:00Z' });
  assert.deepEqual(r, { ok: true, value: { title: 'Project proposal', description: 'Fill it in', kind: 'proposal', dueAt: '2026-10-20T23:59:00.000Z' } });
  assert.equal(parseMeta({ title: 'x', dueAt: '' }).ok && parseMeta({ title: 'x' }).ok, true);
});

test('parseMeta rejects a missing title, unknown kind, bad date and long text', () => {
  assert.equal(parseMeta({ title: '   ' }).ok, false);
  assert.equal(parseMeta({ title: 'x', kind: 'exe' }).ok, false);
  assert.equal(parseMeta({ title: 'x', dueAt: 'next week' }).ok, false);
  assert.equal(parseMeta({ title: 'x'.repeat(121) }).ok, false);
  assert.equal(parseMeta({ title: 'x', description: 'x'.repeat(601) }).ok, false);
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
