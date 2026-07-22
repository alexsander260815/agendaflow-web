"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Clock, Package, Plus, Scissors, X } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { listarServicos } from "@/lib/repositories/servicoRepository";
import { deletarPacote, listarPacotes, salvarPacote } from "@/lib/repositories/pacoteRepository";
import { Pacote, Servico } from "@/lib/types";
import { formatarMoeda } from "@/lib/datetime";

function formatarPreco(preco: number, variavel: boolean): string {
  return variavel ? `A partir de ${formatarMoeda(preco)}` : formatarMoeda(preco);
}

function formatarDuracao(minutos: number): string {
  const horas = Math.floor(minutos / 60);
  const min = minutos % 60;
  if (horas > 0 && min > 0) return `${horas}h ${min}min`;
  if (horas > 0) return `${horas}h`;
  return `${min} min`;
}

export default function ServicosPage() {
  const { perfil } = useAuth();
  const [aba, setAba] = useState<"servicos" | "pacotes">("servicos");
  const [servicos, setServicos] = useState<Servico[]>([]);
  const [pacotes, setPacotes] = useState<Pacote[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [mostrarNovoPacote, setMostrarNovoPacote] = useState(false);

  useEffect(() => {
    if (!perfil) return;
    Promise.all([listarServicos(perfil.salao_id), listarPacotes(perfil.salao_id)])
      .then(([s, p]) => {
        setServicos(s);
        setPacotes(p);
      })
      .finally(() => setCarregando(false));
  }, [perfil?.id]);

  async function handleDeletarPacote(id: string) {
    await deletarPacote(id);
    if (perfil) setPacotes(await listarPacotes(perfil.salao_id));
  }

  return (
    <div className="mx-auto max-w-3xl p-5 md:p-8">
      <div className="mb-5 flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">Serviços</h1>
        {aba === "servicos" ? (
          <Link
            href="/servicos/novo"
            className="flex items-center gap-1.5 rounded-xl bg-accent px-4 py-2.5 text-sm font-medium text-accent-foreground transition-opacity hover:opacity-90"
          >
            <Plus size={16} strokeWidth={2.5} />
            Novo
          </Link>
        ) : (
          <button
            onClick={() => setMostrarNovoPacote(true)}
            className="flex items-center gap-1.5 rounded-xl bg-accent px-4 py-2.5 text-sm font-medium text-accent-foreground transition-opacity hover:opacity-90"
          >
            <Plus size={16} strokeWidth={2.5} />
            Novo
          </button>
        )}
      </div>

      <div className="mb-5 flex gap-1 rounded-xl bg-surface p-1">
        {(["servicos", "pacotes"] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setAba(tab)}
            className={`flex-1 rounded-lg py-2 text-sm font-medium transition-colors ${
              aba === tab ? "bg-accent text-accent-foreground" : "text-muted"
            }`}
          >
            {tab === "servicos" ? "Serviços" : "Pacotes"}
          </button>
        ))}
      </div>

      {carregando ? (
        <div className="flex flex-col gap-2">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-[72px] animate-pulse rounded-xl bg-surface" />
          ))}
        </div>
      ) : aba === "servicos" ? (
        servicos.length === 0 ? (
          <div className="card-elevated flex flex-col items-center gap-2 rounded-2xl bg-surface p-10 text-center">
            <Scissors size={28} className="text-muted" />
            <p className="text-sm text-muted">Nenhum serviço ainda. Toque em + Novo para cadastrar.</p>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {servicos.map((s) => (
              <Link
                key={s.id}
                href={`/servicos/${s.id}`}
                className="card-elevated flex items-center justify-between gap-3 rounded-xl bg-surface p-4 transition-colors hover:bg-surface-alt"
              >
                <div className="flex min-w-0 items-center gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-accent/12">
                    <Scissors size={16} className="text-accent" />
                  </div>
                  <div className="min-w-0">
                    <p className="truncate font-medium">{s.nome}</p>
                    <p className="flex items-center gap-1.5 text-sm text-muted">
                      <span className={s.variavel ? "text-accent" : ""}>{formatarPreco(s.preco, s.variavel)}</span>
                      <span>·</span>
                      <span className="flex items-center gap-1">
                        <Clock size={11} /> {formatarDuracao(s.duracao_minutos)}
                      </span>
                    </p>
                  </div>
                </div>
                {s.categoria && (
                  <span className="shrink-0 rounded-full bg-surface-alt px-3 py-1 text-xs text-muted">
                    {s.categoria}
                  </span>
                )}
              </Link>
            ))}
          </div>
        )
      ) : pacotes.length === 0 ? (
        <div className="card-elevated flex flex-col items-center gap-2 rounded-2xl bg-surface p-10 text-center">
          <Package size={28} className="text-muted" />
          <p className="text-sm text-muted">Nenhum pacote cadastrado ainda.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {pacotes.map((p) => {
            const servico = servicos.find((s) => s.id === p.servico_id);
            return (
              <div key={p.id} className="card-elevated flex items-center justify-between rounded-xl bg-surface p-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-accent/12">
                    <Package size={16} className="text-accent" />
                  </div>
                  <div>
                    <p className="font-medium">{p.nome}</p>
                    <p className="text-sm text-muted">
                      {servico?.nome ?? "Serviço"} · {p.quantidade_sessoes}x · {formatarMoeda(p.preco)}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => handleDeletarPacote(p.id)}
                  className="rounded-lg p-2 text-muted transition-colors hover:bg-danger/10 hover:text-danger"
                >
                  <X size={16} />
                </button>
              </div>
            );
          })}
        </div>
      )}

      {mostrarNovoPacote && perfil && (
        <NovoPacoteModal
          servicos={servicos}
          salaoId={perfil.salao_id}
          onFechar={() => setMostrarNovoPacote(false)}
          onSalvo={async () => {
            setMostrarNovoPacote(false);
            setPacotes(await listarPacotes(perfil.salao_id));
          }}
        />
      )}
    </div>
  );
}

function NovoPacoteModal({
  servicos,
  salaoId,
  onFechar,
  onSalvo,
}: {
  servicos: Servico[];
  salaoId: string;
  onFechar: () => void;
  onSalvo: () => void;
}) {
  const [nome, setNome] = useState("");
  const [servicoId, setServicoId] = useState(servicos[0]?.id ?? "");
  const [quantidade, setQuantidade] = useState("5");
  const [preco, setPreco] = useState("");

  async function handleSalvar() {
    if (!nome || !servicoId) return;
    await salvarPacote({
      id: crypto.randomUUID(),
      salao_id: salaoId,
      nome,
      servico_id: servicoId,
      quantidade_sessoes: parseInt(quantidade) || 1,
      preco: parseFloat(preco) || 0,
    });
    onSalvo();
  }

  return (
    <div className="fixed inset-0 z-30 flex items-center justify-center bg-black/60 p-5 backdrop-blur-sm">
      <div className="card-elevated w-full max-w-sm rounded-2xl bg-surface p-5">
        <div className="mb-4 flex items-center justify-between">
          <p className="font-medium">Novo Pacote</p>
          <button onClick={onFechar} className="text-muted hover:text-foreground">
            <X size={18} />
          </button>
        </div>
        <div className="flex flex-col gap-3">
          <input
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            placeholder="Nome do pacote"
            className="rounded-xl border border-border-subtle bg-background px-3.5 py-2.5 outline-none focus:border-accent"
          />
          <select
            value={servicoId}
            onChange={(e) => setServicoId(e.target.value)}
            className="rounded-xl border border-border-subtle bg-background px-3.5 py-2.5 outline-none focus:border-accent"
          >
            {servicos.map((s) => (
              <option key={s.id} value={s.id}>
                {s.nome}
              </option>
            ))}
          </select>
          <input
            value={quantidade}
            onChange={(e) => setQuantidade(e.target.value.replace(/\D/g, ""))}
            placeholder="Quantidade de sessões"
            className="rounded-xl border border-border-subtle bg-background px-3.5 py-2.5 outline-none focus:border-accent"
          />
          <input
            value={preco}
            onChange={(e) => setPreco(e.target.value.replace(/[^0-9.]/g, ""))}
            placeholder="Preço (ex: 250.00)"
            className="rounded-xl border border-border-subtle bg-background px-3.5 py-2.5 outline-none focus:border-accent"
          />
        </div>
        <button
          onClick={handleSalvar}
          className="mt-4 w-full rounded-xl bg-accent px-4 py-3 text-sm font-medium text-accent-foreground transition-opacity hover:opacity-90"
        >
          Salvar
        </button>
      </div>
    </div>
  );
}
