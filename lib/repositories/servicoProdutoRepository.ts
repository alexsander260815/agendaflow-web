import { supabase } from "@/lib/supabase";
import { ServicoProduto } from "@/lib/types";

export async function listarServicoProdutos(salaoId: string): Promise<ServicoProduto[]> {
  const { data, error } = await supabase.from("servico_produtos").select("*").eq("salao_id", salaoId);
  if (error) throw error;
  return data as ServicoProduto[];
}

export async function listarServicoProdutosPorServico(servicoId: string): Promise<ServicoProduto[]> {
  const { data, error } = await supabase.from("servico_produtos").select("*").eq("servico_id", servicoId);
  if (error) throw error;
  return data as ServicoProduto[];
}

export async function definirConsumo(
  salaoId: string,
  servicoId: string,
  itens: { produto_id: string; quantidade_consumida: number }[]
): Promise<void> {
  const { error: erroDelete } = await supabase.from("servico_produtos").delete().eq("servico_id", servicoId);
  if (erroDelete) throw erroDelete;

  if (itens.length > 0) {
    const linhas: ServicoProduto[] = itens.map((item) => ({
      id: crypto.randomUUID(),
      salao_id: salaoId,
      servico_id: servicoId,
      produto_id: item.produto_id,
      quantidade_consumida: item.quantidade_consumida,
    }));
    const { error: erroInsert } = await supabase.from("servico_produtos").insert(linhas);
    if (erroInsert) throw erroInsert;
  }
}
