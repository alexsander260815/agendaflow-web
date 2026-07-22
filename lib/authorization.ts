// Serviço central de autorização: substitui os checks de `papel` espalhados
// pelo app e o `lib/permissoes.ts` antigo (que passa a ser um wrapper fino
// em cima deste serviço). Duas responsabilidades:
//  - podeExecutar: permissões por ação (RBAC — papel + exceções individuais).
//  - profissionaisVisiveis: escopo de "quem vê quem", generalizado por
//    categoria (antes só existia pra Agenda/Financeiro).
// DONO é sempre irrestrito nas duas frentes, igual ao comportamento antigo.
import { supabase } from "@/lib/supabase";
import { listarEquipe } from "@/lib/repositories/perfilRepository";
import {
  CategoriaVisibilidade,
  EscopoVisualizacaoConcessao,
  PapelPermissao,
  Perfil,
  PerfilPermissaoExcecao,
  Permissao,
} from "@/lib/types";

let catalogoCache: Map<string, string> | null = null;

async function catalogoPermissoes(): Promise<Map<string, string>> {
  if (catalogoCache) return catalogoCache;
  const { data, error } = await supabase.from("permissoes").select("*");
  if (error) throw error;
  const catalogo = new Map<string, string>();
  (data as Permissao[]).forEach((p) => catalogo.set(p.id, p.chave));
  catalogoCache = catalogo;
  return catalogo;
}

async function permissoesDoUsuario(perfil: Perfil): Promise<Set<string>> {
  const catalogo = await catalogoPermissoes();
  const doPapel = new Set<string>();

  if (perfil.papel_id) {
    try {
      const { data, error } = await supabase
        .from("papel_permissoes")
        .select("*")
        .eq("papel_id", perfil.papel_id);
      if (error) throw error;
      (data as PapelPermissao[]).forEach((pp) => {
        const chave = catalogo.get(pp.permissao_id);
        if (chave) doPapel.add(chave);
      });
    } catch {
      // sem permissões do papel se a leitura falhar
    }
  }

  try {
    const { data, error } = await supabase
      .from("perfil_permissoes_excecao")
      .select("*")
      .eq("perfil_id", perfil.id);
    if (error) throw error;
    (data as PerfilPermissaoExcecao[]).forEach((exc) => {
      const chave = catalogo.get(exc.permissao_id);
      if (!chave) return;
      if (exc.concedida) doPapel.add(chave);
      else doPapel.delete(chave);
    });
  } catch {
    // mantém as permissões do papel se a leitura de exceções falhar
  }

  return doPapel;
}

export async function podeExecutar(perfil: Perfil, permissao: string): Promise<boolean> {
  if (perfil.papel === "DONO") return true;
  const permissoes = await permissoesDoUsuario(perfil);
  return permissoes.has(permissao);
}

/** Retorna null quando o usuário vê a categoria inteira (sem restrição). */
export async function profissionaisVisiveis(
  perfil: Perfil,
  categoria: CategoriaVisibilidade
): Promise<string[] | null> {
  const meuId = perfil.id;
  if (perfil.papel === "DONO") return null;

  let escopo: { modo: string; ve_dono: boolean } | null = null;
  try {
    const { data, error } = await supabase
      .from("escopos_visualizacao")
      .select("*")
      .eq("usuario_id", meuId)
      .eq("categoria", categoria)
      .maybeSingle();
    if (error) throw error;
    escopo = data;
  } catch {
    escopo = null;
  }

  const modo = escopo?.modo ?? "PROPRIA";
  const veDono = escopo?.ve_dono === true;

  if (modo === "EQUIPE") {
    try {
      const equipe = await listarEquipe(perfil.salao_id);
      return equipe.filter((p) => p.papel !== "DONO" || veDono).map((p) => p.id);
    } catch {
      return [meuId];
    }
  }

  const visiveis = new Set<string>([meuId]);

  if (modo === "SELECIONADOS") {
    try {
      const { data, error } = await supabase
        .from("escopos_visualizacao_concessoes")
        .select("*")
        .eq("visualizador_id", meuId)
        .eq("categoria", categoria);
      if (error) throw error;
      (data as EscopoVisualizacaoConcessao[]).forEach((c) => visiveis.add(c.alvo_id));
    } catch {
      // mantém pelo menos a visibilidade básica
    }
  }

  if (veDono) {
    try {
      const equipe = await listarEquipe(perfil.salao_id);
      const dono = equipe.find((p) => p.papel === "DONO");
      if (dono) visiveis.add(dono.id);
    } catch {
      // idem
    }
  }

  return Array.from(visiveis);
}
