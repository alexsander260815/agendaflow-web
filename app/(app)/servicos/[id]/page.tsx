"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Clock, DollarSign, Scissors, Tag, Trash2 } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import {
  atualizarServico,
  buscarServico,
  deletarServico,
  salvarServico,
} from "@/lib/repositories/servicoRepository";

const inputClass =
  "flex items-center gap-2.5 rounded-xl border border-border-subtle bg-surface px-4 py-3 transition-colors focus-within:border-accent";

export default function ServicoFormPage() {
  const { perfil } = useAuth();
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const editando = params.id !== "novo";
  const servicoId = editando ? params.id : null;

  const [nome, setNome] = useState("");
  const [categoria, setCategoria] = useState("");
  const [duracao, setDuracao] = useState("");
  const [preco, setPreco] = useState("");
  const [variavel, setVariavel] = useState(false);
  const [mostrarConfirmacaoExclusao, setMostrarConfirmacaoExclusao] = useState(false);

  useEffect(() => {
    if (editando && servicoId) {
      buscarServico(servicoId).then((s) => {
        if (s) {
          setNome(s.nome);
          setCategoria(s.categoria ?? "");
          setDuracao(String(s.duracao_minutos));
          setPreco(String(s.preco));
          setVariavel(s.variavel);
        }
      });
    }
  }, [servicoId, editando]);

  async function handleSalvar() {
    if (!perfil) return;
    const dados = {
      id: servicoId ?? crypto.randomUUID(),
      salao_id: perfil.salao_id,
      nome,
      duracao_minutos: parseInt(duracao) || 0,
      preco: parseFloat(preco) || 0,
      categoria: categoria || null,
      variavel,
    };
    if (editando && servicoId) {
      await atualizarServico(servicoId, dados);
    } else {
      await salvarServico(dados);
    }
    router.push("/servicos");
  }

  async function handleExcluir() {
    if (!servicoId) return;
    await deletarServico(servicoId);
    router.push("/servicos");
  }

  return (
    <div className="mx-auto max-w-xl p-5 md:p-8">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">{editando ? "Editar Serviço" : "Novo Serviço"}</h1>
        {editando && (
          <button
            onClick={() => setMostrarConfirmacaoExclusao(true)}
            className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm text-danger transition-colors hover:bg-danger/10"
          >
            <Trash2 size={15} /> Excluir
          </button>
        )}
      </div>

      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium uppercase tracking-wide text-muted">Nome do serviço</label>
          <div className={inputClass}>
            <Scissors size={16} className="text-muted" />
            <input value={nome} onChange={(e) => setNome(e.target.value)} className="w-full bg-transparent outline-none" />
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium uppercase tracking-wide text-muted">
            Categoria (ex: Cabelo, Unha, Alisamento)
          </label>
          <div className={inputClass}>
            <Tag size={16} className="text-muted" />
            <input
              value={categoria}
              onChange={(e) => setCategoria(e.target.value)}
              className="w-full bg-transparent outline-none"
            />
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium uppercase tracking-wide text-muted">Duração (minutos)</label>
          <div className={inputClass}>
            <Clock size={16} className="text-muted" />
            <input
              value={duracao}
              onChange={(e) => setDuracao(e.target.value.replace(/\D/g, ""))}
              className="w-full bg-transparent outline-none"
            />
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium uppercase tracking-wide text-muted">
            {variavel ? "Preço a partir de (ex: 50.00)" : "Preço (ex: 50.00)"}
          </label>
          <div className={inputClass}>
            <DollarSign size={16} className="text-muted" />
            <input
              value={preco}
              onChange={(e) => setPreco(e.target.value.replace(/[^0-9.]/g, ""))}
              className="w-full bg-transparent outline-none"
            />
          </div>
        </div>

        <div className="card-elevated flex items-center justify-between gap-4 rounded-xl bg-surface p-4">
          <div>
            <p className="text-sm font-medium">Preço a partir de</p>
            <p className="mt-0.5 text-xs text-muted">
              Ative para serviços cujo valor varia (ex: por tamanho de cabelo). O valor final é ajustado na
              comanda ao criar o agendamento.
            </p>
          </div>
          <button
            onClick={() => setVariavel(!variavel)}
            className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${
              variavel ? "bg-accent" : "bg-surface-alt"
            }`}
          >
            <span
              className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition-transform ${
                variavel ? "translate-x-5" : "translate-x-0.5"
              }`}
            />
          </button>
        </div>

        <button
          onClick={handleSalvar}
          className="rounded-xl bg-accent px-4 py-3.5 font-medium text-accent-foreground transition-opacity hover:opacity-90"
        >
          Salvar
        </button>
      </div>

      {mostrarConfirmacaoExclusao && (
        <div className="fixed inset-0 z-30 flex items-center justify-center bg-black/60 p-5 backdrop-blur-sm">
          <div className="card-elevated w-full max-w-sm rounded-2xl bg-surface p-5">
            <p className="mb-2 font-medium">Excluir serviço?</p>
            <p className="mb-4 text-sm text-muted">
              Isso remove o serviço permanentemente. Agendamentos antigos com esse serviço não são afetados.
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
    </div>
  );
}
