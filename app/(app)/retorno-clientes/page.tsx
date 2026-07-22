"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { listarClientes, listarRetornosPendentes, marcarStatusRetorno } from "@/lib/repositories";
import { profissionaisVisiveisAgenda } from "@/lib/permissoes";
import { montarMensagemRetorno } from "@/lib/mensagens";
import { abrirWhatsApp } from "@/lib/whatsapp";
import { Cliente, RetornoCliente } from "@/lib/types";

interface RetornoItem {
  id: string;
  clienteNome: string;
  clienteTelefone: string;
  nomeServico: string;
  dataRetornoMillis: number;
  diasRestantes: number;
}

export default function RetornoClientesPage() {
  const { perfil } = useAuth();
  const [itens, setItens] = useState<RetornoItem[]>([]);
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    if (!perfil) return;
    carregar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [perfil?.id]);

  async function carregar() {
    if (!perfil) return;
    setCarregando(true);
    try {
      const [visiveis, retornos, clientes] = await Promise.all([
        profissionaisVisiveisAgenda(perfil),
        listarRetornosPendentes(perfil.salao_id),
        listarClientes(perfil.salao_id),
      ]);

      const clientesMap = new Map<string, Cliente>(clientes.map((c) => [c.id, c]));
      const agora = Date.now();

      const filtrados = retornos.filter(
        (r: RetornoCliente) => visiveis === null || r.profissional_id === null || visiveis.includes(r.profissional_id)
      );

      const resultado: RetornoItem[] = filtrados
        .map((r) => {
          const cliente = clientesMap.get(r.cliente_id);
          if (!cliente) return null;
          const dataMillis = new Date(r.data_retorno).getTime();
          const dias = Math.floor((dataMillis - agora) / (24 * 60 * 60 * 1000));
          return {
            id: r.id,
            clienteNome: cliente.nome,
            clienteTelefone: cliente.telefone,
            nomeServico: r.nome_servico,
            dataRetornoMillis: dataMillis,
            diasRestantes: dias,
          };
        })
        .filter((item): item is RetornoItem => item !== null)
        .sort((a, b) => a.dataRetornoMillis - b.dataRetornoMillis);

      setItens(resultado);
    } finally {
      setCarregando(false);
    }
  }

  async function handleAvisar(item: RetornoItem) {
    const mensagem = montarMensagemRetorno(
      item.clienteNome,
      item.nomeServico,
      item.diasRestantes >= 0 ? 0 : -item.diasRestantes
    );
    abrirWhatsApp(item.clienteTelefone, mensagem);
    await marcarStatusRetorno(item.id, "AVISADO");
    carregar();
  }

  async function handleConcluir(item: RetornoItem) {
    await marcarStatusRetorno(item.id, "CONCLUIDO");
    carregar();
  }

  return (
    <div className="mx-auto max-w-2xl p-5 md:p-8">
      <h1 className="mb-5 text-2xl font-semibold tracking-tight">Retorno de Clientes</h1>

      {carregando ? (
        <div className="flex flex-col gap-2">
          {[0, 1].map((i) => (
            <div key={i} className="h-24 animate-pulse rounded-xl bg-surface" />
          ))}
        </div>
      ) : itens.length === 0 ? (
        <p className="text-sm text-muted">Nenhum retorno pendente.</p>
      ) : (
        <div className="flex flex-col gap-2">
          {itens.map((item) => (
            <div key={item.id} className="card-elevated rounded-xl bg-surface p-4">
              <p className="font-medium">{item.clienteNome}</p>
              <p className="text-sm text-muted">{item.nomeServico}</p>
              <p className="mt-1 text-xs text-muted">
                {item.diasRestantes >= 0
                  ? `Vence em ${item.diasRestantes} dia(s)`
                  : `Atrasado há ${-item.diasRestantes} dia(s)`}
              </p>
              <div className="mt-3 flex gap-2">
                <button
                  onClick={() => handleAvisar(item)}
                  className="flex-1 rounded-lg bg-accent px-3 py-2 text-sm font-medium text-accent-foreground transition-opacity hover:opacity-90"
                >
                  Avisar no WhatsApp
                </button>
                <button
                  onClick={() => handleConcluir(item)}
                  className="flex-1 rounded-lg border border-border-subtle py-2 text-sm transition-colors hover:bg-surface-alt"
                >
                  Concluir
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
