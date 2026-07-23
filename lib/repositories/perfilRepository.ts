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

export async function definirAtendeClientes(perfilId: string, valor: boolean): Promise<void> {
  const { error } = await supabase.from("perfis").update({ atende_clientes: valor }).eq("id", perfilId);
  if (error) throw error;
}

export async function definirComissaoPercentual(perfilId: string, percentual: number): Promise<void> {
  const { error } = await supabase.from("perfis").update({ comissao_percentual: percentual }).eq("id", perfilId);
  if (error) throw error;
}

export async function removerDaEquipe(perfilId: string): Promise<void> {
  const { error } = await supabase.from("perfis").delete().eq("id", perfilId);
  if (error) throw error;
}

export async function definirPapelId(perfilId: string, papelId: string, papelLegado: string): Promise<void> {
  const { error } = await supabase.from("perfis").update({ papel_id: papelId, papel: papelLegado }).eq("id", perfilId);
  if (error) throw error;
}
