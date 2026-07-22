"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, Clock } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/lib/supabase";
import { buscarMinhaAssinatura, cancelarMinhaAssinatura, criarAssinatura, listarPlanos } from "@/lib/repositories";
import { Assinatura, Plano } from "@/lib/types";
import { formatarMoeda } from "@/lib/datetime";

export default function PlanosPage() {
  const { perfil } = useAuth();
  const [frequencia, setFrequencia] = useState<"MENSAL" | "ANUAL">("MENSAL");
  const [planos, setPlanos] = useState<Plano[]>([]);
  const [assinatura, setAssinatura] = useState<Assinatura | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [assinando, setAssinando] = useState<string | null>(null);
  const [mostrarCancelar, setMostrarCancelar] = useState(false);
  const [cancelando, setCancelando] = useState(false);
  const [mensagemCancelada, setMensagemCancelada] = useState(false);

  useEffect(() => {
    if (!perfil) return;
    carregar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [perfil?.id]);

  async function carregar() {
    if (!perfil) return;
    setCarregando(true);
    try {
      const [p, a] = await Promise.all([listarPlanos(), buscarMinhaAssinatura(perfil.salao_id)]);
      setPlanos(p);
      setAssinatura(a);
    } finally {
      setCarregando(false);
    }
  }

  async function handleAssinar(planoId: string) {
    if (!perfil) return;
    setAssinando(planoId);
    try {
      const { data } = await supabase.auth.getUser();
      const email = data.user?.email ?? "";
      const resposta = await criarAssinatura(planoId, email);
      if (resposta.linkPagamento) {
        window.open(resposta.linkPagamento, "_blank");
      } else if (resposta.erro) {
        alert(resposta.erro);
      }
    } finally {
      setAssinando(null);
    }
  }

  async function handleCancelar() {
    setCancelando(true);
    try {
      await cancelarMinhaAssinatura();
      setMostrarCancelar(false);
      setMensagemCancelada(true);
      carregar();
    } finally {
      setCancelando(false);
    }
  }

  const planoAtual = planos.find((p) => p.id === assinatura?.plano_id);
  const planosFiltrados = planos.filter((p) => p.frequencia === frequencia);

  return (
    <div className="mx-auto max-w-3xl p-5 md:p-8">
      <h1 className="mb-5 text-2xl font-semibold tracking-tight">Planos</h1>

      {carregando ? (
        <div className="h-40 animate-pulse rounded-2xl bg-surface" />
      ) : mensagemCancelada ? (
        <div className="card-elevated rounded-2xl bg-surface p-5 text-sm">
          Assinatura cancelada. Você continua com acesso até o fim do período já pago.
        </div>
      ) : assinatura?.status === "ATIVA" ? (
        <div className="card-elevated rounded-2xl border border-accent/15 bg-surface p-5">
          <div className="mb-2 flex items-center gap-2 text-accent">
            <CheckCircle2 size={18} />
            <p className="font-medium">Assinatura ativa</p>
          </div>
          {planoAtual && <p className="text-sm text-muted">Plano: {planoAtual.nome}</p>}
          {assinatura.data_proxima_cobranca && (
            <p className="text-sm text-muted">
              Próxima cobrança: {new Date(assinatura.data_proxima_cobranca).toLocaleDateString("pt-BR")}
            </p>
          )}
          <button
            onClick={() => setMostrarCancelar(true)}
            className="mt-3 rounded-lg border border-border-subtle px-4 py-2 text-sm transition-colors hover:bg-surface-alt"
          >
            Cancelar assinatura
          </button>
        </div>
      ) : (
        <>
          {assinatura?.status === "PENDENTE" && (
            <div className="card-elevated mb-4 flex items-center gap-2.5 rounded-xl bg-accent/10 p-4 text-sm">
              <Clock size={16} className="shrink-0 text-accent" />
              Sua assinatura está pendente de pagamento. Finalize para ativar o acesso.
            </div>
          )}

          <div className="mb-5 flex gap-1 rounded-xl bg-surface p-1">
            {(["MENSAL", "ANUAL"] as const).map((f) => (
              <button
                key={f}
                onClick={() => setFrequencia(f)}
                className={`flex-1 rounded-lg py-2 text-sm font-medium transition-colors ${
                  frequencia === f ? "bg-accent text-accent-foreground" : "text-muted"
                }`}
              >
                {f === "MENSAL" ? "Mensal" : "Anual"}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {planosFiltrados.map((p) => (
              <div key={p.id} className="card-elevated flex flex-col rounded-2xl bg-surface p-5">
                <p className="font-semibold">{p.nome}</p>
                <p className="mt-1 text-2xl font-bold tabular-nums text-accent">{formatarMoeda(p.preco)}</p>
                <p className="text-xs text-muted">
                  {p.faixa_max ? `Até ${p.faixa_max} profissional(is)` : `A partir de ${p.faixa_min} profissional(is)`}
                </p>
                <button
                  onClick={() => handleAssinar(p.id)}
                  disabled={assinando === p.id}
                  className="mt-4 rounded-xl bg-accent px-4 py-2.5 text-sm font-medium text-accent-foreground transition-opacity hover:opacity-90 disabled:opacity-60"
                >
                  {assinando === p.id ? "Gerando..." : "Assinar"}
                </button>
              </div>
            ))}
          </div>
        </>
      )}

      {mostrarCancelar && (
        <div className="fixed inset-0 z-30 flex items-center justify-center bg-black/60 p-5 backdrop-blur-sm">
          <div className="card-elevated w-full max-w-sm rounded-2xl bg-surface p-5">
            <p className="mb-2 font-medium">Cancelar assinatura?</p>
            <p className="mb-4 text-sm text-muted">
              Seu acesso continua ativo até o fim do período já pago. Depois disso, você perde acesso às
              funcionalidades pagas.
            </p>
            <div className="flex justify-end gap-2">
              <button onClick={() => setMostrarCancelar(false)} className="rounded-lg px-4 py-2 text-sm text-muted transition-colors hover:bg-surface-alt">
                Voltar
              </button>
              <button
                onClick={handleCancelar}
                disabled={cancelando}
                className="rounded-lg bg-danger px-4 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-60"
              >
                {cancelando ? "Cancelando..." : "Cancelar assinatura"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
