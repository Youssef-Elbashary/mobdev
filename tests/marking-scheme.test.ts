import assert from 'node:assert/strict';
import test from 'node:test';
import { generateExpectedMarkingScheme } from '../src/lib/marking-scheme.ts';

test('generated marking scheme is based on lab evidence and totals 60 module marks', () => {
  const scheme = generateExpectedMarkingScheme([
    { number: 1, title: 'Tools', skills: ['Expo', 'Git', 'GitHub'], objectives: ['Run a React Native app', 'Merge a branch'] },
    { number: 2, title: 'React', skills: ['Components', 'useState', 'Expo Router'], objectives: ['Build screens with NativeWind', 'Navigate with tabs'] },
  ]);
  assert.equal(scheme.reduce((sum, item) => sum + item.weight, 0), 60);
  assert.ok(scheme.some((item) => item.criterion.includes('Version control')));
  assert.ok(scheme.some((item) => item.criterion.includes('Navigation')));
  assert.ok(scheme.every((item) => item.detail.includes('Lab')));
});

test('generated marking scheme has a safe fallback when no lab evidence is published', () => {
  assert.deepEqual(generateExpectedMarkingScheme([]), [{
    criterion: 'Application of taught lab outcomes',
    weight: 60,
    detail: 'Demonstrate the skills and objectives covered by the published module labs.',
  }]);
});
