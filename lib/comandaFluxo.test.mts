// @ts-nocheck  (arquivo de teste rodado com 'node --test'; o import com extensao .ts so vale no Node)
// Testes do fluxo de gravação/conclusão da comanda, com um banco simulado em memória que imita o comportamento real:
//  - salvarItens: apaga os itens do agendamento e insere os novos
//  - salvarProdutos: apaga linhas NÃO vendidas e insere as novas
//  - concluirVenda (concluir_venda_produtos): numa transação, baixa só linhas não vendidas, recusa saldo insuficiente, marca CONCLUIDO
// Rodar:  node --test lib/comandaFluxo.test.mts
import test from "node:test";
import assert from "node:assert/strict";
import { concluirComandaGravando, gravarItensEProdutos, mensagemDeErro, montarLinhasProdutos, ErroComanda, type RepositorioComanda, type DadosComanda } from "./comandaFluxo.ts";

type Linha = { id: string; salao_id: string; agendamento_id: string; produto_id: string; nome_produto: string; preco_unitario: number; quantidade: number; estoque_baixado: boolean };
type Item = { id: string; salao_id: string; agendamento_id: string; servico_id: string; nome_servico: string; preco: number; cliente_pacote_id: string | null; pacote_descontado: boolean; comissao_fechada: boolean };

function criarBanco(opcoes: { saldo?: number; falhaAoSalvarProdutos?: boolean; descartaProdutosSilenciosamente?: boolean; falhaNaLeitura?: boolean; falhaAoSalvarItens?: boolean } = {}) {
  const b = {
    status: "AGENDADO" as string,
    forma: null as string | null,
    itens: [] as Item[],
    produtos: [] as Linha[],
    saldo: opcoes.saldo ?? 5,
    movimentacoes: [] as { tipo: string; quantidade: number }[],
    chamadas: { concluirVenda: 0, salvarProdutos: 0, salvarItens: 0 },
  };
  let seq = 0;
  const repo: RepositorioComanda = {
    async buscarStatus() { return b.status; },
    async salvarItens(ag, itens) {
      b.chamadas.salvarItens++;
      if (opcoes.falhaAoSalvarItens) throw { message: "new row violates row-level security policy" };
      b.itens = b.itens.filter((i) => i.agendamento_id !== ag).concat(itens as Item[]);
    },
    async salvarProdutos(ag, salao, produtos) {
      b.chamadas.salvarProdutos++;
      if (opcoes.falhaAoSalvarProdutos) throw { message: "permission denied for table agendamento_produtos" };
      b.produtos = b.produtos.filter((p) => !(p.agendamento_id === ag && !p.estoque_baixado));
      if (opcoes.descartaProdutosSilenciosamente) return; // simula insert que "passa" sem gravar nada
      for (const p of produtos) b.produtos.push({ id: `l${++seq}`, salao_id: salao, agendamento_id: ag, produto_id: p.produto_id, nome_produto: p.nome_produto, preco_unitario: p.preco_unitario, quantidade: p.quantidade, estoque_baixado: false });
    },
    async listarProdutos(ag) {
      if (opcoes.falhaNaLeitura) throw { message: "JWT expired" };
      return b.produtos.filter((p) => p.agendamento_id === ag);
    },
    async concluirVenda(ag, forma) {
      b.chamadas.concluirVenda++;
      // transação: ou faz tudo ou nada
      const saldoAntes = b.saldo; const movAntes = b.movimentacoes.length; const marcados: Linha[] = [];
      try {
        for (const l of b.produtos.filter((p) => p.agendamento_id === ag && !p.estoque_baixado)) {
          if (b.saldo < l.quantidade) throw { message: `Estoque insuficiente para ${l.nome_produto}` };
          b.saldo -= l.quantidade; b.movimentacoes.push({ tipo: "VENDA", quantidade: l.quantidade }); l.estoque_baixado = true; marcados.push(l);
        }
        b.status = "CONCLUIDO"; b.forma = forma;
      } catch (e) {
        b.saldo = saldoAntes; b.movimentacoes.length = movAntes; marcados.forEach((l) => (l.estoque_baixado = false)); throw e;
      }
    },
  };
  return { b, repo };
}

function dados(qtd = 1, extra: Partial<DadosComanda> = {}): DadosComanda {
  return {
    agendamentoId: "ag1",
    salaoId: "s1",
    itens: [{ id: "i1", salao_id: "s1", agendamento_id: "ag1", servico_id: "sv1", nome_servico: "corte", preco: 60, cliente_pacote_id: null, pacote_descontado: false, comissao_fechada: false }],
    produtos: qtd > 0 ? [{ id: "tmp", salao_id: "s1", agendamento_id: "ag1", produto_id: "p1", nome_produto: "ZZ Shampoo", preco_unitario: 0, quantidade: qtd, estoque_baixado: false }] : [],
    ...extra,
  };
}

test("relato original: produto só na tela + concluir => agora grava o produto, baixa 1 vez e conclui", async () => {
  const { b, repo } = criarBanco();
  await concluirComandaGravando(repo, dados(1), "CARTAO");
  assert.equal(b.status, "CONCLUIDO"); assert.equal(b.forma, "CARTAO");
  assert.equal(b.itens.length, 1); assert.equal(b.produtos.length, 1);
  assert.equal(b.produtos[0].estoque_baixado, true);
  assert.equal(b.saldo, 4); assert.deepEqual(b.movimentacoes, [{ tipo: "VENDA", quantidade: 1 }]);
});

test("produto com preço R$ 0,00 não impede gravar nem concluir", async () => {
  const { b, repo } = criarBanco();
  await concluirComandaGravando(repo, dados(2), "PIX");
  assert.equal(b.saldo, 3); assert.equal(b.status, "CONCLUIDO");
});

test("falha ao gravar produtos => NÃO conclui, NÃO baixa estoque, mensagem clara", async () => {
  const { b, repo } = criarBanco({ falhaAoSalvarProdutos: true });
  await assert.rejects(concluirComandaGravando(repo, dados(1), "PIX"), (e: unknown) => e instanceof ErroComanda && e.etapa === "salvar_produtos" && /permission denied/.test(e.message));
  assert.equal(b.status, "AGENDADO"); assert.equal(b.saldo, 5); assert.equal(b.chamadas.concluirVenda, 0);
});

test("insert que 'passa' sem gravar (silencioso) => a conferência barra antes de concluir", async () => {
  const { b, repo } = criarBanco({ descartaProdutosSilenciosamente: true });
  await assert.rejects(concluirComandaGravando(repo, dados(1), "PIX"), (e: unknown) => e instanceof ErroComanda && e.etapa === "confirmar_produtos");
  assert.equal(b.status, "AGENDADO"); assert.equal(b.saldo, 5); assert.equal(b.chamadas.concluirVenda, 0);
});

test("não consegue ler de volta => não conclui", async () => {
  const { b, repo } = criarBanco({ falhaNaLeitura: true });
  await assert.rejects(concluirComandaGravando(repo, dados(1), "PIX"), (e: unknown) => e instanceof ErroComanda && e.etapa === "confirmar_produtos" && /JWT expired/.test(e.message));
  assert.equal(b.status, "AGENDADO"); assert.equal(b.chamadas.concluirVenda, 0);
});

test("falha ao gravar serviços => para antes de qualquer produto/baixa", async () => {
  const { b, repo } = criarBanco({ falhaAoSalvarItens: true });
  await assert.rejects(concluirComandaGravando(repo, dados(1), "PIX"), (e: unknown) => e instanceof ErroComanda && e.etapa === "salvar_itens");
  assert.equal(b.chamadas.salvarProdutos, 0); assert.equal(b.chamadas.concluirVenda, 0); assert.equal(b.saldo, 5);
});

test("sem serviços na tela => NÃO apaga a comanda gravada e não conclui", async () => {
  const { b, repo } = criarBanco();
  await repo.salvarItens("ag1", dados(0).itens); // já havia 1 serviço gravado
  await assert.rejects(concluirComandaGravando(repo, dados(0, { itens: [] }), "PIX"), (e: unknown) => e instanceof ErroComanda && e.etapa === "sem_itens");
  assert.equal(b.itens.length, 1); assert.equal(b.status, "AGENDADO");
});

test("estoque insuficiente na hora da baixa => atendimento NÃO conclui, nada baixado, itens ficam salvos", async () => {
  const { b, repo } = criarBanco({ saldo: 1 });
  await assert.rejects(concluirComandaGravando(repo, dados(2), "PIX"), (e: unknown) => e instanceof ErroComanda && e.etapa === "concluir_venda" && /Estoque insuficiente/.test(e.message) && /NÃO foi concluído/.test(e.message));
  assert.equal(b.status, "AGENDADO"); assert.equal(b.saldo, 1); assert.equal(b.movimentacoes.length, 0);
  assert.equal(b.produtos.length, 1); assert.equal(b.produtos[0].estoque_baixado, false);
});

test("tentar de novo depois de uma falha NÃO duplica linhas nem baixas", async () => {
  const { b, repo } = criarBanco({ saldo: 1 });
  await assert.rejects(concluirComandaGravando(repo, dados(2), "PIX"));
  b.saldo = 5; // alguém repõe o estoque
  await concluirComandaGravando(repo, dados(2), "PIX");
  assert.equal(b.produtos.length, 1); assert.equal(b.saldo, 3); assert.equal(b.movimentacoes.length, 1);
});

test("duas conclusões em sequência (duplo toque / tentativa repetida) => a segunda não grava nem baixa nada", async () => {
  const { b, repo } = criarBanco();
  assert.equal(await concluirComandaGravando(repo, dados(1), "PIX"), "concluida");
  const antes = { ...b.chamadas };
  assert.equal(await concluirComandaGravando(repo, dados(1), "PIX"), "ja_estava_concluida");
  assert.equal(b.saldo, 4); assert.equal(b.movimentacoes.length, 1); assert.equal(b.chamadas.concluirVenda, 1);
  assert.deepEqual(b.chamadas, antes); // nem regravou itens/produtos
});

test("duas conclusões AO MESMO TEMPO (duas abas) => estoque baixado uma vez só", async () => {
  const { b, repo } = criarBanco();
  const r = await Promise.allSettled([concluirComandaGravando(repo, dados(1), "PIX"), concluirComandaGravando(repo, dados(1), "PIX")]);
  assert.ok(r.every((x) => x.status === "fulfilled"));
  assert.equal(b.saldo, 4); assert.equal(b.movimentacoes.length, 1); assert.equal(b.produtos.filter((p) => p.estoque_baixado).length, 1);
});
test("salvar a comanda de novo (sem concluir) substitui as linhas não vendidas em vez de duplicar", async () => {
  const { b, repo } = criarBanco();
  await gravarItensEProdutos(repo, dados(1));
  await gravarItensEProdutos(repo, dados(3));
  assert.equal(b.produtos.length, 1); assert.equal(b.produtos[0].quantidade, 3); assert.equal(b.itens.length, 1);
});

test("linha já vendida é preservada e não volta a ser baixada", async () => {
  const { b, repo } = criarBanco();
  await concluirComandaGravando(repo, dados(1), "PIX"); // vende 1
  b.status = "AGENDADO"; // reaberta
  const vendida = b.produtos[0];
  await gravarItensEProdutos(repo, { ...dados(0), produtos: [{ ...vendida }] });
  assert.equal(b.produtos.length, 1); assert.equal(b.produtos[0].estoque_baixado, true);
  await repo.concluirVenda("ag1", "PIX");
  assert.equal(b.saldo, 4);
});

test("mensagemDeErro entende erro do Supabase (objeto), Error e texto", () => {
  assert.equal(mensagemDeErro({ message: "boom" }), "boom");
  assert.equal(mensagemDeErro(new Error("x")), "x");
  assert.equal(mensagemDeErro("texto"), "texto");
  assert.equal(mensagemDeErro(null, "padrão"), "padrão");
});

// ---------------------------------------------------------------------------------------------------------------------------
// INSERT em lote de agendamento_produtos: reproduz o comportamento real do supabase-js + PostgREST que causou
//   null value in column "criado_em" of relation "agendamento_produtos" violates not-null constraint   (Preview, 16/10/2026)
// supabase-js monta `columns` com as CHAVES de todos os objetos (inclusive as de valor undefined); com defaultToNull=true (padrão)
// o PostgREST grava NULL em coluna listada que não veio no JSON, ignorando o DEFAULT da coluna.
// Esquema real: id, salao_id, agendamento_id, produto_id, nome_produto, preco_unitario, quantidade = NOT NULL sem default;
// estoque_baixado e criado_em = NOT NULL COM default now()/false.
const COLUNAS_OBRIGATORIAS_SEM_DEFAULT = ["id", "salao_id", "agendamento_id", "produto_id", "nome_produto", "preco_unitario", "quantidade"];
const COLUNAS_OBRIGATORIAS_COM_DEFAULT = ["estoque_baixado", "criado_em"];

function simularInsertEmLote(linhas: Record<string, unknown>[], defaultToNull = true): { erro: string | null } {
  const colunas = new Set(linhas.flatMap((l) => Object.keys(l))); // o que o supabase-js manda em ?columns=
  for (const l of linhas) {
    const json = JSON.parse(JSON.stringify(l)); // undefined some do corpo JSON
    for (const c of [...COLUNAS_OBRIGATORIAS_SEM_DEFAULT, ...COLUNAS_OBRIGATORIAS_COM_DEFAULT]) {
      const veio = Object.prototype.hasOwnProperty.call(json, c) && json[c] !== null;
      if (veio) continue;
      const listada = colunas.has(c);
      const temDefault = COLUNAS_OBRIGATORIAS_COM_DEFAULT.includes(c);
      if (listada && defaultToNull) return { erro: `null value in column "${c}" of relation "agendamento_produtos" violates not-null constraint` };
      if (!temDefault) return { erro: `null value in column "${c}" of relation "agendamento_produtos" violates not-null constraint` };
    }
  }
  return { erro: null };
}

const produtoDaTela = { produto_id: "p1", nome_produto: "ZZ Shampoo", preco_unitario: 0, quantidade: 1, criado_em: undefined as string | undefined };

test("REPRODUZ o defeito do Preview: código antigo ({...produto} com criado_em undefined) viola NOT NULL", () => {
  const antigo = [{ ...produtoDaTela, id: "x", salao_id: "s1", agendamento_id: "ag1", estoque_baixado: false }];
  const r = simularInsertEmLote(antigo);
  assert.match(r.erro ?? "", /null value in column "criado_em"/);
});

test("montarLinhasProdutos: criado_em sempre é uma data ISO válida e nenhuma coluna obrigatória fica sem valor", () => {
  const linhas = montarLinhasProdutos("ag1", "s1", [produtoDaTela, { ...produtoDaTela, produto_id: "p2" }], (() => { let n = 0; return () => `id${++n}`; })(), new Date("2026-10-16T19:00:00Z"));
  assert.equal(linhas.length, 2);
  for (const l of linhas) {
    for (const [k, v] of Object.entries(l)) assert.ok(v !== undefined && v !== null, `coluna ${k} sem valor`);
    assert.ok(!Number.isNaN(Date.parse(l.criado_em)));
    assert.equal(l.estoque_baixado, false);
  }
  assert.equal(linhas[0].criado_em, "2026-10-16T19:00:00.000Z");
  assert.equal(linhas[1].criado_em, "2026-10-16T19:00:00.001Z"); // mantém a ordem
  assert.deepEqual(Object.keys(linhas[0]).sort(), [...COLUNAS_OBRIGATORIAS_SEM_DEFAULT, ...COLUNAS_OBRIGATORIAS_COM_DEFAULT].sort());
});

test("o INSERT com as linhas novas é aceito (mesmo no modo padrão do supabase-js, defaultToNull=true)", () => {
  const linhas = montarLinhasProdutos("ag1", "s1", [produtoDaTela], () => "id1");
  assert.equal(simularInsertEmLote(linhas as unknown as Record<string, unknown>[], true).erro, null);
  assert.equal(simularInsertEmLote(linhas as unknown as Record<string, unknown>[], false).erro, null);
});

test("criado_em já existente (linha reaproveitada) é preservado; data inválida é substituída", () => {
  const l = montarLinhasProdutos("ag1", "s1", [{ ...produtoDaTela, criado_em: "2026-10-15T10:00:00.000Z" }, { ...produtoDaTela, criado_em: "lixo" }], () => "i", new Date("2026-10-16T19:00:00Z"));
  assert.equal(l[0].criado_em, "2026-10-15T10:00:00.000Z");
  assert.equal(l[1].criado_em, "2026-10-16T19:00:00.001Z");
});

test("gravarItensEProdutos não manda chave criado_em com valor undefined ao repositório", async () => {
  const { repo } = criarBanco();
  let recebido: Record<string, unknown>[] = [];
  const original = repo.salvarProdutos;
  repo.salvarProdutos = async (ag, salao, produtos) => { recebido = produtos as unknown as Record<string, unknown>[]; return original(ag, salao, produtos); };
  await gravarItensEProdutos(repo, dados(1));
  assert.equal(recebido.length, 1);
  assert.ok(!("criado_em" in recebido[0]), "criado_em undefined não pode ser enviado como chave");
});

test("outros inserts em lote da comanda: agendamento_servicos traz todas as colunas obrigatórias com valor", () => {
  const item = dados(0).itens[0];
  for (const c of ["id", "salao_id", "agendamento_id", "servico_id", "nome_servico", "preco", "pacote_descontado", "comissao_fechada"]) {
    assert.ok((item as unknown as Record<string, unknown>)[c] !== undefined && (item as unknown as Record<string, unknown>)[c] !== null, c);
  }
});