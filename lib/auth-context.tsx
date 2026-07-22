"use client";

import { createContext, useContext, useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import { buscarPerfil } from "@/lib/repositories/perfilRepository";
import { souSuperAdmin as buscarSouSuperAdmin } from "@/lib/repositories/painelAdminRepository";
import { buscarConvitePorCodigo } from "@/lib/repositories/conviteRepository";
import { profissionaisVisiveisFinanceiro } from "@/lib/permissoes";
import { Perfil } from "@/lib/types";

const URL_CONFIRMACAO = "https://agendaflow-web-six.vercel.app";

interface AuthContextValue {
  perfil: Perfil | null;
  carregando: boolean;
  mostrarFinanceiro: boolean;
  souSuperAdmin: boolean;
  login: (email: string, senha: string) => Promise<{ erro: string | null }>;
  cadastrar: (email: string, senha: string, nomeUsuario: string, nomeSalao: string) => Promise<{ erro: string | null }>;
  cadastrarComConvite: (
    email: string,
    senha: string,
    nomeUsuario: string,
    codigoConvite: string
  ) => Promise<{ erro: string | null }>;
  enviarEmailRecuperacaoSenha: (email: string) => Promise<{ erro: string | null }>;
  logout: () => Promise<void>;
  refrescarPerfil: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

function esperar(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [perfil, setPerfil] = useState<Perfil | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [mostrarFinanceiro, setMostrarFinanceiro] = useState(false);
  const [souSuperAdmin, setSouSuperAdmin] = useState(false);
  const perfilJaCarregado = useRef(false);

  async function carregarPerfilComTentativas(userId: string) {
    for (let tentativa = 0; tentativa < 5; tentativa++) {
      try {
        const p = await buscarPerfil(userId);
        if (p) {
          setPerfil(p);
          try {
            const lista = await profissionaisVisiveisFinanceiro(p);
            setMostrarFinanceiro(lista === null || lista.length > 0);
          } catch {
            setMostrarFinanceiro(false);
          }
          try {
            setSouSuperAdmin(await buscarSouSuperAdmin(userId));
          } catch {
            setSouSuperAdmin(false);
          }
          return;
        }
      } catch {
        // tenta de novo
      }
      await esperar(400);
    }
  }

  useEffect(() => {
    const { data: listener } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (session?.user) {
        if (!perfilJaCarregado.current) {
          perfilJaCarregado.current = true;
          await carregarPerfilComTentativas(session.user.id);
        }
      } else {
        perfilJaCarregado.current = false;
        setPerfil(null);
        setMostrarFinanceiro(false);
        setSouSuperAdmin(false);
      }
      setCarregando(false);
    });

    return () => listener.subscription.unsubscribe();
  }, []);

  async function login(email: string, senha: string): Promise<{ erro: string | null }> {
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password: senha });
      if (error) {
        if (error.message.toLowerCase().includes("email not confirmed")) {
          return { erro: "Confirme seu e-mail antes de entrar. Verifique sua caixa de entrada." };
        }
        if (error.message.toLowerCase().includes("invalid login credentials")) {
          return { erro: "E-mail ou senha incorretos." };
        }
        return { erro: `Erro ao entrar: ${error.message}` };
      }
      return { erro: null };
    } catch (e) {
      const mensagem = e instanceof Error ? e.message : "Erro desconhecido";
      return { erro: `Não foi possível conectar ao servidor. (${mensagem})` };
    }
  }

  // Cadastro criando um SALÃO NOVO (fluxo do Dono). O salão/perfil são
  // criados automaticamente por um gatilho no banco, após confirmar o e-mail.
  async function cadastrar(
    email: string,
    senha: string,
    nomeUsuario: string,
    nomeSalao: string
  ): Promise<{ erro: string | null }> {
    try {
      const { error } = await supabase.auth.signUp({
        email,
        password: senha,
        options: {
          emailRedirectTo: URL_CONFIRMACAO,
          data: { tipo_cadastro: "SALAO_NOVO", nome_usuario: nomeUsuario, nome_salao: nomeSalao },
        },
      });
      if (error) return { erro: `Erro ao criar conta: ${error.message}` };
      return { erro: null };
    } catch (e) {
      const mensagem = e instanceof Error ? e.message : "Erro desconhecido";
      return { erro: `Não foi possível conectar ao servidor. (${mensagem})` };
    }
  }

  // Cadastro USANDO UM CONVITE (Admin/Profissional entrando num salão existente).
  // O perfil é criado automaticamente por um gatilho no banco, após confirmar o e-mail.
  async function cadastrarComConvite(
    email: string,
    senha: string,
    nomeUsuario: string,
    codigoConvite: string
  ): Promise<{ erro: string | null }> {
    try {
      const convite = await buscarConvitePorCodigo(codigoConvite);
      if (!convite) return { erro: "Código de convite inválido ou já utilizado." };

      const { error } = await supabase.auth.signUp({
        email,
        password: senha,
        options: {
          emailRedirectTo: URL_CONFIRMACAO,
          data: { tipo_cadastro: "CONVITE", nome_usuario: nomeUsuario, codigo_convite: codigoConvite },
        },
      });
      if (error) return { erro: `Erro ao criar conta: ${error.message}` };
      return { erro: null };
    } catch (e) {
      const mensagem = e instanceof Error ? e.message : "Erro desconhecido";
      return { erro: `Não foi possível conectar ao servidor. (${mensagem})` };
    }
  }

  async function enviarEmailRecuperacaoSenha(email: string): Promise<{ erro: string | null }> {
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email);
      if (error) return { erro: `Erro ao enviar e-mail: ${error.message}` };
      return { erro: null };
    } catch (e) {
      const mensagem = e instanceof Error ? e.message : "Erro desconhecido";
      return { erro: `Não foi possível conectar ao servidor. (${mensagem})` };
    }
  }

  async function logout() {
    await supabase.auth.signOut();
    setPerfil(null);
    setMostrarFinanceiro(false);
    setSouSuperAdmin(false);
    perfilJaCarregado.current = false;
  }

  async function refrescarPerfil() {
    if (!perfil) return;
    try {
      const p = await buscarPerfil(perfil.id);
      if (p) setPerfil(p);
    } catch {
      // mantém o perfil atual se a atualização falhar
    }
  }

  return (
    <AuthContext.Provider
      value={{
        perfil,
        carregando,
        mostrarFinanceiro,
        souSuperAdmin,
        login,
        cadastrar,
        cadastrarComConvite,
        enviarEmailRecuperacaoSenha,
        logout,
        refrescarPerfil,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth precisa estar dentro de um AuthProvider");
  return ctx;
}
