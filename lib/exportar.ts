export interface ColunaExportacao {
  chave: string;
  rotulo: string;
}

function celulaParaCsv(valor: unknown): string {
  const texto = valor === null || valor === undefined ? "" : String(valor);
  if (/[",;\n]/.test(texto)) return `"${texto.replace(/"/g, '""')}"`;
  return texto;
}

// BOM no início faz o Excel abrir o CSV em UTF-8 corretamente (sem isso,
// acento vira caractere estranho quando abre no Excel do Windows).
export function exportarCsv(nomeArquivo: string, colunas: ColunaExportacao[], linhas: unknown[]): void {
  const cabecalho = colunas.map((c) => celulaParaCsv(c.rotulo)).join(";");
  const corpo = linhas
    .map((linha) => colunas.map((c) => celulaParaCsv((linha as Record<string, unknown>)[c.chave])).join(";"))
    .join("\n");
  const csv = "﻿" + [cabecalho, corpo].join("\n");

  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `${nomeArquivo}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export interface SecaoExportacao {
  titulo: string;
  colunas: ColunaExportacao[];
  linhas: unknown[];
}

// Usado pra exportação de dados do cliente (LGPD/portabilidade) — várias
// tabelas relacionadas (cadastro, pacotes, histórico) num único CSV, cada uma
// com seu próprio título e cabeçalho, separadas por linha em branco.
export function exportarCsvSecoes(nomeArquivo: string, secoes: SecaoExportacao[]): void {
  const blocos = secoes.map((secao) => {
    const cabecalho = secao.colunas.map((c) => celulaParaCsv(c.rotulo)).join(";");
    const corpo = secao.linhas
      .map((linha) => secao.colunas.map((c) => celulaParaCsv((linha as Record<string, unknown>)[c.chave])).join(";"))
      .join("\n");
    return [celulaParaCsv(secao.titulo), cabecalho, corpo].filter(Boolean).join("\n");
  });
  const csv = "﻿" + blocos.join("\n\n");

  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `${nomeArquivo}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
