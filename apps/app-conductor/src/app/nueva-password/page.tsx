"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button, Field, Aviso, LogoMarca } from "@ruum/ui";
import { fortalezaPassword, traducirErrorAuth } from "@ruum/shared/utils";
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

    let activo = true;
    const cliente = crearClienteNavegador();

    // El código de recuperación ya se intercambió por una sesión en el
    // servidor (/auth/callback antes de llegar aquí), así que al montar este
    // cliente normalmente encontramos una sesión que YA EXISTÍA en las
    // cookies — @supabase/ssr dispara eso como "INITIAL_SESSION", no como
    // "PASSWORD_RECOVERY" ni "SIGNED_IN". Antes solo escuchábamos esos dos
    // eventos, así que un enlace perfectamente válido terminaba mostrando
    // "el enlace expiró". Verificamos la sesión directamente con
    // getUser() como fuente de verdad, sin depender de qué nombre de evento
    // haya disparado el SDK.
    async function verificarSesion() {
      try {
        const { data } = await cliente.auth.getUser();
        if (activo && data.user) setSesionLista(true);
      } finally {
        if (activo) setVerificando(false);
      }
    }
    void verificarSesion();

    // Respaldo: si el enlace se abrió y la sesión se establece un instante
    // después de montar (p. ej. justo llega el evento PASSWORD_RECOVERY),
    // lo capturamos también.
    const { data: { subscription } } = cliente.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY" || event === "SIGNED_IN" || event === "INITIAL_SESSION") {
        setSesionLista(true);
        setVerificando(false);
      }
    });

    const timeout = setTimeout(() => { if (activo) setVerificando(false); }, 3000);
    return () => { activo = false; subscription.unsubscribe(); clearTimeout(timeout); };
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
            <p className="font-display text-lg font-extrabold tracking-tight text-ink">
              ruum<span className="text-signal">ruum</span>
            </p>
            <p className="font-mono-ruum text-[10px] uppercase tracking-[0.14em] text-ink/50">Conductor</p>
          </div>
        </div>

        <h1 id="titulo-nueva-pwd" className="mt-8 font-display text-2xl font-bold text-ink">
          Nueva contraseña
        </h1>

        {verificando ? (
          <p className="mt-6 font-body text-sm text-ink/55">Verificando enlace…</p>
        ) : listo ? (
          <div className="mt-6 grid gap-3 text-center">
            <div className="mx-auto flex size-14 items-center justify-center rounded-full bg-[#e6f9f0]">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none"
                stroke="#1d9e75" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"
                aria-hidden="true"><path d="M20 6L9 17l-5-5" /></svg>
            </div>
            <p className="font-body text-sm text-ink/70">Contraseña actualizada. Redirigiendo…</p>
          </div>
        ) : !sesionLista ? (
          <div className="mt-6 grid gap-4">
            <Aviso tono="peligro">El enlace expiró o ya fue usado. Los enlaces son válidos por 60 minutos.</Aviso>
            <Link href="/recuperar-password" className="inline-flex min-h-11 w-full items-center justify-center rounded-xl bg-signal font-display text-sm font-bold text-ink transition hover:bg-signal/90">
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
                            : "bg-ink/15"
                        ].join(" ")}
                      />
                    ))}
                  </div>
                  {pwd.etiqueta && <span className="font-body text-[11px] leading-4 text-ink/55">{pwd.etiqueta}</span>}
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
              <div role="status" aria-live="polite" aria-atomic="true">
                <Aviso tono="peligro">{error}</Aviso>
              </div>
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
