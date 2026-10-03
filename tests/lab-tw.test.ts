// NativeWind stand-in: utility classes → React Native styles (Tailwind v3 scale & palette).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { classToStyle } from '../src/lab/runtime/tw.ts';

const style = (c: string) => classToStyle(c).style;

test('spacing uses the 4px scale, fractions and keywords', () => {
  assert.deepEqual(style('p-4 px-2 mt-0.5 -mb-1'), { padding: 16, paddingHorizontal: 8, marginTop: 2, marginBottom: -4 });
  assert.deepEqual(style('w-1/2 h-full m-auto gap-3 size-10'), { width: 40, height: 40, margin: 'auto', gap: 12 });
  assert.deepEqual(style('w-[120px] min-h-px'), { width: 120, minHeight: 1 });
});

test('colours come from the Tailwind palette, with /opacity', () => {
  assert.deepEqual(style('bg-blue-500 text-white border-slate-200'), { backgroundColor: '#3b82f6', color: '#ffffff', borderColor: '#e2e8f0' });
  assert.deepEqual(style('bg-black/50'), { backgroundColor: 'rgba(0, 0, 0, 0.5)' });
  assert.deepEqual(style('bg-[#ff6600]'), { backgroundColor: '#ff6600' });
});

test('typography: size sets lineHeight, weights are strings, leading/tracking use the font size', () => {
  assert.deepEqual(style('text-2xl font-bold text-center'), { fontSize: 24, lineHeight: 32, fontWeight: '700', textAlign: 'center' });
  assert.deepEqual(style('text-xl leading-tight tracking-wide'), { fontSize: 20, lineHeight: 25, letterSpacing: 0.5 });
  assert.deepEqual(style('uppercase italic underline'), { textTransform: 'uppercase', fontStyle: 'italic', textDecorationLine: 'underline' });
});

test('flexbox helpers', () => {
  assert.deepEqual(style('flex-1 flex-row items-center justify-between flex-wrap'), {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap',
  });
  assert.deepEqual(style('self-end justify-evenly'), { alignSelf: 'flex-end', justifyContent: 'space-evenly' });
});

test('borders, radius, shadow, opacity, position', () => {
  assert.deepEqual(style('border border-2 rounded-xl'), { borderWidth: 2, borderRadius: 12 });
  assert.deepEqual(style('border-b-4 rounded-t-lg'), { borderBottomWidth: 4, borderTopLeftRadius: 8, borderTopRightRadius: 8 });
  assert.deepEqual(style('rounded-full opacity-50 absolute top-2 z-10'), { borderRadius: 9999, opacity: 0.5, position: 'absolute', top: 8, zIndex: 10 });
  assert.equal(style('shadow-md').elevation, 4);
});

test('active: classes are kept separately for pressed state; other variants are ignored', () => {
  const r = classToStyle('bg-blue-500 active:bg-blue-700 dark:bg-black md:p-8');
  assert.deepEqual(r.style, { backgroundColor: '#3b82f6' });
  assert.deepEqual(r.active, { backgroundColor: '#1d4ed8' });
  assert.deepEqual(r.unknown, []);
});

test('unknown or misspelled classes are reported', () => {
  const r = classToStyle('p-4 bg-blu-500 text-hugeish p-13');
  assert.deepEqual(r.style, { padding: 16 });
  assert.deepEqual(r.unknown, ['bg-blu-500', 'text-hugeish', 'p-13']);
});
