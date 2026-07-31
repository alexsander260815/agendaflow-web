"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Ban, CalendarDays, ChevronLeft, ChevronRight, Plus, X } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import {
  criarBloqueioAgenda,
  listarAgendamentoServicos,
  listarAgendamentos,
  listarBloqueiosAgenda,
  listarClientes,
  listarEquipe,
  listarServicos,
} from "@/lib/repositories";
import { profissionaisVisiveisAgenda } from "@/lib/permissoes";
import Avatar from "@/components/Avatar";
import { Agendamento, AgendamentoServico, BloqueioAgenda, Perfil } from "@/lib/types";
import { converterIsoParaMillis, inicioDoDia } from "@/lib/datetime";

const HORA_INICIO = 7;
const HORA_FIM = 21;
const PX_POR_HORA = 68;

interface BlocoAgenda {
  id: string;
  nomeCliente: string;
  nomesServicos: string;
  inicioMinutosDoDia: number;
  duracaoMinutos: number;
  status: string;
}

interface BlocoBloqueio {
  id: string;
  motivo: string;
  inicioMinutosDoDia: number;
  duracaoMinutos: number;
}

export default function AgendaPage() {
  const { perfil } = useAuth();
  const router = useRouter();

  const [equipe, setEquipe] = useState<Perfil[]>([]);
  const [profissionalSelecionadoId, setProfissionalSelecionadoId] = useState<string | null>(null);
  const [dataSelecionada, setDataSelecionada] = useState(inicioDoDia());
  const [carregando, setCarregando] = useState(true);

  const [cacheAgendamentos, setCacheAgendamentos] = useState<Agendamento[]>([]);
  const [cacheItens, setCacheItens] = useState<Map<string, AgendamentoServico[]>>(new Map());
  const [cacheClientes, setCacheClientes] = useState<Map<string, string>>(new Map());
  const [cacheDuracoes, setCacheDuracoes] = useState<Map<string, number>>(new Map());
  const [cacheBloqueios, setCacheBloqueios] = useState<BloqueioAgenda[]>([]);
  const [mostrarNovoBloqueio, setMostrarNovoBloqueio] = useState(false);
  const [horaInicioBloqueio, setHoraInicioBloqueio] = useState("00:00");
  const [horaFimBloqueio, setHoraFimBloqueio] = useState("23:59");
  const [motivoBloqueio, setMotivoBloqueio] = useState("");
  const [salvandoBloqueio, setSalvandoBloqueio] = useState(false);

  useEffect(() => {
    if (!perfil) return;
    carregarInicial();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [perfil?.id]);

  async function carregarInicial() {
    if (!perfil) return;
    setCarregando(true);
    try {
      const [equipeQueAtende, idsPermitidos, servicos, clientes, agendamentos, itens, bloqueios] = await Promise.all([
        listarEquipe(perfil.salao_id).then((lista) => lista.filter((p) => p.atende_clientes)),
        profissionaisVisiveisAgenda(perfil),
        listarServicos(perfil.salao_id),
        listarClientes(perfil.salao_id),
        listarAgendamentos(perfil.salao_id),
        listarAgendamentoServicos(perfil.salao_id),
        listarBloqueiosAgenda(perfil.salao_id),
      ]);

      const equipeFiltradaBase = idsPermitidos === null ? equipeQueAtende : equipeQueAtende.filter((p) => idsPermitidos.includes(p.id));
      const equipeFiltrada = [...equipeFiltradaBase].sort((a, b) => {
        if (a.id === perfil.id) return -1;
        if (b.id === perfil.id) return 1;
        return 0;
      });
      setEquipe(equipeFiltrada);
      setProfissionalSelecionadoId((atual) => {
        if (atual && equipeFiltrada.some((p) => p.id === atual)) return atual;
        return equipeFiltrada.find((p) => p.id === perfil.id)?.id ?? equipeFiltrada[0]?.id ?? null;
      });

      setCacheDuracoes(new Map(servicos.map((s) => [s.id, s.duracao_minutos])));
      setCacheClientes(new Map(clientes.map((c) => [c.id, c.nome])));
      setCacheAgendamentos(agendamentos);

      const porAgendamento = new Map<string, AgendamentoServico[]>();
      itens.forEach((i) => {
        const lista = porAgendamento.get(i.agendamento_id) ?? [];
        lista.push(i);
        porAgendamento.set(i.agendamento_id, lista);
      });
      setCacheItens(porAgendamento);
      setCacheBloqueios(bloqueios);
    } finally {
      setCarregando(false);
    }
  }

  const blocosDoDia: BlocoAgenda[] = useMemo(() => {
    if (!profissionalSelecionadoId) return [];
    const inicioDia = dataSelecionada;
    const fimDia = inicioDia + 24 * 60 * 60 * 1000;

    return cacheAgendamentos
      .filter((a) => {
        const millis = converterIsoParaMillis(a.data_hora);
        return a.profissional_id === profissionalSelecionadoId && millis >= inicioDia && millis < fimDia;
      })
      .map((a) => {
        const itens = cacheItens.get(a.id) ?? [];
        const duracaoTotal =
          a.duracao_minutos ?? (itens.reduce((soma, i) => soma + (cacheDuracoes.get(i.servico_id) ?? 30), 0) || 30);
        const millis = converterIsoParaMillis(a.data_hora);
        const d = new Date(millis);
        return {
          id: a.id,
          nomeCliente: cacheClientes.get(a.cliente_id) ?? "Cliente desconhecido",
          nomesServicos: itens.length ? itens.map((i) => i.nome_servico).join(", ") : "Sem serviços",
          inicioMinutosDoDia: d.getHours() * 60 + d.getMinutes(),
          duracaoMinutos: duracaoTotal,
          status: a.status,
        };
      });
  }, [cacheAgendamentos, cacheItens, cacheDuracoes, cacheClientes, profissionalSelecionadoId, dataSelecionada]);

  const bloqueiosDoDia: BlocoBloqueio[] = useMemo(() => {
    if (!profissionalSelecionadoId) return [];
    const inicioDia = dataSelecionada;
    const fimDia = inicioDia + 24 * 60 * 60 * 1000;

    return cacheBloqueios
      .filter((b) => b.profissional_id === profissionalSelecionadoId)
      .map((b) => {
        const inicioMillis = converterIsoParaMillis(b.data_inicio);
        const fimMillis = converterIsoParaMillis(b.data_fim);
        if (fimMillis <= inicioDia || inicioMillis >= fimDia) return null;

        const inicioRecortado = Math.max(inicioMillis, inicioDia);
        const fimRecortado = Math.min(fimMillis, fimDia);
        return {
          id: b.id,
          motivo: b.motivo,
          inicioMinutosDoDia: Math.round((inicioRecortado - inicioDia) / 60000),
          duracaoMinutos: Math.max(1, Math.round((fimRecortado - inicioRecortado) / 60000)),
        };
      })
      .filter((b): b is BlocoBloqueio => b !== null);
  }, [cacheBloqueios, profissionalSelecionadoId, dataSelecionada]);

  function irParaDiaAnterior() {
    setDataSelecionada((d) => d - 24 * 60 * 60 * 1000);
  }

  function irParaProximoDia() {
    setDataSelecionada((d) => d + 24 * 60 * 60 * 1000);
  }

function handleEscolherData(valor: string) {
    if (!valor) return;
    const [ano, mes, dia] = valor.split("-").map(Number);
    setDataSelecionada(new Date(ano, mes - 1, dia, 0, 0, 0, 0).getTime());
  }

  function dataParaInput(millis: number): string {
    const d = new Date(millis);
    const ano = d.getFullYear();
    const mes = String(d.getMonth() + 1).padStart(2, "0");
    const dia = String(d.getDate()).padStart(2, "0");
    return `${ano}-${mes}-${dia}`;
  }

  async function handleCriarBloqueio() {
    if (!perfil || !profissionalSelecionadoId || !motivoBloqueio.trim()) return;
    setSalvandoBloqueio(true);
    try {
      const [hInicio, mInicio] = horaInicioBloqueio.split(":").map(Number);
      const [hFim, mFim] = horaFimBloqueio.split(":").map(Number);
      const d = new Date(dataSelecionada);
      const inicio = new Date(d.getFullYear(), d.getMonth(), d.getDate(), hInicio, mInicio, 0, 0);
      const fim = new Date(d.getFullYear(), d.getMonth(), d.getDate(), hFim, mFim, 59, 0);

      await criarBloqueioAgenda({
        salao_id: perfil.salao_id,
        profissional_id: profissionalSelecionadoId,
        data_inicio: inicio.toISOString(),
        data_fim: fim.toISOString(),
        motivo: motivoBloqueio.trim(),
        criado_por: perfil.id,
      });

      setCacheBloqueios(await listarBloqueiosAgenda(perfil.salao_id));
      setMostrarNovoBloqueio(false);
      setMotivoBloqueio("");
      setHoraInicioBloqueio("00:00");
      setHoraFimBloqueio("23:59");
    } finally {
      setSalvandoBloqueio(false);
    }
  }

  function abrirNovoAgendamento(horaAproximada?: number) {
    const params = new URLSearchParams();
    params.set("data", String(dataSelecionada));
    if (profissionalSelecionadoId) params.set("profissionalId", profissionalSelecionadoId);
    if (horaAproximada !== undefined) params.set("hora", String(horaAproximada));
    router.push(`/agenda/novo?${params.toString()}`);
  }

  const hoje = inicioDoDia() === dataSelecionada;
  const dataLabel = new Date(dataSelecionada).toLocaleDateString("pt-BR", {
    weekday: "short",
    day: "2-digit",
    month: "short",
  });

  const horas = Array.from({ length: HORA_FIM - HORA_INICIO }, (_, i) => HORA_INICIO + i);

  return (
    <div className="mx-auto max-w-3xl p-5 pb-28 md:p-8">
      <div className="mb-5 flex items-center justify-center gap-1">
        <button
          onClick={irParaDiaAnterior}
          className="rounded-lg p-2 text-muted transition-colors hover:bg-surface hover:text-foreground"
        >
          <ChevronLeft size={18} />
        </button>
        <div className="relative w-40 rounded-lg py-1 text-center font-medium capitalize transition-colors hover:bg-surface">
          {hoje && <span className="mr-1.5 rounded-full bg-accent/15 px-2 py-0.5 text-xs text-accent">Hoje</span>}
          {dataLabel}
          <input
            type="date"
            value={dataParaInput(dataSelecionada)}
            onChange={(e) => handleEscolherData(e.target.value)}
            className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
            aria-label="Escolher data"
          />
        </div>
        <button
          onClick={irParaProximoDia}
          className="rounded-lg p-2 text-muted transition-colors hover:bg-surface hover:text-foreground"
        >
          <ChevronRight size={18} />
        </button>
      </div>

      <div className="mb-5 flex gap-3 overflow-x-auto pb-1">
        {equipe.map((p) => {
          const ativo = profissionalSelecionadoId === p.id;
          return (
            <button
              key={p.id}
              onClick={() => setProfissionalSelecionadoId(p.id)}
              className="flex shrink-0 flex-col items-center gap-1.5"
            >
              <Avatar
                nome={p.nome}
                fotoUrl={p.foto_url}
                shape="square"
                className={`h-[72px] w-[72px] text-base transition-all ${
                  ativo ? "ring-2 ring-accent ring-offset-2 ring-offset-background" : "opacity-70"
                }`}
              />
              <span className={`text-xs ${ativo ? "font-medium text-accent" : "text-muted"}`}>
                {p.nome.split(" ")[0]}
              </span>
            </button>
          );
        })}
      </div>

      {carregando ? (
        <div className="animate-pulse rounded-2xl bg-surface" style={{ height: horas.length * PX_POR_HORA }} />
      ) : !profissionalSelecionadoId ? (
        <div className="card-elevated flex flex-col items-center gap-2 rounded-2xl bg-surface p-10 text-center">
          <CalendarDays size={28} className="text-muted" />
          <p className="text-sm text-muted">Nenhum profissional disponível.</p>
        </div>
      ) : (
        <div
          className="card-elevated relative overflow-hidden rounded-2xl bg-surface"
          style={{ height: horas.length * PX_POR_HORA }}
        >
          {horas.map((h, i) => (
            <button
              key={h}
              className="absolute left-0 right-0 flex items-start border-t border-border-subtle text-xs text-muted transition-colors hover:bg-surface-alt/40"
              style={{ top: i * PX_POR_HORA, height: PX_POR_HORA }}
              onClick={() => abrirNovoAgendamento(h * 60)}
            >
              <span className="w-14 -translate-y-2 pl-2 tabular-nums">{String(h).padStart(2, "0")}:00</span>
            </button>
          ))}

          {bloqueiosDoDia.map((b) => {
            const top = ((b.inicioMinutosDoDia - HORA_INICIO * 60) / 60) * PX_POR_HORA;
            const altura = Math.max(24, (b.duracaoMinutos / 60) * PX_POR_HORA - 3);
            return (
              <div
                key={b.id}
                className="pointer-events-none absolute left-16 right-2 overflow-hidden rounded-lg bg-danger/15 p-2 text-left text-xs text-danger"
                style={{ top, height: altura }}
              >
                <p className="truncate font-medium">Bloqueado: {b.motivo}</p>
              </div>
            );
          })}

          {blocosDoDia.map((b) => {
            const top = ((b.inicioMinutosDoDia - HORA_INICIO * 60) / 60) * PX_POR_HORA;
            const altura = Math.max(30, (b.duracaoMinutos / 60) * PX_POR_HORA - 3);
            const estilo =
              b.status === "CONFIRMADO"
                ? "border-success bg-success text-success-foreground"
                : b.status === "CONCLUIDO"
                  ? "border-finalizado bg-finalizado text-finalizado-foreground"
                  : b.status === "CANCELADO"
                    ? "border-danger bg-danger text-white"
                    : b.status === "FALTOU"
                      ? "border-warning bg-warning text-warning-foreground"
                      : "border-info bg-info text-info-foreground";
            return (
              <button
                key={b.id}
                onClick={() => router.push(`/agenda/${b.id}`)}
                className={`absolute left-16 right-2 overflow-hidden rounded-lg border-l-[3px] p-2 text-left text-xs shadow-sm transition-transform hover:scale-[1.01] ${estilo}`}
                style={{ top, height: altura }}
              >
                <p className="truncate font-semibold">{b.nomeCliente}</p>
                <p className="truncate opacity-80">
                  {b.status === "FALTOU"
                    ? `Faltou · ${b.nomesServicos}`
                    : b.status === "CANCELADO"
                      ? `Cancelado · ${b.nomesServicos}`
                      : b.nomesServicos}
                </p>
              </button>
            );
          })}
        </div>
      )}

      {perfil && profissionalSelecionadoId && (perfil.papel === "DONO" || profissionalSelecionadoId === perfil.id) && (
        <button
          onClick={() => setMostrarNovoBloqueio(true)}
          aria-label="Bloquear horário"
          className="fixed bottom-44 right-5 flex h-11 w-11 items-center justify-center rounded-full bg-surface text-danger shadow-lg transition-transform hover:scale-105 md:bottom-28"
        >
          <Ban size={20} />
        </button>
      )}

      <button
        onClick={() => abrirNovoAgendamento()}
        aria-label="Novo agendamento"
        className="fixed bottom-24 right-5 flex h-14 w-14 items-center justify-center rounded-full bg-accent text-accent-foreground shadow-lg shadow-accent/30 transition-transform hover:scale-105 md:bottom-8"
      >
        <Plus size={24} strokeWidth={2.5} />
      </button>

      {mostrarNovoBloqueio && (
        <div className="fixed inset-0 z-30 flex items-center justify-center bg-black/60 p-5 backdrop-blur-sm">
          <div className="card-elevated w-full max-w-sm rounded-2xl bg-surface p-5">
            <div className="mb-4 flex items-center justify-between">
              <p className="font-medium">Bloquear horário — {dataLabel}</p>
              <button onClick={() => setMostrarNovoBloqueio(false)} className="text-muted hover:text-foreground">
                <X size={18} />
              </button>
            </div>

            <div className="mb-3 flex gap-2">
              <div className="flex-1">
                <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-muted">Das</label>
                <input
                  type="time"
                  value={horaInicioBloqueio}
                  onChange={(e) => setHoraInicioBloqueio(e.target.value)}
                  className="w-full rounded-lg border border-border-subtle bg-background px-3 py-2 text-sm outline-none focus:border-accent [color-scheme:dark]"
                />
              </div>
              <div className="flex-1">
                <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-muted">Até</label>
                <input
                  type="time"
                  value={horaFimBloqueio}
                  onChange={(e) => setHoraFimBloqueio(e.target.value)}
                  className="w-full rounded-lg border border-border-subtle bg-background px-3 py-2 text-sm outline-none focus:border-accent [color-scheme:dark]"
                />
              </div>
            </div>

            <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-muted">Motivo</label>
            <input
              type="text"
              value={motivoBloqueio}
              onChange={(e) => setMotivoBloqueio(e.target.value)}
              placeholder="Ex: Consulta médica"
              className="mb-4 w-full rounded-lg border border-border-subtle bg-background px-3 py-2 text-sm outline-none focus:border-accent"
            />

            <button
              onClick={handleCriarBloqueio}
              disabled={salvandoBloqueio || !motivoBloqueio.trim()}
              className="w-full rounded-xl bg-accent px-4 py-3 text-sm font-medium text-accent-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
            >
              {salvandoBloqueio ? "Salvando..." : "Bloquear"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
