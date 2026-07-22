"use client";

import { useEffect, useRef, useState } from "react";
import { Building2, Camera, Clock, MessageSquare, Plus, RotateCcw, X } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { buscarMeuSalao, atualizarSalao, listarHorarios, salvarHorario, deletarHorario } from "@/lib/repositories";
import { enviarLogo } from "@/lib/repositories/logoRepository";
import { Salao, HorarioFuncionamento } from "@/lib/types";
import {
  mensagemPadraoCancelamento,
  mensagemPadraoConfirmacao,
  mensagemPadraoRemarcacao,
  mensagemPadraoRetorno,
  montarMensagemRetorno,
  substituirMarcadores,
} from "@/lib/mensagens";

const DIAS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
const DURACOES = [15, 30, 45, 60, 90, 120];

const inputClass =
  "w-full rounded-xl border border-border-subtle bg-surface px-4 py-3 outline-none transition-colors focus:border-accent";
const labelClass = "text-xs font-medium uppercase tracking-wide text-muted";

export default function MeuNegocioPage() {
  const { perfil } = useAuth();
  const [salao, setSalao] = useState<Salao | null>(null);
  const [horarios, setHorarios] = useState<HorarioFuncionamento[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [enviandoLogo, setEnviandoLogo] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [mostrarNovoHorario, setMostrarNovoHorario] = useState(false);
  const inputLogoRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!perfil) return;
    carregar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [perfil?.id]);

  async function carregar() {
    if (!perfil) return;
    setCarregando(true);
    try {
      const [s, h] = await Promise.all([buscarMeuSalao(perfil.salao_id), listarHorarios(perfil.salao_id)]);
      setSalao(s);
      setHorarios(h);
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
    try {
      await atualizarSalao(salao);
    } finally {
      setSalvando(false);
    }
  }

  async function handleEscolherLogo(e: React.ChangeEvent<HTMLInputElement>) {
    const arquivo = e.target.files?.[0];
    if (!arquivo || !perfil) return;
    setEnviandoLogo(true);
    try {
      const url = await enviarLogo(perfil.salao_id, arquivo);
      atualizarCampo("logo_url", url);
    } finally {
      setEnviandoLogo(false);
      if (inputLogoRef.current) inputLogoRef.current.value = "";
    }
  }

  async function handleAdicionarHorario(dias: number[], abertura: string, fechamento: string) {
    if (!perfil) return;
    const novo: HorarioFuncionamento = { id: crypto.randomUUID(), salao_id: perfil.salao_id, dias, abertura, fechamento };
    await salvarHorario(novo);
    setMostrarNovoHorario(false);
    setHorarios(await listarHorarios(perfil.salao_id));
  }

  async function handleRemoverHorario(id: string) {
    await deletarHorario(id);
    if (perfil) setHorarios(await listarHorarios(perfil.salao_id));
  }

  if (carregando || !salao) {
    return (
      <div className="mx-auto max-w-2xl p-5 md:p-8">
        <div className="h-64 animate-pulse rounded-2xl bg-surface" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl p-5 pb-16 md:p-8">
      <h1 className="mb-6 text-2xl font-semibold tracking-tight">Meu Negócio</h1>

      <div className="mb-6 flex flex-col items-center gap-3">
        <div className="relative">
          {enviandoLogo ? (
            <div className="flex h-24 w-24 items-center justify-center rounded-2xl bg-surface">
              <div className="h-7 w-7 animate-spin rounded-full border-2 border-accent border-t-transparent" />
            </div>
          ) : salao.logo_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={salao.logo_url} alt={salao.nome} className="h-24 w-24 rounded-2xl object-cover" />
          ) : (
            <div className="flex h-24 w-24 items-center justify-center rounded-2xl bg-surface">
              <Building2 size={32} className="text-muted" />
            </div>
          )}
          <button
            onClick={() => inputLogoRef.current?.click()}
            className="absolute bottom-0 right-0 flex h-8 w-8 items-center justify-center rounded-full bg-accent text-accent-foreground shadow-lg transition-opacity hover:opacity-90"
          >
            <Camera size={14} />
          </button>
          <input ref={inputLogoRef} type="file" accept="image/*" className="hidden" onChange={handleEscolherLogo} />
        </div>
      </div>

      <div className="flex flex-col gap-4">
        <Campo label="Nome do salão">
          <input value={salao.nome} onChange={(e) => atualizarCampo("nome", e.target.value)} className={inputClass} />
        </Campo>

        <div className="grid grid-cols-2 gap-3">
          <Campo label="CNPJ">
            <input value={salao.cnpj ?? ""} onChange={(e) => atualizarCampo("cnpj", e.target.value)} className={inputClass} />
          </Campo>
          <Campo label="Tipo de empresa">
            <select
              value={salao.tipo_empresa ?? "MEI"}
              onChange={(e) => atualizarCampo("tipo_empresa", e.target.value)}
              className={inputClass}
            >
              {["MEI", "EI", "LTDA", "Autônomo"].map((t) => (
                <option key={t} value={t} className="bg-surface">
                  {t}
                </option>
              ))}
            </select>
          </Campo>
        </div>

        <Campo label="Faturamento mensal aproximado">
          <input
            value={salao.faturamento_mensal ?? ""}
            onChange={(e) => atualizarCampo("faturamento_mensal", e.target.value)}
            className={inputClass}
          />
        </Campo>

        <Campo label="Endereço">
          <input value={salao.endereco ?? ""} onChange={(e) => atualizarCampo("endereco", e.target.value)} className={inputClass} />
        </Campo>

        <div className="grid grid-cols-3 gap-3">
          <Campo label="CEP">
            <input value={salao.cep ?? ""} onChange={(e) => atualizarCampo("cep", e.target.value)} className={inputClass} />
          </Campo>
          <Campo label="Número">
            <input value={salao.numero ?? ""} onChange={(e) => atualizarCampo("numero", e.target.value)} className={inputClass} />
          </Campo>
          <Campo label="Bairro">
            <input value={salao.bairro ?? ""} onChange={(e) => atualizarCampo("bairro", e.target.value)} className={inputClass} />
          </Campo>
        </div>

        <Campo label="Celular da unidade">
          <input
            value={salao.celular_unidade ?? ""}
            onChange={(e) => atualizarCampo("celular_unidade", e.target.value.replace(/\D/g, ""))}
            className={inputClass}
          />
        </Campo>

        <Campo label="WhatsApp">
          <input
            value={salao.whatsapp ?? ""}
            onChange={(e) => atualizarCampo("whatsapp", e.target.value.replace(/\D/g, ""))}
            className={inputClass}
          />
        </Campo>

        <Campo label="Instagram">
          <input value={salao.instagram_url ?? ""} onChange={(e) => atualizarCampo("instagram_url", e.target.value)} className={inputClass} />
        </Campo>

        <Campo label="Descrição">
          <textarea
            value={salao.descricao ?? ""}
            onChange={(e) => atualizarCampo("descricao", e.target.value)}
            className={inputClass}
            rows={3}
          />
        </Campo>

        <div className="card-elevated flex items-center justify-between rounded-xl bg-surface p-4">
          <p className="text-sm font-medium">Cliente escolhe o profissional</p>
          <Toggle valor={salao.cliente_escolhe_profissional} onMudar={(v) => atualizarCampo("cliente_escolhe_profissional", v)} />
        </div>

        <Campo label="Duração padrão do atendimento">
          <select
            value={salao.duracao_padrao_minutos}
            onChange={(e) => atualizarCampo("duracao_padrao_minutos", parseInt(e.target.value))}
            className={inputClass}
          >
            {DURACOES.map((d) => (
              <option key={d} value={d} className="bg-surface">
                {d} minutos
              </option>
            ))}
          </select>
        </Campo>

        <div className="card-elevated rounded-xl bg-surface p-4">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium">Antecedência mínima para agendar</p>
            <Toggle valor={salao.antecedencia_minima_ativa} onMudar={(v) => atualizarCampo("antecedencia_minima_ativa", v)} />
          </div>
          {salao.antecedencia_minima_ativa && (
            <input
              value={salao.antecedencia_minima_minutos}
              onChange={(e) => atualizarCampo("antecedencia_minima_minutos", parseInt(e.target.value.replace(/\D/g, "")) || 0)}
              placeholder="Minutos"
              className={`${inputClass} mt-3`}
            />
          )}
        </div>

        <button
          onClick={handleSalvar}
          disabled={salvando}
          className="rounded-xl bg-accent px-4 py-3.5 font-medium text-accent-foreground transition-opacity hover:opacity-90 disabled:opacity-60"
        >
          {salvando ? "Salvando..." : "Salvar alterações"}
        </button>

        {/* Mensagens */}
        <div className="mt-3 flex items-center gap-2">
          <MessageSquare size={16} className="text-accent" />
          <p className="font-medium">Mensagens automáticas</p>
        </div>

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

        {/* Horários */}
        <div className="mt-3 flex items-center gap-2">
          <Clock size={16} className="text-accent" />
          <p className="font-medium">Horários de funcionamento</p>
        </div>

        {horarios.length === 0 ? (
          <p className="text-sm text-muted">Nenhum horário cadastrado ainda.</p>
        ) : (
          <div className="flex flex-col gap-2">
            {horarios.map((h) => (
              <div key={h.id} className="card-elevated flex items-center justify-between rounded-xl bg-surface p-3.5">
                <div>
                  <p className="text-sm font-medium">{h.dias.map((d) => DIAS[d]).join(", ")}</p>
                  <p className="text-xs text-muted">
                    {h.abertura} — {h.fechamento}
                  </p>
                </div>
                <button
                  onClick={() => handleRemoverHorario(h.id)}
                  className="rounded-lg p-1.5 text-muted transition-colors hover:bg-danger/10 hover:text-danger"
                >
                  <X size={16} />
                </button>
              </div>
            ))}
          </div>
        )}

        <button
          onClick={() => setMostrarNovoHorario(true)}
          className="flex items-center justify-center gap-1.5 rounded-xl border border-border-subtle px-4 py-2.5 text-sm transition-colors hover:bg-surface"
        >
          <Plus size={15} /> Adicionar horário
        </button>
      </div>

      {mostrarNovoHorario && (
        <NovoHorarioModal onFechar={() => setMostrarNovoHorario(false)} onSalvar={handleAdicionarHorario} />
      )}
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

function NovoHorarioModal({
  onFechar,
  onSalvar,
}: {
  onFechar: () => void;
  onSalvar: (dias: number[], abertura: string, fechamento: string) => void;
}) {
  const [diasSelecionados, setDiasSelecionados] = useState<number[]>([]);
  const [abertura, setAbertura] = useState("09:00");
  const [fechamento, setFechamento] = useState("18:00");

  function alternarDia(dia: number) {
    setDiasSelecionados((atual) => (atual.includes(dia) ? atual.filter((d) => d !== dia) : [...atual, dia]));
  }

  return (
    <div className="fixed inset-0 z-30 flex items-center justify-center bg-black/60 p-5 backdrop-blur-sm">
      <div className="card-elevated w-full max-w-sm rounded-2xl bg-surface p-5">
        <div className="mb-4 flex items-center justify-between">
          <p className="font-medium">Adicionar horário</p>
          <button onClick={onFechar} className="text-muted hover:text-foreground">
            <X size={18} />
          </button>
        </div>
        <div className="mb-3 flex flex-wrap gap-1.5">
          {DIAS.map((d, i) => (
            <button
              key={i}
              onClick={() => alternarDia(i)}
              className={`rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
                diasSelecionados.includes(i) ? "bg-accent text-accent-foreground" : "bg-surface-alt text-muted"
              }`}
            >
              {d}
            </button>
          ))}
        </div>
        <div className="flex gap-2">
          <input
            type="time"
            value={abertura}
            onChange={(e) => setAbertura(e.target.value)}
            className="flex-1 rounded-xl border border-border-subtle bg-background px-3 py-2.5 text-sm outline-none focus:border-accent [color-scheme:dark]"
          />
          <input
            type="time"
            value={fechamento}
            onChange={(e) => setFechamento(e.target.value)}
            className="flex-1 rounded-xl border border-border-subtle bg-background px-3 py-2.5 text-sm outline-none focus:border-accent [color-scheme:dark]"
          />
        </div>
        <button
          onClick={() => diasSelecionados.length > 0 && onSalvar(diasSelecionados, abertura, fechamento)}
          className="mt-4 w-full rounded-xl bg-accent px-4 py-3 text-sm font-medium text-accent-foreground transition-opacity hover:opacity-90"
        >
          Salvar
        </button>
      </div>
    </div>
  );
}
