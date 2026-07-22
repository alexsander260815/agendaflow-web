export function abrirWhatsApp(telefone: string, mensagem: string): void {
  const numero = telefone.replace(/\D/g, "");
  window.open(`https://wa.me/55${numero}?text=${encodeURIComponent(mensagem)}`, "_blank");
}
