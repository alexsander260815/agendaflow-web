"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  BarChart3,
  BellRing,
  Boxes,
  Building2,
  Calculator,
  CalendarDays,
  CalendarOff,
  CreditCard,
  HeartHandshake,
  Landmark,
  LayoutGrid,
  LifeBuoy,
  LogOut,
  Menu,
  MessageSquare,
  Moon,
  Scissors,
  Shield,
  Target,
  Sun,
  User,
  Users,
  Wallet,
  X,
} from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import Avatar from "@/components/Avatar";
import AssistenteAgenda from '@/components/AssistenteAgenda';
import { buscarMeuSalao, listarMensagensSuporte } from "@/lib/repositories";
import { aplicarModoTema, aplicarTemaVisual, obterModoTema, type ModoTema } from '@/lib/theme';
import type { Salao } from '@/lib/types';

interface NavItem {
  href: string;
  label: string;
  icon: React.ComponentType<{ size?: number; strokeWidth?: number; className?: string }>;
  donoOnly?: boolean;
  financeiroOnly?: boolean;
  badge?: number;
}

const ITENS_PRINCIPAIS: NavItem[] = [
  { href: "/dashboard", label: "Início", icon: LayoutGrid },
  { href: "/agenda", label: "Agenda", icon: CalendarDays },
  { href: "/financeiro", label: "Financeiro", icon: Wallet, financeiroOnly: true },
];

const ITENS_GESTAO: NavItem[] = [
  { href: "/relatorios", label: "Relatórios", icon: BarChart3, financeiroOnly: true },
  { href: '/meta-faturamento', label: 'Meta de Faturamento', icon: Target },
  { href: '/calculadora-preco', label: 'Calculadora de Preço', icon: Calculator },
  { href: "/mensagens", label: "Mensagens", icon: MessageSquare },
];

const ITENS_OPERACOES: NavItem[] = [
  { href: "/estoque", label: "Estoque", icon: Boxes, donoOnly: true },
  { href: "/equipe", label: "Equipe", icon: HeartHandshake, donoOnly: true },
  { href: "/clientes", label: "Clientes", icon: Users },
  { href: "/servicos", label: "Serviços", icon: Scissors },
  { href: "/retorno-clientes", label: "Retorno de Clientes", icon: BellRing },
  { href: "/bloqueios-agenda", label: "Bloqueios de Agenda", icon: CalendarOff },
];

const ITENS_CONFIGURACOES: NavItem[] = [
  { href: "/negocio", label: "Meu Negócio", icon: Building2, donoOnly: true },
  { href: "/pagamentos", label: "Pagamentos", icon: Landmark, donoOnly: true },
  { href: "/planos", label: "Planos", icon: CreditCard, donoOnly: true },
  { href: "/perfil", label: "Meu Perfil", icon: User },
  { href: "/suporte", label: "Suporte", icon: LifeBuoy },
];

const ITEM_PAINEL_ADMIN: NavItem = { href: "/painel-admin", label: "Painel Admin", icon: Shield };

export default function NavShell({ children }: { children: React.ReactNode }) {
  const { perfil, carregando, mostrarFinanceiro, souSuperAdmin, logout } = useAuth();
  const pathname = usePathname();
  const router = useRouter();
  const [mostrarMais, setMostrarMais] = useState(false);
  const [contagemSuporte, setContagemSuporte] = useState(0);
  const [salao, setSalao] = useState<Salao | null>(null);
  const [modoTema, setModoTema] = useState<ModoTema>('escuro');

  useEffect(() => {
    const frame = requestAnimationFrame(() => setModoTema(obterModoTema()));
    return () => cancelAnimationFrame(frame);
  }, []);

  useEffect(() => {
    const frame = requestAnimationFrame(() => setMostrarMais(false));
    return () => cancelAnimationFrame(frame);
  }, [pathname]);

  useEffect(() => {
    if (!perfil) return;
    if (perfil.tema_visual) {
      aplicarTemaVisual(perfil.tema_visual);
      return;
    }
    buscarMeuSalao(perfil.salao_id)
      .then((salaoAtual) => { setSalao(salaoAtual); aplicarTemaVisual(salaoAtual?.tema_visual); })
      .catch(() => aplicarTemaVisual());
  }, [perfil]);

  useEffect(() => {
    if (!perfil) return;
    buscarMeuSalao(perfil.salao_id).then(setSalao).catch(() => setSalao(null));
  }, [perfil]);

  useEffect(() => {
    if (!souSuperAdmin) return;
    listarMensagensSuporte()
      .then((mensagens) => setContagemSuporte(mensagens.filter((m) => m.status === "ABERTO").length))
      .catch(() => setContagemSuporte(0));
  }, [souSuperAdmin]);

  useEffect(() => {
    if (!carregando && !perfil) {
      router.replace("/login");
    }
  }, [carregando, perfil, router]);

  if (carregando || !perfil) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-accent border-t-transparent" />
      </div>
    );
  }

  const podeVer = (item: NavItem) => {
    if (item.href === "/financeiro" || item.href === "/relatorios" || item.financeiroOnly) return mostrarFinanceiro;
    if (item.donoOnly) return perfil.papel === "DONO";
    return true;
  };

  const grupos = [
    { titulo: 'Principal', itens: ITENS_PRINCIPAIS.filter(podeVer) },
    { titulo: 'Gestão', itens: ITENS_GESTAO.filter(podeVer) },
    { titulo: 'Operações', itens: ITENS_OPERACOES.filter(podeVer) },
    { titulo: 'Configurações', itens: [...ITENS_CONFIGURACOES.filter(podeVer), ...(souSuperAdmin ? [{ ...ITEM_PAINEL_ADMIN, badge: contagemSuporte || undefined }] : [])] },
  ];
  const secundariosVisiveis = [
    ...ITENS_GESTAO.filter(podeVer), ...ITENS_OPERACOES.filter(podeVer), ...ITENS_CONFIGURACOES.filter(podeVer),
    ...(souSuperAdmin ? [{ ...ITEM_PAINEL_ADMIN, badge: contagemSuporte > 0 ? contagemSuporte : undefined }] : []),
  ];

  async function handleLogout() {
    await logout();
    router.replace("/login");
  }

  function alternarModoTema() {
    const proximo: ModoTema = modoTema === 'escuro' ? 'claro' : 'escuro';
    setModoTema(proximo);
    aplicarModoTema(proximo);
  }

  const itensRodape = [
    { href: '/dashboard', label: 'Início', icon: LayoutGrid },
    { href: '/agenda', label: 'Agenda', icon: CalendarDays },
    { href: '/clientes', label: 'Clientes', icon: Users },
    { href: '/servicos', label: 'Serviços', icon: Scissors },
    ...(mostrarFinanceiro ? [{ href: '/financeiro', label: 'Financeiro', icon: Wallet }] : []),
  ];

  return (
    <div className="premium-shell flex min-h-dvh flex-1 flex-col md:flex-row">
      {/* Sidebar desktop */}
      <aside className="hidden md:flex md:w-72 md:flex-col md:border-r md:border-border-subtle md:bg-surface/92 md:backdrop-blur-xl">
        <div className="flex items-center gap-3 border-b border-border-subtle px-5 py-5">
          <Avatar nome={salao?.nome || 'AgendaFlow'} fotoUrl={salao?.logo_url} className="h-16 w-16 rounded-2xl text-lg ring-1 ring-accent/40" />
          <div className="min-w-0">
            <p className="truncate text-base font-semibold">{salao?.nome || 'AgendaFlow'}</p>
            <p className="truncate text-xs text-muted">{perfil.nome} · {perfil.papel}</p>
          </div>
        </div>
        <nav className="flex flex-1 flex-col gap-4 overflow-y-auto px-3 py-4">
          {grupos.map((grupo) => grupo.itens.length > 0 && <div key={grupo.titulo}>
            <p className="mb-1 px-3 text-[10px] font-semibold uppercase tracking-[.16em] text-muted">{grupo.titulo}</p>
            <div className="space-y-1">{grupo.itens.map((item) => <NavLink key={item.href} item={item} ativo={pathname === item.href} />)}</div>
          </div>)}
        </nav>
        <div className="flex items-center gap-3 border-t border-border-subtle px-4 py-4">
          <Avatar nome={perfil.nome} fotoUrl={perfil.foto_url} className="h-9 w-9 text-xs" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">{perfil.nome}</p>
            <p className="truncate text-xs text-muted">{perfil.papel}</p>
          </div>
          <button
            onClick={alternarModoTema}
            aria-label={modoTema === 'escuro' ? 'Ativar modo claro' : 'Ativar modo escuro'}
            className="rounded-xl border border-border-subtle p-2 text-muted transition hover:bg-surface-alt hover:text-accent"
          >{modoTema === 'escuro' ? <Sun size={18} /> : <Moon size={18} />}</button>
          <button
            onClick={handleLogout}
            aria-label="Sair"
            className="rounded-lg p-2 text-muted transition-colors hover:bg-surface-alt hover:text-danger"
          >
            <LogOut size={17} />
          </button>
        </div>
      </aside>

      {/* Conteúdo */}
      <main className="flex-1 overflow-y-auto pb-24 md:pb-0">{children}</main>
      <AssistenteAgenda />

      {/* Bottom tabs mobile */}
      <nav className="premium-nav-glow fixed bottom-2 left-2 right-2 z-20 flex rounded-2xl border border-border-subtle bg-surface/95 px-1 py-1 backdrop-blur-xl md:hidden">
        {itensRodape.map((item) => (
          <TabLink key={item.href} item={item} ativo={pathname === item.href} />
        ))}
      </nav>
      <button onClick={() => setMostrarMais(true)} aria-label="Abrir mais opções" className="fixed bottom-20 right-4 z-20 rounded-2xl border border-accent/30 bg-surface p-3 text-accent shadow-lg md:hidden"><Menu size={23} /></button>

      {mostrarMais && (
        <div className="fixed inset-0 z-30 flex items-end bg-black/60 backdrop-blur-sm md:hidden" onClick={() => setMostrarMais(false)}>
          <div
            className="flex max-h-[80vh] w-full flex-col rounded-t-2xl bg-surface p-3 pb-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-2 flex shrink-0 items-center justify-between px-2 py-2">
              <span className="text-sm font-medium text-muted">Mais opções</span>
              <div className="flex gap-2"><button onClick={alternarModoTema} className="rounded-lg p-2 text-accent">{modoTema === 'escuro' ? <Sun size={19} /> : <Moon size={19} />}</button><button onClick={() => setMostrarMais(false)} className="p-2 text-muted"><X size={18} /></button></div>
            </div>
            <div className="flex flex-col gap-1 overflow-y-auto">
              {secundariosVisiveis.map((item) => {
                const Icone = item.icon;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`flex items-center gap-3 rounded-xl px-3 py-3 text-sm ${
                      pathname === item.href ? "bg-accent/12 font-medium text-accent" : ""
                    }`}
                  >
                    <Icone size={19} />
                    {item.label}
                    {!!item.badge && (
                      <span className="ml-auto flex h-5 min-w-5 items-center justify-center rounded-full bg-danger px-1.5 text-[11px] font-semibold text-white">
                        {item.badge}
                      </span>
                    )}
                  </Link>
                );
              })}
              <button
                onClick={handleLogout}
                className="flex items-center gap-3 rounded-xl px-3 py-3 text-left text-sm text-danger"
              >
                <LogOut size={19} />
                Sair
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function NavLink({ item, ativo }: { item: NavItem; ativo: boolean }) {
  const Icone = item.icon;
  return (
    <Link
      href={item.href}
      className={`group flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm transition-colors ${
        ativo ? "bg-accent/12 font-medium text-accent" : "text-muted hover:bg-surface-alt hover:text-foreground"
      }`}
    >
      <Icone size={19} strokeWidth={ativo ? 2.4 : 2} />
      {item.label}
      {!!item.badge && (
        <span className="ml-auto flex h-5 min-w-5 items-center justify-center rounded-full bg-danger px-1.5 text-[11px] font-semibold text-white">
          {item.badge}
        </span>
      )}
    </Link>
  );
}

function TabLink({ item, ativo }: { item: NavItem; ativo: boolean }) {
  const Icone = item.icon;
  return (
    <Link
      href={item.href}
      className={`flex flex-1 flex-col items-center gap-1 py-2.5 text-[11px] transition-colors ${
        ativo ? "text-accent" : "text-muted"
      }`}
    >
      <Icone size={21} strokeWidth={ativo ? 2.4 : 2} />
      {item.label}
    </Link>
  );
}
