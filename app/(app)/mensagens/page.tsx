"use client";

import { useEffect, useState } from "react";
import { MessageSquare, RotateCcw } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { atualizarMinhasMensagens, atualizarSalao, buscarMeuSalao, buscarPerfil } from "@/lib/repositories";
import { Perfil, Salao } from "@/lib/types";
import {
  mensagemPadraoCancelamento,
  mensagemPadraoConfirmacao,
  mensagemPadraoRemarcacao,
  mensagemPadraoRetorno,
  montarMensagemRetorno,
  substituirMarcadores,
} from "@/lib/mensagens";

type Campos = {
  mensagem_confirmacao: string | null;
  mensagem_remarcacao: string | null;
  mensagem_cancelamento: string | null;
  mensagem_retorno: string | null;
};

export default function MensagensPage() {
  const { perfil } = useAuth();
  const souDono = perfil?.papel === "DONO";

  const [salao, setSalao] = useState<Salao | null>(null);
  const [meuPerfil, setMeuPerfil] = useState<Perfil | null>(null);
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
      const [negocio, eu] = await Promise.all([buscarMeuSalao(perfil.salao_id), buscarPerfil(perfil.id)]);
      setSalao(negocio);
      setMeuPerfil(eu);
    } finally {
      setCarregando(false);
    }
  }

  function atualizarCampoSalao<K extends keyof Salao>(campo: K, valor: Salao[K]) {
    setSalao((atual) => (atual ? { ...atual, [campo]: valor } : atual));
  }

  function atualizarCampoPerfil<K extends keyof Campos>(campo: K, valor: string) {
    setMeuPerfil((atual) => (atual ? { ...atual, [campo]: valor || null } : atual));
  }

  async function handleSalvarSalao() {
    if (!salao) return;
    setSalvando(true);
    setMensagemSalvar(null);
    try {
      await atualizarSalao(salao);
      setMensagemSalvar({ tipo: "sucesso", texto: "Mensagens do salão salvas!" });
    } catch (e) {
      const mensagem = e instanceof Error ? e.message : "Erro desconhecido";
      setMensagemSalvar({ tipo: "erro", texto: `Não foi possível salvar: ${mensagem}` });
    } finally {
      setSalvando(false);
      setTimeout(() => setMensagemSalvar(null), 5000);
    }
  }

  async function handleSalvarMinhas() {
    if (!meuPerfil) return;
    setSalvando(true);
    setMensagemSalvar(null);
    try {
      await atualizarMinhasMensagens(meuPerfil.id, {
        mensagem_confirmacao: meuPerfil.mensagem_confirmacao ?? null,
        mensagem_remarcacao: meuPerfil.mensagem_remarcacao ?? null,
        mensagem_cancelamento: meuPerfil.mensagem_cancelamento ?? null,
        mensagem_retorno: meuPerfil.mensagem_retorno ?? null,
      });
      setMensagemSalvar({ tipo: "sucesso", texto: "Suas mensagens foram salvas!" });
    } catch (e) {
      const mensagem = e instanceof Error ? e.message : "Erro desconhecido";
      setMensagemSalvar({ tipo: "erro", texto: `Não foi possível salvar: ${mensagem}` });
    } finally {
      setSalvando(false);
      setTimeout(() => setMensagemSalvar(null), 5000);
    }
  }

  if (carregando || !salao) {
    return (
      <div className="mx-auto max-w-2xl p-5 md:p-8">
        <div className="h-64 animate-pulse rounded-2xl bg-surface" />
      </div>
    );
  }

  const forcando = salao.forcar_mensagem_padrao;

  return (
    <div className="mx-auto max-w-2xl p-5 pb-16 md:p-8">
      <div className="mb-6 flex items-center gap-2">
        <MessageSquare size={20} className="text-accent" />
        <h1 className="text-2xl font-semibold tracking-tight">Mensagens</h1>
      </div>

      {souDono && (
        <div className="mb-6 flex flex-col gap-4">
          <div className="card-elevated rounded-xl bg-surface p-4">
            <p className="text-sm font-medium">Mensagens do salão</p>
            <p className="mt-1 text-xs text-muted">
              É a que você usa. Cada profissional pode ter as próprias mensagens (editam em &quot;Minhas mensagens&quot;, mais abaixo, no perfil de cada um) — a do salão só entra se a pessoa não tiver personalizado a dela.
            </p>
          </div>

          <div className="card-elevated flex items-center justify-between rounded-xl bg-surface p-4">
            <div>
              <p className="text-sm font-medium">Forçar minha mensagem pra todo mundo</p>
              <p className="text-xs text-muted">Quando ligado, ignora a mensagem que cada profissional personalizou e usa sempre a do salão.</p>
            </div>
            <Toggle valor={forcando} onMudar={(v) => atualizarCampoSalao("forcar_mensagem_padrao", v)} />
          </div>

          <CampoMensagem
            titulo="Confirmação"
            valor={salao.mensagem_confirmacao ?? mensagemPadraoConfirmacao()}
            padrao={mensagemPadraoConfirmacao()}
            onMudar={(v) => atualizarCampoSalao("mensagem_confirmacao", v)}
          />
          <CampoMensagem
            titulo="Remarcação"
            valor={salao.mensagem_remarcacao ?? mensagemPadraoRemarcacao()}
            padrao={mensagemPadraoRemarcacao()}
            onMudar={(v) => atualizarCampoSalao("mensagem_remarcacao", v)}
          />
          <CampoMensagem
            titulo="Cancelamento"
            valor={salao.mensagem_cancelamento ?? mensagemPadraoCancelamento()}
            padrao={mensagemPadraoCancelamento()}
            onMudar={(v) => atualizarCampoSalao("mensagem_cancelamento", v)}
          />

          <div className="card-elevated rounded-xl bg-surface p-4">
            <div className="mb-2 flex items-center justify-between">
              <p className="text-sm font-medium">Retorno de cliente</p>
              <button
                onClick={() => atualizarCampoSalao("mensagem_retorno", mensagemPadraoRetorno())}
                className="flex items-center gap-1 text-xs text-muted transition-colors hover:text-accent"
              >
                <RotateCcw size={11} /> Restaurar padrão
              </button>
            </div>
            <p className="mb-2 text-xs text-muted">Marcadores: {"{nome}"}, {"{servico}"}, {"{dias}"}</p>
            <textarea
              value={salao.mensagem_retorno ?? mensagemPadraoRetorno()}
              onChange={(e) => atualizarCampoSalao("mensagem_retorno", e.target.value)}
              rows={4}
              className="w-full rounded-lg border border-border-subtle bg-background px-3 py-2 text-sm outline-none focus:border-accent"
            />
            <p className="mt-2 whitespace-pre-line rounded-lg bg-surface-alt p-3 text-xs text-muted">
              {montarMensagemRetorno(salao.mensagem_retorno ?? mensagemPadraoRetorno(), "Maria", "Manicure", 15)}
            </p>
          </div>

          <button
            onClick={handleSalvarSalao}
            disabled={salvando}
            className="rounded-xl bg-accent px-4 py-3.5 font-medium text-accent-foreground transition-opacity hover:opacity-90 disabled:opacity-60"
          >
            {salvando ? "Salvando..." : "Salvar mensagens do salão"}
          </button>
        </div>
      )}

      {!souDono && forcando ? (
        <div className="card-elevated rounded-2xl bg-surface p-6 text-center">
          <p className="text-sm text-muted">
            O dono do salão ativou o envio da mensagem padrão do salão pra todo mundo — suas mensagens pessoais não estão sendo usadas no momento.
          </p>
        </div>
      ) : (
        meuPerfil && (
          <div className="flex flex-col gap-4">
            <div className="card-elevated rounded-xl bg-surface p-4">
              <p className="text-sm font-medium">Minhas mensagens</p>
              <p className="mt-1 text-xs text-muted">
                Só valem pra você. Deixe em branco pra usar a mensagem padrão do salão.
              </p>
            </div>

            <CampoMensagem
              titulo="Confirmação"
              valor={meuPerfil.mensagem_confirmacao ?? ""}
              padrao=""
              placeholder={salao.mensagem_confirmacao ?? mensagemPadraoConfirmacao()}
              onMudar={(v) => atualizarCampoPerfil("mensagem_confirmacao", v)}
            />
            <CampoMensagem
              titulo="Remarcação"
              valor={meuPerfil.mensagem_remarcacao ?? ""}
              padrao=""
              placeholder={salao.mensagem_remarcacao ?? mensagemPadraoRemarcacao()}
              onMudar={(v) => atualizarCampoPerfil("mensagem_remarcacao", v)}
            />
            <CampoMensagem
              titulo="Cancelamento"
              valor={meuPerfil.mensagem_cancelamento ?? ""}
              padrao=""
              placeholder={salao.mensagem_cancelamento ?? mensagemPadraoCancelamento()}
              onMudar={(v) => atualizarCampoPerfil("mensagem_cancelamento", v)}
            />
            <CampoMensagem
              titulo="Retorno de cliente"
              valor={meuPerfil.mensagem_retorno ?? ""}
              padrao=""
              placeholder={salao.mensagem_retorno ?? mensagemPadraoRetorno()}
              onMudar={(v) => atualizarCampoPerfil("mensagem_retorno", v)}
            />

            <button
              onClick={handleSalvarMinhas}
              disabled={salvando}
              className="rounded-xl bg-accent px-4 py-3.5 font-medium text-accent-foreground transition-opacity hover:opacity-90 disabled:opacity-60"
            >
              {salvando ? "Salvando..." : "Salvar minhas mensagens"}
            </button>
          </div>
        )
      )}

      {mensagemSalvar && (
        <p className={`mt-4 text-sm ${mensagemSalvar.tipo === "sucesso" ? "text-accent" : "text-danger"}`}>
          {mensagemSalvar.texto}
        </p>
      )}
    </div>
  );
}

function CampoMensagem({
  titulo,
  valor,
  padrao,
  placeholder,
  onMudar,
}: {
  titulo: string;
  valor: string;
  padrao: string;
  placeholder?: string;
  onMudar: (v: string) => void;
}) {
  const preview = substituirMarcadores(valor || placeholder || "", "Maria", Date.now(), "Ana", "Corte Feminino");
  return (
    <div className="card-elevated rounded-xl bg-surface p-4">
      <div className="mb-2 flex items-center justify-between">
        <p className="text-sm font-medium">{titulo}</p>
        {padrao && (
          <button
            onClick={() => onMudar(padrao)}
            className="flex items-center gap-1 text-xs text-muted transition-colors hover:text-accent"
          >
            <RotateCcw size={11} /> Restaurar padrão
          </button>
        )}
      </div>
      <textarea
        value={valor}
        onChange={(e) => onMudar(e.target.value)}
        placeholder={placeholder}
        rows={4}
        className="w-full rounded-lg border border-border-subtle bg-background px-3 py-2 text-sm outline-none focus:border-accent"
      />
      <p className="mt-2 whitespace-pre-line rounded-lg bg-surface-alt p-3 text-xs text-muted">{preview}</p>
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
