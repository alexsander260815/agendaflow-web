import { supabase } from "@/lib/supabase";

export interface Convite {
  id: string;
  salao_id: string;
  codigo: string;
  papel: string;
  usado: boolean;
}

const CARACTERES = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

function gerarCodigo(): string {
  let codigo = "";
  for (let i = 0; i < 6; i++) {
    codigo += CARACTERES[Math.floor(Math.random() * CARACTERES.length)];
  }
  return codigo;
}

export async function buscarConvitePorCodigo(codigo: string): Promise<Convite | null> {
  const { data, error } = await supabase
    .from("convites")
    .select("*")
    .eq("codigo", codigo)
    .eq("usado", false)
    .maybeSingle();
  if (error) throw error;
  return data as Convite | null;
}

export async function gerarConvite(salaoId: string, papel: string): Promise<string> {
  const codigo = gerarCodigo();
  const { error } = await supabase.from("convites").insert({
    id: crypto.randomUUID(),
    salao_id: salaoId,
    codigo,
    papel,
    usado: false,
  });
  if (error) throw error;
  return codigo;
}
