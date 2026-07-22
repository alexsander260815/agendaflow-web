import { supabase } from "@/lib/supabase";
import { Assinatura } from "@/lib/types";

export async function buscarMinhaAssinatura(salaoId: string): Promise<Assinatura | null> {
  const { data, error } = await supabase
    .from("assinaturas")
    .select("*")
    .eq("salao_id", salaoId)
    .order("criado_em", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data as Assinatura | null;
}

export async function criarAssinatura(planoId: string, emailPagador: string): Promise<{ linkPagamento?: string; erro?: string }> {
  const { data, error } = await supabase.functions.invoke("dynamic-api", {
    body: { planoId, emailPagador },
  });
  if (error) throw error;
  return data as { linkPagamento?: string; erro?: string };
}

export async function cancelarMinhaAssinatura(): Promise<void> {
  const { error } = await supabase.functions.invoke("cancelar-minha-assinatura");
  if (error) throw error;
}
