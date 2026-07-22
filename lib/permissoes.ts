// Mirror de PermissoesUseCase.kt: resolve quais profissionais o usuário logado pode ver,
// por categoria (Agenda, Financeiro). DONO nunca tem restrição (retorna null).
import { listarEquipe } from "@/lib/repositories/perfilRepository";
import {
  buscarPermissoesDe,
  listarPermissoesVisualizacaoDe,
} from "@/lib/repositories/permissoesRepository";
import { Perfil } from "@/lib/types";

type Categoria = "AGENDA" | "FINANCEIRO";

async function resolverVisibilidade(perfil: Perfil, categoria: Categoria): Promise<string[] | null> {
  const meuId = perfil.id;

  if (perfil.papel === "DONO") return null;

  let permissoes = null;
  try {
    permissoes = await buscarPermissoesDe(meuId);
  } catch {
    permissoes = null;
  }

  const modo = categoria === "AGENDA" ? permissoes?.agenda_modo ?? "PROPRIA" : permissoes?.financeiro_modo ?? "PROPRIO";
  const veDono =
    categoria === "AGENDA" ? permissoes?.agenda_ve_dono === true : permissoes?.financeiro_ve_dono === true;

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
      const extras = await listarPermissoesVisualizacaoDe(meuId);
      extras
        .filter((p) => (categoria === "AGENDA" ? p.ve_agenda : p.ve_financeiro))
        .forEach((p) => visiveis.add(p.alvo_id));
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

export async function profissionaisVisiveisAgenda(perfil: Perfil): Promise<string[] | null> {
  return resolverVisibilidade(perfil, "AGENDA");
}

export async function profissionaisVisiveisFinanceiro(perfil: Perfil): Promise<string[] | null> {
  return resolverVisibilidade(perfil, "FINANCEIRO");
}
