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
  | "concluir_venda"
  | "tela_desatualizada"
  | "verificar_tela"
  | "verificar_estorno"
  | "estornar";

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
  listarItens(agendamentoId: string): Promise<AgendamentoServico[]>;
  /** estornar_comanda (banco): devolve estoque dos produtos vendidos e sessões de pacote já descontadas. Só age sobre o que está marcado como feito; repetir não devolve em dobro. */
  estornar(agendamentoId: string): Promise<void>;
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

/** Linha pronta para o INSERT em agendamento_produtos: TODAS as colunas obrigatórias presentes e com valor (nunca undefined/null). */
export interface LinhaProdutoComanda {
  id: string;
  salao_id: string;
  agendamento_id: string;
  produto_id: string;
  nome_produto: string;
  preco_unitario: number;
  quantidade: number;
  estoque_baixado: false;
  criado_em: string;
}

/**
 * Monta as linhas do INSERT em lote de agendamento_produtos.
 *
 * Defeito encontrado no Preview (16/10/2026): o código antigo fazia `{ ...produto, id, ... }` e `produto` trazia a chave
 * `criado_em: undefined` (linha recém-adicionada, ainda sem data). O supabase-js monta o parâmetro `columns` com as CHAVES do objeto
 * (inclusive as `undefined`) e, em INSERT em lote, trata coluna listada mas ausente no JSON como NULL — ignorando o DEFAULT now() da
 * coluna. Resultado: `null value in column "criado_em" ... violates not-null constraint`. Aqui `criado_em` sempre recebe uma data
 * ISO válida (a da própria linha, se tiver; senão "agora"), e nenhuma coluna obrigatória fica sem valor.
 */
export function montarLinhasProdutos(
  agendamentoId: string,
  salaoId: string,
  produtos: NovoProdutoComanda[],
  novoId: () => string,
  agora: Date = new Date()
): LinhaProdutoComanda[] {
  return produtos.map((p, i) => {
    const doItem = p.criado_em && !Number.isNaN(Date.parse(p.criado_em)) ? new Date(p.criado_em).toISOString() : null;
    return {
      id: novoId(),
      salao_id: salaoId,
      agendamento_id: agendamentoId,
      produto_id: p.produto_id,
      nome_produto: p.nome_produto,
      preco_unitario: Number(p.preco_unitario),
      quantidade: Number(p.quantidade),
      estoque_baixado: false as const,
      // +i ms mantém a ordem das linhas (a tela lista por criado_em) mesmo gravando todas no mesmo instante
      criado_em: doItem ?? new Date(agora.getTime() + i).toISOString(),
    };
  });
}

function somaPorProduto(linhas: { produto_id: string; quantidade: number }[]): Map<string, number> {
  const mapa = new Map<string, number>();
  for (const l of linhas) mapa.set(l.produto_id, (mapa.get(l.produto_id) ?? 0) + Number(l.quantidade));
  return mapa;
}

const MSG_TELA_DESATUALIZADA =
  "Esta comanda mudou depois que você a abriu (foi concluída, reaberta ou estornada). Atualizamos a tela com o estado real; confira e tente de novo. Nada foi alterado.";

/**
 * Antes de gravar, compara a TELA com o BANCO. Se a tela estiver desatualizada, não grava nada.
 * Sem isso, depois de "Reabrir" (que devolve o estoque e zera `estoque_baixado` no banco) a tela ainda mostrava o produto como
 * "Vendido"; ao salvar/concluir, o produto — que a tela considerava "já vendido" e por isso não reenviava — era APAGADO da comanda
 * pelo "troca as linhas pendentes", e o atendimento concluía sem produto e sem baixar o estoque.
 */
async function verificarTelaAtualizada(repo: RepositorioComanda, dados: DadosComanda): Promise<void> {
  let status: string | null;
  let doBanco: ProdutoComanda[];
  try {
    [status, doBanco] = await Promise.all([repo.buscarStatus(dados.agendamentoId), repo.listarProdutos(dados.agendamentoId)]);
  } catch (e) {
    throw new ErroComanda("verificar_tela", `Não foi possível conferir o estado atual da comanda: ${mensagemDeErro(e)}. Nada foi alterado.`);
  }
  const vendidasNoBanco = new Set(doBanco.filter((p) => p.estoque_baixado).map((p) => p.id));
  const telaDizVendidaMasBancoNao = dados.produtos.some((p) => p.estoque_baixado && !vendidasNoBanco.has(p.id));
  const telaDizPendenteMasBancoVendeu = dados.produtos.some((p) => !p.estoque_baixado && vendidasNoBanco.has(p.id));
  const haProdutosNovos = dados.produtos.some((p) => !p.estoque_baixado);
  const jaConcluidoNoBanco = status === "CONCLUIDO" && haProdutosNovos;
  if (telaDizVendidaMasBancoNao || telaDizPendenteMasBancoVendeu || jaConcluidoNoBanco) {
    throw new ErroComanda("tela_desatualizada", MSG_TELA_DESATUALIZADA);
  }
}

/**
 * Decide pelo BANCO (não pela tela) se há o que estornar e, se houver, chama o estorno (função do banco: atômica e idempotente).
 * Há o que estornar quando: o atendimento está CONCLUIDO no banco, OU existe produto marcado como vendido, OU existe item com sessão
 * de pacote descontada. Usado antes de Reabrir, Cancelar, Marcar Falta e Excluir. Se não conseguir verificar ou estornar, LANÇA erro
 * e quem chamou NÃO deve mudar o status nem excluir. Repetir é seguro: o banco só devolve o que ainda está marcado como feito.
 */
export async function estornarSeNecessario(repo: RepositorioComanda, agendamentoId: string): Promise<{ estornou: boolean }> {
  let precisa: boolean;
  try {
    const [status, produtos, itens] = await Promise.all([
      repo.buscarStatus(agendamentoId),
      repo.listarProdutos(agendamentoId),
      repo.listarItens(agendamentoId),
    ]);
    precisa =
      status === "CONCLUIDO" ||
      produtos.some((p) => p.estoque_baixado) ||
      itens.some((i) => i.pacote_descontado && i.cliente_pacote_id !== null);
  } catch (e) {
    throw new ErroComanda(
      "verificar_estorno",
      `Não foi possível conferir se há estoque ou pacote a devolver: ${mensagemDeErro(e)}. Nada foi alterado.`
    );
  }
  if (!precisa) return { estornou: false };
  try {
    await repo.estornar(agendamentoId);
  } catch (e) {
    throw new ErroComanda(
      "estornar",
      `Não foi possível devolver o estoque e as sessões de pacote: ${mensagemDeErro(e)}. Nada foi alterado e o status continua o mesmo.`
    );
  }
  return { estornou: true };
}

/** Grava serviços e produtos AINDA NÃO vendidos e confere, lendo de volta, que os produtos foram mesmo gravados. */
export async function gravarItensEProdutos(repo: RepositorioComanda, dados: DadosComanda): Promise<void> {
  if (dados.itens.length === 0) {
    throw new ErroComanda("sem_itens", "Adicione ao menos um serviço antes de salvar.");
  }
  await verificarTelaAtualizada(repo, dados);
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
      // só leva a data se a linha já tiver uma (nunca uma chave com valor undefined)
      ...(criado_em ? { criado_em } : {}),
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
