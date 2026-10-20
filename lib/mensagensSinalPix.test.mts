// @ts-nocheck  (arquivo de teste rodado com 'node --test'; o import com extensao .ts so vale no Node)
// Testes da mensagem de Sinal Pix personalizada por profissional (mesmas regras do app Android 1.16).
// Rodar:  node --test lib/mensagensSinalPix.test.mts
import test from "node:test";
import assert from "node:assert/strict";
import { mensagemBaseSinalPix, mensagemErroSalvarSinalPix, mensagemSinalPixPersonalizada, montarMensagemSinalPix, validarMensagemSinalPix } from "./mensagens.ts";

const dados = { nomeCliente: "Maria Souza", valor: 35.5, chave: "chave@pix.com", nomeBeneficiario: "Ana Souza", cidade: "São Paulo" };

test("nunca personalizou, em branco ou 'forçar padrão' do salão: usa o texto de sempre do site (null)", () => {
  assert.equal(mensagemSinalPixPersonalizada({ forcar_mensagem_padrao: false }, { mensagem_sinal_pix: null }), null);
  assert.equal(mensagemSinalPixPersonalizada({ forcar_mensagem_padrao: false }, {}), null);
  assert.equal(mensagemSinalPixPersonalizada({ forcar_mensagem_padrao: false }, undefined), null);
  assert.equal(mensagemSinalPixPersonalizada({ forcar_mensagem_padrao: false }, { mensagem_sinal_pix: "   " }), null);
  assert.equal(mensagemSinalPixPersonalizada({ forcar_mensagem_padrao: true }, { mensagem_sinal_pix: "Minha {valor} {chave}" }), null);
  assert.equal(mensagemSinalPixPersonalizada(null, { mensagem_sinal_pix: "x {valor} {chave}" }), "x {valor} {chave}");
});

test("cada profissional usa a própria mensagem e nunca a de outro", () => {
  const a = { mensagem_sinal_pix: "Da A {valor} {chave}" };
  const b = { mensagem_sinal_pix: "Da B {valor} {chave}" };
  const c = { mensagem_sinal_pix: null };
  const salao = { forcar_mensagem_padrao: false };
  assert.equal(mensagemSinalPixPersonalizada(salao, a), "Da A {valor} {chave}");
  assert.equal(mensagemSinalPixPersonalizada(salao, b), "Da B {valor} {chave}");
  assert.equal(mensagemSinalPixPersonalizada(salao, c), null);
});

test("marcadores: valor, chave Pix e dados do agendamento", () => {
  const t = new Date(2026, 10, 5, 14, 30).getTime();
  const m = "Oi {nome}, aqui é {profissional}! Sinal de R$ {valor} para {servicos} em {data} às {hora}.\nPix: {chave} ({beneficiario} - {cidade})";
  assert.equal(
    montarMensagemSinalPix(m, { ...dados, dataHoraMillis: t, nomeProfissional: "Ana", nomesServicos: "Corte, Escova" }),
    "Oi Maria, aqui é Ana! Sinal de R$ 35,50 para Corte, Escova em 05/11 às 14:30.\nPix: chave@pix.com (Ana Souza - São Paulo)"
  );
});

test("cada marcador é trocado uma vez (nome com marcador não é reprocessado)", () => {
  assert.equal(montarMensagemSinalPix("{nome} {valor} {chave}", { ...dados, nomeCliente: "{chave} Perigo" }), "{chave} 35,50 chave@pix.com");
});

test("marcador desconhecido fica como está e sem data a data e a hora saem vazias", () => {
  assert.equal(montarMensagemSinalPix("{foo} {valor} {chave} [{data}] [{hora}]", dados), "{foo} 35,50 chave@pix.com [] []");
});

test("rede de segurança: modelo sem chave ou sem valor recebe o que faltar", () => {
  const semChave = montarMensagemSinalPix("Olá {nome}, sinal de R$ {valor}.", dados);
  assert.ok(semChave.startsWith("Olá Maria, sinal de R$ 35,50."));
  assert.ok(semChave.endsWith("\n\nChave Pix: chave@pix.com\nBeneficiário: Ana Souza\nCidade: São Paulo"));
  assert.equal(montarMensagemSinalPix("Pix: {chave}", dados), "Pix: chave@pix.com\n\nValor: R$ 35,50");
  const completo = montarMensagemSinalPix("{valor} {chave}", dados);
  assert.ok(!completo.includes("Valor:") && !completo.includes("Beneficiário"));
});

test("modelo em branco usa o texto base e o valor sai com vírgula como no app", () => {
  assert.equal(
    montarMensagemSinalPix("  ", dados),
    "Olá, Maria! O valor para pagamento é R$ 35,50.\n\nChave Pix: chave@pix.com\nBeneficiário: Ana Souza\nCidade: São Paulo\n\nQualquer dúvida é só chamar por aqui 🙂"
  );
  assert.ok(mensagemBaseSinalPix().includes("{valor}") && mensagemBaseSinalPix().includes("{chave}"));
});

test("validação ao salvar: em branco pode; texto precisa de {valor} e {chave}", () => {
  assert.equal(validarMensagemSinalPix(""), null);
  assert.equal(validarMensagemSinalPix("   "), null);
  assert.equal(validarMensagemSinalPix("Pague {valor} em {chave}"), null);
  assert.equal(validarMensagemSinalPix("Oi {nome}"), "A mensagem precisa conter {valor} e {chave} para o cliente saber quanto e para quem pagar.");
  assert.equal(validarMensagemSinalPix("Pague {valor}"), "A mensagem precisa conter {chave} para o cliente saber quanto e para quem pagar.");
});

test("mensagens de erro simples, sem detalhe técnico", () => {
  const casos = [
    [new TypeError("Failed to fetch"), "Sem conexão com a internet. A mensagem não foi alterada. Verifique a conexão e tente novamente."],
    [{ message: "JWT expired", code: "PGRST301" }, "Sua sessão expirou. Entre novamente e tente de novo. A mensagem não foi alterada."],
    [{ message: 'new row violates row-level security policy for table "perfis"', code: "42501" }, "O servidor recusou a alteração (sem permissão). A mensagem não foi alterada."],
    [{ message: "Could not find the 'mensagem_sinal_pix' column of 'perfis' in the schema cache", code: "PGRST204" }, "Este recurso ainda não está disponível no servidor. A mensagem não foi alterada. Tente novamente mais tarde."],
    [new Error("A mensagem não foi salva (0 linhas atualizadas)."), "A mensagem não foi salva. Tente novamente."],
    [new Error("qualquer coisa estranha"), "Não foi possível salvar a mensagem. A mensagem não foi alterada. Tente novamente."],
  ];
  for (const [erro, esperado] of casos) {
    const m = mensagemErroSalvarSinalPix(erro);
    assert.equal(m, esperado);
    for (const proibido of ["row-level", "violates", "jwt", "pgrst", "schema cache", "failed to fetch"]) assert.ok(!m.toLowerCase().includes(proibido), `${proibido} em: ${m}`);
  }
});
