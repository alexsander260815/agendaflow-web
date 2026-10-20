// Mensagens padrão de WhatsApp + substituição de marcadores (mirror da lógica em NovoAgendamentoViewModel.kt).

type TipoMensagem = "mensagem_confirmacao" | "mensagem_remarcacao" | "mensagem_cancelamento" | "mensagem_retorno";

/**
 * Decide qual mensagem usar pra um agendamento: a do profissional responsável
 * (se ele personalizou a dele), a do salão, ou a padrão do sistema — nessa ordem.
 * Se o salão tiver "forcar_mensagem_padrao" ligado, sempre usa a do salão.
 */
export function mensagemEfetiva(
  tipo: TipoMensagem,
  salao: { forcar_mensagem_padrao: boolean } & Record<TipoMensagem, string | null>,
  profissional: Partial<Record<TipoMensagem, string | null>> | null | undefined,
  padrao: () => string
): string {
  if (salao.forcar_mensagem_padrao) return salao[tipo] ?? padrao();
  return profissional?.[tipo] ?? salao[tipo] ?? padrao();
}

export function mensagemPadraoConfirmacao(): string {
  return "Olá, {nome}, tudo bem?\n\nPreparamos um momento especial para cuidar de você! ✨\n\nSeu atendimento já está reservado:\n📅 Data: {data}\n⏰ Horário: {hora}\n💇 Serviço: {servicos}\n\nEsperamos por você! 🌸";
}

export function mensagemPadraoRemarcacao(): string {
  return "Olá, {nome}! Seu horário foi remarcado. 📅\n\nNova data: {data} às {hora}.\n\nQualquer dúvida, é só chamar por aqui!";
}

export function mensagemPadraoCancelamento(): string {
  return "Olá, {nome}! Infelizmente precisamos cancelar seu horário de {data} às {hora}. 😔\n\nEntre em contato com a gente pra remarcar quando for melhor pra você!";
}

export function mensagemPadraoRetorno(): string {
  return "Oi {nome}! Já faz {dias} dias que você fez {servico} aqui — que tal agendar seu retorno? 💅";
}

export function montarMensagemRetorno(mensagemBase: string, nomeCliente: string, nomeServico: string, dias: number): string {
  const primeiroNome = nomeCliente.trim().split(" ")[0] ?? nomeCliente;
  return mensagemBase
    .replaceAll("{nome}", primeiroNome)
    .replaceAll("{servico}", nomeServico)
    .replaceAll("{dias}", String(dias));
}

export function substituirMarcadores(
  mensagem: string,
  nomeCliente: string,
  dataHoraMillis: number,
  nomeProfissional: string = "",
  nomesServicos: string = ""
): string {
  const primeiroNome = nomeCliente.trim().split(" ")[0] ?? nomeCliente;
  const d = new Date(dataHoraMillis);
  const dataFormatada = `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}`;
  const horaFormatada = `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;

  return mensagem
    .replaceAll("{nome}", primeiroNome)
    .replaceAll("{data}", dataFormatada)
    .replaceAll("{hora}", horaFormatada)
    .replaceAll("{profissional}", nomeProfissional)
    .replaceAll("{servicos}", nomesServicos);
}

// ---------------------------------------------------------------------------------------------------------------------------------------------
// Mensagem de SINAL PIX personalizada por profissional (coluna perfis.mensagem_sinal_pix; mesma regra do app Android 1.16).
// Quem nunca personalizou continua recebendo o texto de sempre do site (montado em agenda/[id]/page.tsx, com o Pix copia e cola).
// Marcadores: {nome} primeiro nome do cliente · {valor} valor do sinal (ex.: 30,00) · {chave} chave Pix · {beneficiario} · {cidade}
//             {data} {hora} {servicos} {profissional}: dados do agendamento
// ---------------------------------------------------------------------------------------------------------------------------------------------
export const MARCADORES_SINAL_PIX = "{nome} {valor} {chave} {beneficiario} {cidade} {data} {hora} {servicos} {profissional}";

// Texto sugerido como ponto de partida ao editar (o mesmo do app). Usa só marcadores que o app e o site entendem.
export function mensagemBaseSinalPix(): string {
  return "Olá, {nome}! O valor para pagamento é R$ {valor}.\n\nChave Pix: {chave}\nBeneficiário: {beneficiario}\nCidade: {cidade}\n\nQualquer dúvida é só chamar por aqui 🙂";
}

/** null = pode salvar. Em branco é permitido (volta ao texto padrão); um texto próprio precisa ter {valor} e {chave}. */
export function validarMensagemSinalPix(texto: string): string | null {
  if (texto.trim() === "") return null;
  const faltando = ["{valor}", "{chave}"].filter((m) => !texto.includes(m));
  return faltando.length === 0 ? null : `A mensagem precisa conter ${faltando.join(" e ")} para o cliente saber quanto e para quem pagar.`;
}

/**
 * Modelo personalizado a usar no Sinal Pix de um agendamento: o do profissional responsável, se ele personalizou. Devolve null quando deve valer o
 * texto padrão do site (nunca personalizou, em branco, ou o Dono ligou "forçar mensagem padrão", que vale também para o Sinal Pix).
 */
export function mensagemSinalPixPersonalizada(
  salao: { forcar_mensagem_padrao: boolean } | null | undefined,
  profissional: { mensagem_sinal_pix?: string | null } | null | undefined
): string | null {
  if (salao?.forcar_mensagem_padrao) return null;
  const texto = profissional?.mensagem_sinal_pix;
  return texto && texto.trim() !== "" ? texto : null;
}

const MARCADOR_SINAL_PIX = /\{(nome|valor|chave|beneficiario|cidade|data|hora|servicos|profissional)\}/g;

/**
 * Monta o texto final. Cada marcador é trocado uma única vez (um nome com "{chave}" não é reprocessado). Por segurança, se o modelo não tiver {valor} ou
 * {chave}, o que faltar é ACRESCENTADO ao fim: a cobrança nunca sai sem o valor e a chave Pix.
 */
export function montarMensagemSinalPix(
  modelo: string,
  dados: {
    nomeCliente: string;
    valor: number;
    chave: string;
    nomeBeneficiario: string;
    cidade: string;
    dataHoraMillis?: number | null;
    nomeProfissional?: string;
    nomesServicos?: string;
  }
): string {
  const base = modelo.trim() === "" ? mensagemBaseSinalPix() : modelo;
  const primeiroNome = dados.nomeCliente.trim().split(" ")[0] ?? dados.nomeCliente;
  const valor = dados.valor.toFixed(2).replace(".", ",");
  let data = "";
  let hora = "";
  if (dados.dataHoraMillis != null) {
    const d = new Date(dados.dataHoraMillis);
    data = `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}`;
    hora = `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  }
  const valores: Record<string, string> = {
    nome: primeiroNome, valor, chave: dados.chave, beneficiario: dados.nomeBeneficiario, cidade: dados.cidade,
    data, hora, servicos: dados.nomesServicos ?? "", profissional: dados.nomeProfissional ?? "",
  };
  let texto = base.replace(MARCADOR_SINAL_PIX, (_m, nome: string) => valores[nome] ?? _m);
  if (!base.includes("{valor}")) texto += `\n\nValor: R$ ${valor}`;
  if (!base.includes("{chave}")) texto += `\n\nChave Pix: ${dados.chave}\nBeneficiário: ${dados.nomeBeneficiario}\nCidade: ${dados.cidade}`;
  return texto;
}

/** Mensagem simples (sem detalhe técnico) para uma falha ao salvar a mensagem de Sinal Pix. */
export function mensagemErroSalvarSinalPix(e: unknown): string {
  const texto = (e instanceof Error ? e.message : typeof e === "string" ? e : JSON.stringify(e ?? "")).toLowerCase();
  if (texto.includes("mensagem_sinal_pix") && (texto.includes("does not exist") || texto.includes("schema cache") || texto.includes("could not find"))) {
    return "Este recurso ainda não está disponível no servidor. A mensagem não foi alterada. Tente novamente mais tarde.";
  }
  if (texto.includes("jwt expired") || texto.includes("invalid jwt")) return "Sua sessão expirou. Entre novamente e tente de novo. A mensagem não foi alterada.";
  if (texto.includes("row-level security") || texto.includes("violates") || texto.includes("permission denied")) {
    return "O servidor recusou a alteração (sem permissão). A mensagem não foi alterada.";
  }
  if (texto.includes("failed to fetch") || texto.includes("networkerror") || texto.includes("network request failed") || texto.includes("load failed")) {
    return "Sem conexão com a internet. A mensagem não foi alterada. Verifique a conexão e tente novamente.";
  }
  if (texto.includes("0 linhas") || texto.includes("nao foi salva") || texto.includes("não foi salva")) return "A mensagem não foi salva. Tente novamente.";
  return "Não foi possível salvar a mensagem. A mensagem não foi alterada. Tente novamente.";
}
