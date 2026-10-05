import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const page = fs.readFileSync(new URL('../src/pages/labs/[id].astro', import.meta.url), 'utf8');
const lab02 = fs.readFileSync(new URL('../src/content/labs/lab-02.mdx', import.meta.url), 'utf8');
const interactiveCss = fs.readFileSync(new URL('../src/styles/lab-interactive.css', import.meta.url), 'utf8');

test('every mission lab asks for identity before rendering its lesson content', () => {
  const start = page.indexOf('<LabStart');
  const content = page.indexOf('<Content components={components}');
  assert.ok(start > 0 && content > start, 'the required identity card must precede the lesson');
  assert.match(interactiveCss, /\.ls:not\(\.is-signed\)\s*~\s*\*\s*\{\s*display:\s*none/);
});

test('attendance is the final lab card before previous/next navigation', () => {
  const content = page.indexOf('<Content components={components}');
  const checkin = page.indexOf('<CheckinCard');
  const navigation = page.indexOf('<nav class="pn"');
  assert.ok(content < checkin && checkin < navigation, 'check-in must be after all lab content and before navigation');
});

test('merged Lab 02 keeps the interactive course and full practical Expo project', () => {
  const ids = [...lab02.matchAll(/<Exercise id="(ex\d+)"/g)].map((m) => m[1]);
  assert.deepEqual(ids, Array.from({ length: 17 }, (_, i) => `ex${String(i + 1).padStart(2, '0')}`));
  assert.match(lab02, /Navigation \+ the Recipes app/);
  assert.match(lab02, /Your project: a four-screen Movies app/);
  assert.match(lab02, /<AppWalkthrough ex="recipes"/);
  assert.match(lab02, /<RepoSubmit lab="lab-02"/);
});
