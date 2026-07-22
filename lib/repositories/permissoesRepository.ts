import { supabase } from "@/lib/supabase";
import { PermissaoVisualizacao, PermissoesUsuario } from "@/lib/types";

export async function buscarPermissoesDe(usuarioId: string): Promise<PermissoesUsuario | null> {
  const { data, error } = await supabase
    .from("permissoes_usuario")
    .select("*")
    .eq("usuario_id", usuarioId)
    .maybeSingle();
  if (error) throw error;
  return data as PermissoesUsuario | null;
}

export async function listarPermissoesVisualizacaoDe(
  visualizadorId: string
): Promise<PermissaoVisualizacao[]> {
  const { data, error } = await supabase
    .from("permissoes_visualizacao")
    .select("*")
    .eq("visualizador_id", visualizadorId);
  if (error) throw error;
  return data as PermissaoVisualizacao[];
}

export async function salvarPermissoesUsuario(permissoes: PermissoesUsuario): Promise<void> {
  const { error } = await supabase.from("permissoes_usuario").upsert(permissoes, { onConflict: "usuario_id" });
  if (error) throw error;
}

export async function definirPermissaoVisualizacao(
  salaoId: string,
  visualizadorId: string,
  alvoId: string,
  veAgenda: boolean,
  veFinanceiro: boolean
): Promise<void> {
  if (!veAgenda && !veFinanceiro) {
    const { error } = await supabase
      .from("permissoes_visualizacao")
      .delete()
      .eq("visualizador_id", visualizadorId)
      .eq("alvo_id", alvoId);
    if (error) throw error;
    return;
  }

  const { error } = await supabase.from("permissoes_visualizacao").upsert(
    {
      salao_id: salaoId,
      visualizador_id: visualizadorId,
      alvo_id: alvoId,
      ve_agenda: veAgenda,
      ve_financeiro: veFinanceiro,
    },
    { onConflict: "visualizador_id,alvo_id" }
  );
  if (error) throw error;
}
