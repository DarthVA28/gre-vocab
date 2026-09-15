-- GRE Vocab Trainer: run this in Supabase SQL Editor.
-- The word list itself lives in words.json; the database only stores each user's progress.

create table if not exists public.word_progress (
  user_id uuid not null references auth.users(id) on delete cascade,
  word_id integer not null,
  status text not null check (status in ('review', 'confident')),
  updated_at timestamptz not null default now(),
  primary key (user_id, word_id)
);

alter table public.word_progress enable row level security;

drop policy if exists "Users can read their own progress" on public.word_progress;
drop policy if exists "Users can insert their own progress" on public.word_progress;
drop policy if exists "Users can update their own progress" on public.word_progress;
drop policy if exists "Users can delete their own progress" on public.word_progress;

create policy "Users can read their own progress"
on public.word_progress for select
using (auth.uid() = user_id);

create policy "Users can insert their own progress"
on public.word_progress for insert
to authenticated
with check (auth.uid() = user_id);

create policy "Users can update their own progress"
on public.word_progress for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "Users can delete their own progress"
on public.word_progress for delete
to authenticated
using (auth.uid() = user_id);

-- Optional: tighten exposed table privileges to the authenticated role.
grant select, insert, update, delete on public.word_progress to authenticated;
revoke all on public.word_progress from anon;
