"use client";

// Agendamento público (cliente escolhe serviço/profissional/horário sozinho)
// desativado a pedido do dono do salão — os agendamentos continuam sendo
// feitos só pela equipe, dentro do app. O código anterior desta página
// segue no histórico do git, caso o recurso volte a ser usado no futuro.

export default function AgendarPublicoPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-6">
      <div className="max-w-sm rounded-2xl border border-border-subtle bg-surface p-6 text-center">
        <p className="text-lg font-medium">Agendamento online indisponível</p>
        <p className="mt-2 text-sm text-muted">
          Esse salão não aceita agendamento direto pela internet. Entre em contato por telefone ou WhatsApp pra marcar seu horário.
        </p>
      </div>
    </div>
  );
}
