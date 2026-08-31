import { supabase } from "@/lib/supabase";
import { ReceitaAvulsa } from "@/lib/types";

export async function listarReceitasAvulsas(salaoId: string): Promise<ReceitaAvulsa[]> {
  const { data, error } = await supabase.from("receitas_avulsas").select("*").eq("salao_id", salaoId);
  if (error) throw error;
  return data as ReceitaAvulsa[];
}

export async function salvarReceitaAvulsa(receita: ReceitaAvulsa): Promise<void> {
  const { error } = await supabase.from("receitas_avulsas").insert(receita);
  if (error) throw error;
}
