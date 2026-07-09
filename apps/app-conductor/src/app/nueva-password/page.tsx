"use client";

"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button, Aviso, LogoMarca } from "@ruum/ui";
import { fortalezaPassword } from "@ruum/shared/utils";
import { crearClienteNavegador, tieneSupabaseConfigurado } from "../../lib/supabase-browser";

export default function PaginaNuevaPasswordConductor() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirmar, setConfirmar] = useState("");
  const [mostrar, setMostrar] = useState(false);
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
    const { data: { subscription } } = cliente.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY" || event === "SIGNED_IN") setSesionLista(true);
      setVerificando(false);
    });
    const timeout = setTimeout(() => setVerificando(false), 3000);
    return () => { subscription.unsubscribe(); clearTimeout(timeout); };
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
      setError(err instanceof Error ? err.message : "No pudimos actualizar la contraseña.");
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
            <label className="flex flex-col gap-1.5">
              <span className="font-body text-sm font-medium text-ink/70">Nueva contraseña</span>
              <div className="relative">
                <input
                  type={mostrar ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required autoComplete="new-password" placeholder="Mínimo 8 caracteres"
                  className="w-full rounded-[var(--ruum-radius-field)] border border-ink/20 bg-mist px-4 py-3 pr-10 font-body text-sm text-ink focus:border-route-dark focus:outline-none focus:ring-2 focus:ring-route-dark/20"
                />
                <button type="button" onClick={() => setMostrar(v => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-ink/40 hover:text-ink/70"
                  aria-label={mostrar ? "Ocultar contraseña" : "Mostrar contraseña"}>
                  {mostrar ? "●" : "○"}
                </button>
              </div>
              {password.length > 0 && (
                <>
                  <div className="flex gap-1">
                    {[1, 2, 3].map(n => (
                      <div key={n} className={["h-1 flex-1 rounded-full transition-all",
                        n <= pwd.nivel
                          ? pwd.nivel === 1 ? "bg-red-500" : pwd.nivel === 2 ? "bg-[#f5a623]" : "bg-green-500"
                          : "bg-ink/10"].join(" ")} />
                    ))}
                  </div>
                  {pwd.etiqueta && <span className="font-body text-[11px] text-ink/45">{pwd.etiqueta}</span>}
                </>
              )}
            </label>

            <label className="flex flex-col gap-1.5">
              <span className="font-body text-sm font-medium text-ink/70">Confirmar contraseña</span>
              <input
                type={mostrar ? "text" : "password"}
                value={confirmar}
                onChange={(e) => setConfirmar(e.target.value)}
                required autoComplete="new-password" placeholder="Repite tu contraseña"
                className="w-full rounded-[var(--ruum-radius-field)] border border-ink/20 bg-mist px-4 py-3 font-body text-sm text-ink focus:border-route-dark focus:outline-none focus:ring-2 focus:ring-route-dark/20"
              />
            </label>

            {error && (
              <div role="status" aria-live="polite" aria-atomic="true">
                <Aviso tono="peligro">{error}</Aviso>
              </div>
            )}
            <Button type="submit" disabled={enviando} className="mt-2 w-full">
              {enviando ? "Guardando…" : "Guardar nueva contraseña"}
            </Button>
          </form>
        )}
      </section>
    </div>
  );
}
