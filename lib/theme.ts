export interface TemaVisual {
  id: string;
  nome: string;
  descricao: string;
  cores: [string, string, string];
  novo?: boolean;
}

export const TEMA_PADRAO = 'azul_grafite';
export type ModoTema = 'claro' | 'escuro';
export const CHAVE_MODO_TEMA = 'agendaflow_modo_tema';

export const TEMAS_VISUAIS: TemaVisual[] = [
  { id: 'roxo_rosa', nome: 'Roxo & Rosa', descricao: 'Criativo e marcante', cores: ['#21152b', '#6d3f78', '#f19ac2'] },
  { id: 'azul_grafite', nome: 'Azul & Grafite', descricao: 'Profissional e moderno', cores: ['#111827', '#334155', '#38bdf8'] },
  { id: 'verde_dourado', nome: 'Verde & Dourado', descricao: 'Sofisticado e natural', cores: ['#10241f', '#315b4c', '#d9b95b'] },
  { id: 'preto_vermelho', nome: 'Preto & Vermelho', descricao: 'Forte e direto', cores: ['#121212', '#343434', '#ef4444'] },
  { id: 'rose_champagne', nome: 'Rosé & Champagne', descricao: 'Delicado e elegante', cores: ['#241a1d', '#6f4c57', '#e7a9a9'], novo: true },
  { id: 'lilas_lavanda', nome: 'Lilás & Lavanda', descricao: 'Leve e acolhedor', cores: ['#1d1930', '#514773', '#b8a7f2'], novo: true },
  { id: 'terracota_creme', nome: 'Terracota & Creme', descricao: 'Quente e natural', cores: ['#291b16', '#70483a', '#e3936f'], novo: true },
  { id: 'petroleo_coral', nome: 'Petróleo & Coral', descricao: 'Contemporâneo e vibrante', cores: ['#102328', '#28525c', '#ff806b'], novo: true },
  { id: 'neon_cyber', nome: 'Neon Cyber', descricao: 'Rosa, ciano e roxo elétrico', cores: ['#0a0014', '#b026ff', '#ff2e9e'], novo: true },
  { id: 'neon_lima', nome: 'Neon Lima', descricao: 'Verde-limão vibrante com pink', cores: ['#0a0f00', '#ff3ec9', '#ccff00'], novo: true },
  { id: 'preto_dourado', nome: 'Preto & Dourado', descricao: 'Luxuoso e sofisticado — visual premium', cores: ['#0a0a0a', '#201e19', '#e8c468'], novo: true },
  { id: 'azul_dourado', nome: 'Azul & Dourado', descricao: 'Elegante e imponente — realeza com sofisticação', cores: ['#0b121f', '#1d2c42', '#d4af37'], novo: true },
  { id: 'azul_classico', nome: 'Azul Clássico', descricao: 'Simples e direto — o azul mais usado em apps de agenda', cores: ['#0f1729', '#22304a', '#4285f4'], novo: true },
];

export function aplicarTemaVisual(tema?: string | null): void {
  if (typeof document === 'undefined') return;
  const existe = TEMAS_VISUAIS.some((item) => item.id === tema);
  document.documentElement.dataset.theme = existe ? tema! : TEMA_PADRAO;
}

export function aplicarModoTema(modo: ModoTema): void {
  if (typeof document === 'undefined') return;
  document.documentElement.dataset.mode = modo;
  window.localStorage.setItem(CHAVE_MODO_TEMA, modo);
}

export function obterModoTema(): ModoTema {
  if (typeof window === 'undefined') return 'escuro';
  return window.localStorage.getItem(CHAVE_MODO_TEMA) === 'claro' ? 'claro' : 'escuro';
}
