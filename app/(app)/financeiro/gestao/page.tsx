'use client';

import { useEffect, useMemo, useState } from 'react';
import { ArrowDownCircle, ArrowUpCircle, BarChart3, CalendarDays, Check, Plus, ReceiptText, Trash2, Users } from 'lucide-react';
import AcessoRestrito from '@/components/AcessoRestrito';
import BotoesExportar from '@/components/BotoesExportar';
import { useAuth } from '@/lib/auth-context';
import { formatarMoeda } from '@/lib/datetime';
import { profissionaisVisiveisFinanceiro } from '@/lib/permissoes';
import { deletarDespesa, listarAgendamentos, listarAgendamentoServicos, listarClientes, listarDespesas, listarEquipe, listarReceitasAvulsas, marcarComissoesFechadas, salvarDespesa, salvarFechamentoComissao } from '@/lib/repositories';
import { Agendamento, AgendamentoServico, Cliente, Despesa, Perfil, ReceitaAvulsa } from '@/lib/types';

type Aba = 'CAIXA' | 'SEMANA' | 'MES' | 'COMISSOES' | 'DRE';
const CATEGORIAS = [{ id: 'ALUGUEL', nome: 'Aluguel' }, { id: 'PRODUTOS_INSUMOS', nome: 'Produtos / Insumos' }, { id: 'CONTAS_FIXAS', nome: 'Contas fixas' }, { id: 'MARKETING', nome: 'Marketing' }, { id: 'MANUTENCAO', nome: 'Manutenção' }, { id: 'OUTROS', nome: 'Outros' }];

function inicioDia(valor: string) { const d = new Date(`${valor}T00:00:00`); return d; }
function fimDia(valor: string) { const d = new Date(`${valor}T23:59:59.999`); return d; }
function intervaloSemana(valor: string): [Date, Date] { const base = inicioDia(valor); const ini = new Date(base); ini.setDate(base.getDate() - base.getDay()); const fim = new Date(ini); fim.setDate(ini.getDate() + 6); fim.setHours(23, 59, 59, 999); return [ini, fim]; }
function intervaloMes(valor: string): [Date, Date] { const base = inicioDia(valor); return [new Date(base.getFullYear(), base.getMonth(), 1), new Date(base.getFullYear(), base.getMonth() + 1, 0, 23, 59, 59, 999)]; }
function dataInputHoje() { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; }

export default function GestaoFinanceiraPage() {
  const { perfil, mostrarFinanceiro } = useAuth();
  const [aba, setAba] = useState<Aba>('CAIXA');
  const [referencia, setReferencia] = useState(dataInputHoje());
  const [agendamentos, setAgendamentos] = useState<Agendamento[]>([]);
  const [itens, setItens] = useState<AgendamentoServico[]>([]);
  const [despesas, setDespesas] = useState<Despesa[]>([]);
  const [receitasAvulsas, setReceitasAvulsas] = useState<ReceitaAvulsa[]>([]);
  const [equipe, setEquipe] = useState<Perfil[]>([]);
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [visiveis, setVisiveis] = useState<string[] | null>([]);
  const [carregando, setCarregando] = useState(true);
  const [novaDespesa, setNovaDespesa] = useState(false);
  const [descricao, setDescricao] = useState('');
  const [valor, setValor] = useState('');
  const [categoria, setCategoria] = useState('OUTROS');
  const [processando, setProcessando] = useState<string | null>(null);

  useEffect(() => {
    if (perfil) {
      carregar();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [perfil?.id]);

  async function carregar() {
    if (!perfil) return;
    setCarregando(true);
    try {
      const [ags, servicos, gastos, receitas, profissionais, listaClientes, permitidos] = await Promise.all([
        listarAgendamentos(perfil.salao_id), listarAgendamentoServicos(perfil.salao_id), listarDespesas(perfil.salao_id),
        listarReceitasAvulsas(perfil.salao_id), listarEquipe(perfil.salao_id), listarClientes(perfil.salao_id), profissionaisVisiveisFinanceiro(perfil),
      ]);
      setAgendamentos(ags); setItens(servicos); setDespesas(gastos); setReceitasAvulsas(receitas); setEquipe(profissionais); setClientes(listaClientes); setVisiveis(permitidos);
    } finally { setCarregando(false); }
  }

  // Itens com cliente_pacote_id já entraram como receita na venda do pacote
  // (receitas_avulsas, lançamento separado) — não conta de novo aqui, senão
  // a mesma sessão vira receita duas vezes (na venda e a cada uso).
  const precos = useMemo(() => { const mapa = new Map<string, number>(); itens.forEach((item) => { if (item.cliente_pacote_id) return; mapa.set(item.agendamento_id, (mapa.get(item.agendamento_id) ?? 0) + item.preco); }); return mapa; }, [itens]);
  const equipeMap = useMemo(() => new Map(equipe.map((p) => [p.id, p])), [equipe]);
  const clientesMap = useMemo(() => new Map(clientes.map((c) => [c.id, c])), [clientes]);
  const agendamentosVisiveis = useMemo(() => agendamentos.filter((ag) => ag.status === 'CONCLUIDO' && (visiveis === null || !!ag.profissional_id && visiveis.includes(ag.profissional_id))), [agendamentos, visiveis]);
  const intervalo: [Date, Date] = aba === 'SEMANA' ? intervaloSemana(referencia) : aba === 'MES' || aba === 'DRE' ? intervaloMes(referencia) : [inicioDia(referencia), fimDia(referencia)];
  const agsPeriodo = agendamentosVisiveis.filter((ag) => { const data = new Date(ag.data_hora); return data >= intervalo[0] && data <= intervalo[1]; });
  const despesasPeriodo = visiveis === null ? despesas.filter((d) => { const data = new Date(d.data_despesa); return data >= intervalo[0] && data <= intervalo[1]; }) : [];
  // Receita de pacote é caixa entrando na hora da venda, não no uso — só
  // aparece pra quem enxerga o financeiro completo (mesma regra das despesas).
  const receitasAvulsasPeriodo = visiveis === null ? receitasAvulsas.filter((r) => { const data = new Date(r.data_receita); return data >= intervalo[0] && data <= intervalo[1]; }) : [];
  const receitaPeriodo = agsPeriodo.reduce((soma, ag) => soma + (precos.get(ag.id) ?? 0), 0) + receitasAvulsasPeriodo.reduce((soma, r) => soma + r.valor, 0);
  const despesaPeriodo = despesasPeriodo.reduce((soma, d) => soma + d.valor, 0);

  const lancamentos = [
    ...agsPeriodo.map((ag) => ({ id: ag.id, data: ag.data_hora, entrada: true, titulo: `Atendimento • ${clientesMap.get(ag.cliente_id)?.nome ?? 'Cliente'}`, subtitulo: equipeMap.get(ag.profissional_id ?? '')?.nome ?? 'Não atribuído', valor: precos.get(ag.id) ?? 0 })),
    ...receitasAvulsasPeriodo.map((r) => ({ id: r.id, data: r.data_receita, entrada: true, titulo: `${r.descricao} • ${clientesMap.get(r.cliente_id ?? '')?.nome ?? 'Cliente'}`, subtitulo: 'Venda de pacote', valor: r.valor })),
    ...despesasPeriodo.map((d) => ({ id: d.id, data: d.data_despesa, entrada: false, titulo: d.descricao, subtitulo: CATEGORIAS.find((c) => c.id === d.categoria)?.nome ?? 'Outros', valor: d.valor })),
  ].sort((a, b) => new Date(b.data).getTime() - new Date(a.data).getTime());

  const comissoes = useMemo(() => equipe.map((profissional) => {
    const ags = agendamentosVisiveis.filter((ag) => ag.profissional_id === profissional.id);
    const ids = new Set(ags.map((ag) => ag.id));
    const pendentes = itens.filter((item) => ids.has(item.agendamento_id) && !item.comissao_fechada);
    const bruto = pendentes.reduce((soma, item) => soma + item.preco, 0);
    return { profissional, itens: pendentes, bruto, valor: bruto * (profissional.comissao_percentual / 100), atendimentos: new Set(pendentes.map((item) => item.agendamento_id)).size };
  }).filter((item) => item.itens.length > 0).sort((a, b) => b.valor - a.valor), [equipe, agendamentosVisiveis, itens]);

  async function adicionarDespesa() {
    if (!perfil || !descricao.trim() || Number(valor) <= 0) return;
    await salvarDespesa({ id: crypto.randomUUID(), salao_id: perfil.salao_id, descricao: descricao.trim(), valor: Number(valor), data_despesa: new Date().toISOString(), categoria });
    setDescricao(''); setValor(''); setCategoria('OUTROS'); setNovaDespesa(false); await carregar();
  }

  async function removerDespesa(id: string) { await deletarDespesa(id); await carregar(); }

  async function fecharComissao(item: typeof comissoes[number]) {
    if (!perfil) return;
    setProcessando(item.profissional.id);
    try {
      const ids = item.itens.map((i) => i.id);
      const agora = new Date().toISOString();
      await salvarFechamentoComissao({ id: crypto.randomUUID(), salao_id: perfil.salao_id, profissional_id: item.profissional.id, data_inicio: agora, data_fim: agora, valor_total: item.valor });
      await marcarComissoesFechadas(ids);
      await carregar();
    } finally { setProcessando(null); }
  }

  if (perfil && !mostrarFinanceiro) return <AcessoRestrito />;
  const tabs: { id: Aba; nome: string }[] = [{ id: 'CAIXA', nome: 'Caixa' }, { id: 'SEMANA', nome: 'Semana' }, { id: 'MES', nome: 'Mês' }, { id: 'COMISSOES', nome: 'Comissões' }, ...(perfil?.papel === 'DONO' ? [{ id: 'DRE' as Aba, nome: 'DRE' }] : [])];

  return (
    <div className='mx-auto max-w-5xl p-5 pb-16 md:p-8'>
      <div className='mb-5'><h1 className='text-2xl font-semibold tracking-tight'>Gestão Financeira</h1><p className='text-sm text-muted'>Caixa, despesas, resumos, comissões e resultado do negócio.</p></div>
      <div className='mb-5 flex gap-1 overflow-x-auto rounded-xl bg-surface p-1'>{tabs.map((tab) => <button key={tab.id} onClick={() => setAba(tab.id)} className={`min-w-fit flex-1 rounded-lg px-3 py-2 text-sm font-medium ${aba === tab.id ? 'bg-accent text-accent-foreground' : 'text-muted'}`}>{tab.nome}</button>)}</div>
      {aba !== 'COMISSOES' && <input type='date' value={referencia} onChange={(e) => setReferencia(e.target.value)} className='mb-5 rounded-xl border border-border-subtle bg-surface px-3 py-2 text-sm outline-none focus:border-accent [color-scheme:dark]' />}
      {carregando ? <div className='h-64 animate-pulse rounded-2xl bg-surface' /> : aba === 'COMISSOES' ? (
        <section>{comissoes.length === 0 ? <Vazio icone={<Check size={28} />} texto='Nenhuma comissão pendente.' /> : <div className='flex flex-col gap-3'>{comissoes.map((item) => <article key={item.profissional.id} className='card-elevated rounded-2xl bg-surface p-4'><div className='flex items-start gap-3'><div className='rounded-full bg-accent/15 p-2.5 text-accent'><Users size={18} /></div><div className='min-w-0 flex-1'><p className='font-medium'>{item.profissional.nome}</p><p className='text-xs text-muted'>{item.atendimentos} atendimentos • {item.profissional.comissao_percentual}%</p></div><div className='text-right'><p className='font-semibold text-accent'>{formatarMoeda(item.valor)}</p><p className='text-xs text-muted'>sobre {formatarMoeda(item.bruto)}</p></div></div><button onClick={() => fecharComissao(item)} disabled={processando === item.profissional.id} className='mt-4 w-full rounded-xl bg-accent px-4 py-2.5 text-sm font-medium text-accent-foreground disabled:opacity-60'>{processando === item.profissional.id ? 'Fechando...' : 'Fechar comissão'}</button></article>)}</div>}</section>
      ) : aba === 'DRE' ? (
        <Dre receita={receitaPeriodo} despesas={despesasPeriodo} />
      ) : (
        <section>
          <div className='mb-5 grid gap-3 sm:grid-cols-3'><Resumo titulo='Receitas' valor={receitaPeriodo} cor='text-success' icone={<ArrowUpCircle size={17} />} /><Resumo titulo='Despesas' valor={despesaPeriodo} cor='text-danger' icone={<ArrowDownCircle size={17} />} /><Resumo titulo='Saldo' valor={receitaPeriodo - despesaPeriodo} cor={receitaPeriodo - despesaPeriodo >= 0 ? 'text-accent' : 'text-danger'} icone={<BarChart3 size={17} />} /></div>
          {aba === 'CAIXA' && visiveis === null && <button onClick={() => setNovaDespesa(true)} className='mb-4 flex items-center gap-1.5 rounded-xl bg-accent px-4 py-2.5 text-sm font-medium text-accent-foreground'><Plus size={16} /> Nova despesa</button>}
          <BotoesExportar
            nomeArquivo={`financeiro-${aba.toLowerCase()}`}
            colunas={[
              { chave: 'data', rotulo: 'Data' },
              { chave: 'titulo', rotulo: 'Descrição' },
              { chave: 'subtitulo', rotulo: 'Detalhe' },
              { chave: 'tipo', rotulo: 'Tipo' },
              { chave: 'valor', rotulo: 'Valor' },
            ]}
            linhas={lancamentos.map((l) => ({ ...l, data: new Date(l.data).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }), tipo: l.entrada ? 'Entrada' : 'Saída' }))}
          />
          <h2 className='mb-3 font-medium'>{aba === 'CAIXA' ? 'Lançamentos do dia' : `Resumo do período • ${agsPeriodo.length} atendimentos`}</h2>
          <div className='flex flex-col gap-2'>{lancamentos.map((lancamento) => <div key={`${lancamento.entrada ? 'e' : 's'}-${lancamento.id}`} className='card-elevated flex items-center gap-3 rounded-xl bg-surface p-3.5'><div className={`rounded-full p-2 ${lancamento.entrada ? 'bg-success/10 text-success' : 'bg-danger/10 text-danger'}`}>{lancamento.entrada ? <ArrowUpCircle size={17} /> : <ArrowDownCircle size={17} />}</div><div className='min-w-0 flex-1'><p className='truncate text-sm font-medium'>{lancamento.titulo}</p><p className='text-xs text-muted'>{lancamento.subtitulo} • {new Date(lancamento.data).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}</p></div><p className={`font-semibold ${lancamento.entrada ? 'text-success' : 'text-danger'}`}>{lancamento.entrada ? '+' : '-'} {formatarMoeda(lancamento.valor)}</p>{!lancamento.entrada && aba === 'CAIXA' && <button onClick={() => removerDespesa(lancamento.id)} className='p-1.5 text-muted hover:text-danger'><Trash2 size={15} /></button>}</div>)}</div>
        </section>
      )}
      {novaDespesa && <div className='fixed inset-0 z-40 flex items-center justify-center bg-black/65 p-5 backdrop-blur-sm'><div className='w-full max-w-sm rounded-2xl bg-surface p-5'><div className='mb-4 flex items-center gap-2'><ReceiptText size={18} className='text-accent' /><p className='font-medium'>Nova despesa</p></div><div className='flex flex-col gap-3'><input value={descricao} onChange={(e) => setDescricao(e.target.value)} placeholder='Descrição' className='rounded-xl border border-border-subtle bg-background px-3 py-3 outline-none focus:border-accent' /><input type='number' min='0' step='0.01' value={valor} onChange={(e) => setValor(e.target.value)} placeholder='Valor em R$' className='rounded-xl border border-border-subtle bg-background px-3 py-3 outline-none focus:border-accent' /><select value={categoria} onChange={(e) => setCategoria(e.target.value)} className='rounded-xl border border-border-subtle bg-background px-3 py-3 outline-none focus:border-accent'>{CATEGORIAS.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}</select><div className='grid grid-cols-2 gap-2'><button onClick={() => setNovaDespesa(false)} className='rounded-xl border border-border-subtle py-3 text-sm'>Cancelar</button><button onClick={adicionarDespesa} className='rounded-xl bg-accent py-3 text-sm font-medium text-accent-foreground'>Salvar</button></div></div></div></div>}
    </div>
  );
}

function Resumo({ titulo, valor, cor, icone }: { titulo: string; valor: number; cor: string; icone: React.ReactNode }) { return <div className='card-elevated rounded-2xl bg-surface p-4'><div className={`flex items-center gap-2 text-xs ${cor}`}>{icone}{titulo}</div><p className={`mt-2 text-xl font-semibold ${cor}`}>{formatarMoeda(valor)}</p></div>; }
function Vazio({ icone, texto }: { icone: React.ReactNode; texto: string }) { return <div className='rounded-2xl bg-surface p-8 text-center text-muted'><span className='mb-2 flex justify-center'>{icone}</span><p className='text-sm'>{texto}</p></div>; }
function Dre({ receita, despesas }: { receita: number; despesas: Despesa[] }) { const total = despesas.reduce((s, d) => s + d.valor, 0); const lucro = receita - total; const grupos = CATEGORIAS.map((cat) => ({ ...cat, total: despesas.filter((d) => d.categoria === cat.id).reduce((s, d) => s + d.valor, 0) })).filter((cat) => cat.total > 0).sort((a, b) => b.total - a.total); return <section><div className='mb-5 grid gap-3 sm:grid-cols-3'><Resumo titulo='Receita bruta' valor={receita} cor='text-success' icone={<ArrowUpCircle size={17} />} /><Resumo titulo='Despesas' valor={total} cor='text-danger' icone={<ArrowDownCircle size={17} />} /><Resumo titulo='Lucro líquido' valor={lucro} cor={lucro >= 0 ? 'text-accent' : 'text-danger'} icone={<BarChart3 size={17} />} /></div><BotoesExportar nomeArquivo='dre' colunas={[{ chave: 'nome', rotulo: 'Categoria' }, { chave: 'total', rotulo: 'Valor' }]} linhas={[...grupos, { id: 'receita', nome: 'Receita bruta', total: receita }, { id: 'lucro', nome: 'Lucro líquido', total: lucro }]} /><div className='card-elevated rounded-2xl bg-surface p-4'><div className='mb-4 flex items-center gap-2'><CalendarDays size={17} className='text-accent' /><p className='font-medium'>Despesas por categoria</p></div>{grupos.length === 0 ? <p className='text-sm text-muted'>Nenhuma despesa no mês.</p> : grupos.map((grupo) => <div key={grupo.id} className='mb-3 last:mb-0'><div className='mb-1 flex justify-between text-sm'><span>{grupo.nome}</span><span>{formatarMoeda(grupo.total)} • {receita > 0 ? (grupo.total / receita * 100).toFixed(1) : '0'}%</span></div><div className='h-2 overflow-hidden rounded-full bg-background'><div className='h-full rounded-full bg-danger' style={{ width: `${Math.min(100, receita > 0 ? grupo.total / receita * 100 : 0)}%` }} /></div></div>)}</div><div className='mt-4 rounded-xl bg-surface p-4'><p className='text-sm text-muted'>Margem líquida</p><p className={`text-2xl font-semibold ${lucro >= 0 ? 'text-success' : 'text-danger'}`}>{receita > 0 ? (lucro / receita * 100).toFixed(1) : '0'}%</p></div></section>; }
