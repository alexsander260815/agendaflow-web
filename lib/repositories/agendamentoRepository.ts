import { supabase } from "@/lib/supabase";
import { Agendamento } from "@/lib/types";

export async function listarAgendamentos(salaoId: string): Promise<Agendamento[]> {
  const { data, error } = await supabase
    .from("agendamentos")
    .select("*")
    .eq("salao_id", salaoId)
    .order("data_hora", { ascending: true });
  if (error) throw error;
  return data as Agendamento[];
}

export async function buscarAgendamento(id: string): Promise<Agendamento | null> {
  const { data, error } = await supabase.from("agendamentos").select("*").eq("id", id).maybeSingle();
  if (error) throw error;
  return data as Agendamento | null;
}

export async function salvarAgendamento(agendamento: Agendamento): Promise<void> {
  const { error } = await supabase.from("agendamentos").insert(agendamento);
  if (error) throw error;
}

export async function atualizarAgendamento(id: string, agendamento: Agendamento): Promise<void> {
  const { error } = await supabase.from("agendamentos").update(agendamento).eq("id", id);
  if (error) throw error;
}

export async function deletarAgendamento(id: string): Promise<void> {
  const { error } = await supabase.from("agendamentos").delete().eq("id", id);
  if (error) throw error;
}

export async function confirmarSinal(id: string): Promise<void> {
  const { error } = await supabase.from('agendamentos').update({ sinal_status: 'CONFIRMADO' }).eq('id', id);
  if (error) throw error;
}

export async function gerarCobrancaSinal(
  id: string,
  destino: "SALAO" | "PROFISSIONAL",
  recebedorPerfilId: string | null,
  valor: number,
  chavePix: string,
  nomeBeneficiario: string,
  cidade: string
): Promise<void> {
  const { error } = await supabase
    .from("agendamentos")
    .update({
      sinal_status: "PENDENTE",
      sinal_destino: destino,
      sinal_recebedor_perfil_id: recebedorPerfilId,
      sinal_valor: valor,
      sinal_chave_pix: chavePix,
      sinal_nome_beneficiario: nomeBeneficiario,
      sinal_cidade: cidade,
    })
    .eq("id", id);
  if (error) throw error;
}
