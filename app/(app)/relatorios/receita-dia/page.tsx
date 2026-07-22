"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { RelatorioHeader, PeriodoChips } from "@/components/RelatorioHeader";
import { carregarReceitas, ReceitaPorDia } from "@/lib/relatorios";
import { formatarMoeda, PeriodoRapido } from "@/lib/datetime";

export default function ReceitaPorDiaPage() {
  const { perfil } = useAuth();
  const [periodo, setPeriodo] = useState<PeriodoRapido>("ESTE_MES");
  const [linhas, setLinhas] = useState<ReceitaPorDia[]>([]);
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    if (!perfil) return;
    setCarregando(true);
    carregarReceitas(perfil, periodo)
      .then((d) => setLinhas(d.porDia))
      .finally(() => setCarregando(false));
  }, [perfil, periodo]);

  const comDados = linhas.filter((l) => l.quantidade > 0);
  const melhorDia = comDados.length ? comDados.reduce((a, b) => (b.receitaTotal > a.receitaTotal ? b : a)) : null;
  const piorDia = comDados.length ? comDados.reduce((a, b) => (b.receitaTotal < a.receitaTotal ? b : a)) : null;
  const maiorValor = Math.max(1, ...linhas.map((l) => l.receitaTotal));

  return (
    <div className="mx-auto max-w-3xl p-5 md:p-8">
      <RelatorioHeader titulo="Receita por Dia" />
      <PeriodoChips periodo={periodo} onMudar={setPeriodo} />

      {carregando ? (
        <div className="h-40 animate-pulse rounded-2xl bg-surface" />
      ) : (
        <>
          {melhorDia && piorDia && (
            <div className="card-elevated mb-4 flex justify-between rounded-2xl bg-surface p-4 text-sm">
              <span>
                Melhor dia: <span className="font-medium text-accent">{melhorDia.label}</span>
              </span>
              <span>
                Pior dia: <span className="font-medium text-muted">{piorDia.label}</span>
              </span>
            </div>
          )}
          <div className="flex flex-col gap-2">
            {linhas.map((l, i) => (
              <div key={i} className="card-elevated rounded-xl bg-surface p-4">
                <div className="mb-2 flex items-center justify-between">
                  <span className="font-medium">{l.label}</span>
                  <span className="text-sm tabular-nums text-accent">{formatarMoeda(l.receitaTotal)}</span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-surface-alt">
                  <div
                    className="h-full rounded-full bg-accent transition-all"
                    style={{ width: `${(l.receitaTotal / maiorValor) * 100}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
