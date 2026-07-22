"use client";

import { useEffect, useState } from "react";
import { ChevronDown, Wallet } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { listarAgendamentoServicos, listarAgendamentos, listarEquipe } from "@/lib/repositories";
import { profissionaisVisiveisFinanceiro } from "@/lib/permissoes";
import { corAvatar, iniciais } from "@/lib/avatar";
import { Agendamento, AgendamentoServico } from "@/lib/types";
import { converterIsoParaMillis, formatarMoeda } from "@/lib/datetime";

type Periodo = "HOJE" | "SEMANA" | "MES";

interface DetalheServico {
  nomeServico: string;
  quantidade: number;
  total: number;
}

interface DetalhePagamento {
  formaPagamento: string;
  total: number;
}

interface ResumoPorProfissional {
  nomeProfissional: string;
  quantidadeAtendimentos: number;
  faturamentoTotal: number;
  porServico: DetalheServico[];
  porPagamento: DetalhePagamento[];
}

function calcularIntervalo(periodo: Periodo): [number, number] {
  const agora = new Date();
  if (periodo === "HOJE") {
    const inicio = new Date(agora);
    inicio.setHours(0, 0, 0, 0);
    const fim = new Date(agora);
    fim.setHours(23, 59, 59, 999);
    return [inicio.getTime(), fim.getTime()];
  }
  if (periodo === "SEMANA") {
    const inicio = new Date(agora);
    inicio.setDate(inicio.getDate() - inicio.getDay());
    inicio.setHours(0, 0, 0, 0);
    const fim = new Date(inicio);
    fim.setDate(fim.getDate() + 6);
    fim.setHours(23, 59, 59, 999);
    return [inicio.getTime(), fim.getTime()];
  }
  const inicio = new Date(agora.getFullYear(), agora.getMonth(), 1, 0, 0, 0, 0);
  const fim = new Date(agora.getFullYear(), agora.getMonth() + 1, 0, 23, 59, 59, 999);
  return [inicio.getTime(), fim.getTime()];
}

const LABEL_PAGAMENTO: Record<string, string> = {
  DINHEIRO: "Dinheiro",
  PIX: "Pix",
  CARTAO: "Cartão",
  NAO_INFORMADO: "Não informado",
};

export default function FinanceiroPage() {
  const { perfil } = useAuth();
  const [periodo, setPeriodo] = useState<Periodo>("MES");
  const [resumos, setResumos] = useState<ResumoPorProfissional[]>([]);
  const [total, setTotal] = useState(0);
  const [carregando, setCarregando] = useState(true);
  const [expandido, setExpandido] = useState<number | null>(null);

  useEffect(() => {
    if (!perfil) return;
    carregar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [perfil?.id, periodo]);

  async function carregar() {
    if (!perfil) return;
    setCarregando(true);
    try {
      const [todosAgendamentos, todosItens, equipe, permitidos] = await Promise.all([
        listarAgendamentos(perfil.salao_id),
        listarAgendamentoServicos(perfil.salao_id),
        listarEquipe(perfil.salao_id),
        profissionaisVisiveisFinanceiro(perfil),
      ]);

      const equipeMap = new Map(equipe.map((p) => [p.id, p.nome]));
      const itensPorAgendamento = new Map<string, AgendamentoServico[]>();
      todosItens.forEach((i) => {
        const lista = itensPorAgendamento.get(i.agendamento_id) ?? [];
        lista.push(i);
        itensPorAgendamento.set(i.agendamento_id, lista);
      });

      const [inicio, fim] = calcularIntervalo(periodo);

      let concluidos = todosAgendamentos.filter(
        (a) => a.status === "CONCLUIDO" && converterIsoParaMillis(a.data_hora) >= inicio && converterIsoParaMillis(a.data_hora) <= fim
      );

      if (permitidos !== null) {
        concluidos = concluidos.filter((a) => a.profissional_id !== null && permitidos.includes(a.profissional_id));
      }

      const porProfissional = new Map<string, Agendamento[]>();
      concluidos.forEach((a) => {
        const chave = a.profissional_id ?? "sem_profissional";
        const lista = porProfissional.get(chave) ?? [];
        lista.push(a);
        porProfissional.set(chave, lista);
      });

      const resumosCalculados: ResumoPorProfissional[] = Array.from(porProfissional.entries())
        .map(([profissionalId, lista]) => {
          const nome = profissionalId === "sem_profissional" ? "Não atribuído" : equipeMap.get(profissionalId) ?? "Não atribuído";
          const itensDoProfissional = lista.flatMap((a) => itensPorAgendamento.get(a.id) ?? []);
          const totalProfissional = itensDoProfissional.reduce((soma, i) => soma + i.preco, 0);

          const porServicoMap = new Map<string, DetalheServico>();
          itensDoProfissional.forEach((i) => {
            const atual = porServicoMap.get(i.nome_servico) ?? { nomeServico: i.nome_servico, quantidade: 0, total: 0 };
            atual.quantidade += 1;
            atual.total += i.preco;
            porServicoMap.set(i.nome_servico, atual);
          });

          const porPagamentoMap = new Map<string, number>();
          lista.forEach((a) => {
            const forma = a.forma_pagamento ?? "NAO_INFORMADO";
            const totalAg = (itensPorAgendamento.get(a.id) ?? []).reduce((soma, i) => soma + i.preco, 0);
            porPagamentoMap.set(forma, (porPagamentoMap.get(forma) ?? 0) + totalAg);
          });

          return {
            nomeProfissional: nome,
            quantidadeAtendimentos: lista.length,
            faturamentoTotal: totalProfissional,
            porServico: Array.from(porServicoMap.values()).sort((a, b) => b.total - a.total),
            porPagamento: Array.from(porPagamentoMap.entries())
              .map(([formaPagamento, total]) => ({ formaPagamento, total }))
              .sort((a, b) => b.total - a.total),
          };
        })
        .sort((a, b) => b.faturamentoTotal - a.faturamentoTotal);

      setResumos(resumosCalculados);
      setTotal(resumosCalculados.reduce((soma, r) => soma + r.faturamentoTotal, 0));
    } catch (e) {
      console.error(e);
      setResumos([]);
      setTotal(0);
    } finally {
      setCarregando(false);
    }
  }

  return (
    <div className="mx-auto max-w-3xl p-5 md:p-8">
      <h1 className="mb-5 text-2xl font-semibold tracking-tight">Financeiro</h1>

      <div className="mb-5 flex gap-1 rounded-xl bg-surface p-1">
        {(["HOJE", "SEMANA", "MES"] as const).map((p) => (
          <button
            key={p}
            onClick={() => setPeriodo(p)}
            className={`flex-1 rounded-lg py-2 text-sm font-medium transition-colors ${
              periodo === p ? "bg-accent text-accent-foreground" : "text-muted"
            }`}
          >
            {p === "HOJE" ? "Hoje" : p === "SEMANA" ? "Semana" : "Mês"}
          </button>
        ))}
      </div>

      <div className="card-elevated gradient-accent mb-4 rounded-2xl border border-accent/15 bg-surface p-5">
        <div className="mb-1 flex items-center gap-1.5 text-accent">
          <Wallet size={14} />
          <p className="text-xs font-semibold uppercase tracking-wide">Faturamento total</p>
        </div>
        <p className="text-3xl font-bold tabular-nums">{formatarMoeda(total)}</p>
      </div>

      {carregando ? (
        <div className="flex flex-col gap-2">
          {[0, 1].map((i) => (
            <div key={i} className="h-20 animate-pulse rounded-xl bg-surface" />
          ))}
        </div>
      ) : resumos.length === 0 ? (
        <div className="card-elevated flex flex-col items-center gap-2 rounded-2xl bg-surface p-10 text-center">
          <Wallet size={28} className="text-muted" />
          <p className="text-sm text-muted">Nenhum atendimento concluído nesse período.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {resumos.map((r, i) => {
            const avatar = corAvatar(r.nomeProfissional);
            const aberto = expandido === i;
            return (
              <div key={i} className="card-elevated rounded-xl bg-surface p-4">
                <button
                  onClick={() => setExpandido(aberto ? null : i)}
                  className="flex w-full items-center gap-3"
                >
                  <div
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-semibold"
                    style={{ background: avatar.bg, color: avatar.fg }}
                  >
                    {iniciais(r.nomeProfissional)}
                  </div>
                  <div className="min-w-0 flex-1 text-left">
                    <p className="truncate font-medium">{r.nomeProfissional}</p>
                    <p className="text-sm text-muted">{r.quantidadeAtendimentos} atendimento(s)</p>
                  </div>
                  <p className="font-semibold tabular-nums">{formatarMoeda(r.faturamentoTotal)}</p>
                  <ChevronDown
                    size={16}
                    className={`shrink-0 text-muted transition-transform ${aberto ? "rotate-180" : ""}`}
                  />
                </button>

                {aberto && (
                  <div className="mt-4 flex flex-col gap-4 border-t border-border-subtle pt-4">
                    <div>
                      <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted">Por serviço</p>
                      <div className="flex flex-col gap-1.5">
                        {r.porServico.map((s, j) => (
                          <div key={j} className="flex justify-between text-sm">
                            <span className="text-foreground/90">
                              {s.nomeServico} <span className="text-muted">({s.quantidade}x)</span>
                            </span>
                            <span className="tabular-nums">{formatarMoeda(s.total)}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                    <div>
                      <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted">Por pagamento</p>
                      <div className="flex flex-col gap-1.5">
                        {r.porPagamento.map((p, j) => (
                          <div key={j} className="flex justify-between text-sm">
                            <span className="text-foreground/90">{LABEL_PAGAMENTO[p.formaPagamento] ?? p.formaPagamento}</span>
                            <span className="tabular-nums">{formatarMoeda(p.total)}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
