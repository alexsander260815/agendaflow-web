-- Contraparte do concluir_venda_produtos: desfaz uma comanda CONCLUIDO quando
-- ela é cancelada, marcada como falta, ou reaberta. Sem isso, o estoque e a
-- sessão de pacote descontados na conclusão ficavam perdidos pra sempre — o
-- Android já tem esse comportamento (estornarComandaSeConcluida), o web não
-- tinha nada equivalente.

create or replace function public.estornar_comanda(p_agendamento_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_salao_id uuid;
  v_item_produto public.agendamento_produtos%rowtype;
  v_item_servico record;
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

  -- devolve estoque de produtos já vendidos nessa comanda
  for v_item_produto in
    select * from public.agendamento_produtos
    where agendamento_id = p_agendamento_id and estoque_baixado = true
    order by id
    for update
  loop
    update public.produtos
    set saldo = saldo + v_item_produto.quantidade
    where id = v_item_produto.produto_id;

    insert into public.movimentacoes_estoque (
      id, salao_id, produto_id, tipo, quantidade, observacao
    ) values (
      gen_random_uuid(), v_item_produto.salao_id, v_item_produto.produto_id, 'ESTORNO',
      v_item_produto.quantidade, 'Estorno da comanda ' || p_agendamento_id::text
    );

    update public.agendamento_produtos
    set estoque_baixado = false
    where id = v_item_produto.id;
  end loop;

  -- devolve sessão de pacote já descontada nessa comanda
  for v_item_servico in
    select id, cliente_pacote_id from public.agendamento_servicos
    where agendamento_id = p_agendamento_id
      and pacote_descontado = true
      and cliente_pacote_id is not null
    order by id
    for update
  loop
    update public.cliente_pacotes
    set quantidade_restante = quantidade_restante + 1
    where id = v_item_servico.cliente_pacote_id;

    update public.agendamento_servicos
    set pacote_descontado = false
    where id = v_item_servico.id;
  end loop;
end;
$$;

revoke all on function public.estornar_comanda(uuid) from public;
grant execute on function public.estornar_comanda(uuid) to authenticated;
