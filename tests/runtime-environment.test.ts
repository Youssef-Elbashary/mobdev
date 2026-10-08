import assert from 'node:assert/strict';
import test from 'node:test';
import { environmentPrefix, resolveRuntimeEnvironment } from '../src/lib/runtime-environment.ts';

test('runtime environment distinguishes local, preview and production', () => {
  assert.equal(resolveRuntimeEnvironment({}), 'development');
  assert.equal(resolveRuntimeEnvironment({ VERCEL_ENV: 'preview' }), 'staging');
  assert.equal(resolveRuntimeEnvironment({ VERCEL_ENV: 'production' }), 'production');
  assert.equal(resolveRuntimeEnvironment({ APP_ENV: 'staging', VERCEL_ENV: 'production' }), 'staging');
});

test('environment prefixes keep all three datasets separate', () => {
  assert.equal(environmentPrefix('project', 'development'), 'project_dev');
  assert.equal(environmentPrefix('project', 'staging'), 'project_staging');
  assert.equal(environmentPrefix('project', 'production'), 'project');
});
