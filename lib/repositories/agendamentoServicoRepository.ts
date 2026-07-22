import { supabase } from "@/lib/supabase";
import { AgendamentoServico } from "@/lib/types";

export async function listarAgendamentoServicos(salaoId: string): Promise<AgendamentoServico[]> {
  const { data, error } = await supabase.from("agendamento_servicos").select("*").eq("salao_id", salaoId);
  if (error) throw error;
  return data as AgendamentoServico[];
}

export async function listarItensPorAgendamento(agendamentoId: string): Promise<AgendamentoServico[]> {
  const { data, error } = await supabase
    .from("agendamento_servicos")
    .select("*")
    .eq("agendamento_id", agendamentoId);
  if (error) throw error;
  return data as AgendamentoServico[];
}

export async function salvarItensComanda(agendamentoId: string, itens: AgendamentoServico[]): Promise<void> {
  const { error: erroDelete } = await supabase
    .from("agendamento_servicos")
    .delete()
    .eq("agendamento_id", agendamentoId);
  if (erroDelete) throw erroDelete;

  if (itens.length > 0) {
    const { error: erroInsert } = await supabase.from("agendamento_servicos").insert(itens);
    if (erroInsert) throw erroInsert;
  }
}

export async function marcarComoDescontado(itemId: string): Promise<void> {
  const { error } = await supabase
    .from("agendamento_servicos")
    .update({ pacote_descontado: true })
    .eq("id", itemId);
  if (error) throw error;
}

export async function marcarComissaoFechada(itemId: string): Promise<void> {
  const { error } = await supabase
    .from("agendamento_servicos")
    .update({ comissao_fechada: true })
    .eq("id", itemId);
  if (error) throw error;
}

export async function deletarItensPorAgendamento(agendamentoId: string): Promise<void> {
  const { error } = await supabase.from("agendamento_servicos").delete().eq("agendamento_id", agendamentoId);
  if (error) throw error;
}
