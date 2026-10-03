-- Attendance tables for mobile-development-course.
-- Run once in Supabase → SQL Editor. No public access: only the server's secret key can read/write.
create table if not exists public.attendance (
  n           bigint generated always as identity primary key,
  name        text not null,
  student_id  text not null,
  student_key text not null unique,   -- lower-case ID: one check-in per student
  device_id   text not null unique,   -- one check-in per phone/PC
  created_at  timestamptz not null default now()
);
create table if not exists public.attendance_dev (like public.attendance including all);  -- for testing, keeps the real list clean
create table if not exists public.attendance_hits (key text primary key, n int not null, until timestamptz not null);

alter table public.attendance      enable row level security;
alter table public.attendance_dev  enable row level security;
alter table public.attendance_hits enable row level security;

-- counts login attempts (brute-force protection for /admin)
create or replace function public.attendance_hit(p_key text, p_window_seconds int)
returns int language sql security invoker set search_path = public as $$
  insert into attendance_hits as h (key, n, until)
  values (p_key, 1, now() + make_interval(secs => p_window_seconds))
  on conflict (key) do update set
    n     = case when h.until < now() then 1 else h.n + 1 end,
    until = case when h.until < now() then now() + make_interval(secs => p_window_seconds) else h.until end
  returning n;
$$;
revoke execute on function public.attendance_hit(text, int) from public, anon, authenticated;

-- only the server (secret key = service_role) may touch these tables; the public keys get nothing
revoke all on public.attendance, public.attendance_dev, public.attendance_hits from anon, authenticated;
grant select, insert on public.attendance, public.attendance_dev to service_role;
grant select, insert, update on public.attendance_hits to service_role;
grant execute on function public.attendance_hit(text, int) to service_role;
