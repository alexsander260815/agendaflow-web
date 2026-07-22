"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Building2, Headset, RefreshCw, TrendingUp, Users } from "lucide-react";
import {
  cancelarAssinaturaAdmin,
  estenderAcesso,
  listarSaloes,
  reativarAssinaturaAdmin,
  revogarPrazo,
} from "@/lib/repositories";
import { SalaoPainel } from "@/lib/types";
import { formatarMoeda } from "@/lib/datetime";

const COR_STATUS: Record<string, string> = {
  ATIVA: "bg-accent/12 text-accent",
  PENDENTE: "bg-amber-400/12 text-amber-400",
  CANCELADA: "bg-danger/12 text-danger",
  ATRASADA: "bg-danger/12 text-danger",
};

function diasRestantes(trialFim?: string): number | null {
  if (!trialFim) return null;
  const diff = new Date(trialFim).getTime() - Date.now();
  return Math.ceil(diff / (24 * 60 * 60 * 1000));
}

export default function PainelAdminPage() {
  const [saloes, setSaloes] = useState<SalaoPainel[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [salaoAcao, setSalaoAcao] = useState<SalaoPainel | null>(null);
  const [confirmacao, setConfirmacao] = useState<{ salao: SalaoPainel; acao: string; label: string } | null>(null);

  useEffect(() => {
    carregar();
  }, []);

  async function carregar() {
    setCarregando(true);
    try {
      setSaloes(await listarSaloes());
    } finally {
      setCarregando(false);
    }
  }

  async function executarAcao() {
    if (!confirmacao) return;
    const { salao, acao } = confirmacao;
    if (acao === "cancelar" && salao.assinaturaId) await cancelarAssinaturaAdmin(salao.assinaturaId);
    if (acao === "revogar") await revogarPrazo(salao.salaoId);
    if (acao === "reativar") await reativarAssinaturaAdmin(salao.salaoId);
    if (acao.startsWith("estender_")) await estenderAcesso(salao.salaoId, parseInt(acao.split("_")[1]));
    setConfirmacao(null);
    setSalaoAcao(null);
    carregar();
  }

  const totalSaloes = saloes.length;
  const ativas = saloes.filter((s) => s.statusAssinatura === "ATIVA");
  const mrr = ativas.reduce((soma, s) => soma + (s.precoPlano ?? 0), 0);

  return (
    <div className="mx-auto max-w-3xl p-5 pb-16 md:p-8">
      <div className="mb-5 flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">Painel Admin</h1>
        <Link
          href="/painel-admin/suporte"
          className="flex items-center gap-1.5 rounded-lg border border-border-subtle px-3 py-2 text-sm transition-colors hover:bg-surface"
        >
          <Headset size={15} /> Suporte
        </Link>
      </div>

      {carregando ? (
        <div className="h-40 animate-pulse rounded-2xl bg-surface" />
      ) : (
        <>
          <div className="mb-5 grid grid-cols-3 gap-3">
            <div className="card-elevated rounded-2xl bg-surface p-4 text-center">
              <Building2 size={18} className="mx-auto mb-1 text-accent" />
              <p className="text-xl font-semibold tabular-nums">{totalSaloes}</p>
              <p className="text-xs text-muted">Salões</p>
            </div>
            <div className="card-elevated rounded-2xl bg-surface p-4 text-center">
              <Users size={18} className="mx-auto mb-1 text-accent" />
              <p className="text-xl font-semibold tabular-nums">{ativas.length}</p>
              <p className="text-xs text-muted">Ativas</p>
            </div>
            <div className="card-elevated rounded-2xl bg-surface p-4 text-center">
              <TrendingUp size={18} className="mx-auto mb-1 text-accent" />
              <p className="text-base font-semibold tabular-nums">{formatarMoeda(mrr)}</p>
              <p className="text-xs text-muted">MRR</p>
            </div>
          </div>

          <div className="flex flex-col gap-2">
            {saloes.map((s) => {
              const dias = diasRestantes(s.trialFim);
              return (
                <div key={s.salaoId} className="card-elevated rounded-xl bg-surface p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate font-medium">{s.nomeSalao}</p>
                      <p className="truncate text-xs text-muted">{s.contato}</p>
                      {s.nomePlano && (
                        <p className="text-xs text-muted">
                          {s.nomePlano} · {formatarMoeda(s.precoPlano ?? 0)}
                        </p>
                      )}
                      {dias !== null && <p className="text-xs text-muted">{dias >= 0 ? `${dias} dia(s) restantes` : "Prazo expirado"}</p>}
                    </div>
                    <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-medium ${COR_STATUS[s.statusAssinatura] ?? "bg-surface-alt"}`}>
                      {s.statusAssinatura}
                    </span>
                  </div>
                  <button
                    onClick={() => setSalaoAcao(s)}
                    className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-lg border border-border-subtle py-2 text-sm transition-colors hover:bg-surface-alt"
                  >
                    Ações
                  </button>
                </div>
              );
            })}
          </div>
        </>
      )}

      {salaoAcao && (
        <div className="fixed inset-0 z-30 flex items-center justify-center bg-black/60 p-5 backdrop-blur-sm" onClick={() => setSalaoAcao(null)}>
          <div className="card-elevated w-full max-w-sm rounded-2xl bg-surface p-5" onClick={(e) => e.stopPropagation()}>
            <p className="mb-4 font-medium">{salaoAcao.nomeSalao}</p>
            <div className="flex flex-col gap-1">
              {[7, 15, 30].map((dias) => (
                <button
                  key={dias}
                  onClick={() => setConfirmacao({ salao: salaoAcao, acao: `estender_${dias}`, label: `Conceder +${dias} dias de acesso` })}
                  className="flex items-center gap-2 rounded-lg px-3 py-2.5 text-left text-sm transition-colors hover:bg-surface-alt"
                >
                  <RefreshCw size={14} className="text-accent" /> Conceder +{dias} dias
                </button>
              ))}
              <button
                onClick={() => setConfirmacao({ salao: salaoAcao, acao: "revogar", label: "Revogar o prazo concedido" })}
                className="rounded-lg px-3 py-2.5 text-left text-sm transition-colors hover:bg-surface-alt"
              >
                Revogar prazo
              </button>
              {salaoAcao.statusAssinatura === "ATIVA" && (
                <button
                  onClick={() => setConfirmacao({ salao: salaoAcao, acao: "cancelar", label: "Cancelar a assinatura" })}
                  className="rounded-lg px-3 py-2.5 text-left text-sm text-danger transition-colors hover:bg-danger/10"
                >
                  Cancelar assinatura
                </button>
              )}
              {(salaoAcao.statusAssinatura === "CANCELADA" || salaoAcao.statusAssinatura === "ATRASADA") && (
                <button
                  onClick={() => setConfirmacao({ salao: salaoAcao, acao: "reativar", label: "Reativar a assinatura" })}
                  className="rounded-lg px-3 py-2.5 text-left text-sm text-accent transition-colors hover:bg-accent/10"
                >
                  Reativar assinatura
                </button>
              )}
            </div>
            <button onClick={() => setSalaoAcao(null)} className="mt-3 w-full rounded-lg border border-border-subtle py-2 text-sm transition-colors hover:bg-surface-alt">
              Fechar
            </button>
          </div>
        </div>
      )}

      {confirmacao && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/60 p-5 backdrop-blur-sm">
          <div className="card-elevated w-full max-w-sm rounded-2xl bg-surface p-5">
            <p className="mb-2 font-medium">Confirmar ação</p>
            <p className="mb-4 text-sm text-muted">
              {confirmacao.label} para <span className="font-medium text-foreground">{confirmacao.salao.nomeSalao}</span>?
            </p>
            <div className="flex justify-end gap-2">
              <button onClick={() => setConfirmacao(null)} className="rounded-lg px-4 py-2 text-sm text-muted transition-colors hover:bg-surface-alt">
                Cancelar
              </button>
              <button onClick={executarAcao} className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-accent-foreground transition-opacity hover:opacity-90">
                Confirmar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
