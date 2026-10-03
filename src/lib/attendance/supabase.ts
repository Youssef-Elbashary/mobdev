/**
 * ATTENDANCE — Supabase backend (server-side only, uses the project's secret key).
 * Tables and the attendance_hit() function are created by supabase/attendance.sql.
 * The "once per device" and "once per student ID" rules are enforced by UNIQUE constraints,
 * so they hold even when a whole class submits at the same moment.
 */
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { classifyDuplicate, type AttendanceBackend, type CheckInInput, type CheckInResult, type Entry } from './core';

type Row = { n: number | string; name: string; student_id: string; created_at: string };
const COLS = 'n,name,student_id,created_at';
const toEntry = (r: Row): Entry => ({ n: Number(r.n), name: r.name, id: r.student_id, at: new Date(r.created_at).toISOString() });

export class SupabaseStore implements AttendanceBackend {
  #db: SupabaseClient;
  #table: string;
  #max: number;

  constructor(url: string, key: string, table: string, opts: { maxEntries?: number } = {}) {
    this.#db = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } });
    this.#table = table;
    this.#max = opts.maxEntries ?? 5000;
  }

  async #byDevice(deviceId: string): Promise<Entry | undefined> {
    const { data, error } = await this.#db.from(this.#table).select(COLS).eq('device_id', deviceId).maybeSingle();
    if (error) throw error;
    return data ? toEntry(data as Row) : undefined;
  }

  async checkIn({ deviceId, name, studentId }: CheckInInput & { at: string }): Promise<CheckInResult> {
    const existing = await this.#byDevice(deviceId);
    if (existing) return { status: 'device', entry: existing };
    if ((await this.count()) >= this.#max) return { status: 'full' };

    const { data, error } = await this.#db
      .from(this.#table)
      .insert({ name, student_id: studentId, student_key: studentId.toLowerCase(), device_id: deviceId })
      .select(COLS)
      .single();

    if (error) {
      const kind = classifyDuplicate(error);
      if (kind === 'id') return { status: 'id' };
      if (kind === 'device') {
        const entry = await this.#byDevice(deviceId);
        return entry ? { status: 'device', entry } : { status: 'device' };
      }
      throw error;
    }
    return { status: 'ok', entry: toEntry(data as Row) };
  }

  async list(from = 0): Promise<Entry[]> {
    const { data, error } = await this.#db.from(this.#table).select(COLS).gt('n', from).order('n', { ascending: true }).limit(5000);
    if (error) throw error;
    return (data as Row[]).map(toEntry);
  }

  async count(): Promise<number> {
    const { count, error } = await this.#db.from(this.#table).select('n', { count: 'exact', head: true });
    if (error) throw error;
    return count ?? 0;
  }

  async hit(key: string, windowSec: number): Promise<number> {
    const { data, error } = await this.#db.rpc('attendance_hit', { p_key: `${this.#table}:${key}`, p_window_seconds: windowSec });
    if (error) throw error;
    return Number(data);
  }
}
