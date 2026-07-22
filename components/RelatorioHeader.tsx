"use client";

import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { PeriodoRapido } from "@/lib/datetime";

export function RelatorioHeader({ titulo }: { titulo: string }) {
  return (
    <div className="mb-5 flex items-center gap-2">
      <Link href="/relatorios" className="rounded-lg p-1.5 text-muted transition-colors hover:bg-surface hover:text-foreground">
        <ChevronLeft size={20} />
      </Link>
      <h1 className="text-2xl font-semibold tracking-tight">{titulo}</h1>
    </div>
  );
}

const LABEL_PERIODO: Record<PeriodoRapido, string> = {
  ESTE_MES: "Este mês",
  ULTIMO_MES: "Último mês",
  ULTIMOS_7_DIAS: "Últimos 7 dias",
};

export function PeriodoChips({
  periodo,
  onMudar,
}: {
  periodo: PeriodoRapido;
  onMudar: (p: PeriodoRapido) => void;
}) {
  return (
    <div className="mb-5 flex gap-1 rounded-xl bg-surface p-1">
      {(Object.keys(LABEL_PERIODO) as PeriodoRapido[]).map((p) => (
        <button
          key={p}
          onClick={() => onMudar(p)}
          className={`flex-1 rounded-lg py-2 text-sm font-medium transition-colors ${
            periodo === p ? "bg-accent text-accent-foreground" : "text-muted"
          }`}
        >
          {LABEL_PERIODO[p]}
        </button>
      ))}
    </div>
  );
}
