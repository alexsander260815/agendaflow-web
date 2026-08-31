"use client";

import { Download, Printer } from "lucide-react";
import { exportarCsv, type ColunaExportacao } from "@/lib/exportar";

export default function BotoesExportar({
  nomeArquivo,
  colunas,
  linhas,
}: {
  nomeArquivo: string;
  colunas: ColunaExportacao[];
  linhas: unknown[];
}) {
  return (
    <div className="mb-4 flex gap-2 print:hidden">
      <button
        onClick={() => exportarCsv(nomeArquivo, colunas, linhas)}
        disabled={linhas.length === 0}
        className="flex items-center gap-1.5 rounded-xl border border-border-subtle px-3 py-2 text-xs font-medium transition-colors hover:bg-surface-alt disabled:opacity-50"
      >
        <Download size={14} /> Exportar CSV
      </button>
      <button
        onClick={() => window.print()}
        disabled={linhas.length === 0}
        className="flex items-center gap-1.5 rounded-xl border border-border-subtle px-3 py-2 text-xs font-medium transition-colors hover:bg-surface-alt disabled:opacity-50"
      >
        <Printer size={14} /> Imprimir / PDF
      </button>
    </div>
  );
}
