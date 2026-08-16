"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  BarChart3,
  Boxes,
  CalendarDays,
  Calculator,
  MessageSquare,
  Target,
  Users,
  Wallet,
} from "lucide-react";
import { listarPlanos } from "@/lib/repositories";
import { Plano } from "@/lib/types";
import { formatarMoeda } from "@/lib/datetime";

const FUNCIONALIDADES = [
  {
    icon: CalendarDays,
    titulo: "Agenda inteligente",
    descricao: "Cada profissional com sua própria grade, bloqueios de horário e visão do dia, semana e mês.",
  },
  {
    icon: Wallet,
    titulo: "Financeiro completo",
    descricao: "Fechamento de caixa, comissões e resumo semanal/mensal separado por profissional.",
  },
  {
    icon: MessageSquare,
    titulo: "Mensagens automáticas",
    descricao: "Confirmação, remarcação, cancelamento e retorno de cliente no WhatsApp — cada profissional pode personalizar a sua.",
  },
  {
    icon: Target,
    titulo: "Meta de faturamento",
    descricao: "Cada profissional acompanha a própria meta e o próprio faturamento do mês, sem ver o dos colegas.",
  },
  {
    icon: Calculator,
    titulo: "Calculadora de preço",
    descricao: "Descubra quanto cobrar em cada atendimento a partir do material gasto, do tempo e da margem desejada.",
  },
  {
    icon: Boxes,
    titulo: "Controle de estoque",
    descricao: "Produtos, consumo por serviço e alerta de saldo mínimo.",
  },
  {
    icon: Users,
    titulo: "Gestão de equipe",
    descricao: "Convide profissionais, defina permissões e o que cada um pode ver.",
  },
  {
    icon: BarChart3,
    titulo: "Relatórios detalhados",
    descricao: "Faltas, histórico de atendimentos, ranking de clientes e receita por serviço.",
  },
];

export default function PaginaInicial() {
  const [planos, setPlanos] = useState<Plano[] | null>(null);

  useEffect(() => {
    listarPlanos()
      .then((lista) => setPlanos(lista.sort((a, b) => a.faixa_min - b.faixa_min)))
      .catch(() => setPlanos([]));
  }, []);

  return (
    <div className="flex-1">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-5 py-6 md:px-8">
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-accent/15">
            <CalendarDays size={20} className="text-accent" strokeWidth={2.25} />
          </div>
          <span className="font-semibold tracking-tight">AgendaFlow Pro</span>
        </div>
        <div className="flex items-center gap-3">
          <Link href="/login" className="text-sm text-muted transition-colors hover:text-foreground">
            Entrar
          </Link>
          <Link
            href="/login?modo=cadastro"
            className="rounded-xl bg-accent px-4 py-2 text-sm font-medium text-accent-foreground transition-opacity hover:opacity-90"
          >
            Testar grátis
          </Link>
        </div>
      </header>

      <section className="relative overflow-hidden px-5 py-16 text-center md:py-24">
        <div
          className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[420px] opacity-25"
          style={{ background: "radial-gradient(circle, var(--accent), transparent 70%)" }}
        />
        <h1 className="mx-auto max-w-2xl text-3xl font-semibold tracking-tight md:text-5xl">
          A agenda completa pro seu salão crescer
        </h1>
        <p className="mx-auto mt-4 max-w-xl text-muted md:text-lg">
          Agenda, financeiro, comissões, estoque e mensagens automáticas — tudo num só lugar, pensado pra salões de qualquer tamanho.
        </p>
        <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Link
            href="/login?modo=cadastro"
            className="rounded-xl bg-accent px-6 py-3.5 font-medium text-accent-foreground transition-opacity hover:opacity-90"
          >
            Testar grátis
          </Link>
          <Link
            href="/login"
            className="rounded-xl border border-border-subtle px-6 py-3.5 font-medium transition-colors hover:bg-surface"
          >
            Já tenho conta
          </Link>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-5 py-12 md:px-8 md:py-20">
        <h2 className="text-center text-2xl font-semibold tracking-tight md:text-3xl">Tudo que o seu salão precisa</h2>
        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {FUNCIONALIDADES.map((f) => (
            <div key={f.titulo} className="card-elevated rounded-2xl bg-surface p-5">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent/15 text-accent">
                <f.icon size={20} />
              </div>
              <p className="mt-4 font-medium">{f.titulo}</p>
              <p className="mt-1.5 text-sm text-muted">{f.descricao}</p>
            </div>
          ))}
        </div>
      </section>

      {planos && planos.length > 0 && (
        <section className="mx-auto max-w-5xl px-5 py-12 md:px-8 md:py-20">
          <h2 className="text-center text-2xl font-semibold tracking-tight md:text-3xl">Planos e preços</h2>
          <p className="mx-auto mt-2 max-w-md text-center text-sm text-muted">
            Escolha o plano pelo tamanho da sua equipe. Sem contrato de fidelidade.
          </p>
          <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {planos.map((plano) => (
              <div key={plano.id} className="card-elevated flex flex-col rounded-2xl bg-surface p-6">
                <p className="font-medium">{plano.nome}</p>
                <p className="mt-1 text-xs text-muted">
                  {plano.faixa_max
                    ? `De ${plano.faixa_min} a ${plano.faixa_max} profissionais`
                    : `A partir de ${plano.faixa_min} profissionais`}
                </p>
                <p className="mt-5 text-3xl font-semibold tabular-nums">{formatarMoeda(plano.preco)}</p>
                <p className="text-xs text-muted">{plano.frequencia === "ANUAL" ? "por ano" : "por mês"}</p>
                <Link
                  href="/login?modo=cadastro"
                  className="mt-6 rounded-xl bg-accent px-4 py-3 text-center text-sm font-medium text-accent-foreground transition-opacity hover:opacity-90"
                >
                  Começar agora
                </Link>
              </div>
            ))}
          </div>
        </section>
      )}

      <section className="mx-auto max-w-2xl px-5 py-16 text-center md:py-24">
        <h2 className="text-2xl font-semibold tracking-tight md:text-3xl">Pronto pra organizar seu salão?</h2>
        <p className="mt-3 text-muted">Crie seu salão agora e comece a usar em minutos.</p>
        <Link
          href="/login?modo=cadastro"
          className="mt-6 inline-block rounded-xl bg-accent px-6 py-3.5 font-medium text-accent-foreground transition-opacity hover:opacity-90"
        >
          Testar grátis
        </Link>
      </section>

      <footer className="border-t border-border-subtle px-5 py-8 text-center text-xs text-muted">
        © {new Date().getFullYear()} AgendaFlow Pro
      </footer>
    </div>
  );
}
