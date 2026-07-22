"use client";

import Link from "next/link";
import {
  CalendarX,
  Heart,
  History,
  ListChecks,
  Percent,
  TrendingUp,
  User,
  Wallet,
} from "lucide-react";

const RELATORIOS = [
  {
    href: "/relatorios/historico-atendimentos",
    icon: History,
    titulo: "Histórico de Atendimentos",
    descricao: "Todos os atendimentos concluídos no período.",
  },
  {
    href: "/relatorios/historico-servicos",
    icon: ListChecks,
    titulo: "Histórico de Serviços",
    descricao: "Serviços mais prestados e receita gerada.",
  },
  {
    href: "/relatorios/receita-profissional",
    icon: User,
    titulo: "Receita por Profissional",
    descricao: "Quanto cada profissional faturou.",
  },
  {
    href: "/relatorios/receita-servico",
    icon: Wallet,
    titulo: "Receita por Serviço",
    descricao: "Quais serviços mais geram receita.",
  },
  {
    href: "/relatorios/receita-dia",
    icon: TrendingUp,
    titulo: "Receita por Dia",
    descricao: "Faturamento por dia da semana.",
  },
  {
    href: "/relatorios/faltas",
    icon: CalendarX,
    titulo: "Relatório de Faltas",
    descricao: "Taxa de faltas e receita perdida (últimos 30 dias).",
  },
  {
    href: "/relatorios/fidelizacao",
    icon: Heart,
    titulo: "Fidelização por Profissional",
    descricao: "Quantos clientes retornam (últimos 30 dias).",
  },
  {
    href: "/relatorios/comissoes",
    icon: Percent,
    titulo: "Relatório de Comissões",
    descricao: "Comissões pendentes e fechamento por profissional.",
  },
];

export default function RelatoriosPage() {
  return (
    <div className="mx-auto max-w-3xl p-5 md:p-8">
      <h1 className="mb-5 text-2xl font-semibold tracking-tight">Relatórios</h1>

      <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
        {RELATORIOS.map((r) => {
          const Icone = r.icon;
          return (
            <Link
              key={r.href}
              href={r.href}
              className="card-elevated flex items-start gap-3 rounded-xl bg-surface p-4 transition-colors hover:bg-surface-alt"
            >
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-accent/12">
                <Icone size={17} className="text-accent" />
              </div>
              <div className="min-w-0">
                <p className="font-medium">{r.titulo}</p>
                <p className="mt-0.5 text-sm text-muted">{r.descricao}</p>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
