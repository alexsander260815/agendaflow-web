import { supabase } from "@/lib/supabase";
import { Papel } from "@/lib/types";

/** Papéis padrão do sistema que podem ser atribuídos a alguém da equipe (exclui Proprietário). */
export async function listarPapeisAtribuiveis(): Promise<Papel[]> {
  const { data, error } = await supabase
    .from("papeis")
    .select("*")
    .is("salao_id", null)
    .neq("nome", "Proprietário");
  if (error) throw error;
  return data as Papel[];
}
