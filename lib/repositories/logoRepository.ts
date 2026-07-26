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

  const { data: linhasAtualizadas, error: erroUpdate } = await supabase
    .from("saloes")
    .update({ logo_url: urlComCacheBuster })
    .eq("id", salaoId)
    .select("id");
  if (erroUpdate) throw erroUpdate;
  if (!linhasAtualizadas || linhasAtualizadas.length === 0) {
    throw new Error("O logo não foi salvo (0 linhas afetadas) — provavelmente uma política de acesso do banco está bloqueando.");
  }

  return urlComCacheBuster;
}
