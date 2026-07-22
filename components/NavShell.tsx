"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  BarChart3,
  Boxes,
  Building2,
  CalendarDays,
  CreditCard,
  HeartHandshake,
  LayoutGrid,
  LifeBuoy,
  LogOut,
  Menu,
  Scissors,
  Shield,
  User,
  Users,
  Wallet,
  X,
} from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import Avatar from "@/components/Avatar";

interface NavItem {
  href: string;
  label: string;
  icon: React.ComponentType<{ size?: number; strokeWidth?: number; className?: string }>;
  donoOnly?: boolean;
}

const ITENS_PRINCIPAIS: NavItem[] = [
  { href: "/", label: "Início", icon: LayoutGrid },
  { href: "/agenda", label: "Agenda", icon: CalendarDays },
  { href: "/clientes", label: "Clientes", icon: Users },
];

const ITENS_SECUNDARIOS: NavItem[] = [
  { href: "/servicos", label: "Serviços", icon: Scissors },
  { href: "/financeiro", label: "Financeiro", icon: Wallet },
  { href: "/estoque", label: "Estoque", icon: Boxes, donoOnly: true },
  { href: "/relatorios", label: "Relatórios", icon: BarChart3, donoOnly: true },
  { href: "/equipe", label: "Equipe", icon: HeartHandshake, donoOnly: true },
  { href: "/negocio", label: "Meu Negócio", icon: Building2, donoOnly: true },
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

  useEffect(() => {
    setMostrarMais(false);
  }, [pathname]);

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
    if (item.href === "/financeiro") return mostrarFinanceiro;
    if (item.donoOnly) return perfil.papel === "DONO";
    return true;
  };

  const secundariosVisiveis = [...ITENS_SECUNDARIOS.filter(podeVer), ...(souSuperAdmin ? [ITEM_PAINEL_ADMIN] : [])];

  async function handleLogout() {
    await logout();
    router.replace("/login");
  }

  return (
    <div className="flex flex-1 flex-col md:flex-row">
      {/* Sidebar desktop */}
      <aside className="hidden md:flex md:w-60 md:flex-col md:border-r md:border-border-subtle md:bg-surface">
        <div className="flex items-center gap-2.5 px-5 py-6">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-accent/15">
            <CalendarDays size={20} className="text-accent" strokeWidth={2.25} />
          </div>
          <span className="font-semibold tracking-tight">AgendaFlow</span>
        </div>
        <nav className="flex flex-1 flex-col gap-1 overflow-y-auto px-3">
          {ITENS_PRINCIPAIS.map((item) => (
            <NavLink key={item.href} item={item} ativo={pathname === item.href} />
          ))}
          {secundariosVisiveis.length > 0 && <div className="my-2 border-t border-border-subtle" />}
          {secundariosVisiveis.map((item) => (
            <NavLink key={item.href} item={item} ativo={pathname === item.href} />
          ))}
        </nav>
        <div className="flex items-center gap-3 border-t border-border-subtle px-4 py-4">
          <Avatar nome={perfil.nome} fotoUrl={perfil.foto_url} className="h-9 w-9 text-xs" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">{perfil.nome}</p>
            <p className="truncate text-xs text-muted">{perfil.papel}</p>
          </div>
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

      {/* Bottom tabs mobile */}
      <nav className="fixed bottom-0 left-0 right-0 z-20 flex border-t border-border-subtle bg-surface/95 backdrop-blur-md md:hidden">
        {ITENS_PRINCIPAIS.map((item) => (
          <TabLink key={item.href} item={item} ativo={pathname === item.href} />
        ))}
        <button
          onClick={() => setMostrarMais(true)}
          className={`flex flex-1 flex-col items-center gap-1 py-2.5 text-[11px] transition-colors ${
            mostrarMais || secundariosVisiveis.some((i) => i.href === pathname) ? "text-accent" : "text-muted"
          }`}
        >
          <Menu size={21} />
          Mais
        </button>
      </nav>

      {mostrarMais && (
        <div className="fixed inset-0 z-30 flex items-end bg-black/60 backdrop-blur-sm md:hidden" onClick={() => setMostrarMais(false)}>
          <div
            className="flex max-h-[80vh] w-full flex-col rounded-t-2xl bg-surface p-3 pb-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-2 flex shrink-0 items-center justify-between px-2 py-2">
              <span className="text-sm font-medium text-muted">Mais opções</span>
              <button onClick={() => setMostrarMais(false)} className="text-muted">
                <X size={18} />
              </button>
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
