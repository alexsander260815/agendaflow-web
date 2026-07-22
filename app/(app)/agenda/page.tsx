"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { CalendarDays, ChevronLeft, ChevronRight, Plus } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import {
  listarAgendamentoServicos,
  listarAgendamentos,
  listarClientes,
  listarEquipe,
  listarServicos,
} from "@/lib/repositories";
import { profissionaisVisiveisAgenda } from "@/lib/permissoes";
import Avatar from "@/components/Avatar";
import { Agendamento, AgendamentoServico, Perfil } from "@/lib/types";
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
  concluido: boolean;
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

  useEffect(() => {
    if (!perfil) return;
    carregarInicial();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [perfil?.id]);

  async function carregarInicial() {
    if (!perfil) return;
    setCarregando(true);
    try {
      const [equipeQueAtende, idsPermitidos, servicos, clientes, agendamentos, itens] = await Promise.all([
        listarEquipe(perfil.salao_id).then((lista) => lista.filter((p) => p.atende_clientes)),
        profissionaisVisiveisAgenda(perfil),
        listarServicos(perfil.salao_id),
        listarClientes(perfil.salao_id),
        listarAgendamentos(perfil.salao_id),
        listarAgendamentoServicos(perfil.salao_id),
      ]);

      const equipeFiltrada = idsPermitidos === null ? equipeQueAtende : equipeQueAtende.filter((p) => idsPermitidos.includes(p.id));
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
        const duracaoTotal = itens.reduce((soma, i) => soma + (cacheDuracoes.get(i.servico_id) ?? 30), 0) || 30;
        const millis = converterIsoParaMillis(a.data_hora);
        const d = new Date(millis);
        return {
          id: a.id,
          nomeCliente: cacheClientes.get(a.cliente_id) ?? "Cliente desconhecido",
          nomesServicos: itens.length ? itens.map((i) => i.nome_servico).join(", ") : "Sem serviços",
          inicioMinutosDoDia: d.getHours() * 60 + d.getMinutes(),
          duracaoMinutos: duracaoTotal,
          concluido: a.status === "CONCLUIDO",
        };
      });
  }, [cacheAgendamentos, cacheItens, cacheDuracoes, cacheClientes, profissionalSelecionadoId, dataSelecionada]);

  function irParaDiaAnterior() {
    setDataSelecionada((d) => d - 24 * 60 * 60 * 1000);
  }

  function irParaProximoDia() {
    setDataSelecionada((d) => d + 24 * 60 * 60 * 1000);
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
        <span className="w-40 text-center font-medium capitalize">
          {hoje && <span className="mr-1.5 rounded-full bg-accent/15 px-2 py-0.5 text-xs text-accent">Hoje</span>}
          {dataLabel}
        </span>
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
                className={`h-12 w-12 text-sm transition-all ${
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

          {blocosDoDia.map((b) => {
            const top = ((b.inicioMinutosDoDia - HORA_INICIO * 60) / 60) * PX_POR_HORA;
            const altura = Math.max(30, (b.duracaoMinutos / 60) * PX_POR_HORA - 3);
            return (
              <button
                key={b.id}
                onClick={() => router.push(`/agenda/${b.id}`)}
                className={`absolute left-16 right-2 overflow-hidden rounded-lg border-l-[3px] p-2 text-left text-xs shadow-sm transition-transform hover:scale-[1.01] ${
                  b.concluido
                    ? "border-muted bg-surface-alt text-muted"
                    : "border-accent-dark bg-accent text-accent-foreground"
                }`}
                style={{ top, height: altura }}
              >
                <p className="truncate font-semibold">{b.nomeCliente}</p>
                {altura > 32 && <p className="truncate opacity-80">{b.nomesServicos}</p>}
              </button>
            );
          })}
        </div>
      )}

      <button
        onClick={() => abrirNovoAgendamento()}
        aria-label="Novo agendamento"
        className="fixed bottom-24 right-5 flex h-14 w-14 items-center justify-center rounded-full bg-accent text-accent-foreground shadow-lg shadow-accent/30 transition-transform hover:scale-105 md:bottom-8"
      >
        <Plus size={24} strokeWidth={2.5} />
      </button>
    </div>
  );
}
