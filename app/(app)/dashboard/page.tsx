"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  ArrowUpRight,
  CalendarClock,
  ChevronRight,
  CircleDollarSign,
  Clock3,
  Scissors,
  Sparkles,
  TrendingUp,
  Trophy,
  WalletCards,
} from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { listarAgendamentos } from "@/lib/repositories/agendamentoRepository";
import { listarAgendamentoServicos } from "@/lib/repositories/agendamentoServicoRepository";
import { listarClientes } from "@/lib/repositories/clienteRepository";
import { listarEquipe } from "@/lib/repositories/perfilRepository";
import { listarReceitasAvulsas } from "@/lib/repositories/receitaAvulsaRepository";
import { profissionaisVisiveisAgenda, profissionaisVisiveisFinanceiro } from "@/lib/permissoes";
import Avatar from "@/components/Avatar";
import { Agendamento, AgendamentoServico, ReceitaAvulsa } from "@/lib/types";
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

interface TopServico {
  nome: string;
  quantidade: number;
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
  const [topServicos, setTopServicos] = useState<TopServico[]>([]);
  const [receita7Dias, setReceita7Dias] = useState<PontoReceitaDia[]>([]);
  const [mostrarTopProfissionais, setMostrarTopProfissionais] = useState(true);

  async function carregar() {
    if (!perfil) return;
    setCarregando(true);
    try {
      const [todosAgendamentos, todosItens, clientes, equipe, permitidos, permitidosAgenda] = await Promise.all([
        listarAgendamentos(perfil.salao_id),
        listarAgendamentoServicos(perfil.salao_id),
        listarClientes(perfil.salao_id),
        listarEquipe(perfil.salao_id),
        profissionaisVisiveisFinanceiro(perfil),
        profissionaisVisiveisAgenda(perfil),
      ]);
      // Receita de pacote é caixa entrando na venda, não no uso — sem isso o
      // faturamento contava a mesma sessão duas vezes. Só quem enxerga o
      // financeiro completo vê (mesma regra das despesas em Financeiro).
      const receitasAvulsas: ReceitaAvulsa[] = permitidos === null ? await listarReceitasAvulsas(perfil.salao_id) : [];
      const somaReceitasAvulsas = (inicio: number, fim: number) =>
        receitasAvulsas
          .filter((r) => converterIsoParaMillis(r.data_receita) >= inicio && converterIsoParaMillis(r.data_receita) <= fim)
          .reduce((soma, r) => soma + r.valor, 0);

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
        permitidosAgenda === null
          ? todosAgendamentos
          : todosAgendamentos.filter((a) => a.profissional_id === null || permitidosAgenda.includes(a.profissional_id));

      const hojeInicio = inicioDoDia();
      const hojeFim = fimDoDia();
      const [mesInicio, mesFim] = intervaloDoMes();

      const concluidos = todosAgendamentos.filter(
        (a) => a.status === "CONCLUIDO" && permitidoFinanceiro(a.profissional_id)
      );

      // Itens cobertos por pacote já entraram como receita na venda — contar
      // de novo aqui infla o faturamento com sessões que ninguém pagou agora.
      const totalItens = (ag: Agendamento) =>
        (itensPorAgendamento.get(ag.id) ?? [])
          .filter((i) => !i.cliente_pacote_id)
          .reduce((soma, i) => soma + i.preco, 0);

      const concluidosHoje = concluidos.filter(
        (a) => converterIsoParaMillis(a.data_hora) >= hojeInicio && converterIsoParaMillis(a.data_hora) <= hojeFim
      );
      const concluidosMes = concluidos.filter(
        (a) => converterIsoParaMillis(a.data_hora) >= mesInicio && converterIsoParaMillis(a.data_hora) <= mesFim
      );

      const fatHoje = concluidosHoje.reduce((soma, a) => soma + totalItens(a), 0) + somaReceitasAvulsas(hojeInicio, hojeFim);
      const fatMes = concluidosMes.reduce((soma, a) => soma + totalItens(a), 0) + somaReceitasAvulsas(mesInicio, mesFim);

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

      const agendamentosConcluidosMes = new Set(concluidosMes.map((a) => a.id));
      const porServico = new Map<string, TopServico>();
      todosItens
        .filter((item) => agendamentosConcluidosMes.has(item.agendamento_id) && !item.cliente_pacote_id)
        .forEach((item) => {
          const atual = porServico.get(item.nome_servico) ?? {
            nome: item.nome_servico,
            quantidade: 0,
            faturamento: 0,
          };
          atual.quantidade += 1;
          atual.faturamento += item.preco;
          porServico.set(item.nome_servico, atual);
        });
      setTopServicos(
        Array.from(porServico.values())
          .sort((a, b) => b.faturamento - a.faturamento)
          .slice(0, 5)
      );

      const pontos: PontoReceitaDia[] = [];
      for (let i = 6; i >= 0; i--) {
        const diaMillis = Date.now() - i * 24 * 60 * 60 * 1000;
        const ini = inicioDoDia(diaMillis);
        const fim = fimDoDia(diaMillis);
        const doDia = concluidos.filter(
          (a) => converterIsoParaMillis(a.data_hora) >= ini && converterIsoParaMillis(a.data_hora) <= fim
        );
        const total = doDia.reduce((soma, a) => soma + totalItens(a), 0) + somaReceitasAvulsas(ini, fim);
        pontos.push({ label: labelDiaCurto(ini), valor: total, ehHoje: i === 0 });
      }
      setReceita7Dias(pontos);
    } catch (e) {
      console.error(e);
    } finally {
      setCarregando(false);
    }
  }

  useEffect(() => {
    if (!perfil) return;
    const frame = window.requestAnimationFrame(() => void carregar());
    return () => window.cancelAnimationFrame(frame);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [perfil?.id]);

  const maiorValor = Math.max(1, ...receita7Dias.map((p) => p.valor));
  const maiorFaturamentoProfissional = Math.max(1, ...topProfissionais.map((p) => p.faturamento));
  const maiorFaturamentoServico = Math.max(1, ...topServicos.map((s) => s.faturamento));
  const pontosGrafico = receita7Dias.map((p, index) => ({
    ...p,
    x: receita7Dias.length === 1 ? 50 : (index / (receita7Dias.length - 1)) * 100,
    y: 82 - (p.valor / maiorValor) * 66,
  }));
  const linhaGrafico = pontosGrafico.map((p) => `${p.x},${p.y}`).join(" ");
  const areaGrafico = pontosGrafico.length > 0 ? `0,86 ${linhaGrafico} 100,86` : "";

  return (
    <div className="mx-auto max-w-7xl p-4 pb-28 sm:p-6 lg:p-8 lg:pb-10">
      <div className="mb-6 flex items-end justify-between gap-4">
        <div>
          <p className="mb-1 text-xs font-semibold uppercase tracking-[0.2em] text-dashboard-accent-light">Dashboard</p>
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Visão Geral</h1>
          <p className="mt-1 text-sm text-muted">Acompanhe o desempenho do seu negócio</p>
        </div>
        <div className="hidden items-center gap-2 rounded-2xl border border-border-subtle bg-surface px-4 py-2 text-sm text-muted shadow-sm sm:flex">
          <CalendarClock size={17} className="text-dashboard-accent-light" />
          Este mês
        </div>
      </div>

      {carregando ? (
        <div className="grid gap-4 lg:grid-cols-2">
          {[170, 130, 310, 310].map((h, i) => (
            <div key={i} className="animate-pulse rounded-2xl bg-surface" style={{ height: h }} />
          ))}
        </div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-12">
          <div className="card-elevated relative overflow-hidden rounded-3xl border border-dashboard-accent/35 bg-surface p-6 sm:p-7 lg:col-span-12">
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_75%_20%,color-mix(in_srgb,var(--dashboard-accent)_24%,transparent),transparent_34rem)]" />
            <div className="relative flex items-center justify-between gap-5">
              <div>
                <div className="mb-3 flex items-center gap-2 text-dashboard-accent-light">
                  <Sparkles size={16} />
                  <p className="text-xs font-bold uppercase tracking-[0.16em]">Faturamento hoje</p>
                </div>
                <p className="text-4xl font-bold tracking-tight tabular-nums sm:text-5xl">{formatarMoeda(faturamentoHoje)}</p>
                <p className="mt-3 flex items-center gap-1.5 text-sm text-muted">
                  <ArrowUpRight size={16} className="text-success" /> Resultado dos atendimentos concluídos hoje
                </p>
              </div>
              <div className="hidden h-20 w-20 items-center justify-center rounded-3xl border border-dashboard-accent/25 bg-dashboard-accent/10 text-dashboard-accent-light sm:flex">
                <WalletCards size={34} />
              </div>
            </div>
          </div>

          <div className="card-elevated rounded-2xl border border-border-subtle bg-surface p-5 lg:col-span-6">
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-success/10 text-success"><CircleDollarSign size={24} /></div>
              <div>
                <p className="text-sm text-muted">Faturamento no mês</p>
                <p className="mt-1 text-2xl font-bold tabular-nums">{formatarMoeda(faturamentoMes)}</p>
              </div>
            </div>
          </div>
          <div className="card-elevated rounded-2xl border border-border-subtle bg-surface p-5 lg:col-span-6">
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-dashboard-accent/10 text-dashboard-accent-light"><TrendingUp size={24} /></div>
              <div>
                <p className="text-sm text-muted">Ticket médio</p>
                <p className="mt-1 text-2xl font-bold tabular-nums">{formatarMoeda(ticketMedio)}</p>
              </div>
            </div>
          </div>

          <div className="card-elevated rounded-3xl border border-border-subtle bg-surface p-5 sm:p-6 lg:col-span-7">
            <div className="mb-5 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
              <TrendingUp size={16} className="text-dashboard-accent-light" />
                <p className="font-semibold">Faturamento dos últimos 7 dias</p>
              </div>
              <span className="rounded-full bg-dashboard-accent/10 px-3 py-1 text-xs font-medium text-dashboard-accent-light">7 dias</span>
            </div>
            <div className="relative h-56 w-full">
              <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="h-44 w-full overflow-visible" aria-label="Gráfico de faturamento dos últimos 7 dias">
                <defs>
                  <linearGradient id="dashboard-area" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--dashboard-accent)" stopOpacity="0.34" />
                    <stop offset="100%" stopColor="var(--dashboard-accent)" stopOpacity="0" />
                  </linearGradient>
                </defs>
                {[20, 42, 64, 86].map((y) => <line key={y} x1="0" x2="100" y1={y} y2={y} stroke="var(--border-subtle)" strokeWidth="0.35" />)}
                {areaGrafico && <polygon points={areaGrafico} fill="url(#dashboard-area)" />}
                {linhaGrafico && <polyline points={linhaGrafico} fill="none" stroke="var(--dashboard-accent-light)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />}
                {pontosGrafico.map((p, i) => <circle key={i} cx={p.x} cy={p.y} r={p.ehHoje ? 2.2 : 1.5} fill="var(--surface)" stroke="var(--dashboard-accent-light)" strokeWidth="0.9" vectorEffect="non-scaling-stroke" />)}
              </svg>
              <div className="absolute inset-x-0 bottom-0 flex justify-between">
                {receita7Dias.map((p, i) => <span key={i} className={`text-xs ${p.ehHoje ? "font-bold text-dashboard-accent-light" : "text-muted"}`}>{p.label}</span>)}
              </div>
            </div>
          </div>

          <div className="card-elevated rounded-3xl border border-border-subtle bg-surface p-5 sm:p-6 lg:col-span-5">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <CalendarClock size={17} className="text-dashboard-accent-light" />
                <p className="font-semibold">Hoje <span className="text-dashboard-accent-light">({agendamentosHoje.length})</span></p>
              </div>
              <Link href="/agenda" className="flex items-center gap-1 text-xs font-semibold text-dashboard-accent-light hover:underline">Ver agenda <ChevronRight size={14} /></Link>
            </div>
            {agendamentosHoje.length === 0 ? (
              <p className="text-sm text-muted">Nenhum agendamento hoje.</p>
            ) : (
              <div className="relative flex max-h-64 flex-col overflow-y-auto pl-5 before:absolute before:bottom-3 before:left-[5px] before:top-3 before:w-px before:bg-dashboard-accent/30">
                {agendamentosHoje.map((a) => (
                  <div key={a.id} className="relative flex items-center gap-3 border-b border-border-subtle py-3 last:border-0 before:absolute before:-left-5 before:h-2.5 before:w-2.5 before:rounded-full before:bg-dashboard-accent before:shadow-[0_0_10px_var(--dashboard-accent)]">
                    <span className="w-12 shrink-0 text-sm font-bold tabular-nums text-dashboard-accent-light">{a.horario}</span>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{a.nomeCliente}</p>
                      <p className="truncate text-xs text-muted">{a.nomesServicos}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {mostrarTopProfissionais && <div className="card-elevated rounded-3xl border border-border-subtle bg-surface p-5 sm:p-6 lg:col-span-6">
              <div className="mb-5 flex items-center gap-2">
                <Trophy size={16} className="text-dashboard-accent-light" />
                <p className="font-semibold">Top profissionais <span className="font-normal text-muted">(mês)</span></p>
              </div>
              {topProfissionais.length === 0 ? (
                <p className="text-sm text-muted">Sem dados ainda.</p>
              ) : (
                <div className="flex flex-col gap-4">
                  {topProfissionais.map((p, i) => {
                    return (
                      <div key={i} className="grid grid-cols-[24px_40px_minmax(0,1fr)] items-center gap-3">
                        <span className="text-center text-sm font-bold text-dashboard-accent-light">{i + 1}</span>
                        <Avatar nome={p.nome} fotoUrl={p.fotoUrl} className="h-9 w-9 text-xs" />
                        <div className="min-w-0 flex-1">
                          <div className="flex min-w-0 items-center justify-between gap-2">
                            <p className="truncate text-sm font-medium">{p.nome}</p>
                            <span className="shrink-0 text-xs font-semibold tabular-nums text-dashboard-accent-light sm:text-sm">{formatarMoeda(p.faturamento)}</span>
                          </div>
                          <p className="text-xs text-muted">{p.atendimentos} atendimento(s)</p>
                          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-surface-alt"><div className="h-full rounded-full bg-gradient-to-r from-dashboard-accent to-[#ec4899]" style={{ width: `${Math.max(8, (p.faturamento / maiorFaturamentoProfissional) * 100)}%` }} /></div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>}

          <div className={`card-elevated rounded-3xl border border-border-subtle bg-surface p-5 sm:p-6 ${mostrarTopProfissionais ? "lg:col-span-6" : "lg:col-span-12"}`}>
            <div className="mb-5 flex items-center gap-2"><Scissors size={17} className="text-dashboard-accent-light" /><p className="font-semibold">Top serviços <span className="font-normal text-muted">(mês)</span></p></div>
            {topServicos.length === 0 ? <p className="text-sm text-muted">Sem dados ainda.</p> : <div className="flex flex-col gap-4">
              {topServicos.map((servico, i) => <div key={servico.nome} className="grid grid-cols-[24px_minmax(0,1fr)] items-center gap-3">
                <span className="text-center text-sm font-bold text-dashboard-accent-light">{i + 1}</span>
                <div className="min-w-0"><div className="flex min-w-0 items-center justify-between gap-2"><p className="truncate text-sm font-medium">{servico.nome}</p><span className="shrink-0 text-xs font-semibold tabular-nums text-dashboard-accent-light sm:text-sm">{formatarMoeda(servico.faturamento)}</span></div><p className="text-xs text-muted">{servico.quantidade}x realizado</p><div className="mt-2 h-1.5 overflow-hidden rounded-full bg-surface-alt"><div className="h-full rounded-full bg-gradient-to-r from-[#ec4899] to-dashboard-accent" style={{ width: `${Math.max(8, (servico.faturamento / maiorFaturamentoServico) * 100)}%` }} /></div></div>
              </div>)}
            </div>}
          </div>

          <div className="flex items-center justify-center gap-2 rounded-2xl border border-border-subtle bg-surface/70 px-4 py-3 text-xs text-muted lg:col-span-12"><Clock3 size={14} /> Dados atualizados a partir dos atendimentos concluídos</div>
        </div>
      )}
    </div>
  );
}
