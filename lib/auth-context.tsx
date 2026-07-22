"use client";

import { createContext, useContext, useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import { buscarPerfil } from "@/lib/repositories/perfilRepository";
import { profissionaisVisiveisFinanceiro } from "@/lib/permissoes";
import { Perfil } from "@/lib/types";

interface AuthContextValue {
  perfil: Perfil | null;
  carregando: boolean;
  mostrarFinanceiro: boolean;
  login: (email: string, senha: string) => Promise<{ erro: string | null }>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

function esperar(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [perfil, setPerfil] = useState<Perfil | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [mostrarFinanceiro, setMostrarFinanceiro] = useState(false);
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

  async function logout() {
    await supabase.auth.signOut();
    setPerfil(null);
    setMostrarFinanceiro(false);
    perfilJaCarregado.current = false;
  }

  return (
    <AuthContext.Provider value={{ perfil, carregando, mostrarFinanceiro, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth precisa estar dentro de um AuthProvider");
  return ctx;
}
