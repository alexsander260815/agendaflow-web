"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Phone, Plus, Search, Users } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { listarClientes } from "@/lib/repositories/clienteRepository";
import { Cliente } from "@/lib/types";
import { corAvatar, iniciais } from "@/lib/avatar";

export default function ClientesPage() {
  const { perfil } = useAuth();
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [termoBusca, setTermoBusca] = useState("");
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    if (!perfil) return;
    listarClientes(perfil.salao_id)
      .then(setClientes)
      .finally(() => setCarregando(false));
  }, [perfil?.id]);

  const filtrados = clientes.filter((c) => {
    const termo = termoBusca.trim().toLowerCase();
    if (!termo) return true;
    return c.nome.toLowerCase().includes(termo) || c.telefone.includes(termo);
  });

  return (
    <div className="mx-auto max-w-3xl p-5 md:p-8">
      <div className="mb-5 flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">Clientes</h1>
        <Link
          href="/clientes/novo"
          className="flex items-center gap-1.5 rounded-xl bg-accent px-4 py-2.5 text-sm font-medium text-accent-foreground transition-opacity hover:opacity-90"
        >
          <Plus size={16} strokeWidth={2.5} />
          Novo
        </Link>
      </div>

      <div className="card-elevated mb-3 flex items-center gap-2.5 rounded-xl border border-border-subtle bg-surface px-4 py-3">
        <Search size={17} className="text-muted" />
        <input
          value={termoBusca}
          onChange={(e) => setTermoBusca(e.target.value)}
          placeholder="Buscar por nome ou telefone"
          className="flex-1 bg-transparent outline-none placeholder:text-muted/60"
        />
      </div>

      <p className="mb-3 flex items-center gap-1.5 text-sm text-muted">
        <Users size={14} />
        {clientes.length} cliente(s)
      </p>

      {carregando ? (
        <div className="flex flex-col gap-2">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-[68px] animate-pulse rounded-xl bg-surface" />
          ))}
        </div>
      ) : filtrados.length === 0 ? (
        <div className="card-elevated flex flex-col items-center gap-2 rounded-2xl bg-surface p-10 text-center">
          <Users size={28} className="text-muted" />
          <p className="text-sm text-muted">Nenhum cliente encontrado.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {filtrados.map((c) => {
            const avatar = corAvatar(c.nome);
            return (
              <Link
                key={c.id}
                href={`/clientes/${c.id}`}
                className="card-elevated flex items-center gap-3 rounded-xl bg-surface p-4 transition-colors hover:bg-surface-alt"
              >
                <div
                  className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-sm font-semibold"
                  style={{ background: avatar.bg, color: avatar.fg }}
                >
                  {iniciais(c.nome)}
                </div>
                <div className="min-w-0">
                  <p className="truncate font-medium">{c.nome}</p>
                  <p className="flex items-center gap-1 text-sm text-muted">
                    <Phone size={12} /> {c.telefone}
                  </p>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
