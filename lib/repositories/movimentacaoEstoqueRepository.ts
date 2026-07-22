import { supabase } from "@/lib/supabase";
import { MovimentacaoEstoque } from "@/lib/types";

export async function listarMovimentacoes(salaoId: string): Promise<MovimentacaoEstoque[]> {
  const { data, error } = await supabase
    .from("movimentacoes_estoque")
    .select("*")
    .eq("salao_id", salaoId)
    .order("criado_em", { ascending: false });
  if (error) throw error;
  return data as MovimentacaoEstoque[];
}

export async function salvarMovimentacao(mov: MovimentacaoEstoque): Promise<void> {
  const { error } = await supabase.from("movimentacoes_estoque").insert(mov);
  if (error) throw error;
}
