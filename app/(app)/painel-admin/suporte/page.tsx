"use client";

import { useEffect, useState } from "react";
import { ChevronLeft } from "lucide-react";
import Link from "next/link";
import { atualizarStatusSuporte, listarMensagensSuporte } from "@/lib/repositories";
import { SuporteMensagemPainel } from "@/lib/types";
import { formatarDataHora } from "@/lib/datetime";
import { abrirWhatsApp } from "@/lib/whatsapp";

const COR_STATUS: Record<string, string> = {
  ABERTO: "bg-amber-400/12 text-amber-400",
  RESPONDIDO: "bg-accent/12 text-accent",
  FECHADO: "bg-surface-alt text-muted",
};

export default function SuporteAdminPage() {
  const [mensagens, setMensagens] = useState<SuporteMensagemPainel[]>([]);
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    carregar();
  }, []);

  async function carregar() {
    setCarregando(true);
    try {
      setMensagens(await listarMensagensSuporte());
    } finally {
      setCarregando(false);
    }
  }

  async function handleAtualizarStatus(id: string, status: string) {
    await atualizarStatusSuporte(id, status);
    carregar();
  }

  return (
    <div className="mx-auto max-w-2xl p-5 md:p-8">
      <div className="mb-5 flex items-center gap-2">
        <Link href="/painel-admin" className="rounded-lg p-1.5 text-muted transition-colors hover:bg-surface hover:text-foreground">
          <ChevronLeft size={20} />
        </Link>
        <h1 className="text-2xl font-semibold tracking-tight">Mensagens de Suporte</h1>
      </div>

      {carregando ? (
        <div className="flex flex-col gap-2">
          {[0, 1].map((i) => (
            <div key={i} className="h-24 animate-pulse rounded-xl bg-surface" />
          ))}
        </div>
      ) : mensagens.length === 0 ? (
        <p className="text-sm text-muted">Nenhuma mensagem ainda.</p>
      ) : (
        <div className="flex flex-col gap-2">
          {mensagens.map((m) => (
            <div key={m.id} className="card-elevated rounded-xl bg-surface p-4">
              <div className="mb-1 flex items-start justify-between gap-2">
                <div>
                  <p className="text-sm font-medium">{m.nomeSalao}</p>
                  <p className="text-xs text-muted">
                    {m.remetenteNome} · {formatarDataHora(new Date(m.criadoEm).getTime())}
                  </p>
                </div>
                <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-medium ${COR_STATUS[m.status] ?? "bg-surface-alt"}`}>
                  {m.status}
                </span>
              </div>
              <p className="mt-2 text-sm">{m.mensagem}</p>
              {m.status !== "FECHADO" && (
                <div className="mt-3 flex flex-wrap gap-2">
                  {(m.whatsapp || m.celularUnidade) && (
                    <button
                      onClick={() =>
                        abrirWhatsApp(
                          (m.whatsapp || m.celularUnidade) as string,
                          `Oi ${m.remetenteNome}! Vi sua mensagem no suporte do AgendaFlow: "${m.mensagem}"`
                        )
                      }
                      className="rounded-lg bg-accent px-3 py-1.5 text-xs font-medium text-accent-foreground transition-opacity hover:opacity-90"
                    >
                      Responder no WhatsApp
                    </button>
                  )}
                  {m.status !== "RESPONDIDO" && (
                    <button
                      onClick={() => handleAtualizarStatus(m.id, "RESPONDIDO")}
                      className="rounded-lg border border-border-subtle px-3 py-1.5 text-xs transition-colors hover:bg-surface-alt"
                    >
                      Marcar respondido
                    </button>
                  )}
                  <button
                    onClick={() => handleAtualizarStatus(m.id, "FECHADO")}
                    className="rounded-lg border border-border-subtle px-3 py-1.5 text-xs transition-colors hover:bg-surface-alt"
                  >
                    Fechar
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
