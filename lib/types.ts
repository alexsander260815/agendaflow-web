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

export interface RetornoCliente {
  id: string;
  salao_id: string;
  cliente_id: string;
  profissional_id: string | null;
  agendamento_id: string | null;
  nome_servico: string;
  data_retorno: string;
  status: "PENDENTE" | "AVISADO" | "CONCLUIDO";
  criado_em: string;
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

export interface Convite {
  id: string;
  salao_id: string;
  codigo: string;
  papel: string;
  usado: boolean;
}

export interface Salao {
  id: string;
  nome: string;
  modo_comissao_pacote: string;
  cnpj: string | null;
  tipo_empresa: string | null;
  faturamento_mensal: string | null;
  endereco: string | null;
  cep: string | null;
  numero: string | null;
  bairro: string | null;
  celular_unidade: string | null;
  descricao: string | null;
  instagram_url: string | null;
  whatsapp: string | null;
  cliente_escolhe_profissional: boolean;
  duracao_padrao_minutos: number;
  antecedencia_minima_ativa: boolean;
  antecedencia_minima_minutos: number;
  logo_url: string | null;
  trial_fim: string | null;
  mensagem_confirmacao: string | null;
  acesso_liberado_manualmente: boolean;
  mensagem_remarcacao: string | null;
  mensagem_cancelamento: string | null;
  mensagem_retorno: string | null;
}

export interface HorarioFuncionamento {
  id: string;
  salao_id: string;
  dias: number[]; // 0=Dom .. 6=Sáb
  abertura: string; // "HH:mm"
  fechamento: string; // "HH:mm"
}

export interface Plano {
  id: string;
  nome: string;
  faixa_min: number;
  faixa_max: number | null;
  frequencia: "MENSAL" | "ANUAL";
  preco: number;
  ativo: boolean;
}

export type StatusAssinatura = "PENDENTE" | "ATIVA" | "CANCELADA" | "ATRASADA" | string;

export interface Assinatura {
  id: string;
  salao_id: string;
  plano_id: string;
  mercadopago_preapproval_id: string | null;
  status: StatusAssinatura;
  data_inicio: string | null;
  data_proxima_cobranca: string | null;
}

export interface SuporteMensagem {
  id?: string;
  salao_id: string;
  remetente_nome: string;
  mensagem: string;
  status: string;
}

// Formatos de resposta das edge functions (não são linhas de tabela).
export interface SalaoPainel {
  salaoId: string;
  nomeSalao: string;
  contato: string;
  statusAssinatura: StatusAssinatura;
  nomePlano?: string;
  precoPlano?: number;
  assinaturaId?: string;
  mercadopagoPreapprovalId?: string;
  acessoLiberadoManualmente: boolean;
  trialFim?: string;
}

export interface SuporteMensagemPainel {
  id: string;
  salaoId?: string;
  nomeSalao: string;
  whatsapp?: string | null;
  celularUnidade?: string | null;
  remetenteNome: string;
  mensagem: string;
  status: string;
  criadoEm: string;
}
