"use client";

import Link from "next/link";
import { ArrowLeft } from "lucide-react";

// Só aparece no mobile: no desktop a barra lateral já deixa o Início sempre visível.
export default function BotaoVoltarInicio() {
  return (
    <Link
      href="/"
      aria-label="Voltar para o início"
      className="mr-2 flex items-center justify-center rounded-lg p-1.5 text-muted transition-colors hover:bg-surface hover:text-foreground md:hidden"
    >
      <ArrowLeft size={20} />
    </Link>
  );
}
