import React from "react";
import { LoginButton } from "./components/login-button";

interface LoginPageProps {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const resolvedParams = await searchParams;
  const error = resolvedParams.error as string | undefined;

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4 py-12">
      <div className="w-full max-w-md space-y-8 bg-card p-8 rounded-xl border border-border shadow-lg">
        <div className="text-center space-y-2">
          <div className="inline-flex h-12 w-12 items-center justify-center rounded-xl bg-primary text-primary-foreground font-bold text-xl shadow-md">
            RB
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            Bienvenido a racso-brain
          </h1>
          <p className="text-sm text-muted-foreground">
            Tu segundo cerebro operativo y financiero para activos y proyectos.
          </p>
        </div>

        {error && (
          <div
            role="alert"
            className="p-3.5 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-sm"
          >
            <div className="font-semibold">Error de autenticación</div>
            <div className="text-xs opacity-90 mt-0.5">{error}</div>
          </div>
        )}

        <div className="space-y-4 pt-2">
          <LoginButton />
        </div>

        <div className="pt-4 border-t border-border text-center text-xs text-muted-foreground">
          Acceso exclusivo mediante Google Workspace y cuentas personales Gmail.
        </div>
      </div>
    </div>
  );
}
