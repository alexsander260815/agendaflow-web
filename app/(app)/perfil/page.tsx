"use client";

import { useRef, useState } from "react";
import { Camera, Landmark, Palette, UserRound } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { atualizarPixPerfil, atualizarTemaVisual, definirAtendeClientes } from "@/lib/repositories/perfilRepository";
import { enviarFotoPerfil } from "@/lib/repositories/fotoPerfilRepository";
import { corAvatar, iniciais } from "@/lib/avatar";
import { aplicarTemaVisual, TEMAS_VISUAIS } from "@/lib/theme";

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
  const [chavePix, setChavePix] = useState(() => perfil?.chave_pix ?? '');
  const [nomeBeneficiario, setNomeBeneficiario] = useState(() => perfil?.pix_nome_beneficiario ?? perfil?.nome ?? '');
  const [cidadePix, setCidadePix] = useState(() => perfil?.pix_cidade ?? '');
  const [salvandoPix, setSalvandoPix] = useState(false);
  const [pixSalvo, setPixSalvo] = useState(false);
  const [salvandoTema, setSalvandoTema] = useState<string | null>(null);
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

  async function handleEscolherTema(temaId: string) {
    if (!perfil) return;
    setSalvandoTema(temaId);
    aplicarTemaVisual(temaId);
    try {
      await atualizarTemaVisual(perfil.id, temaId);
      await refrescarPerfil();
    } finally {
      setSalvandoTema(null);
    }
  }

  async function handleSalvarPix() {
    if (!perfil) return;
    setSalvandoPix(true);
    setPixSalvo(false);
    setErro(null);
    try {
      await atualizarPixPerfil(perfil.id, chavePix, nomeBeneficiario, cidadePix);
      await refrescarPerfil();
      setPixSalvo(true);
    } catch (err) {
      setErro(err instanceof Error ? err.message : 'Erro ao salvar o Pix.');
    } finally {
      setSalvandoPix(false);
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

        <section className='card-elevated mt-2 w-full rounded-2xl bg-surface p-4'>
          <div className='mb-4 flex items-start gap-2'>
            <Palette size={18} className='mt-0.5 text-accent' />
            <div>
              <p className='font-medium'>Minha cor</p>
              <p className='text-xs text-muted'>Só muda a cor da sua conta — o resto da equipe pode usar outra.</p>
            </div>
          </div>
          <div className='grid gap-2 sm:grid-cols-2'>
            {TEMAS_VISUAIS.map((tema) => {
              const selecionado = (perfil.tema_visual || 'azul_grafite') === tema.id;
              return (
                <button
                  key={tema.id}
                  type='button'
                  onClick={() => handleEscolherTema(tema.id)}
                  disabled={salvandoTema !== null}
                  className={`relative rounded-xl border p-3 text-left transition-all disabled:opacity-60 ${
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

        <section className='card-elevated mt-2 w-full rounded-2xl bg-surface p-4'>
          <div className='mb-4 flex items-start gap-2'>
            <Landmark size={18} className='mt-0.5 text-accent' />
            <div>
              <p className='font-medium'>Meu Pix para receber sinais</p>
              <p className='text-xs text-muted'>Será usado quando o salão escolher cobrar o sinal direto para o profissional.</p>
            </div>
          </div>
          <div className='flex flex-col gap-3'>
            <label className='text-xs font-medium uppercase tracking-wide text-muted'>Chave Pix
              <input value={chavePix} onChange={(e) => setChavePix(e.target.value)} placeholder='CPF, CNPJ, e-mail, telefone ou chave aleatória' className='mt-1.5 w-full rounded-xl border border-border-subtle bg-background px-3 py-3 text-sm outline-none focus:border-accent' />
            </label>
            <label className='text-xs font-medium uppercase tracking-wide text-muted'>Nome do beneficiário
              <input value={nomeBeneficiario} onChange={(e) => setNomeBeneficiario(e.target.value)} className='mt-1.5 w-full rounded-xl border border-border-subtle bg-background px-3 py-3 text-sm outline-none focus:border-accent' />
            </label>
            <label className='text-xs font-medium uppercase tracking-wide text-muted'>Cidade
              <input value={cidadePix} onChange={(e) => setCidadePix(e.target.value)} className='mt-1.5 w-full rounded-xl border border-border-subtle bg-background px-3 py-3 text-sm outline-none focus:border-accent' />
            </label>
            <button onClick={handleSalvarPix} disabled={salvandoPix} className='rounded-xl bg-accent px-4 py-3 text-sm font-medium text-accent-foreground disabled:opacity-60'>
              {salvandoPix ? 'Salvando...' : 'Salvar meu Pix'}
            </button>
            {pixSalvo && <p className='text-center text-xs text-success'>Pix salvo com sucesso.</p>}
          </div>
        </section>
      </div>
    </div>
  );
}
