import { supabase } from "@/lib/supabase";
import { Pacote } from "@/lib/types";

export async function listarPacotes(salaoId: string): Promise<Pacote[]> {
  const { data, error } = await supabase.from("pacotes").select("*").eq("salao_id", salaoId);
  if (error) throw error;
  return data as Pacote[];
}

export async function salvarPacote(pacote: Pacote): Promise<void> {
  const { error } = await supabase.from("pacotes").insert(pacote);
  if (error) throw error;
}

export async function deletarPacote(id: string): Promise<void> {
  const { error } = await supabase.from("pacotes").delete().eq("id", id);
  if (error) throw error;
}
