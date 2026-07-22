"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CalendarDays, Eye, EyeOff, Lock, Mail, MailCheck, User } from "lucide-react";
import { useAuth } from "@/lib/auth-context";

type Modo = "LOGIN" | "CADASTRO_NOVO_SALAO" | "CADASTRO_COM_CONVITE";

const inputWrapperClass =
  "flex items-center gap-2.5 rounded-xl border border-border-subtle bg-surface px-4 py-3 transition-colors focus-within:border-accent";
const inputClass = "w-full bg-transparent text-foreground outline-none placeholder:text-muted/60";

export default function LoginPage() {
  const { login, cadastrar, cadastrarComConvite, enviarEmailRecuperacaoSenha } = useAuth();
  const router = useRouter();

  const [modo, setModo] = useState<Modo>("LOGIN");
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [confirmarSenha, setConfirmarSenha] = useState("");
  const [nomeUsuario, setNomeUsuario] = useState("");
  const [nomeSalao, setNomeSalao] = useState("");
  const [codigoConvite, setCodigoConvite] = useState("");
  const [senhaVisivel, setSenhaVisivel] = useState(false);
  const [confirmarSenhaVisivel, setConfirmarSenhaVisivel] = useState(false);

  const [erro, setErro] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(false);
  const [aguardandoConfirmacao, setAguardandoConfirmacao] = useState(false);

  const [mostrarRecuperacao, setMostrarRecuperacao] = useState(false);
  const [emailRecuperacao, setEmailRecuperacao] = useState("");
  const [estadoRecuperacao, setEstadoRecuperacao] = useState<"OCIOSO" | "CARREGANDO" | "SUCESSO" | "ERRO">("OCIOSO");
  const [erroRecuperacao, setErroRecuperacao] = useState<string | null>(null);

  const ehModoCadastro = modo === "CADASTRO_NOVO_SALAO" || modo === "CADASTRO_COM_CONVITE";

  function trocarModo(novoModo: Modo) {
    setModo(novoModo);
    setErro(null);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);

    if (ehModoCadastro) {
      if (senha.length < 6) {
        setErro("A senha precisa ter pelo menos 6 caracteres.");
        return;
      }
      if (senha !== confirmarSenha) {
        setErro("As senhas não coincidem. Confira e tente de novo.");
        return;
      }
    }

    setCarregando(true);
    let resultado: { erro: string | null };
    if (modo === "LOGIN") {
      resultado = await login(email, senha);
    } else if (modo === "CADASTRO_NOVO_SALAO") {
      resultado = await cadastrar(email, senha, nomeUsuario, nomeSalao);
    } else {
      resultado = await cadastrarComConvite(email, senha, nomeUsuario, codigoConvite);
    }
    setCarregando(false);

    if (resultado.erro) {
      setErro(resultado.erro);
    } else if (modo === "LOGIN") {
      router.replace("/");
    } else {
      setAguardandoConfirmacao(true);
    }
  }

  async function handleEnviarRecuperacao() {
    setEstadoRecuperacao("CARREGANDO");
    setErroRecuperacao(null);
    const resultado = await enviarEmailRecuperacaoSenha(emailRecuperacao);
    if (resultado.erro) {
      setErroRecuperacao(resultado.erro);
      setEstadoRecuperacao("ERRO");
    } else {
      setEstadoRecuperacao("SUCESSO");
    }
  }

  function fecharRecuperacao() {
    setMostrarRecuperacao(false);
    setEmailRecuperacao("");
    setEstadoRecuperacao("OCIOSO");
    setErroRecuperacao(null);
  }

  if (aguardandoConfirmacao) {
    return (
      <div className="flex flex-1 items-center justify-center p-6">
        <div className="flex w-full max-w-sm flex-col items-center gap-4 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-accent/15">
            <MailCheck size={30} className="text-accent" />
          </div>
          <h1 className="text-xl font-semibold tracking-tight">Confira seu e-mail!</h1>
          <p className="text-sm text-muted">
            Enviamos um link de confirmação para o seu e-mail. Clique nele para ativar sua conta e depois volte aqui
            para entrar.
          </p>
          <button
            onClick={() => {
              setAguardandoConfirmacao(false);
              trocarModo("LOGIN");
            }}
            className="mt-2 rounded-xl bg-accent px-5 py-3 font-medium text-accent-foreground transition-opacity hover:opacity-90"
          >
            Já confirmei — Ir para o Login
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="relative flex flex-1 items-center justify-center overflow-hidden p-6">
      <div
        className="pointer-events-none absolute -top-32 left-1/2 h-80 w-80 -translate-x-1/2 rounded-full opacity-20 blur-3xl"
        style={{ background: "radial-gradient(circle, var(--accent), transparent 70%)" }}
      />

      <div className="relative w-full max-w-sm">
        <div className="mb-10 flex flex-col items-center gap-4">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-accent/12 ring-1 ring-accent/25">
            <CalendarDays size={30} className="text-accent" strokeWidth={2.1} />
          </div>
          <div className="text-center">
            <h1 className="text-xl font-semibold tracking-tight">AgendaFlow Pro</h1>
            <p className="mt-1 text-sm text-muted">
              {modo === "LOGIN" && "Entrar na sua conta"}
              {modo === "CADASTRO_NOVO_SALAO" && "Criar novo salão"}
              {modo === "CADASTRO_COM_CONVITE" && "Entrar com código de convite"}
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          {modo === "CADASTRO_NOVO_SALAO" && (
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium uppercase tracking-wide text-muted">Nome do salão</label>
              <div className={inputWrapperClass}>
                <input
                  value={nomeSalao}
                  onChange={(e) => setNomeSalao(e.target.value)}
                  required
                  className={inputClass}
                  placeholder="Nome do seu salão"
                />
              </div>
            </div>
          )}

          {modo === "CADASTRO_COM_CONVITE" && (
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium uppercase tracking-wide text-muted">Código de convite</label>
              <div className={inputWrapperClass}>
                <input
                  value={codigoConvite}
                  onChange={(e) => setCodigoConvite(e.target.value.toUpperCase())}
                  required
                  className={inputClass}
                  placeholder="ABC123"
                />
              </div>
            </div>
          )}

          {ehModoCadastro && (
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium uppercase tracking-wide text-muted">Seu nome</label>
              <div className={inputWrapperClass}>
                <User size={17} className="text-muted" />
                <input
                  value={nomeUsuario}
                  onChange={(e) => setNomeUsuario(e.target.value)}
                  required
                  className={inputClass}
                  placeholder="Seu nome"
                />
              </div>
            </div>
          )}

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium uppercase tracking-wide text-muted">E-mail</label>
            <div className={inputWrapperClass}>
              <Mail size={17} className="text-muted" />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className={inputClass}
                placeholder="voce@email.com"
                autoComplete="email"
              />
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium uppercase tracking-wide text-muted">Senha</label>
            <div className={inputWrapperClass}>
              <Lock size={17} className="text-muted" />
              <input
                type={senhaVisivel ? "text" : "password"}
                required
                value={senha}
                onChange={(e) => setSenha(e.target.value)}
                className={inputClass}
                placeholder="••••••••"
                autoComplete={ehModoCadastro ? "new-password" : "current-password"}
              />
              <button type="button" onClick={() => setSenhaVisivel((v) => !v)} className="text-muted">
                {senhaVisivel ? <EyeOff size={17} /> : <Eye size={17} />}
              </button>
            </div>
          </div>

          {ehModoCadastro && (
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium uppercase tracking-wide text-muted">Confirmar senha</label>
              <div className={inputWrapperClass}>
                <Lock size={17} className="text-muted" />
                <input
                  type={confirmarSenhaVisivel ? "text" : "password"}
                  required
                  value={confirmarSenha}
                  onChange={(e) => setConfirmarSenha(e.target.value)}
                  className={inputClass}
                  placeholder="••••••••"
                  autoComplete="new-password"
                />
                <button type="button" onClick={() => setConfirmarSenhaVisivel((v) => !v)} className="text-muted">
                  {confirmarSenhaVisivel ? <EyeOff size={17} /> : <Eye size={17} />}
                </button>
              </div>
            </div>
          )}

          {modo === "LOGIN" && (
            <button
              type="button"
              onClick={() => setMostrarRecuperacao(true)}
              className="-mt-1 self-start text-sm text-accent transition-opacity hover:opacity-80"
            >
              Esqueci minha senha
            </button>
          )}

          {ehModoCadastro && (
            <p className="text-center text-xs text-muted">
              Ao criar sua conta, você concorda com nossos Termos de Uso e Política de Privacidade.
            </p>
          )}

          {erro && <p className="rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger">{erro}</p>}

          <button
            type="submit"
            disabled={carregando}
            className="mt-2 rounded-xl bg-accent px-4 py-3.5 font-medium text-accent-foreground transition-opacity hover:opacity-90 disabled:opacity-60"
          >
            {carregando
              ? "Aguarde..."
              : modo === "LOGIN"
                ? "Entrar"
                : modo === "CADASTRO_NOVO_SALAO"
                  ? "Criar conta"
                  : "Entrar no salão"}
          </button>
        </form>

        <div className="mt-4 flex flex-col items-center gap-1">
          {modo === "LOGIN" && (
            <>
              <button onClick={() => trocarModo("CADASTRO_NOVO_SALAO")} className="text-sm text-accent hover:opacity-80">
                Não tenho conta — Criar salão novo
              </button>
              <button onClick={() => trocarModo("CADASTRO_COM_CONVITE")} className="text-sm text-accent hover:opacity-80">
                Tenho um código de convite
              </button>
            </>
          )}
          {ehModoCadastro && (
            <button onClick={() => trocarModo("LOGIN")} className="text-sm text-accent hover:opacity-80">
              Já tenho conta — Entrar
            </button>
          )}
        </div>
      </div>

      {mostrarRecuperacao && (
        <div className="fixed inset-0 z-30 flex items-center justify-center bg-black/60 p-5 backdrop-blur-sm">
          <div className="card-elevated w-full max-w-sm rounded-2xl bg-surface p-5">
            <p className="mb-3 font-medium">Recuperar senha</p>

            {estadoRecuperacao === "SUCESSO" ? (
              <div className="flex flex-col items-center gap-2 py-2 text-center">
                <MailCheck size={32} className="text-accent" />
                <p className="text-sm text-muted">
                  E-mail enviado! Confira sua caixa de entrada (e o spam) para redefinir sua senha.
                </p>
              </div>
            ) : (
              <>
                <p className="mb-3 text-sm text-muted">
                  Digite o e-mail da sua conta. Vamos te enviar um link pra criar uma nova senha.
                </p>
                <input
                  type="email"
                  value={emailRecuperacao}
                  onChange={(e) => setEmailRecuperacao(e.target.value)}
                  placeholder="voce@email.com"
                  className="w-full rounded-lg border border-border-subtle bg-background px-3 py-2 text-sm outline-none focus:border-accent"
                />
                {erroRecuperacao && <p className="mt-2 text-sm text-danger">{erroRecuperacao}</p>}
              </>
            )}

            <div className="mt-4 flex justify-end gap-2">
              {estadoRecuperacao === "SUCESSO" ? (
                <button onClick={fecharRecuperacao} className="rounded-lg px-4 py-2 text-sm text-muted hover:bg-surface-alt">
                  Fechar
                </button>
              ) : (
                <>
                  <button onClick={fecharRecuperacao} className="rounded-lg px-4 py-2 text-sm text-muted hover:bg-surface-alt">
                    Cancelar
                  </button>
                  <button
                    onClick={handleEnviarRecuperacao}
                    disabled={!emailRecuperacao.trim() || estadoRecuperacao === "CARREGANDO"}
                    className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-accent-foreground transition-opacity hover:opacity-90 disabled:opacity-60"
                  >
                    {estadoRecuperacao === "CARREGANDO" ? "Enviando..." : "Enviar link"}
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
