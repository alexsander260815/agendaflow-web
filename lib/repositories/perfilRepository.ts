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

export async function atualizarTemaVisual(perfilId: string, temaId: string): Promise<void> {
  const { error } = await supabase.from('perfis').update({ tema_visual: temaId }).eq('id', perfilId);
  if (error) throw error;
}

export async function atualizarMetaFaturamentoPerfil(perfilId: string, meta: number | null): Promise<void> {
  const { error } = await supabase.from('perfis').update({ meta_faturamento_mensal: meta }).eq('id', perfilId);
  if (error) throw error;
}

export async function atualizarMinhasMensagens(
  perfilId: string,
  mensagens: {
    mensagem_confirmacao: string | null;
    mensagem_remarcacao: string | null;
    mensagem_cancelamento: string | null;
    mensagem_retorno: string | null;
  }
): Promise<void> {
  const { error } = await supabase.from('perfis').update(mensagens).eq('id', perfilId);
  if (error) throw error;
}

/**
 * Grava SÓ a mensagem de Sinal Pix da própria pessoa (null = voltar ao texto padrão), sem tocar nas outras mensagens. Confere que a linha foi atualizada:
 * se a política de segurança filtrar a linha (ex.: outra pessoa), o servidor responde 0 linhas sem erro, e isso conta como NÃO salvo.
 */
export async function atualizarMinhaMensagemSinalPix(perfilId: string, mensagem: string | null): Promise<void> {
  const { data, error } = await supabase.from('perfis').update({ mensagem_sinal_pix: mensagem }).eq('id', perfilId).select('id');
  if (error) throw error;
  if (!data || data.length === 0) throw new Error('A mensagem não foi salva (0 linhas atualizadas).');
}

export async function atualizarPixPerfil(
  perfilId: string,
  chavePix: string,
  nomeBeneficiario: string,
  cidade: string
): Promise<void> {
  const { error } = await supabase
    .from('perfis')
    .update({
      chave_pix: chavePix.trim() || null,
      pix_nome_beneficiario: nomeBeneficiario.trim() || null,
      pix_cidade: cidade.trim() || null,
    })
    .eq('id', perfilId);
  if (error) throw error;
}
