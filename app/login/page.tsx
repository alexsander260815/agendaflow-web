"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CalendarDays, Lock, Mail } from "lucide-react";
import { useAuth } from "@/lib/auth-context";

export default function LoginPage() {
  const { login } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);
    setCarregando(true);
    const { erro } = await login(email, senha);
    setCarregando(false);
    if (erro) {
      setErro(erro);
    } else {
      router.replace("/");
    }
  }

  return (
    <div className="relative flex flex-1 items-center justify-center overflow-hidden p-6">
      <div
        className="pointer-events-none absolute -top-32 left-1/2 h-80 w-80 -translate-x-1/2 rounded-full opacity-20 blur-3xl"
        style={{ background: "radial-gradient(circle, var(--accent), transparent 70%)" }}
      />

      <div className="relative w-full max-w-sm">
        <div className="mb-10 flex flex-col items-center gap-4">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-accent/12 ring-1 ring-accent/25">
            <CalendarDays size={30} className="text-accent" strokeWidth={2.1} />
          </div>
          <div className="text-center">
            <h1 className="text-xl font-semibold tracking-tight">AgendaFlow Pro</h1>
            <p className="mt-1 text-sm text-muted">Gestão do seu salão, em qualquer lugar.</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium uppercase tracking-wide text-muted">E-mail</label>
            <div className="flex items-center gap-2.5 rounded-xl border border-border-subtle bg-surface px-4 py-3 transition-colors focus-within:border-accent">
              <Mail size={17} className="text-muted" />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-transparent text-foreground outline-none placeholder:text-muted/60"
                placeholder="voce@email.com"
                autoComplete="email"
              />
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium uppercase tracking-wide text-muted">Senha</label>
            <div className="flex items-center gap-2.5 rounded-xl border border-border-subtle bg-surface px-4 py-3 transition-colors focus-within:border-accent">
              <Lock size={17} className="text-muted" />
              <input
                type="password"
                required
                value={senha}
                onChange={(e) => setSenha(e.target.value)}
                className="w-full bg-transparent text-foreground outline-none placeholder:text-muted/60"
                placeholder="••••••••"
                autoComplete="current-password"
              />
            </div>
          </div>

          {erro && (
            <p className="rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger">{erro}</p>
          )}

          <button
            type="submit"
            disabled={carregando}
            className="mt-2 rounded-xl bg-accent px-4 py-3.5 font-medium text-accent-foreground transition-opacity hover:opacity-90 disabled:opacity-60"
          >
            {carregando ? "Entrando..." : "Entrar"}
          </button>
        </form>
      </div>
    </div>
  );
}
