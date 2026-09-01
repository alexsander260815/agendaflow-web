"use client";

import { useState } from "react";
import { CheckCircle2, Mail, MessageCircle, Send } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { enviarMensagemSuporte } from "@/lib/repositories/suporteRepository";
import BotaoVoltarInicio from "@/components/BotaoVoltarInicio";

const NUMERO_WHATSAPP = "5551981522887";
const EMAIL_SUPORTE = "agendaflowpro@gmail.com";

export default function SuportePage() {
  const { perfil } = useAuth();
  const [mensagem, setMensagem] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [enviada, setEnviada] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function handleEnviar() {
    if (!perfil || !mensagem.trim()) return;
    setEnviando(true);
    setErro(null);
    try {
      await enviarMensagemSuporte(perfil.salao_id, perfil.nome, mensagem.trim());
      setEnviada(true);
    } catch {
      setErro("Não foi possível enviar. Tente novamente.");
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="mx-auto max-w-xl p-5 md:p-8">
      <div className="mb-5 flex items-center">
        <BotaoVoltarInicio />
        <h1 className="text-2xl font-semibold tracking-tight">Suporte</h1>
      </div>

      <div className="card-elevated flex flex-col items-center gap-3 rounded-2xl bg-surface p-8 text-center">
        <MessageCircle size={28} className="text-accent" />
        <p className="font-medium">Precisa de ajuda?</p>
        <p className="text-sm text-muted">Fala com a gente direto pelo WhatsApp, é mais rápido.</p>
        <a
          href={`https://wa.me/${NUMERO_WHATSAPP}?text=${encodeURIComponent("Olá! Preciso de ajuda com o AgendaFlow.")}`}
          target="_blank"
          rel="noreferrer"
          className="mt-2 flex items-center justify-center gap-2 rounded-xl bg-accent px-4 py-3.5 font-medium text-accent-foreground transition-opacity hover:opacity-90"
        >
          <MessageCircle size={17} /> Falar no WhatsApp
        </a>
        <a
          href={`mailto:${EMAIL_SUPORTE}`}
          className="flex items-center justify-center gap-1.5 text-sm text-muted transition-colors hover:text-foreground"
        >
          <Mail size={15} /> {EMAIL_SUPORTE}
        </a>
      </div>

      <div className="my-6 flex items-center gap-3 text-xs font-medium uppercase tracking-wide text-muted">
        <div className="h-px flex-1 bg-border-subtle" />
        Ou envie uma mensagem
        <div className="h-px flex-1 bg-border-subtle" />
      </div>

      {enviada ? (
        <div className="card-elevated flex flex-col items-center gap-2 rounded-2xl bg-surface p-6 text-center">
          <CheckCircle2 size={32} className="text-success" />
          <p className="font-medium">Mensagem enviada!</p>
          <p className="text-sm text-muted">Vamos te responder o quanto antes.</p>
          <button
            onClick={() => {
              setMensagem("");
              setEnviada(false);
            }}
            className="mt-2 rounded-xl border border-border-subtle px-4 py-2 text-sm transition-colors hover:bg-surface-alt"
          >
            Enviar outra mensagem
          </button>
        </div>
      ) : (
        <div className="card-elevated flex flex-col gap-3 rounded-2xl bg-surface p-5">
          <textarea
            value={mensagem}
            onChange={(e) => setMensagem(e.target.value)}
            placeholder="Descreva sua dúvida ou problema"
            rows={5}
            className="resize-none rounded-xl border border-border-subtle bg-background px-3.5 py-3 outline-none focus:border-accent"
          />
          {erro && <p className="text-sm text-danger">{erro}</p>}
          <button
            onClick={handleEnviar}
            disabled={enviando || !mensagem.trim()}
            className="flex items-center justify-center gap-1.5 rounded-xl bg-accent px-4 py-3 text-sm font-medium text-accent-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            <Send size={15} /> {enviando ? "Enviando..." : "Enviar mensagem"}
          </button>
        </div>
      )}
    </div>
  );
}
