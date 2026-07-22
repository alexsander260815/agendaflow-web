import { supabase } from "@/lib/supabase";
import { Produto } from "@/lib/types";

export async function listarProdutos(salaoId: string): Promise<Produto[]> {
  const { data, error } = await supabase
    .from("produtos")
    .select("*")
    .eq("salao_id", salaoId)
    .order("nome", { ascending: true });
  if (error) throw error;
  return data as Produto[];
}

export async function salvarProduto(produto: Produto): Promise<void> {
  const { error } = await supabase.from("produtos").insert(produto);
  if (error) throw error;
}

export async function atualizarProduto(produto: Produto): Promise<void> {
  const { error } = await supabase.from("produtos").update(produto).eq("id", produto.id);
  if (error) throw error;
}

export async function atualizarSaldoProduto(id: string, saldo: number): Promise<void> {
  const { error } = await supabase.from("produtos").update({ saldo }).eq("id", id);
  if (error) throw error;
}

export async function deletarProduto(id: string): Promise<void> {
  const { error } = await supabase.from("produtos").delete().eq("id", id);
  if (error) throw error;
}
