import { supabase } from "@/lib/supabase";
import { FilaEspera } from "@/lib/types";

export async function criarFilaEspera(item: Omit<FilaEspera, "criado_em">): Promise<void> {
  const { error } = await supabase.from("fila_espera").insert(item);
  if (error) throw error;
}

export async function listarFilaEspera(salaoId: string): Promise<FilaEspera[]> {
  const { data, error } = await supabase
    .from("fila_espera")
    .select("*")
    .eq("salao_id", salaoId)
    .order("data_desejada", { ascending: true });
  if (error) throw error;
  return data as FilaEspera[];
}

export async function atualizarStatusFilaEspera(id: string, status: FilaEspera["status"]): Promise<void> {
  const { error } = await supabase.from("fila_espera").update({ status }).eq("id", id);
  if (error) throw error;
}

export async function deletarFilaEspera(id: string): Promise<void> {
  const { error } = await supabase.from("fila_espera").delete().eq("id", id);
  if (error) throw error;
}
