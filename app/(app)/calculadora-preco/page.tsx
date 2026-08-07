'use client';

import { useEffect, useMemo, useState } from 'react';
import { Calculator, CircleDollarSign, Percent } from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import { formatarMoeda } from '@/lib/datetime';
import { atualizarSalao, atualizarServico, buscarMeuSalao, listarServicos } from '@/lib/repositories';
import { Salao, Servico } from '@/lib/types';

export default function CalculadoraPrecoPage() {
  const { perfil } = useAuth();
  const souDono = perfil?.papel === 'DONO';
  const [salao, setSalao] = useState<Salao | null>(null);
  const [servicos, setServicos] = useState<Servico[]>([]);
  const [custo, setCusto] = useState('');
  const [atendimentos, setAtendimentos] = useState('');
  const [margem, setMargem] = useState('');
  const [salvando, setSalvando] = useState(false);

  const [servicoId, setServicoId] = useState('');
  const [aplicando, setAplicando] = useState(false);
  const [mensagemAplicar, setMensagemAplicar] = useState('');

  useEffect(() => {
    if (!perfil) return;
    buscarMeuSalao(perfil.salao_id).then((item) => {
      setSalao(item);
      setCusto(String(item?.custo_fixo_mensal ?? ''));
      setAtendimentos(String(item?.atendimentos_estimados_mes ?? ''));
      setMargem(String(item?.margem_lucro_desejada ?? ''));
    });
    listarServicos(perfil.salao_id).then((lista) => {
      setServicos(lista);
      if (lista.length > 0) setServicoId((atual) => atual || lista[0].id);
    });
  }, [perfil]);

  const duracaoMediaMinutos = useMemo(() => {
    if (servicos.length === 0) return 0;
    return servicos.reduce((soma, s) => soma + s.duracao_minutos, 0) / servicos.length;
  }, [servicos]);

  const custoPorAtendimento = useMemo(() => {
    const quantidade = Number(atendimentos);
    return quantidade > 0 ? Number(custo) / quantidade : 0;
  }, [custo, atendimentos]);

  const custoPorMinuto = useMemo(() => {
    return duracaoMediaMinutos > 0 ? custoPorAtendimento / duracaoMediaMinutos : 0;
  }, [custoPorAtendimento, duracaoMediaMinutos]);

  const servicoSelecionado = servicos.find((s) => s.id === servicoId) ?? null;

  const custoDoServico = useMemo(() => {
    if (!servicoSelecionado) return 0;
    return custoPorMinuto * servicoSelecionado.duracao_minutos;
  }, [custoPorMinuto, servicoSelecionado]);

  const precoSugerido = useMemo(() => {
    const percentual = Number(margem);
    return percentual >= 0 && percentual < 100 ? custoDoServico / (1 - percentual / 100) : 0;
  }, [custoDoServico, margem]);

  const lucroSugerido = Math.max(0, precoSugerido - custoDoServico);
  const diferencaParaPrecoAtual = servicoSelecionado ? precoSugerido - servicoSelecionado.preco : 0;

  async function salvarParametros() {
    if (!salao) return;
    setSalvando(true);
    try {
      const atualizado = { ...salao, custo_fixo_mensal: Number(custo) || null, atendimentos_estimados_mes: Number(atendimentos) || null, margem_lucro_desejada: Number(margem) || null };
      await atualizarSalao(atualizado);
      setSalao(atualizado);
    } finally { setSalvando(false); }
  }

  async function aplicarPrecoAoServico() {
    if (!servicoSelecionado || precoSugerido <= 0) return;
    setAplicando(true);
    setMensagemAplicar('');
    try {
      const atualizado = { ...servicoSelecionado, preco: Number(precoSugerido.toFixed(2)) };
      await atualizarServico(servicoSelecionado.id, atualizado);
      setServicos((atual) => atual.map((s) => (s.id === atualizado.id ? atualizado : s)));
      setMensagemAplicar('Preço do serviço atualizado!');
    } catch (e) {
      const mensagem = e instanceof Error ? e.message : 'Erro desconhecido';
      setMensagemAplicar(`Não foi possível aplicar: ${mensagem}`);
    } finally {
      setAplicando(false);
      setTimeout(() => setMensagemAplicar(''), 4000);
    }
  }

  return (
    <div className='mx-auto max-w-2xl p-5 pb-16 md:p-8'>
      <div className='mb-6 flex items-center gap-3'><div className='rounded-xl bg-accent/15 p-2.5 text-accent'><Calculator size={22} /></div><div><h1 className='text-2xl font-semibold tracking-tight'>Calculadora de Preço</h1><p className='text-sm text-muted'>Descubra um preço mínimo saudável pra cada serviço.</p></div></div>

      <section className='card-elevated flex flex-col gap-4 rounded-2xl bg-surface p-5'>
        <p className='text-sm font-medium'>1. Escolha o serviço</p>
        {servicos.length === 0 ? (
          <p className='text-sm text-muted'>Cadastre um serviço em &quot;Serviços&quot; pra poder precificar.</p>
        ) : (
          <select
            value={servicoId}
            onChange={(e) => setServicoId(e.target.value)}
            className='w-full rounded-xl border border-border-subtle bg-background px-3 py-3 outline-none focus:border-accent'
          >
            {servicos.map((s) => (
              <option key={s.id} value={s.id}>
                {s.nome} — {s.duracao_minutos} min — preço atual {formatarMoeda(s.preco)}
              </option>
            ))}
          </select>
        )}
      </section>

      <section className='card-elevated mt-5 flex flex-col gap-4 rounded-2xl bg-surface p-5'>
        <p className='text-sm font-medium'>2. Custos gerais do salão</p>
        <p className='text-xs text-muted'>Esses números valem pra todos os serviços — quanto mais preciso, mais confiável o preço sugerido.</p>
        <Campo titulo='Custos fixos mensais' dica='Aluguel, contas, salários, sistemas e outras despesas fixas.' valor={custo} onChange={setCusto} prefixo='R$' somenteLeitura={!souDono} />
        <Campo titulo='Atendimentos estimados no mês' dica='Quantos atendimentos o salão espera realizar, no total.' valor={atendimentos} onChange={setAtendimentos} somenteLeitura={!souDono} />
        <Campo titulo='Margem de lucro desejada' dica='Use um valor menor que 100%.' valor={margem} onChange={setMargem} prefixo='%' somenteLeitura={!souDono} />
        {souDono && (
          <button onClick={salvarParametros} disabled={!salao || salvando} className='rounded-xl bg-accent px-4 py-3 font-medium text-accent-foreground disabled:opacity-60'>{salvando ? 'Salvando...' : 'Salvar parâmetros'}</button>
        )}
      </section>

      {servicoSelecionado && (
        <section className='gradient-accent mt-5 rounded-2xl border border-accent/25 bg-surface p-5'>
          <p className='text-sm text-muted'>Preço mínimo sugerido pra &quot;{servicoSelecionado.nome}&quot;</p>
          <p className='mt-1 text-4xl font-semibold tabular-nums text-accent'>{formatarMoeda(precoSugerido)}</p>
          <p className='mt-1 text-xs text-muted'>Preço atual cadastrado: {formatarMoeda(servicoSelecionado.preco)} ({diferencaParaPrecoAtual >= 0 ? 'sugerido é ' + formatarMoeda(diferencaParaPrecoAtual) + ' maior' : 'sugerido é ' + formatarMoeda(-diferencaParaPrecoAtual) + ' menor'})</p>

          <div className='mt-5 grid gap-3 sm:grid-cols-2'>
            <div className='rounded-xl bg-background/55 p-4'><div className='flex items-center gap-2 text-xs text-muted'><CircleDollarSign size={15} /> Custo desse serviço ({servicoSelecionado.duracao_minutos} min)</div><p className='mt-1 text-lg font-semibold'>{formatarMoeda(custoDoServico)}</p></div>
            <div className='rounded-xl bg-background/55 p-4'><div className='flex items-center gap-2 text-xs text-muted'><Percent size={15} /> Lucro no preço sugerido</div><p className='mt-1 text-lg font-semibold'>{formatarMoeda(lucroSugerido)}</p></div>
          </div>

          <p className='mt-4 text-xs leading-relaxed text-muted'>O custo é dividido proporcionalmente pela duração de cada serviço, com base na duração média de todos os seus serviços cadastrados. Materiais/produtos específicos desse serviço devem ser acrescentados por fora.</p>

          {souDono && (
            <>
              <button onClick={aplicarPrecoAoServico} disabled={aplicando || precoSugerido <= 0} className='mt-4 w-full rounded-xl bg-accent px-4 py-3 font-medium text-accent-foreground disabled:opacity-60'>
                {aplicando ? 'Aplicando...' : 'Aplicar esse preço no serviço'}
              </button>
              {mensagemAplicar && <p className='mt-2 text-sm text-muted'>{mensagemAplicar}</p>}
            </>
          )}
        </section>
      )}
    </div>
  );
}

function Campo({ titulo, dica, valor, onChange, prefixo, somenteLeitura }: { titulo: string; dica: string; valor: string; onChange: (v: string) => void; prefixo?: string; somenteLeitura?: boolean }) {
  return <label><span className='text-sm font-medium'>{titulo}</span><span className='ml-2 text-xs text-muted'>{dica}</span><div className='mt-1.5 flex items-center rounded-xl border border-border-subtle bg-background px-3 focus-within:border-accent'>{prefixo && <span className='text-sm text-muted'>{prefixo}</span>}<input type='number' min='0' step='0.01' value={valor} onChange={(e) => onChange(e.target.value)} disabled={somenteLeitura} className='w-full bg-transparent px-2 py-3 outline-none disabled:opacity-70' /></div></label>;
}
