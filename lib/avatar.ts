// Gera iniciais e uma cor consistente a partir do nome (mesmo padrão visual do app Android).

const PALETA_AVATAR = [
  { bg: "#f97362", fg: "#3a0d05" }, // coral
  { bg: "#5eead4", fg: "#06251f" }, // turquesa clara
  { bg: "#a78bfa", fg: "#241a4d" }, // lilás
  { bg: "#fbbf24", fg: "#3a2705" }, // âmbar
  { bg: "#60a5fa", fg: "#07213f" }, // azul
  { bg: "#f472b6", fg: "#3a0a24" }, // rosa
  { bg: "#4ade80", fg: "#062b13" }, // verde
];

export function iniciais(nome: string): string {
  return nome
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");
}

export function corAvatar(nome: string): { bg: string; fg: string } {
  let hash = 0;
  for (let i = 0; i < nome.length; i++) {
    hash = (hash << 5) - hash + nome.charCodeAt(i);
    hash |= 0;
  }
  return PALETA_AVATAR[Math.abs(hash) % PALETA_AVATAR.length];
}
