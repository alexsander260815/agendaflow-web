"use client";

import { useEffect, useRef, useState } from "react";
import { Building2, Camera, Clock, Palette } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import AcessoRestrito from "@/components/AcessoRestrito";
import HorariosFuncionamento from "@/components/HorariosFuncionamento";
import { buscarMeuSalao, atualizarSalao, listarHorarios, salvarHorario, deletarHorario } from "@/lib/repositories";
import { enviarLogo } from "@/lib/repositories/logoRepository";
import { Salao, HorarioFuncionamento } from "@/lib/types";
import { aplicarTemaVisual, TEMAS_VISUAIS } from '@/lib/theme';

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
  const [mensagemSalvar, setMensagemSalvar] = useState<{ tipo: "sucesso" | "erro"; texto: string } | null>(null);
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
      setHorarios(h.filter((horario) => !horario.profissional_id));
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

  async function handleEscolherLogo(e: React.ChangeEvent<HTMLInputElement>) {
    const arquivo = e.target.files?.[0];
    if (!arquivo || !perfil) return;
    setEnviandoLogo(true);
    setMensagemSalvar(null);
    try {
      const url = await enviarLogo(perfil.salao_id, arquivo);
      atualizarCampo("logo_url", url);
    } catch (e) {
      const mensagem = e instanceof Error ? e.message : "Erro desconhecido";
      setMensagemSalvar({ tipo: "erro", texto: `Não foi possível salvar o logo: ${mensagem}` });
      setTimeout(() => setMensagemSalvar(null), 5000);
    } finally {
      setEnviandoLogo(false);
      if (inputLogoRef.current) inputLogoRef.current.value = "";
    }
  }

  async function handleAdicionarHorario(dias: number[], abertura: string, fechamento: string) {
    if (!perfil) return;
    const novo: HorarioFuncionamento = {
      id: crypto.randomUUID(),
      salao_id: perfil.salao_id,
      profissional_id: null,
      dias,
      abertura,
      fechamento,
    };
    await salvarHorario(novo);
    setHorarios((await listarHorarios(perfil.salao_id)).filter((h) => !h.profissional_id));
  }

  async function handleRemoverHorario(id: string) {
    await deletarHorario(id);
    if (perfil) setHorarios((await listarHorarios(perfil.salao_id)).filter((h) => !h.profissional_id));
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

        <section className='card-elevated rounded-2xl bg-surface p-4'>
          <div className='mb-4 flex items-center gap-2'>
            <Palette size={17} className='text-accent' />
            <div>
              <p className='font-medium'>Cor padrão do salão</p>
              <p className='text-xs text-muted'>Vale pra agenda pública e pra quem ainda não escolheu a própria cor em Meu Perfil.</p>
            </div>
          </div>
          <div className='grid gap-2 sm:grid-cols-2'>
            {TEMAS_VISUAIS.map((tema) => {
              const selecionado = (salao.tema_visual || 'azul_grafite') === tema.id;
              return (
                <button
                  key={tema.id}
                  type='button'
                  onClick={() => {
                    atualizarCampo('tema_visual', tema.id);
                    aplicarTemaVisual(tema.id);
                  }}
                  className={`relative rounded-xl border p-3 text-left transition-all ${
                    selecionado ? 'border-accent bg-accent/10' : 'border-border-subtle hover:bg-surface-alt'
                  }`}
                >
                  {tema.novo && <span className='absolute right-2 top-2 rounded-full bg-accent/15 px-2 py-0.5 text-[10px] font-semibold text-accent'>NOVO</span>}
                  <div className='mb-2 flex gap-1.5'>
                    {tema.cores.map((cor) => <span key={cor} className='h-6 w-6 rounded-full border border-white/15' style={{ backgroundColor: cor }} />)}
                  </div>
                  <p className='text-sm font-medium'>{tema.nome}</p>
                  <p className='text-xs text-muted'>{tema.descricao}</p>
                </button>
              );
            })}
          </div>
        </section>

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

        {/* Horários */}
        <div className="mt-3 flex items-center gap-2">
          <Clock size={16} className="text-accent" />
          <p className="font-medium">Horários de funcionamento</p>
        </div>

        <HorariosFuncionamento horarios={horarios} onAdicionar={handleAdicionarHorario} onRemover={handleRemoverHorario} />
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

