"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import {
  AlertTriangle,
  Calendar,
  Check,
  ChevronRight,
  Clock,
  MessageCircle,
  Landmark,
  Minus,
  Package,
  Pencil,
  Plus,
  RotateCcw,
  Scissors,
  Trash2,
  User,
  Users,
  X,
} from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import {
  buscarAgendamento,
  atualizarAgendamento,
  salvarAgendamento as salvarAgendamentoRepo,
  deletarAgendamento as deletarAgendamentoRepo,
  listarAgendamentos,
  listarAgendamentoServicos,
  listarItensPorAgendamento,
  salvarItensComanda,
  listarClientes,
  salvarCliente,
  listarServicos,
  listarEquipe,
  listarClientePacotesPorCliente,
  buscarClientePacote,
  atualizarQuantidadeClientePacote,
  marcarComoDescontado,
  confirmarSinal,
  gerarCobrancaSinal,
  buscarMeuSalao,
  listarProdutos,
  listarProdutosDaComanda,
  salvarProdutosDaComanda,
  concluirVendaProdutos,
} from "@/lib/repositories";
import { criarRetornoCliente, listarBloqueiosAgenda } from "@/lib/repositories";
import { registrarAuditoria } from "@/lib/auditoria";
import { Agendamento, AgendamentoServico, Cliente, ClientePacote, ItemComanda, Perfil, Produto, ProdutoComanda, Salao, Servico } from "@/lib/types";
import { converterIsoParaMillis, converterMillisParaIso, formatarMoeda, formatarStatus } from "@/lib/datetime";
import { abrirWhatsApp } from "@/lib/whatsapp";
import { montarPixCopiaECola } from "@/lib/pix";
import { mensagemEfetiva, mensagemPadraoConfirmacao, substituirMarcadores } from "@/lib/mensagens";
import Avatar from "@/components/Avatar";

const inputClass =
  "flex items-center gap-2.5 rounded-xl border border-border-subtle bg-surface px-4 py-3 transition-colors focus-within:border-accent";

const STATUS_ESTILO: Record<string, string> = {
  AGENDADO: "bg-info/12 text-info",
  CONFIRMADO: "bg-success/12 text-success",
  CONCLUIDO: "bg-finalizado/12 text-finalizado",
  FALTOU: "bg-warning/12 text-warning",
  CANCELADO: "bg-danger/12 text-danger",
};

export default function AgendamentoFormPage() {
  return (
    <Suspense
      fallback={
        <div className="flex flex-1 items-center justify-center p-5">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-accent border-t-transparent" />
        </div>
      }
    >
      <AgendamentoFormInner />
    </Suspense>
  );
}

function AgendamentoFormInner() {
  const { perfil } = useAuth();
  const params = useParams<{ id: string }>();
  const searchParams = useSearchParams();
  const router = useRouter();

  const editando = params.id !== "novo";
  const agendamentoId = editando ? params.id : null;
  const usuarioEProfissional = perfil?.papel === "PROFISSIONAL";

  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [servicos, setServicos] = useState<Servico[]>([]);
  const [equipe, setEquipe] = useState<Perfil[]>([]);
  const [agendamentoAtual, setAgendamentoAtual] = useState<Agendamento | null>(null);

  const [clienteSelecionado, setClienteSelecionado] = useState<Cliente | null>(null);
  const [profissionalSelecionadoId, setProfissionalSelecionadoId] = useState<string | null>(
    searchParams.get("profissionalId")
  );
  const [dataSelecionada, setDataSelecionada] = useState<string>(() => {
    const millis = searchParams.get("data") ? Number(searchParams.get("data")) : Date.now();
    const d = new Date(millis);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  });
  const [horaSelecionada, setHoraSelecionada] = useState<string>(() => {
    const minutos = searchParams.get("hora") ? Number(searchParams.get("hora")) : 9 * 60;
    const h = Math.floor(minutos / 60);
    const m = minutos % 60;
    return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
  });
  const [observacoes, setObservacoes] = useState("");
  const [itensComanda, setItensComanda] = useState<ItemComanda[]>([]);
  const [produtos, setProdutos] = useState<Produto[]>([]);
  const [produtosComanda, setProdutosComanda] = useState<ProdutoComanda[]>([]);
  const [pacotesAtivos, setPacotesAtivos] = useState<Map<string, ClientePacote>>(new Map());

  const [mostrarSeletorCliente, setMostrarSeletorCliente] = useState(false);
  const [mostrarSeletorServico, setMostrarSeletorServico] = useState(false);
  const [mostrarSeletorProduto, setMostrarSeletorProduto] = useState(false);
  const [termoBuscaProduto, setTermoBuscaProduto] = useState("");
  const [termoBuscaServico, setTermoBuscaServico] = useState("");
  const [mostrarPagamento, setMostrarPagamento] = useState(false);
  const [diasParaRetorno, setDiasParaRetorno] = useState("");
  const [mostrarExclusao, setMostrarExclusao] = useState(false);
  const [mensagemConflito, setMensagemConflito] = useState<string | null>(null);
  const [indiceEditandoPreco, setIndiceEditandoPreco] = useState<number | null>(null);
  const [precoEditado, setPrecoEditado] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [confirmandoSinal, setConfirmandoSinal] = useState(false);
  const [duracaoManual, setDuracaoManual] = useState<number | null>(null);
  const [salao, setSalao] = useState<Salao | null>(null);
  const [gerandoSinal, setGerandoSinal] = useState(false);
  const [mensagemSinal, setMensagemSinal] = useState<string | null>(null);

  async function handleGerarCobrancaPix() {
    if (!agendamentoAtual?.id || !clienteSelecionado) return;
    setMensagemSinal(null);

    if (!salao || !salao.sinal_ativo || salao.sinal_valor <= 0) {
      setMensagemSinal("O sinal não está ativado em Meu Negócio.");
      return;
    }

    const profissional = agendamentoAtual.profissional_id
      ? equipe.find((p) => p.id === agendamentoAtual.profissional_id)
      : null;

    // Quem recebe o sinal é decidido pelo salão (Meu Negócio > "Quem recebe o sinal"),
    // nunca por "o profissional por acaso tem alguma chave Pix cadastrada" — antes o
    // código ignorava salao.sinal_destino e preferia a chave do profissional sempre que
    // ela existisse, mesmo quando o salão tinha configurado para receber ele mesmo.
    const destinoProfissional = salao.sinal_destino === "PROFISSIONAL";
    const usaProfissional =
      destinoProfissional && !!profissional?.chave_pix && !!profissional?.pix_nome_beneficiario && !!profissional?.pix_cidade;

    if (destinoProfissional && !usaProfissional) {
      setMensagemSinal(
        `${profissional?.nome ?? "Este profissional"} ainda não cadastrou uma chave Pix para recebimento de sinal.`
      );
      return;
    }

    const chave = usaProfissional ? profissional!.chave_pix! : salao.chave_pix;
    const nome = usaProfissional ? profissional!.pix_nome_beneficiario! : salao.pix_nome_beneficiario || salao.nome;
    const cidade = (usaProfissional ? profissional!.pix_cidade : salao.pix_cidade) || "";

    if (!chave || !nome) {
      setMensagemSinal("Cadastre a chave Pix e o beneficiário em Meu Negócio.");
      return;
    }

    const destino: "SALAO" | "PROFISSIONAL" = usaProfissional ? "PROFISSIONAL" : "SALAO";
    const recebedorId = usaProfissional ? profissional!.id : null;

    setGerandoSinal(true);
    try {
      await gerarCobrancaSinal(agendamentoAtual.id, destino, recebedorId, salao.sinal_valor, chave, nome, cidade);
      setAgendamentoAtual({
        ...agendamentoAtual,
        sinal_status: "PENDENTE",
        sinal_destino: destino,
        sinal_recebedor_perfil_id: recebedorId,
        sinal_valor: salao.sinal_valor,
        sinal_chave_pix: chave,
        sinal_nome_beneficiario: nome,
        sinal_cidade: cidade,
      });

      const copiaECola = montarPixCopiaECola({
        chave,
        nomeBeneficiario: nome,
        cidade,
        valor: salao.sinal_valor,
        identificador: agendamentoAtual.id,
      });
      const primeiroNome = clienteSelecionado.nome.trim().split(" ")[0] ?? clienteSelecionado.nome;
      const mensagem =
        `Oi ${primeiroNome}! Pra confirmar seu horário, falta só o sinal de ${formatarMoeda(salao.sinal_valor)} via Pix.\n\n` +
        `Copia e cola o código abaixo no app do seu banco:\n\n${copiaECola}\n\n` +
        `Qualquer dúvida é só chamar por aqui 🙂`;
      abrirWhatsApp(clienteSelecionado.telefone, mensagem);
    } catch (e) {
      setMensagemSinal(e instanceof Error ? `Erro ao gerar a cobrança: ${e.message}` : "Erro ao gerar a cobrança.");
    } finally {
      setGerandoSinal(false);
    }
  }

  function handleEnviarConfirmacao() {
    if (!agendamentoAtual || !clienteSelecionado || !salao) return;
    const profissional = agendamentoAtual.profissional_id
      ? equipe.find((p) => p.id === agendamentoAtual.profissional_id)
      : null;
    const base = mensagemEfetiva("mensagem_confirmacao", salao, profissional, mensagemPadraoConfirmacao);
    const mensagem = substituirMarcadores(
      base,
      clienteSelecionado.nome,
      converterIsoParaMillis(agendamentoAtual.data_hora),
      profissional?.nome ?? "",
      itensComanda.map((i) => i.servico.nome).join(", ")
    );
    abrirWhatsApp(clienteSelecionado.telefone, mensagem);
  }

  async function carregarPacotesDoCliente(clienteId: string) {
    const todos = await listarClientePacotesPorCliente(clienteId);
    const ativos = new Map<string, ClientePacote>();
    todos.filter((p) => p.quantidade_restante > 0).forEach((p) => ativos.set(p.servico_id, p));
    setPacotesAtivos(ativos);
  }

  async function carregarAgendamento(id: string) {
    const ag = await buscarAgendamento(id);
    setAgendamentoAtual(ag);
    if (ag) {
      setProfissionalSelecionadoId(ag.profissional_id);
      const d = new Date(converterIsoParaMillis(ag.data_hora));
      setDataSelecionada(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`);
      setHoraSelecionada(`${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`);
      setObservacoes(ag.observacoes);
      setDuracaoManual(ag.duracao_minutos ?? null);
      if (ag.cliente_id) {
        await carregarPacotesDoCliente(ag.cliente_id);
      }
      const itens = await listarItensPorAgendamento(id);
      const produtosSalvos = await listarProdutosDaComanda(id);
      setProdutosComanda(produtosSalvos);
      setItensComanda(
        itens.map((item) => ({
          servico: {
            id: item.servico_id,
            salao_id: item.salao_id,
            nome: item.nome_servico,
            duracao_minutos: 0,
            preco: item.preco,
            categoria: null,
            variavel: false,
          },
          usaPacote: item.cliente_pacote_id !== null,
          clientePacoteId: item.cliente_pacote_id,
          precoCobrado: item.preco,
        }))
      );
    }
  }

  useEffect(() => {
    if (!perfil) return;
    const frame = window.requestAnimationFrame(() => {
      listarClientes(perfil.salao_id).then(setClientes);
      listarServicos(perfil.salao_id).then(setServicos);
      listarProdutos(perfil.salao_id).then(setProdutos);
      listarEquipe(perfil.salao_id).then((lista) => setEquipe(lista.filter((p) => p.atende_clientes)));
      buscarMeuSalao(perfil.salao_id).then(setSalao);
      if (editando && agendamentoId) void carregarAgendamento(agendamentoId);
    });
    return () => window.cancelAnimationFrame(frame);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [perfil?.id]);

  useEffect(() => {
    if (!clienteSelecionado) return;
    const frame = window.requestAnimationFrame(() => void carregarPacotesDoCliente(clienteSelecionado.id));
    return () => window.cancelAnimationFrame(frame);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clienteSelecionado?.id]);

  // Preenche clienteSelecionado ao editar, assim que a lista de clientes carrega
  useEffect(() => {
    if (agendamentoAtual && clientes.length) {
      const c = clientes.find((c) => c.id === agendamentoAtual.cliente_id);
      if (!c) return;
      const frame = window.requestAnimationFrame(() => setClienteSelecionado(c));
      return () => window.cancelAnimationFrame(frame);
    }
  }, [agendamentoAtual, clientes]);

  function adicionarServico(servico: Servico) {
    const pacote = pacotesAtivos.get(servico.id);
    setItensComanda((atual) => [
      ...atual,
      pacote
        ? { servico, usaPacote: true, clientePacoteId: pacote.id, precoCobrado: servico.preco }
        : { servico, usaPacote: false, clientePacoteId: null, precoCobrado: servico.preco },
    ]);
    setMostrarSeletorServico(false);
    setTermoBuscaServico("");
  }

  function removerServico(index: number) {
    setItensComanda((atual) => atual.filter((_, i) => i !== index));
  }

  function adicionarProduto(produto: Produto) {
    setProdutosComanda((atual) => {
      const existente = atual.find((item) => item.produto_id === produto.id && !item.estoque_baixado);
      if (existente) {
        if (existente.quantidade >= produto.saldo) return atual;
        return atual.map((item) =>
          item === existente ? { ...item, quantidade: item.quantidade + 1 } : item
        );
      }
      if (produto.saldo <= 0) return atual;
      return [
        ...atual,
        {
          id: crypto.randomUUID(),
          salao_id: produto.salao_id,
          agendamento_id: agendamentoId ?? "",
          produto_id: produto.id,
          nome_produto: produto.nome,
          preco_unitario: produto.preco,
          quantidade: 1,
          estoque_baixado: false,
        },
      ];
    });
    setMostrarSeletorProduto(false);
    setTermoBuscaProduto("");
  }

  function alterarQuantidadeProduto(produtoId: string, delta: number) {
    const saldo = produtos.find((produto) => produto.id === produtoId)?.saldo ?? 0;
    setProdutosComanda((atual) =>
      atual.flatMap((item) => {
        if (item.produto_id !== produtoId || item.estoque_baixado) return [item];
        const quantidade = Math.min(saldo, item.quantidade + delta);
        return quantidade > 0 ? [{ ...item, quantidade }] : [];
      })
    );
  }

  function confirmarEdicaoPreco() {
    if (indiceEditandoPreco === null) return;
    const novoPreco = parseFloat(precoEditado);
    if (!isNaN(novoPreco)) {
      setItensComanda((atual) =>
        atual.map((item, i) => (i === indiceEditandoPreco ? { ...item, precoCobrado: novoPreco } : item))
      );
    }
    setIndiceEditandoPreco(null);
  }

  const totalServicos = useMemo(
    () => itensComanda.filter((i) => !i.usaPacote).reduce((soma, i) => soma + i.precoCobrado, 0),
    [itensComanda]
  );
  const totalProdutos = useMemo(
    () => produtosComanda.reduce((soma, item) => soma + item.preco_unitario * item.quantidade, 0),
    [produtosComanda]
  );
  const total = totalServicos + totalProdutos;

  function calcularDataHoraMillis(): number {
    const [ano, mes, dia] = dataSelecionada.split("-").map(Number);
    const [hora, minuto] = horaSelecionada.split(":").map(Number);
    return new Date(ano, mes - 1, dia, hora, minuto, 0, 0).getTime();
  }

  function voltarParaAgenda() {
    const [ano, mes, dia] = dataSelecionada.split("-").map(Number);
    const millisDoDia = new Date(ano, mes - 1, dia, 0, 0, 0, 0).getTime();
    router.push(`/agenda?data=${millisDoDia}`);
  }

  const duracaoAutomatica = itensComanda.reduce((soma, i) => soma + i.servico.duracao_minutos, 0) || 30;
  const duracaoEfetiva = duracaoManual ?? duracaoAutomatica;

  function formatarHoraFinal(duracaoMinutos: number): string {
    const [hora, minuto] = horaSelecionada.split(":").map(Number);
    const totalMin = hora * 60 + minuto + duracaoMinutos;
    const totalMinNoDia = ((totalMin % 1440) + 1440) % 1440;
    const h = Math.floor(totalMinNoDia / 60);
    const m = totalMinNoDia % 60;
    return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
  }

  function handleMudarHoraFinal(valor: string) {
    const [hInicio, mInicio] = horaSelecionada.split(":").map(Number);
    const [hFim, mFim] = valor.split(":").map(Number);
    let diferenca = hFim * 60 + mFim - (hInicio * 60 + mInicio);
    if (diferenca <= 0) diferenca += 24 * 60;
    setDuracaoManual(diferenca);
  }

  async function verificarConflito(): Promise<string | null> {
    if (!profissionalSelecionadoId) return null;
    if (!perfil) return null;

    const duracaoTotal = duracaoEfetiva;
    const dataHoraMillis = calcularDataHoraMillis();
    const fimNovo = dataHoraMillis + duracaoTotal * 60_000;

    const [todos, todosItens, todosClientes] = await Promise.all([
      listarAgendamentos(perfil.salao_id),
      listarAgendamentoServicos(perfil.salao_id),
      listarClientes(perfil.salao_id),
    ]);
    const itensPorAgendamento = new Map<string, AgendamentoServico[]>();
    todosItens.forEach((i) => {
      const lista = itensPorAgendamento.get(i.agendamento_id) ?? [];
      lista.push(i);
      itensPorAgendamento.set(i.agendamento_id, lista);
    });
    const clientesMap = new Map(todosClientes.map((c) => [c.id, c.nome]));

    for (const outro of todos) {
      if (outro.id === agendamentoId) continue;
      if (outro.profissional_id !== profissionalSelecionadoId) continue;
      if (outro.status === "FALTOU" || outro.status === "CANCELADO") continue;
      const outroInicio = converterIsoParaMillis(outro.data_hora);
      const itensOutro = itensPorAgendamento.get(outro.id) ?? [];
      const duracaoOutro =
        outro.duracao_minutos ??
        (itensOutro.reduce((soma, i) => {
          const s = servicos.find((s) => s.id === i.servico_id);
          return soma + (s?.duracao_minutos ?? 30);
        }, 0) || 30);
      const outroFim = outroInicio + duracaoOutro * 60_000;

      if (dataHoraMillis < outroFim && fimNovo > outroInicio) {
        const nomeCliente = clientesMap.get(outro.cliente_id) ?? "outro cliente";
        const d = new Date(outroInicio);
        const hora = `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
        return `Já existe um agendamento às ${hora} com ${nomeCliente} para esse profissional.`;
      }
    }

    const bloqueios = await listarBloqueiosAgenda(perfil.salao_id);
    for (const b of bloqueios) {
      if (b.profissional_id !== profissionalSelecionadoId) continue;
      const bloqueioInicio = converterIsoParaMillis(b.data_inicio);
      const bloqueioFim = converterIsoParaMillis(b.data_fim);
      if (dataHoraMillis < bloqueioFim && fimNovo > bloqueioInicio) {
        return `Esse horário está bloqueado: ${b.motivo}`;
      }
    }

    return null;
  }

  async function handleSalvar(ignorarConflito = false) {
    if (!perfil || !clienteSelecionado || itensComanda.length === 0) return;
    setSalvando(true);
    try {
      if (!ignorarConflito) {
        const conflito = await verificarConflito();
        if (conflito) {
          setMensagemConflito(conflito);
          setSalvando(false);
          return;
        }
      }

      const dataHoraIso = converterMillisParaIso(calcularDataHoraMillis());
      const profissionalFinal = usuarioEProfissional ? perfil.id : profissionalSelecionadoId;
      const id = agendamentoId ?? crypto.randomUUID();

      if (editando && agendamentoId) {
        await atualizarAgendamento(agendamentoId, {
          id: agendamentoId,
          salao_id: perfil.salao_id,
          cliente_id: clienteSelecionado.id,
          profissional_id: profissionalFinal,
          data_hora: dataHoraIso,
          status: agendamentoAtual?.status ?? "AGENDADO",
          observacoes,
          forma_pagamento: agendamentoAtual?.forma_pagamento ?? null,
          duracao_minutos: duracaoManual,
        });
      } else {
        await salvarAgendamentoRepo({
          id,
          salao_id: perfil.salao_id,
          duracao_minutos: duracaoManual,
          cliente_id: clienteSelecionado.id,
          profissional_id: profissionalFinal,
          data_hora: dataHoraIso,
          status: "AGENDADO",
          observacoes,
          forma_pagamento: null,
        });
      }

      const itensParaSalvar: AgendamentoServico[] = itensComanda.map((item) => ({
        id: crypto.randomUUID(),
        salao_id: perfil.salao_id,
        agendamento_id: id,
        servico_id: item.servico.id,
        nome_servico: item.servico.nome,
        preco: item.precoCobrado,
        cliente_pacote_id: item.clientePacoteId,
        pacote_descontado: false,
        comissao_fechada: false,
      }));
      await salvarItensComanda(id, itensParaSalvar);
      await salvarProdutosDaComanda(
        id,
        perfil.salao_id,
        produtosComanda
          .filter((produto) => !produto.estoque_baixado)
          .map(({ produto_id, nome_produto, preco_unitario, quantidade, criado_em }) => ({
            produto_id,
            nome_produto,
            preco_unitario,
            quantidade,
            criado_em,
          }))
      );

      if (editando && agendamentoId) {
        registrarAuditoria(perfil.salao_id, perfil.id, "editar_comanda", "agendamento", agendamentoId, null, {
          total: itensParaSalvar.reduce((soma, i) => soma + i.preco, 0),
          quantidade_itens: itensParaSalvar.length,
        });
      }

      voltarParaAgenda();
    } finally {
      setSalvando(false);
    }
  }

  async function handleMarcarConcluido(formaPagamento: string) {
    if (!agendamentoAtual || !agendamentoId || !perfil) return;
    await concluirVendaProdutos(agendamentoId, formaPagamento);

    const itens = await listarItensPorAgendamento(agendamentoId);
    for (const item of itens) {
      if (item.cliente_pacote_id && !item.pacote_descontado) {
        const pacote = await buscarClientePacote(item.cliente_pacote_id);
        if (pacote && pacote.quantidade_restante > 0) {
          await atualizarQuantidadeClientePacote(item.cliente_pacote_id, pacote.quantidade_restante - 1);
          await marcarComoDescontado(item.id);
        }
      }
    }

    const dias = parseInt(diasParaRetorno, 10);
    if (!isNaN(dias) && dias > 0) {
      try {
        const dataRetornoMillis = converterIsoParaMillis(agendamentoAtual.data_hora) + dias * 24 * 60 * 60 * 1000;
        await criarRetornoCliente({
          salao_id: perfil.salao_id,
          cliente_id: agendamentoAtual.cliente_id,
          profissional_id: agendamentoAtual.profissional_id,
          agendamento_id: agendamentoId,
          nome_servico: itens.map((i) => i.nome_servico).join(", ") || "Atendimento",
          data_retorno: converterMillisParaIso(dataRetornoMillis),
          status: "PENDENTE",
        });
      } catch {
        // se o retorno não conseguir ser salvo, não trava a conclusão do agendamento
      }
    }
    setDiasParaRetorno("");
    setMostrarPagamento(false);
    voltarParaAgenda();
  }

  async function handleConfirmarSinal() {
    if (!agendamentoAtual) return;
    setConfirmandoSinal(true);
    try {
      await confirmarSinal(agendamentoAtual.id);
      await carregarAgendamento(agendamentoAtual.id);
    } finally {
      setConfirmandoSinal(false);
    }
  }

  async function handleMarcarFalta() {
    if (!agendamentoAtual || !agendamentoId) return;
    await atualizarAgendamento(agendamentoId, { ...agendamentoAtual, status: "FALTOU" });
    voltarParaAgenda();
  }

  async function handleMarcarConfirmado() {
    if (!agendamentoAtual || !agendamentoId) return;
    await atualizarAgendamento(agendamentoId, { ...agendamentoAtual, status: "CONFIRMADO" });
    setAgendamentoAtual({ ...agendamentoAtual, status: "CONFIRMADO" });
  }

  async function handleMarcarCancelado() {
    if (!agendamentoAtual || !agendamentoId) return;
    await atualizarAgendamento(agendamentoId, { ...agendamentoAtual, status: "CANCELADO" });
    voltarParaAgenda();
  }

  async function handleReabrir() {
    if (!agendamentoAtual || !agendamentoId) return;
    await atualizarAgendamento(agendamentoId, { ...agendamentoAtual, status: "AGENDADO" });
    setAgendamentoAtual({ ...agendamentoAtual, status: "AGENDADO" });
  }

  async function handleExcluir() {
    if (!agendamentoId) return;
    await deletarAgendamentoRepo(agendamentoId);
    if (perfil && agendamentoAtual) {
      registrarAuditoria(perfil.salao_id, perfil.id, "cancelar_agendamento", "agendamento", agendamentoId, {
        cliente_id: agendamentoAtual.cliente_id,
        profissional_id: agendamentoAtual.profissional_id,
        data_hora: agendamentoAtual.data_hora,
        status: agendamentoAtual.status,
      });
    }
    voltarParaAgenda();
  }


  const podeSalvar = clienteSelecionado !== null && itensComanda.length > 0;
  const profissionalSelecionado = equipe.find((profissional) => profissional.id === profissionalSelecionadoId) ?? null;

  return (
    <div className="mx-auto max-w-4xl p-4 pb-28 sm:p-6 md:p-8 lg:pb-10">
      <div className="mb-7">
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-accent">Atendimento</p>
        <h1 className="mt-1 text-2xl font-bold tracking-tight sm:text-3xl">{editando ? "Editar Comanda" : "Nova Comanda"}</h1>
        <p className="mt-1 text-sm text-muted">{editando ? "Atualize os dados do atendimento" : "Agende um atendimento para sua cliente"}</p>
      </div>

      <div className="flex flex-col gap-5">
        <button
          onClick={() => setMostrarSeletorCliente(true)}
          className={`card-elevated flex items-center gap-4 rounded-2xl border border-border-subtle bg-surface p-5 text-left transition-colors hover:border-accent/50 ${clienteSelecionado ? "" : "text-muted"}`}
        >
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-accent/10 text-accent"><User size={22} /></div>
          <div className="min-w-0 flex-1"><p className="mb-1 text-xs font-bold uppercase tracking-wide text-accent">Cliente</p><p className="truncate font-semibold">{clienteSelecionado?.nome ?? "Escolher cliente"}</p>{clienteSelecionado && <p className="text-sm text-muted">{clienteSelecionado.telefone}</p>}</div>
          <ChevronRight size={20} className="text-accent" />
        </button>

        {!usuarioEProfissional && (
          <div className="card-elevated flex items-center gap-4 rounded-2xl border border-border-subtle bg-surface p-5">
            {profissionalSelecionado ? <Avatar nome={profissionalSelecionado.nome} fotoUrl={profissionalSelecionado.foto_url} shape="square" className="h-12 w-12 rounded-2xl" /> : <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-accent/10 text-accent"><Users size={22} /></div>}
            <div className="min-w-0 flex-1">
              <label className="mb-1 block text-xs font-bold uppercase tracking-wide text-accent">Profissional</label>
              <select
                value={profissionalSelecionadoId ?? ""}
                onChange={(e) => setProfissionalSelecionadoId(e.target.value || null)}
                className="w-full bg-transparent font-semibold outline-none"
              >
                <option value="" className="bg-surface">
                  Não atribuído
                </option>
                {equipe.map((p) => (
                  <option key={p.id} value={p.id} className="bg-surface">
                    {p.nome}
                  </option>
                ))}
              </select>
            </div>
          </div>
        )}

        <div className="card-elevated grid gap-3 rounded-2xl border border-accent/30 bg-surface p-4 sm:grid-cols-3">
          <div className={`flex-1 ${inputClass}`}>
            <Calendar size={16} className="text-muted" />
            <div className="min-w-0 flex-1"><span className="block text-[10px] font-bold uppercase tracking-wide text-muted">Data</span><input
              type="date"
              value={dataSelecionada}
              onChange={(e) => setDataSelecionada(e.target.value)}
              className="w-full bg-transparent text-sm font-semibold outline-none"
            /></div>
          </div>
          <div className={`flex-1 ${inputClass}`}>
            <Clock size={16} className="text-muted" />
            <div className="min-w-0 flex-1"><span className="block text-[10px] font-bold uppercase tracking-wide text-muted">Início</span><input
              type="time"
              value={horaSelecionada}
              onChange={(e) => setHoraSelecionada(e.target.value)}
              className="w-full bg-transparent text-sm font-semibold outline-none"
            /></div>
          </div>
          <div className={inputClass}>
            <Clock size={16} className="text-warning" />
            <div className="min-w-0 flex-1"><span className="block text-[10px] font-bold uppercase tracking-wide text-warning">Término</span><input
              type="time"
              value={formatarHoraFinal(duracaoEfetiva)}
              onChange={(e) => handleMudarHoraFinal(e.target.value)}
              className="w-full bg-transparent text-sm font-semibold text-warning outline-none"
            /></div>
          </div>
        </div>
        <div className="flex justify-end">
          {duracaoManual !== null && (
            <button
              onClick={() => setDuracaoManual(null)}
              className="flex items-center gap-1 whitespace-nowrap text-xs text-muted transition-colors hover:text-accent"
            >
              <RotateCcw size={12} /> Automático
            </button>
          )}
        </div>

        <div className="mt-2 flex items-center gap-2">
          <Scissors size={16} className="text-accent" />
          <p className="font-medium">Serviços da comanda</p>
        </div>

        {itensComanda.length === 0 ? (
          <p className="text-sm text-muted">Nenhum serviço adicionado ainda.</p>
        ) : (
          <div className="flex flex-col gap-2">
            {itensComanda.map((item, index) => (
              <div key={index} className="card-elevated flex items-center justify-between rounded-xl bg-surface p-3.5">
                <div>
                  <p className="text-sm font-medium">{item.servico.nome}</p>
                  {item.usaPacote ? (
                    <p className="text-xs text-accent">Incluso no pacote</p>
                  ) : indiceEditandoPreco === index ? (
                    <div className="mt-1 flex items-center gap-1.5">
                      <input
                        autoFocus
                        value={precoEditado}
                        onChange={(e) => setPrecoEditado(e.target.value.replace(/[^0-9.]/g, ""))}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") confirmarEdicaoPreco();
                        }}
                        className="w-20 rounded-lg border border-accent bg-background px-2 py-1 text-xs outline-none"
                      />
                      <button
                        onClick={confirmarEdicaoPreco}
                        className="rounded-full bg-accent/15 p-1 text-accent hover:bg-accent/25"
                      >
                        <Check size={13} />
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => {
                        setIndiceEditandoPreco(index);
                        setPrecoEditado(String(item.precoCobrado));
                      }}
                      className="mt-0.5 flex items-center gap-1.5 text-xs text-muted transition-colors hover:text-accent"
                    >
                      {formatarMoeda(item.precoCobrado)}
                      <Pencil size={11} />
                    </button>
                  )}
                </div>
                <button
                  onClick={() => removerServico(index)}
                  className="rounded-lg p-1.5 text-muted transition-colors hover:bg-danger/10 hover:text-danger"
                >
                  <X size={16} />
                </button>
              </div>
            ))}
          </div>
        )}

        <button
          onClick={() => setMostrarSeletorServico(true)}
          className="flex items-center justify-center gap-1.5 rounded-xl border border-border-subtle px-4 py-2.5 text-sm transition-colors hover:bg-surface"
        >
          <Plus size={15} /> Adicionar Serviço
        </button>

        <div className="mt-2 flex items-center gap-2">
          <Package size={17} className="text-accent" />
          <p className="font-medium">Produtos da comanda</p>
        </div>

        {produtosComanda.length === 0 ? (
          <p className="text-sm text-muted">Nenhum produto adicionado.</p>
        ) : (
          <div className="flex flex-col gap-2">
            {produtosComanda.map((item) => (
              <div key={item.id} className="card-elevated flex items-center gap-3 rounded-xl bg-surface p-3.5">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-accent/10 text-accent">
                  <Package size={19} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <p className="truncate text-sm font-medium">{item.nome_produto}</p>
                    <p className="shrink-0 text-sm font-semibold tabular-nums">
                      {formatarMoeda(item.preco_unitario * item.quantidade)}
                    </p>
                  </div>
                  <p className="text-xs text-muted">{formatarMoeda(item.preco_unitario)} por unidade</p>
                </div>
                {item.estoque_baixado ? (
                  <span className="rounded-full bg-success/10 px-2 py-1 text-[11px] font-medium text-success">Vendido</span>
                ) : (
                  <div className="flex items-center rounded-xl border border-border-subtle bg-background">
                    <button onClick={() => alterarQuantidadeProduto(item.produto_id, -1)} className="p-2 text-muted hover:text-foreground" aria-label={`Diminuir ${item.nome_produto}`}><Minus size={14} /></button>
                    <span className="min-w-7 text-center text-sm font-semibold tabular-nums">{item.quantidade}</span>
                    <button onClick={() => alterarQuantidadeProduto(item.produto_id, 1)} className="p-2 text-muted hover:text-foreground" aria-label={`Aumentar ${item.nome_produto}`}><Plus size={14} /></button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        <button
          onClick={() => setMostrarSeletorProduto(true)}
          disabled={agendamentoAtual?.status === "CONCLUIDO"}
          className="flex items-center justify-center gap-1.5 rounded-xl border border-dashed border-accent/45 px-4 py-2.5 text-sm text-accent transition-colors hover:bg-accent/5 disabled:hidden"
        >
          <Plus size={15} /> Adicionar Produto
        </button>

        <div className="card-elevated rounded-2xl border border-accent/25 bg-surface p-4">
          <div className="flex items-center justify-between text-sm text-muted"><span>Serviços</span><span className="tabular-nums">{formatarMoeda(totalServicos)}</span></div>
          <div className="mt-1.5 flex items-center justify-between text-sm text-muted"><span>Produtos</span><span className="tabular-nums">{formatarMoeda(totalProdutos)}</span></div>
          <div className="mt-3 flex items-center justify-between border-t border-border-subtle pt-3">
            <span className="font-semibold">Total da comanda</span>
            <span className="text-2xl font-bold tabular-nums text-accent">{formatarMoeda(total)}</span>
          </div>
        </div>

        <textarea
          value={observacoes}
          onChange={(e) => setObservacoes(e.target.value)}
          placeholder="Observações"
          className="rounded-xl border border-border-subtle bg-surface px-4 py-3 outline-none transition-colors focus:border-accent placeholder:text-muted/60"
          rows={2}
        />

        <button
          onClick={() => handleSalvar(false)}
          disabled={!podeSalvar || salvando}
          className="rounded-xl bg-accent px-4 py-3.5 font-medium text-accent-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          {salvando ? "Salvando..." : editando ? "Salvar Alterações" : "Salvar Comanda"}
        </button>

        {editando && agendamentoAtual && (
          <>
            {agendamentoAtual.sinal_status === 'PENDENTE' && (
              <div className='card-elevated rounded-2xl border border-warning/35 bg-warning/10 p-4'>
                <div className='flex items-start gap-3'>
                  <Landmark size={20} className='mt-0.5 shrink-0 text-warning' />
                  <div className='flex-1'>
                    <p className='font-medium text-warning'>Sinal aguardando confirmação</p>
                    <p className='mt-1 text-sm'>Valor: {formatarMoeda(agendamentoAtual.sinal_valor ?? 0)}</p>
                    <p className='text-xs text-muted'>Recebedor: {agendamentoAtual.sinal_nome_beneficiario || (agendamentoAtual.sinal_destino === 'PROFISSIONAL' ? 'Profissional' : 'Salão')}</p>
                    <button onClick={handleConfirmarSinal} disabled={confirmandoSinal} className='mt-3 rounded-xl bg-warning px-4 py-2.5 text-sm font-medium text-warning-foreground disabled:opacity-60'>
                      {confirmandoSinal ? 'Confirmando...' : 'Confirmar sinal recebido'}
                    </button>
                  </div>
                </div>
              </div>
            )}
            {agendamentoAtual.sinal_status === 'CONFIRMADO' && (
              <div className='flex items-center gap-2 rounded-xl bg-success/10 px-4 py-3 text-sm text-success'>
                <Check size={17} /> Sinal de {formatarMoeda(agendamentoAtual.sinal_valor ?? 0)} confirmado
              </div>
            )}
            {(!agendamentoAtual.sinal_status || agendamentoAtual.sinal_status === 'NAO_APLICAVEL') &&
              salao?.sinal_ativo &&
              clienteSelecionado && (
                <div>
                  <button
                    onClick={handleGerarCobrancaPix}
                    disabled={gerandoSinal}
                    className='w-full rounded-xl border border-border-subtle px-4 py-3 text-sm font-medium transition-colors hover:bg-surface disabled:opacity-60'
                  >
                    {gerandoSinal ? 'Gerando...' : 'Gerar cobrança Pix e enviar no WhatsApp'}
                  </button>
                  {mensagemSinal && <p className='mt-2 text-xs text-danger'>{mensagemSinal}</p>}
                </div>
              )}
            <div className="mt-1 flex items-center gap-2 text-sm text-muted">
              Status:
              <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${STATUS_ESTILO[agendamentoAtual.status] ?? "bg-surface-alt"}`}>
                {formatarStatus(agendamentoAtual.status)}
              </span>
            </div>
            {(agendamentoAtual.status === "AGENDADO" || agendamentoAtual.status === "CONFIRMADO") && (
              <>
                {agendamentoAtual.status === "AGENDADO" && (
                  <button
                    onClick={handleMarcarConfirmado}
                    className="flex items-center justify-center gap-1.5 rounded-xl bg-info px-4 py-3 font-medium text-info-foreground transition-opacity hover:opacity-90"
                  >
                    <Check size={16} /> Confirmar Agendamento
                  </button>
                )}
                <button
                  onClick={() => setMostrarPagamento(true)}
                  className="flex items-center justify-center gap-1.5 rounded-xl bg-finalizado px-4 py-3 font-medium text-finalizado-foreground transition-opacity hover:opacity-90"
                >
                  <Check size={16} /> Marcar como Concluído
                </button>
                <button
                  onClick={handleMarcarFalta}
                  className="rounded-xl border border-border-subtle px-4 py-3 text-sm text-warning transition-colors hover:bg-surface"
                >
                  Marcar como Falta
                </button>
                <button
                  onClick={handleMarcarCancelado}
                  className="rounded-xl border border-border-subtle px-4 py-3 text-sm text-danger transition-colors hover:bg-surface"
                >
                  Cancelar Agendamento
                </button>
              </>
            )}
            {(agendamentoAtual.status === "CONCLUIDO" ||
              agendamentoAtual.status === "FALTOU" ||
              agendamentoAtual.status === "CANCELADO") && (
              <button
                onClick={handleReabrir}
                className="flex items-center justify-center gap-1.5 rounded-xl border border-border-subtle px-4 py-3 text-sm transition-colors hover:bg-surface"
              >
                <RotateCcw size={15} /> Reabrir Agendamento
              </button>
            )}
            {clienteSelecionado && (
              <button
                onClick={handleEnviarConfirmacao}
                className="flex items-center justify-center gap-1.5 rounded-xl border border-border-subtle px-4 py-3 text-sm transition-colors hover:bg-surface"
              >
                <MessageCircle size={15} /> Enviar confirmação no WhatsApp
              </button>
            )}
            <button
              onClick={() => setMostrarExclusao(true)}
              className="flex items-center justify-center gap-1.5 rounded-xl px-4 py-3 text-sm text-danger transition-colors hover:bg-danger/10"
            >
              <Trash2 size={15} /> Excluir agendamento
            </button>
          </>
        )}
      </div>

      {mostrarSeletorCliente && (
        <SeletorClienteModal
          clientes={clientes}
          onEscolher={(c) => {
            setClienteSelecionado(c);
            setMostrarSeletorCliente(false);
          }}
          onCriarNovo={async (nome, telefone) => {
            if (!perfil) return;
            const novo: Cliente = {
              id: crypto.randomUUID(),
              salao_id: perfil.salao_id,
              nome,
              telefone,
              observacoes: "",
              aniversario: null,
            };
            await salvarCliente(novo);
            setClientes((atual) => [...atual, novo]);
            setClienteSelecionado(novo);
            setMostrarSeletorCliente(false);
          }}
          onFechar={() => setMostrarSeletorCliente(false)}
        />
      )}

      {mostrarSeletorServico && (
        <div className="fixed inset-0 z-30 flex items-center justify-center bg-black/60 p-5 backdrop-blur-sm">
          <div className="card-elevated flex max-h-[80vh] w-full max-w-sm flex-col rounded-2xl bg-surface p-5">
            <div className="mb-3 flex items-center justify-between">
              <p className="font-medium">Escolher serviço</p>
              <button
                onClick={() => {
                  setMostrarSeletorServico(false);
                  setTermoBuscaServico("");
                }}
                className="text-muted hover:text-foreground"
              >
                <X size={18} />
              </button>
            </div>
            {servicos.length === 0 ? (
              <p className="text-sm text-muted">Nenhum serviço cadastrado ainda.</p>
            ) : (
              <>
                <input
                  type="text"
                  value={termoBuscaServico}
                  onChange={(e) => setTermoBuscaServico(e.target.value)}
                  placeholder="Buscar serviço"
                  className="mb-3 w-full rounded-lg border border-border-subtle bg-background px-3 py-2 text-sm outline-none focus:border-accent"
                />
                <div className="flex flex-col gap-1 overflow-y-auto">
                  {servicos
                    .filter((s) => termoBuscaServico.trim() === "" || s.nome.toLowerCase().includes(termoBuscaServico.trim().toLowerCase()))
                    .map((s) => {
                      const pacote = pacotesAtivos.get(s.id);
                      return (
                        <button
                          key={s.id}
                          onClick={() => adicionarServico(s)}
                          className="flex items-center justify-between rounded-lg px-3 py-2.5 text-left text-sm transition-colors hover:bg-surface-alt"
                        >
                          <span>{s.nome}</span>
                          <span className={pacote ? "text-accent" : s.variavel ? "text-accent" : "text-muted"}>
                            {pacote
                              ? `Pacote ativo (${pacote.quantidade_restante}x)`
                              : s.variavel
                              ? `A partir de ${formatarMoeda(s.preco)}`
                              : formatarMoeda(s.preco)}
                          </span>
                        </button>
                      );
                    })}
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {mostrarSeletorProduto && (
        <div className="fixed inset-0 z-30 flex items-center justify-center bg-black/60 p-5 backdrop-blur-sm">
          <div className="card-elevated flex max-h-[80vh] w-full max-w-md flex-col rounded-2xl bg-surface p-5">
            <div className="mb-3 flex items-center justify-between">
              <div><p className="font-medium">Adicionar produto</p><p className="text-xs text-muted">A baixa acontece somente ao concluir a comanda.</p></div>
              <button onClick={() => { setMostrarSeletorProduto(false); setTermoBuscaProduto(""); }} className="text-muted hover:text-foreground"><X size={18} /></button>
            </div>
            <input value={termoBuscaProduto} onChange={(e) => setTermoBuscaProduto(e.target.value)} placeholder="Buscar produto" className="mb-3 rounded-xl border border-border-subtle bg-background px-3.5 py-2.5 outline-none focus:border-accent" />
            <div className="flex flex-col gap-1 overflow-y-auto">
              {produtos
                .filter((produto) => !termoBuscaProduto.trim() || produto.nome.toLowerCase().includes(termoBuscaProduto.trim().toLowerCase()))
                .map((produto) => {
                  const quantidadeSelecionada = produtosComanda.find((item) => item.produto_id === produto.id && !item.estoque_baixado)?.quantidade ?? 0;
                  const disponivel = produto.saldo - quantidadeSelecionada;
                  return <button key={produto.id} onClick={() => adicionarProduto(produto)} disabled={disponivel <= 0} className="flex items-center gap-3 rounded-xl px-3 py-3 text-left transition-colors hover:bg-surface-alt disabled:opacity-45">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent/10 text-accent"><Package size={18} /></div>
                    <div className="min-w-0 flex-1"><p className="truncate text-sm font-medium">{produto.nome}</p><p className="text-xs text-muted">Estoque disponível: {Math.max(0, disponivel)} {produto.unidade}</p></div>
                    <span className="text-sm font-semibold text-accent">{formatarMoeda(produto.preco)}</span>
                  </button>;
                })}
            </div>
          </div>
        </div>
      )}

      {mostrarPagamento && (
        <div className="fixed inset-0 z-30 flex items-center justify-center bg-black/60 p-5 backdrop-blur-sm">
          <div className="card-elevated w-full max-w-sm rounded-2xl bg-surface p-5">
            <p className="mb-3 font-medium">Forma de pagamento</p>

            <input
              type="number"
              min={0}
              value={diasParaRetorno}
              onChange={(e) => setDiasParaRetorno(e.target.value.replace(/\D/g, ""))}
              placeholder="Retorno em quantos dias? (opcional)"
              className="mb-3 w-full rounded-lg border border-border-subtle bg-background px-3 py-2 text-sm outline-none focus:border-accent"
            />

            <div className="flex flex-col gap-1">
              {[
                { valor: "DINHEIRO", label: "Dinheiro" },
                { valor: "PIX", label: "Pix" },
                { valor: "CARTAO", label: "Cartão" },
              ].map((f) => (
                <button
                  key={f.valor}
                  onClick={() => handleMarcarConcluido(f.valor)}
                  className="rounded-lg px-3 py-2.5 text-left text-sm transition-colors hover:bg-surface-alt"
                >
                  {f.label}
                </button>
              ))}
            </div>
            <button
              onClick={() => {
                setMostrarPagamento(false);
                setDiasParaRetorno("");
              }}
              className="mt-3 w-full rounded-lg border border-border-subtle py-2 text-sm transition-colors hover:bg-surface-alt"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      {mensagemConflito && (
        <div className="fixed inset-0 z-30 flex items-center justify-center bg-black/60 p-5 backdrop-blur-sm">
          <div className="card-elevated w-full max-w-sm rounded-2xl bg-surface p-5">
            <div className="mb-2 flex items-center gap-2 text-amber-400">
              <AlertTriangle size={18} />
              <p className="font-medium text-foreground">Conflito de horário</p>
            </div>
            <p className="mb-4 text-sm text-muted">{mensagemConflito}</p>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setMensagemConflito(null)}
                className="rounded-lg px-4 py-2 text-sm text-muted transition-colors hover:bg-surface-alt"
              >
                Cancelar
              </button>
              <button
                onClick={() => {
                  setMensagemConflito(null);
                  handleSalvar(true);
                }}
                className="rounded-lg bg-danger px-4 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90"
              >
                Salvar mesmo assim
              </button>
            </div>
          </div>
        </div>
      )}

      {mostrarExclusao && (
        <div className="fixed inset-0 z-30 flex items-center justify-center bg-black/60 p-5 backdrop-blur-sm">
          <div className="card-elevated w-full max-w-sm rounded-2xl bg-surface p-5">
            <p className="mb-2 font-medium">Excluir agendamento?</p>
            <p className="mb-4 text-sm text-muted">Essa ação não pode ser desfeita.</p>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setMostrarExclusao(false)}
                className="rounded-lg px-4 py-2 text-sm text-muted transition-colors hover:bg-surface-alt"
              >
                Cancelar
              </button>
              <button
                onClick={handleExcluir}
                className="rounded-lg bg-danger px-4 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90"
              >
                Excluir
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function SeletorClienteModal({
  clientes,
  onEscolher,
  onCriarNovo,
  onFechar,
}: {
  clientes: Cliente[];
  onEscolher: (c: Cliente) => void;
  onCriarNovo: (nome: string, telefone: string) => void;
  onFechar: () => void;
}) {
  const [termo, setTermo] = useState("");
  const [mostrarNovo, setMostrarNovo] = useState(false);
  const [nome, setNome] = useState("");
  const [telefone, setTelefone] = useState("");

  const filtrados = clientes.filter((c) => {
    const t = termo.trim().toLowerCase();
    if (!t) return true;
    return c.nome.toLowerCase().includes(t) || c.telefone.includes(t);
  });

  if (mostrarNovo) {
    return (
      <div className="fixed inset-0 z-30 flex items-center justify-center bg-black/60 p-5 backdrop-blur-sm">
        <div className="card-elevated w-full max-w-sm rounded-2xl bg-surface p-5">
          <p className="mb-3 font-medium">Novo Cliente</p>
          <div className="flex flex-col gap-3">
            <input
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              placeholder="Nome"
              className="rounded-xl border border-border-subtle bg-background px-3.5 py-2.5 outline-none focus:border-accent"
            />
            <input
              value={telefone}
              onChange={(e) => setTelefone(e.target.value.replace(/\D/g, ""))}
              placeholder="Telefone (WhatsApp)"
              className="rounded-xl border border-border-subtle bg-background px-3.5 py-2.5 outline-none focus:border-accent"
            />
          </div>
          <div className="mt-4 flex justify-end gap-2">
            <button
              onClick={() => setMostrarNovo(false)}
              className="rounded-lg px-4 py-2 text-sm text-muted transition-colors hover:bg-surface-alt"
            >
              Cancelar
            </button>
            <button
              onClick={() => nome && telefone && onCriarNovo(nome, telefone)}
              className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-accent-foreground transition-opacity hover:opacity-90"
            >
              Criar e Selecionar
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-30 flex items-center justify-center bg-black/60 p-5 backdrop-blur-sm">
      <div className="card-elevated flex max-h-[80vh] w-full max-w-sm flex-col overflow-hidden rounded-2xl bg-surface p-5">
        <div className="mb-3 flex items-center justify-between">
          <p className="font-medium">Escolher Cliente</p>
          <button onClick={onFechar} className="text-muted hover:text-foreground">
            <X size={18} />
          </button>
        </div>
        <input
          value={termo}
          onChange={(e) => setTermo(e.target.value)}
          placeholder="Buscar por nome ou telefone"
          className="mb-3 rounded-xl border border-border-subtle bg-background px-3.5 py-2.5 outline-none focus:border-accent"
        />
        <button
          onClick={() => setMostrarNovo(true)}
          className="mb-3 flex items-center justify-center gap-1.5 rounded-xl border border-border-subtle px-3 py-2.5 text-sm transition-colors hover:bg-surface-alt"
        >
          <Plus size={14} /> Cadastrar novo cliente
        </button>
        <div className="flex-1 overflow-y-auto">
          {filtrados.map((c) => (
            <button
              key={c.id}
              onClick={() => onEscolher(c)}
              className="w-full rounded-lg px-3 py-2.5 text-left text-sm transition-colors hover:bg-surface-alt"
            >
              {c.nome} <span className="text-muted">— {c.telefone}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
