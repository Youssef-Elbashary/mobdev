/**
 * Interactive lab tracking uses the same device-locked progress store as
 * reading progress and per-lab attendance.
 */
import { getProgressStore } from '../progress/server';
import type { LabBackend } from './core';
import { ProgressLabBackend } from './progress-backend';

let backend: LabBackend | null | undefined;

export function getLabBackend(): LabBackend | null {
  if (backend !== undefined) return backend;
  // Prefer the existing progress database. Its Neon tables are created on
  // first use, so production does not get stuck on a missing manual SQL step.
  const progress = getProgressStore();
  if (progress) return (backend = new ProgressLabBackend(progress));
  return (backend = null);
}
