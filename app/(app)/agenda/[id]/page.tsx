"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import {
  AlertTriangle,
  Calendar,
  Check,
  Clock,
  MessageCircle,
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
} from "@/lib/repositories";
import { criarRetornoCliente } from "@/lib/repositories";
import { Agendamento, AgendamentoServico, Cliente, ClientePacote, ItemComanda, Perfil, Servico } from "@/lib/types";
import { converterIsoParaMillis, converterMillisParaIso, formatarMoeda, formatarStatus } from "@/lib/datetime";
import { abrirWhatsApp } from "@/lib/whatsapp";

const inputClass =
  "flex items-center gap-2.5 rounded-xl border border-border-subtle bg-surface px-4 py-3 transition-colors focus-within:border-accent";

const STATUS_ESTILO: Record<string, string> = {
  AGENDADO: "bg-accent/12 text-accent",
  CONCLUIDO: "bg-accent-light/15 text-accent-light",
  FALTOU: "bg-danger/12 text-danger",
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
  const [pacotesAtivos, setPacotesAtivos] = useState<Map<string, ClientePacote>>(new Map());

  const [mostrarSeletorCliente, setMostrarSeletorCliente] = useState(false);
  const [mostrarSeletorServico, setMostrarSeletorServico] = useState(false);
  const [mostrarPagamento, setMostrarPagamento] = useState(false);
  const [diasParaRetorno, setDiasParaRetorno] = useState("");
  const [mostrarExclusao, setMostrarExclusao] = useState(false);
  const [mensagemConflito, setMensagemConflito] = useState<string | null>(null);
  const [indiceEditandoPreco, setIndiceEditandoPreco] = useState<number | null>(null);
  const [precoEditado, setPrecoEditado] = useState("");
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    if (!perfil) return;
    listarClientes(perfil.salao_id).then(setClientes);
    listarServicos(perfil.salao_id).then(setServicos);
    listarEquipe(perfil.salao_id).then((lista) => setEquipe(lista.filter((p) => p.atende_clientes)));
    if (editando && agendamentoId) {
      carregarAgendamento(agendamentoId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [perfil?.id]);

  async function carregarAgendamento(id: string) {
    const ag = await buscarAgendamento(id);
    setAgendamentoAtual(ag);
    if (ag) {
      setProfissionalSelecionadoId(ag.profissional_id);
      const d = new Date(converterIsoParaMillis(ag.data_hora));
      setDataSelecionada(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`);
      setHoraSelecionada(`${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`);
      setObservacoes(ag.observacoes);
      if (ag.cliente_id) {
        await carregarPacotesDoCliente(ag.cliente_id);
      }
      const itens = await listarItensPorAgendamento(id);
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
    if (clienteSelecionado) carregarPacotesDoCliente(clienteSelecionado.id);
  }, [clienteSelecionado?.id]);

  // Preenche clienteSelecionado ao editar, assim que a lista de clientes carrega
  useEffect(() => {
    if (agendamentoAtual && clientes.length) {
      const c = clientes.find((c) => c.id === agendamentoAtual.cliente_id);
      if (c) setClienteSelecionado(c);
    }
  }, [agendamentoAtual, clientes]);

  async function carregarPacotesDoCliente(clienteId: string) {
    const todos = await listarClientePacotesPorCliente(clienteId);
    const ativos = new Map<string, ClientePacote>();
    todos.filter((p) => p.quantidade_restante > 0).forEach((p) => ativos.set(p.servico_id, p));
    setPacotesAtivos(ativos);
  }

  function adicionarServico(servico: Servico) {
    const pacote = pacotesAtivos.get(servico.id);
    setItensComanda((atual) => [
      ...atual,
      pacote
        ? { servico, usaPacote: true, clientePacoteId: pacote.id, precoCobrado: servico.preco }
        : { servico, usaPacote: false, clientePacoteId: null, precoCobrado: servico.preco },
    ]);
    setMostrarSeletorServico(false);
  }

  function removerServico(index: number) {
    setItensComanda((atual) => atual.filter((_, i) => i !== index));
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

  const total = useMemo(
    () => itensComanda.filter((i) => !i.usaPacote).reduce((soma, i) => soma + i.precoCobrado, 0),
    [itensComanda]
  );

  function calcularDataHoraMillis(): number {
    const [ano, mes, dia] = dataSelecionada.split("-").map(Number);
    const [hora, minuto] = horaSelecionada.split(":").map(Number);
    return new Date(ano, mes - 1, dia, hora, minuto, 0, 0).getTime();
  }

  async function verificarConflito(): Promise<string | null> {
    if (!profissionalSelecionadoId) return null;
    if (!perfil) return null;

    const duracaoTotal = itensComanda.reduce((soma, i) => soma + i.servico.duracao_minutos, 0) || 30;
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
      if (outro.status === "FALTOU") continue;
      const outroInicio = converterIsoParaMillis(outro.data_hora);
      const itensOutro = itensPorAgendamento.get(outro.id) ?? [];
      const duracaoOutro =
        itensOutro.reduce((soma, i) => {
          const s = servicos.find((s) => s.id === i.servico_id);
          return soma + (s?.duracao_minutos ?? 30);
        }, 0) || 30;
      const outroFim = outroInicio + duracaoOutro * 60_000;

      if (dataHoraMillis < outroFim && fimNovo > outroInicio) {
        const nomeCliente = clientesMap.get(outro.cliente_id) ?? "outro cliente";
        const d = new Date(outroInicio);
        const hora = `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
        return `Já existe um agendamento às ${hora} com ${nomeCliente} para esse profissional.`;
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
        });
      } else {
        await salvarAgendamentoRepo({
          id,
          salao_id: perfil.salao_id,
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

      router.push("/agenda");
    } finally {
      setSalvando(false);
    }
  }

  async function handleMarcarConcluido(formaPagamento: string) {
    if (!agendamentoAtual || !agendamentoId || !perfil) return;
    await atualizarAgendamento(agendamentoId, {
      ...agendamentoAtual,
      status: "CONCLUIDO",
      forma_pagamento: formaPagamento,
    });

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
    router.push("/agenda");
  }

  async function handleMarcarFalta() {
    if (!agendamentoAtual || !agendamentoId) return;
    await atualizarAgendamento(agendamentoId, { ...agendamentoAtual, status: "FALTOU" });
    router.push("/agenda");
  }

  async function handleReabrir() {
    if (!agendamentoAtual || !agendamentoId) return;
    await atualizarAgendamento(agendamentoId, { ...agendamentoAtual, status: "AGENDADO" });
    setAgendamentoAtual({ ...agendamentoAtual, status: "AGENDADO" });
  }

  async function handleExcluir() {
    if (!agendamentoId) return;
    await deletarAgendamentoRepo(agendamentoId);
    router.push("/agenda");
  }


  const podeSalvar = clienteSelecionado !== null && itensComanda.length > 0;

  return (
    <div className="mx-auto max-w-xl p-5 pb-16 md:p-8">
      <h1 className="mb-6 text-2xl font-semibold tracking-tight">{editando ? "Editar Comanda" : "Nova Comanda"}</h1>

      <div className="flex flex-col gap-4">
        <button
          onClick={() => setMostrarSeletorCliente(true)}
          className={`${inputClass} text-left ${clienteSelecionado ? "" : "text-muted"}`}
        >
          <User size={16} className="text-muted" />
          {clienteSelecionado?.nome ?? "Escolher Cliente"}
        </button>

        {!usuarioEProfissional && (
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium uppercase tracking-wide text-muted">Profissional</label>
            <div className={inputClass}>
              <Users size={16} className="text-muted" />
              <select
                value={profissionalSelecionadoId ?? ""}
                onChange={(e) => setProfissionalSelecionadoId(e.target.value || null)}
                className="w-full bg-transparent outline-none"
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

        <div className="flex gap-3">
          <div className={`flex-1 ${inputClass}`}>
            <Calendar size={16} className="text-muted" />
            <input
              type="date"
              value={dataSelecionada}
              onChange={(e) => setDataSelecionada(e.target.value)}
              className="w-full bg-transparent outline-none [color-scheme:dark]"
            />
          </div>
          <div className={`flex-1 ${inputClass}`}>
            <Clock size={16} className="text-muted" />
            <input
              type="time"
              value={horaSelecionada}
              onChange={(e) => setHoraSelecionada(e.target.value)}
              className="w-full bg-transparent outline-none [color-scheme:dark]"
            />
          </div>
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

        <div className="card-elevated flex items-center justify-between rounded-xl bg-surface p-4">
          <span className="text-sm text-muted">Total</span>
          <span className="text-xl font-semibold tabular-nums text-accent">{formatarMoeda(total)}</span>
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
            <div className="mt-1 flex items-center gap-2 text-sm text-muted">
              Status:
              <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${STATUS_ESTILO[agendamentoAtual.status] ?? "bg-surface-alt"}`}>
                {formatarStatus(agendamentoAtual.status)}
              </span>
            </div>
            {agendamentoAtual.status === "AGENDADO" && (
              <>
                <button
                  onClick={() => setMostrarPagamento(true)}
                  className="flex items-center justify-center gap-1.5 rounded-xl bg-accent px-4 py-3 font-medium text-accent-foreground transition-opacity hover:opacity-90"
                >
                  <Check size={16} /> Marcar como Concluído
                </button>
                <button
                  onClick={handleMarcarFalta}
                  className="rounded-xl border border-border-subtle px-4 py-3 text-sm transition-colors hover:bg-surface"
                >
                  Marcar como Falta
                </button>
              </>
            )}
            {agendamentoAtual.status !== "AGENDADO" && (
              <button
                onClick={handleReabrir}
                className="flex items-center justify-center gap-1.5 rounded-xl border border-border-subtle px-4 py-3 text-sm transition-colors hover:bg-surface"
              >
                <RotateCcw size={15} /> Reabrir Agendamento
              </button>
            )}
            {clienteSelecionado && (
              <button
                onClick={() =>
                  abrirWhatsApp(
                    clienteSelecionado.telefone,
                    `Olá, ${clienteSelecionado.nome.split(" ")[0]}! Confirmando seu horário.`
                  )
                }
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
          <div className="card-elevated max-h-[80vh] w-full max-w-sm overflow-y-auto rounded-2xl bg-surface p-5">
            <div className="mb-3 flex items-center justify-between">
              <p className="font-medium">Escolher serviço</p>
              <button onClick={() => setMostrarSeletorServico(false)} className="text-muted hover:text-foreground">
                <X size={18} />
              </button>
            </div>
            {servicos.length === 0 ? (
              <p className="text-sm text-muted">Nenhum serviço cadastrado ainda.</p>
            ) : (
              <div className="flex flex-col gap-1">
                {servicos.map((s) => {
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
            )}
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
