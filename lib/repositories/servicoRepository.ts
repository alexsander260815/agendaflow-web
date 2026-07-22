import { supabase } from "@/lib/supabase";
import { Servico } from "@/lib/types";

export async function listarServicos(salaoId: string): Promise<Servico[]> {
  const { data, error } = await supabase
    .from("servicos")
    .select("*")
    .eq("salao_id", salaoId)
    .order("nome", { ascending: true });
  if (error) throw error;
  return data as Servico[];
}

export async function buscarServico(id: string): Promise<Servico | null> {
  const { data, error } = await supabase.from("servicos").select("*").eq("id", id).maybeSingle();
  if (error) throw error;
  return data as Servico | null;
}

export async function salvarServico(servico: Servico): Promise<void> {
  const { error } = await supabase.from("servicos").insert(servico);
  if (error) throw error;
}

export async function atualizarServico(id: string, servico: Servico): Promise<void> {
  const { error } = await supabase.from("servicos").update(servico).eq("id", id);
  if (error) throw error;
}

export async function deletarServico(id: string): Promise<void> {
  const { error } = await supabase.from("servicos").delete().eq("id", id);
  if (error) throw error;
}
