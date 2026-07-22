// Tipos espelhando as DTOs do app Android (data/remote/dto/*.kt), mesmos nomes de coluna do Postgres.

export interface Perfil {
  id: string;
  salao_id: string;
  nome: string;
  papel: "DONO" | "ADMIN" | "PROFISSIONAL" | string;
  ve_financeiro_completo: boolean;
  foto_url: string | null;
  comissao_percentual: number;
  atende_clientes: boolean;
}

export interface Cliente {
  id: string;
  salao_id: string;
  nome: string;
  telefone: string;
  observacoes: string;
  aniversario: string | null;
}

export interface Servico {
  id: string;
  salao_id: string;
  nome: string;
  duracao_minutos: number;
  preco: number;
  categoria: string | null;
  variavel: boolean;
}

export interface Pacote {
  id: string;
  salao_id: string;
  nome: string;
  servico_id: string;
  quantidade_sessoes: number;
  preco: number;
}

export interface ClientePacote {
  id: string;
  salao_id: string;
  cliente_id: string;
  pacote_id: string;
  nome_pacote: string;
  servico_id: string;
  quantidade_restante: number;
}

export type StatusAgendamento = "AGENDADO" | "CONCLUIDO" | "FALTOU";

export interface Agendamento {
  id: string;
  salao_id: string;
  cliente_id: string;
  profissional_id: string | null;
  data_hora: string; // ISO com offset, ex: 2026-07-21T09:00:00-03:00
  status: StatusAgendamento;
  observacoes: string;
  forma_pagamento: string | null;
}

export interface AgendamentoServico {
  id: string;
  salao_id: string;
  agendamento_id: string;
  servico_id: string;
  nome_servico: string;
  preco: number;
  cliente_pacote_id: string | null;
  pacote_descontado: boolean;
  comissao_fechada: boolean;
}

export interface PermissoesUsuario {
  id?: string;
  salao_id: string;
  usuario_id: string;
  agenda_modo: "PROPRIA" | "SELECIONADOS" | "EQUIPE";
  agenda_cria: boolean;
  agenda_edita: boolean;
  agenda_cancela: boolean;
  agenda_ve_dono: boolean;
  financeiro_modo: "PROPRIO" | "SELECIONADOS" | "EQUIPE";
  financeiro_ve_dono: boolean;
}

export interface PermissaoVisualizacao {
  id?: string;
  salao_id: string;
  visualizador_id: string;
  alvo_id: string;
  ve_agenda: boolean;
  ve_financeiro: boolean;
}

// Item de comanda em memória (equivalente a ItemComanda no Android) — não é uma linha de tabela.
export interface ItemComanda {
  servico: Servico;
  usaPacote: boolean;
  clientePacoteId: string | null;
  precoCobrado: number;
}

export type TipoMovimentacao = "ENTRADA" | "VENDA" | "CONSUMO" | "AJUSTE";

export interface Produto {
  id: string;
  salao_id: string;
  nome: string;
  unidade: string;
  preco: number;
  saldo: number;
  minimo: number;
}

export interface MovimentacaoEstoque {
  id: string;
  salao_id: string;
  produto_id: string;
  tipo: TipoMovimentacao;
  quantidade: number;
  observacao: string;
  criado_em?: string;
}

export interface ServicoProduto {
  id: string;
  salao_id: string;
  servico_id: string;
  produto_id: string;
  quantidade_consumida: number;
}

export interface FechamentoComissao {
  id: string;
  salao_id: string;
  profissional_id: string;
  data_inicio: string;
  data_fim: string;
  valor_total: number;
}
