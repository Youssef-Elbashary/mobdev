/** Lab progress stored in Supabase (tables + RPC from supabase/lab-progress.sql). Server-side only. */
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { LABS, type AttemptRow, type LabBackend, type LabEvent, type StudentRow } from './core';

const PAGE = 1000; // PostgREST returns at most 1000 rows per request

export class SupabaseLabBackend implements LabBackend {
  private db: SupabaseClient;
  private suffix: string;

  constructor(url: string, key: string, private dev: boolean) {
    this.db = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } });
    this.suffix = dev ? '_dev' : '';
  }

  async record(e: LabEvent) {
    const { error } = await this.db.rpc('lab_record', {
      p_dev: this.dev,
      p_lab: e.lab,
      p_student_key: e.studentKey,
      p_student_id: e.studentId,
      p_name: e.name,
      p_device: e.deviceId,
      p_event: e.event,
      p_exercise: e.exercise,
      p_result: e.result,
      p_score: e.score,
      p_final: LABS[e.lab]?.final ?? null,
    });
    if (error) throw new Error(`lab_record failed: ${error.message}`);
  }

  private async all<T>(table: string, columns: string, lab: string): Promise<T[]> {
    const out: T[] = [];
    for (let from = 0; ; from += PAGE) {
      const { data, error } = await this.db.from(table).select(columns).eq('lab', lab).range(from, from + PAGE - 1);
      if (error) throw new Error(`${table}: ${error.message}`);
      out.push(...((data ?? []) as T[]));
      if (!data || data.length < PAGE) return out;
    }
  }

  async rows(lab: string) {
    const [students, attempts] = await Promise.all([
      this.all<StudentRow>(`lab_students${this.suffix}`, 'student_key, student_id, name, started_at, last_seen, completed_at', lab),
      this.all<AttemptRow>(`lab_attempts${this.suffix}`, 'student_key, exercise, attempts, hints, best_score, solved_at', lab),
    ]);
    return { students, attempts };
  }

  async hit(key: string, windowSec: number) {
    // reuses the attendance rate-limit counter (attendance_hit in supabase/attendance.sql)
    const { data, error } = await this.db.rpc('attendance_hit', { p_key: `lab${this.suffix}:${key}`, p_window_seconds: windowSec });
    if (error) throw new Error(`attendance_hit failed: ${error.message}`);
    return Number(data) || 0;
  }
}
