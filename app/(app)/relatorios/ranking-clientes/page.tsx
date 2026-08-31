'use client';

import { useEffect, useMemo, useState } from 'react';
import { Award, CalendarRange, Flame, Trophy } from 'lucide-react';
import { RelatorioHeader } from '@/components/RelatorioHeader';
import BotoesExportar from '@/components/BotoesExportar';
import { useAuth } from '@/lib/auth-context';
import { formatarMoeda } from '@/lib/datetime';
import { profissionaisVisiveisFinanceiro } from '@/lib/permissoes';
import { listarAgendamentos, listarAgendamentoServicos, listarClientes } from '@/lib/repositories';

type Periodo = 'MES_ATUAL' | 'MES_ANTERIOR' | 'SETE_DIAS';
interface LinhaRanking { id: string; nome: string; telefone: string; visitas: number; gasto: number }

function intervalo(periodo: Periodo): [Date, Date] {
  const agora = new Date();
  if (periodo === 'SETE_DIAS') return [new Date(agora.getTime() - 6 * 86400000), agora];
  if (periodo === 'MES_ANTERIOR') return [new Date(agora.getFullYear(), agora.getMonth() - 1, 1), new Date(agora.getFullYear(), agora.getMonth(), 0, 23, 59, 59, 999)];
  return [new Date(agora.getFullYear(), agora.getMonth(), 1), agora];
}

export default function RankingClientesPage() {
  const { perfil } = useAuth();
  const [periodo, setPeriodo] = useState<Periodo>('MES_ATUAL');
  const [ranking, setRanking] = useState<LinhaRanking[]>([]);
  const [calor, setCalor] = useState<number[][]>(Array.from({ length: 3 }, () => Array(7).fill(0)));
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    if (!perfil) return;
    // eslint-disable-next-line react-hooks/immutability
    carregar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [perfil?.id, periodo]);

  async function carregar() {
    if (!perfil) return;
    setCarregando(true);
    try {
      const [agendamentos, itens, clientes, visiveis] = await Promise.all([
        listarAgendamentos(perfil.salao_id),
        listarAgendamentoServicos(perfil.salao_id),
        listarClientes(perfil.salao_id),
        profissionaisVisiveisFinanceiro(perfil),
      ]);
      const [inicio, fim] = intervalo(periodo);
      inicio.setHours(0, 0, 0, 0);
      const concluidos = agendamentos.filter((ag) => {
        const data = new Date(ag.data_hora);
        return ag.status === 'CONCLUIDO' && data >= inicio && data <= fim && (visiveis === null || !!ag.profissional_id && visiveis.includes(ag.profissional_id));
      });
      const precos = new Map<string, number>();
      itens.forEach((item) => precos.set(item.agendamento_id, (precos.get(item.agendamento_id) ?? 0) + item.preco));
      const porCliente = new Map<string, { visitas: number; gasto: number }>();
      concluidos.forEach((ag) => {
        const atual = porCliente.get(ag.cliente_id) ?? { visitas: 0, gasto: 0 };
        atual.visitas += 1;
        atual.gasto += precos.get(ag.id) ?? 0;
        porCliente.set(ag.cliente_id, atual);
      });
      setRanking(clientes.map((cliente) => ({ id: cliente.id, nome: cliente.nome, telefone: cliente.telefone, visitas: porCliente.get(cliente.id)?.visitas ?? 0, gasto: porCliente.get(cliente.id)?.gasto ?? 0 })).filter((item) => item.visitas > 0).sort((a, b) => b.gasto - a.gasto).slice(0, 10));
      const matriz = Array.from({ length: 3 }, () => Array(7).fill(0));
      concluidos.forEach((ag) => {
        const data = new Date(ag.data_hora);
        const faixa = data.getHours() < 12 ? 0 : data.getHours() < 18 ? 1 : 2;
        matriz[faixa][data.getDay()] += 1;
      });
      setCalor(matriz);
    } finally { setCarregando(false); }
  }

  const maxCalor = useMemo(() => Math.max(1, ...calor.flat()), [calor]);

  return (
    <div className='mx-auto max-w-4xl p-5 pb-16 md:p-8'>
      <RelatorioHeader titulo='Ranking de Clientes' />
      <p className='-mt-3 mb-5 pl-10 text-sm text-muted'>Quem mais visita e mais fatura no período.</p>
      <div className='mb-5 grid grid-cols-3 gap-2'>{[
        ['MES_ATUAL', 'Este mês'], ['MES_ANTERIOR', 'Mês anterior'], ['SETE_DIAS', '7 dias'],
      ].map(([id, nome]) => <button key={id} onClick={() => setPeriodo(id as Periodo)} className={`rounded-xl px-3 py-2.5 text-sm ${periodo === id ? 'bg-accent font-medium text-accent-foreground' : 'bg-surface text-muted'}`}>{nome}</button>)}</div>

      <BotoesExportar
        nomeArquivo="ranking-clientes"
        colunas={[
          { chave: 'nome', rotulo: 'Cliente' },
          { chave: 'telefone', rotulo: 'Telefone' },
          { chave: 'visitas', rotulo: 'Visitas' },
          { chave: 'gasto', rotulo: 'Total gasto' },
        ]}
        linhas={ranking}
      />

      {carregando ? <div className='h-52 animate-pulse rounded-2xl bg-surface' /> : ranking.length === 0 ? <div className='rounded-2xl bg-surface p-8 text-center text-sm text-muted'>Nenhum atendimento concluído nesse período.</div> : (
        <section><div className='mb-3 flex items-center gap-2'><Trophy size={17} className='text-accent' /><h2 className='font-medium'>Top 10 clientes</h2></div><div className='flex flex-col gap-2'>{ranking.map((cliente, i) => <div key={cliente.id} className={`card-elevated flex items-center gap-3 rounded-xl bg-surface p-4 ${i === 0 ? 'border border-accent/25' : ''}`}><div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${i < 3 ? 'bg-accent/15 text-accent' : 'bg-surface-alt text-muted'}`}>{i === 0 ? <Award size={18} /> : i + 1}</div><div className='min-w-0 flex-1'><p className='truncate font-medium'>{cliente.nome}</p><p className='text-xs text-muted'>{cliente.visitas} {cliente.visitas === 1 ? 'visita' : 'visitas'}</p></div><p className='font-semibold tabular-nums'>{formatarMoeda(cliente.gasto)}</p></div>)}</div></section>
      )}

      <section className='mt-7'><div className='mb-3 flex items-center gap-2'><Flame size={17} className='text-accent' /><div><h2 className='font-medium'>Horários mais movimentados</h2><p className='text-xs text-muted'>Quanto mais forte a cor, maior o movimento.</p></div></div><div className='card-elevated overflow-x-auto rounded-2xl bg-surface p-4'><div className='min-w-[520px]'><div className='grid grid-cols-[90px_repeat(7,1fr)] gap-2 text-center text-xs text-muted'><span /><span>Dom</span><span>Seg</span><span>Ter</span><span>Qua</span><span>Qui</span><span>Sex</span><span>Sáb</span>{['Manhã', 'Tarde', 'Noite'].map((faixa, linha) => <div key={faixa} className='contents'><span className='flex items-center gap-1 text-left'><CalendarRange size={12} /> {faixa}</span>{calor[linha].map((quantidade, dia) => <span key={`${linha}-${dia}`} className='rounded-lg py-3 font-medium text-foreground' style={{ backgroundColor: `color-mix(in srgb, var(--accent) ${Math.max(7, quantidade / maxCalor * 75)}%, var(--surface-alt))` }}>{quantidade}</span>)}</div>)}</div></div></div></section>
    </div>
  );
}
