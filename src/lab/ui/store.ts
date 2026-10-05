/**
 * What this browser remembers about the lab: the student's name/ID, and per exercise
 * the code, attempts, hints and whether it's solved. (The server keeps the instructor's copy.)
 */
export type ExerciseState = {
  status: 'new' | 'trying' | 'solved';
  attempts: number;
  hints: number;
  best: number;
  files?: Record<string, string>;
  answer?: unknown;
  solvedAt?: number;
};
export type Student = { name: string; id: string };

const ls = {
  get(key: string) {
    try {
      return localStorage.getItem(key);
    } catch {
      return null;
    }
  },
  set(key: string, value: string) {
    try {
      localStorage.setItem(key, value);
    } catch {
      /* private mode / full: progress just isn't remembered */
    }
  },
  remove(key: string) {
    try {
      localStorage.removeItem(key);
    } catch {
      /* ignore */
    }
  },
};

const EMPTY: ExerciseState = { status: 'new', attempts: 0, hints: 0, best: 0 };
const exKey = (lab: string, id: string) => `lab:${lab}:${id}`;

export function loadExercise(lab: string, id: string): ExerciseState {
  try {
    return { ...EMPTY, ...JSON.parse(ls.get(exKey(lab, id)) ?? '{}') };
  } catch {
    return { ...EMPTY };
  }
}

export function saveExercise(lab: string, id: string, patch: Partial<ExerciseState>): ExerciseState {
  const next = { ...loadExercise(lab, id), ...patch };
  ls.set(exKey(lab, id), JSON.stringify(next));
  window.dispatchEvent(new CustomEvent('lab:progress', { detail: { lab, id, state: next } }));
  return next;
}

export function loadAll(lab: string, ids: string[]): Record<string, ExerciseState> {
  return Object.fromEntries(ids.map((id) => [id, loadExercise(lab, id)]));
}

/* ----------------------------------------------------------- student */

const STUDENT = 'lab:student';
export const NAME_RE = /^[\p{L}\p{M}][\p{L}\p{M}'’. -]*[\p{L}\p{M}.]$/u;
export const ID_RE = /^[A-Za-z0-9-]{3,20}$/;

export function getStudent(): Student | null {
  try {
    const s = JSON.parse(ls.get(STUDENT) ?? 'null') as Student | null;
    return s && NAME_RE.test(s.name) && ID_RE.test(s.id) ? s : null;
  } catch {
    return null;
  }
}

export function setStudent(student: Student) {
  ls.set(STUDENT, JSON.stringify(student));
  window.dispatchEvent(new CustomEvent('lab:student', { detail: student }));
}

export function clearStudent() {
  ls.remove(STUDENT);
  window.dispatchEvent(new CustomEvent('lab:student', { detail: null }));
}

/** Same device id the attendance page uses (localStorage + cookie). */
export function deviceId(): string {
  const cookie = document.cookie.match(/(?:^|; )att_device=([^;]+)/)?.[1];
  let id = ls.get('att-device') || cookie || '';
  if (!/^[A-Za-z0-9_-]{16,64}$/.test(id)) {
    id = crypto.randomUUID ? crypto.randomUUID() : Array.from(crypto.getRandomValues(new Uint8Array(16)), (b) => b.toString(16).padStart(2, '0')).join('');
  }
  ls.set('att-device', id);
  const secure = location.protocol === 'https:' ? '; secure' : '';
  document.cookie = `att_device=${id}; max-age=${60 * 60 * 24 * 365 * 5}; path=/; samesite=lax${secure}`;
  return id;
}

export const storage = ls;
