import { supabase } from '@/lib/supabase';
import { FichaTecnica } from '@/lib/types';

export async function listarFichasDoCliente(clienteId: string): Promise<FichaTecnica[]> {
  const { data, error } = await supabase
    .from('fichas_tecnicas')
    .select('*')
    .eq('cliente_id', clienteId)
    .order('criado_em', { ascending: false });
  if (error) throw error;
  return data as FichaTecnica[];
}

export async function salvarFichaTecnica(ficha: FichaTecnica): Promise<void> {
  const { error } = await supabase.from('fichas_tecnicas').insert(ficha);
  if (error) throw error;
}

export async function enviarArquivoFicha(salaoId: string, prefixo: string, arquivo: Blob): Promise<string> {
  const caminho = `${salaoId}/${prefixo}_${Date.now()}_${crypto.randomUUID()}.png`;
  const { error } = await supabase.storage.from('fichas-tecnicas').upload(caminho, arquivo, {
    contentType: arquivo.type || 'image/png',
    upsert: false,
  });
  if (error) throw error;
  return supabase.storage.from('fichas-tecnicas').getPublicUrl(caminho).data.publicUrl;
}
