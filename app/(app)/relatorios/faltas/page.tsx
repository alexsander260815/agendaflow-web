"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { RelatorioHeader } from "@/components/RelatorioHeader";
import { profissionaisVisiveisFinanceiro } from "@/lib/permissoes";
import { listarAgendamentoServicos, listarAgendamentos } from "@/lib/repositories";
import { converterIsoParaMillis, formatarMoeda, janelaUltimosDias } from "@/lib/datetime";

export default function RelatorioFaltasPage() {
  const { perfil } = useAuth();
  const [carregando, setCarregando] = useState(true);
  const [totalAgendamentos, setTotalAgendamentos] = useState(0);
  const [finalizados, setFinalizados] = useState(0);
  const [faltas, setFaltas] = useState(0);
  const [receitaPerdida, setReceitaPerdida] = useState(0);

  useEffect(() => {
    if (!perfil) return;
    carregar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [perfil?.id]);

  async function carregar() {
    if (!perfil) return;
    setCarregando(true);
    try {
      const [agendamentos, itens, permitidos] = await Promise.all([
        listarAgendamentos(perfil.salao_id),
        listarAgendamentoServicos(perfil.salao_id),
        profissionaisVisiveisFinanceiro(perfil),
      ]);
      const [inicio, fim] = janelaUltimosDias(30);
      const doPeriodo = agendamentos.filter((a) => {
        const m = converterIsoParaMillis(a.data_hora);
        const permitido = permitidos === null || (a.profissional_id !== null && permitidos.includes(a.profissional_id));
        return m >= inicio && m <= fim && permitido;
      });

      const faltasLista = doPeriodo.filter((a) => a.status === "FALTOU");
      const idsFaltas = new Set(faltasLista.map((a) => a.id));
      const receitaPerdidaCalc = itens.filter((i) => idsFaltas.has(i.agendamento_id)).reduce((s, i) => s + i.preco, 0);

      setTotalAgendamentos(doPeriodo.length);
      setFinalizados(doPeriodo.filter((a) => a.status === "CONCLUIDO").length);
      setFaltas(faltasLista.length);
      setReceitaPerdida(receitaPerdidaCalc);
    } finally {
      setCarregando(false);
    }
  }

  const taxaFaltas = totalAgendamentos > 0 ? (faltas / totalAgendamentos) * 100 : 0;

  const metricas = [
    { label: "Total de agendamentos", valor: totalAgendamentos },
    { label: "Finalizados", valor: finalizados },
    { label: "Faltas", valor: faltas },
    { label: "Taxa de faltas", valor: `${taxaFaltas.toFixed(1)}%` },
    { label: "Receita perdida estimada", valor: formatarMoeda(receitaPerdida) },
  ];

  return (
    <div className="mx-auto max-w-3xl p-5 md:p-8">
      <RelatorioHeader titulo="Relatório de Faltas" />
      <p className="mb-5 text-sm text-muted">Últimos 30 dias</p>

      {carregando ? (
        <div className="grid grid-cols-2 gap-3">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="h-24 animate-pulse rounded-xl bg-surface" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          {metricas.map((m, i) => (
            <div
              key={i}
              className={`card-elevated rounded-2xl bg-surface p-4 ${i === metricas.length - 1 ? "col-span-2" : ""}`}
            >
              <p className="text-sm text-muted">{m.label}</p>
              <p className="mt-1 text-2xl font-semibold tabular-nums">{m.valor}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
