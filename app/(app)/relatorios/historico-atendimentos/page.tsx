"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { RelatorioHeader, PeriodoChips } from "@/components/RelatorioHeader";
import { profissionaisVisiveisFinanceiro } from "@/lib/permissoes";
import { listarAgendamentoServicos, listarAgendamentos, listarClientes, listarEquipe } from "@/lib/repositories";
import { AgendamentoServico } from "@/lib/types";
import { converterIsoParaMillis, formatarDataHora, formatarMoeda, intervaloPeriodoRapido, PeriodoRapido } from "@/lib/datetime";

interface Linha {
  dataHoraMillis: number;
  nomeCliente: string;
  nomeProfissional: string;
  nomesServicos: string;
  valorTotal: number;
}

export default function HistoricoAtendimentosPage() {
  const { perfil } = useAuth();
  const [periodo, setPeriodo] = useState<PeriodoRapido>("ESTE_MES");
  const [linhas, setLinhas] = useState<Linha[]>([]);
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
      const [agendamentos, itens, clientes, equipe, permitidos] = await Promise.all([
        listarAgendamentos(perfil.salao_id),
        listarAgendamentoServicos(perfil.salao_id),
        listarClientes(perfil.salao_id),
        listarEquipe(perfil.salao_id),
        profissionaisVisiveisFinanceiro(perfil),
      ]);
      const clientesMap = new Map(clientes.map((c) => [c.id, c.nome]));
      const equipeMap = new Map(equipe.map((p) => [p.id, p.nome]));
      const itensPorAgendamento = new Map<string, AgendamentoServico[]>();
      itens.forEach((i) => {
        const lista = itensPorAgendamento.get(i.agendamento_id) ?? [];
        lista.push(i);
        itensPorAgendamento.set(i.agendamento_id, lista);
      });

      const [inicio, fim] = intervaloPeriodoRapido(periodo);
      const concluidos = agendamentos.filter(
        (a) =>
          a.status === "CONCLUIDO" &&
          converterIsoParaMillis(a.data_hora) >= inicio &&
          converterIsoParaMillis(a.data_hora) <= fim &&
          (permitidos === null || (a.profissional_id !== null && permitidos.includes(a.profissional_id)))
      );

      const resultado = concluidos
        .map((a) => {
          const itensDoAg = itensPorAgendamento.get(a.id) ?? [];
          return {
            dataHoraMillis: converterIsoParaMillis(a.data_hora),
            nomeCliente: clientesMap.get(a.cliente_id) ?? "Cliente desconhecido",
            nomeProfissional: a.profissional_id ? equipeMap.get(a.profissional_id) ?? "Não atribuído" : "Não atribuído",
            nomesServicos: itensDoAg.length ? itensDoAg.map((i) => i.nome_servico).join(", ") : "Sem serviços",
            valorTotal: itensDoAg.reduce((soma, i) => soma + i.preco, 0),
          };
        })
        .sort((a, b) => b.dataHoraMillis - a.dataHoraMillis);

      setLinhas(resultado);
    } finally {
      setCarregando(false);
    }
  }

  return (
    <div className="mx-auto max-w-3xl p-5 md:p-8">
      <RelatorioHeader titulo="Histórico de Atendimentos" />
      <PeriodoChips periodo={periodo} onMudar={setPeriodo} />

      <div className="card-elevated mb-4 rounded-2xl bg-surface p-4">
        <p className="text-sm text-muted">Total de atendimentos</p>
        <p className="text-2xl font-semibold tabular-nums">{linhas.length}</p>
      </div>

      {carregando ? (
        <div className="flex flex-col gap-2">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-16 animate-pulse rounded-xl bg-surface" />
          ))}
        </div>
      ) : linhas.length === 0 ? (
        <p className="text-center text-sm text-muted">Nenhum dado nesse período.</p>
      ) : (
        <div className="flex flex-col gap-2">
          {linhas.map((l, i) => (
            <div key={i} className="card-elevated rounded-xl bg-surface p-3.5">
              <div className="flex items-center justify-between">
                <span className="text-sm">{formatarDataHora(l.dataHoraMillis)}</span>
                <span className="text-sm font-medium text-accent">{formatarMoeda(l.valorTotal)}</span>
              </div>
              <p className="mt-0.5 text-sm font-medium">{l.nomeCliente}</p>
              <p className="text-xs text-muted">
                {l.nomeProfissional} · {l.nomesServicos}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
