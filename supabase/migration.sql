-- 뽑기 하우스 — Supabase 마이그레이션 (새 프로젝트용)
-- Supabase Dashboard > SQL Editor에서 실행하세요.

create table if not exists gacha_saves (
  id uuid primary key default gen_random_uuid(),
  player_name text not null,
  player_code text not null check (char_length(player_code) = 4),
  coins int not null default 100,
  inventory jsonb not null default '{}'::jsonb,
  total_draws int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (player_name, player_code)
);

alter table gacha_saves enable row level security;

do $$
begin
  if not exists (select 1 from pg_policies where policyname = 'gacha anon select' and tablename = 'gacha_saves') then
    create policy "gacha anon select" on gacha_saves for select to anon using (true);
  end if;
  if not exists (select 1 from pg_policies where policyname = 'gacha anon insert' and tablename = 'gacha_saves') then
    create policy "gacha anon insert" on gacha_saves for insert to anon with check (true);
  end if;
  if not exists (select 1 from pg_policies where policyname = 'gacha anon update' and tablename = 'gacha_saves') then
    create policy "gacha anon update" on gacha_saves for update to anon using (true) with check (true);
  end if;
end $$;
