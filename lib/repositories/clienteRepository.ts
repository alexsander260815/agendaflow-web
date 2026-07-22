import { supabase } from "@/lib/supabase";
import { Cliente } from "@/lib/types";

export async function listarClientes(salaoId: string): Promise<Cliente[]> {
  const { data, error } = await supabase
    .from("clientes")
    .select("*")
    .eq("salao_id", salaoId)
    .order("nome", { ascending: true });
  if (error) throw error;
  return data as Cliente[];
}

export async function buscarCliente(id: string): Promise<Cliente | null> {
  const { data, error } = await supabase.from("clientes").select("*").eq("id", id).maybeSingle();
  if (error) throw error;
  return data as Cliente | null;
}

export async function salvarCliente(cliente: Cliente): Promise<void> {
  const { error } = await supabase.from("clientes").insert(cliente);
  if (error) throw error;
}

export async function atualizarCliente(id: string, cliente: Cliente): Promise<void> {
  const { error } = await supabase.from("clientes").update(cliente).eq("id", id);
  if (error) throw error;
}

export async function deletarCliente(id: string): Promise<void> {
  const { error } = await supabase.from("clientes").delete().eq("id", id);
  if (error) throw error;
}
