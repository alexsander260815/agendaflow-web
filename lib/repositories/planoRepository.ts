import { supabase } from "@/lib/supabase";
import { Plano } from "@/lib/types";

export async function listarPlanos(): Promise<Plano[]> {
  const { data, error } = await supabase.from("planos").select("*").eq("ativo", true);
  if (error) throw error;
  return data as Plano[];
}
