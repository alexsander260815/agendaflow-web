'use client';

import { useEffect, useMemo, useState } from 'react';
import { Calculator, CircleDollarSign, Clock, Percent } from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import { formatarMoeda } from '@/lib/datetime';
import {
  atualizarSalao,
  atualizarServico,
  buscarMeuSalao,
  listarProdutos,
  listarServicoProdutosPorServico,
  listarServicos,
} from '@/lib/repositories';
import { Salao, Servico } from '@/lib/types';
import BotaoVoltarInicio from '@/components/BotaoVoltarInicio';

export default function CalculadoraPrecoPage() {
  const { perfil } = useAuth();
  const souDono = perfil?.papel === 'DONO';
  const [salao, setSalao] = useState<Salao | null>(null);
  const [servicos, setServicos] = useState<Servico[]>([]);
  const [produtos, setProdutos] = useState<{ id: string; preco: number }[]>([]);

  const [custoFixo, setCustoFixo] = useState('');
  const [horasMes, setHorasMes] = useState('');
  const [margem, setMargem] = useState('');
  const [salvando, setSalvando] = useState(false);

  const [servicoId, setServicoId] = useState('');
  const [custoMaterial, setCustoMaterial] = useState('0');
  const [horasAtendimento, setHorasAtendimento] = useState('0');
  const [aplicando, setAplicando] = useState(false);
  const [mensagemAplicar, setMensagemAplicar] = useState('');

  useEffect(() => {
    if (!perfil) return;
    buscarMeuSalao(perfil.salao_id).then((item) => {
      setSalao(item);
      setCustoFixo(String(item?.custo_fixo_mensal ?? ''));
      setHorasMes(String(item?.atendimentos_estimados_mes ?? ''));
      setMargem(String(item?.margem_lucro_desejada ?? ''));
    });
    listarServicos(perfil.salao_id).then((lista) => {
      setServicos(lista);
      if (lista.length > 0) setServicoId((atual) => atual || lista[0].id);
    });
    listarProdutos(perfil.salao_id).then((lista) => setProdutos(lista.map((p) => ({ id: p.id, preco: p.preco }))));
  }, [perfil]);

  const servicoSelecionado = servicos.find((s) => s.id === servicoId) ?? null;

  useEffect(() => {
    if (!servicoSelecionado) return;
    setHorasAtendimento((servicoSelecionado.duracao_minutos / 60).toFixed(2));
    listarServicoProdutosPorServico(servicoSelecionado.id).then((itens) => {
      if (itens.length === 0) {
        setCustoMaterial('0');
        return;
      }
      const total = itens.reduce((soma, i) => {
        const produto = produtos.find((p) => p.id === i.produto_id);
        return soma + (produto ? produto.preco * i.quantidade_consumida : 0);
      }, 0);
      setCustoMaterial(total.toFixed(2));
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [servicoId, produtos]);

  const valorHora = useMemo(() => {
    const custo = Number(custoFixo);
    const horas = Number(horasMes);
    return horas > 0 ? custo / horas : 0;
  }, [custoFixo, horasMes]);

  const custoTotal = useMemo(() => {
    return valorHora * Number(horasAtendimento) + Number(custoMaterial);
  }, [valorHora, horasAtendimento, custoMaterial]);

  const precoSugerido = useMemo(() => {
    const percentual = Number(margem);
    return percentual >= 0 && percentual < 100 ? custoTotal / (1 - percentual / 100) : 0;
  }, [custoTotal, margem]);

  const lucroSugerido = Math.max(0, precoSugerido - custoTotal);
  const diferencaParaPrecoAtual = servicoSelecionado ? precoSugerido - servicoSelecionado.preco : 0;

  async function salvarParametros() {
    if (!salao) return;
    setSalvando(true);
    try {
      const atualizado = { ...salao, custo_fixo_mensal: Number(custoFixo) || null, atendimentos_estimados_mes: Number(horasMes) || null, margem_lucro_desejada: Number(margem) || null };
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
      <div className='mb-6 flex items-center gap-3'><BotaoVoltarInicio /><div className='rounded-xl bg-accent/15 p-2.5 text-accent'><Calculator size={22} /></div><div><h1 className='text-2xl font-semibold tracking-tight'>Calculadora de Preço</h1><p className='text-sm text-muted'>Material gasto + horas do atendimento + margem = quanto cobrar.</p></div></div>

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
                {s.nome} — preço atual {formatarMoeda(s.preco)}
              </option>
            ))}
          </select>
        )}
      </section>

      <section className='card-elevated mt-5 flex flex-col gap-4 rounded-2xl bg-surface p-5'>
        <p className='text-sm font-medium'>2. Quanto esse atendimento gasta</p>
        <Campo titulo='Custo de material' dica='Produtos/insumos gastos nesse atendimento. Vem preenchido sozinho se você já cadastrou o consumo em Estoque → Serviços.' valor={custoMaterial} onChange={setCustoMaterial} prefixo='R$' />
        <Campo titulo='Tempo do atendimento' dica='Quantas horas você fica ocupado com esse serviço.' valor={horasAtendimento} onChange={setHorasAtendimento} sufixo='h' />
      </section>

      <details className='card-elevated mt-5 rounded-2xl bg-surface p-5'>
        <summary className='cursor-pointer text-sm font-medium'>3. Quanto vale a sua hora de trabalho</summary>
        <div className='mt-4 flex flex-col gap-4'>
          <p className='text-xs text-muted'>Some seus custos fixos do mês (aluguel, contas, salários...) e divida pelas horas que você trabalha no mês — isso dá o valor da sua hora.</p>
          <Campo titulo='Custos fixos mensais' dica='Aluguel, contas, salários e outras despesas fixas.' valor={custoFixo} onChange={setCustoFixo} prefixo='R$' somenteLeitura={!souDono} />
          <Campo titulo='Horas trabalhadas no mês' dica='Total de horas que o salão fica de portas abertas atendendo, no mês.' valor={horasMes} onChange={setHorasMes} sufixo='h' somenteLeitura={!souDono} />
          <Campo titulo='Margem de lucro desejada' dica='Use um valor menor que 100%.' valor={margem} onChange={setMargem} prefixo='%' somenteLeitura={!souDono} />
          <p className='text-sm'>Sua hora vale: <span className='font-semibold text-accent'>{formatarMoeda(valorHora)}</span></p>
          {souDono && (
            <button onClick={salvarParametros} disabled={!salao || salvando} className='rounded-xl bg-accent px-4 py-3 font-medium text-accent-foreground disabled:opacity-60'>{salvando ? 'Salvando...' : 'Salvar parâmetros'}</button>
          )}
        </div>
      </details>

      <section className='gradient-accent mt-5 rounded-2xl border border-accent/25 bg-surface p-5'>
        <p className='text-sm text-muted'>Preço mínimo sugerido{servicoSelecionado ? ` pra "${servicoSelecionado.nome}"` : ''}</p>
        <p className='mt-1 text-4xl font-semibold tabular-nums text-accent'>{formatarMoeda(precoSugerido)}</p>
        {servicoSelecionado && (
          <p className='mt-1 text-xs text-muted'>Preço atual cadastrado: {formatarMoeda(servicoSelecionado.preco)} ({diferencaParaPrecoAtual >= 0 ? 'sugerido é ' + formatarMoeda(diferencaParaPrecoAtual) + ' maior' : 'sugerido é ' + formatarMoeda(-diferencaParaPrecoAtual) + ' menor'})</p>
        )}

        <div className='mt-5 grid gap-3 sm:grid-cols-3'>
          <div className='rounded-xl bg-background/55 p-4'><div className='flex items-center gap-2 text-xs text-muted'><Clock size={15} /> Custo do tempo</div><p className='mt-1 text-lg font-semibold'>{formatarMoeda(valorHora * Number(horasAtendimento))}</p></div>
          <div className='rounded-xl bg-background/55 p-4'><div className='flex items-center gap-2 text-xs text-muted'><CircleDollarSign size={15} /> Custo total</div><p className='mt-1 text-lg font-semibold'>{formatarMoeda(custoTotal)}</p></div>
          <div className='rounded-xl bg-background/55 p-4'><div className='flex items-center gap-2 text-xs text-muted'><Percent size={15} /> Lucro no preço sugerido</div><p className='mt-1 text-lg font-semibold'>{formatarMoeda(lucroSugerido)}</p></div>
        </div>

        {souDono && servicoSelecionado && (
          <>
            <button onClick={aplicarPrecoAoServico} disabled={aplicando || precoSugerido <= 0} className='mt-4 w-full rounded-xl bg-accent px-4 py-3 font-medium text-accent-foreground disabled:opacity-60'>
              {aplicando ? 'Aplicando...' : 'Aplicar esse preço no serviço'}
            </button>
            {mensagemAplicar && <p className='mt-2 text-sm text-muted'>{mensagemAplicar}</p>}
          </>
        )}
      </section>
    </div>
  );
}

function Campo({ titulo, dica, valor, onChange, prefixo, sufixo, somenteLeitura }: { titulo: string; dica: string; valor: string; onChange: (v: string) => void; prefixo?: string; sufixo?: string; somenteLeitura?: boolean }) {
  return <label><span className='text-sm font-medium'>{titulo}</span><span className='ml-2 text-xs text-muted'>{dica}</span><div className='mt-1.5 flex items-center rounded-xl border border-border-subtle bg-background px-3 focus-within:border-accent'>{prefixo && <span className='text-sm text-muted'>{prefixo}</span>}<input type='number' min='0' step='0.01' value={valor} onChange={(e) => onChange(e.target.value)} disabled={somenteLeitura} className='w-full bg-transparent px-2 py-3 outline-none disabled:opacity-70' />{sufixo && <span className='text-sm text-muted'>{sufixo}</span>}</div></label>;
}
