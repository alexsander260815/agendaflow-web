import { supabase } from "@/lib/supabase";
import { Perfil } from "@/lib/types";

export async function listarEquipe(salaoId: string): Promise<Perfil[]> {
  const { data, error } = await supabase.from("perfis").select("*").eq("salao_id", salaoId);
  if (error) throw error;
  return data as Perfil[];
}

export async function buscarPerfil(id: string): Promise<Perfil | null> {
  const { data, error } = await supabase.from("perfis").select("*").eq("id", id).maybeSingle();
  if (error) throw error;
  return data as Perfil | null;
}
