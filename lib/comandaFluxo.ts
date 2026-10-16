// Regras de gravação e conclusão da comanda (serviços + produtos), separadas da tela para poderem ser testadas sozinhas.
//
// Motivo (teste da 0033, 16/10/2026): "Marcar como Concluído" chamava a baixa de estoque SEM antes gravar os produtos que estavam só
// na tela. Resultado: o atendimento concluía, o produto não era gravado, o estoque não mudava e ninguém era avisado.
// Agora, concluir = (1) conferir que não está concluído, (2) gravar serviços e produtos, (3) CONFERIR lendo de volta que os produtos
// foram gravados, (4) só então baixar o estoque (função do banco, atômica e idempotente). Qualquer falha para tudo com mensagem clara.
import type { AgendamentoServico, ProdutoComanda } from "@/lib/types";

export type EtapaErroComanda =
  | "sem_itens"
  | "salvar_itens"
  | "salvar_produtos"
  | "confirmar_produtos"
  | "concluir_venda";

export class ErroComanda extends Error {
  etapa: EtapaErroComanda;
  constructor(etapa: EtapaErroComanda, mensagem: string) {
    super(mensagem);
    this.name = "ErroComanda";
    this.etapa = etapa;
  }
}

export type NovoProdutoComanda = Omit<ProdutoComanda, "id" | "salao_id" | "agendamento_id" | "estoque_baixado">;

export interface RepositorioComanda {
  buscarStatus(agendamentoId: string): Promise<string | null>;
  salvarItens(agendamentoId: string, itens: AgendamentoServico[]): Promise<void>;
  salvarProdutos(agendamentoId: string, salaoId: string, produtos: NovoProdutoComanda[]): Promise<void>;
  listarProdutos(agendamentoId: string): Promise<ProdutoComanda[]>;
  concluirVenda(agendamentoId: string, formaPagamento: string): Promise<void>;
}

export interface DadosComanda {
  agendamentoId: string;
  salaoId: string;
  itens: AgendamentoServico[];
  produtos: ProdutoComanda[];
}

/** Texto legível de qualquer erro (o Supabase devolve objetos com `message`, nem sempre instâncias de Error). */
export function mensagemDeErro(e: unknown, padrao = "Erro desconhecido."): string {
  if (e && typeof e === "object" && "message" in e && typeof (e as { message: unknown }).message === "string") {
    const m = (e as { message: string }).message.trim();
    if (m) return m;
  }
  if (typeof e === "string" && e.trim()) return e.trim();
  return padrao;
}

function somaPorProduto(linhas: { produto_id: string; quantidade: number }[]): Map<string, number> {
  const mapa = new Map<string, number>();
  for (const l of linhas) mapa.set(l.produto_id, (mapa.get(l.produto_id) ?? 0) + Number(l.quantidade));
  return mapa;
}

/** Grava serviços e produtos AINDA NÃO vendidos e confere, lendo de volta, que os produtos foram mesmo gravados. */
export async function gravarItensEProdutos(repo: RepositorioComanda, dados: DadosComanda): Promise<void> {
  if (dados.itens.length === 0) {
    throw new ErroComanda("sem_itens", "Adicione ao menos um serviço antes de salvar.");
  }
  try {
    await repo.salvarItens(dados.agendamentoId, dados.itens);
  } catch (e) {
    throw new ErroComanda("salvar_itens", `Não foi possível salvar os serviços da comanda: ${mensagemDeErro(e)}`);
  }

  const novos: NovoProdutoComanda[] = dados.produtos
    .filter((p) => !p.estoque_baixado)
    .map(({ produto_id, nome_produto, preco_unitario, quantidade, criado_em }) => ({
      produto_id,
      nome_produto,
      preco_unitario,
      quantidade,
      criado_em,
    }));
  try {
    await repo.salvarProdutos(dados.agendamentoId, dados.salaoId, novos);
  } catch (e) {
    throw new ErroComanda("salvar_produtos", `Não foi possível salvar os produtos da comanda: ${mensagemDeErro(e)}`);
  }

  let gravados: ProdutoComanda[];
  try {
    gravados = await repo.listarProdutos(dados.agendamentoId);
  } catch (e) {
    throw new ErroComanda(
      "confirmar_produtos",
      `Não foi possível conferir os produtos gravados na comanda: ${mensagemDeErro(e)}. Nada foi baixado do estoque.`
    );
  }
  const esperado = somaPorProduto(novos);
  const obtido = somaPorProduto(gravados.filter((p) => !p.estoque_baixado));
  const igual = esperado.size === obtido.size && [...esperado].every(([id, q]) => obtido.get(id) === q);
  if (!igual) {
    throw new ErroComanda(
      "confirmar_produtos",
      "Os produtos da comanda não foram gravados corretamente. Nada foi baixado do estoque. Toque em Salvar e confira antes de concluir."
    );
  }
}

/**
 * Conclui o atendimento: grava e confere os itens ANTES de baixar o estoque. Não duplica baixa: o banco só baixa linhas ainda não vendidas.
 * Se o atendimento JÁ estava concluído (duplo toque, outra aba, tentativa repetida após falha no desconto do pacote) não grava nem baixa
 * nada e devolve "ja_estava_concluida" — quem chamou pode então só terminar as etapas que dependem de flag (ex.: desconto de pacote).
 */
export async function concluirComandaGravando(
  repo: RepositorioComanda,
  dados: DadosComanda,
  formaPagamento: string
): Promise<"concluida" | "ja_estava_concluida"> {
  let status: string | null;
  try {
    status = await repo.buscarStatus(dados.agendamentoId);
  } catch (e) {
    throw new ErroComanda("concluir_venda", `Não foi possível conferir o atendimento: ${mensagemDeErro(e)}`);
  }
  if (status === "CONCLUIDO") return "ja_estava_concluida";

  await gravarItensEProdutos(repo, dados);

  try {
    await repo.concluirVenda(dados.agendamentoId, formaPagamento);
  } catch (e) {
    throw new ErroComanda(
      "concluir_venda",
      `Os itens foram salvos, mas não foi possível concluir e baixar o estoque: ${mensagemDeErro(e)}. O atendimento NÃO foi concluído.`
    );
  }
  return "concluida";
}
