/**
 * ACCOUNTS — rules. Doctors and TAs sign in to run the platform; students may sign in (or just type their
 * name and ID in each lab, as before). Students are onboarded with their year, specialization and the
 * optional modules they chose, and see their modules first.
 * Pure functions only (no Node APIs), so they are unit-tested and shared with the browser.
 */

export const ROLES = ['super_admin', 'doctor', 'ta', 'student'] as const;
export type Role = (typeof ROLES)[number];
export const ROLE_LABEL: Record<Role, string> = { super_admin: 'Super admin', doctor: 'Doctor', ta: 'Teaching assistant', student: 'Student' };
/** Platform super admins (by email). They can manage roles & permissions and every account. */
export const SUPER_ADMINS = ['ali.motawea@bue.edu.eg'];

export type Profile = { year: string; specialization: string; modules: string[] };
export type PublicUser = { id: string; role: Role; name: string; email: string; studentId: string | null; profile: Profile; active: boolean; created_at: string; last_login: string | null };

export const SEMESTERS = ['Semester 1', 'Semester 2'] as const;
export type Semester = (typeof SEMESTERS)[number];
/** "General" = no specialization yet (before the specialization starts). */
export const GENERAL = 'General';

export const DEFAULT_SETTINGS = {
  years: ['Year 1', 'Year 2', 'Year 3', 'Year 4'],
  /** the semester the platform is running now (the admin switches it) */
  activeSemester: 'Semester 1' as Semester,
  /** specializations start here and continue to the final year */
  specFrom: { year: 'Year 3', semester: 'Semester 2' as Semester },
  specializations: ['Computer Science', 'Software Engineering', 'Artificial Intelligence', 'Cyber Security', 'Information Systems'],
};
export type Settings = { years: string[]; specializations: string[]; activeSemester: Semester; specFrom: { year: string; semester: Semester } };

/** Does a student in this year (during this semester) have a specialization? From specFrom (Year 3 · Semester 2) on. */
export function hasSpecialization(s: Pick<Settings, 'years' | 'specFrom'>, year: string, semester: Semester): boolean {
  const y = s.years.indexOf(year), from = s.years.indexOf(s.specFrom.year);
  if (y < 0 || from < 0) return false;
  return y > from || (y === from && SEMESTERS.indexOf(semester) >= SEMESTERS.indexOf(s.specFrom.semester));
}
/** Audience of the built-in course (Mobile Development): an optional module open to every specialization. */
export const BUILT_IN_AUDIENCE = { category: 'Optional', years: '', specializations: '', semester: 'Semester 1' };

export const NAME_RE = /^[\p{L}\p{M}][\p{L}\p{M}'’. -]*[\p{L}\p{M}.]$/u;
export const STUDENT_ID_RE = /^[A-Za-z0-9-]{3,20}$/;
const EMAIL_RE = /^[^\s@<>()",;]{1,64}@[^\s@<>()",;]{1,190}\.[A-Za-z]{2,24}$/;
export const MIN_PASSWORD = 10;
type Result<T> = { ok: true; value: T } | { ok: false; error: string };
const text = (v: unknown) => (typeof v === 'string' ? v.trim() : '');

export const normalEmail = (v: unknown) => text(v).toLowerCase();

export function checkPasswordRules(pw: unknown): string | null {
  const p = typeof pw === 'string' ? pw : '';
  if (p.length < MIN_PASSWORD) return `Use at least ${MIN_PASSWORD} characters.`;
  if (p.length > 200) return 'That password is too long.';
  if (!/[A-Za-z]/.test(p) || !/[0-9]/.test(p)) return 'Mix letters and numbers.';
  return null;
}

/** A student's year / specialization / optional modules, checked against the platform settings. */
export function parseProfile(input: Record<string, unknown>, settings: Settings, optional: string[]): Result<Profile> {
  const year = text(input.year);
  if (!settings.years.includes(year)) return { ok: false, error: 'Choose your year.' };
  // before the specialization starts (e.g. Year 3 · Semester 2) every student is "General"
  let specialization = text(input.specialization);
  if (!hasSpecialization(settings, year, settings.activeSemester)) specialization = GENERAL;
  else if (!settings.specializations.includes(specialization)) return { ok: false, error: 'Choose your specialization.' };
  const list = Array.isArray(input.modules) ? input.modules.map(String) : [];
  const modules = [...new Set(list)].filter((m) => optional.includes(m)).slice(0, 30);
  return { ok: true, value: { year, specialization, modules } };
}

export type NewAccount = { role: Role; name: string; email: string; password: string; studentId: string | null };

/** Validates a new account: students sign themselves up; doctors create doctor and TA accounts. */
export function parseAccount(input: Record<string, unknown>, allowed: readonly Role[]): Result<NewAccount> {
  const role = text(input.role) as Role;
  if (!allowed.includes(role)) return { ok: false, error: 'Choose a valid role.' };
  const name = text(input.name).normalize('NFC').replace(/\s+/g, ' ');
  if (name.length < 2 || name.length > 60 || !NAME_RE.test(name)) return { ok: false, error: 'Enter a full name (letters only).' };
  const email = normalEmail(input.email);
  if (!EMAIL_RE.test(email)) return { ok: false, error: 'Enter a valid email address.' };
  const pwError = checkPasswordRules(input.password);
  if (pwError) return { ok: false, error: pwError };
  let studentId: string | null = null;
  if (role === 'student') {
    studentId = text(input.studentId).toUpperCase();
    if (!STUDENT_ID_RE.test(studentId)) return { ok: false, error: 'Your student ID should be 3–20 letters or numbers.' };
  }
  return { ok: true, value: { role, name, email, password: input.password as string, studentId } };
}

/** Comma list → clean items ("Year 3, Year 4" → ["Year 3", "Year 4"]); empty means "everyone". */
export const listOf = (v: string | undefined) => (v ?? '').split(',').map((s) => s.trim()).filter(Boolean);
const has = (list: string[], v: string) => !list.length || list.some((x) => x.toLowerCase() === v.toLowerCase());

/** Who a module is for: its category, years, semester and specializations (empty list = everyone). */
export type Audience = { slug: string; category: 'Core' | 'Optional'; years: string[]; specializations: string[]; semester: 'Both' | Semester };

/** Runs in this semester? */
export const inSemester = (m: Pick<Audience, 'semester'>, semester: Semester) => m.semester === 'Both' || m.semester === semester;
/** Is this module for this student's year and specialization? ("General" students only match modules open to every specialization.) */
export const fitsStudent = (m: Pick<Audience, 'years' | 'specializations'>, p: Pick<Profile, 'year' | 'specialization'>) =>
  has(m.years, p.year) && (!m.specializations.length || (p.specialization !== GENERAL && has(m.specializations, p.specialization)));

/** Is this module for this student? Core: their year/specialization. Optional: only if they chose it. */
export function isForStudent(m: Audience, p: Profile): boolean {
  if (m.category === 'Optional') return p.modules.includes(m.slug);
  return fitsStudent(m, p);
}

/** Optional modules a student may pick during onboarding (open to their year and specialization). */
export const optionalFor = (all: Audience[], p: Pick<Profile, 'year' | 'specialization'>) => all.filter((m) => m.category === 'Optional' && fitsStudent(m, p));

export function parseSettings(input: Record<string, unknown>): Result<Settings> {
  const clean = (v: unknown) => (Array.isArray(v) ? v : typeof v === 'string' ? v.split('\n') : []).map((s) => String(s).trim()).filter(Boolean);
  const years = [...new Set(clean(input.years))].slice(0, 12);
  const specializations = [...new Set(clean(input.specializations))].slice(0, 40);
  if (!years.length) return { ok: false, error: 'Add at least one year.' };
  if (!specializations.length) return { ok: false, error: 'Add at least one specialization.' };
  if ([...years, ...specializations].some((s) => s.length > 60 || s.includes(','))) return { ok: false, error: 'Keep each item under 60 characters, without commas.' };
  if (specializations.includes(GENERAL)) return { ok: false, error: '“General” is reserved for students before their specialization.' };
  const sem = (v: unknown, fallback: Semester) => ((SEMESTERS as readonly string[]).includes(String(v)) ? (String(v) as Semester) : fallback);
  const activeSemester = sem(input.activeSemester, DEFAULT_SETTINGS.activeSemester);
  const fromYear = years.includes(String(input.specFromYear)) ? String(input.specFromYear) : years[Math.min(2, years.length - 1)];
  return { ok: true, value: { years, specializations, activeSemester, specFrom: { year: fromYear, semester: sem(input.specFromSemester, 'Semester 2') } } };
}
