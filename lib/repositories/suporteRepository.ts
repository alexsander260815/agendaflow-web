import { supabase } from "@/lib/supabase";

export async function enviarMensagemSuporte(salaoId: string, remetenteNome: string, mensagem: string): Promise<void> {
  const { error } = await supabase.from("suporte_mensagens").insert({
    salao_id: salaoId,
    remetente_nome: remetenteNome,
    mensagem,
    status: "ABERTO",
  });
  if (error) throw error;
}
