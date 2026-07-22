import { supabase } from "@/lib/supabase";
import { Salao } from "@/lib/types";

export async function buscarMeuSalao(salaoId: string): Promise<Salao | null> {
  const { data, error } = await supabase.from("saloes").select("*").eq("id", salaoId).maybeSingle();
  if (error) throw error;
  return data as Salao | null;
}

export async function atualizarSalao(salao: Salao): Promise<void> {
  const { error } = await supabase.from("saloes").update(salao).eq("id", salao.id);
  if (error) throw error;
}

export async function atualizarLogoUrl(salaoId: string, url: string): Promise<void> {
  const { error } = await supabase.from("saloes").update({ logo_url: url }).eq("id", salaoId);
  if (error) throw error;
}
