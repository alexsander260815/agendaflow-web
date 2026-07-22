import { supabase } from "@/lib/supabase";
import { SalaoPainel, SuporteMensagemPainel } from "@/lib/types";

export async function souSuperAdmin(usuarioId: string): Promise<boolean> {
  try {
    const { data, error } = await supabase.from("super_admins").select("id").eq("id", usuarioId).maybeSingle();
    if (error) throw error;
    return data !== null;
  } catch {
    return false;
  }
}

async function chamarPainelAdmin<T = unknown>(body: Record<string, string>): Promise<T> {
  const { data, error } = await supabase.functions.invoke("painel-admin", { body });
  if (error) throw error;
  return data as T;
}

export async function listarSaloes(): Promise<SalaoPainel[]> {
  const data = await chamarPainelAdmin<{ saloes: SalaoPainel[]; erro?: string }>({ acao: "listar" });
  if (data.erro) throw new Error(data.erro);
  return data.saloes;
}

export async function cancelarAssinaturaAdmin(assinaturaId: string): Promise<void> {
  await chamarPainelAdmin({ acao: "cancelar_assinatura", assinaturaId });
}

export async function estenderAcesso(salaoId: string, dias: number): Promise<void> {
  await chamarPainelAdmin({ acao: "estender_acesso", salaoIdParaAlternar: salaoId, dias: String(dias) });
}

export async function revogarPrazo(salaoId: string): Promise<void> {
  await chamarPainelAdmin({ acao: "revogar_prazo", salaoIdParaAlternar: salaoId });
}

export async function reativarAssinaturaAdmin(salaoId: string): Promise<void> {
  await chamarPainelAdmin({ acao: "reativar_assinatura", salaoIdParaAlternar: salaoId });
}

export async function listarMensagensSuporte(): Promise<SuporteMensagemPainel[]> {
  const data = await chamarPainelAdmin<{ mensagens: SuporteMensagemPainel[]; erro?: string }>({ acao: "listar_suporte" });
  if (data.erro) throw new Error(data.erro);
  return data.mensagens;
}

export async function atualizarStatusSuporte(mensagemId: string, novoStatus: string): Promise<void> {
  await chamarPainelAdmin({ acao: "atualizar_status_suporte", mensagemSuporteId: mensagemId, novoStatusSuporte: novoStatus });
}
