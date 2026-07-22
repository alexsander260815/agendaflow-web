"use client";

import { useEffect, useState } from "react";
import {
  AlertTriangle,
  Box,
  History,
  Package,
  Plus,
  Trash2,
  Wrench,
  X,
} from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import {
  listarProdutos,
  salvarProduto,
  atualizarProduto,
  atualizarSaldoProduto,
  deletarProduto,
  listarMovimentacoes,
  salvarMovimentacao,
  listarServicos,
  listarServicoProdutosPorServico,
  definirConsumo,
} from "@/lib/repositories";
import { MovimentacaoEstoque, Produto, Servico, ServicoProduto, TipoMovimentacao } from "@/lib/types";
import { formatarMoeda } from "@/lib/datetime";

const ABAS = ["saldo", "catalogo", "consumo", "historico"] as const;
type Aba = (typeof ABAS)[number];

const LABEL_ABA: Record<Aba, string> = {
  saldo: "Saldo",
  catalogo: "Catálogo",
  consumo: "Consumo automático",
  historico: "Histórico",
};

const LABEL_TIPO: Record<TipoMovimentacao, string> = {
  ENTRADA: "Entrada",
  VENDA: "Venda",
  CONSUMO: "Consumo",
  AJUSTE: "Ajuste",
};

const COR_TIPO: Record<TipoMovimentacao, string> = {
  ENTRADA: "bg-emerald-400",
  VENDA: "bg-danger",
  CONSUMO: "bg-danger",
  AJUSTE: "bg-accent",
};

export default function EstoquePage() {
  const { perfil } = useAuth();
  const [aba, setAba] = useState<Aba>("saldo");
  const [produtos, setProdutos] = useState<Produto[]>([]);
  const [movimentacoes, setMovimentacoes] = useState<MovimentacaoEstoque[]>([]);
  const [servicos, setServicos] = useState<Servico[]>([]);
  const [carregando, setCarregando] = useState(true);

  const [mostrarNovoProduto, setMostrarNovoProduto] = useState(false);
  const [produtoEditando, setProdutoEditando] = useState<Produto | null>(null);
  const [produtoMovimentando, setProdutoMovimentando] = useState<Produto | null>(null);
  const [produtoExcluindo, setProdutoExcluindo] = useState<Produto | null>(null);

  useEffect(() => {
    if (!perfil) return;
    carregar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [perfil?.id]);

  async function carregar() {
    if (!perfil) return;
    setCarregando(true);
    try {
      const [p, m, s] = await Promise.all([
        listarProdutos(perfil.salao_id),
        listarMovimentacoes(perfil.salao_id),
        listarServicos(perfil.salao_id),
      ]);
      setProdutos(p);
      setMovimentacoes(m);
      setServicos(s);
    } finally {
      setCarregando(false);
    }
  }

  function nomeProduto(id: string): string {
    return produtos.find((p) => p.id === id)?.nome ?? "Produto desconhecido";
  }

  async function handleCriarProduto(dados: { nome: string; quantidadeInicial: number; preco: number; minimo: number }) {
    if (!perfil) return;
    const produto: Produto = {
      id: crypto.randomUUID(),
      salao_id: perfil.salao_id,
      nome: dados.nome,
      unidade: "un",
      preco: dados.preco,
      saldo: dados.quantidadeInicial,
      minimo: dados.minimo,
    };
    await salvarProduto(produto);
    if (dados.quantidadeInicial > 0) {
      await salvarMovimentacao({
        id: crypto.randomUUID(),
        salao_id: perfil.salao_id,
        produto_id: produto.id,
        tipo: "ENTRADA",
        quantidade: dados.quantidadeInicial,
        observacao: "Cadastro inicial",
      });
    }
    setMostrarNovoProduto(false);
    carregar();
  }

  async function handleEditarProduto(produto: Produto, nome: string, preco: number, minimo: number) {
    await atualizarProduto({ ...produto, nome, preco, minimo });
    setProdutoEditando(null);
    carregar();
  }

  async function handleDeletarProduto(id: string) {
    await deletarProduto(id);
    setProdutoExcluindo(null);
    carregar();
  }

  async function handleRegistrarMovimentacao(produto: Produto, tipo: TipoMovimentacao, quantidade: number) {
    if (!perfil) return;
    const novoSaldo = tipo === "ENTRADA" ? produto.saldo + quantidade : tipo === "AJUSTE" ? quantidade : produto.saldo - quantidade;
    const quantidadeMovimentacao = tipo === "AJUSTE" ? quantidade - produto.saldo : quantidade;

    await atualizarSaldoProduto(produto.id, novoSaldo);
    await salvarMovimentacao({
      id: crypto.randomUUID(),
      salao_id: perfil.salao_id,
      produto_id: produto.id,
      tipo,
      quantidade: quantidadeMovimentacao,
      observacao: "",
    });
    setProdutoMovimentando(null);
    carregar();
  }

  const produtosBaixoEstoque = produtos.filter((p) => p.saldo <= p.minimo);

  return (
    <div className="mx-auto max-w-3xl p-5 pb-16 md:p-8">
      <h1 className="mb-5 text-2xl font-semibold tracking-tight">Estoque</h1>

      <div className="mb-5 flex gap-1 overflow-x-auto rounded-xl bg-surface p-1">
        {ABAS.map((a) => (
          <button
            key={a}
            onClick={() => setAba(a)}
            className={`shrink-0 rounded-lg px-3.5 py-2 text-sm font-medium transition-colors ${
              aba === a ? "bg-accent text-accent-foreground" : "text-muted"
            }`}
          >
            {LABEL_ABA[a]}
          </button>
        ))}
      </div>

      {carregando ? (
        <div className="flex flex-col gap-2">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-16 animate-pulse rounded-xl bg-surface" />
          ))}
        </div>
      ) : aba === "saldo" ? (
        <div className="flex flex-col gap-2">
          {produtosBaixoEstoque.length > 0 && (
            <div className="card-elevated mb-2 flex items-start gap-2.5 rounded-xl bg-danger/10 p-4">
              <AlertTriangle size={18} className="mt-0.5 shrink-0 text-danger" />
              <div>
                <p className="text-sm font-medium text-danger">Estoque baixo</p>
                <p className="text-sm text-danger/80">
                  {produtosBaixoEstoque.map((p) => p.nome).join(", ")}
                </p>
              </div>
            </div>
          )}
          {produtos.length === 0 ? (
            <EstadoVazio icone={Box} texto="Estoque vazio." />
          ) : (
            produtos.map((p) => {
              const baixo = p.saldo <= p.minimo;
              return (
                <button
                  key={p.id}
                  onClick={() => setProdutoMovimentando(p)}
                  className="card-elevated flex items-center justify-between rounded-xl bg-surface p-4 text-left transition-colors hover:bg-surface-alt"
                >
                  <div className="flex items-center gap-3">
                    <div className={`flex h-10 w-10 items-center justify-center rounded-full ${baixo ? "bg-danger/12" : "bg-accent/12"}`}>
                      <Box size={16} className={baixo ? "text-danger" : "text-accent"} />
                    </div>
                    <p className="font-medium">{p.nome}</p>
                  </div>
                  <span className={`text-sm font-medium ${baixo ? "text-danger" : ""}`}>
                    {p.saldo} {p.unidade}
                  </span>
                </button>
              );
            })
          )}
        </div>
      ) : aba === "catalogo" ? (
        <div className="flex flex-col gap-2">
          <button
            onClick={() => setMostrarNovoProduto(true)}
            className="mb-1 flex items-center justify-center gap-1.5 rounded-xl border border-border-subtle px-4 py-2.5 text-sm transition-colors hover:bg-surface"
          >
            <Plus size={15} /> Novo produto
          </button>
          {produtos.length === 0 ? (
            <EstadoVazio icone={Package} texto="Nenhum produto ainda." />
          ) : (
            produtos.map((p) => (
              <div key={p.id} className="card-elevated flex items-center justify-between rounded-xl bg-surface p-4">
                <button onClick={() => setProdutoEditando(p)} className="min-w-0 flex-1 text-left">
                  <p className="font-medium">{p.nome}</p>
                  <p className="text-sm text-muted">
                    {formatarMoeda(p.preco)} · mín. {p.minimo} {p.unidade}
                  </p>
                </button>
                <button
                  onClick={() => setProdutoExcluindo(p)}
                  className="rounded-lg p-2 text-muted transition-colors hover:bg-danger/10 hover:text-danger"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            ))
          )}
        </div>
      ) : aba === "consumo" ? (
        <ConsumoAutomaticoTab servicos={servicos} produtos={produtos} salaoId={perfil?.salao_id ?? ""} />
      ) : (
        <div className="flex flex-col gap-2">
          {movimentacoes.length === 0 ? (
            <EstadoVazio icone={History} texto="Sem histórico ainda." />
          ) : (
            movimentacoes.map((m) => (
              <div key={m.id} className="card-elevated flex items-center gap-3 rounded-xl bg-surface p-3.5">
                <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${COR_TIPO[m.tipo]}`} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{nomeProduto(m.produto_id)}</p>
                  <p className="text-xs text-muted">{LABEL_TIPO[m.tipo]}</p>
                </div>
                <span className="text-sm tabular-nums text-muted">{m.quantidade > 0 ? "+" : ""}{m.quantidade}</span>
              </div>
            ))
          )}
        </div>
      )}

      {mostrarNovoProduto && (
        <FormularioProdutoModal
          titulo="Novo produto"
          onFechar={() => setMostrarNovoProduto(false)}
          onSalvar={(dados) => handleCriarProduto(dados as { nome: string; quantidadeInicial: number; preco: number; minimo: number })}
          comQuantidadeInicial
        />
      )}

      {produtoEditando && (
        <FormularioProdutoModal
          titulo="Editar produto"
          produto={produtoEditando}
          onFechar={() => setProdutoEditando(null)}
          onSalvar={(dados) =>
            handleEditarProduto(produtoEditando, dados.nome, dados.preco, dados.minimo)
          }
        />
      )}

      {produtoMovimentando && (
        <MovimentacaoModal
          produto={produtoMovimentando}
          onFechar={() => setProdutoMovimentando(null)}
          onConfirmar={(tipo, quantidade) => handleRegistrarMovimentacao(produtoMovimentando, tipo, quantidade)}
        />
      )}

      {produtoExcluindo && (
        <div className="fixed inset-0 z-30 flex items-center justify-center bg-black/60 p-5 backdrop-blur-sm">
          <div className="card-elevated w-full max-w-sm rounded-2xl bg-surface p-5">
            <p className="mb-2 font-medium">Excluir {produtoExcluindo.nome}?</p>
            <p className="mb-4 text-sm text-muted">Essa ação não pode ser desfeita.</p>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setProdutoExcluindo(null)}
                className="rounded-lg px-4 py-2 text-sm text-muted transition-colors hover:bg-surface-alt"
              >
                Cancelar
              </button>
              <button
                onClick={() => handleDeletarProduto(produtoExcluindo.id)}
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

function EstadoVazio({ icone: Icone, texto }: { icone: typeof Box; texto: string }) {
  return (
    <div className="card-elevated flex flex-col items-center gap-2 rounded-2xl bg-surface p-10 text-center">
      <Icone size={28} className="text-muted" />
      <p className="text-sm text-muted">{texto}</p>
    </div>
  );
}

function FormularioProdutoModal({
  titulo,
  produto,
  comQuantidadeInicial,
  onFechar,
  onSalvar,
}: {
  titulo: string;
  produto?: Produto;
  comQuantidadeInicial?: boolean;
  onFechar: () => void;
  onSalvar: (dados: { nome: string; quantidadeInicial: number; preco: number; minimo: number }) => void;
}) {
  const [nome, setNome] = useState(produto?.nome ?? "");
  const [quantidadeInicial, setQuantidadeInicial] = useState("0");
  const [preco, setPreco] = useState(produto ? String(produto.preco) : "");
  const [minimo, setMinimo] = useState(produto ? String(produto.minimo) : "1");

  return (
    <div className="fixed inset-0 z-30 flex items-center justify-center bg-black/60 p-5 backdrop-blur-sm">
      <div className="card-elevated w-full max-w-sm rounded-2xl bg-surface p-5">
        <div className="mb-4 flex items-center justify-between">
          <p className="font-medium">{titulo}</p>
          <button onClick={onFechar} className="text-muted hover:text-foreground">
            <X size={18} />
          </button>
        </div>
        <div className="flex flex-col gap-3">
          <input
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            placeholder="Nome do produto"
            className="rounded-xl border border-border-subtle bg-background px-3.5 py-2.5 outline-none focus:border-accent"
          />
          {comQuantidadeInicial && (
            <input
              value={quantidadeInicial}
              onChange={(e) => setQuantidadeInicial(e.target.value.replace(/\D/g, ""))}
              placeholder="Quantidade inicial"
              className="rounded-xl border border-border-subtle bg-background px-3.5 py-2.5 outline-none focus:border-accent"
            />
          )}
          <input
            value={preco}
            onChange={(e) => setPreco(e.target.value.replace(/[^0-9.]/g, ""))}
            placeholder="Preço (ex: 25.00)"
            className="rounded-xl border border-border-subtle bg-background px-3.5 py-2.5 outline-none focus:border-accent"
          />
          <input
            value={minimo}
            onChange={(e) => setMinimo(e.target.value.replace(/\D/g, ""))}
            placeholder="Estoque mínimo"
            className="rounded-xl border border-border-subtle bg-background px-3.5 py-2.5 outline-none focus:border-accent"
          />
        </div>
        <button
          onClick={() =>
            onSalvar({
              nome,
              quantidadeInicial: parseInt(quantidadeInicial) || 0,
              preco: parseFloat(preco) || 0,
              minimo: parseInt(minimo) || 0,
            })
          }
          className="mt-4 w-full rounded-xl bg-accent px-4 py-3 text-sm font-medium text-accent-foreground transition-opacity hover:opacity-90"
        >
          Salvar
        </button>
      </div>
    </div>
  );
}

function MovimentacaoModal({
  produto,
  onFechar,
  onConfirmar,
}: {
  produto: Produto;
  onFechar: () => void;
  onConfirmar: (tipo: TipoMovimentacao, quantidade: number) => void;
}) {
  const [tipo, setTipo] = useState<TipoMovimentacao>("ENTRADA");
  const [quantidade, setQuantidade] = useState("");

  return (
    <div className="fixed inset-0 z-30 flex items-center justify-center bg-black/60 p-5 backdrop-blur-sm">
      <div className="card-elevated w-full max-w-sm rounded-2xl bg-surface p-5">
        <div className="mb-1 flex items-center justify-between">
          <p className="font-medium">{produto.nome}</p>
          <button onClick={onFechar} className="text-muted hover:text-foreground">
            <X size={18} />
          </button>
        </div>
        <p className="mb-4 text-sm text-muted">Saldo atual: {produto.saldo} {produto.unidade}</p>

        <div className="mb-3 grid grid-cols-2 gap-2">
          {(["ENTRADA", "VENDA", "CONSUMO", "AJUSTE"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTipo(t)}
              className={`rounded-lg py-2 text-sm font-medium transition-colors ${
                tipo === t ? "bg-accent text-accent-foreground" : "bg-surface-alt text-muted"
              }`}
            >
              {LABEL_TIPO[t]}
            </button>
          ))}
        </div>

        <input
          value={quantidade}
          onChange={(e) => setQuantidade(e.target.value.replace(/\D/g, ""))}
          placeholder={tipo === "AJUSTE" ? "Novo saldo" : "Quantidade"}
          className="w-full rounded-xl border border-border-subtle bg-background px-3.5 py-2.5 outline-none focus:border-accent"
        />

        <button
          onClick={() => quantidade && onConfirmar(tipo, parseInt(quantidade))}
          className="mt-4 w-full rounded-xl bg-accent px-4 py-3 text-sm font-medium text-accent-foreground transition-opacity hover:opacity-90"
        >
          Confirmar
        </button>
      </div>
    </div>
  );
}

function ConsumoAutomaticoTab({
  servicos,
  produtos,
  salaoId,
}: {
  servicos: Servico[];
  produtos: Produto[];
  salaoId: string;
}) {
  const [servicoId, setServicoId] = useState<string>(servicos[0]?.id ?? "");
  const [consumos, setConsumos] = useState<ServicoProduto[]>([]);
  const [carregando, setCarregando] = useState(false);

  useEffect(() => {
    if (!servicoId) return;
    setCarregando(true);
    listarServicoProdutosPorServico(servicoId)
      .then(setConsumos)
      .finally(() => setCarregando(false));
  }, [servicoId]);

  function adicionarLinha() {
    if (!produtos[0]) return;
    setConsumos((atual) => [
      ...atual,
      { id: crypto.randomUUID(), salao_id: salaoId, servico_id: servicoId, produto_id: produtos[0].id, quantidade_consumida: 1 },
    ]);
  }

  function atualizarLinha(index: number, campo: "produto_id" | "quantidade_consumida", valor: string) {
    setConsumos((atual) =>
      atual.map((c, i) =>
        i === index ? { ...c, [campo]: campo === "quantidade_consumida" ? parseInt(valor) || 1 : valor } : c
      )
    );
  }

  function removerLinha(index: number) {
    setConsumos((atual) => atual.filter((_, i) => i !== index));
  }

  async function salvar() {
    await definirConsumo(
      salaoId,
      servicoId,
      consumos.map((c) => ({ produto_id: c.produto_id, quantidade_consumida: c.quantidade_consumida }))
    );
  }

  if (servicos.length === 0) {
    return <EstadoVazio icone={Wrench} texto="Cadastre um serviço primeiro." />;
  }

  return (
    <div className="flex flex-col gap-3">
      <select
        value={servicoId}
        onChange={(e) => setServicoId(e.target.value)}
        className="rounded-xl border border-border-subtle bg-surface px-4 py-3 outline-none focus:border-accent"
      >
        {servicos.map((s) => (
          <option key={s.id} value={s.id}>
            {s.nome}
          </option>
        ))}
      </select>

      {carregando ? (
        <div className="h-16 animate-pulse rounded-xl bg-surface" />
      ) : (
        <>
          {consumos.length === 0 ? (
            <p className="text-sm text-muted">Nenhum produto vinculado a esse serviço ainda.</p>
          ) : (
            <div className="flex flex-col gap-2">
              {consumos.map((c, i) => (
                <div key={c.id} className="card-elevated flex items-center gap-2 rounded-xl bg-surface p-3">
                  <select
                    value={c.produto_id}
                    onChange={(e) => atualizarLinha(i, "produto_id", e.target.value)}
                    className="flex-1 bg-transparent text-sm outline-none"
                  >
                    {produtos.map((p) => (
                      <option key={p.id} value={p.id} className="bg-surface">
                        {p.nome}
                      </option>
                    ))}
                  </select>
                  <input
                    value={c.quantidade_consumida}
                    onChange={(e) => atualizarLinha(i, "quantidade_consumida", e.target.value.replace(/\D/g, ""))}
                    className="w-14 rounded-lg border border-border-subtle bg-background px-2 py-1 text-center text-sm outline-none"
                  />
                  <button
                    onClick={() => removerLinha(i)}
                    className="rounded-lg p-1.5 text-muted transition-colors hover:bg-danger/10 hover:text-danger"
                  >
                    <X size={15} />
                  </button>
                </div>
              ))}
            </div>
          )}
          <button
            onClick={adicionarLinha}
            className="flex items-center justify-center gap-1.5 rounded-xl border border-border-subtle px-4 py-2.5 text-sm transition-colors hover:bg-surface"
          >
            <Plus size={15} /> Adicionar produto
          </button>
          <button
            onClick={salvar}
            className="rounded-xl bg-accent px-4 py-3 text-sm font-medium text-accent-foreground transition-opacity hover:opacity-90"
          >
            Salvar consumo automático
          </button>
        </>
      )}
    </div>
  );
}
