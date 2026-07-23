"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { CalendarDays, Percent, Trash2, Wallet } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import {
  buscarPermissoesDe,
  definirAtendeClientes,
  definirComissaoPercentual,
  definirConcessaoVisualizacao,
  definirPapelId,
  definirPermissaoVisualizacao,
  listarEquipe,
  listarPapeisAtribuiveis,
  listarPermissoesVisualizacaoDe,
  removerDaEquipe,
  salvarEscopoVisualizacao,
  salvarPermissoesUsuario,
} from "@/lib/repositories";
import Avatar from "@/components/Avatar";
import AcessoRestrito from "@/components/AcessoRestrito";
import { Papel, PermissaoVisualizacao, Perfil } from "@/lib/types";

type ModoAgenda = "PROPRIA" | "SELECIONADOS" | "EQUIPE";
type ModoFinanceiro = "PROPRIO" | "SELECIONADOS" | "EQUIPE";

export default function GerenciarPermissoesPage() {
  const { perfil } = useAuth();
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const pessoaId = params.id;

  const [pessoa, setPessoa] = useState<Perfil | null>(null);
  const [outrasPessoas, setOutrasPessoas] = useState<Perfil[]>([]);
  const [papeis, setPapeis] = useState<Papel[]>([]);
  const [carregando, setCarregando] = useState(true);

  const [agendaModo, setAgendaModo] = useState<ModoAgenda>("PROPRIA");
  const [agendaVeDono, setAgendaVeDono] = useState(false);
  const [financeiroModo, setFinanceiroModo] = useState<ModoFinanceiro>("PROPRIO");
  const [financeiroVeDono, setFinanceiroVeDono] = useState(false);
  const [permissoesIndividuais, setPermissoesIndividuais] = useState<PermissaoVisualizacao[]>([]);
  const [atendeClientes, setAtendeClientes] = useState(false);
  const [comissao, setComissao] = useState("");

  const [mostrarExclusao, setMostrarExclusao] = useState(false);

  useEffect(() => {
    if (!perfil) return;
    carregar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [perfil?.id, pessoaId]);

  async function carregar() {
    if (!perfil) return;
    setCarregando(true);
    try {
      const [equipe, permissoes, individuais, papeisAtribuiveis] = await Promise.all([
        listarEquipe(perfil.salao_id),
        buscarPermissoesDe(pessoaId),
        listarPermissoesVisualizacaoDe(pessoaId),
        listarPapeisAtribuiveis().catch(() => []),
      ]);
      const p = equipe.find((e) => e.id === pessoaId) ?? null;
      setPessoa(p);
      setPapeis(papeisAtribuiveis);
      setOutrasPessoas(equipe.filter((e) => e.id !== pessoaId));
      setAtendeClientes(p?.atende_clientes ?? false);
      setComissao(String(p?.comissao_percentual ?? 50));

      setAgendaModo((permissoes?.agenda_modo as ModoAgenda) ?? "PROPRIA");
      setAgendaVeDono(permissoes?.agenda_ve_dono ?? false);
      setFinanceiroModo((permissoes?.financeiro_modo as ModoFinanceiro) ?? "PROPRIO");
      setFinanceiroVeDono(permissoes?.financeiro_ve_dono ?? false);
      setPermissoesIndividuais(individuais);
    } finally {
      setCarregando(false);
    }
  }

  async function salvarModo(novaAgendaModo: ModoAgenda, novoFinanceiroModo: ModoFinanceiro, novoAgendaVeDono: boolean, novoFinanceiroVeDono: boolean) {
    if (!perfil) return;
    await salvarPermissoesUsuario({
      salao_id: perfil.salao_id,
      usuario_id: pessoaId,
      agenda_modo: novaAgendaModo,
      agenda_cria: true,
      agenda_edita: true,
      agenda_cancela: true,
      agenda_ve_dono: novoAgendaVeDono,
      financeiro_modo: novoFinanceiroModo,
      financeiro_ve_dono: novoFinanceiroVeDono,
    });
    try {
      await Promise.all([
        salvarEscopoVisualizacao(perfil.salao_id, pessoaId, "AGENDA", novaAgendaModo, novoAgendaVeDono),
        salvarEscopoVisualizacao(
          perfil.salao_id,
          pessoaId,
          "FINANCEIRO",
          novoFinanceiroModo === "PROPRIO" ? "PROPRIA" : novoFinanceiroModo,
          novoFinanceiroVeDono
        ),
      ]);
    } catch {
      // tabela nova é best-effort — a antiga (fonte de verdade das telas ainda não migradas) já foi salva
    }
  }

  async function handleEscolherPapel(papel: Papel) {
    const papelLegado = papel.nome === "Profissional" ? "PROFISSIONAL" : "ADMIN";
    await definirPapelId(pessoaId, papel.id, papelLegado);
    setPessoa((atual) => (atual ? { ...atual, papel_id: papel.id, papel: papelLegado } : atual));
  }

  function temPermissao(alvoId: string, campo: "ve_agenda" | "ve_financeiro"): boolean {
    return permissoesIndividuais.find((p) => p.alvo_id === alvoId)?.[campo] ?? false;
  }

  async function alternarIndividual(alvoId: string, campo: "ve_agenda" | "ve_financeiro", valor: boolean) {
    if (!perfil) return;
    const atual = permissoesIndividuais.find((p) => p.alvo_id === alvoId);
    const veAgenda = campo === "ve_agenda" ? valor : atual?.ve_agenda ?? false;
    const veFinanceiro = campo === "ve_financeiro" ? valor : atual?.ve_financeiro ?? false;

    await definirPermissaoVisualizacao(perfil.salao_id, pessoaId, alvoId, veAgenda, veFinanceiro);
    try {
      await definirConcessaoVisualizacao(
        perfil.salao_id,
        pessoaId,
        alvoId,
        campo === "ve_agenda" ? "AGENDA" : "FINANCEIRO",
        valor
      );
    } catch {
      // best-effort, ver comentário em salvarModo
    }

    setPermissoesIndividuais((lista) => {
      const semEsse = lista.filter((p) => p.alvo_id !== alvoId);
      if (!veAgenda && !veFinanceiro) return semEsse;
      return [
        ...semEsse,
        { salao_id: perfil.salao_id, visualizador_id: pessoaId, alvo_id: alvoId, ve_agenda: veAgenda, ve_financeiro: veFinanceiro },
      ];
    });
  }

  async function handleSalvarComissao() {
    const valor = parseFloat(comissao);
    if (isNaN(valor)) return;
    await definirComissaoPercentual(pessoaId, valor);
  }

  async function handleAlternarAtendeClientes(valor: boolean) {
    setAtendeClientes(valor);
    await definirAtendeClientes(pessoaId, valor);
  }

  async function handleRemover() {
    await removerDaEquipe(pessoaId);
    router.push("/equipe");
  }

  if (perfil && perfil.papel !== "DONO") return <AcessoRestrito />;

  if (carregando) {
    return (
      <div className="mx-auto max-w-2xl p-5 md:p-8">
        <div className="h-40 animate-pulse rounded-2xl bg-surface" />
      </div>
    );
  }

  if (!pessoa) {
    return (
      <div className="mx-auto max-w-2xl p-5 md:p-8">
        <p className="text-muted">Pessoa não encontrada.</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl p-5 pb-16 md:p-8">
      <div className="mb-6 flex items-center gap-3">
        <Avatar nome={pessoa.nome} fotoUrl={pessoa.foto_url} className="h-12 w-12 text-sm" />
        <div className="min-w-0 flex-1">
          <p className="text-xl font-semibold">{pessoa.nome}</p>
          <p className="text-sm text-muted">{pessoa.papel}</p>
        </div>
        <button
          onClick={() => setMostrarExclusao(true)}
          className="rounded-lg p-2 text-muted transition-colors hover:bg-danger/10 hover:text-danger"
        >
          <Trash2 size={18} />
        </button>
      </div>

      <div className="flex flex-col gap-4">
        {/* Papel */}
        {papeis.length > 0 && (
          <div className="card-elevated rounded-2xl bg-surface p-4">
            <p className="mb-3 font-medium">Papel</p>
            <div className="flex flex-col gap-1.5">
              {papeis.map((p) => (
                <label key={p.id} className="flex items-center gap-2.5 text-sm">
                  <input
                    type="radio"
                    checked={pessoa.papel_id === p.id}
                    onChange={() => handleEscolherPapel(p)}
                    className="h-4 w-4 accent-accent"
                  />
                  {p.nome}
                </label>
              ))}
            </div>
          </div>
        )}

        {/* Agenda */}
        <div className="card-elevated rounded-2xl bg-surface p-4">
          <div className="mb-3 flex items-center gap-2">
            <CalendarDays size={16} className="text-accent" />
            <p className="font-medium">Agenda</p>
          </div>
          <ModoRadio
            valor={agendaModo}
            opcoes={[
              { valor: "PROPRIA", label: "Apenas própria" },
              { valor: "SELECIONADOS", label: "Profissionais selecionados" },
              { valor: "EQUIPE", label: "Equipe inteira" },
            ]}
            onMudar={(v) => {
              setAgendaModo(v as ModoAgenda);
              salvarModo(v as ModoAgenda, financeiroModo, agendaVeDono, financeiroVeDono);
            }}
          />
          {agendaModo === "SELECIONADOS" && (
            <div className="mt-3 flex flex-col gap-1.5 border-t border-border-subtle pt-3">
              {outrasPessoas.map((p) => (
                <label key={p.id} className="flex items-center gap-2.5 text-sm">
                  <input
                    type="checkbox"
                    checked={temPermissao(p.id, "ve_agenda")}
                    onChange={(e) => alternarIndividual(p.id, "ve_agenda", e.target.checked)}
                    className="h-4 w-4 accent-accent"
                  />
                  {p.nome}
                </label>
              ))}
            </div>
          )}
          <label className="mt-3 flex items-center justify-between border-t border-border-subtle pt-3 text-sm">
            Incluir agenda do Dono
            <Toggle
              valor={agendaVeDono}
              onMudar={(v) => {
                setAgendaVeDono(v);
                salvarModo(agendaModo, financeiroModo, v, financeiroVeDono);
              }}
            />
          </label>
        </div>

        {/* Financeiro */}
        <div className="card-elevated rounded-2xl bg-surface p-4">
          <div className="mb-3 flex items-center gap-2">
            <Wallet size={16} className="text-accent" />
            <p className="font-medium">Financeiro</p>
          </div>
          <ModoRadio
            valor={financeiroModo}
            opcoes={[
              { valor: "PROPRIO", label: "Apenas próprio" },
              { valor: "SELECIONADOS", label: "Profissionais selecionados" },
              { valor: "EQUIPE", label: "Equipe inteira" },
            ]}
            onMudar={(v) => {
              setFinanceiroModo(v as ModoFinanceiro);
              salvarModo(agendaModo, v as ModoFinanceiro, agendaVeDono, financeiroVeDono);
            }}
          />
          {financeiroModo === "SELECIONADOS" && (
            <div className="mt-3 flex flex-col gap-1.5 border-t border-border-subtle pt-3">
              {outrasPessoas.map((p) => (
                <label key={p.id} className="flex items-center gap-2.5 text-sm">
                  <input
                    type="checkbox"
                    checked={temPermissao(p.id, "ve_financeiro")}
                    onChange={(e) => alternarIndividual(p.id, "ve_financeiro", e.target.checked)}
                    className="h-4 w-4 accent-accent"
                  />
                  {p.nome}
                </label>
              ))}
            </div>
          )}
          <label className="mt-3 flex items-center justify-between border-t border-border-subtle pt-3 text-sm">
            Incluir financeiro do Dono
            <Toggle
              valor={financeiroVeDono}
              onMudar={(v) => {
                setFinanceiroVeDono(v);
                salvarModo(agendaModo, financeiroModo, agendaVeDono, v);
              }}
            />
          </label>
        </div>

        {/* Atende clientes */}
        <div className="card-elevated flex items-center justify-between gap-4 rounded-2xl bg-surface p-4">
          <div>
            <p className="text-sm font-medium">Atende clientes</p>
            <p className="mt-0.5 text-xs text-muted">Aparece na Agenda e conta no limite do plano.</p>
          </div>
          <Toggle valor={atendeClientes} onMudar={handleAlternarAtendeClientes} />
        </div>

        {/* Comissão */}
        <div className="card-elevated rounded-2xl bg-surface p-4">
          <div className="mb-2 flex items-center gap-2">
            <Percent size={16} className="text-accent" />
            <p className="font-medium">Comissão</p>
          </div>
          <div className="flex items-center gap-2">
            <input
              value={comissao}
              onChange={(e) => setComissao(e.target.value.replace(/[^0-9.]/g, ""))}
              className="w-24 rounded-lg border border-border-subtle bg-background px-3 py-2 text-sm outline-none focus:border-accent"
            />
            <span className="text-sm text-muted">%</span>
            <button
              onClick={handleSalvarComissao}
              className="ml-auto rounded-lg bg-accent px-3 py-2 text-sm font-medium text-accent-foreground transition-opacity hover:opacity-90"
            >
              Salvar
            </button>
          </div>
        </div>
      </div>

      {mostrarExclusao && (
        <div className="fixed inset-0 z-30 flex items-center justify-center bg-black/60 p-5 backdrop-blur-sm">
          <div className="card-elevated w-full max-w-sm rounded-2xl bg-surface p-5">
            <p className="mb-2 font-medium">Remover {pessoa.nome}?</p>
            <p className="mb-4 text-sm text-muted">Essa pessoa perde o acesso ao salão imediatamente. Não pode ser desfeito.</p>
            <div className="flex justify-end gap-2">
              <button onClick={() => setMostrarExclusao(false)} className="rounded-lg px-4 py-2 text-sm text-muted transition-colors hover:bg-surface-alt">
                Cancelar
              </button>
              <button onClick={handleRemover} className="rounded-lg bg-danger px-4 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90">
                Remover
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function ModoRadio({
  valor,
  opcoes,
  onMudar,
}: {
  valor: string;
  opcoes: { valor: string; label: string }[];
  onMudar: (v: string) => void;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      {opcoes.map((o) => (
        <label key={o.valor} className="flex items-center gap-2.5 text-sm">
          <input
            type="radio"
            checked={valor === o.valor}
            onChange={() => onMudar(o.valor)}
            className="h-4 w-4 accent-accent"
          />
          {o.label}
        </label>
      ))}
    </div>
  );
}

function Toggle({ valor, onMudar }: { valor: boolean; onMudar: (v: boolean) => void }) {
  return (
    <button
      onClick={() => onMudar(!valor)}
      className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${valor ? "bg-accent" : "bg-surface-alt"}`}
    >
      <span
        className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition-transform ${valor ? "translate-x-5" : "translate-x-0.5"}`}
      />
    </button>
  );
}
