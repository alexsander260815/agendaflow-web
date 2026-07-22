"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";
import {
  CalendarDays,
  LayoutGrid,
  LogOut,
  Scissors,
  Users,
  Wallet,
} from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { corAvatar, iniciais } from "@/lib/avatar";

interface NavItem {
  href: string;
  label: string;
  icon: React.ComponentType<{ size?: number; strokeWidth?: number; className?: string }>;
}

export default function NavShell({ children }: { children: React.ReactNode }) {
  const { perfil, carregando, mostrarFinanceiro, logout } = useAuth();
  const pathname = usePathname();
  const router = useRouter();

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

  const items: NavItem[] = [
    { href: "/", label: "Início", icon: LayoutGrid },
    { href: "/agenda", label: "Agenda", icon: CalendarDays },
    { href: "/clientes", label: "Clientes", icon: Users },
    { href: "/servicos", label: "Serviços", icon: Scissors },
    ...(mostrarFinanceiro ? [{ href: "/financeiro", label: "Financeiro", icon: Wallet }] : []),
  ];

  const avatar = corAvatar(perfil.nome);

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
        <nav className="flex flex-1 flex-col gap-1 px-3">
          {items.map((item) => {
            const ativo = pathname === item.href;
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`group flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm transition-colors ${
                  ativo
                    ? "bg-accent/12 font-medium text-accent"
                    : "text-muted hover:bg-surface-alt hover:text-foreground"
                }`}
              >
                <Icon size={19} strokeWidth={ativo ? 2.4 : 2} />
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="flex items-center gap-3 border-t border-border-subtle px-4 py-4">
          <div
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-semibold"
            style={{ background: avatar.bg, color: avatar.fg }}
          >
            {iniciais(perfil.nome)}
          </div>
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
        {items.map((item) => {
          const ativo = pathname === item.href;
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex flex-1 flex-col items-center gap-1 py-2.5 text-[11px] transition-colors ${
                ativo ? "text-accent" : "text-muted"
              }`}
            >
              <Icon size={21} strokeWidth={ativo ? 2.4 : 2} />
              {item.label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
