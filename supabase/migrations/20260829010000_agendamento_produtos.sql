create table if not exists public.agendamento_produtos (
  id uuid primary key,
  salao_id uuid not null references public.saloes(id) on delete cascade,
  agendamento_id uuid not null references public.agendamentos(id) on delete cascade,
  produto_id uuid not null references public.produtos(id),
  nome_produto text not null,
  preco_unitario numeric not null check (preco_unitario >= 0),
  quantidade numeric not null check (quantidade > 0),
  estoque_baixado boolean not null default false,
  criado_em timestamptz not null default now()
);

create index if not exists agendamento_produtos_agendamento_idx
  on public.agendamento_produtos (agendamento_id);

create index if not exists agendamento_produtos_produto_idx
  on public.agendamento_produtos (produto_id);

alter table public.agendamento_produtos enable row level security;

drop policy if exists "equipe acessa produtos das comandas do salao" on public.agendamento_produtos;
create policy "equipe acessa produtos das comandas do salao"
  on public.agendamento_produtos
  for all
  to authenticated
  using (
    exists (
      select 1 from public.perfis
      where perfis.id = auth.uid()
        and perfis.salao_id = agendamento_produtos.salao_id
    )
  )
  with check (
    exists (
      select 1 from public.perfis
      where perfis.id = auth.uid()
        and perfis.salao_id = agendamento_produtos.salao_id
    )
  );

create or replace function public.concluir_venda_produtos(p_agendamento_id uuid, p_forma_pagamento text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_salao_id uuid;
  v_item public.agendamento_produtos%rowtype;
  v_saldo numeric;
begin
  select salao_id into v_salao_id
  from public.agendamentos
  where id = p_agendamento_id;

  if v_salao_id is null or not exists (
    select 1 from public.perfis
    where id = auth.uid() and salao_id = v_salao_id
  ) then
    raise exception 'Acesso negado à comanda';
  end if;

  for v_item in
    select * from public.agendamento_produtos
    where agendamento_id = p_agendamento_id and estoque_baixado = false
    order by id
    for update
  loop
    select saldo into v_saldo
    from public.produtos
    where id = v_item.produto_id
    for update;

    if v_saldo is null then
      raise exception 'Produto % não encontrado', v_item.nome_produto;
    end if;
    if v_saldo < v_item.quantidade then
      raise exception 'Estoque insuficiente para %', v_item.nome_produto;
    end if;

    update public.produtos
    set saldo = saldo - v_item.quantidade
    where id = v_item.produto_id;

    insert into public.movimentacoes_estoque (
      id, salao_id, produto_id, tipo, quantidade, observacao
    ) values (
      gen_random_uuid(), v_item.salao_id, v_item.produto_id, 'VENDA',
      v_item.quantidade, 'Venda na comanda ' || p_agendamento_id::text
    );

    update public.agendamento_produtos
    set estoque_baixado = true
    where id = v_item.id;
  end loop;

  update public.agendamentos
  set status = 'CONCLUIDO', forma_pagamento = p_forma_pagamento
  where id = p_agendamento_id;
end;
$$;

revoke all on function public.concluir_venda_produtos(uuid, text) from public;
grant execute on function public.concluir_venda_produtos(uuid, text) to authenticated;
