-- Run this once in the Supabase SQL editor to set up the schema and seed data.

create table if not exists quizzes (
  quiz_id    text primary key,
  title      text        not null,
  master_key text[]      not null   -- ordered array of correct answers, e.g. {'A','B','C'}
);

create table if not exists submissions (
  id              uuid        primary key default gen_random_uuid(),
  student_name    text        not null,
  quiz_id         text        references quizzes(quiz_id),
  quiz_title      text,
  score           integer,
  total_questions integer,
  percentage      integer,
  answers         text[],
  submitted_at    timestamptz not null default now()
);

create index if not exists submissions_submitted_at_idx on submissions (submitted_at desc);

-- ── Seed quizzes ──────────────────────────────────────────────────────────────
insert into quizzes (quiz_id, title, master_key) values
  ('math101', 'Mathematics 101',     '{A,B,C,A,D}'),
  ('sci101',  'General Science 101', '{B,A,D,C,B}'),
  ('eng101',  'English Grammar 101', '{C,A,B,D,C}')
on conflict (quiz_id) do nothing;
