-- Fila de espera: cliente quer um dia/horário que está lotado, fica anotado
-- aqui até o salão avisar (WhatsApp) que abriu vaga. Não bloqueia nem reserva
-- nada na agenda — é só uma lista de intenção pra não perder o cliente.

create table if not exists public.fila_espera (
  id uuid primary key,
  salao_id uuid not null references public.saloes(id) on delete cascade,
  cliente_id uuid not null references public.clientes(id) on delete cascade,
  servico_id uuid references public.servicos(id) on delete set null,
  profissional_id uuid references public.perfis(id) on delete set null,
  data_desejada date not null,
  observacao text not null default '',
  status text not null default 'ATIVO' check (status in ('ATIVO', 'ATENDIDO', 'CANCELADO')),
  criado_em timestamptz not null default now()
);

create index if not exists fila_espera_salao_idx
  on public.fila_espera (salao_id, status, data_desejada);

alter table public.fila_espera enable row level security;

drop policy if exists "equipe acessa fila de espera do salao" on public.fila_espera;
create policy "equipe acessa fila de espera do salao"
  on public.fila_espera
  for all
  to authenticated
  using (
    exists (
      select 1 from public.perfis
      where perfis.id = auth.uid()
        and perfis.salao_id = fila_espera.salao_id
    )
  )
  with check (
    exists (
      select 1 from public.perfis
      where perfis.id = auth.uid()
        and perfis.salao_id = fila_espera.salao_id
    )
  );

notify pgrst, 'reload schema';
