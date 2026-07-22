// Lógica compartilhada dos relatórios de Receita por Profissional/Serviço/Dia
// (mirror de ReceitasViewModel.kt — os 3 relatórios usam a mesma base de dados).
import {
  listarAgendamentoServicos,
  listarAgendamentos,
  listarEquipe,
} from "@/lib/repositories";
import { profissionaisVisiveisFinanceiro } from "@/lib/permissoes";
import { AgendamentoServico, Perfil } from "@/lib/types";
import { converterIsoParaMillis, intervaloPeriodoRapido, PeriodoRapido } from "@/lib/datetime";

export interface ReceitaPorProfissional {
  nomeProfissional: string;
  quantidade: number;
  receitaTotal: number;
}

export interface ReceitaPorServico {
  nomeServico: string;
  quantidade: number;
  receitaTotal: number;
}

export interface ReceitaPorDia {
  diaSemana: number; // 0=Dom .. 6=Sáb
  label: string;
  quantidade: number;
  receitaTotal: number;
}

export interface DadosReceitas {
  receitaTotal: number;
  porProfissional: ReceitaPorProfissional[];
  porServico: ReceitaPorServico[];
  porDia: ReceitaPorDia[];
}

const LABEL_DIA = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];

export async function carregarReceitas(perfil: Perfil, periodo: PeriodoRapido): Promise<DadosReceitas> {
  const [agendamentos, itens, equipe, permitidos] = await Promise.all([
    listarAgendamentos(perfil.salao_id),
    listarAgendamentoServicos(perfil.salao_id),
    listarEquipe(perfil.salao_id),
    profissionaisVisiveisFinanceiro(perfil),
  ]);

  const equipeMap = new Map(equipe.map((p) => [p.id, p.nome]));
  const itensPorAgendamento = new Map<string, AgendamentoServico[]>();
  itens.forEach((i) => {
    const lista = itensPorAgendamento.get(i.agendamento_id) ?? [];
    lista.push(i);
    itensPorAgendamento.set(i.agendamento_id, lista);
  });

  const [inicio, fim] = intervaloPeriodoRapido(periodo);

  let base = agendamentos.filter(
    (a) => a.status === "CONCLUIDO" && converterIsoParaMillis(a.data_hora) >= inicio && converterIsoParaMillis(a.data_hora) <= fim
  );
  if (permitidos !== null) {
    base = base.filter((a) => a.profissional_id !== null && permitidos.includes(a.profissional_id));
  }

  const totalItens = (agendamentoId: string) => (itensPorAgendamento.get(agendamentoId) ?? []).reduce((s, i) => s + i.preco, 0);
  const receitaTotal = base.reduce((soma, a) => soma + totalItens(a.id), 0);

  const porProfissionalMap = new Map<string, ReceitaPorProfissional>();
  base.forEach((a) => {
    const chave = a.profissional_id ?? "sem_profissional";
    const nome = a.profissional_id ? equipeMap.get(a.profissional_id) ?? "Não atribuído" : "Não atribuído";
    const atual = porProfissionalMap.get(chave) ?? { nomeProfissional: nome, quantidade: 0, receitaTotal: 0 };
    atual.quantidade += 1;
    atual.receitaTotal += totalItens(a.id);
    porProfissionalMap.set(chave, atual);
  });

  const porServicoMap = new Map<string, ReceitaPorServico>();
  base.forEach((a) => {
    (itensPorAgendamento.get(a.id) ?? []).forEach((item) => {
      const atual = porServicoMap.get(item.nome_servico) ?? { nomeServico: item.nome_servico, quantidade: 0, receitaTotal: 0 };
      atual.quantidade += 1;
      atual.receitaTotal += item.preco;
      porServicoMap.set(item.nome_servico, atual);
    });
  });

  const porDia: ReceitaPorDia[] = LABEL_DIA.map((label, diaSemana) => ({ diaSemana, label, quantidade: 0, receitaTotal: 0 }));
  base.forEach((a) => {
    const dia = new Date(converterIsoParaMillis(a.data_hora)).getDay();
    porDia[dia].quantidade += 1;
    porDia[dia].receitaTotal += totalItens(a.id);
  });

  return {
    receitaTotal,
    porProfissional: Array.from(porProfissionalMap.values()).sort((a, b) => b.receitaTotal - a.receitaTotal),
    porServico: Array.from(porServicoMap.values()).sort((a, b) => b.receitaTotal - a.receitaTotal),
    porDia,
  };
}
