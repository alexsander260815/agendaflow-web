'use client';

import { useEffect, useMemo, useState } from 'react';
import { Target, TrendingUp, Users } from 'lucide-react';
import AcessoRestrito from '@/components/AcessoRestrito';
import { useAuth } from '@/lib/auth-context';
import { formatarMoeda } from '@/lib/datetime';
import { profissionaisVisiveisFinanceiro } from '@/lib/permissoes';
import { atualizarSalao, buscarMeuSalao, listarAgendamentos, listarAgendamentoServicos, listarEquipe } from '@/lib/repositories';
import { Perfil, Salao } from '@/lib/types';

interface LinhaProfissional { perfil: Perfil; receita: number; atendimentos: number }

export default function MetaFaturamentoPage() {
  const { perfil, mostrarFinanceiro } = useAuth();
  const [salao, setSalao] = useState<Salao | null>(null);
  const [receita, setReceita] = useState(0);
  const [atendimentos, setAtendimentos] = useState(0);
  const [linhas, setLinhas] = useState<LinhaProfissional[]>([]);
  const [metaDigitada, setMetaDigitada] = useState('');
  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    if (!perfil) return;
    // eslint-disable-next-line react-hooks/immutability
    carregar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [perfil?.id]);

  async function carregar() {
    if (!perfil) return;
    setCarregando(true);
    try {
      const [negocio, agendamentos, itens, equipe, visiveis] = await Promise.all([
        buscarMeuSalao(perfil.salao_id),
        listarAgendamentos(perfil.salao_id),
        listarAgendamentoServicos(perfil.salao_id),
        listarEquipe(perfil.salao_id),
        profissionaisVisiveisFinanceiro(perfil),
      ]);
      const inicioMes = new Date();
      inicioMes.setDate(1);
      inicioMes.setHours(0, 0, 0, 0);
      const concluidos = agendamentos.filter((ag) =>
        ag.status === 'CONCLUIDO' &&
        new Date(ag.data_hora).getTime() >= inicioMes.getTime() &&
        (visiveis === null || (ag.profissional_id && visiveis.includes(ag.profissional_id)))
      );
      const precos = new Map<string, number>();
      itens.forEach((item) => precos.set(item.agendamento_id, (precos.get(item.agendamento_id) ?? 0) + item.preco));
      const total = concluidos.reduce((soma, ag) => soma + (precos.get(ag.id) ?? 0), 0);
      const porProfissional = equipe.map((pessoa) => {
        const lista = concluidos.filter((ag) => ag.profissional_id === pessoa.id);
        return { perfil: pessoa, atendimentos: lista.length, receita: lista.reduce((soma, ag) => soma + (precos.get(ag.id) ?? 0), 0) };
      }).filter((linha) => linha.receita > 0).sort((a, b) => b.receita - a.receita);
      setSalao(negocio);
      setMetaDigitada(String(negocio?.meta_faturamento_mensal ?? ''));
      setReceita(total);
      setAtendimentos(concluidos.length);
      setLinhas(porProfissional);
    } finally {
      setCarregando(false);
    }
  }

  const meta = Number(salao?.meta_faturamento_mensal) || 0;
  const percentual = useMemo(() => meta > 0 ? Math.min(100, (receita / meta) * 100) : 0, [meta, receita]);

  async function salvarMeta() {
    if (!salao) return;
    setSalvando(true);
    try {
      const atualizado = { ...salao, meta_faturamento_mensal: Number(metaDigitada) || null };
      await atualizarSalao(atualizado);
      setSalao(atualizado);
    } finally {
      setSalvando(false);
    }
  }

  if (perfil && !mostrarFinanceiro) return <AcessoRestrito />;
  if (carregando) return <div className='mx-auto max-w-3xl p-5 md:p-8'><div className='h-64 animate-pulse rounded-2xl bg-surface' /></div>;

  return (
    <div className='mx-auto max-w-3xl p-5 pb-16 md:p-8'>
      <div className='mb-6 flex items-center gap-3'>
        <div className='rounded-xl bg-accent/15 p-2.5 text-accent'><Target size={22} /></div>
        <div><h1 className='text-2xl font-semibold tracking-tight'>Meta de Faturamento</h1><p className='text-sm text-muted'>Acompanhe o objetivo do mês em tempo real.</p></div>
      </div>

      <section className='gradient-accent card-elevated rounded-2xl border border-accent/20 bg-surface p-5'>
        <p className='text-sm text-muted'>Faturamento neste mês</p>
        <p className='mt-1 text-3xl font-semibold tabular-nums'>{formatarMoeda(receita)}</p>
        <div className='mt-5 h-3 overflow-hidden rounded-full bg-background'><div className='h-full rounded-full bg-accent transition-all' style={{ width: `${percentual}%` }} /></div>
        <div className='mt-2 flex justify-between text-xs text-muted'><span>{percentual.toFixed(0)}% alcançado</span><span>Meta: {meta > 0 ? formatarMoeda(meta) : 'não definida'}</span></div>
        <div className='mt-5 grid grid-cols-2 gap-3'>
          <div className='rounded-xl bg-background/55 p-3'><div className='flex items-center gap-1.5 text-xs text-muted'><Users size={14} /> Atendimentos</div><p className='mt-1 text-xl font-semibold'>{atendimentos}</p></div>
          <div className='rounded-xl bg-background/55 p-3'><div className='flex items-center gap-1.5 text-xs text-muted'><TrendingUp size={14} /> Falta para a meta</div><p className='mt-1 text-xl font-semibold'>{formatarMoeda(Math.max(0, meta - receita))}</p></div>
        </div>
      </section>

      {perfil?.papel === 'DONO' && (
        <section className='mt-5 rounded-2xl bg-surface p-4'>
          <label className='text-xs font-medium uppercase tracking-wide text-muted'>Meta mensal (R$)</label>
          <div className='mt-2 flex gap-2'><input type='number' min='0' step='100' value={metaDigitada} onChange={(e) => setMetaDigitada(e.target.value)} className='min-w-0 flex-1 rounded-xl border border-border-subtle bg-background px-4 py-3 outline-none focus:border-accent' /><button onClick={salvarMeta} disabled={salvando} className='rounded-xl bg-accent px-5 text-sm font-medium text-accent-foreground disabled:opacity-60'>{salvando ? 'Salvando...' : 'Salvar'}</button></div>
        </section>
      )}

      {linhas.length > 0 && (
        <section className='mt-6'><h2 className='mb-3 font-medium'>Resultado por profissional</h2><div className='flex flex-col gap-2'>{linhas.map((linha, i) => <div key={linha.perfil.id} className='card-elevated flex items-center gap-3 rounded-xl bg-surface p-4'><span className='flex h-8 w-8 items-center justify-center rounded-full bg-accent/15 text-sm font-semibold text-accent'>{i + 1}</span><div className='min-w-0 flex-1'><p className='truncate text-sm font-medium'>{linha.perfil.nome}</p><p className='text-xs text-muted'>{linha.atendimentos} atendimentos</p></div><p className='font-semibold tabular-nums'>{formatarMoeda(linha.receita)}</p></div>)}</div></section>
      )}
    </div>
  );
}
