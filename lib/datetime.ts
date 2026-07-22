// Helpers de data/hora compartilhados, mirror das funções Kotlin equivalentes.

export function converterIsoParaMillis(iso: string): number {
  return new Date(iso).getTime();
}

export function converterMillisParaIso(millis: number): string {
  return new Date(millis).toISOString();
}

export function inicioDoDia(millis: number = Date.now()): number {
  const d = new Date(millis);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

export function fimDoDia(millis: number = Date.now()): number {
  const d = new Date(millis);
  d.setHours(23, 59, 59, 999);
  return d.getTime();
}

export function intervaloDoMes(millis: number = Date.now()): [number, number] {
  const d = new Date(millis);
  const inicio = new Date(d.getFullYear(), d.getMonth(), 1, 0, 0, 0, 0);
  const fim = new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59, 999);
  return [inicio.getTime(), fim.getTime()];
}

export function formatarHora(millis: number): string {
  const d = new Date(millis);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

export function formatarDataHora(millis: number): string {
  const d = new Date(millis);
  const data = `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
  return `${data} às ${formatarHora(millis)}`;
}

export function formatarMoeda(valor: number): string {
  return `R$ ${valor.toFixed(2).replace(".", ",")}`;
}

const DIAS_SEMANA = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

export function labelDiaCurto(millis: number): string {
  return DIAS_SEMANA[new Date(millis).getDay()];
}

export type PeriodoRapido = "ESTE_MES" | "ULTIMO_MES" | "ULTIMOS_7_DIAS";

export function intervaloPeriodoRapido(periodo: PeriodoRapido, agora: number = Date.now()): [number, number] {
  const d = new Date(agora);
  if (periodo === "ESTE_MES") {
    const inicio = new Date(d.getFullYear(), d.getMonth(), 1, 0, 0, 0, 0);
    return [inicio.getTime(), fimDoDia(agora)];
  }
  if (periodo === "ULTIMO_MES") {
    const inicio = new Date(d.getFullYear(), d.getMonth() - 1, 1, 0, 0, 0, 0);
    const fim = new Date(d.getFullYear(), d.getMonth(), 0, 23, 59, 59, 999);
    return [inicio.getTime(), fim.getTime()];
  }
  // ULTIMOS_7_DIAS
  const inicio = inicioDoDia(agora - 7 * 24 * 60 * 60 * 1000);
  return [inicio, fimDoDia(agora)];
}

export function janelaUltimosDias(dias: number, agora: number = Date.now()): [number, number] {
  return [agora - dias * 24 * 60 * 60 * 1000, agora];
}

export function formatarData(millis: number): string {
  const d = new Date(millis);
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
}

export function formatarStatus(status: string): string {
  switch (status) {
    case "CONCLUIDO":
      return "Concluído";
    case "FALTOU":
      return "Faltou";
    case "AGENDADO":
      return "Agendado";
    default:
      return status;
  }
}
