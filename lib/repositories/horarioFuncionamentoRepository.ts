import { supabase } from "@/lib/supabase";
import { HorarioFuncionamento } from "@/lib/types";

export async function listarHorarios(salaoId: string): Promise<HorarioFuncionamento[]> {
  const { data, error } = await supabase.from("horarios_funcionamento").select("*").eq("salao_id", salaoId);
  if (error) throw error;
  return data as HorarioFuncionamento[];
}

export async function salvarHorario(horario: HorarioFuncionamento): Promise<void> {
  const { error } = await supabase.from("horarios_funcionamento").insert(horario);
  if (error) throw error;
}

export async function deletarHorario(id: string): Promise<void> {
  const { error } = await supabase.from("horarios_funcionamento").delete().eq("id", id);
  if (error) throw error;
}
