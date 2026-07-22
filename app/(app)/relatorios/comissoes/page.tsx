"use client";

import { useEffect, useState } from "react";
import { Check } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { RelatorioHeader } from "@/components/RelatorioHeader";
import {
  listarAgendamentoServicos,
  listarAgendamentos,
  listarEquipe,
  marcarComissaoFechada,
  salvarFechamentoComissao,
} from "@/lib/repositories";
import { profissionaisVisiveisFinanceiro } from "@/lib/permissoes";
import Avatar from "@/components/Avatar";
import { converterIsoParaMillis, formatarMoeda } from "@/lib/datetime";
import { AgendamentoServico } from "@/lib/types";

interface LinhaComissao {
  profissionalId: string;
  nomeProfissional: string;
  fotoUrl: string | null;
  comissaoPercentual: number;
  quantidadeAtendimentos: number;
  faturamentoBruto: number;
  valorComissao: number;
  itemIds: string[];
}

export default function RelatorioComissoesPage() {
  const { perfil } = useAuth();
  const [dataInicio, setDataInicio] = useState("");
  const [dataFim, setDataFim] = useState("");
  const [linhas, setLinhas] = useState<LinhaComissao[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [fechando, setFechando] = useState<LinhaComissao | null>(null);

  const filtroAtivo = dataInicio !== "" && dataFim !== "";

  useEffect(() => {
    if (!perfil) return;
    carregar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [perfil?.id, dataInicio, dataFim]);

  async function carregar() {
    if (!perfil) return;
    setCarregando(true);
    try {
      const [agendamentos, itens, equipe, permitidos] = await Promise.all([
        listarAgendamentos(perfil.salao_id),
        listarAgendamentoServicos(perfil.salao_id),
        listarEquipe(perfil.salao_id),
        profissionaisVisiveisFinanceiro(perfil),
      ]);
      const equipeMap = new Map(equipe.map((p) => [p.id, p]));

      let base = agendamentos.filter((a) => a.status === "CONCLUIDO");
      if (permitidos !== null) {
        base = base.filter((a) => a.profissional_id !== null && permitidos.includes(a.profissional_id));
      }
      if (filtroAtivo) {
        const inicioMillis = new Date(`${dataInicio}T00:00:00`).getTime();
        const fimMillis = new Date(`${dataFim}T23:59:59`).getTime();
        base = base.filter((a) => {
          const m = converterIsoParaMillis(a.data_hora);
          return m >= inicioMillis && m <= fimMillis;
        });
      }

      const idsBase = new Set(base.map((a) => a.id));
      const agendamentoPorItem = new Map<string, string>();
      base.forEach((a) => agendamentoPorItem.set(a.id, a.profissional_id ?? ""));

      let itensRelevantes = itens.filter((i) => idsBase.has(i.agendamento_id));
      if (!filtroAtivo) {
        itensRelevantes = itensRelevantes.filter((i) => !i.comissao_fechada);
      }

      const porProfissional = new Map<string, AgendamentoServico[]>();
      itensRelevantes.forEach((i) => {
        const profissionalId = agendamentoPorItem.get(i.agendamento_id);
        if (!profissionalId) return;
        const lista = porProfissional.get(profissionalId) ?? [];
        lista.push(i);
        porProfissional.set(profissionalId, lista);
      });

      const resultado: LinhaComissao[] = [];
      porProfissional.forEach((itensDoProf, profissionalId) => {
        const perfilProf = equipeMap.get(profissionalId);
        if (!perfilProf) return;
        const faturamentoBruto = itensDoProf.reduce((s, i) => s + i.preco, 0);
        resultado.push({
          profissionalId,
          nomeProfissional: perfilProf.nome,
          fotoUrl: perfilProf.foto_url,
          comissaoPercentual: perfilProf.comissao_percentual,
          quantidadeAtendimentos: new Set(itensDoProf.map((i) => i.agendamento_id)).size,
          faturamentoBruto,
          valorComissao: faturamentoBruto * (perfilProf.comissao_percentual / 100),
          itemIds: itensDoProf.map((i) => i.id),
        });
      });

      resultado.sort((a, b) => b.valorComissao - a.valorComissao);
      setLinhas(resultado);
    } finally {
      setCarregando(false);
    }
  }

  async function handleFecharComissao(linha: LinhaComissao) {
    if (!perfil) return;
    const agora = new Date().toISOString();
    await salvarFechamentoComissao({
      id: crypto.randomUUID(),
      salao_id: perfil.salao_id,
      profissional_id: linha.profissionalId,
      data_inicio: agora,
      data_fim: agora,
      valor_total: linha.valorComissao,
    });
    for (const itemId of linha.itemIds) {
      await marcarComissaoFechada(itemId);
    }
    setFechando(null);
    carregar();
  }

  return (
    <div className="mx-auto max-w-3xl p-5 md:p-8">
      <RelatorioHeader titulo="Relatório de Comissões" />

      <div className="mb-5 flex flex-wrap items-end gap-2">
        <div className="flex flex-col gap-1">
          <label className="text-xs text-muted">Data início</label>
          <input
            type="date"
            value={dataInicio}
            onChange={(e) => setDataInicio(e.target.value)}
            className="rounded-lg border border-border-subtle bg-surface px-3 py-2 text-sm outline-none focus:border-accent [color-scheme:dark]"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs text-muted">Data fim</label>
          <input
            type="date"
            value={dataFim}
            onChange={(e) => setDataFim(e.target.value)}
            className="rounded-lg border border-border-subtle bg-surface px-3 py-2 text-sm outline-none focus:border-accent [color-scheme:dark]"
          />
        </div>
        {filtroAtivo && (
          <button
            onClick={() => {
              setDataInicio("");
              setDataFim("");
            }}
            className="rounded-lg px-3 py-2 text-sm text-muted transition-colors hover:bg-surface"
          >
            Limpar
          </button>
        )}
      </div>

      <p className="mb-3 text-xs text-muted">
        {filtroAtivo ? "Revisão do período (inclui já fechadas)." : "Fila de comissões pendentes (não fechadas)."}
      </p>

      {carregando ? (
        <div className="flex flex-col gap-2">
          {[0, 1].map((i) => (
            <div key={i} className="h-20 animate-pulse rounded-xl bg-surface" />
          ))}
        </div>
      ) : linhas.length === 0 ? (
        <p className="text-center text-sm text-muted">Nenhuma comissão nesse período.</p>
      ) : (
        <div className="flex flex-col gap-2">
          {linhas.map((l) => {
            return (
              <div key={l.profissionalId} className="card-elevated rounded-xl bg-surface p-4">
                <div className="flex items-center gap-3">
                  <Avatar nome={l.nomeProfissional} fotoUrl={l.fotoUrl} className="h-10 w-10 text-sm" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{l.nomeProfissional}</p>
                    <p className="text-xs text-muted">
                      {l.quantidadeAtendimentos} atend. · {l.comissaoPercentual}% · bruto {formatarMoeda(l.faturamentoBruto)}
                    </p>
                  </div>
                  <span className="font-semibold tabular-nums text-accent">{formatarMoeda(l.valorComissao)}</span>
                </div>
                {!filtroAtivo && (
                  <button
                    onClick={() => setFechando(l)}
                    className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-lg border border-border-subtle py-2 text-sm transition-colors hover:bg-surface-alt"
                  >
                    <Check size={14} /> Visualizar e fechar
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}

      {fechando && (
        <div className="fixed inset-0 z-30 flex items-center justify-center bg-black/60 p-5 backdrop-blur-sm">
          <div className="card-elevated w-full max-w-sm rounded-2xl bg-surface p-5">
            <p className="mb-2 font-medium">Fechar comissão de {fechando.nomeProfissional}?</p>
            <p className="mb-4 text-sm text-muted">
              Valor: <span className="font-medium text-accent">{formatarMoeda(fechando.valorComissao)}</span>. Essa ação
              marca os atendimentos como pagos e não pode ser desfeita.
            </p>
            <div className="flex justify-end gap-2">
              <button onClick={() => setFechando(null)} className="rounded-lg px-4 py-2 text-sm text-muted transition-colors hover:bg-surface-alt">
                Cancelar
              </button>
              <button
                onClick={() => handleFecharComissao(fechando)}
                className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-accent-foreground transition-opacity hover:opacity-90"
              >
                Fechar comissão
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
