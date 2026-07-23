"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { RelatorioHeader, PeriodoChips } from "@/components/RelatorioHeader";
import { profissionaisVisiveisFinanceiro } from "@/lib/permissoes";
import { listarAgendamentoServicos, listarAgendamentos, listarEquipe } from "@/lib/repositories";
import { converterIsoParaMillis, formatarMoeda, intervaloPeriodoRapido, PeriodoRapido } from "@/lib/datetime";

interface Linha {
  nomeServico: string;
  quantidade: number;
  receitaTotal: number;
}

interface GrupoProfissional {
  nomeProfissional: string;
  receitaTotal: number;
  servicos: Linha[];
}

export default function HistoricoServicosPage() {
  const { perfil } = useAuth();
  const [periodo, setPeriodo] = useState<PeriodoRapido>("ESTE_MES");
  const [linhas, setLinhas] = useState<Linha[]>([]);
  const [porProfissional, setPorProfissional] = useState<GrupoProfissional[]>([]);
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
      const [agendamentos, itens, equipe, permitidos] = await Promise.all([
        listarAgendamentos(perfil.salao_id),
        listarAgendamentoServicos(perfil.salao_id),
        listarEquipe(perfil.salao_id),
        profissionaisVisiveisFinanceiro(perfil),
      ]);
      const equipeMap = new Map(equipe.map((p) => [p.id, p.nome]));

      const [inicio, fim] = intervaloPeriodoRapido(periodo);
      const concluidosNoPeriodo = agendamentos.filter(
        (a) =>
          a.status === "CONCLUIDO" &&
          converterIsoParaMillis(a.data_hora) >= inicio &&
          converterIsoParaMillis(a.data_hora) <= fim &&
          (permitidos === null || (a.profissional_id !== null && permitidos.includes(a.profissional_id)))
      );
      const profissionalPorAgendamento = new Map(concluidosNoPeriodo.map((a) => [a.id, a.profissional_id]));
      const idsConcluidos = new Set(concluidosNoPeriodo.map((a) => a.id));
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

      const porProfissionalMap = new Map<string, Map<string, Linha>>();
      itensDoPeriodo.forEach((i) => {
        const profissionalId = profissionalPorAgendamento.get(i.agendamento_id);
        if (!profissionalId) return;
        const nomeProfissional = equipeMap.get(profissionalId) ?? "Não atribuído";
        const servicosDoProf = porProfissionalMap.get(nomeProfissional) ?? new Map<string, Linha>();
        const atual = servicosDoProf.get(i.nome_servico) ?? { nomeServico: i.nome_servico, quantidade: 0, receitaTotal: 0 };
        atual.quantidade += 1;
        atual.receitaTotal += i.preco;
        servicosDoProf.set(i.nome_servico, atual);
        porProfissionalMap.set(nomeProfissional, servicosDoProf);
      });

      const porProfissionalCalc: GrupoProfissional[] = Array.from(porProfissionalMap.entries())
        .map(([nomeProfissional, servicosMap]) => {
          const servicos = Array.from(servicosMap.values()).sort((a, b) => b.receitaTotal - a.receitaTotal);
          return {
            nomeProfissional,
            servicos,
            receitaTotal: servicos.reduce((soma, s) => soma + s.receitaTotal, 0),
          };
        })
        .sort((a, b) => b.receitaTotal - a.receitaTotal);
      setPorProfissional(porProfissionalCalc);
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
      ) : porProfissional.length > 1 ? (
        <div className="flex flex-col gap-2">
          {porProfissional.map((grupo) => (
            <div key={grupo.nomeProfissional} className="flex flex-col gap-2">
              <div className="mt-2 flex items-center justify-between">
                <p className="text-sm font-medium">{grupo.nomeProfissional}</p>
                <p className="text-sm font-medium">{formatarMoeda(grupo.receitaTotal)}</p>
              </div>
              {grupo.servicos.map((l, i) => (
                <div key={i} className="card-elevated flex items-center justify-between rounded-xl bg-surface p-4">
                  <div>
                    <p className="font-medium">{l.nomeServico}</p>
                    <p className="text-sm text-muted">{l.quantidade} atendimento(s)</p>
                  </div>
                  <span className="font-medium tabular-nums text-accent">{formatarMoeda(l.receitaTotal)}</span>
                </div>
              ))}
            </div>
          ))}
        </div>
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
