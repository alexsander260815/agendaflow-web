"use client";

import { useEffect, useState } from "react";
import { Landmark } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import AcessoRestrito from "@/components/AcessoRestrito";
import { buscarMeuSalao, atualizarSalao } from "@/lib/repositories";
import { Salao } from "@/lib/types";

const inputClass =
  "w-full rounded-xl border border-border-subtle bg-surface px-4 py-3 outline-none transition-colors focus:border-accent";
const labelClass = "text-xs font-medium uppercase tracking-wide text-muted";

export default function PagamentosPage() {
  const { perfil } = useAuth();
  const [salao, setSalao] = useState<Salao | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [mensagemSalvar, setMensagemSalvar] = useState<{ tipo: "sucesso" | "erro"; texto: string } | null>(null);

  useEffect(() => {
    if (!perfil) return;
    carregar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [perfil?.id]);

  async function carregar() {
    if (!perfil) return;
    setCarregando(true);
    try {
      setSalao(await buscarMeuSalao(perfil.salao_id));
    } finally {
      setCarregando(false);
    }
  }

  function atualizarCampo<K extends keyof Salao>(campo: K, valor: Salao[K]) {
    setSalao((atual) => (atual ? { ...atual, [campo]: valor } : atual));
  }

  async function handleSalvar() {
    if (!salao) return;
    setSalvando(true);
    setMensagemSalvar(null);
    try {
      await atualizarSalao(salao);
      setMensagemSalvar({ tipo: "sucesso", texto: "Alterações salvas!" });
    } catch (e) {
      const mensagem = e instanceof Error ? e.message : "Erro desconhecido";
      setMensagemSalvar({ tipo: "erro", texto: `Não foi possível salvar: ${mensagem}` });
    } finally {
      setSalvando(false);
      setTimeout(() => setMensagemSalvar(null), 5000);
    }
  }

  if (perfil && perfil.papel !== "DONO") return <AcessoRestrito />;

  if (carregando || !salao) {
    return (
      <div className="mx-auto max-w-2xl p-5 md:p-8">
        <div className="h-64 animate-pulse rounded-2xl bg-surface" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl p-5 pb-16 md:p-8">
      <div className="mb-6 flex items-center gap-2">
        <Landmark size={20} className="text-accent" />
        <h1 className="text-2xl font-semibold tracking-tight">Pagamentos</h1>
      </div>

      <div className="flex flex-col gap-4">
        <div className="card-elevated flex items-center justify-between rounded-xl bg-surface p-4">
          <div>
            <p className="text-sm font-medium">Cobrança de sinal</p>
            <p className="text-xs text-muted">Manda a chave Pix junto com a confirmação do agendamento.</p>
          </div>
          <Toggle valor={salao.sinal_ativo} onMudar={(v) => atualizarCampo("sinal_ativo", v)} />
        </div>

        {salao.sinal_ativo && (
          <div className="card-elevated flex flex-col gap-4 rounded-2xl bg-surface p-4">
            <Campo label="Valor do sinal (R$)">
              <input
                type="number"
                min="0"
                step="0.01"
                value={salao.sinal_valor ? Number(salao.sinal_valor).toFixed(2) : ""}
                onChange={(e) => atualizarCampo("sinal_valor", Number(e.target.value) || 0)}
                className={inputClass}
              />
            </Campo>

            <p className="text-xs text-muted">
              Cada profissional pode cadastrar o próprio Pix em Meu Perfil — se cadastrar, o sinal dos agendamentos dele cai direto lá. Quem não cadastrar usa o Pix do salão abaixo, que também serve de reserva.
            </p>

            <Campo label="Chave Pix do salão">
              <input value={salao.chave_pix ?? ""} onChange={(e) => atualizarCampo("chave_pix", e.target.value)} className={inputClass} />
            </Campo>
            <Campo label="Nome do beneficiário">
              <input
                value={salao.pix_nome_beneficiario ?? ""}
                onChange={(e) => atualizarCampo("pix_nome_beneficiario", e.target.value)}
                className={inputClass}
              />
            </Campo>
          </div>
        )}

        <button
          onClick={handleSalvar}
          disabled={salvando}
          className="rounded-xl bg-accent px-4 py-3.5 font-medium text-accent-foreground transition-opacity hover:opacity-90 disabled:opacity-60"
        >
          {salvando ? "Salvando..." : "Salvar alterações"}
        </button>

        {mensagemSalvar && (
          <p className={`text-sm ${mensagemSalvar.tipo === "sucesso" ? "text-accent" : "text-danger"}`}>
            {mensagemSalvar.texto}
          </p>
        )}
      </div>
    </div>
  );
}

function Campo({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className={labelClass}>{label}</label>
      {children}
    </div>
  );
}

function Toggle({ valor, onMudar }: { valor: boolean; onMudar: (v: boolean) => void }) {
  return (
    <button
      onClick={() => onMudar(!valor)}
      className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${valor ? "bg-accent" : "bg-surface-alt"}`}
    >
      <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition-transform ${valor ? "translate-x-5" : "translate-x-0.5"}`} />
    </button>
  );
}
