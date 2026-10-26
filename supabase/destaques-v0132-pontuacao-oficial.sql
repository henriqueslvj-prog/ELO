-- ELO V0.13.2 — Persistência das médias mensais conforme os critérios oficiais da System Saúde
begin;
alter table public.destaque_avaliacoes
  add column if not exists quality_avg_100 numeric(5,2),
  add column if not exists quality_points_15 integer,
  add column if not exists script_avg_10 numeric(4,2),
  add column if not exists ai_attendance_count integer not null default 0;

alter table public.destaque_avaliacoes
  drop constraint if exists destaque_avaliacoes_quality_avg_100_check;
alter table public.destaque_avaliacoes
  add constraint destaque_avaliacoes_quality_avg_100_check
  check (quality_avg_100 is null or (quality_avg_100 >= 0 and quality_avg_100 <= 100));

alter table public.destaque_avaliacoes
  drop constraint if exists destaque_avaliacoes_quality_points_15_check;
alter table public.destaque_avaliacoes
  add constraint destaque_avaliacoes_quality_points_15_check
  check (quality_points_15 is null or (quality_points_15 >= 0 and quality_points_15 <= 15));

alter table public.destaque_avaliacoes
  drop constraint if exists destaque_avaliacoes_script_avg_10_check;
alter table public.destaque_avaliacoes
  add constraint destaque_avaliacoes_script_avg_10_check
  check (script_avg_10 is null or (script_avg_10 >= 0 and script_avg_10 <= 10));

commit;
