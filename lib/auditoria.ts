import { supabase } from "@/lib/supabase";

export async function registrarAuditoria(
  salaoId: string,
  usuarioId: string | null,
  acao: string,
  entidadeTipo: string,
  entidadeId?: string | null,
  dadosAntes?: Record<string, unknown> | null,
  dadosDepois?: Record<string, unknown> | null
): Promise<void> {
  try {
    await supabase.from("auditoria").insert({
      salao_id: salaoId,
      usuario_id: usuarioId,
      acao,
      entidade_tipo: entidadeTipo,
      entidade_id: entidadeId ?? null,
      dados_antes: dadosAntes ?? null,
      dados_depois: dadosDepois ?? null,
    });
  } catch {
    // Auditoria é best-effort: nunca deve quebrar a ação principal do usuário.
  }
}
