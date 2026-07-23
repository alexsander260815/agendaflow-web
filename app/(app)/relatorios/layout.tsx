"use client";

import { useAuth } from "@/lib/auth-context";
import AcessoRestrito from "@/components/AcessoRestrito";

export default function RelatoriosLayout({ children }: { children: React.ReactNode }) {
  const { perfil } = useAuth();
  if (perfil && perfil.papel !== "DONO") return <AcessoRestrito />;
  return <>{children}</>;
}
