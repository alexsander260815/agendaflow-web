import { supabase } from "@/lib/supabase";
import { Agendamento } from "@/lib/types";

export async function listarAgendamentos(salaoId: string): Promise<Agendamento[]> {
  const { data, error } = await supabase
    .from("agendamentos")
    .select("*")
    .eq("salao_id", salaoId)
    .order("data_hora", { ascending: true });
  if (error) throw error;
  return data as Agendamento[];
}

export async function buscarAgendamento(id: string): Promise<Agendamento | null> {
  const { data, error } = await supabase.from("agendamentos").select("*").eq("id", id).maybeSingle();
  if (error) throw error;
  return data as Agendamento | null;
}

export async function salvarAgendamento(agendamento: Agendamento): Promise<void> {
  const { error } = await supabase.from("agendamentos").insert(agendamento);
  if (error) throw error;
}

export async function atualizarAgendamento(id: string, agendamento: Agendamento): Promise<void> {
  const { error } = await supabase.from("agendamentos").update(agendamento).eq("id", id);
  if (error) throw error;
}

export async function deletarAgendamento(id: string): Promise<void> {
  const { error } = await supabase.from("agendamentos").delete().eq("id", id);
  if (error) throw error;
}
