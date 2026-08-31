"use client";

import { useEffect, useMemo, useState } from "react";
import { Check, Hourglass, MessageCircle, Plus, Trash2, User, X } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import {
  criarFilaEspera,
  atualizarStatusFilaEspera,
  deletarFilaEspera,
  listarFilaEspera,
  listarClientes,
  listarServicos,
} from "@/lib/repositories";
import { abrirWhatsApp } from "@/lib/whatsapp";
import { Cliente, FilaEspera, Servico } from "@/lib/types";

function formatarDataDesejada(iso: string): string {
  const [ano, mes, dia] = iso.split("-").map(Number);
  return new Date(ano, mes - 1, dia).toLocaleDateString("pt-BR", { day: "2-digit", month: "long", weekday: "short" });
}

export default function FilaEsperaPage() {
  const { perfil } = useAuth();
  const [itens, setItens] = useState<FilaEspera[]>([]);
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [servicos, setServicos] = useState<Servico[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [mostrarHistorico, setMostrarHistorico] = useState(false);
  const [mostrarNovo, setMostrarNovo] = useState(false);

  const [clienteId, setClienteId] = useState("");
  const [servicoId, setServicoId] = useState("");
  const [dataDesejada, setDataDesejada] = useState("");
  const [observacao, setObservacao] = useState("");
  const [salvando, setSalvando] = useState(false);

  function carregar() {
    if (!perfil) return;
    setCarregando(true);
    Promise.all([listarFilaEspera(perfil.salao_id), listarClientes(perfil.salao_id), listarServicos(perfil.salao_id)])
      .then(([f, c, s]) => {
        setItens(f);
        setClientes(c);
        setServicos(s);
      })
      .finally(() => setCarregando(false));
  }

  useEffect(carregar, [perfil?.id]);

  const clientesMap = useMemo(() => new Map(clientes.map((c) => [c.id, c])), [clientes]);
  const servicosMap = useMemo(() => new Map(servicos.map((s) => [s.id, s])), [servicos]);

  const ativos = itens.filter((i) => i.status === "ATIVO");
  const historico = itens.filter((i) => i.status !== "ATIVO");
  const listaExibida = mostrarHistorico ? historico : ativos;

  function limparFormulario() {
    setClienteId("");
    setServicoId("");
    setDataDesejada("");
    setObservacao("");
  }

  async function handleCriar() {
    if (!perfil || !clienteId || !dataDesejada) return;
    setSalvando(true);
    try {
      await criarFilaEspera({
        id: crypto.randomUUID(),
        salao_id: perfil.salao_id,
        cliente_id: clienteId,
        servico_id: servicoId || null,
        profissional_id: null,
        data_desejada: dataDesejada,
        observacao,
        status: "ATIVO",
      });
      limparFormulario();
      setMostrarNovo(false);
      carregar();
    } finally {
      setSalvando(false);
    }
  }

  async function handleNotificar(item: FilaEspera) {
    const cliente = clientesMap.get(item.cliente_id);
    if (!cliente) return;
    const nomeServico = item.servico_id ? servicosMap.get(item.servico_id)?.nome : null;
    const primeiroNome = cliente.nome.trim().split(" ")[0] ?? cliente.nome;
    const mensagem =
      `Oi ${primeiroNome}! Abriu uma vaga pro dia ${formatarDataDesejada(item.data_desejada)}` +
      `${nomeServico ? ` pra ${nomeServico}` : ""}, que era o que você estava esperando. Quer confirmar? 💜`;
    abrirWhatsApp(cliente.telefone, mensagem);
  }

  async function handleMudarStatus(item: FilaEspera, status: FilaEspera["status"]) {
    await atualizarStatusFilaEspera(item.id, status);
    carregar();
  }

  async function handleRemover(item: FilaEspera) {
    await deletarFilaEspera(item.id);
    carregar();
  }

  return (
    <div className="mx-auto max-w-2xl p-5 pb-16 md:p-8">
      <div className="mb-1 flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">Fila de Espera</h1>
        <button
          onClick={() => setMostrarNovo(true)}
          className="flex items-center gap-1.5 rounded-lg bg-accent px-3 py-2 text-xs font-medium text-accent-foreground transition-opacity hover:opacity-90"
        >
          <Plus size={14} /> Adicionar
        </button>
      </div>
      <p className="mb-5 text-sm text-muted">
        Cliente quis um dia que estava lotado? Anota aqui — quando abrir vaga, avisa pelo WhatsApp com um toque.
      </p>

      <div className="mb-5 flex gap-1 rounded-xl bg-surface p-1">
        <button
          onClick={() => setMostrarHistorico(false)}
          className={`flex-1 rounded-lg py-2 text-sm font-medium transition-colors ${!mostrarHistorico ? "bg-accent text-accent-foreground" : "text-muted"}`}
        >
          Ativos ({ativos.length})
        </button>
        <button
          onClick={() => setMostrarHistorico(true)}
          className={`flex-1 rounded-lg py-2 text-sm font-medium transition-colors ${mostrarHistorico ? "bg-accent text-accent-foreground" : "text-muted"}`}
        >
          Histórico
        </button>
      </div>

      {carregando ? (
        <div className="flex flex-col gap-2">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-20 animate-pulse rounded-xl bg-surface" />
          ))}
        </div>
      ) : listaExibida.length === 0 ? (
        <div className="card-elevated flex flex-col items-center gap-2 rounded-2xl bg-surface p-10 text-center">
          <Hourglass size={28} className="text-muted" />
          <p className="text-sm text-muted">
            {mostrarHistorico ? "Nenhum item no histórico ainda." : "Ninguém na fila de espera no momento."}
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {listaExibida.map((item) => {
            const cliente = clientesMap.get(item.cliente_id);
            const servico = item.servico_id ? servicosMap.get(item.servico_id) : null;
            return (
              <div key={item.id} className="card-elevated flex flex-col gap-2.5 rounded-xl bg-surface p-3.5">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-accent/12 text-accent">
                      <Hourglass size={16} />
                    </div>
                    <div>
                      <p className="font-medium">{cliente?.nome ?? "Cliente removido"}</p>
                      <p className="text-xs text-muted">
                        {formatarDataDesejada(item.data_desejada)}
                        {servico ? ` · ${servico.nome}` : ""}
                      </p>
                    </div>
                  </div>
                  {item.status !== "ATIVO" && (
                    <span
                      className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-medium ${item.status === "ATENDIDO" ? "bg-success/12 text-success" : "bg-danger/12 text-danger"}`}
                    >
                      {item.status === "ATENDIDO" ? "Atendido" : "Cancelado"}
                    </span>
                  )}
                </div>
                {item.observacao && <p className="text-sm text-muted">{item.observacao}</p>}
                {item.status === "ATIVO" && (
                  <div className="flex flex-wrap gap-2">
                    <button
                      onClick={() => handleNotificar(item)}
                      className="flex items-center gap-1.5 rounded-lg bg-accent px-3 py-2 text-xs font-medium text-accent-foreground transition-opacity hover:opacity-90"
                    >
                      <MessageCircle size={13} /> Avisar no WhatsApp
                    </button>
                    <button
                      onClick={() => handleMudarStatus(item, "ATENDIDO")}
                      className="flex items-center gap-1.5 rounded-lg border border-border-subtle px-3 py-2 text-xs transition-colors hover:bg-surface-alt"
                    >
                      <Check size={13} /> Marcar como atendido
                    </button>
                    <button
                      onClick={() => handleRemover(item)}
                      className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs text-danger transition-colors hover:bg-danger/10"
                    >
                      <Trash2 size={13} /> Remover
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {mostrarNovo && (
        <div className="fixed inset-0 z-30 flex items-center justify-center bg-black/60 p-5 backdrop-blur-sm">
          <div className="card-elevated w-full max-w-sm rounded-2xl bg-surface p-5">
            <div className="mb-3 flex items-center justify-between">
              <p className="font-medium">Adicionar à fila de espera</p>
              <button onClick={() => setMostrarNovo(false)} className="text-muted hover:text-foreground">
                <X size={18} />
              </button>
            </div>
            <div className="flex flex-col gap-3">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium uppercase tracking-wide text-muted">Cliente</label>
                <div className="flex items-center gap-2.5 rounded-xl border border-border-subtle bg-background px-3.5 py-2.5">
                  <User size={15} className="text-muted" />
                  <select
                    value={clienteId}
                    onChange={(e) => setClienteId(e.target.value)}
                    className="w-full bg-transparent text-sm outline-none"
                  >
                    <option value="" className="bg-surface">Escolher cliente</option>
                    {clientes.map((c) => (
                      <option key={c.id} value={c.id} className="bg-surface">{c.nome}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium uppercase tracking-wide text-muted">Serviço (opcional)</label>
                <select
                  value={servicoId}
                  onChange={(e) => setServicoId(e.target.value)}
                  className="w-full rounded-xl border border-border-subtle bg-background px-3.5 py-2.5 text-sm outline-none focus:border-accent"
                >
                  <option value="" className="bg-surface">Qualquer serviço</option>
                  {servicos.map((s) => (
                    <option key={s.id} value={s.id} className="bg-surface">{s.nome}</option>
                  ))}
                </select>
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium uppercase tracking-wide text-muted">Data desejada</label>
                <input
                  type="date"
                  value={dataDesejada}
                  onChange={(e) => setDataDesejada(e.target.value)}
                  className="w-full rounded-xl border border-border-subtle bg-background px-3.5 py-2.5 text-sm outline-none [color-scheme:dark] focus:border-accent"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium uppercase tracking-wide text-muted">Observação</label>
                <textarea
                  value={observacao}
                  onChange={(e) => setObservacao(e.target.value)}
                  rows={2}
                  className="w-full resize-none rounded-xl border border-border-subtle bg-background px-3.5 py-2.5 text-sm outline-none focus:border-accent"
                />
              </div>
              <button
                onClick={handleCriar}
                disabled={!clienteId || !dataDesejada || salvando}
                className="rounded-xl bg-accent px-4 py-3 font-medium text-accent-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
              >
                {salvando ? "Salvando..." : "Adicionar"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
