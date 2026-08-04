"use client";

import { use, useEffect, useMemo, useState } from "react";
import QRCode from "qrcode";
import { Calendar, CheckCircle2, Clock, Copy, MapPin, Phone, Scissors, User } from "lucide-react";
import {
  buscarHorariosDisponiveis,
  buscarInfoAgendaPublica,
  criarAgendamentoPublico,
  DadosPixCobranca,
  InfoAgendaPublica,
  ProfissionalPublico,
  ServicoPublico,
} from "@/lib/repositories/agendaPublicaRepository";
import { montarPixCopiaECola } from "@/lib/pix";

const DIAS_VISIVEIS = 14;
const DIAS_SEMANA_CURTO = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

function formatarMoeda(valor: number): string {
  return `R$ ${valor.toFixed(2).replace(".", ",")}`;
}

function formatarDuracao(minutos: number): string {
  const horas = Math.floor(minutos / 60);
  const min = minutos % 60;
  if (horas > 0 && min > 0) return `${horas}h ${min}min`;
  if (horas > 0) return `${horas}h`;
  return `${min}min`;
}

function chaveData(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function proximosDias(): Date[] {
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  return Array.from({ length: DIAS_VISIVEIS }, (_, i) => new Date(hoje.getTime() + i * 24 * 60 * 60 * 1000));
}

function formatarHorarioLocal(iso: string): string {
  return new Date(iso).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" });
}

function formatarDataLonga(iso: string): string {
  return new Date(iso).toLocaleDateString("pt-BR", {
    weekday: "long",
    day: "2-digit",
    month: "long",
    timeZone: "America/Sao_Paulo",
  });
}

export default function AgendarPublicoPage({ params }: { params: Promise<{ salaoId: string }> }) {
  const { salaoId } = use(params);

  const [info, setInfo] = useState<InfoAgendaPublica | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [erroCarregamento, setErroCarregamento] = useState<string | null>(null);

  const [servico, setServico] = useState<ServicoPublico | null>(null);
  const [profissional, setProfissional] = useState<ProfissionalPublico | "qualquer" | null>(null);
  const [dataEscolhida, setDataEscolhida] = useState<Date>(() => {
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);
    return hoje;
  });
  const [horarios, setHorarios] = useState<string[]>([]);
  const [carregandoHorarios, setCarregandoHorarios] = useState(false);
  const [horarioEscolhido, setHorarioEscolhido] = useState<string | null>(null);

  const [nome, setNome] = useState("");
  const [telefone, setTelefone] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [erroEnvio, setErroEnvio] = useState<string | null>(null);
  const [confirmado, setConfirmado] = useState(false);
  const [aguardandoPix, setAguardandoPix] = useState(false);
  const [pixCopiaECola, setPixCopiaECola] = useState<string | null>(null);
  const [pixQrDataUrl, setPixQrDataUrl] = useState<string | null>(null);
  const [pixCopiado, setPixCopiado] = useState(false);
  const [pixDados, setPixDados] = useState<DadosPixCobranca | null>(null);

  useEffect(() => {
    buscarInfoAgendaPublica(salaoId)
      .then(setInfo)
      .catch((e) => setErroCarregamento(e instanceof Error ? e.message : "Erro ao carregar."))
      .finally(() => setCarregando(false));
  }, [salaoId]);

  const precisaEscolherProfissional = info?.salao?.clienteEscolheProfissional ?? false;

  useEffect(() => {
    if (!servico) return;
    if (precisaEscolherProfissional && !profissional) return;

    setCarregandoHorarios(true);
    setHorarioEscolhido(null);
    buscarHorariosDisponiveis({
      salaoId,
      servicoId: servico.id,
      data: chaveData(dataEscolhida),
      profissionalId: profissional && profissional !== "qualquer" ? profissional.id : null,
    })
      .then(setHorarios)
      .catch(() => setHorarios([]))
      .finally(() => setCarregandoHorarios(false));
  }, [salaoId, servico, profissional, dataEscolhida, precisaEscolherProfissional]);

  const dias = useMemo(() => proximosDias(), []);

  async function handleConfirmar() {
    if (!servico || !horarioEscolhido || !nome.trim() || !telefone.trim() || !info) return;
    setEnviando(true);
    setErroEnvio(null);
    try {
      const resultado = await criarAgendamentoPublico({
        salaoId,
        servicoId: servico.id,
        profissionalId: profissional && profissional !== "qualquer" ? profissional.id : null,
        clienteNome: nome,
        clienteTelefone: telefone,
        dataHoraISO: horarioEscolhido,
      });

      if (resultado.cobraSinal && resultado.pix) {
        const dadosPix = resultado.pix;
        const copiaECola = montarPixCopiaECola({
          chave: dadosPix.chave,
          nomeBeneficiario: dadosPix.nomeBeneficiario,
          cidade: dadosPix.cidade,
          valor: dadosPix.valor,
          identificador: resultado.agendamentoId,
        });
        setPixDados(dadosPix);
        setPixCopiaECola(copiaECola);
        QRCode.toDataURL(copiaECola, { width: 260, margin: 1 })
          .then(setPixQrDataUrl)
          .catch(() => setPixQrDataUrl(null));
        setAguardandoPix(true);
      } else {
        setConfirmado(true);
      }
    } catch (e) {
      setErroEnvio(e instanceof Error ? e.message : "Não foi possível agendar. Tente novamente.");
    } finally {
      setEnviando(false);
    }
  }

  async function handleCopiarPix() {
    if (!pixCopiaECola) return;
    await navigator.clipboard.writeText(pixCopiaECola);
    setPixCopiado(true);
    setTimeout(() => setPixCopiado(false), 2000);
  }

  if (carregando) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-accent border-t-transparent" />
      </div>
    );
  }

  if (erroCarregamento || !info) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-2 p-6 text-center">
        <p className="text-lg font-medium">Não foi possível abrir essa agenda</p>
        <p className="text-sm text-muted">{erroCarregamento ?? "Link inválido."}</p>
      </div>
    );
  }

  if (aguardandoPix) {
    return (
      <div className="mx-auto flex min-h-screen max-w-md flex-col items-center gap-4 p-6 text-center">
        <h1 className="mt-4 text-xl font-semibold">Falta só o sinal</h1>
        <p className="text-sm text-muted">
          Pague {formatarMoeda(pixDados?.valor ?? info.salao.sinalValor)} via Pix para{" "}
          <strong>{pixDados?.recebedorNome ?? info.salao.nome}</strong> e garanta seu horário. O recebimento é
          confirmado manualmente.
        </p>
        {pixQrDataUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={pixQrDataUrl} alt="QR Code Pix" className="h-56 w-56 rounded-xl bg-white p-2" />
        ) : (
          <div className="h-56 w-56 animate-pulse rounded-xl bg-surface" />
        )}
        <button
          onClick={handleCopiarPix}
          className="flex w-full items-center justify-center gap-2 rounded-xl border border-border-subtle bg-surface px-4 py-3 text-sm font-medium transition-colors hover:bg-surface-alt"
        >
          <Copy size={15} />
          {pixCopiado ? "Copiado!" : "Copiar Pix Copia e Cola"}
        </button>
        <button
          onClick={() => setConfirmado(true)}
          className="w-full rounded-xl bg-accent px-4 py-3.5 font-medium text-accent-foreground transition-opacity hover:opacity-90"
        >
          Já paguei
        </button>
        <p className="text-xs text-muted">
          Seu horário já está reservado. Se o sinal não for pago, o salão pode liberar a vaga pra outro cliente.
        </p>
      </div>
    );
  }

  if (confirmado) {
    return (
      <div className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center gap-4 p-6 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-success/15">
          <CheckCircle2 size={32} className="text-success" />
        </div>
        <h1 className="text-xl font-semibold">Agendamento confirmado!</h1>
        <p className="text-muted">
          {servico?.nome} com {info.salao.nome}
          <br />
          {horarioEscolhido && formatarDataLonga(horarioEscolhido)} às {horarioEscolhido && formatarHorarioLocal(horarioEscolhido)}
        </p>
        <p className="text-sm text-muted">Chegue com alguns minutos de antecedência. Até lá!</p>
      </div>
    );
  }

  const { salao, servicos, profissionais } = info;
  const podeConfirmar = !!servico && !!horarioEscolhido && nome.trim().length > 1 && telefone.replace(/\D/g, "").length >= 10;

  return (
    <div className="mx-auto min-h-screen max-w-md pb-28">
      <header className="gradient-accent flex flex-col items-center gap-2 border-b border-border-subtle px-5 pb-6 pt-8 text-center">
        {salao.logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={salao.logoUrl} alt={salao.nome} className="h-16 w-16 rounded-2xl object-cover" />
        ) : (
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-accent/15">
            <Scissors size={26} className="text-accent" />
          </div>
        )}
        <h1 className="text-xl font-semibold">{salao.nome}</h1>
        {(salao.endereco || salao.bairro) && (
          <p className="flex items-center gap-1 text-sm text-muted">
            <MapPin size={13} />
            {[salao.endereco, salao.numero, salao.bairro].filter(Boolean).join(", ")}
          </p>
        )}
      </header>

      <div className="flex flex-col gap-6 px-5 pt-6">
        <section>
          <h2 className="mb-3 text-sm font-medium text-muted">1. Escolha o serviço</h2>
          <div className="flex flex-col gap-2">
            {servicos.map((s) => (
              <button
                key={s.id}
                onClick={() => {
                  setServico(s);
                  setProfissional(null);
                }}
                className={`card-elevated flex items-center justify-between rounded-xl border p-4 text-left transition-colors ${
                  servico?.id === s.id ? "border-accent bg-accent/10" : "border-border-subtle bg-surface"
                }`}
              >
                <div>
                  <p className="font-medium">{s.nome}</p>
                  <p className="flex items-center gap-1.5 text-sm text-muted">
                    <span>{s.variavel ? `A partir de ${formatarMoeda(s.preco)}` : formatarMoeda(s.preco)}</span>
                    <span>·</span>
                    <span className="flex items-center gap-1">
                      <Clock size={11} /> {formatarDuracao(s.duracao_minutos)}
                    </span>
                  </p>
                </div>
                {servico?.id === s.id && <CheckCircle2 size={20} className="shrink-0 text-accent" />}
              </button>
            ))}
          </div>
        </section>

        {servico && precisaEscolherProfissional && (
          <section>
            <h2 className="mb-3 text-sm font-medium text-muted">2. Escolha o profissional</h2>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => setProfissional("qualquer")}
                className={`flex items-center gap-2 rounded-xl border px-3.5 py-2.5 text-sm transition-colors ${
                  profissional === "qualquer" ? "border-accent bg-accent/10" : "border-border-subtle bg-surface"
                }`}
              >
                <User size={15} /> Sem preferência
              </button>
              {profissionais.map((p) => (
                <button
                  key={p.id}
                  onClick={() => setProfissional(p)}
                  className={`flex items-center gap-2 rounded-xl border px-3.5 py-2.5 text-sm transition-colors ${
                    profissional !== "qualquer" && profissional?.id === p.id
                      ? "border-accent bg-accent/10"
                      : "border-border-subtle bg-surface"
                  }`}
                >
                  {p.fotoUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={p.fotoUrl} alt={p.nome} className="h-5 w-5 rounded-full object-cover" />
                  ) : (
                    <User size={15} />
                  )}
                  {p.nome}
                </button>
              ))}
            </div>
          </section>
        )}

        {servico && (!precisaEscolherProfissional || profissional) && (
          <section>
            <h2 className="mb-3 flex items-center gap-1.5 text-sm font-medium text-muted">
              <Calendar size={14} /> 3. Escolha o dia e horário
            </h2>
            <div className="mb-4 flex gap-2 overflow-x-auto pb-1">
              {dias.map((d) => {
                const selecionado = chaveData(d) === chaveData(dataEscolhida);
                return (
                  <button
                    key={chaveData(d)}
                    onClick={() => setDataEscolhida(d)}
                    className={`flex shrink-0 flex-col items-center rounded-xl border px-3 py-2 text-xs transition-colors ${
                      selecionado ? "border-accent bg-accent/10 text-accent" : "border-border-subtle bg-surface text-muted"
                    }`}
                  >
                    <span>{DIAS_SEMANA_CURTO[d.getDay()]}</span>
                    <span className="text-base font-semibold text-foreground">{d.getDate()}</span>
                  </button>
                );
              })}
            </div>

            {carregandoHorarios ? (
              <div className="flex flex-wrap gap-2">
                {[0, 1, 2, 3, 4, 5].map((i) => (
                  <div key={i} className="h-10 w-20 animate-pulse rounded-xl bg-surface" />
                ))}
              </div>
            ) : horarios.length === 0 ? (
              <p className="text-sm text-muted">Nenhum horário livre nesse dia. Tente outra data.</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {horarios.map((h) => (
                  <button
                    key={h}
                    onClick={() => setHorarioEscolhido(h)}
                    className={`rounded-xl border px-4 py-2.5 text-sm font-medium transition-colors ${
                      horarioEscolhido === h ? "border-accent bg-accent text-accent-foreground" : "border-border-subtle bg-surface"
                    }`}
                  >
                    {formatarHorarioLocal(h)}
                  </button>
                ))}
              </div>
            )}
          </section>
        )}

        {horarioEscolhido && (
          <section>
            <h2 className="mb-3 text-sm font-medium text-muted">4. Seus dados</h2>
            <div className="flex flex-col gap-2.5">
              <input
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                placeholder="Seu nome"
                className="rounded-xl border border-border-subtle bg-surface px-3.5 py-2.5 outline-none focus:border-accent"
              />
              <div className="relative">
                <Phone size={15} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-muted" />
                <input
                  value={telefone}
                  onChange={(e) => setTelefone(e.target.value.replace(/[^\d()\- ]/g, ""))}
                  placeholder="Seu WhatsApp"
                  className="w-full rounded-xl border border-border-subtle bg-surface py-2.5 pl-10 pr-3.5 outline-none focus:border-accent"
                />
              </div>
            </div>
            {erroEnvio && <p className="mt-2 text-sm text-danger">{erroEnvio}</p>}
          </section>
        )}
      </div>

      {horarioEscolhido && (
        <div className="fixed inset-x-0 bottom-0 mx-auto max-w-md border-t border-border-subtle bg-background p-4">
          <button
            onClick={handleConfirmar}
            disabled={!podeConfirmar || enviando}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-accent px-4 py-3.5 font-medium text-accent-foreground transition-opacity disabled:opacity-40"
          >
            {enviando ? (
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-accent-foreground border-t-transparent" />
            ) : (
              <>
                Confirmar {formatarHorarioLocal(horarioEscolhido)} · {formatarMoeda(servico!.preco)}
              </>
            )}
          </button>
        </div>
      )}
    </div>
  );
}
