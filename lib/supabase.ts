import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = "https://njdgvrkcjuscyyftioku.supabase.co";
const SUPABASE_KEY = "sb_publishable_H1BViud9sTNpEQebJ3yabA_WI20A_vf";

const UM_ANO_EM_SEGUNDOS = 60 * 60 * 24 * 365;
const TAMANHO_MAX_PEDACO = 3000;

function lerCookie(nome: string): string | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie.match(new RegExp(`(?:^|; )${nome}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : null;
}

function gravarCookie(nome: string, valor: string) {
  if (typeof document === "undefined") return;
  const seguro = typeof location !== "undefined" && location.protocol === "https:" ? "; Secure" : "";
  document.cookie = `${nome}=${encodeURIComponent(valor)}; path=/; max-age=${UM_ANO_EM_SEGUNDOS}; SameSite=Lax${seguro}`;
}

function apagarCookie(nome: string) {
  if (typeof document === "undefined") return;
  document.cookie = `${nome}=; path=/; max-age=0`;
}

/**
 * Storage do Supabase reforçado com cookie (além do localStorage padrão).
 * No iOS, quando o site é adicionado à tela de início e o app é fechado de
 * verdade (removido do multitarefas), a Safari às vezes limpa o
 * localStorage do app instalado — derrubando a sessão a cada reabertura.
 * Guardar uma cópia em cookie (com validade de 1 ano) dá uma segunda chance
 * de restaurar a sessão nesse cenário, sem depender só do localStorage.
 */
const storageComReforcoDeCookie = {
  getItem(chave: string): string | null {
    try {
      const doLocalStorage = window.localStorage.getItem(chave);
      if (doLocalStorage) return doLocalStorage;
    } catch {
      // localStorage indisponível (modo privado etc.) — segue pro cookie
    }

    let resultado = "";
    let indice = 0;
    while (true) {
      const pedaco = lerCookie(`${chave}-${indice}`);
      if (pedaco === null) break;
      resultado += pedaco;
      indice++;
    }
    if (resultado.length === 0) return null;

    // Se achou no cookie mas não no localStorage, restaura o localStorage
    // também, pra próxima leitura já vir rápido de lá.
    try {
      window.localStorage.setItem(chave, resultado);
    } catch {
      // sem problema, o cookie continua servindo de fonte
    }
    return resultado;
  },

  setItem(chave: string, valor: string) {
    try {
      window.localStorage.setItem(chave, valor);
    } catch {
      // segue mesmo assim — o cookie ainda vai guardar o valor
    }

    let indice = 0;
    for (let i = 0; i < valor.length; i += TAMANHO_MAX_PEDACO) {
      gravarCookie(`${chave}-${indice}`, valor.slice(i, i + TAMANHO_MAX_PEDACO));
      indice++;
    }
    // Limpa pedaços de uma gravação anterior maior que a atual.
    while (lerCookie(`${chave}-${indice}`) !== null) {
      apagarCookie(`${chave}-${indice}`);
      indice++;
    }
  },

  removeItem(chave: string) {
    try {
      window.localStorage.removeItem(chave);
    } catch {
      // ignora
    }
    let indice = 0;
    while (lerCookie(`${chave}-${indice}`) !== null) {
      apagarCookie(`${chave}-${indice}`);
      indice++;
    }
  },
};

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    storage: storageComReforcoDeCookie,
  },
});
