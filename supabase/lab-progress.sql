-- Interactive lab progress for mobdev (Lab 02+). Run once in Supabase → SQL Editor (safe to run again).
-- Only the server's secret key (service_role) can read/write. *_dev tables are used by previews and local testing.

create table if not exists public.lab_students (
  lab          text not null,
  student_key  text not null,            -- lower-case student ID
  student_id   text not null,
  name         text not null,
  device_id    text not null,
  started_at   timestamptz not null default now(),
  last_seen    timestamptz not null default now(),
  completed_at timestamptz,              -- final challenge solved
  primary key (lab, student_key)
);

create table if not exists public.lab_attempts (
  lab          text not null,
  student_key  text not null,
  exercise     text not null,
  attempts     int  not null default 0,  -- times "Check" was pressed
  hints        int  not null default 0,
  best_score   real not null default 0,  -- 0..1 (share of checks passed)
  solved_at    timestamptz,
  first_at     timestamptz not null default now(),
  last_at      timestamptz not null default now(),
  primary key (lab, student_key, exercise)
);

create table if not exists public.lab_students_dev (like public.lab_students including all);
create table if not exists public.lab_attempts_dev (like public.lab_attempts including all);

alter table public.lab_students     enable row level security;
alter table public.lab_attempts     enable row level security;
alter table public.lab_students_dev enable row level security;
alter table public.lab_attempts_dev enable row level security;

-- One event (start / check / hint) → upsert the student and their exercise row, atomically.
create or replace function public.lab_record(
  p_dev boolean, p_lab text, p_student_key text, p_student_id text, p_name text, p_device text,
  p_event text, p_exercise text, p_result text, p_score real, p_final text
) returns void language plpgsql security invoker set search_path = public as $$
declare
  s text := case when p_dev then '_dev' else '' end;
begin
  execute format($q$
    insert into lab_students%1$s as t (lab, student_key, student_id, name, device_id)
    values ($1, $2, $3, $4, $5)
    on conflict (lab, student_key) do update
      set name = excluded.name, student_id = excluded.student_id, device_id = excluded.device_id, last_seen = now()
  $q$, s) using p_lab, p_student_key, p_student_id, p_name, p_device;

  if p_exercise is not null and p_event in ('check', 'hint') then
    execute format($q$
      insert into lab_attempts%1$s as a (lab, student_key, exercise, attempts, hints, best_score, solved_at)
      values ($1, $2, $3,
              case when $4 = 'check' then 1 else 0 end,
              case when $4 = 'hint' then 1 else 0 end,
              coalesce($5, 0),
              case when $6 = 'pass' then now() end)
      on conflict (lab, student_key, exercise) do update set
        attempts   = a.attempts + case when $4 = 'check' then 1 else 0 end,
        hints      = a.hints + case when $4 = 'hint' then 1 else 0 end,
        best_score = greatest(a.best_score, coalesce($5, 0)),
        solved_at  = coalesce(a.solved_at, case when $6 = 'pass' then now() end),
        last_at    = now()
    $q$, s) using p_lab, p_student_key, p_exercise, p_event, p_score, p_result;

    if p_result = 'pass' and p_exercise = p_final then
      execute format('update lab_students%1$s set completed_at = coalesce(completed_at, now()) where lab = $1 and student_key = $2', s)
        using p_lab, p_student_key;
    end if;
  end if;
end;
$$;

revoke execute on function public.lab_record(boolean, text, text, text, text, text, text, text, text, real, text) from public, anon, authenticated;
revoke all on public.lab_students, public.lab_attempts, public.lab_students_dev, public.lab_attempts_dev from anon, authenticated;
grant select, insert, update on public.lab_students, public.lab_attempts, public.lab_students_dev, public.lab_attempts_dev to service_role;
grant execute on function public.lab_record(boolean, text, text, text, text, text, text, text, text, real, text) to service_role;
