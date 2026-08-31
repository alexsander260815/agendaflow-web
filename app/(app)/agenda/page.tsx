"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Ban, CalendarDays, ChevronLeft, ChevronRight, MoreVertical, Plus, Sparkles, X } from "lucide-react";
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
import BotaoVoltarInicio from "@/components/BotaoVoltarInicio";

const HORA_INICIO = 7;
const HORA_FIM = 21;
const PX_POR_HORA = 82;

interface BlocoAgenda {
  id: string;
  nomeCliente: string;
  nomesServicos: string;
  inicioMinutosDoDia: number;
  duracaoMinutos: number;
  status: string;
  coluna: number;
  totalColunas: number;
}

interface BlocoBloqueio {
  id: string;
  motivo: string;
  inicioMinutosDoDia: number;
  duracaoMinutos: number;
}

const CORES_SERVICO = ["#a855f7", "#ec4899", "#f59e0b", "#3b82f6", "#14b8a6", "#22c55e", "#f97316"];

function corDoServico(nome: string): string {
  const normalizado = nome.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  if (normalizado.includes("manicure") || normalizado.includes("unha") || normalizado.includes("esmalta")) return "#ec4899";
  if (normalizado.includes("progressiva") || normalizado.includes("alisa")) return "#f59e0b";
  if (normalizado.includes("massagem") || normalizado.includes("drenagem")) return "#3b82f6";
  if (normalizado.includes("hidrata")) return "#14b8a6";
  if (normalizado.includes("corte")) return "#a855f7";
  let hash = 0;
  for (const caractere of normalizado) hash = (hash * 31 + caractere.charCodeAt(0)) >>> 0;
  return CORES_SERVICO[hash % CORES_SERVICO.length];
}

function distribuirConflitos(blocos: Omit<BlocoAgenda, "coluna" | "totalColunas">[]): BlocoAgenda[] {
  const ordenados = [...blocos].sort((a, b) => a.inicioMinutosDoDia - b.inicioMinutosDoDia);
  const resultado: BlocoAgenda[] = [];
  let grupo: BlocoAgenda[] = [];
  let fimDoGrupo = -1;

  const finalizarGrupo = () => {
    if (!grupo.length) return;
    const total = Math.max(...grupo.map((item) => item.coluna)) + 1;
    grupo.forEach((item) => (item.totalColunas = total));
    resultado.push(...grupo);
    grupo = [];
  };

  ordenados.forEach((bloco) => {
    if (grupo.length && bloco.inicioMinutosDoDia >= fimDoGrupo) finalizarGrupo();
    const finaisPorColuna: number[] = [];
    grupo.forEach((item) => {
      finaisPorColuna[item.coluna] = Math.max(
        finaisPorColuna[item.coluna] ?? 0,
        item.inicioMinutosDoDia + item.duracaoMinutos
      );
    });
    let coluna = finaisPorColuna.findIndex((fim) => fim <= bloco.inicioMinutosDoDia);
    if (coluna === -1) coluna = finaisPorColuna.length;
    const posicionado = { ...bloco, coluna, totalColunas: 1 };
    grupo.push(posicionado);
    fimDoGrupo = Math.max(fimDoGrupo, bloco.inicioMinutosDoDia + bloco.duracaoMinutos);
  });
  finalizarGrupo();
  return resultado;
}

export default function AgendaPage() {
  return (
    <Suspense fallback={null}>
      <AgendaPageInner />
    </Suspense>
  );
}

function AgendaPageInner() {
  const { perfil } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();

  const [equipe, setEquipe] = useState<Perfil[]>([]);
  const [profissionalSelecionadoId, setProfissionalSelecionadoId] = useState<string | null>(null);
  const [dataSelecionada, setDataSelecionada] = useState(() => {
    const dataParam = searchParams.get("data");
    return dataParam ? Number(dataParam) : inicioDoDia();
  });
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

  useEffect(() => {
    if (!perfil) return;
    const frame = window.requestAnimationFrame(() => void carregarInicial());
    return () => window.cancelAnimationFrame(frame);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [perfil?.id]);

  const blocosDoDia: BlocoAgenda[] = useMemo(() => {
    if (!profissionalSelecionadoId) return [];
    const inicioDia = dataSelecionada;
    const fimDia = inicioDia + 24 * 60 * 60 * 1000;

    const blocos = cacheAgendamentos
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
    return distribuirConflitos(blocos);
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
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  const horas = Array.from({ length: HORA_FIM - HORA_INICIO }, (_, i) => HORA_INICIO + i);

  return (
    <div className="mx-auto max-w-7xl p-4 pb-28 sm:p-6 lg:p-8 lg:pb-10">
      <div className="mb-2 md:hidden">
        <BotaoVoltarInicio />
      </div>
      <div className="mb-6 flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <div className="mb-1 flex items-center gap-2 text-dashboard-accent-light"><Sparkles size={15} /><p className="text-xs font-bold uppercase tracking-[0.18em]">Organização do dia</p></div>
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Agenda</h1>
          <p className="mt-1 text-sm text-muted">Visualize e gerencie seus atendimentos</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="card-elevated flex min-w-0 flex-1 items-center rounded-2xl border border-border-subtle bg-surface p-1 sm:min-w-[390px]">
            <button aria-label="Dia anterior" onClick={irParaDiaAnterior} className="rounded-xl p-2.5 text-muted transition-colors hover:bg-surface-alt hover:text-foreground"><ChevronLeft size={20} /></button>
            <div className="relative min-w-0 flex-1 py-2 text-center text-sm font-semibold capitalize sm:text-base">
              <span className="truncate">{dataLabel}</span>
              <input type="date" value={dataParaInput(dataSelecionada)} onChange={(e) => handleEscolherData(e.target.value)} className="absolute inset-0 h-full w-full cursor-pointer opacity-0" aria-label="Escolher data" />
            </div>
            <button aria-label="Próximo dia" onClick={irParaProximoDia} className="rounded-xl p-2.5 text-muted transition-colors hover:bg-surface-alt hover:text-foreground"><ChevronRight size={20} /></button>
          </div>
          {!hoje && <button onClick={() => setDataSelecionada(inicioDoDia())} className="rounded-2xl border border-accent/60 bg-accent/10 px-4 py-3 text-sm font-bold text-accent transition-colors hover:bg-accent hover:text-accent-foreground">Hoje</button>}
        </div>
      </div>

      <div className="card-elevated mb-5 flex gap-4 overflow-x-auto rounded-3xl border border-border-subtle bg-surface p-4 pb-3">
        {equipe.map((p) => {
          const ativo = profissionalSelecionadoId === p.id;
          return (
            <button
              key={p.id}
              onClick={() => setProfissionalSelecionadoId(p.id)}
              className="group flex min-w-[84px] shrink-0 flex-col items-center gap-2"
            >
              <Avatar
                nome={p.nome}
                fotoUrl={p.foto_url}
                shape="square"
                className={`h-[78px] w-[78px] rounded-2xl text-base transition-all ${
                  ativo ? "ring-2 ring-accent ring-offset-2 ring-offset-surface shadow-lg shadow-accent/20" : "opacity-65 grayscale-[20%] group-hover:opacity-100"
                }`}
              />
              <span className={`max-w-[84px] truncate text-xs ${ativo ? "font-bold text-accent" : "text-muted"}`}>
                {p.nome.split(" ")[0]}
              </span>
              <span className={`h-1.5 w-1.5 rounded-full ${ativo ? "bg-accent shadow-[0_0_8px_var(--accent)]" : "bg-muted/50"}`} />
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
          className="card-elevated relative overflow-hidden rounded-3xl border border-border-subtle bg-surface"
          style={{ height: horas.length * PX_POR_HORA }}
        >
          {horas.map((h, i) => (
            <button
              key={h}
              className="absolute left-0 right-0 flex items-start border-t border-border-subtle text-xs text-muted transition-colors hover:bg-surface-alt/35"
              style={{ top: i * PX_POR_HORA, height: PX_POR_HORA }}
              onClick={() => abrirNovoAgendamento(h * 60)}
            >
              <span className="w-16 translate-y-1 bg-surface pl-3 font-medium tabular-nums">{String(h).padStart(2, "0")}:00</span>
            </button>
          ))}

          {bloqueiosDoDia.map((b) => {
            const top = ((b.inicioMinutosDoDia - HORA_INICIO * 60) / 60) * PX_POR_HORA;
            const altura = Math.max(24, (b.duracaoMinutos / 60) * PX_POR_HORA - 3);
            return (
              <div
                key={b.id}
                className="pointer-events-none absolute left-[72px] right-3 overflow-hidden rounded-xl border border-danger/30 bg-danger/10 p-2 text-left text-xs text-danger"
                style={{ top, height: altura }}
              >
                <p className="truncate font-medium">Bloqueado: {b.motivo}</p>
              </div>
            );
          })}

          {blocosDoDia.map((b) => {
            const top = ((b.inicioMinutosDoDia - HORA_INICIO * 60) / 60) * PX_POR_HORA;
            const altura = Math.max(38, (b.duracaoMinutos / 60) * PX_POR_HORA - 5);
            const cor = b.status === "CANCELADO" ? "#ef4444" : b.status === "FALTOU" ? "#f59e0b" : corDoServico(b.nomesServicos);
            const percentualColuna = 100 / b.totalColunas;
            const esquerda = `calc(72px + ${b.coluna * percentualColuna}% - ${(b.coluna * 84) / b.totalColunas}px)`;
            const largura = `calc(${percentualColuna}% - ${84 / b.totalColunas + 6}px)`;
            const horaInicio = `${String(Math.floor(b.inicioMinutosDoDia / 60)).padStart(2, "0")}:${String(b.inicioMinutosDoDia % 60).padStart(2, "0")}`;
            const fimMinutos = b.inicioMinutosDoDia + b.duracaoMinutos;
            const horaFim = `${String(Math.floor(fimMinutos / 60)).padStart(2, "0")}:${String(fimMinutos % 60).padStart(2, "0")}`;
            return (
              <button
                key={b.id}
                onClick={() => router.push(`/agenda/${b.id}`)}
                className="absolute overflow-hidden rounded-xl border p-2.5 text-left text-xs text-foreground shadow-md transition-all hover:z-10 hover:scale-[1.015] hover:shadow-lg"
                style={{
                  top,
                  height: altura,
                  left: esquerda,
                  width: largura,
                  borderColor: cor,
                  borderLeftWidth: 4,
                  background: `linear-gradient(135deg, color-mix(in srgb, ${cor} 20%, var(--surface)), color-mix(in srgb, ${cor} 7%, var(--surface)))`,
                }}
              >
                <div className={`flex items-center justify-between gap-2 ${b.duracaoMinutos > 30 ? "mb-1" : "h-full"}`}>
                  <div className={`min-w-0 ${b.duracaoMinutos <= 30 ? "flex items-center gap-2" : ""}`}>
                    <span className="shrink-0 font-bold tabular-nums" style={{ color: cor }}>{horaInicio}–{horaFim}</span>
                    <p className="truncate font-bold">{b.nomeCliente}</p>
                  </div>
                  <MoreVertical size={14} className="shrink-0 text-muted" />
                </div>
                {b.duracaoMinutos > 30 && <p className="truncate text-muted">
                  {b.status === "FALTOU"
                    ? `Faltou · ${b.nomesServicos}`
                    : b.status === "CANCELADO"
                      ? `Cancelado · ${b.nomesServicos}`
                      : b.nomesServicos}
                </p>}
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
        className="fixed bottom-24 right-5 z-20 flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-accent to-[#ec4899] text-accent-foreground shadow-xl shadow-accent/35 transition-transform hover:scale-105 md:bottom-8 md:right-8"
      >
        <Plus size={28} strokeWidth={2.5} />
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
