"use client";

import { Mail, MessageCircle } from "lucide-react";

const NUMERO_WHATSAPP = "5551981522887";
const EMAIL_SUPORTE = "agendaflowpro@gmail.com";

export default function SuportePage() {
  return (
    <div className="mx-auto max-w-xl p-5 md:p-8">
      <h1 className="mb-5 text-2xl font-semibold tracking-tight">Suporte</h1>

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
    </div>
  );
}
