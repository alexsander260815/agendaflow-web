"use client";

import { useRef, useState } from "react";
import { Camera, UserRound } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { definirAtendeClientes } from "@/lib/repositories/perfilRepository";
import { enviarFotoPerfil } from "@/lib/repositories/fotoPerfilRepository";
import { corAvatar, iniciais } from "@/lib/avatar";

const LABEL_PAPEL: Record<string, string> = {
  DONO: "Dono(a)",
  ADMIN: "Administrador(a)",
  PROFISSIONAL: "Profissional",
};

export default function MeuPerfilPage() {
  const { perfil, refrescarPerfil } = useAuth();
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [alternando, setAlternando] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  if (!perfil) return null;

  const avatar = corAvatar(perfil.nome);

  async function handleEscolherFoto(e: React.ChangeEvent<HTMLInputElement>) {
    const arquivo = e.target.files?.[0];
    if (!arquivo || !perfil) return;
    setErro(null);
    setEnviando(true);
    try {
      await enviarFotoPerfil(perfil.id, arquivo);
      await refrescarPerfil();
    } catch (err) {
      setErro(err instanceof Error ? err.message : "Erro ao enviar foto.");
    } finally {
      setEnviando(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  async function handleAlternarAtendeClientes(valor: boolean) {
    if (!perfil) return;
    setAlternando(true);
    try {
      await definirAtendeClientes(perfil.id, valor);
      await refrescarPerfil();
    } finally {
      setAlternando(false);
    }
  }

  return (
    <div className="mx-auto max-w-md p-5 md:p-8">
      <h1 className="mb-6 text-2xl font-semibold tracking-tight">Meu Perfil</h1>

      <div className="flex flex-col items-center gap-4">
        <div className="relative">
          {enviando ? (
            <div className="flex h-28 w-28 items-center justify-center rounded-full bg-surface">
              <div className="h-8 w-8 animate-spin rounded-full border-2 border-accent border-t-transparent" />
            </div>
          ) : perfil.foto_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={perfil.foto_url}
              alt={perfil.nome}
              className="h-28 w-28 rounded-full object-cover"
            />
          ) : (
            <div
              className="flex h-28 w-28 items-center justify-center rounded-full text-2xl font-semibold"
              style={{ background: avatar.bg, color: avatar.fg }}
            >
              {perfil.nome ? iniciais(perfil.nome) : <UserRound size={36} />}
            </div>
          )}
          <button
            onClick={() => inputRef.current?.click()}
            disabled={enviando}
            className="absolute bottom-0 right-0 flex h-9 w-9 items-center justify-center rounded-full bg-accent text-accent-foreground shadow-lg transition-opacity hover:opacity-90 disabled:opacity-60"
          >
            <Camera size={16} />
          </button>
          <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={handleEscolherFoto} />
        </div>

        <div className="text-center">
          <p className="text-xl font-semibold">{perfil.nome}</p>
          <p className="text-sm text-muted">{LABEL_PAPEL[perfil.papel] ?? perfil.papel}</p>
        </div>

        {erro && <p className="w-full rounded-lg bg-danger/10 px-3 py-2 text-center text-sm text-danger">{erro}</p>}

        {perfil.papel === "DONO" && (
          <div className="card-elevated mt-4 flex w-full items-center justify-between gap-4 rounded-xl bg-surface p-4">
            <div>
              <p className="text-sm font-medium">Eu atendo clientes</p>
              <p className="mt-0.5 text-xs text-muted">
                Ative se você também presta serviços — assim aparece na Agenda e conta no limite do plano.
              </p>
            </div>
            <button
              onClick={() => handleAlternarAtendeClientes(!perfil.atende_clientes)}
              disabled={alternando}
              className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${
                perfil.atende_clientes ? "bg-accent" : "bg-surface-alt"
              }`}
            >
              <span
                className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition-transform ${
                  perfil.atende_clientes ? "translate-x-5" : "translate-x-0.5"
                }`}
              />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
