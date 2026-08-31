import { supabase } from "@/lib/supabase";
import { Salao } from "@/lib/types";

export async function buscarMeuSalao(salaoId: string): Promise<Salao | null> {
  const { data, error } = await supabase.from("saloes").select("*").eq("id", salaoId).maybeSingle();
  if (error) throw error;
  return data as Salao | null;
}

export async function atualizarSalao(salao: Salao): Promise<void> {
  const { data, error } = await supabase.from("saloes").update(salao).eq("id", salao.id).select("id");
  if (error) throw error;
  if (!data || data.length === 0) {
    throw new Error(
      "A alteração não foi salva (0 linhas afetadas) — provavelmente uma política de acesso do banco está bloqueando essa atualização."
    );
  }
}

export async function atualizarLogoUrl(salaoId: string, url: string): Promise<void> {
  const { data, error } = await supabase.from("saloes").update({ logo_url: url }).eq("id", salaoId).select("id");
  if (error) throw error;
  if (!data || data.length === 0) {
    throw new Error("O logo não foi salvo (0 linhas afetadas) — provavelmente uma política de acesso do banco está bloqueando.");
  }
}

export async function atualizarModoComissaoPacote(salaoId: string, modo: string): Promise<void> {
  const { data, error } = await supabase
    .from("saloes")
    .update({ modo_comissao_pacote: modo })
    .eq("id", salaoId)
    .select("id");
  if (error) throw error;
  if (!data || data.length === 0) {
    throw new Error(
      "A configuração não foi salva (0 linhas afetadas) — provavelmente uma política de acesso do banco está bloqueando."
    );
  }
}
