"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { RelatorioHeader, PeriodoChips } from "@/components/RelatorioHeader";
import { profissionaisVisiveisFinanceiro } from "@/lib/permissoes";
import { listarAgendamentoServicos, listarAgendamentos } from "@/lib/repositories";
import { converterIsoParaMillis, formatarMoeda, intervaloPeriodoRapido, PeriodoRapido } from "@/lib/datetime";

interface Linha {
  nomeServico: string;
  quantidade: number;
  receitaTotal: number;
}

export default function HistoricoServicosPage() {
  const { perfil } = useAuth();
  const [periodo, setPeriodo] = useState<PeriodoRapido>("ESTE_MES");
  const [linhas, setLinhas] = useState<Linha[]>([]);
  const [totalServicos, setTotalServicos] = useState(0);
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    if (!perfil) return;
    carregar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [perfil?.id, periodo]);

  async function carregar() {
    if (!perfil) return;
    setCarregando(true);
    try {
      const [agendamentos, itens, permitidos] = await Promise.all([
        listarAgendamentos(perfil.salao_id),
        listarAgendamentoServicos(perfil.salao_id),
        profissionaisVisiveisFinanceiro(perfil),
      ]);

      const [inicio, fim] = intervaloPeriodoRapido(periodo);
      const idsConcluidos = new Set(
        agendamentos
          .filter(
            (a) =>
              a.status === "CONCLUIDO" &&
              converterIsoParaMillis(a.data_hora) >= inicio &&
              converterIsoParaMillis(a.data_hora) <= fim &&
              (permitidos === null || (a.profissional_id !== null && permitidos.includes(a.profissional_id)))
          )
          .map((a) => a.id)
      );
      const itensDoPeriodo = itens.filter((i) => idsConcluidos.has(i.agendamento_id));
      setTotalServicos(itensDoPeriodo.length);

      const porServico = new Map<string, Linha>();
      itensDoPeriodo.forEach((i) => {
        const atual = porServico.get(i.nome_servico) ?? { nomeServico: i.nome_servico, quantidade: 0, receitaTotal: 0 };
        atual.quantidade += 1;
        atual.receitaTotal += i.preco;
        porServico.set(i.nome_servico, atual);
      });

      setLinhas(Array.from(porServico.values()).sort((a, b) => b.receitaTotal - a.receitaTotal));
    } finally {
      setCarregando(false);
    }
  }

  return (
    <div className="mx-auto max-w-3xl p-5 md:p-8">
      <RelatorioHeader titulo="Histórico de Serviços" />
      <PeriodoChips periodo={periodo} onMudar={setPeriodo} />

      <div className="card-elevated mb-4 rounded-2xl bg-surface p-4">
        <p className="text-sm text-muted">Total de serviços prestados</p>
        <p className="text-2xl font-semibold tabular-nums">{totalServicos}</p>
      </div>

      {carregando ? (
        <div className="flex flex-col gap-2">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-14 animate-pulse rounded-xl bg-surface" />
          ))}
        </div>
      ) : linhas.length === 0 ? (
        <p className="text-center text-sm text-muted">Nenhum dado nesse período.</p>
      ) : (
        <div className="flex flex-col gap-2">
          {linhas.map((l, i) => (
            <div key={i} className="card-elevated flex items-center justify-between rounded-xl bg-surface p-4">
              <div>
                <p className="font-medium">{l.nomeServico}</p>
                <p className="text-sm text-muted">{l.quantidade} atendimento(s)</p>
              </div>
              <span className="font-medium tabular-nums text-accent">{formatarMoeda(l.receitaTotal)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
