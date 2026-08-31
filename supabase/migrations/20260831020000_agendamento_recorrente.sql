-- Agrupa agendamentos gerados de uma vez como uma série recorrente (mesmo
-- cliente/profissional/serviços, repetindo semanal/quinzenal/mensal). Não
-- guarda a frequência em si — só o agrupamento, usado pra permitir excluir
-- "esta e as futuras" de uma vez a partir de qualquer ocorrência da série.

alter table public.agendamentos
  add column if not exists recorrencia_id uuid;

create index if not exists agendamentos_recorrencia_idx
  on public.agendamentos (recorrencia_id);

notify pgrst, 'reload schema';
