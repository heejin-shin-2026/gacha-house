-- 뽑기 하우스 v2 — 별조각/뽑기권/배틀 승수 컬럼 추가
-- Supabase Dashboard > SQL Editor에서 실행하세요. (멱등)

alter table gacha_saves add column if not exists shards int not null default 0;
alter table gacha_saves add column if not exists battle_wins int not null default 0;
alter table gacha_saves add column if not exists tickets int not null default 0;
