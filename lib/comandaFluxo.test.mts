// @ts-nocheck  (arquivo de teste rodado com 'node --test'; o import com extensao .ts so vale no Node)
// Testes do fluxo de gravação/conclusão da comanda, com um banco simulado em memória que imita o comportamento real:
//  - salvarItens: apaga os itens do agendamento e insere os novos
//  - salvarProdutos: apaga linhas NÃO vendidas e insere as novas
//  - concluirVenda (concluir_venda_produtos): numa transação, baixa só linhas não vendidas, recusa saldo insuficiente, marca CONCLUIDO
// Rodar:  node --test lib/comandaFluxo.test.mts
import test from "node:test";
import assert from "node:assert/strict";
import { concluirComandaGravando, estornarSeNecessario, gravarItensEProdutos, mensagemDeErro, montarLinhasProdutos, ErroComanda, type RepositorioComanda, type DadosComanda } from "./comandaFluxo.ts";

type Linha = { id: string; salao_id: string; agendamento_id: string; produto_id: string; nome_produto: string; preco_unitario: number; quantidade: number; estoque_baixado: boolean };
type Item = { id: string; salao_id: string; agendamento_id: string; servico_id: string; nome_servico: string; preco: number; cliente_pacote_id: string | null; pacote_descontado: boolean; comissao_fechada: boolean };

function criarBanco(opcoes: { saldo?: number; falhaAoSalvarProdutos?: boolean; descartaProdutosSilenciosamente?: boolean; falhaNaLeitura?: boolean; falhaAoSalvarItens?: boolean; falhaNoEstorno?: boolean; falhaNaVerificacaoDoEstorno?: boolean } = {}) {
  const b = {
    status: "AGENDADO" as string,
    forma: null as string | null,
    itens: [] as Item[],
    produtos: [] as Linha[],
    saldo: opcoes.saldo ?? 5,
    movimentacoes: [] as { tipo: string; quantidade: number }[],
    pacoteRestante: 3,
    chamadas: { concluirVenda: 0, salvarProdutos: 0, salvarItens: 0, estornar: 0 },
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
    async listarItens(ag) {
      if (opcoes.falhaNaVerificacaoDoEstorno) throw { message: "connection reset" };
      return b.itens.filter((i) => i.agendamento_id === ag);
    },
    async estornar(ag) {
      b.chamadas.estornar++;
      if (opcoes.falhaNoEstorno) throw { message: "Acesso negado à comanda" };
      // imita estornar_comanda (0033): devolve produtos vendidos (ENTRADA) e sessoes de pacote; so age sobre o que esta marcado como feito
      for (const l of b.produtos.filter((p) => p.agendamento_id === ag && p.estoque_baixado)) { b.saldo += l.quantidade; b.movimentacoes.push({ tipo: "ENTRADA", quantidade: l.quantidade }); l.estoque_baixado = false; }
      for (const i of b.itens.filter((i) => i.agendamento_id === ag && i.pacote_descontado && i.cliente_pacote_id)) { b.pacoteRestante++; i.pacote_descontado = false; }
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

test("não consegue nem conferir o estado atual (sessão expirada) => para ANTES de gravar qualquer coisa", async () => {
  const { b, repo } = criarBanco({ falhaNaLeitura: true });
  await assert.rejects(concluirComandaGravando(repo, dados(1), "PIX"), (e: unknown) => e instanceof ErroComanda && e.etapa === "verificar_tela" && /JWT expired/.test(e.message) && /Nada foi alterado/.test(e.message));
  assert.equal(b.status, "AGENDADO"); assert.equal(b.chamadas.concluirVenda, 0); assert.equal(b.chamadas.salvarItens, 0); assert.equal(b.chamadas.salvarProdutos, 0);
});

test("grava, mas não consegue ler de volta para conferir => não conclui", async () => {
  const { b, repo } = criarBanco();
  let leituras = 0; const original = repo.listarProdutos;
  repo.listarProdutos = async (ag) => { if (++leituras >= 2) throw { message: "JWT expired" }; return original(ag); }; // 1ª leitura (conferir tela) ok; 2ª (conferir gravação) falha
  await assert.rejects(concluirComandaGravando(repo, dados(1), "PIX"), (e: unknown) => e instanceof ErroComanda && e.etapa === "confirmar_produtos" && /JWT expired/.test(e.message));
  assert.equal(b.status, "AGENDADO"); assert.equal(b.chamadas.concluirVenda, 0); assert.equal(b.saldo, 5);
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

// ---------------------------------------------------------------------------------------------------------------------------
// REABRIR / CANCELAR / FALTA / EXCLUIR: a decisão de estornar vem do BANCO; depois de reabrir a tela é recarregada do banco;
// tela desatualizada nunca apaga produto vendido ou estornado; estorno e baixa nunca são duplicados.
async function recarregarTela(repo, ag = "ag1") {
  return { produtos: await repo.listarProdutos(ag), itens: await repo.listarItens(ag) };
}
function reabrirNoBanco(b) { b.status = "AGENDADO"; } // o site muda o status só DEPOIS de estornar com sucesso

test("REABRIR e CONCLUIR de novo: estoque 5 -> 4 -> 5 -> 4, uma baixa por conclusão, sem duplicar linha", async () => {
  const { b, repo } = criarBanco();
  await concluirComandaGravando(repo, dados(1), "PIX");
  assert.equal(b.saldo, 4);
  assert.deepEqual(await estornarSeNecessario(repo, "ag1"), { estornou: true });   // Reabrir
  reabrirNoBanco(b);
  assert.equal(b.saldo, 5);
  const tela = await recarregarTela(repo);                                          // a tela é recarregada do banco
  assert.equal(tela.produtos.length, 1); assert.equal(tela.produtos[0].estoque_baixado, false);
  assert.equal(await concluirComandaGravando(repo, { agendamentoId: "ag1", salaoId: "s1", itens: tela.itens.length ? tela.itens : dados(0).itens, produtos: tela.produtos }, "CARTAO"), "concluida");
  assert.equal(b.saldo, 4); assert.equal(b.produtos.length, 1); assert.equal(b.produtos[0].estoque_baixado, true);
  assert.deepEqual(b.movimentacoes, [{ tipo: "VENDA", quantidade: 1 }, { tipo: "ENTRADA", quantidade: 1 }, { tipo: "VENDA", quantidade: 1 }]);
});

test("TELA DESATUALIZADA depois de reabrir (mostra 'Vendido', banco já estornou): salvar/concluir é BARRADO e nada é apagado", async () => {
  const { b, repo } = criarBanco();
  await concluirComandaGravando(repo, dados(1), "PIX");
  const telaAntiga = (await repo.listarProdutos("ag1")).map((l) => ({ ...l })); // linha vendida (estoque_baixado=true) como a tela viu
  await estornarSeNecessario(repo, "ag1"); reabrirNoBanco(b);                    // outra aba/ação reabre: o banco agora tem a linha pendente
  await assert.rejects(gravarItensEProdutos(repo, { agendamentoId: "ag1", salaoId: "s1", itens: dados(0).itens, produtos: telaAntiga }), (e) => e instanceof ErroComanda && e.etapa === "tela_desatualizada");
  await assert.rejects(concluirComandaGravando(repo, { agendamentoId: "ag1", salaoId: "s1", itens: dados(0).itens, produtos: telaAntiga }, "PIX"), (e) => e instanceof ErroComanda && e.etapa === "tela_desatualizada");
  assert.equal(b.produtos.length, 1, "a linha do produto NÃO pode ser apagada"); assert.equal(b.produtos[0].estoque_baixado, false);
  assert.equal(b.saldo, 5); assert.equal(b.status, "AGENDADO"); assert.equal(b.chamadas.concluirVenda, 1); // só a conclusão original
});

test("TELA DESATUALIZADA ao contrário (banco concluído em outra aba, tela ainda pendente): não grava segunda linha nem baixa de novo", async () => {
  const { b, repo } = criarBanco();
  const telaPendente = dados(1);                                   // aba A abriu a comanda pendente
  await concluirComandaGravando(repo, dados(1), "PIX");            // aba B concluiu
  await assert.rejects(gravarItensEProdutos(repo, telaPendente), (e) => e instanceof ErroComanda && e.etapa === "tela_desatualizada");
  assert.equal(b.produtos.length, 1); assert.equal(b.saldo, 4); assert.equal(b.chamadas.concluirVenda, 1);
});

test("salvar uma comanda JÁ concluída sem produtos novos continua permitido (editar observação/horário não é bloqueado)", async () => {
  const { b, repo } = criarBanco();
  await concluirComandaGravando(repo, dados(1), "PIX");
  const vendidas = await repo.listarProdutos("ag1");
  await gravarItensEProdutos(repo, { agendamentoId: "ag1", salaoId: "s1", itens: dados(0).itens, produtos: vendidas });
  assert.equal(b.produtos.length, 1); assert.equal(b.produtos[0].estoque_baixado, true); assert.equal(b.saldo, 4);
});

test("estorno é decidido PELO BANCO: CONCLUIDO no banco => estorna, mesmo que a tela tenha outro status", async () => {
  const { b, repo } = criarBanco();
  await concluirComandaGravando(repo, dados(1), "PIX");
  assert.equal((await estornarSeNecessario(repo, "ag1")).estornou, true);
  assert.equal(b.saldo, 5);
});

test("AGENDADO no banco, sem produto vendido nem pacote descontado => NÃO chama o estorno", async () => {
  const { b, repo } = criarBanco();
  await gravarItensEProdutos(repo, dados(1));
  assert.deepEqual(await estornarSeNecessario(repo, "ag1"), { estornou: false });
  assert.equal(b.chamadas.estornar, 0); assert.equal(b.saldo, 5);
});

test("vazamento antigo (status AGENDADO mas produto ainda marcado como vendido): o estorno corrige e devolve o estoque", async () => {
  const { b, repo } = criarBanco();
  await concluirComandaGravando(repo, dados(1), "PIX");
  b.status = "AGENDADO"; // reaberto só trocando o status (o defeito antigo)
  assert.equal((await estornarSeNecessario(repo, "ag1")).estornou, true);
  assert.equal(b.saldo, 5); assert.equal(b.produtos[0].estoque_baixado, false);
});

test("pacote: sessão descontada é devolvida pelo estorno mesmo sem produto, e uma vez só", async () => {
  const { b, repo } = criarBanco();
  b.itens = [{ id: "i1", salao_id: "s1", agendamento_id: "ag1", servico_id: "sv1", nome_servico: "corte", preco: 0, cliente_pacote_id: "pc1", pacote_descontado: true, comissao_fechada: false }];
  b.pacoteRestante = 2; b.status = "AGENDADO";
  assert.equal((await estornarSeNecessario(repo, "ag1")).estornou, true);
  assert.equal(b.pacoteRestante, 3); assert.equal(b.itens[0].pacote_descontado, false);
  assert.equal((await estornarSeNecessario(repo, "ag1")).estornou, false);
  assert.equal(b.pacoteRestante, 3);
});

test("estornar duas vezes (duplo clique / nova tentativa) NÃO devolve em dobro", async () => {
  const { b, repo } = criarBanco();
  await concluirComandaGravando(repo, dados(1), "PIX");
  await estornarSeNecessario(repo, "ag1");            // status continua CONCLUIDO no banco (ex.: falhou o passo seguinte)
  await estornarSeNecessario(repo, "ag1");            // nova tentativa: chama o estorno de novo, que nada devolve
  assert.equal(b.saldo, 5); assert.equal(b.movimentacoes.filter((m) => m.tipo === "ENTRADA").length, 1);
});

test("duas tentativas de reabrir AO MESMO TEMPO devolvem uma vez só", async () => {
  const { b, repo } = criarBanco();
  await concluirComandaGravando(repo, dados(1), "PIX");
  await Promise.all([estornarSeNecessario(repo, "ag1"), estornarSeNecessario(repo, "ag1")]);
  assert.equal(b.saldo, 5);
});

test("falha ao VERIFICAR o que estornar => erro claro, nada estornado (o status não deve mudar)", async () => {
  const { b, repo } = criarBanco({ falhaNaVerificacaoDoEstorno: true });
  await concluirComandaGravando(repo, dados(1), "PIX");
  await assert.rejects(estornarSeNecessario(repo, "ag1"), (e) => e instanceof ErroComanda && e.etapa === "verificar_estorno" && /connection reset/.test(e.message) && /Nada foi alterado/.test(e.message));
  assert.equal(b.chamadas.estornar, 0); assert.equal(b.saldo, 4);
});

test("falha NO estorno => erro claro; estoque e status intactos; reabrir/cancelar/excluir não devem prosseguir", async () => {
  const { b, repo } = criarBanco({ falhaNoEstorno: true });
  await concluirComandaGravando(repo, dados(1), "PIX");
  await assert.rejects(estornarSeNecessario(repo, "ag1"), (e) => e instanceof ErroComanda && e.etapa === "estornar" && /Acesso negado/.test(e.message) && /status continua o mesmo/.test(e.message));
  assert.equal(b.saldo, 4); assert.equal(b.status, "CONCLUIDO"); assert.equal(b.produtos[0].estoque_baixado, true);
});

test("sequência completa: concluir, reabrir, cancelar => o estoque volta a 5 uma vez e o cancelamento não devolve de novo", async () => {
  const { b, repo } = criarBanco();
  await concluirComandaGravando(repo, dados(1), "PIX");
  await estornarSeNecessario(repo, "ag1"); reabrirNoBanco(b);     // reabrir
  assert.deepEqual(await estornarSeNecessario(repo, "ag1"), { estornou: false }); // cancelar: nada mais a devolver
  b.status = "CANCELADO";
  assert.equal(b.saldo, 5); assert.equal(b.movimentacoes.filter((m) => m.tipo === "ENTRADA").length, 1);
});