-- Vocabulary collections and words
-- Run in Supabase SQL Editor if tables don't exist

create table if not exists public.vocab_collections (
  id           uuid default gen_random_uuid() primary key,
  user_id      uuid references public.profiles(id) on delete cascade not null,
  name         text not null,
  created_at   timestamptz default now()
);

alter table public.vocab_collections enable row level security;

drop policy if exists "vocab_collections_all" on public.vocab_collections;
create policy "vocab_collections_all" on public.vocab_collections
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create table if not exists public.vocab_words (
  id               uuid default gen_random_uuid() primary key,
  user_id          uuid references public.profiles(id) on delete cascade not null,
  collection_id    uuid references public.vocab_collections(id) on delete cascade not null,
  word             text not null,
  uzbek_translation text,
  definition       text,
  example          text,
  extra            jsonb,
  source           text default 'manual',
  created_at       timestamptz default now()
);

alter table public.vocab_words enable row level security;

drop policy if exists "vocab_words_all" on public.vocab_words;
create policy "vocab_words_all" on public.vocab_words
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
