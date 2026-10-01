-- ELO V0.10 — Base de conhecimento da IA para o Destaque do Mês
-- Arquitetura: Referência -> Critério -> Análise IA
-- Pode ser executado sem apagar dados existentes.

create table if not exists public.destaque_referencias_ia (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  reference_type text not null default 'script_atendimento'
    check (reference_type in ('script_atendimento','politica','processo','manual','outro')),
  version text not null default '1.0',
  content text not null,
  active boolean not null default true,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.destaque_criterio_referencias (
  id uuid primary key default gen_random_uuid(),
  criterion_id uuid not null references public.destaque_criterios(id) on delete cascade,
  reference_id uuid not null references public.destaque_referencias_ia(id) on delete cascade,
  priority integer not null default 1,
  created_at timestamptz not null default now(),
  unique(criterion_id, reference_id)
);

create index if not exists idx_destaque_referencias_active
  on public.destaque_referencias_ia(active);
create index if not exists idx_destaque_referencias_type
  on public.destaque_referencias_ia(reference_type);
create index if not exists idx_destaque_criterio_referencias_criterion
  on public.destaque_criterio_referencias(criterion_id);
create index if not exists idx_destaque_criterio_referencias_reference
  on public.destaque_criterio_referencias(reference_id);

alter table public.destaque_referencias_ia enable row level security;
alter table public.destaque_criterio_referencias enable row level security;

drop policy if exists destaque_referencias_select on public.destaque_referencias_ia;
create policy destaque_referencias_select on public.destaque_referencias_ia
for select to authenticated using (public.has_permission('destaques','view'));

drop policy if exists destaque_referencias_insert on public.destaque_referencias_ia;
create policy destaque_referencias_insert on public.destaque_referencias_ia
for insert to authenticated with check (public.has_permission('destaques','create'));

drop policy if exists destaque_referencias_update on public.destaque_referencias_ia;
create policy destaque_referencias_update on public.destaque_referencias_ia
for update to authenticated using (public.has_permission('destaques','edit'))
with check (public.has_permission('destaques','edit'));

drop policy if exists destaque_referencias_delete on public.destaque_referencias_ia;
create policy destaque_referencias_delete on public.destaque_referencias_ia
for delete to authenticated using (public.has_permission('destaques','delete'));

drop policy if exists destaque_criterio_referencias_select on public.destaque_criterio_referencias;
create policy destaque_criterio_referencias_select on public.destaque_criterio_referencias
for select to authenticated using (public.has_permission('destaques','view'));

drop policy if exists destaque_criterio_referencias_insert on public.destaque_criterio_referencias;
create policy destaque_criterio_referencias_insert on public.destaque_criterio_referencias
for insert to authenticated with check (public.has_permission('destaques','create'));

drop policy if exists destaque_criterio_referencias_update on public.destaque_criterio_referencias;
create policy destaque_criterio_referencias_update on public.destaque_criterio_referencias
for update to authenticated using (public.has_permission('destaques','edit'))
with check (public.has_permission('destaques','edit'));

drop policy if exists destaque_criterio_referencias_delete on public.destaque_criterio_referencias;
create policy destaque_criterio_referencias_delete on public.destaque_criterio_referencias
for delete to authenticated using (public.has_permission('destaques','delete'));

grant select, insert, update, delete on public.destaque_referencias_ia to authenticated;
grant select, insert, update, delete on public.destaque_criterio_referencias to authenticated;

-- Script oficial de atendimento fornecido para o ELO.
insert into public.destaque_referencias_ia
  (slug, name, reference_type, version, content, active)
values
  (
    'system-saude-roteiro-atendimento',
    'Roteiro de Atendimento — System Saúde',
    'script_atendimento',
    '1.0',
    $$ROTEIRO DE ATENDIMENTO — SYSTEM SAÚDE

1. ABERTURA
Olá, tudo bem? 😊
Me chamo Mayara, sou da System Saúde Caruaru e vou iniciar seu atendimento. 💚
Pode me informar seu nome completo e CPF, por gentileza?

2. APÓS LOCALIZAR O CADASTRO
Maravilhoso dia, Maria! 😊
Cadastro localizado com sucesso. 💚
Em que posso te ajudar?
E em qual cidade deseja atendimento?

3. IDENTIFICAR A NECESSIDADE
Perfeito! 😊
Qual especialidade ou exame você precisa?

4. VERIFICAR DISPONIBILIDADE
Só um momento, vou verificar a disponibilidade para você. 💚

5. ENVIO DE HORÁRIOS — FOCO NO FECHAMENTO
Perfeito! Temos essas opções disponíveis:
• [Dia/Hora]
• [Dia/Hora]
• [Dia/Hora]
Qual horário fica melhor para você? 😊

6. QUANDO DEPENDER DE CONFIRMAÇÃO DA CLÍNICA
Já vou solicitar seu agendamento e, assim que receber a confirmação, retorno para você. 💚

7. CONFIRMAÇÃO DO AGENDAMENTO
Agendamento confirmado
Paciente:
Data:
Horário:
Clínica / Médico:
Especialidade/Exame:
Preparo (se houver):

Orientações:
• Chegar com 20 minutos de antecedência;
• Em caso de atraso, poderá haver reagendamento;
• Cancelamentos devem ser informados com 1 dia de antecedência.

Sua guia possui validade de 90 dias.

8. PAGAMENTO DA GUIA
Para receber sua guia de atendimento, o pagamento pode ser realizado:
✓ Pix
✓ Cartão via link (com acréscimo de juros);
✓ Presencialmente na unidade System Saúde.

Após o pagamento, sua guia já poderá ser gerada em PDF através do link.
Se tiver dificuldade, posso enviar para você. 💚 Qual modalidade deseja?

9. AJUDO EM ALGO MAIS?
Posso te ajudar em algo mais? 😊

10. FINALIZAÇÃO
Espero ter ajudado da melhor forma! 😊 Foi um prazer atender você. 💚

CUIDAR DE VOCÊ É O NOSSO PROPÓSITO!$$,
    true
  )
on conflict (slug) do update set
  name = excluded.name,
  reference_type = excluded.reference_type,
  version = excluded.version,
  content = excluded.content,
  active = excluded.active,
  updated_at = now();

-- Vincula automaticamente o roteiro ao critério "Qualidade do Atendimento",
-- se esse critério já existir.
insert into public.destaque_criterio_referencias (criterion_id, reference_id, priority)
select c.id, r.id, 1
from public.destaque_criterios c
cross join public.destaque_referencias_ia r
where lower(trim(c.name)) = lower('Qualidade do Atendimento')
  and r.slug = 'system-saude-roteiro-atendimento'
on conflict (criterion_id, reference_id) do update set priority = excluded.priority;

-- Diagnóstico opcional: mostra o vínculo do script com o critério.
select
  c.name as criterio,
  r.name as referencia,
  r.version,
  r.active
from public.destaque_criterio_referencias cr
join public.destaque_criterios c on c.id = cr.criterion_id
join public.destaque_referencias_ia r on r.id = cr.reference_id
where r.slug = 'system-saude-roteiro-atendimento';
