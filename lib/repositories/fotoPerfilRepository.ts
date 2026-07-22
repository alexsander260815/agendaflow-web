import { supabase } from "@/lib/supabase";

export async function enviarFotoPerfil(perfilId: string, arquivo: File): Promise<string> {
  const caminho = `${perfilId}.jpg`;

  const { error: erroUpload } = await supabase.storage.from("avatars").upload(caminho, arquivo, {
    upsert: true,
    contentType: arquivo.type || "image/jpeg",
  });
  if (erroUpload) throw erroUpload;

  const { data } = supabase.storage.from("avatars").getPublicUrl(caminho);
  const urlComCacheBuster = `${data.publicUrl}?t=${Date.now()}`;

  const { error: erroUpdate } = await supabase
    .from("perfis")
    .update({ foto_url: urlComCacheBuster })
    .eq("id", perfilId);
  if (erroUpdate) throw erroUpdate;

  return urlComCacheBuster;
}
