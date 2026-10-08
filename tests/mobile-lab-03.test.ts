import assert from 'node:assert/strict';
import test from 'node:test';
import { compileLab } from '../src/lib/platform/core.ts';
import { mobileDevelopmentLab03 } from '../src/lib/platform/seeds/mobile-development-lab-03.ts';
import { compileAll } from '../src/lab/engine/compile.ts';

test('Mobile Development Lab 03 compiles as a complete canvas lab', () => {
  const compiled = compileLab(mobileDevelopmentLab03(), 'mobile-development--lab-03');
  assert.deepEqual(compiled.warnings, []);
  assert.equal(compiled.hasCheckin, true);
  assert.equal(compiled.blocks.filter((block) => block.kind === 'part').length, 6);
  assert.ok(compiled.blocks.filter((block) => block.kind === 'task').length >= 16);
  assert.equal(Object.keys(compiled.exercises).length, 4);
  assert.match(compiled.meta.description, /staging and production/);
  assert.match(compiled.meta.description, /throughout the semester/);
  assert.ok(compiled.blocks.some((block) => block.kind === 'task' && /product-brief/.test(block.body)));
  assert.ok(compiled.blocks.some((block) => block.kind === 'task' && /NativeWind/.test(block.body)));
  assert.match(compiled.outline, /<RepoSubmit \/>/);
  for (const exercise of Object.values(compiled.exercises)) {
    assert.equal(compileAll(exercise.files).ok, true, `${exercise.title} starter compiles`);
    assert.equal(compileAll(exercise.solution ?? {}).ok, true, `${exercise.title} solution compiles`);
  }
});
