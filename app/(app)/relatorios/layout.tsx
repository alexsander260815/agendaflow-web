"use client";

import { useAuth } from "@/lib/auth-context";
import AcessoRestrito from "@/components/AcessoRestrito";

export default function RelatoriosLayout({ children }: { children: React.ReactNode }) {
  const { perfil, carregando, mostrarFinanceiro } = useAuth();
  if (perfil && !carregando && !mostrarFinanceiro) return <AcessoRestrito />;
  return <>{children}</>;
}
