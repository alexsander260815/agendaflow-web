// Mensagens padrão de WhatsApp + substituição de marcadores (mirror da lógica em NovoAgendamentoViewModel.kt).

export function mensagemPadraoConfirmacao(): string {
  return "Olá, {nome}, tudo bem?\n\nPreparamos um momento especial para cuidar de você! ✨\n\nSeu atendimento já está reservado:\n📅 Data: {data}\n⏰ Horário: {hora}\n💇 Serviço: {servicos}\n\nEsperamos por você! 🌸";
}

export function mensagemPadraoRemarcacao(): string {
  return "Olá, {nome}! Seu horário foi remarcado. 📅\n\nNova data: {data} às {hora}.\n\nQualquer dúvida, é só chamar por aqui!";
}

export function mensagemPadraoCancelamento(): string {
  return "Olá, {nome}! Infelizmente precisamos cancelar seu horário de {data} às {hora}. 😔\n\nEntre em contato com a gente pra remarcar quando for melhor pra você!";
}

export function montarMensagemRetorno(nomeCliente: string, nomeServico: string, dias: number): string {
  const primeiroNome = nomeCliente.trim().split(" ")[0] ?? nomeCliente;
  return `Oi ${primeiroNome}! Já faz ${dias} dias que você fez ${nomeServico} aqui — que tal agendar seu retorno? 💅`;
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
