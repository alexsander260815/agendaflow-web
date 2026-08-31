"use client";

import { useState } from "react";
import { Plus, X } from "lucide-react";
import { HorarioFuncionamento } from "@/lib/types";

const DIAS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

export default function HorariosFuncionamento({
  horarios,
  onAdicionar,
  onRemover,
  textoVazio = "Nenhum horário cadastrado ainda.",
}: {
  horarios: HorarioFuncionamento[];
  onAdicionar: (dias: number[], abertura: string, fechamento: string) => void;
  onRemover: (id: string) => void;
  textoVazio?: string;
}) {
  const [mostrarNovo, setMostrarNovo] = useState(false);

  return (
    <div className="flex flex-col gap-2">
      {horarios.length === 0 ? (
        <p className="text-sm text-muted">{textoVazio}</p>
      ) : (
        <div className="flex flex-col gap-2">
          {horarios.map((h) => (
            <div key={h.id} className="card-elevated flex items-center justify-between rounded-xl bg-surface p-3.5">
              <div>
                <p className="text-sm font-medium">{h.dias.map((d) => DIAS[d]).join(", ")}</p>
                <p className="text-xs text-muted">
                  {h.abertura} — {h.fechamento}
                </p>
              </div>
              <button
                onClick={() => onRemover(h.id)}
                className="rounded-lg p-1.5 text-muted transition-colors hover:bg-danger/10 hover:text-danger"
              >
                <X size={16} />
              </button>
            </div>
          ))}
        </div>
      )}

      <button
        onClick={() => setMostrarNovo(true)}
        className="flex items-center justify-center gap-1.5 rounded-xl border border-border-subtle px-4 py-2.5 text-sm transition-colors hover:bg-surface"
      >
        <Plus size={15} /> Adicionar horário
      </button>

      {mostrarNovo && (
        <NovoHorarioModal
          onFechar={() => setMostrarNovo(false)}
          onSalvar={(dias, abertura, fechamento) => {
            onAdicionar(dias, abertura, fechamento);
            setMostrarNovo(false);
          }}
        />
      )}
    </div>
  );
}

function NovoHorarioModal({
  onFechar,
  onSalvar,
}: {
  onFechar: () => void;
  onSalvar: (dias: number[], abertura: string, fechamento: string) => void;
}) {
  const [diasSelecionados, setDiasSelecionados] = useState<number[]>([]);
  const [abertura, setAbertura] = useState("09:00");
  const [fechamento, setFechamento] = useState("18:00");

  function alternarDia(dia: number) {
    setDiasSelecionados((atual) => (atual.includes(dia) ? atual.filter((d) => d !== dia) : [...atual, dia]));
  }

  return (
    <div className="fixed inset-0 z-30 flex items-center justify-center bg-black/60 p-5 backdrop-blur-sm">
      <div className="card-elevated w-full max-w-sm rounded-2xl bg-surface p-5">
        <div className="mb-4 flex items-center justify-between">
          <p className="font-medium">Adicionar horário</p>
          <button onClick={onFechar} className="text-muted hover:text-foreground">
            <X size={18} />
          </button>
        </div>
        <div className="mb-3 flex flex-wrap gap-1.5">
          {DIAS.map((d, i) => (
            <button
              key={i}
              onClick={() => alternarDia(i)}
              className={`rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
                diasSelecionados.includes(i) ? "bg-accent text-accent-foreground" : "bg-surface-alt text-muted"
              }`}
            >
              {d}
            </button>
          ))}
        </div>
        <div className="flex gap-2">
          <input
            type="time"
            value={abertura}
            onChange={(e) => setAbertura(e.target.value)}
            className="flex-1 rounded-xl border border-border-subtle bg-background px-3 py-2.5 text-sm outline-none focus:border-accent [color-scheme:dark]"
          />
          <input
            type="time"
            value={fechamento}
            onChange={(e) => setFechamento(e.target.value)}
            className="flex-1 rounded-xl border border-border-subtle bg-background px-3 py-2.5 text-sm outline-none focus:border-accent [color-scheme:dark]"
          />
        </div>
        <button
          onClick={() => diasSelecionados.length > 0 && onSalvar(diasSelecionados, abertura, fechamento)}
          className="mt-4 w-full rounded-xl bg-accent px-4 py-3 text-sm font-medium text-accent-foreground transition-opacity hover:opacity-90"
        >
          Salvar
        </button>
      </div>
    </div>
  );
}
