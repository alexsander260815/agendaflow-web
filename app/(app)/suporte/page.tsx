"use client";

import { useState } from "react";
import { CheckCircle2, MessageCircle, Send } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { enviarMensagemSuporte } from "@/lib/repositories";

const NUMERO_WHATSAPP = "5551981522887";

export default function SuportePage() {
  const { perfil } = useAuth();
  const [mensagem, setMensagem] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [enviado, setEnviado] = useState(false);

  async function handleEnviar() {
    if (!perfil || !mensagem.trim()) return;
    setEnviando(true);
    try {
      await enviarMensagemSuporte(perfil.salao_id, perfil.nome, mensagem.trim());
      setEnviado(true);
      setMensagem("");
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="mx-auto max-w-xl p-5 md:p-8">
      <h1 className="mb-5 text-2xl font-semibold tracking-tight">Suporte</h1>

      <a
        href={`https://wa.me/${NUMERO_WHATSAPP}?text=${encodeURIComponent("Olá! Preciso de ajuda com o AgendaFlow.")}`}
        target="_blank"
        rel="noreferrer"
        className="card-elevated mb-5 flex items-center justify-center gap-2 rounded-xl bg-surface p-4 text-sm font-medium transition-colors hover:bg-surface-alt"
      >
        <MessageCircle size={17} className="text-accent" /> Falar no WhatsApp
      </a>

      {enviado ? (
        <div className="card-elevated flex flex-col items-center gap-2 rounded-2xl bg-surface p-8 text-center">
          <CheckCircle2 size={28} className="text-accent" />
          <p className="font-medium">Mensagem enviada!</p>
          <p className="text-sm text-muted">Nossa equipe vai responder em breve.</p>
          <button
            onClick={() => setEnviado(false)}
            className="mt-2 rounded-lg border border-border-subtle px-4 py-2 text-sm transition-colors hover:bg-surface-alt"
          >
            Enviar outra mensagem
          </button>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          <textarea
            value={mensagem}
            onChange={(e) => setMensagem(e.target.value)}
            placeholder="Descreva sua dúvida ou problema..."
            rows={6}
            className="rounded-xl border border-border-subtle bg-surface px-4 py-3 outline-none transition-colors focus:border-accent placeholder:text-muted/60"
          />
          <button
            onClick={handleEnviar}
            disabled={enviando || !mensagem.trim()}
            className="flex items-center justify-center gap-1.5 rounded-xl bg-accent px-4 py-3.5 font-medium text-accent-foreground transition-opacity hover:opacity-90 disabled:opacity-60"
          >
            <Send size={15} /> {enviando ? "Enviando..." : "Enviar mensagem"}
          </button>
        </div>
      )}
    </div>
  );
}
