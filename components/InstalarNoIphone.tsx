"use client";

import { useEffect, useState } from "react";
import { Share, SquarePlus, X } from "lucide-react";

interface NavegadorComStandalone extends Navigator {
  standalone?: boolean;
}

export default function InstalarNoIphone() {
  const [mostrar, setMostrar] = useState(false);

  useEffect(() => {
    if (localStorage.getItem("dispensou_instalar_iphone")) return;

    const ehIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
    const jaInstalado =
      window.matchMedia("(display-mode: standalone)").matches ||
      (navigator as NavegadorComStandalone).standalone === true;

    if (ehIOS && !jaInstalado) setMostrar(true);
  }, []);

  function dispensar() {
    setMostrar(false);
    localStorage.setItem("dispensou_instalar_iphone", "1");
  }

  if (!mostrar) return null;

  return (
    <div className="mx-auto mt-4 flex max-w-xl items-start gap-3 rounded-xl border border-accent/25 bg-accent/10 p-4 text-sm">
      <SquarePlus size={18} className="mt-0.5 shrink-0 text-accent" />
      <p className="flex-1">
        No iPhone: toque no ícone de compartilhar{" "}
        <Share size={14} className="inline -translate-y-0.5" /> aqui do Safari e depois em{" "}
        <span className="font-medium">&quot;Adicionar à Tela de Início&quot;</span> — assim o AgendaFlow fica com ícone
        próprio, igual um app.
      </p>
      <button onClick={dispensar} aria-label="Fechar" className="shrink-0 text-muted hover:text-foreground">
        <X size={16} />
      </button>
    </div>
  );
}
