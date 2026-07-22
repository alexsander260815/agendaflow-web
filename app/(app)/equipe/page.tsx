"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Copy, RefreshCw, Shield, User, Users } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import {
  buscarMinhaAssinatura,
  gerarConvite,
  listarEquipe,
  listarPlanos,
} from "@/lib/repositories";
import { Perfil } from "@/lib/types";
import { corAvatar, iniciais } from "@/lib/avatar";

export default function EquipePage() {
  const { perfil } = useAuth();
  const [equipe, setEquipe] = useState<Perfil[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [gerando, setGerando] = useState(false);
  const [codigoGerado, setCodigoGerado] = useState<string | null>(null);
  const [limiteAtingido, setLimiteAtingido] = useState<string | null>(null);

  useEffect(() => {
    if (!perfil) return;
    listarEquipe(perfil.salao_id)
      .then((lista) => setEquipe(lista.filter((p) => p.papel !== "DONO")))
      .finally(() => setCarregando(false));
  }, [perfil?.id]);

  async function verificarLimitePlano(): Promise<string | null> {
    if (!perfil) return null;
    try {
      const assinatura = await buscarMinhaAssinatura(perfil.salao_id);
      if (!assinatura || assinatura.status !== "ATIVA" || !assinatura.plano_id) return null;

      const planos = await listarPlanos();
      const plano = planos.find((p) => p.id === assinatura.plano_id);
      if (!plano || plano.faixa_max === null) return null;

      const todaEquipe = await listarEquipe(perfil.salao_id);
      const quantidadeAtual = todaEquipe.filter((p) => p.atende_clientes).length;

      if (quantidadeAtual >= plano.faixa_max) {
        return `Seu plano atual permite até ${plano.faixa_max} profissional(is) atendendo clientes. Você já atingiu esse limite.`;
      }
      return null;
    } catch {
      return null;
    }
  }

  async function handleGerarConvite(papel: "ADMIN" | "PROFISSIONAL") {
    if (!perfil) return;
    setGerando(true);
    setCodigoGerado(null);
    try {
      const limite = await verificarLimitePlano();
      if (limite) {
        setLimiteAtingido(limite);
        return;
      }
      const codigo = await gerarConvite(perfil.salao_id, papel);
      setCodigoGerado(codigo);
    } finally {
      setGerando(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl p-5 md:p-8">
      <h1 className="mb-5 text-2xl font-semibold tracking-tight">Equipe</h1>

      {codigoGerado ? (
        <div className="card-elevated mb-5 flex flex-col items-center gap-3 rounded-2xl bg-surface p-6 text-center">
          <p className="text-sm text-muted">Código gerado:</p>
          <p className="text-3xl font-bold tracking-widest text-accent">{codigoGerado}</p>
          <div className="flex gap-2">
            <button
              onClick={() => navigator.clipboard.writeText(codigoGerado)}
              className="flex items-center gap-1.5 rounded-lg border border-border-subtle px-3 py-2 text-sm transition-colors hover:bg-surface-alt"
            >
              <Copy size={14} /> Copiar
            </button>
            <button
              onClick={() => setCodigoGerado(null)}
              className="flex items-center gap-1.5 rounded-lg border border-border-subtle px-3 py-2 text-sm transition-colors hover:bg-surface-alt"
            >
              <RefreshCw size={14} /> Gerar outro
            </button>
          </div>
        </div>
      ) : (
        <div className="mb-5 grid grid-cols-1 gap-2 sm:grid-cols-2">
          <button
            onClick={() => handleGerarConvite("ADMIN")}
            disabled={gerando}
            className="card-elevated flex items-center justify-center gap-2 rounded-xl bg-surface p-4 text-sm font-medium transition-colors hover:bg-surface-alt disabled:opacity-60"
          >
            <Shield size={16} className="text-accent" /> Convidar como Admin
          </button>
          <button
            onClick={() => handleGerarConvite("PROFISSIONAL")}
            disabled={gerando}
            className="card-elevated flex items-center justify-center gap-2 rounded-xl bg-surface p-4 text-sm font-medium transition-colors hover:bg-surface-alt disabled:opacity-60"
          >
            <User size={16} className="text-accent" /> Convidar como Profissional
          </button>
        </div>
      )}

      <p className="mb-2 flex items-center gap-1.5 text-sm text-muted">
        <Users size={14} /> {equipe.length} pessoa(s) na equipe
      </p>

      {carregando ? (
        <div className="flex flex-col gap-2">
          {[0, 1].map((i) => (
            <div key={i} className="h-16 animate-pulse rounded-xl bg-surface" />
          ))}
        </div>
      ) : equipe.length === 0 ? (
        <p className="text-sm text-muted">Ninguém convidado ainda.</p>
      ) : (
        <div className="flex flex-col gap-2">
          {equipe.map((p) => {
            const avatar = corAvatar(p.nome);
            return (
              <Link
                key={p.id}
                href={`/equipe/${p.id}`}
                className="card-elevated flex items-center gap-3 rounded-xl bg-surface p-4 transition-colors hover:bg-surface-alt"
              >
                <div
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-semibold"
                  style={{ background: avatar.bg, color: avatar.fg }}
                >
                  {iniciais(p.nome)}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{p.nome}</p>
                  <p className="text-xs text-muted">{p.papel}</p>
                </div>
              </Link>
            );
          })}
        </div>
      )}

      {limiteAtingido && (
        <div className="fixed inset-0 z-30 flex items-center justify-center bg-black/60 p-5 backdrop-blur-sm">
          <div className="card-elevated w-full max-w-sm rounded-2xl bg-surface p-5">
            <p className="mb-2 font-medium">Limite do plano atingido</p>
            <p className="mb-4 text-sm text-muted">{limiteAtingido}</p>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setLimiteAtingido(null)}
                className="rounded-lg px-4 py-2 text-sm text-muted transition-colors hover:bg-surface-alt"
              >
                Fechar
              </button>
              <Link
                href="/planos"
                className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-accent-foreground transition-opacity hover:opacity-90"
              >
                Ver planos
              </Link>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
