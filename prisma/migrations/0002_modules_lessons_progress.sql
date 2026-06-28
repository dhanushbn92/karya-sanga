-- Phase 1, step 2 — Modules, Lessons, Progress.
-- Apply once in the Supabase SQL editor AFTER step 1's User table exists.

create table if not exists public."Module" (
  id           text primary key,
  title        text not null,
  description  text,
  "order"      integer not null default 0,
  published    boolean not null default false,
  "createdAt"  timestamptz not null default now(),
  "updatedAt"  timestamptz not null default now()
);
create index if not exists "Module_order_idx" on public."Module" ("order");

create table if not exists public."Lesson" (
  id                text primary key,
  "moduleId"        text not null references public."Module"(id) on delete cascade,
  title             text not null,
  summary           text,
  body              text not null default '',
  "wokwiProjectUrl" text,
  difficulty        text,
  "order"           integer not null default 0,
  published         boolean not null default false,
  "createdAt"       timestamptz not null default now(),
  "updatedAt"       timestamptz not null default now()
);
create index if not exists "Lesson_moduleId_order_idx" on public."Lesson" ("moduleId", "order");

create table if not exists public."Progress" (
  id            text primary key,
  "userId"      uuid not null references public."User"(id) on delete cascade,
  "lessonId"    text not null references public."Lesson"(id) on delete cascade,
  completed     boolean not null default false,
  "completedAt" timestamptz,
  "createdAt"   timestamptz not null default now(),
  "updatedAt"   timestamptz not null default now(),
  unique ("userId", "lessonId")
);
create index if not exists "Progress_userId_idx" on public."Progress" ("userId");

-- Keep updatedAt fresh on row changes.
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new."updatedAt" = now();
  return new;
end;
$$;

drop trigger if exists module_set_updated_at on public."Module";
create trigger module_set_updated_at
  before update on public."Module"
  for each row execute function public.set_updated_at();

drop trigger if exists lesson_set_updated_at on public."Lesson";
create trigger lesson_set_updated_at
  before update on public."Lesson"
  for each row execute function public.set_updated_at();

drop trigger if exists progress_set_updated_at on public."Progress";
create trigger progress_set_updated_at
  before update on public."Progress"
  for each row execute function public.set_updated_at();
