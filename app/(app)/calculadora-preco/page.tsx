'use client';

import { useEffect, useMemo, useState } from 'react';
import { Calculator, CircleDollarSign, Percent } from 'lucide-react';
import AcessoRestrito from '@/components/AcessoRestrito';
import { useAuth } from '@/lib/auth-context';
import { formatarMoeda } from '@/lib/datetime';
import { atualizarSalao, buscarMeuSalao } from '@/lib/repositories';
import { Salao } from '@/lib/types';

export default function CalculadoraPrecoPage() {
  const { perfil } = useAuth();
  const [salao, setSalao] = useState<Salao | null>(null);
  const [custo, setCusto] = useState('');
  const [atendimentos, setAtendimentos] = useState('');
  const [margem, setMargem] = useState('');
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    if (!perfil) return;
    buscarMeuSalao(perfil.salao_id).then((item) => {
      setSalao(item);
      setCusto(String(item?.custo_fixo_mensal ?? ''));
      setAtendimentos(String(item?.atendimentos_estimados_mes ?? ''));
      setMargem(String(item?.margem_lucro_desejada ?? ''));
    });
  }, [perfil]);

  const custoPorAtendimento = useMemo(() => {
    const quantidade = Number(atendimentos);
    return quantidade > 0 ? Number(custo) / quantidade : 0;
  }, [custo, atendimentos]);
  const precoSugerido = useMemo(() => {
    const percentual = Number(margem);
    return percentual >= 0 && percentual < 100 ? custoPorAtendimento / (1 - percentual / 100) : 0;
  }, [custoPorAtendimento, margem]);

  async function salvar() {
    if (!salao) return;
    setSalvando(true);
    try {
      const atualizado = { ...salao, custo_fixo_mensal: Number(custo) || null, atendimentos_estimados_mes: Number(atendimentos) || null, margem_lucro_desejada: Number(margem) || null };
      await atualizarSalao(atualizado);
      setSalao(atualizado);
    } finally { setSalvando(false); }
  }

  if (perfil && perfil.papel !== 'DONO') return <AcessoRestrito />;

  return (
    <div className='mx-auto max-w-2xl p-5 pb-16 md:p-8'>
      <div className='mb-6 flex items-center gap-3'><div className='rounded-xl bg-accent/15 p-2.5 text-accent'><Calculator size={22} /></div><div><h1 className='text-2xl font-semibold tracking-tight'>Calculadora de Preço</h1><p className='text-sm text-muted'>Descubra um preço mínimo saudável para cada atendimento.</p></div></div>

      <section className='card-elevated flex flex-col gap-4 rounded-2xl bg-surface p-5'>
        <Campo titulo='Custos fixos mensais' dica='Aluguel, contas, salários, sistemas e outras despesas fixas.' valor={custo} onChange={setCusto} prefixo='R$' />
        <Campo titulo='Atendimentos estimados no mês' dica='Quantos atendimentos o salão espera realizar.' valor={atendimentos} onChange={setAtendimentos} />
        <Campo titulo='Margem de lucro desejada' dica='Use um valor menor que 100%.' valor={margem} onChange={setMargem} prefixo='%' />
        <button onClick={salvar} disabled={!salao || salvando} className='rounded-xl bg-accent px-4 py-3 font-medium text-accent-foreground disabled:opacity-60'>{salvando ? 'Salvando...' : 'Salvar parâmetros'}</button>
      </section>

      <section className='gradient-accent mt-5 rounded-2xl border border-accent/25 bg-surface p-5'>
        <p className='text-sm text-muted'>Preço mínimo sugerido</p><p className='mt-1 text-4xl font-semibold tabular-nums text-accent'>{formatarMoeda(precoSugerido)}</p>
        <div className='mt-5 grid gap-3 sm:grid-cols-2'><div className='rounded-xl bg-background/55 p-4'><div className='flex items-center gap-2 text-xs text-muted'><CircleDollarSign size={15} /> Custo por atendimento</div><p className='mt-1 text-lg font-semibold'>{formatarMoeda(custoPorAtendimento)}</p></div><div className='rounded-xl bg-background/55 p-4'><div className='flex items-center gap-2 text-xs text-muted'><Percent size={15} /> Lucro no preço sugerido</div><p className='mt-1 text-lg font-semibold'>{formatarMoeda(Math.max(0, precoSugerido - custoPorAtendimento))}</p></div></div>
        <p className='mt-4 text-xs leading-relaxed text-muted'>Esse cálculo cobre a parcela dos custos fixos e aplica a margem desejada. Materiais específicos do serviço devem ser acrescentados ao preço final.</p>
      </section>
    </div>
  );
}

function Campo({ titulo, dica, valor, onChange, prefixo }: { titulo: string; dica: string; valor: string; onChange: (v: string) => void; prefixo?: string }) {
  return <label><span className='text-sm font-medium'>{titulo}</span><span className='ml-2 text-xs text-muted'>{dica}</span><div className='mt-1.5 flex items-center rounded-xl border border-border-subtle bg-background px-3 focus-within:border-accent'>{prefixo && <span className='text-sm text-muted'>{prefixo}</span>}<input type='number' min='0' step='0.01' value={valor} onChange={(e) => onChange(e.target.value)} className='w-full bg-transparent px-2 py-3 outline-none' /></div></label>;
}
