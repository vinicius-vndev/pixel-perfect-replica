import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Logo } from "./index";

const search = z.object({ mode: z.enum(["login", "signup", "forgot"]).optional() });

export const Route = createFileRoute("/auth")({
  validateSearch: search,
  head: () => ({
    meta: [
      { title: "Entrar — DetailHub" },
      { name: "description", content: "Acesse o painel da sua estética automotiva no DetailHub." },
      { property: "og:title", content: "Entrar — DetailHub" },
      { property: "og:description", content: "Acesse o painel da sua estética." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const { mode: initial } = Route.useSearch();
  const [mode, setMode] = useState(initial ?? "login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState<string | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) navigate({ to: "/painel", replace: true });
    });
  }, [navigate]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      if (mode === "signup") {
        if (name.trim().length < 2) throw new Error("Informe seu nome.");
        if (password.length < 8) throw new Error("A senha deve ter pelo menos 8 caracteres.");
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: `${window.location.origin}/painel`,
            data: { full_name: name.trim() },
          },
        });
        if (error) throw error;
        setSent("Enviamos um link de confirmação para seu e-mail. Confirme para acessar o painel.");
      } else if (mode === "forgot") {
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: `${window.location.origin}/reset-password`,
        });
        if (error) throw error;
        setSent(
          "Se houver uma conta com esse e-mail, você receberá um link para criar uma nova senha.",
        );
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error)
          throw new Error(
            error.message.includes("confirmed")
              ? "Confirme seu e-mail antes de entrar."
              : "E-mail ou senha incorretos.",
          );
        navigate({ to: "/painel", replace: true });
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Algo deu errado.");
    } finally {
      setLoading(false);
    }
  }

  async function google() {
    const r = await lovable.auth.signInWithOAuth("google", {
      redirect_uri: window.location.origin + "/auth",
    });
    if (r.error) toast.error("Não foi possível entrar com Google.");
    else if (!r.redirected) navigate({ to: "/painel", replace: true });
  }

  const title =
    mode === "signup" ? "Criar conta" : mode === "forgot" ? "Recuperar senha" : "Entrar no painel";

  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-4 py-10">
      <div className="mb-8">
        <Logo />
      </div>
      <div className="w-full max-w-sm rounded-lg border bg-card p-6">
        <h1 className="text-3xl font-bold uppercase">{title}</h1>
        {sent ? (
          <div className="mt-4 space-y-4">
            <p className="text-sm text-muted-foreground">{sent}</p>
            <Button
              variant="outline"
              className="w-full"
              onClick={() => {
                setSent(null);
                setMode("login");
              }}
            >
              Voltar para entrar
            </Button>
          </div>
        ) : (
          <>
            <form onSubmit={submit} className="mt-5 space-y-4">
              {mode === "signup" && (
                <div className="space-y-1.5">
                  <Label htmlFor="name">Seu nome</Label>
                  <Input
                    id="name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                    autoComplete="name"
                  />
                </div>
              )}
              <div className="space-y-1.5">
                <Label htmlFor="email">E-mail</Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoComplete="email"
                />
              </div>
              {mode !== "forgot" && (
                <div className="space-y-1.5">
                  <Label htmlFor="password">Senha</Label>
                  <Input
                    id="password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    minLength={mode === "signup" ? 8 : undefined}
                    autoComplete={mode === "signup" ? "new-password" : "current-password"}
                  />
                </div>
              )}
              <Button type="submit" variant="hero" className="w-full" disabled={loading}>
                {loading
                  ? "Aguarde..."
                  : mode === "signup"
                    ? "Criar conta"
                    : mode === "forgot"
                      ? "Enviar link"
                      : "Entrar"}
              </Button>
            </form>
            {mode !== "forgot" && (
              <>
                <div className="my-4 flex items-center gap-3 text-xs text-muted-foreground">
                  <span className="h-px flex-1 bg-border" />
                  ou
                  <span className="h-px flex-1 bg-border" />
                </div>
                <Button variant="outline" className="w-full" onClick={google}>
                  Continuar com Google
                </Button>
              </>
            )}
            <div className="mt-5 flex flex-col gap-1 text-center text-sm">
              {mode === "login" && (
                <>
                  <button
                    className="text-primary hover:underline"
                    onClick={() => setMode("signup")}
                  >
                    Não tem conta? Cadastre-se
                  </button>
                  <button
                    className="text-muted-foreground hover:underline"
                    onClick={() => setMode("forgot")}
                  >
                    Esqueci minha senha
                  </button>
                </>
              )}
              {mode !== "login" && (
                <button className="text-primary hover:underline" onClick={() => setMode("login")}>
                  Já tenho conta
                </button>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
