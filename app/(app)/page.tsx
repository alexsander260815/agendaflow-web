"use client";

import { useEffect, useState } from "react";
import { CalendarClock, Sparkles, TrendingUp, Trophy } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { listarAgendamentos } from "@/lib/repositories/agendamentoRepository";
import { listarAgendamentoServicos } from "@/lib/repositories/agendamentoServicoRepository";
import { listarClientes } from "@/lib/repositories/clienteRepository";
import { listarEquipe } from "@/lib/repositories/perfilRepository";
import { profissionaisVisiveisFinanceiro } from "@/lib/permissoes";
import Avatar from "@/components/Avatar";
import { Agendamento, AgendamentoServico } from "@/lib/types";
import {
  converterIsoParaMillis,
  fimDoDia,
  formatarHora,
  formatarMoeda,
  inicioDoDia,
  intervaloDoMes,
  labelDiaCurto,
} from "@/lib/datetime";

interface AgendamentoDeHoje {
  id: string;
  nomeCliente: string;
  nomesServicos: string;
  horario: string;
  concluido: boolean;
}

interface TopProfissional {
  nome: string;
  fotoUrl: string | null;
  atendimentos: number;
  faturamento: number;
}

interface PontoReceitaDia {
  label: string;
  valor: number;
  ehHoje: boolean;
}

export default function DashboardPage() {
  const { perfil } = useAuth();
  const [carregando, setCarregando] = useState(true);
  const [faturamentoHoje, setFaturamentoHoje] = useState(0);
  const [faturamentoMes, setFaturamentoMes] = useState(0);
  const [ticketMedio, setTicketMedio] = useState(0);
  const [agendamentosHoje, setAgendamentosHoje] = useState<AgendamentoDeHoje[]>([]);
  const [topProfissionais, setTopProfissionais] = useState<TopProfissional[]>([]);
  const [receita7Dias, setReceita7Dias] = useState<PontoReceitaDia[]>([]);
  const [mostrarTopProfissionais, setMostrarTopProfissionais] = useState(true);

  useEffect(() => {
    if (!perfil) return;
    carregar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [perfil?.id]);

  async function carregar() {
    if (!perfil) return;
    setCarregando(true);
    try {
      const [todosAgendamentos, todosItens, clientes, equipe, permitidos] = await Promise.all([
        listarAgendamentos(perfil.salao_id),
        listarAgendamentoServicos(perfil.salao_id),
        listarClientes(perfil.salao_id),
        listarEquipe(perfil.salao_id),
        profissionaisVisiveisFinanceiro(perfil),
      ]);

      const clientesMap = new Map(clientes.map((c) => [c.id, c.nome]));
      const equipeMap = new Map(equipe.map((p) => [p.id, p]));
      const itensPorAgendamento = new Map<string, AgendamentoServico[]>();
      todosItens.forEach((item) => {
        const lista = itensPorAgendamento.get(item.agendamento_id) ?? [];
        lista.push(item);
        itensPorAgendamento.set(item.agendamento_id, lista);
      });

      const permitidoFinanceiro = (profissionalId: string | null) =>
        permitidos === null || (profissionalId !== null && permitidos.includes(profissionalId));

      const agendamentosVisiveisNaAgenda =
        perfil.papel === "PROFISSIONAL"
          ? todosAgendamentos.filter((a) => a.profissional_id === perfil.id)
          : todosAgendamentos;

      const hojeInicio = inicioDoDia();
      const hojeFim = fimDoDia();
      const [mesInicio, mesFim] = intervaloDoMes();

      const concluidos = todosAgendamentos.filter(
        (a) => a.status === "CONCLUIDO" && permitidoFinanceiro(a.profissional_id)
      );

      const totalItens = (ag: Agendamento) =>
        (itensPorAgendamento.get(ag.id) ?? []).reduce((soma, i) => soma + i.preco, 0);

      const concluidosHoje = concluidos.filter(
        (a) => converterIsoParaMillis(a.data_hora) >= hojeInicio && converterIsoParaMillis(a.data_hora) <= hojeFim
      );
      const concluidosMes = concluidos.filter(
        (a) => converterIsoParaMillis(a.data_hora) >= mesInicio && converterIsoParaMillis(a.data_hora) <= mesFim
      );

      const fatHoje = concluidosHoje.reduce((soma, a) => soma + totalItens(a), 0);
      const fatMes = concluidosMes.reduce((soma, a) => soma + totalItens(a), 0);

      setFaturamentoHoje(fatHoje);
      setFaturamentoMes(fatMes);
      setTicketMedio(concluidosMes.length > 0 ? fatMes / concluidosMes.length : 0);

      const agendaHoje = agendamentosVisiveisNaAgenda
        .filter(
          (a) => converterIsoParaMillis(a.data_hora) >= hojeInicio && converterIsoParaMillis(a.data_hora) <= hojeFim
        )
        .sort((a, b) => a.data_hora.localeCompare(b.data_hora));

      setAgendamentosHoje(
        agendaHoje.map((a) => ({
          id: a.id,
          nomeCliente: clientesMap.get(a.cliente_id) ?? "Cliente desconhecido",
          nomesServicos:
            itensPorAgendamento.get(a.id)?.map((i) => i.nome_servico).join(", ") || "Sem serviços",
          horario: formatarHora(converterIsoParaMillis(a.data_hora)),
          concluido: a.status === "CONCLUIDO",
        }))
      );

      const porProfissional = new Map<string, Agendamento[]>();
      concluidosMes.forEach((a) => {
        const chave = a.profissional_id ?? "sem_profissional";
        const lista = porProfissional.get(chave) ?? [];
        lista.push(a);
        porProfissional.set(chave, lista);
      });

      const top = Array.from(porProfissional.entries())
        .map(([id, lista]) => {
          const prof = id === "sem_profissional" ? undefined : equipeMap.get(id);
          return {
            nome: prof?.nome ?? "Não atribuído",
            fotoUrl: prof?.foto_url ?? null,
            atendimentos: lista.length,
            faturamento: lista.reduce((soma, a) => soma + totalItens(a), 0),
          };
        })
        .sort((a, b) => b.faturamento - a.faturamento)
        .slice(0, 5);

      setTopProfissionais(top);
      setMostrarTopProfissionais(perfil.papel !== "PROFISSIONAL");

      const pontos: PontoReceitaDia[] = [];
      for (let i = 6; i >= 0; i--) {
        const diaMillis = Date.now() - i * 24 * 60 * 60 * 1000;
        const ini = inicioDoDia(diaMillis);
        const fim = fimDoDia(diaMillis);
        const doDia = concluidos.filter(
          (a) => converterIsoParaMillis(a.data_hora) >= ini && converterIsoParaMillis(a.data_hora) <= fim
        );
        const total = doDia.reduce((soma, a) => soma + totalItens(a), 0);
        pontos.push({ label: labelDiaCurto(ini), valor: total, ehHoje: i === 0 });
      }
      setReceita7Dias(pontos);
    } catch (e) {
      console.error(e);
    } finally {
      setCarregando(false);
    }
  }

  const maiorValor = Math.max(1, ...receita7Dias.map((p) => p.valor));

  return (
    <div className="mx-auto max-w-3xl p-5 md:p-8">
      <h1 className="mb-6 text-2xl font-semibold tracking-tight">Visão Geral</h1>

      {carregando ? (
        <div className="flex flex-col gap-4">
          {[140, 88, 160, 140].map((h, i) => (
            <div key={i} className="animate-pulse rounded-2xl bg-surface" style={{ height: h }} />
          ))}
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          <div className="card-elevated gradient-accent rounded-2xl border border-accent/15 bg-surface p-5">
            <div className="mb-1 flex items-center gap-1.5 text-accent">
              <Sparkles size={14} />
              <p className="text-xs font-semibold uppercase tracking-wide">Faturamento hoje</p>
            </div>
            <p className="text-3xl font-bold tabular-nums">{formatarMoeda(faturamentoHoje)}</p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="card-elevated rounded-2xl bg-surface p-4">
              <p className="text-sm text-muted">Faturamento no mês</p>
              <p className="mt-1 text-xl font-semibold tabular-nums">{formatarMoeda(faturamentoMes)}</p>
            </div>
            <div className="card-elevated rounded-2xl bg-surface p-4">
              <p className="text-sm text-muted">Ticket médio</p>
              <p className="mt-1 text-xl font-semibold tabular-nums">{formatarMoeda(ticketMedio)}</p>
            </div>
          </div>

          <div className="card-elevated rounded-2xl bg-surface p-4">
            <div className="mb-4 flex items-center gap-2">
              <TrendingUp size={16} className="text-accent" />
              <p className="font-medium">Faturamento dos últimos 7 dias</p>
            </div>
            <div className="flex items-end gap-2.5" style={{ height: 110 }}>
              {receita7Dias.map((p, i) => (
                <div key={i} className="flex flex-1 flex-col items-center gap-2">
                  <div
                    className={`w-full rounded-full transition-all ${p.ehHoje ? "bg-accent" : "bg-surface-alt"}`}
                    style={{ height: `${Math.max(4, (p.valor / maiorValor) * 84)}px` }}
                    title={formatarMoeda(p.valor)}
                  />
                  <span className={`text-xs ${p.ehHoje ? "font-medium text-accent" : "text-muted"}`}>
                    {p.label}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className="card-elevated rounded-2xl bg-surface p-4">
            <div className="mb-3 flex items-center gap-2">
              <CalendarClock size={16} className="text-accent" />
              <p className="font-medium">Hoje ({agendamentosHoje.length})</p>
            </div>
            {agendamentosHoje.length === 0 ? (
              <p className="text-sm text-muted">Nenhum agendamento hoje.</p>
            ) : (
              <div className="flex flex-col divide-y divide-border-subtle">
                {agendamentosHoje.map((a) => (
                  <div key={a.id} className="flex items-center gap-3 py-2.5 first:pt-0 last:pb-0">
                    <div className="flex h-10 w-12 shrink-0 flex-col items-center justify-center rounded-lg bg-surface-alt">
                      <span className="text-xs font-semibold text-accent">{a.horario}</span>
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{a.nomeCliente}</p>
                      <p className="truncate text-xs text-muted">{a.nomesServicos}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {mostrarTopProfissionais && (
            <div className="card-elevated rounded-2xl bg-surface p-4">
              <div className="mb-3 flex items-center gap-2">
                <Trophy size={16} className="text-accent" />
                <p className="font-medium">Top profissionais (mês)</p>
              </div>
              {topProfissionais.length === 0 ? (
                <p className="text-sm text-muted">Sem dados ainda.</p>
              ) : (
                <div className="flex flex-col gap-3">
                  {topProfissionais.map((p, i) => {
                    return (
                      <div key={i} className="flex items-center gap-3">
                        <Avatar nome={p.nome} fotoUrl={p.fotoUrl} className="h-9 w-9 text-xs" />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium">{p.nome}</p>
                          <p className="text-xs text-muted">{p.atendimentos} atendimento(s)</p>
                        </div>
                        <span className="text-sm font-medium tabular-nums text-accent">
                          {formatarMoeda(p.faturamento)}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
