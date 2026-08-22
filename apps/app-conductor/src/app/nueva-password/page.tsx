"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button, Field, Aviso, LogoMarca } from "@ruum/ui";
import { observarSesionRecuperacion, passwordCumpleRequisitos, requisitosPassword, traducirErrorAuth } from "@ruum/shared/utils";
import { crearClienteNavegador, tieneSupabaseConfigurado } from "../../lib/supabase-browser";

export default function PaginaNuevaPasswordConductor() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirmar, setConfirmar] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [listo, setListo] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sesionLista, setSesionLista] = useState(false);
  const [verificando, setVerificando] = useState(true);

  useEffect(() => {
    if (!tieneSupabaseConfigurado()) {
      const timer = setTimeout(() => setVerificando(false), 0);
      return () => clearTimeout(timer);
    }

    const cliente = crearClienteNavegador();
    return observarSesionRecuperacion(cliente.auth, ({ sesionLista: lista, verificando: enVerificacion }) => {
      setSesionLista(lista);
      setVerificando(enVerificacion);
    });
  }, []);

  async function establecer(e: React.FormEvent) {
    e.preventDefault();
    if (!passwordCumpleRequisitos(password)) {
      setError("Tu contraseña debe cumplir todos los requisitos indicados abajo.");
      return;
    }
    if (password !== confirmar) { setError("Las contraseñas no coinciden."); return; }
    setEnviando(true);
    setError(null);
    try {
      const cliente = crearClienteNavegador();
      const { error: errorAuth } = await cliente.auth.updateUser({ password });
      if (errorAuth) throw errorAuth;
      setListo(true);
      setTimeout(() => router.push("/panel"), 2000);
    } catch (err) {
      setError(traducirErrorAuth(err, "No pudimos actualizar la contraseña."));
    } finally {
      setEnviando(false);
    }
  }


  return (
    <div className="conductor-auth-shell flex items-center justify-center px-4 py-10 sm:px-6">
      <section className="conductor-auth-card p-6 sm:p-8" aria-labelledby="titulo-nueva-pwd">
        <div className="flex items-center gap-3">
          <LogoMarca tamano={34} color="signal" descriptor="Conductor" mostrarRespaldo={false} />
        </div>
        <p className="mt-2 font-body text-[11px] font-medium tracking-wide text-text-tertiary">Seguridad, evidencia y trazabilidad</p>
        <div className="conductor-ruta-divider mt-3" aria-hidden />

        <h1 id="titulo-nueva-pwd" className="mt-6 font-display text-2xl font-bold tracking-tight text-text-primary">
          Nueva contraseña
        </h1>

        {verificando ? (
          <p className="mt-6 font-body text-sm text-text-tertiary/80">Verificando enlace…</p>
        ) : listo ? (
          <div className="mt-6 grid gap-3 text-center">
            <div className="mx-auto flex size-14 items-center justify-center rounded-full bg-control-soft text-success">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none"
                stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"
                aria-hidden="true"><path d="M20 6L9 17l-5-5" /></svg>
            </div>
            <p className="font-body text-sm text-text-tertiary/80">Contraseña actualizada. Redirigiendo…</p>
          </div>
        ) : !sesionLista ? (
          <div className="mt-6 grid gap-4">
            <Aviso tono="danger">
              El enlace expiró, ya fue usado, o se abrió en un dispositivo o navegador distinto al que lo solicitó.
              Los enlaces son válidos por 60 minutos y solo funcionan en el mismo teléfono/navegador.
            </Aviso>
            <Link href="/recuperar-password" className="inline-flex min-h-11 w-full items-center justify-center rounded-xl bg-signal font-display text-sm font-bold text-text-primary transition hover:bg-signal/90">
              Solicitar un nuevo enlace
            </Link>
          </div>
        ) : (
          <form className="mt-7 grid gap-4" onSubmit={establecer}>
            <div className="flex flex-col gap-1.5">
              <Field
                etiqueta="Nueva contraseña"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Mínimo 8 caracteres"
                required
                minLength={8}
                autoComplete="new-password"
              />

              {/* Requisitos dinámicos de contraseña */}
              <ul className="flex flex-col gap-1.5 rounded-xl border border-border bg-surface-elevated/70 p-3 text-xs font-body" aria-label="Requisitos de contraseña">
                {requisitosPassword(password).map((requisito) => {
                  const etiquetas: Record<string, string> = {
                    longitud: "Mínimo 8 caracteres",
                    minuscula: "Al menos una letra minúscula (a-z)",
                    mayuscula: "Al menos una letra mayúscula (A-Z)",
                    numero: "Al menos un número (0-9)"
                  };
                  return (
                    <li
                      key={requisito.clave}
                      className={`flex items-center gap-2 transition-all duration-150 ${requisito.cumplido ? "font-semibold text-emerald-600 dark:text-emerald-400" : "text-text-tertiary/80"}`}
                    >
                      <span
                        className={`flex size-4 shrink-0 items-center justify-center rounded-full text-[10px] font-bold transition-all ${requisito.cumplido ? "bg-emerald-600 text-white dark:bg-emerald-500 shadow-xs" : "bg-surface-elevated border border-border text-text-tertiary"}`}
                        aria-hidden
                      >
                        {requisito.cumplido ? "✓" : "○"}
                      </span>
                      {etiquetas[requisito.clave]}
                    </li>
                  );
                })}
              </ul>
            </div>

            <Field
              etiqueta="Confirmar contraseña"
              type="password"
              value={confirmar}
              onChange={(e) => setConfirmar(e.target.value)}
              placeholder="Repite tu contraseña"
              required
              minLength={8}
              autoComplete="new-password"
            />

            {error && (
              <output aria-live="polite" aria-atomic="true">
                <Aviso tono="danger">{error}</Aviso>
              </output>
            )}
            <Button type="submit" loading={enviando} disabled={enviando} className="mt-2 w-full">
              {enviando ? "Guardando…" : "Guardar nueva contraseña"}
            </Button>
          </form>
        )}
      </section>
    </div>
  );
}
