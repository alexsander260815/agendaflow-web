import { supabase } from "@/lib/supabase";
import { BloqueioAgenda } from "@/lib/types";

export async function criarBloqueioAgenda(
  bloqueio: Omit<BloqueioAgenda, "id" | "criado_em">
): Promise<void> {
  const { error } = await supabase.from("bloqueios_agenda").insert(bloqueio);
  if (error) throw error;
}

export async function listarBloqueiosAgenda(salaoId: string): Promise<BloqueioAgenda[]> {
  const { data, error } = await supabase
    .from("bloqueios_agenda")
    .select("*")
    .eq("salao_id", salaoId)
    .order("data_inicio", { ascending: true });
  if (error) throw error;
  return data as BloqueioAgenda[];
}

export async function deletarBloqueioAgenda(id: string): Promise<void> {
  const { error } = await supabase.from("bloqueios_agenda").delete().eq("id", id);
  if (error) throw error;
}
