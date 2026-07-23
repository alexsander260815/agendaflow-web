"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import {
  criarBloqueioAgenda,
  deletarBloqueioAgenda,
  listarBloqueiosAgenda,
  listarEquipe,
} from "@/lib/repositories";
import { formatarDataHora } from "@/lib/datetime";
import { BloqueioAgenda, Perfil } from "@/lib/types";

interface BloqueioItem extends BloqueioAgenda {
  nomeProfissional: string;
}

function dataLocalDeAmanha(): string {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  const ano = d.getFullYear();
  const mes = String(d.getMonth() + 1).padStart(2, "0");
  const dia = String(d.getDate()).padStart(2, "0");
  return `${ano}-${mes}-${dia}`;
}

export default function BloqueiosAgendaPage() {
  const { perfil } = useAuth();
  const souDono = perfil?.papel === "DONO";

  const [itens, setItens] = useState<BloqueioItem[]>([]);
  const [equipe, setEquipe] = useState<Perfil[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [mostrarForm, setMostrarForm] = useState(false);

  const [profissionalId, setProfissionalId] = useState("");
  const [data, setData] = useState(dataLocalDeAmanha());
  const [horaInicio, setHoraInicio] = useState("00:00");
  const [horaFim, setHoraFim] = useState("23:59");
  const [motivo, setMotivo] = useState("");
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    if (!perfil) return;
    carregar();
    if (!souDono) setProfissionalId(perfil.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [perfil?.id]);

  async function carregar() {
    if (!perfil) return;
    setCarregando(true);
    try {
      const [bloqueios, membros] = await Promise.all([
        listarBloqueiosAgenda(perfil.salao_id),
        listarEquipe(perfil.salao_id),
      ]);
      setEquipe(membros);
      const membrosMap = new Map(membros.map((m) => [m.id, m.nome]));
      const agora = Date.now();

      const resultado = bloqueios
        .filter((b) => new Date(b.data_fim).getTime() >= agora)
        .map((b) => ({ ...b, nomeProfissional: membrosMap.get(b.profissional_id) ?? "Profissional" }))
        .sort((a, b) => new Date(a.data_inicio).getTime() - new Date(b.data_inicio).getTime());

      setItens(resultado);
      if (souDono && !profissionalId && membros.length > 0) {
        setProfissionalId(membros.find((m) => m.atende_clientes)?.id ?? membros[0].id);
      }
    } finally {
      setCarregando(false);
    }
  }

  async function handleSalvar() {
    if (!perfil || !profissionalId || !motivo.trim()) return;
    setSalvando(true);
    try {
      const [ano, mes, dia] = data.split("-").map(Number);
      const [hInicio, mInicio] = horaInicio.split(":").map(Number);
      const [hFim, mFim] = horaFim.split(":").map(Number);
      const inicio = new Date(ano, mes - 1, dia, hInicio, mInicio, 0, 0);
      const fim = new Date(ano, mes - 1, dia, hFim, mFim, 59, 0);

      await criarBloqueioAgenda({
        salao_id: perfil.salao_id,
        profissional_id: profissionalId,
        data_inicio: inicio.toISOString(),
        data_fim: fim.toISOString(),
        motivo: motivo.trim(),
        criado_por: perfil.id,
      });

      setMotivo("");
      setMostrarForm(false);
      carregar();
    } finally {
      setSalvando(false);
    }
  }

  async function handleRemover(id: string) {
    await deletarBloqueioAgenda(id);
    carregar();
  }

  return (
    <div className="mx-auto max-w-2xl p-5 md:p-8">
      <div className="mb-5 flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">Bloqueios de Agenda</h1>
        <button
          onClick={() => setMostrarForm((v) => !v)}
          className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-accent-foreground transition-opacity hover:opacity-90"
        >
          {mostrarForm ? "Cancelar" : "Novo bloqueio"}
        </button>
      </div>

      {mostrarForm && (
        <div className="card-elevated mb-5 rounded-xl bg-surface p-4">
          {souDono && (
            <div className="mb-3">
              <label className="mb-1 block text-sm font-medium">Profissional</label>
              <select
                value={profissionalId}
                onChange={(e) => setProfissionalId(e.target.value)}
                className="w-full rounded-lg border border-border-subtle bg-transparent px-3 py-2 text-sm"
              >
                {equipe
                  .filter((p) => p.atende_clientes)
                  .map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.nome}
                    </option>
                  ))}
              </select>
            </div>
          )}

          <div className="mb-3">
            <label className="mb-1 block text-sm font-medium">Data</label>
            <input
              type="date"
              value={data}
              onChange={(e) => setData(e.target.value)}
              className="w-full rounded-lg border border-border-subtle bg-transparent px-3 py-2 text-sm"
            />
          </div>

          <div className="mb-3 flex gap-2">
            <div className="flex-1">
              <label className="mb-1 block text-sm font-medium">Das</label>
              <input
                type="time"
                value={horaInicio}
                onChange={(e) => setHoraInicio(e.target.value)}
                className="w-full rounded-lg border border-border-subtle bg-transparent px-3 py-2 text-sm"
              />
            </div>
            <div className="flex-1">
              <label className="mb-1 block text-sm font-medium">Até</label>
              <input
                type="time"
                value={horaFim}
                onChange={(e) => setHoraFim(e.target.value)}
                className="w-full rounded-lg border border-border-subtle bg-transparent px-3 py-2 text-sm"
              />
            </div>
          </div>

          <div className="mb-4">
            <label className="mb-1 block text-sm font-medium">Motivo</label>
            <input
              type="text"
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              placeholder="Ex: Consulta médica"
              className="w-full rounded-lg border border-border-subtle bg-transparent px-3 py-2 text-sm"
            />
          </div>

          <button
            onClick={handleSalvar}
            disabled={salvando || !profissionalId || !motivo.trim()}
            className="w-full rounded-lg bg-accent px-3 py-2 text-sm font-medium text-accent-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            Salvar
          </button>
        </div>
      )}

      {carregando ? (
        <div className="flex flex-col gap-2">
          {[0, 1].map((i) => (
            <div key={i} className="h-20 animate-pulse rounded-xl bg-surface" />
          ))}
        </div>
      ) : itens.length === 0 ? (
        <p className="text-sm text-muted">Nenhum bloqueio ativo.</p>
      ) : (
        <div className="flex flex-col gap-2">
          {itens.map((item) => (
            <div key={item.id} className="card-elevated flex items-center justify-between rounded-xl bg-surface p-4">
              <div>
                <p className="font-medium">{item.nomeProfissional}</p>
                <p className="text-sm text-muted">
                  {formatarDataHora(new Date(item.data_inicio).getTime())} até{" "}
                  {formatarDataHora(new Date(item.data_fim).getTime())}
                </p>
                <p className="text-sm text-muted">{item.motivo}</p>
              </div>
              <button
                onClick={() => handleRemover(item.id)}
                className="rounded-lg border border-border-subtle px-3 py-2 text-sm transition-colors hover:bg-surface-alt"
              >
                Remover
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
