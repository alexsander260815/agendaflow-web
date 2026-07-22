import { supabase } from "@/lib/supabase";

export async function enviarLogo(salaoId: string, arquivo: File): Promise<string> {
  const caminho = `${salaoId}.jpg`;

  const { error: erroUpload } = await supabase.storage.from("logos").upload(caminho, arquivo, {
    upsert: true,
    contentType: arquivo.type || "image/jpeg",
  });
  if (erroUpload) throw erroUpload;

  const { data } = supabase.storage.from("logos").getPublicUrl(caminho);
  const urlComCacheBuster = `${data.publicUrl}?t=${Date.now()}`;

  const { error: erroUpdate } = await supabase.from("saloes").update({ logo_url: urlComCacheBuster }).eq("id", salaoId);
  if (erroUpdate) throw erroUpdate;

  return urlComCacheBuster;
}
