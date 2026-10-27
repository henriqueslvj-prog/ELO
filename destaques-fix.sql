-- ELO — correção de integridade do módulo Destaque do Mês
-- Pode ser executado no Supabase SQL Editor sem apagar os dados existentes.

alter table public.destaque_colaboradores
  add column if not exists sector text;

update public.destaque_colaboradores
set sector = coalesce(nullif(sector, ''), nullif(setor, ''), 'Atendimento')
where sector is null or sector = '';

alter table public.destaque_colaboradores
  alter column sector set default 'Atendimento';

-- Garante que os registros de atendimento apontem para o cadastro
-- específico da equipe avaliada, e não para public.profiles.
alter table public.destaque_atendimentos
  drop constraint if exists destaque_atendimentos_employee_id_fkey;

alter table public.destaque_atendimentos
  add constraint destaque_atendimentos_employee_id_fkey
  foreign key (employee_id)
  references public.destaque_colaboradores(id)
  on delete restrict;

alter table public.destaque_avaliacoes
  drop constraint if exists destaque_avaliacoes_employee_id_fkey;

alter table public.destaque_avaliacoes
  add constraint destaque_avaliacoes_employee_id_fkey
  foreign key (employee_id)
  references public.destaque_colaboradores(id)
  on delete restrict;

create index if not exists idx_destaque_colaboradores_sector
  on public.destaque_colaboradores(sector);

-- Diagnóstico opcional: deve retornar as constraints acima apontando para
-- public.destaque_colaboradores.
select
  tc.table_name,
  tc.constraint_name,
  ccu.table_name as referenced_table,
  ccu.column_name as referenced_column
from information_schema.table_constraints tc
join information_schema.constraint_column_usage ccu
  on ccu.constraint_name = tc.constraint_name
where tc.table_schema = 'public'
  and tc.constraint_name in (
    'destaque_atendimentos_employee_id_fkey',
    'destaque_avaliacoes_employee_id_fkey'
  );
