"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { RelatorioHeader, PeriodoChips } from "@/components/RelatorioHeader";
import { carregarReceitas, ReceitaPorServico } from "@/lib/relatorios";
import { formatarMoeda, PeriodoRapido } from "@/lib/datetime";

export default function ReceitaPorServicoPage() {
  const { perfil } = useAuth();
  const [periodo, setPeriodo] = useState<PeriodoRapido>("ESTE_MES");
  const [linhas, setLinhas] = useState<ReceitaPorServico[]>([]);
  const [total, setTotal] = useState(0);
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    if (!perfil) return;
    setCarregando(true);
    carregarReceitas(perfil, periodo)
      .then((d) => {
        setLinhas(d.porServico);
        setTotal(d.receitaTotal);
      })
      .finally(() => setCarregando(false));
  }, [perfil, periodo]);

  return (
    <div className="mx-auto max-w-3xl p-5 md:p-8">
      <RelatorioHeader titulo="Receita por Serviço" />
      <PeriodoChips periodo={periodo} onMudar={setPeriodo} />

      <div className="card-elevated gradient-accent mb-4 rounded-2xl border border-accent/15 bg-surface p-5">
        <p className="text-xs font-semibold uppercase tracking-wide text-accent">Receita total</p>
        <p className="text-3xl font-bold tabular-nums">{formatarMoeda(total)}</p>
      </div>

      {carregando ? (
        <div className="flex flex-col gap-2">
          {[0, 1].map((i) => (
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
                <p className="text-sm text-muted">{l.quantidade}x</p>
              </div>
              <span className="font-medium tabular-nums text-accent">{formatarMoeda(l.receitaTotal)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
