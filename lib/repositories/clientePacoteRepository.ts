import { supabase } from "@/lib/supabase";
import { ClientePacote } from "@/lib/types";

export async function listarClientePacotes(salaoId: string): Promise<ClientePacote[]> {
  const { data, error } = await supabase.from("cliente_pacotes").select("*").eq("salao_id", salaoId);
  if (error) throw error;
  return data as ClientePacote[];
}

export async function listarClientePacotesPorCliente(clienteId: string): Promise<ClientePacote[]> {
  const { data, error } = await supabase.from("cliente_pacotes").select("*").eq("cliente_id", clienteId);
  if (error) throw error;
  return data as ClientePacote[];
}

export async function buscarClientePacote(id: string): Promise<ClientePacote | null> {
  const { data, error } = await supabase.from("cliente_pacotes").select("*").eq("id", id).maybeSingle();
  if (error) throw error;
  return data as ClientePacote | null;
}

export async function comprarPacote(clientePacote: ClientePacote): Promise<void> {
  const { error } = await supabase.from("cliente_pacotes").insert(clientePacote);
  if (error) throw error;
}

export async function atualizarQuantidadeClientePacote(id: string, novaQuantidade: number): Promise<void> {
  const { error } = await supabase
    .from("cliente_pacotes")
    .update({ quantidade_restante: novaQuantidade })
    .eq("id", id);
  if (error) throw error;
}
