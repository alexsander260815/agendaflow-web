'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { ArrowLeft, Camera, FileSignature, Plus, X } from 'lucide-react';
import AssinaturaCanvas from '@/components/AssinaturaCanvas';
import { useAuth } from '@/lib/auth-context';
import { buscarCliente, enviarArquivoFicha, listarFichasDoCliente, salvarFichaTecnica } from '@/lib/repositories';
import { Cliente, FichaTecnica } from '@/lib/types';

export default function FichasTecnicasPage() {
  const { perfil } = useAuth();
  const params = useParams<{ id: string }>();
  const [cliente, setCliente] = useState<Cliente | null>(null);
  const [fichas, setFichas] = useState<FichaTecnica[]>([]);
  const [novaFicha, setNovaFicha] = useState(false);
  const [formula, setFormula] = useState('');
  const [observacoes, setObservacoes] = useState('');
  const [antes, setAntes] = useState<File | null>(null);
  const [depois, setDepois] = useState<File | null>(null);
  const [assinatura, setAssinatura] = useState<Blob | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    if (!perfil) return;
    Promise.all([buscarCliente(params.id), listarFichasDoCliente(params.id)]).then(([pessoa, lista]) => { setCliente(pessoa); setFichas(lista); });
  }, [perfil, params.id]);

  async function salvar() {
    if (!perfil || (!formula.trim() && !observacoes.trim())) {
      setErro('Preencha a fórmula ou as observações.');
      return;
    }
    setSalvando(true);
    setErro(null);
    try {
      const [fotoAntesUrl, fotoDepoisUrl, assinaturaUrl] = await Promise.all([
        antes ? enviarArquivoFicha(perfil.salao_id, 'antes', antes) : Promise.resolve(null),
        depois ? enviarArquivoFicha(perfil.salao_id, 'depois', depois) : Promise.resolve(null),
        assinatura ? enviarArquivoFicha(perfil.salao_id, 'assinatura', assinatura) : Promise.resolve(null),
      ]);
      await salvarFichaTecnica({
        id: crypto.randomUUID(), salao_id: perfil.salao_id, cliente_id: params.id, profissional_id: perfil.id,
        agendamento_id: null, formula: formula.trim(), observacoes: observacoes.trim(), foto_antes_url: fotoAntesUrl,
        foto_depois_url: fotoDepoisUrl, assinatura_url: assinaturaUrl, criado_em: new Date().toISOString(),
      });
      setFichas(await listarFichasDoCliente(params.id));
      setNovaFicha(false); setFormula(''); setObservacoes(''); setAntes(null); setDepois(null); setAssinatura(null);
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não foi possível salvar a ficha.');
    } finally { setSalvando(false); }
  }

  return (
    <div className='mx-auto max-w-3xl p-5 pb-16 md:p-8'>
      <div className='mb-6 flex items-center gap-3'><Link href={`/clientes/${params.id}`} className='rounded-lg p-2 text-muted hover:bg-surface hover:text-foreground'><ArrowLeft size={20} /></Link><div className='min-w-0 flex-1'><h1 className='truncate text-2xl font-semibold tracking-tight'>Fichas Técnicas</h1><p className='truncate text-sm text-muted'>{cliente?.nome ?? 'Cliente'}</p></div><button onClick={() => setNovaFicha(true)} className='flex items-center gap-1.5 rounded-xl bg-accent px-3 py-2.5 text-sm font-medium text-accent-foreground'><Plus size={16} /> Nova</button></div>

      {fichas.length === 0 ? <div className='rounded-2xl bg-surface p-8 text-center'><FileSignature size={30} className='mx-auto mb-3 text-muted' /><p className='font-medium'>Nenhuma ficha técnica</p><p className='mt-1 text-sm text-muted'>Registre fórmulas, observações, fotos e assinatura da cliente.</p></div> : <div className='flex flex-col gap-3'>{fichas.map((ficha) => <article key={ficha.id} className='card-elevated rounded-2xl bg-surface p-4'><div className='mb-3 flex items-center justify-between'><p className='text-sm font-medium'>{new Date(ficha.criado_em).toLocaleDateString('pt-BR', { dateStyle: 'long' })}</p>{ficha.assinatura_url && <span className='flex items-center gap-1 text-xs text-success'><FileSignature size={14} /> Assinada</span>}</div>{ficha.formula && <div className='mb-3'><p className='text-xs font-medium uppercase tracking-wide text-muted'>Fórmula</p><p className='mt-1 whitespace-pre-wrap text-sm'>{ficha.formula}</p></div>}{ficha.observacoes && <div className='mb-3'><p className='text-xs font-medium uppercase tracking-wide text-muted'>Observações</p><p className='mt-1 whitespace-pre-wrap text-sm'>{ficha.observacoes}</p></div>}{(ficha.foto_antes_url || ficha.foto_depois_url) && <div className='grid grid-cols-2 gap-2'>{ficha.foto_antes_url && <div><p className='mb-1 text-xs text-muted'>Antes</p>{/* eslint-disable-next-line @next/next/no-img-element */}<img src={ficha.foto_antes_url} alt='Antes' className='h-40 w-full rounded-xl object-cover' /></div>}{ficha.foto_depois_url && <div><p className='mb-1 text-xs text-muted'>Depois</p>{/* eslint-disable-next-line @next/next/no-img-element */}<img src={ficha.foto_depois_url} alt='Depois' className='h-40 w-full rounded-xl object-cover' /></div>}</div>}</article>)}</div>}

      {novaFicha && <div className='fixed inset-0 z-40 flex items-end justify-center bg-black/65 p-0 backdrop-blur-sm sm:items-center sm:p-5'><div className='max-h-[92vh] w-full max-w-xl overflow-y-auto rounded-t-2xl bg-surface p-5 sm:rounded-2xl'><div className='mb-5 flex items-center justify-between'><div><p className='font-semibold'>Nova ficha técnica</p><p className='text-xs text-muted'>{cliente?.nome}</p></div><button onClick={() => setNovaFicha(false)} className='rounded-lg p-1.5 text-muted hover:bg-surface-alt'><X size={18} /></button></div><div className='flex flex-col gap-4'><label className='text-xs font-medium uppercase tracking-wide text-muted'>Fórmula<textarea rows={4} value={formula} onChange={(e) => setFormula(e.target.value)} placeholder='Produtos, tons, proporções, tempo de pausa...' className='mt-1.5 w-full rounded-xl border border-border-subtle bg-background px-3 py-3 text-sm normal-case outline-none focus:border-accent' /></label><label className='text-xs font-medium uppercase tracking-wide text-muted'>Observações<textarea rows={3} value={observacoes} onChange={(e) => setObservacoes(e.target.value)} className='mt-1.5 w-full rounded-xl border border-border-subtle bg-background px-3 py-3 text-sm normal-case outline-none focus:border-accent' /></label><div className='grid grid-cols-2 gap-2'><label className='flex cursor-pointer flex-col items-center gap-2 rounded-xl border border-dashed border-border-subtle p-4 text-sm text-muted hover:border-accent'><Camera size={20} /><span>{antes ? antes.name : 'Foto antes'}</span><input type='file' accept='image/*' capture='environment' className='hidden' onChange={(e) => setAntes(e.target.files?.[0] ?? null)} /></label><label className='flex cursor-pointer flex-col items-center gap-2 rounded-xl border border-dashed border-border-subtle p-4 text-sm text-muted hover:border-accent'><Camera size={20} /><span>{depois ? depois.name : 'Foto depois'}</span><input type='file' accept='image/*' capture='environment' className='hidden' onChange={(e) => setDepois(e.target.files?.[0] ?? null)} /></label></div><div><p className='mb-1.5 text-xs font-medium uppercase tracking-wide text-muted'>Assinatura da cliente</p><AssinaturaCanvas onChange={setAssinatura} /></div>{erro && <p className='rounded-xl bg-danger/10 p-3 text-sm text-danger'>{erro}</p>}<button onClick={salvar} disabled={salvando} className='rounded-xl bg-accent px-4 py-3.5 font-medium text-accent-foreground disabled:opacity-60'>{salvando ? 'Salvando ficha...' : 'Salvar ficha técnica'}</button></div></div></div>}
    </div>
  );
}
