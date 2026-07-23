"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { RelatorioHeader } from "@/components/RelatorioHeader";
import { listarAgendamentos, listarEquipe } from "@/lib/repositories";
import { profissionaisVisiveisFinanceiro } from "@/lib/permissoes";
import Avatar from "@/components/Avatar";
import { converterIsoParaMillis, janelaUltimosDias } from "@/lib/datetime";
import { Agendamento } from "@/lib/types";

interface LinhaFidelizacao {
  nomeProfissional: string;
  fotoUrl: string | null;
  totalClientes: number;
  retornaram: number;
  taxaRetorno: number;
}

export default function FidelizacaoPage() {
  const { perfil } = useAuth();
  const [linhas, setLinhas] = useState<LinhaFidelizacao[]>([]);
  const [taxaMedia, setTaxaMedia] = useState(0);
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    if (!perfil) return;
    carregar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [perfil?.id]);

  async function carregar() {
    if (!perfil) return;
    setCarregando(true);
    try {
      const [agendamentos, equipe, permitidos] = await Promise.all([
        listarAgendamentos(perfil.salao_id),
        listarEquipe(perfil.salao_id),
        profissionaisVisiveisFinanceiro(perfil),
      ]);
      const equipeMap = new Map(equipe.map((p) => [p.id, p]));
      const [inicio, fim] = janelaUltimosDias(30);

      const doPeriodo = agendamentos.filter((a) => {
        const m = converterIsoParaMillis(a.data_hora);
        const permitido = permitidos === null || (a.profissional_id !== null && permitidos.includes(a.profissional_id));
        return a.status === "CONCLUIDO" && a.profissional_id !== null && m >= inicio && m <= fim && permitido;
      });

      const porProfissional = new Map<string, Agendamento[]>();
      doPeriodo.forEach((a) => {
        const lista = porProfissional.get(a.profissional_id!) ?? [];
        lista.push(a);
        porProfissional.set(a.profissional_id!, lista);
      });

      let somaRetornaram = 0;
      let somaClientes = 0;

      const resultado: LinhaFidelizacao[] = Array.from(porProfissional.entries()).map(([profissionalId, lista]) => {
        const porCliente = new Map<string, number>();
        lista.forEach((a) => porCliente.set(a.cliente_id, (porCliente.get(a.cliente_id) ?? 0) + 1));
        const totalClientes = porCliente.size;
        const retornaram = Array.from(porCliente.values()).filter((qtd) => qtd > 1).length;
        somaRetornaram += retornaram;
        somaClientes += totalClientes;
        return {
          nomeProfissional: equipeMap.get(profissionalId)?.nome ?? "Não atribuído",
          fotoUrl: equipeMap.get(profissionalId)?.foto_url ?? null,
          totalClientes,
          retornaram,
          taxaRetorno: totalClientes > 0 ? (retornaram / totalClientes) * 100 : 0,
        };
      });

      resultado.sort((a, b) => b.taxaRetorno - a.taxaRetorno);
      setLinhas(resultado);
      setTaxaMedia(somaClientes > 0 ? (somaRetornaram / somaClientes) * 100 : 0);
    } finally {
      setCarregando(false);
    }
  }

  return (
    <div className="mx-auto max-w-3xl p-5 md:p-8">
      <RelatorioHeader titulo="Fidelização por Profissional" />
      <p className="mb-5 text-sm text-muted">Últimos 30 dias</p>

      <div className="card-elevated gradient-accent mb-4 rounded-2xl border border-accent/15 bg-surface p-5">
        <p className="text-xs font-semibold uppercase tracking-wide text-accent">Taxa média de retorno</p>
        <p className="text-3xl font-bold tabular-nums">{taxaMedia.toFixed(1)}%</p>
      </div>

      {carregando ? (
        <div className="flex flex-col gap-2">
          {[0, 1].map((i) => (
            <div key={i} className="h-20 animate-pulse rounded-xl bg-surface" />
          ))}
        </div>
      ) : linhas.length === 0 ? (
        <p className="text-center text-sm text-muted">Nenhum dado nesse período.</p>
      ) : (
        <div className="flex flex-col gap-3">
          {linhas.map((l, i) => {
            return (
              <div key={i} className="card-elevated rounded-xl bg-surface p-4">
                <div className="mb-2 flex items-center gap-3">
                  <span className="text-sm font-semibold text-muted">{i + 1}.</span>
                  <Avatar nome={l.nomeProfissional} fotoUrl={l.fotoUrl} className="h-9 w-9 text-xs" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{l.nomeProfissional}</p>
                    <p className="text-xs text-muted">
                      {l.totalClientes} cliente(s) · {l.retornaram} retornaram
                    </p>
                  </div>
                  <span className="text-sm font-semibold tabular-nums text-accent">{l.taxaRetorno.toFixed(0)}%</span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-surface-alt">
                  <div className="h-full rounded-full bg-accent transition-all" style={{ width: `${l.taxaRetorno}%` }} />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
