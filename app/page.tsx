"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  BarChart3,
  BellRing,
  Boxes,
  CalendarDays,
  Calculator,
  Check,
  ChevronDown,
  HeartHandshake,
  Landmark,
  Mail,
  MessageCircle,
  MessageSquare,
  Package,
  Scissors,
  ShieldCheck,
  Target,
  TrendingUp,
  Users,
  Wallet,
} from "lucide-react";
import { listarPlanos } from "@/lib/repositories";
import { Plano } from "@/lib/types";
import { formatarMoeda } from "@/lib/datetime";
import InstalarNoIphone from "@/components/InstalarNoIphone";

const NUMERO_WHATSAPP = "5551981522887";
const EMAIL_CONTATO = "agendaflowpro@gmail.com";

const PILARES = [
  {
    icon: CalendarDays,
    titulo: "Agenda & atendimento",
    descricao:
      "Cada profissional com a própria grade, bloqueios de horário, comanda por atendimento e cobrança de sinal via Pix — direto pro Pix de cada um.",
  },
  {
    icon: Wallet,
    titulo: "Financeiro & comissões",
    descricao:
      "Fechamento de caixa, comissão por profissional e resumo semanal ou mensal, sempre separado por quem atendeu.",
  },
  {
    icon: BarChart3,
    titulo: "Gestão & relatórios",
    descricao:
      "Estoque, equipe com permissões próprias, e relatórios de faltas, histórico e ranking de clientes pra decidir com dado, não com achismo.",
  },
];

const FUNCIONALIDADES = [
  {
    icon: CalendarDays,
    titulo: "Agenda por profissional",
    descricao: "Grade própria pra cada um, visão do dia, e bloqueio de horário pra almoço, folga ou consulta.",
  },
  {
    icon: MessageSquare,
    titulo: "Mensagens automáticas",
    descricao: "Confirmação, remarcação, cancelamento e retorno pelo WhatsApp — cada profissional edita a própria mensagem.",
  },
  {
    icon: Wallet,
    titulo: "Financeiro completo",
    descricao: "Entradas, saídas e fechamento de caixa com visão separada por profissional.",
  },
  {
    icon: TrendingUp,
    titulo: "Comissões automáticas",
    descricao: "Percentual configurável por profissional, calculado sozinho a cada atendimento concluído.",
  },
  {
    icon: Target,
    titulo: "Meta de faturamento pessoal",
    descricao: "Cada profissional acompanha a própria meta e o próprio faturamento — sem ver o dos colegas.",
  },
  {
    icon: Calculator,
    titulo: "Calculadora de preço",
    descricao: "Descubra quanto cobrar por atendimento a partir do material gasto, do tempo e da margem que você quer.",
  },
  {
    icon: Landmark,
    titulo: "Sinal via Pix",
    descricao: "Cobre um sinal na confirmação do agendamento, direto no Pix do salão ou do profissional.",
  },
  {
    icon: Scissors,
    titulo: "Serviços & pacotes",
    descricao: "Cadastre serviços, monte pacotes de sessões e desconte automaticamente a cada atendimento.",
  },
  {
    icon: Boxes,
    titulo: "Controle de estoque",
    descricao: "Produtos, consumo por serviço e aviso quando o saldo chegar no mínimo.",
  },
  {
    icon: BellRing,
    titulo: "Retorno de clientes",
    descricao: "Saiba quem está devendo voltar e avise no WhatsApp com um toque.",
  },
  {
    icon: Users,
    titulo: "Equipe com permissões",
    descricao: "Convide profissionais e escolha o que cada um vê — agenda, financeiro, clientes.",
  },
  {
    icon: BarChart3,
    titulo: "Relatórios detalhados",
    descricao: "Faltas, histórico de atendimentos, ranking de clientes e receita por serviço, dia ou profissional.",
  },
];

const COMO_FUNCIONA = [
  { numero: "01", titulo: "Crie sua conta", descricao: "Cadastre seu salão em menos de 2 minutos, sem cartão de crédito." },
  { numero: "02", titulo: "Convide sua equipe", descricao: "Adicione cada profissional e escolha o que ele pode ver e editar." },
  { numero: "03", titulo: "Comece a atender", descricao: "Agenda, comanda, financeiro e mensagens automáticas já funcionando no mesmo dia." },
];

const INCLUSO_EM_TODOS = [
  "Agenda por profissional",
  "Financeiro e comissões",
  "Mensagens automáticas no WhatsApp",
  "Meta de faturamento pessoal",
  "Controle de estoque",
  "Relatórios completos",
];

const FAQS = [
  {
    pergunta: "Preciso ter CNPJ pra usar o AgendaFlow Pro?",
    resposta:
      "Não. Dá pra cadastrar seu negócio como autônomo, MEI, EI ou LTDA — você escolhe o que se encaixa na hora de configurar o salão.",
  },
  {
    pergunta: "Os meus profissionais têm acesso ao sistema?",
    resposta:
      "Sim. Você convida cada profissional e escolhe o que ele pode ver — agenda, financeiro, clientes — e cada um tem a própria meta de faturamento e as próprias mensagens automáticas, sem ver os dados dos colegas.",
  },
  {
    pergunta: "Funciona no iPhone?",
    resposta:
      "Sim, direto pelo navegador. Não temos aplicativo na App Store, mas dá pra adicionar o AgendaFlow à tela de início do iPhone pelo Safari e usar como se fosse um app.",
  },
  {
    pergunta: "Posso trocar de plano depois?",
    resposta: "Sim, o plano é definido pelo tamanho da sua equipe e pode ser ajustado quando ela crescer.",
  },
  {
    pergunta: "Quem marca os horários dos clientes?",
    resposta:
      "Você e sua equipe, direto pelo app — o AgendaFlow não tem agendamento aberto pro cliente marcar sozinho, então nenhum horário entra na sua agenda sem você saber.",
  },
];

function inicioDoNome(nome: string): string {
  return nome.replace(/^(Até|De|A partir de)\s*/i, "").trim();
}

export default function PaginaInicial() {
  const [planos, setPlanos] = useState<Plano[] | null>(null);
  const [frequencia, setFrequencia] = useState<"MENSAL" | "ANUAL">("MENSAL");
  const [faqAberta, setFaqAberta] = useState<number | null>(0);

  useEffect(() => {
    listarPlanos()
      .then((lista) => setPlanos(lista.sort((a, b) => a.faixa_min - b.faixa_min)))
      .catch(() => setPlanos([]));
  }, []);

  const planosFiltrados = useMemo(() => {
    if (!planos) return [];
    return planos.filter((p) => p.frequencia === frequencia);
  }, [planos, frequencia]);

  const economiaAnual = useMemo(() => {
    if (!planos) return null;
    const mensal = planos.find((p) => p.frequencia === "MENSAL");
    const anual = planos.find(
      (p) => p.frequencia === "ANUAL" && p.faixa_min === mensal?.faixa_min && p.faixa_max === mensal?.faixa_max
    );
    if (!mensal || !anual) return null;
    const percentual = Math.round((1 - anual.preco / 12 / mensal.preco) * 100);
    return percentual > 0 ? percentual : null;
  }, [planos]);

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
          Agenda por profissional, financeiro, comissões, estoque e mensagens automáticas — tudo num só lugar, feito pra salões e barbearias de qualquer tamanho.
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
        <InstalarNoIphone />
      </section>

      <section className="mx-auto max-w-6xl px-5 py-12 md:px-8 md:py-16">
        <h2 className="text-center text-2xl font-semibold tracking-tight md:text-3xl">Um sistema, três frentes</h2>
        <div className="mt-10 grid gap-4 md:grid-cols-3">
          {PILARES.map((p) => (
            <div key={p.titulo} className="card-elevated rounded-2xl bg-surface p-6">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-accent/15 text-accent">
                <p.icon size={22} />
              </div>
              <p className="mt-4 text-lg font-medium">{p.titulo}</p>
              <p className="mt-2 text-sm text-muted">{p.descricao}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-4xl px-5 py-12 md:px-8 md:py-16">
        <h2 className="text-center text-2xl font-semibold tracking-tight md:text-3xl">Como funciona</h2>
        <div className="mt-10 grid gap-6 md:grid-cols-3">
          {COMO_FUNCIONA.map((passo) => (
            <div key={passo.numero} className="text-center md:text-left">
              <span className="text-3xl font-semibold text-accent/40">{passo.numero}</span>
              <p className="mt-2 font-medium">{passo.titulo}</p>
              <p className="mt-1.5 text-sm text-muted">{passo.descricao}</p>
            </div>
          ))}
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

      <section className="mx-auto max-w-3xl px-5 py-12 text-center md:px-8 md:py-16">
        <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-accent/15 text-accent mx-auto">
          <ShieldCheck size={22} />
        </div>
        <h2 className="mt-4 text-2xl font-semibold tracking-tight md:text-3xl">Só sua equipe marca os horários</h2>
        <p className="mx-auto mt-3 max-w-lg text-muted">
          Diferente de outros sistemas, o AgendaFlow não tem página aberta pro cliente agendar sozinho. Toda marcação passa por você ou pela sua equipe — sem horário surpresa entrando na agenda.
        </p>
      </section>

      {planos && planosFiltrados.length > 0 && (
        <section className="mx-auto max-w-5xl px-5 py-12 md:px-8 md:py-20">
          <h2 className="text-center text-2xl font-semibold tracking-tight md:text-3xl">Planos e preços</h2>
          <p className="mx-auto mt-2 max-w-md text-center text-sm text-muted">
            Escolha o plano pelo tamanho da sua equipe. Sem contrato de fidelidade.
          </p>

          <div className="mx-auto mt-6 flex max-w-md flex-wrap justify-center gap-x-4 gap-y-1.5 text-xs text-muted">
            {INCLUSO_EM_TODOS.map((item) => (
              <span key={item} className="flex items-center gap-1">
                <Check size={12} className="text-accent" /> {item}
              </span>
            ))}
          </div>

          <div className="mx-auto mt-6 flex w-fit items-center gap-1 rounded-xl bg-surface p-1">
            <button
              onClick={() => setFrequencia("MENSAL")}
              className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
                frequencia === "MENSAL" ? "bg-accent text-accent-foreground" : "text-muted hover:text-foreground"
              }`}
            >
              Mensal
            </button>
            <button
              onClick={() => setFrequencia("ANUAL")}
              className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
                frequencia === "ANUAL" ? "bg-accent text-accent-foreground" : "text-muted hover:text-foreground"
              }`}
            >
              Anual{economiaAnual ? ` (economize ${economiaAnual}%)` : ""}
            </button>
          </div>

          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {planosFiltrados.map((plano) => (
              <div key={plano.id} className="card-elevated flex flex-col rounded-2xl bg-surface p-6">
                <p className="font-medium">{inicioDoNome(plano.nome)}</p>
                <p className="mt-1 text-xs text-muted">
                  {plano.faixa_max
                    ? `De ${plano.faixa_min} a ${plano.faixa_max} profissionais`
                    : `A partir de ${plano.faixa_min} profissionais`}
                </p>
                <p className="mt-5 text-3xl font-semibold tabular-nums">{formatarMoeda(plano.preco)}</p>
                <p className="text-xs text-muted">{frequencia === "ANUAL" ? "por ano" : "por mês"}</p>
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

      <section className="mx-auto max-w-2xl px-5 py-12 md:px-8 md:py-16">
        <h2 className="text-center text-2xl font-semibold tracking-tight md:text-3xl">Perguntas frequentes</h2>
        <div className="mt-8 flex flex-col gap-2">
          {FAQS.map((faq, i) => (
            <div key={faq.pergunta} className="card-elevated rounded-xl bg-surface">
              <button
                onClick={() => setFaqAberta(faqAberta === i ? null : i)}
                className="flex w-full items-center justify-between gap-3 p-4 text-left"
              >
                <span className="font-medium">{faq.pergunta}</span>
                <ChevronDown
                  size={18}
                  className={`shrink-0 text-muted transition-transform ${faqAberta === i ? "rotate-180" : ""}`}
                />
              </button>
              {faqAberta === i && <p className="px-4 pb-4 text-sm text-muted">{faq.resposta}</p>}
            </div>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-2xl px-5 py-12 text-center md:px-8 md:py-16">
        <h2 className="text-2xl font-semibold tracking-tight md:text-3xl">Ficou com alguma dúvida?</h2>
        <p className="mt-3 text-muted">Fala com a gente pelo canal que for mais fácil pra você.</p>
        <div className="mt-6 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <a
            href={`https://wa.me/${NUMERO_WHATSAPP}?text=${encodeURIComponent("Olá! Tenho uma dúvida sobre o AgendaFlow Pro.")}`}
            target="_blank"
            rel="noreferrer"
            className="flex items-center justify-center gap-2 rounded-xl bg-accent px-5 py-3 text-sm font-medium text-accent-foreground transition-opacity hover:opacity-90"
          >
            <MessageCircle size={16} /> Falar no WhatsApp
          </a>
          <a
            href={`mailto:${EMAIL_CONTATO}`}
            className="flex items-center justify-center gap-2 rounded-xl border border-border-subtle px-5 py-3 text-sm font-medium transition-colors hover:bg-surface"
          >
            <Mail size={16} /> Enviar e-mail
          </a>
        </div>
      </section>

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
        <p>© {new Date().getFullYear()} AgendaFlow Pro</p>
        <a href={`mailto:${EMAIL_CONTATO}`} className="mt-1 inline-block transition-colors hover:text-foreground">
          {EMAIL_CONTATO}
        </a>
      </footer>
    </div>
  );
}
