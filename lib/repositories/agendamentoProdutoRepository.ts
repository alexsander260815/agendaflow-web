import { supabase } from "@/lib/supabase";
import { ProdutoComanda } from "@/lib/types";

export async function listarProdutosDaComanda(agendamentoId: string): Promise<ProdutoComanda[]> {
  const { data, error } = await supabase
    .from("agendamento_produtos")
    .select("*")
    .eq("agendamento_id", agendamentoId)
    .order("criado_em", { ascending: true });
  if (error) throw error;
  return data as ProdutoComanda[];
}

export async function salvarProdutosDaComanda(
  agendamentoId: string,
  salaoId: string,
  produtos: Omit<ProdutoComanda, "id" | "salao_id" | "agendamento_id" | "estoque_baixado">[]
): Promise<void> {
  const { error: erroDelete } = await supabase
    .from("agendamento_produtos")
    .delete()
    .eq("agendamento_id", agendamentoId)
    .eq("estoque_baixado", false);
  if (erroDelete) throw erroDelete;

  if (!produtos.length) return;
  const { error } = await supabase.from("agendamento_produtos").insert(
    produtos.map((produto) => ({
      ...produto,
      id: crypto.randomUUID(),
      salao_id: salaoId,
      agendamento_id: agendamentoId,
      estoque_baixado: false,
    }))
  );
  if (error) throw error;
}

export async function concluirVendaProdutos(agendamentoId: string, formaPagamento: string): Promise<void> {
  const { error } = await supabase.rpc("concluir_venda_produtos", {
    p_agendamento_id: agendamentoId,
    p_forma_pagamento: formaPagamento,
  });
  if (error) throw error;
}

// Contraparte de concluirVendaProdutos — devolve estoque de produtos vendidos
// e sessões de pacote descontadas quando uma comanda CONCLUIDO é cancelada,
// marcada como falta, ou reaberta.
export async function estornarComanda(agendamentoId: string): Promise<void> {
  const { error } = await supabase.rpc("estornar_comanda", {
    p_agendamento_id: agendamentoId,
  });
  if (error) throw error;
}
