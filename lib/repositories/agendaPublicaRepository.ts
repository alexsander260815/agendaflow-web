import { supabase } from "@/lib/supabase";

export interface SalaoPublico {
  id: string;
  nome: string;
  logoUrl: string | null;
  endereco: string | null;
  numero: string | null;
  bairro: string | null;
  whatsapp: string | null;
  instagramUrl: string | null;
  descricao: string | null;
  clienteEscolheProfissional: boolean;
  sinalAtivo: boolean;
  sinalValor: number;
  chavePix: string | null;
  pixNomeBeneficiario: string | null;
  pixCidade: string | null;
}

export interface ServicoPublico {
  id: string;
  nome: string;
  duracao_minutos: number;
  preco: number;
  variavel: boolean;
}

export interface ProfissionalPublico {
  id: string;
  nome: string;
  fotoUrl: string | null;
}

export interface DadosPixCobranca {
  chave: string;
  nomeBeneficiario: string;
  cidade: string;
  valor: number;
  recebedorNome: string;
  recebedorTipo: "SALAO" | "PROFISSIONAL";
}

export interface InfoAgendaPublica {
  salao: SalaoPublico;
  servicos: ServicoPublico[];
  profissionais: ProfissionalPublico[];
}

async function chamarAgendaPublica<T = unknown>(body: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke("agenda-publica", { body });
  if (error) throw error;
  return data as T;
}

export async function buscarInfoAgendaPublica(salaoId: string): Promise<InfoAgendaPublica> {
  const data = await chamarAgendaPublica<InfoAgendaPublica & { erro?: string }>({ acao: "info", salaoId });
  if (data.erro) throw new Error(data.erro);
  return data;
}

export async function buscarHorariosDisponiveis(params: {
  salaoId: string;
  servicoId: string;
  data: string;
  profissionalId?: string | null;
}): Promise<string[]> {
  const data = await chamarAgendaPublica<{ horarios: string[]; erro?: string }>({ acao: "horarios", ...params });
  if (data.erro) throw new Error(data.erro);
  return data.horarios;
}

export async function criarAgendamentoPublico(params: {
  salaoId: string;
  servicoId: string;
  profissionalId?: string | null;
  clienteNome: string;
  clienteTelefone: string;
  dataHoraISO: string;
}): Promise<{ agendamentoId: string; cobraSinal: boolean; pix: DadosPixCobranca | null }> {
  const data = await chamarAgendaPublica<{
    sucesso?: true;
    agendamentoId?: string;
    cobraSinal?: boolean;
    pix?: DadosPixCobranca | null;
    erro?: string;
  }>({
    acao: "criar",
    ...params,
  });
  if (data.erro || !data.agendamentoId) throw new Error(data.erro ?? "Não foi possível criar o agendamento.");
  return {
    agendamentoId: data.agendamentoId,
    cobraSinal: data.cobraSinal ?? false,
    pix: data.pix ?? null,
  };
}
