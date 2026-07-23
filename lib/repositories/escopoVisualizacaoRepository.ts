import { supabase } from "@/lib/supabase";
import { CategoriaVisibilidade } from "@/lib/types";

/**
 * Versão generalizada (por categoria) do `permissoesRepository.ts` antigo.
 * Durante a transição, o editor de permissões grava nas duas tabelas em
 * paralelo — as telas antigas continuam lendo `permissoes_usuario`, as
 * novas (via `lib/authorization.ts`) leem `escopos_visualizacao`.
 */
export async function salvarEscopoVisualizacao(
  salaoId: string,
  usuarioId: string,
  categoria: CategoriaVisibilidade,
  modo: string,
  veDono: boolean
): Promise<void> {
  const { error } = await supabase
    .from("escopos_visualizacao")
    .upsert(
      { salao_id: salaoId, usuario_id: usuarioId, categoria, modo, ve_dono: veDono },
      { onConflict: "usuario_id,categoria" }
    );
  if (error) throw error;
}

export async function definirConcessaoVisualizacao(
  salaoId: string,
  visualizadorId: string,
  alvoId: string,
  categoria: CategoriaVisibilidade,
  concede: boolean
): Promise<void> {
  if (concede) {
    const { error } = await supabase
      .from("escopos_visualizacao_concessoes")
      .upsert(
        { salao_id: salaoId, visualizador_id: visualizadorId, alvo_id: alvoId, categoria },
        { onConflict: "visualizador_id,alvo_id,categoria" }
      );
    if (error) throw error;
  } else {
    const { error } = await supabase
      .from("escopos_visualizacao_concessoes")
      .delete()
      .eq("visualizador_id", visualizadorId)
      .eq("alvo_id", alvoId)
      .eq("categoria", categoria);
    if (error) throw error;
  }
}
