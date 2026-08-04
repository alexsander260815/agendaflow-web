// Monta o "Pix Copia e Cola" (BR Code / EMV QR Code), o mesmo formato que
// qualquer banco lê pra gerar o QR Code de pagamento. Não depende de
// nenhum gateway — é só o padrão público do Banco Central (Pix), então
// funciona com a chave Pix de qualquer salão, direto pra conta dele.
//
// Referência: manual "BR Code" do Banco Central / arranjo Pix.

function campo(id: string, valor: string): string {
  const tamanho = valor.length.toString().padStart(2, "0");
  return `${id}${tamanho}${valor}`;
}

function sanitizar(texto: string, tamanhoMax: number): string {
  const semAcento = texto
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-zA-Z0-9 ]/g, "");
  return semAcento.slice(0, tamanhoMax).trim() || "NAO INFORMADO";
}

function crc16(payload: string): string {
  let crc = 0xffff;
  for (let i = 0; i < payload.length; i++) {
    crc ^= payload.charCodeAt(i) << 8;
    for (let bit = 0; bit < 8; bit++) {
      if ((crc & 0x8000) !== 0) {
        crc = ((crc << 1) ^ 0x1021) & 0xffff;
      } else {
        crc = (crc << 1) & 0xffff;
      }
    }
  }
  return crc.toString(16).toUpperCase().padStart(4, "0");
}

export interface DadosPix {
  chave: string;
  nomeBeneficiario: string;
  cidade: string;
  valor: number;
  identificador: string; // txid — até 25 caracteres alfanuméricos
}

export function montarPixCopiaECola(dados: DadosPix): string {
  const chave = dados.chave.trim();
  const nome = sanitizar(dados.nomeBeneficiario, 25);
  const cidade = sanitizar(dados.cidade, 15);
  const txid = (dados.identificador.replace(/[^a-zA-Z0-9]/g, "") || "***").slice(0, 25);
  const valor = dados.valor.toFixed(2);

  const merchantAccountInfo = [campo("00", "br.gov.bcb.pix"), campo("01", chave)].join("");

  const semCrc = [
    campo("00", "01"), // Payload Format Indicator
    campo("26", merchantAccountInfo), // Merchant Account Information (Pix)
    campo("52", "0000"), // Merchant Category Code
    campo("53", "986"), // Transaction Currency (BRL)
    campo("54", valor), // Transaction Amount
    campo("58", "BR"), // Country Code
    campo("59", nome), // Merchant Name
    campo("60", cidade), // Merchant City
    campo("62", campo("05", txid)), // Additional Data Field (txid)
    "6304", // CRC16 placeholder (id + tamanho fixo)
  ].join("");

  return semCrc + crc16(semCrc);
}
