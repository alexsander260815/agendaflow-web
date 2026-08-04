import { supabase } from '@/lib/supabase';
import { Despesa } from '@/lib/types';

export async function listarDespesas(salaoId: string): Promise<Despesa[]> {
  const { data, error } = await supabase
    .from('despesas')
    .select('*')
    .eq('salao_id', salaoId)
    .order('data_despesa', { ascending: false });
  if (error) throw error;
  return data as Despesa[];
}

export async function salvarDespesa(despesa: Despesa): Promise<void> {
  const { error } = await supabase.from('despesas').insert(despesa);
  if (error) throw error;
}

export async function deletarDespesa(id: string): Promise<void> {
  const { error } = await supabase.from('despesas').delete().eq('id', id);
  if (error) throw error;
}
