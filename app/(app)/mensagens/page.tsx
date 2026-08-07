"use client";

import { useEffect, useState } from "react";
import { MessageSquare, RotateCcw } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import AcessoRestrito from "@/components/AcessoRestrito";
import { buscarMeuSalao, atualizarSalao } from "@/lib/repositories";
import { Salao } from "@/lib/types";
import {
  mensagemPadraoCancelamento,
  mensagemPadraoConfirmacao,
  mensagemPadraoRemarcacao,
  mensagemPadraoRetorno,
  montarMensagemRetorno,
  substituirMarcadores,
} from "@/lib/mensagens";

export default function MensagensPage() {
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
      setMensagemSalvar({ tipo: "sucesso", texto: "Mensagens salvas!" });
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
        <MessageSquare size={20} className="text-accent" />
        <h1 className="text-2xl font-semibold tracking-tight">Mensagens</h1>
      </div>

      <div className="flex flex-col gap-4">
        <CampoMensagem
          titulo="Confirmação"
          valor={salao.mensagem_confirmacao ?? mensagemPadraoConfirmacao()}
          padrao={mensagemPadraoConfirmacao()}
          onMudar={(v) => atualizarCampo("mensagem_confirmacao", v)}
        />
        <CampoMensagem
          titulo="Remarcação"
          valor={salao.mensagem_remarcacao ?? mensagemPadraoRemarcacao()}
          padrao={mensagemPadraoRemarcacao()}
          onMudar={(v) => atualizarCampo("mensagem_remarcacao", v)}
        />
        <CampoMensagem
          titulo="Cancelamento"
          valor={salao.mensagem_cancelamento ?? mensagemPadraoCancelamento()}
          padrao={mensagemPadraoCancelamento()}
          onMudar={(v) => atualizarCampo("mensagem_cancelamento", v)}
        />

        <div className="card-elevated rounded-xl bg-surface p-4">
          <div className="mb-2 flex items-center justify-between">
            <p className="text-sm font-medium">Retorno de cliente</p>
            <button
              onClick={() => atualizarCampo("mensagem_retorno", mensagemPadraoRetorno())}
              className="flex items-center gap-1 text-xs text-muted transition-colors hover:text-accent"
            >
              <RotateCcw size={11} /> Restaurar padrão
            </button>
          </div>
          <p className="mb-2 text-xs text-muted">Marcadores: {"{nome}"}, {"{servico}"}, {"{dias}"}</p>
          <textarea
            value={salao.mensagem_retorno ?? mensagemPadraoRetorno()}
            onChange={(e) => atualizarCampo("mensagem_retorno", e.target.value)}
            rows={4}
            className="w-full rounded-lg border border-border-subtle bg-background px-3 py-2 text-sm outline-none focus:border-accent"
          />
          <p className="mt-2 whitespace-pre-line rounded-lg bg-surface-alt p-3 text-xs text-muted">
            {montarMensagemRetorno(salao.mensagem_retorno ?? mensagemPadraoRetorno(), "Maria", "Manicure", 15)}
          </p>
        </div>

        <button
          onClick={handleSalvar}
          disabled={salvando}
          className="rounded-xl bg-accent px-4 py-3.5 font-medium text-accent-foreground transition-opacity hover:opacity-90 disabled:opacity-60"
        >
          {salvando ? "Salvando..." : "Salvar mensagens"}
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

function CampoMensagem({
  titulo,
  valor,
  padrao,
  onMudar,
}: {
  titulo: string;
  valor: string;
  padrao: string;
  onMudar: (v: string) => void;
}) {
  const preview = substituirMarcadores(valor, "Maria", Date.now(), "Ana", "Corte Feminino");
  return (
    <div className="card-elevated rounded-xl bg-surface p-4">
      <div className="mb-2 flex items-center justify-between">
        <p className="text-sm font-medium">{titulo}</p>
        <button
          onClick={() => onMudar(padrao)}
          className="flex items-center gap-1 text-xs text-muted transition-colors hover:text-accent"
        >
          <RotateCcw size={11} /> Restaurar padrão
        </button>
      </div>
      <textarea
        value={valor}
        onChange={(e) => onMudar(e.target.value)}
        rows={4}
        className="w-full rounded-lg border border-border-subtle bg-background px-3 py-2 text-sm outline-none focus:border-accent"
      />
      <p className="mt-2 whitespace-pre-line rounded-lg bg-surface-alt p-3 text-xs text-muted">{preview}</p>
    </div>
  );
}
