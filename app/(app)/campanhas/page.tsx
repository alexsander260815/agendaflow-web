"use client";

import { useEffect, useMemo, useState } from "react";
import { Cake, MessageCircle, UserX } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { buscarMeuSalao, listarAgendamentos, listarClientes } from "@/lib/repositories";
import { abrirWhatsApp } from "@/lib/whatsapp";
import { Agendamento, Cliente, Salao } from "@/lib/types";

const MENSAGEM_ANIVERSARIO_PADRAO =
  "Feliz aniversário, {nome}! 🎉 A equipe do {salao} deseja um dia incrível! Que tal comemorar agendando aquele cuidado que você merece?";
const MENSAGEM_REATIVACAO_PADRAO =
  "Oi {nome}! Sentimos sua falta por aqui 💜 Já faz um tempo desde sua última visita no {salao}. Bora marcar um horário?";

const DIAS_INATIVIDADE_PADRAO = 60;

interface Aniversariante {
  cliente: Cliente;
  dia: number;
}

interface ClienteInativo {
  cliente: Cliente;
  diasSemVisitar: number;
}

export default function CampanhasPage() {
  const { perfil } = useAuth();
  const [aba, setAba] = useState<"aniversariantes" | "inativos">("aniversariantes");
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [agendamentos, setAgendamentos] = useState<Agendamento[]>([]);
  const [salao, setSalao] = useState<Salao | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [mensagemAniversario, setMensagemAniversario] = useState(MENSAGEM_ANIVERSARIO_PADRAO);
  const [mensagemReativacao, setMensagemReativacao] = useState(MENSAGEM_REATIVACAO_PADRAO);
  const [diasInatividade, setDiasInatividade] = useState(String(DIAS_INATIVIDADE_PADRAO));

  useEffect(() => {
    if (!perfil) return;
    setCarregando(true);
    Promise.all([listarClientes(perfil.salao_id), listarAgendamentos(perfil.salao_id), buscarMeuSalao(perfil.salao_id)])
      .then(([c, a, s]) => {
        setClientes(c);
        setAgendamentos(a);
        setSalao(s);
      })
      .finally(() => setCarregando(false));
  }, [perfil?.id]);

  const aniversariantes = useMemo<Aniversariante[]>(() => {
    const mesAtual = new Date().getMonth() + 1;
    return clientes
      .filter((c) => c.aniversario)
      .map((c) => {
        const [, mes, dia] = c.aniversario!.split("-").map(Number);
        return { cliente: c, mes, dia };
      })
      .filter((c) => c.mes === mesAtual)
      .sort((a, b) => a.dia - b.dia)
      .map(({ cliente, dia }) => ({ cliente, dia }));
  }, [clientes]);

  const inativos = useMemo<ClienteInativo[]>(() => {
    const limite = Math.max(1, parseInt(diasInatividade, 10) || DIAS_INATIVIDADE_PADRAO);
    const agora = Date.now();
    const ultimaVisitaPorCliente = new Map<string, number>();
    agendamentos
      .filter((a) => a.status === "CONCLUIDO")
      .forEach((a) => {
        const millis = new Date(a.data_hora).getTime();
        const atual = ultimaVisitaPorCliente.get(a.cliente_id);
        if (!atual || millis > atual) ultimaVisitaPorCliente.set(a.cliente_id, millis);
      });

    return Array.from(ultimaVisitaPorCliente.entries())
      .map(([clienteId, ultimaVisitaMillis]) => {
        const cliente = clientes.find((c) => c.id === clienteId);
        if (!cliente) return null;
        const diasSemVisitar = Math.floor((agora - ultimaVisitaMillis) / (24 * 60 * 60 * 1000));
        return { cliente, diasSemVisitar };
      })
      .filter((item): item is ClienteInativo => item !== null && item.diasSemVisitar >= limite)
      .sort((a, b) => b.diasSemVisitar - a.diasSemVisitar);
  }, [agendamentos, clientes, diasInatividade]);

  function handleEnviar(cliente: Cliente, template: string) {
    const nomeSalao = salao?.nome || "AgendaFlow";
    const mensagem = template.replaceAll("{nome}", cliente.nome.split(" ")[0]).replaceAll("{salao}", nomeSalao);
    abrirWhatsApp(cliente.telefone, mensagem);
  }

  return (
    <div className="mx-auto max-w-2xl p-5 pb-16 md:p-8">
      <h1 className="mb-1 text-2xl font-semibold tracking-tight">Campanhas</h1>
      <p className="mb-5 text-sm text-muted">
        Mensagens em massa pra aniversariantes do mês e clientes que sumiram — cada envio abre o WhatsApp já com o
        texto pronto.
      </p>

      <div className="mb-5 flex gap-1 rounded-xl bg-surface p-1">
        {(["aniversariantes", "inativos"] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setAba(tab)}
            className={`flex-1 rounded-lg py-2 text-sm font-medium transition-colors ${
              aba === tab ? "bg-accent text-accent-foreground" : "text-muted"
            }`}
          >
            {tab === "aniversariantes" ? "Aniversariantes" : "Clientes inativos"}
          </button>
        ))}
      </div>

      {carregando ? (
        <div className="flex flex-col gap-2">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-20 animate-pulse rounded-xl bg-surface" />
          ))}
        </div>
      ) : aba === "aniversariantes" ? (
        <>
          <div className="card-elevated mb-4 rounded-2xl bg-surface p-4">
            <label className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-muted">
              Mensagem (use {"{nome}"} e {"{salao}"})
            </label>
            <textarea
              value={mensagemAniversario}
              onChange={(e) => setMensagemAniversario(e.target.value)}
              rows={3}
              className="w-full resize-none rounded-xl border border-border-subtle bg-background px-3.5 py-3 text-sm outline-none focus:border-accent"
            />
          </div>

          {aniversariantes.length === 0 ? (
            <div className="card-elevated flex flex-col items-center gap-2 rounded-2xl bg-surface p-10 text-center">
              <Cake size={28} className="text-muted" />
              <p className="text-sm text-muted">Nenhum aniversariante cadastrado esse mês.</p>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {aniversariantes.map(({ cliente, dia }) => (
                <div key={cliente.id} className="card-elevated flex items-center justify-between gap-3 rounded-xl bg-surface p-3.5">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-accent/12 text-accent">
                      <Cake size={16} />
                    </div>
                    <div>
                      <p className="font-medium">{cliente.nome}</p>
                      <p className="text-xs text-muted">Dia {dia}</p>
                    </div>
                  </div>
                  <button
                    onClick={() => handleEnviar(cliente, mensagemAniversario)}
                    className="flex items-center gap-1.5 rounded-lg bg-accent px-3 py-2 text-xs font-medium text-accent-foreground transition-opacity hover:opacity-90"
                  >
                    <MessageCircle size={13} /> Enviar
                  </button>
                </div>
              ))}
            </div>
          )}
        </>
      ) : (
        <>
          <div className="card-elevated mb-4 flex flex-col gap-3 rounded-2xl bg-surface p-4">
            <div>
              <label className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-muted">
                Mensagem (use {"{nome}"} e {"{salao}"})
              </label>
              <textarea
                value={mensagemReativacao}
                onChange={(e) => setMensagemReativacao(e.target.value)}
                rows={3}
                className="w-full resize-none rounded-xl border border-border-subtle bg-background px-3.5 py-3 text-sm outline-none focus:border-accent"
              />
            </div>
            <div className="flex items-center gap-2">
              <label className="text-xs text-muted">Sem visitar há mais de</label>
              <input
                type="number"
                min={1}
                value={diasInatividade}
                onChange={(e) => setDiasInatividade(e.target.value.replace(/\D/g, ""))}
                className="w-20 rounded-lg border border-border-subtle bg-background px-3 py-1.5 text-sm outline-none focus:border-accent"
              />
              <span className="text-xs text-muted">dias</span>
            </div>
          </div>

          {inativos.length === 0 ? (
            <div className="card-elevated flex flex-col items-center gap-2 rounded-2xl bg-surface p-10 text-center">
              <UserX size={28} className="text-muted" />
              <p className="text-sm text-muted">Nenhum cliente inativo por esse critério.</p>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {inativos.map(({ cliente, diasSemVisitar }) => (
                <div key={cliente.id} className="card-elevated flex items-center justify-between gap-3 rounded-xl bg-surface p-3.5">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-warning/12 text-warning">
                      <UserX size={16} />
                    </div>
                    <div>
                      <p className="font-medium">{cliente.nome}</p>
                      <p className="text-xs text-muted">Há {diasSemVisitar} dias sem visitar</p>
                    </div>
                  </div>
                  <button
                    onClick={() => handleEnviar(cliente, mensagemReativacao)}
                    className="flex items-center gap-1.5 rounded-lg bg-accent px-3 py-2 text-xs font-medium text-accent-foreground transition-opacity hover:opacity-90"
                  >
                    <MessageCircle size={13} /> Enviar
                  </button>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
