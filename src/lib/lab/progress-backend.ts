/**
 * Adapter from the established Neon progress store to the interactive Lab 02
 * dashboard. This keeps both admin views on one auto-migrating database and
 * avoids requiring a second Supabase schema just for interactive exercises.
 */
import type { ProgressStore } from '../progress/store.ts';
import { LABS, type AttemptRow, type LabBackend, type LabEvent, type StudentRow } from './core.ts';

export class ProgressLabBackend implements LabBackend {
  private store: ProgressStore;

  constructor(store: ProgressStore) {
    this.store = store;
  }

  async record(event: LabEvent) {
    const identity = await this.store.touchStudent({
      studentKey: event.studentKey,
      studentId: event.studentId,
      name: event.name,
      deviceKey: event.deviceId,
    });
    if (identity === 'conflict') throw new Error('identity-conflict');

    if (event.event !== 'check' || !event.exercise) return;
    const total = 100;
    const passed = event.result === 'pass' ? total : Math.round((event.score ?? 0) * total);
    await this.store.addAttempt({
      studentKey: event.studentKey,
      lab: event.lab,
      exercise: event.exercise,
      passed,
      total,
      code: JSON.stringify({ source: 'interactive-lab', result: event.result }),
    });
  }

  async rows(lab: string): Promise<{ students: StudentRow[]; attempts: AttemptRow[] }> {
    const data = await this.store.labData(lab);
    const final = LABS[lab]?.final;
    const students = data.students.map((student) => {
      const completedAt = data.best.find(
        (attempt) => attempt.student_key === student.student_key && attempt.exercise === final && attempt.solvedAt,
      )?.solvedAt ?? null;
      return {
        student_key: student.student_key,
        student_id: student.student_id,
        name: student.name,
        started_at: student.created_at,
        last_seen: student.last_seen,
        completed_at: completedAt,
        checked_in_at: data.checkins.find((checkin) => checkin.student_key === student.student_key)?.at ?? null,
      };
    });
    const attempts = data.best.map((attempt) => ({
      student_key: attempt.student_key,
      exercise: attempt.exercise,
      attempts: attempt.attempts,
      hints: 0,
      best_score: attempt.total > 0 ? attempt.passed / attempt.total : 0,
      solved_at: attempt.solvedAt,
    }));
    return { students, attempts };
  }

  hit(key: string, windowSec: number) {
    return this.store.hit(`interactive:${key}`, windowSec);
  }
}
