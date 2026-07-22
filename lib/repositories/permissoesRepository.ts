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
