"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  Cake,
  ClipboardList,
  Download,
  FileSignature,
  History,
  Package,
  Phone,
  Plus,
  Trash2,
  User,
  X,
} from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { exportarCsvSecoes } from "@/lib/exportar";
import {
  atualizarCliente,
  buscarCliente,
  deletarCliente,
  salvarCliente,
} from "@/lib/repositories/clienteRepository";
import {
  comprarPacote,
  deletarClientePacote,
  listarClientePacotesPorCliente,
} from "@/lib/repositories/clientePacoteRepository";
import { salvarReceitaAvulsa } from "@/lib/repositories/receitaAvulsaRepository";
import { listarPacotes } from "@/lib/repositories/pacoteRepository";
import { listarAgendamentos } from "@/lib/repositories/agendamentoRepository";
import { listarAgendamentoServicos } from "@/lib/repositories/agendamentoServicoRepository";
import { listarEquipe } from "@/lib/repositories/perfilRepository";
import { registrarAuditoria } from "@/lib/auditoria";
import { Cliente, ClientePacote, Pacote } from "@/lib/types";
import { converterIsoParaMillis, formatarDataHora, formatarMoeda, formatarStatus } from "@/lib/datetime";

interface AtendimentoHistorico {
  dataHoraMillis: number;
  nomeProfissional: string;
  nomesServicos: string;
  valorTotal: number;
  status: string;
}

const inputClass =
  "flex items-center gap-2.5 rounded-xl border border-border-subtle bg-surface px-4 py-3 transition-colors focus-within:border-accent";

export default function ClienteFormPage() {
  const { perfil } = useAuth();
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const editando = params.id !== "novo";
  const clienteId = editando ? params.id : null;

  const [nome, setNome] = useState("");
  const [telefone, setTelefone] = useState("");
  const [observacoes, setObservacoes] = useState("");
  const [aniversario, setAniversario] = useState("");
  const [pacotesDoCliente, setPacotesDoCliente] = useState<ClientePacote[]>([]);
  const [pacotesDisponiveis, setPacotesDisponiveis] = useState<Pacote[]>([]);
  const [mostrarSeletorPacote, setMostrarSeletorPacote] = useState(false);
  const [historico, setHistorico] = useState<AtendimentoHistorico[]>([]);
  const [carregandoHistorico, setCarregandoHistorico] = useState(false);
  const [mostrarConfirmacaoExclusao, setMostrarConfirmacaoExclusao] = useState(false);
  const [pacoteParaExcluir, setPacoteParaExcluir] = useState<ClientePacote | null>(null);

  useEffect(() => {
    if (!perfil) return;
    if (editando && clienteId) {
      buscarCliente(clienteId).then((c) => {
        if (c) {
          setNome(c.nome);
          setTelefone(c.telefone);
          setObservacoes(c.observacoes);
          setAniversario(c.aniversario ?? "");
        }
      });
      listarClientePacotesPorCliente(clienteId).then(setPacotesDoCliente);
      carregarHistorico(clienteId);
    }
    listarPacotes(perfil.salao_id).then(setPacotesDisponiveis);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [perfil?.id, clienteId]);

  async function carregarHistorico(idCliente: string) {
    if (!perfil) return;
    setCarregandoHistorico(true);
    try {
      const [agendamentos, itens, equipe] = await Promise.all([
        listarAgendamentos(perfil.salao_id),
        listarAgendamentoServicos(perfil.salao_id),
        listarEquipe(perfil.salao_id),
      ]);
      const equipeMap = new Map(equipe.map((p) => [p.id, p.nome]));
      const itensPorAgendamento = new Map<string, typeof itens>();
      itens.forEach((i) => {
        const lista = itensPorAgendamento.get(i.agendamento_id) ?? [];
        lista.push(i);
        itensPorAgendamento.set(i.agendamento_id, lista);
      });

      const doCliente = agendamentos
        .filter((a) => a.cliente_id === idCliente)
        .map((a) => {
          const itensDoAg = itensPorAgendamento.get(a.id) ?? [];
          return {
            dataHoraMillis: converterIsoParaMillis(a.data_hora),
            nomeProfissional: a.profissional_id ? equipeMap.get(a.profissional_id) ?? "Não atribuído" : "Não atribuído",
            nomesServicos: itensDoAg.length ? itensDoAg.map((i) => i.nome_servico).join(", ") : "Sem serviços",
            valorTotal: itensDoAg.reduce((soma, i) => soma + i.preco, 0),
            status: a.status,
          };
        })
        .sort((a, b) => b.dataHoraMillis - a.dataHoraMillis);

      setHistorico(doCliente);
    } catch (e) {
      console.error(e);
      setHistorico([]);
    } finally {
      setCarregandoHistorico(false);
    }
  }

  async function handleSalvar() {
    if (!perfil) return;
    const dados: Cliente = {
      id: clienteId ?? crypto.randomUUID(),
      salao_id: perfil.salao_id,
      nome,
      telefone,
      observacoes,
      aniversario: aniversario || null,
    };
    if (editando && clienteId) {
      await atualizarCliente(clienteId, dados);
    } else {
      await salvarCliente(dados);
    }
    router.push("/clientes");
  }

  async function handleExcluir() {
    if (!clienteId) return;
    await deletarCliente(clienteId);
    if (perfil) {
      registrarAuditoria(perfil.salao_id, perfil.id, "excluir_cliente", "cliente", clienteId, {
        nome,
        telefone,
      });
    }
    router.push("/clientes");
  }

  async function handleComprarPacote(pacote: Pacote) {
    if (!perfil || !clienteId) return;
    const clientePacoteId = crypto.randomUUID();
    await comprarPacote({
      id: clientePacoteId,
      salao_id: perfil.salao_id,
      cliente_id: clienteId,
      pacote_id: pacote.id,
      nome_pacote: pacote.nome,
      servico_id: pacote.servico_id,
      quantidade_restante: pacote.quantidade_sessoes,
    });
    // Sem isso, comprar um pacote não gerava nenhuma entrada financeira — o
    // dinheiro da venda simplesmente não aparecia no Financeiro. As sessões
    // usadas depois já são excluídas da receita de atendimento (não contam
    // de novo), então esse é o único lançamento dessa receita. Fica
    // vinculada ao cliente_pacote_id — se o pacote for excluído por engano,
    // essa receita some junto (cascade no banco, mesma regra do Android).
    try {
      await salvarReceitaAvulsa({
        id: crypto.randomUUID(),
        salao_id: perfil.salao_id,
        cliente_id: clienteId,
        cliente_pacote_id: clientePacoteId,
        origem: "PACOTE",
        descricao: `Venda do pacote ${pacote.nome}`,
        valor: pacote.preco,
        data_receita: new Date().toISOString(),
      });
    } catch {
      // se o registro da receita falhar, o pacote já foi vendido — não desfaz
      // a compra, mas o faturamento desse pacote fica faltando no relatório.
    }
    setMostrarSeletorPacote(false);
    listarClientePacotesPorCliente(clienteId).then(setPacotesDoCliente);
  }

  async function handleExcluirPacote() {
    if (!clienteId || !pacoteParaExcluir) return;
    await deletarClientePacote(pacoteParaExcluir.id);
    setPacoteParaExcluir(null);
    listarClientePacotesPorCliente(clienteId).then(setPacotesDoCliente);
  }

  // Exportação de dados do cliente pra atender pedido de portabilidade (LGPD)
  // — reúne cadastro, pacotes e histórico de atendimentos num único CSV.
  function handleExportarDados() {
    exportarCsvSecoes(`dados_${nome.replace(/\s+/g, "_")}`, [
      {
        titulo: "Dados cadastrais",
        colunas: [
          { chave: "nome", rotulo: "Nome" },
          { chave: "telefone", rotulo: "Telefone" },
          { chave: "aniversario", rotulo: "Aniversário" },
          { chave: "observacoes", rotulo: "Observações" },
        ],
        linhas: [{ nome, telefone, aniversario: aniversario || "", observacoes }],
      },
      {
        titulo: "Pacotes comprados",
        colunas: [
          { chave: "nome_pacote", rotulo: "Pacote" },
          { chave: "quantidade_restante", rotulo: "Sessões restantes" },
        ],
        linhas: pacotesDoCliente,
      },
      {
        titulo: "Histórico de atendimentos",
        colunas: [
          { chave: "data", rotulo: "Data" },
          { chave: "profissional", rotulo: "Profissional" },
          { chave: "servicos", rotulo: "Serviços" },
          { chave: "valor", rotulo: "Valor" },
          { chave: "status", rotulo: "Status" },
        ],
        linhas: historico.map((a) => ({
          data: formatarDataHora(a.dataHoraMillis),
          profissional: a.nomeProfissional,
          servicos: a.nomesServicos,
          valor: formatarMoeda(a.valorTotal),
          status: formatarStatus(a.status),
        })),
      },
    ]);
  }

  return (
    <div className="mx-auto max-w-2xl p-5 pb-16 md:p-8">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">{editando ? "Editar Cliente" : "Novo Cliente"}</h1>
        {editando && (
          <div className="flex items-center gap-1">
            <button
              onClick={handleExportarDados}
              title="Exportar dados do cliente (LGPD)"
              className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm text-muted transition-colors hover:bg-surface"
            >
              <Download size={15} /> Exportar dados
            </button>
            <button
              onClick={() => setMostrarConfirmacaoExclusao(true)}
              className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm text-danger transition-colors hover:bg-danger/10"
            >
              <Trash2 size={15} /> Excluir
            </button>
          </div>
        )}
      </div>

      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium uppercase tracking-wide text-muted">Nome</label>
          <div className={inputClass}>
            <User size={16} className="text-muted" />
            <input value={nome} onChange={(e) => setNome(e.target.value)} className="w-full bg-transparent outline-none" />
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium uppercase tracking-wide text-muted">Telefone (WhatsApp)</label>
          <div className={inputClass}>
            <Phone size={16} className="text-muted" />
            <input
              value={telefone}
              onChange={(e) => setTelefone(e.target.value.replace(/\D/g, ""))}
              className="w-full bg-transparent outline-none"
            />
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium uppercase tracking-wide text-muted">Aniversário</label>
          <div className={inputClass}>
            <Cake size={16} className="text-muted" />
            <input
              type="date"
              value={aniversario}
              onChange={(e) => setAniversario(e.target.value)}
              className="w-full bg-transparent outline-none [color-scheme:dark]"
            />
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium uppercase tracking-wide text-muted">Observações</label>
          <div className={inputClass}>
            <ClipboardList size={16} className="mt-0.5 shrink-0 text-muted" />
            <textarea
              value={observacoes}
              onChange={(e) => setObservacoes(e.target.value)}
              className="w-full resize-none bg-transparent outline-none"
              rows={3}
            />
          </div>
        </div>

        <button
          onClick={handleSalvar}
          className="rounded-xl bg-accent px-4 py-3.5 font-medium text-accent-foreground transition-opacity hover:opacity-90"
        >
          Salvar
        </button>

        {editando && (
          <>
            <button
              onClick={() => router.push(`/clientes/${clienteId}/fichas`)}
              className='card-elevated mt-3 flex items-center gap-3 rounded-xl bg-surface p-4 text-left transition-colors hover:bg-surface-alt'
            >
              <span className='flex h-10 w-10 items-center justify-center rounded-full bg-accent/15 text-accent'><FileSignature size={19} /></span>
              <span className='flex-1'><span className='block font-medium'>Fichas técnicas</span><span className='block text-xs text-muted'>Fórmulas, fotos de antes e depois e assinatura</span></span>
            </button>
            <div className="mt-3 flex items-center gap-2">
              <Package size={16} className="text-accent" />
              <p className="font-medium">Pacotes do cliente</p>
            </div>
            {pacotesDoCliente.length === 0 ? (
              <p className="text-sm text-muted">Nenhum pacote comprado ainda.</p>
            ) : (
              <div className="flex flex-col gap-2">
                {pacotesDoCliente.map((p) => (
                  <div key={p.id} className="card-elevated flex items-center justify-between gap-2 rounded-xl bg-surface p-3.5">
                    <span className="text-sm font-medium">{p.nome_pacote}</span>
                    <div className="flex items-center gap-2">
                      <span className="rounded-full bg-accent/12 px-2.5 py-1 text-xs font-medium text-accent">
                        {p.quantidade_restante} restante(s)
                      </span>
                      <button
                        onClick={() => setPacoteParaExcluir(p)}
                        aria-label={`Excluir pacote ${p.nome_pacote}`}
                        className="rounded-lg p-1.5 text-muted transition-colors hover:bg-danger/10 hover:text-danger"
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
            <button
              onClick={() => setMostrarSeletorPacote(true)}
              className="flex items-center justify-center gap-1.5 rounded-xl border border-border-subtle px-4 py-2.5 text-sm transition-colors hover:bg-surface"
            >
              <Plus size={15} /> Adicionar Pacote
            </button>

            <div className="mt-3 flex items-center gap-2">
              <History size={16} className="text-accent" />
              <p className="font-medium">Histórico de Atendimentos</p>
            </div>
            {carregandoHistorico ? (
              <div className="flex flex-col gap-2">
                {[0, 1].map((i) => (
                  <div key={i} className="h-16 animate-pulse rounded-xl bg-surface" />
                ))}
              </div>
            ) : historico.length === 0 ? (
              <p className="text-sm text-muted">Nenhum atendimento registrado ainda.</p>
            ) : (
              <div className="flex flex-col gap-2">
                {historico.map((a, i) => (
                  <div key={i} className="card-elevated rounded-xl bg-surface p-3.5">
                    <div className="flex items-center justify-between">
                      <span className="text-sm">{formatarDataHora(a.dataHoraMillis)}</span>
                      <span className="text-sm font-medium text-accent">{formatarMoeda(a.valorTotal)}</span>
                    </div>
                    <p className="mt-0.5 text-sm text-muted">{a.nomesServicos}</p>
                    <p className="text-xs text-muted">
                      {a.nomeProfissional} · {formatarStatus(a.status)}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>

      {mostrarSeletorPacote && (
        <div className="fixed inset-0 z-30 flex items-center justify-center bg-black/60 p-5 backdrop-blur-sm">
          <div className="card-elevated w-full max-w-sm rounded-2xl bg-surface p-5">
            <div className="mb-3 flex items-center justify-between">
              <p className="font-medium">Escolher Pacote</p>
              <button onClick={() => setMostrarSeletorPacote(false)} className="text-muted hover:text-foreground">
                <X size={18} />
              </button>
            </div>
            {pacotesDisponiveis.length === 0 ? (
              <p className="text-sm text-muted">Nenhum pacote cadastrado. Crie um em Serviços → Pacotes.</p>
            ) : (
              <div className="flex flex-col gap-1">
                {pacotesDisponiveis.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => handleComprarPacote(p)}
                    className="rounded-lg px-3 py-2.5 text-left text-sm transition-colors hover:bg-surface-alt"
                  >
                    {p.nome} — <span className="text-accent">{formatarMoeda(p.preco)}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {mostrarConfirmacaoExclusao && (
        <div className="fixed inset-0 z-30 flex items-center justify-center bg-black/60 p-5 backdrop-blur-sm">
          <div className="card-elevated w-full max-w-sm rounded-2xl bg-surface p-5">
            <p className="mb-2 font-medium">Excluir cliente?</p>
            <p className="mb-4 text-sm text-muted">
              Isso remove o cliente permanentemente. O histórico de agendamentos dele pode ficar sem referência.
            </p>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setMostrarConfirmacaoExclusao(false)}
                className="rounded-lg px-4 py-2 text-sm text-muted transition-colors hover:bg-surface-alt"
              >
                Cancelar
              </button>
              <button
                onClick={handleExcluir}
                className="rounded-lg bg-danger px-4 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90"
              >
                Excluir
              </button>
            </div>
          </div>
        </div>
      )}

      {pacoteParaExcluir && (
        <div className="fixed inset-0 z-30 flex items-center justify-center bg-black/60 p-5 backdrop-blur-sm">
          <div className="card-elevated w-full max-w-sm rounded-2xl bg-surface p-5">
            <p className="mb-2 font-medium">Excluir pacote?</p>
            <p className="mb-4 text-sm text-muted">
              Isso remove &quot;{pacoteParaExcluir.nome_pacote}&quot; do cliente. Use se ele foi cadastrado por engano.
            </p>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setPacoteParaExcluir(null)}
                className="rounded-lg px-4 py-2 text-sm text-muted transition-colors hover:bg-surface-alt"
              >
                Cancelar
              </button>
              <button
                onClick={handleExcluirPacote}
                className="rounded-lg bg-danger px-4 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90"
              >
                Excluir
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
