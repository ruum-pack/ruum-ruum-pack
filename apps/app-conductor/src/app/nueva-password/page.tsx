"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button, Field, Aviso, LogoMarca } from "@ruum/ui";
import { fortalezaPassword, observarSesionRecuperacion, traducirErrorAuth } from "@ruum/shared/utils";
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
    if (password.length < 8) { setError("Mínimo 8 caracteres."); return; }
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

  const pwd = fortalezaPassword(password);

  return (
    <div className="conductor-auth-shell flex items-center justify-center px-4 py-10 sm:px-6">
      <section className="conductor-auth-card p-6 sm:p-8" aria-labelledby="titulo-nueva-pwd">
        <div className="flex items-center gap-3">
          <LogoMarca tamano={34} color="signal" />
          <div>
            <p className="font-display text-lg font-extrabold tracking-tight text-text-primary">
              ruum<span className="text-signal">ruum</span>
            </p>
            <p className="font-body text-xs font-semibold text-text-tertiary">Conductor</p>
          </div>
        </div>

        <h1 id="titulo-nueva-pwd" className="mt-8 font-display text-2xl font-bold text-text-primary">
          Nueva contraseña
        </h1>

        {verificando ? (
          <p className="mt-6 font-body text-sm text-text-secondary">Verificando enlace…</p>
        ) : listo ? (
          <div className="mt-6 grid gap-3 text-center">
            <div className="mx-auto flex size-14 items-center justify-center rounded-full bg-control-soft text-success">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none"
                stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"
                aria-hidden="true"><path d="M20 6L9 17l-5-5" /></svg>
            </div>
            <p className="font-body text-sm text-text-secondary">Contraseña actualizada. Redirigiendo…</p>
          </div>
        ) : !sesionLista ? (
          <div className="mt-6 grid gap-4">
            <Aviso tono="danger">El enlace expiró o ya fue usado. Los enlaces son válidos por 60 minutos.</Aviso>
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
              {password.length > 0 && (
                <div className="flex flex-col gap-1" aria-live="polite">
                  <div className="flex gap-1" aria-hidden>
                    {[1, 2, 3].map((n) => (
                      <div
                        key={n}
                        className={[
                          "h-1 flex-1 rounded-full transition-all",
                          n <= pwd.nivel
                            ? pwd.nivel === 1 ? "bg-danger" : pwd.nivel === 2 ? "bg-signal" : "bg-control"
                            : "bg-surface-elevated"
                        ].join(" ")}
                      />
                    ))}
                  </div>
                  {pwd.etiqueta && <span className="font-body text-xs leading-4 text-text-secondary">{pwd.etiqueta}</span>}
                </div>
              )}
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
