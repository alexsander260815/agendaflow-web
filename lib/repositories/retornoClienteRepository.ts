import { supabase } from "@/lib/supabase";
import { RetornoCliente } from "@/lib/types";

export async function criarRetornoCliente(retorno: Omit<RetornoCliente, "id" | "criado_em">): Promise<void> {
  const { error } = await supabase.from("retornos_clientes").insert(retorno);
  if (error) throw error;
}

export async function listarRetornosPendentes(salaoId: string): Promise<RetornoCliente[]> {
  const { data, error } = await supabase
    .from("retornos_clientes")
    .select("*")
    .eq("salao_id", salaoId)
    .eq("status", "PENDENTE")
    .order("data_retorno", { ascending: true });
  if (error) throw error;
  return data as RetornoCliente[];
}

export async function marcarStatusRetorno(id: string, status: RetornoCliente["status"]): Promise<void> {
  const { error } = await supabase.from("retornos_clientes").update({ status }).eq("id", id);
  if (error) throw error;
}
