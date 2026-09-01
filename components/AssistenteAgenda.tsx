'use client';

import { useState } from 'react';
import { usePathname } from 'next/navigation';
import { Mic, Send, Sparkles, Volume2, X } from 'lucide-react';
import { supabase } from '@/lib/supabase';

interface ReconhecimentoResultado { results: ArrayLike<{ 0: { transcript: string } }> }
interface ReconhecimentoVoz {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  start: () => void;
  onresult: ((evento: ReconhecimentoResultado) => void) | null;
  onerror: (() => void) | null;
  onend: (() => void) | null;
}

export default function AssistenteAgenda() {
  const pathname = usePathname();
  const [aberto, setAberto] = useState(false);
  const [pergunta, setPergunta] = useState('');
  const [resposta, setResposta] = useState('');
  const [ouvindo, setOuvindo] = useState(false);
  const [carregando, setCarregando] = useState(false);
  const visivel = pathname === '/' || pathname === '/agenda';
  if (!visivel) return null;

  async function perguntar(texto = pergunta) {
    const perguntaFinal = texto.trim();
    if (!perguntaFinal) return;
    setCarregando(true);
    setResposta('');
    try {
      const { data, error } = await supabase.functions.invoke('assistente-agenda', { body: { pergunta: perguntaFinal } });
      if (error) throw error;
      setResposta(data?.resposta || data?.erro || 'Não encontrei uma resposta para isso.');
    } catch (e) {
      setResposta(e instanceof Error ? `Não consegui consultar agora: ${e.message}` : 'Não consegui consultar agora.');
    } finally { setCarregando(false); }
  }

  function ouvir() {
    const Janela = window as typeof window & { SpeechRecognition?: new () => ReconhecimentoVoz; webkitSpeechRecognition?: new () => ReconhecimentoVoz };
    const Construtor = Janela.SpeechRecognition || Janela.webkitSpeechRecognition;
    if (!Construtor) { setResposta('Seu navegador não oferece reconhecimento de voz. Você pode digitar a pergunta abaixo.'); setAberto(true); return; }
    const reconhecimento = new Construtor();
    reconhecimento.lang = 'pt-BR'; reconhecimento.interimResults = false; reconhecimento.continuous = false;
    reconhecimento.onresult = (evento) => { const texto = evento.results[0][0].transcript; setPergunta(texto); perguntar(texto); };
    reconhecimento.onerror = () => { setOuvindo(false); setResposta('Não consegui ouvir. Tente novamente ou digite a pergunta.'); };
    reconhecimento.onend = () => setOuvindo(false);
    setAberto(true); setOuvindo(true); reconhecimento.start();
  }

  function falar() {
    if (!resposta || !('speechSynthesis' in window)) return;
    window.speechSynthesis.cancel();
    const fala = new SpeechSynthesisUtterance(resposta); fala.lang = 'pt-BR'; window.speechSynthesis.speak(fala);
  }

  return (
    <>
      <button onClick={ouvir} aria-label='Abrir assistente por voz' className='fixed bottom-56 right-5 z-20 flex h-14 w-14 items-center justify-center rounded-full bg-accent text-accent-foreground shadow-xl transition-transform hover:scale-105 md:bottom-44 md:right-5'><Mic size={22} /></button>
      {aberto && <div className='fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-0 backdrop-blur-sm sm:items-center sm:p-5' onClick={() => setAberto(false)}><div className='w-full max-w-lg rounded-t-2xl bg-surface p-5 sm:rounded-2xl' onClick={(e) => e.stopPropagation()}><div className='mb-4 flex items-center gap-2'><span className='rounded-lg bg-accent/15 p-2 text-accent'><Sparkles size={18} /></span><div className='flex-1'><p className='font-medium'>Assistente da Agenda</p><p className='text-xs text-muted'>{ouvindo ? 'Estou ouvindo...' : 'Pergunte sobre horários e compromissos'}</p></div><button onClick={() => setAberto(false)} className='p-1.5 text-muted'><X size={18} /></button></div><div className='flex gap-2'><input value={pergunta} onChange={(e) => setPergunta(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && perguntar()} placeholder='Ex.: O que tenho amanhã?' className='min-w-0 flex-1 rounded-xl border border-border-subtle bg-background px-3 py-3 outline-none focus:border-accent' /><button onClick={() => perguntar()} disabled={carregando} className='rounded-xl bg-accent px-4 text-accent-foreground disabled:opacity-60'><Send size={18} /></button></div>{carregando && <div className='mt-4 h-20 animate-pulse rounded-xl bg-surface-alt' />}{resposta && <div className='mt-4 rounded-xl bg-surface-alt p-4'><p className='whitespace-pre-wrap text-sm leading-relaxed'>{resposta}</p><button onClick={falar} className='mt-3 flex items-center gap-1.5 text-xs text-accent'><Volume2 size={14} /> Ouvir resposta</button></div>}<button onClick={ouvir} className={`mt-4 flex w-full items-center justify-center gap-2 rounded-xl border py-3 text-sm ${ouvindo ? 'border-danger bg-danger/10 text-danger' : 'border-border-subtle text-muted'}`}><Mic size={17} /> {ouvindo ? 'Ouvindo...' : 'Falar pergunta'}</button></div></div>}
    </>
  );
}
