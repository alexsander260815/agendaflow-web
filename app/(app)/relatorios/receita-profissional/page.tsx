"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { RelatorioHeader, PeriodoChips } from "@/components/RelatorioHeader";
import { carregarReceitas, ReceitaPorProfissional } from "@/lib/relatorios";
import { corAvatar, iniciais } from "@/lib/avatar";
import { formatarMoeda, PeriodoRapido } from "@/lib/datetime";

export default function ReceitaPorProfissionalPage() {
  const { perfil } = useAuth();
  const [periodo, setPeriodo] = useState<PeriodoRapido>("ESTE_MES");
  const [linhas, setLinhas] = useState<ReceitaPorProfissional[]>([]);
  const [total, setTotal] = useState(0);
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    if (!perfil) return;
    setCarregando(true);
    carregarReceitas(perfil, periodo)
      .then((d) => {
        setLinhas(d.porProfissional);
        setTotal(d.receitaTotal);
      })
      .finally(() => setCarregando(false));
  }, [perfil, periodo]);

  return (
    <div className="mx-auto max-w-3xl p-5 md:p-8">
      <RelatorioHeader titulo="Receita por Profissional" />
      <PeriodoChips periodo={periodo} onMudar={setPeriodo} />

      <div className="card-elevated gradient-accent mb-4 rounded-2xl border border-accent/15 bg-surface p-5">
        <p className="text-xs font-semibold uppercase tracking-wide text-accent">Receita total</p>
        <p className="text-3xl font-bold tabular-nums">{formatarMoeda(total)}</p>
      </div>

      {carregando ? (
        <div className="flex flex-col gap-2">
          {[0, 1].map((i) => (
            <div key={i} className="h-16 animate-pulse rounded-xl bg-surface" />
          ))}
        </div>
      ) : linhas.length === 0 ? (
        <p className="text-center text-sm text-muted">Nenhum dado nesse período.</p>
      ) : (
        <div className="flex flex-col gap-2">
          {linhas.map((l, i) => {
            const avatar = corAvatar(l.nomeProfissional);
            return (
              <div key={i} className="card-elevated flex items-center gap-3 rounded-xl bg-surface p-4">
                <div
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-semibold"
                  style={{ background: avatar.bg, color: avatar.fg }}
                >
                  {iniciais(l.nomeProfissional)}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{l.nomeProfissional}</p>
                  <p className="text-sm text-muted">{l.quantidade} atendimento(s)</p>
                </div>
                <span className="font-medium tabular-nums text-accent">{formatarMoeda(l.receitaTotal)}</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
