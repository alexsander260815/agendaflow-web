import { supabase } from "@/lib/supabase";
import { FechamentoComissao } from "@/lib/types";

export async function salvarFechamentoComissao(fechamento: FechamentoComissao): Promise<void> {
  const { error } = await supabase.from("fechamentos_comissao").insert(fechamento);
  if (error) throw error;
}
