"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Aviso, Field } from "@ruum/ui";
import { fortalezaPassword, observarSesionRecuperacion, passwordCumpleRequisitos, requisitosPassword, traducirErrorAuth } from "@ruum/shared/utils";
import { crearClienteNavegador, tieneSupabaseConfigurado } from "../../lib/supabase-browser";
import {
  botonAzul,
  LogoRuum,
  PantallaPublica,
} from "../experiencia-publica";

export default function PaginaNuevaPassword() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirmar, setConfirmar] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [listo, setListo] = useState(false);
  const [error, setError] = useState<string | null>(null);
  /* Supabase establece la sesión desde el hash del URL automáticamente
     al cargar el cliente. Verificamos que haya sesión activa. */
  const [sesionLista, setSesionLista] = useState(false);
  const [verificando, setVerificando] = useState(true);
  const montadoRef = useRef(true);
  const redireccionRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    montadoRef.current = true;
    return () => {
      montadoRef.current = false;
      if (redireccionRef.current) clearTimeout(redireccionRef.current);
    };
  }, []);

  useEffect(() => {
    if (!tieneSupabaseConfigurado()) {
      const timer = setTimeout(() => {
        if (montadoRef.current) setVerificando(false);
      }, 0);
      return () => clearTimeout(timer);
    }

    let activo = true;
    let cleanupObserver: (() => void) | null = null;

    async function verificarAutorizacion() {
      // PR-02 P0: Camino principal — verificación server-side (cookie httpOnly + sesión)
      // Sobrevive al callback server-side y no depende del evento efímero PASSWORD_RECOVERY.
      // Si el servidor confirma, autorizamos inmediatamente sin esperar 7s.
      try {
        const res = await fetch("/api/recovery/verify", { cache: "no-store", credentials: "same-origin" });
        const data = (await res.json().catch(() => ({}))) as { authorized?: boolean; autorizado?: boolean };
        const autorizadoServidor = Boolean(data.authorized ?? data.autorizado);
        if (autorizadoServidor && activo && montadoRef.current) {
          setSesionLista(true);
          setVerificando(false);
          return;
        }
      } catch {
        // fallback a observer
      }

      if (!activo || !montadoRef.current) return;

      // Fallback hash legacy: observar PASSWORD_RECOVERY por ventana corta (no 7s)
      // para compatibilidad con enlaces antiguos que usan fragmento #access_token
      const cliente = crearClienteNavegador();
      cleanupObserver = observarSesionRecuperacion(
        cliente.auth,
        ({ sesionLista: lista, verificando: enVerificacion }) => {
          if (!activo || !montadoRef.current) return;
          setSesionLista(lista);
          setVerificando(enVerificacion);
        },
        2500,
        { soloRecovery: true }
      );
    }

    void verificarAutorizacion();

    return () => {
      activo = false;
      if (cleanupObserver) cleanupObserver();
    };
  }, []);

  async function establecer(e: React.FormEvent) {
    e.preventDefault();
    /* BUGFIX: igual que en /registro, se alinea con el requisito real del
       servidor (minúscula + mayúscula + número), no solo longitud. */
    if (!passwordCumpleRequisitos(password)) { setError("La contraseña debe incluir minúscula, mayúscula y número."); return; }
    if (password !== confirmar) { setError("Las contraseñas no coinciden."); return; }

    setEnviando(true);
    setError(null);

    try {
      const cliente = crearClienteNavegador();
      const { error: errorAuth } = await cliente.auth.updateUser({ password });
      if (errorAuth) throw errorAuth;
      // PR-02 P0: invalidar contexto temporal de recovery para que no sea reutilizable
      try {
        await fetch("/api/recovery/clear", { method: "POST", cache: "no-store", credentials: "same-origin" });
      } catch {}
      if (!montadoRef.current) return;
      setListo(true);
      redireccionRef.current = setTimeout(() => {
        if (montadoRef.current) router.push("/");
      }, 2000);
    } catch (err) {
      if (montadoRef.current) setError(traducirErrorAuth(err, "No pudimos actualizar la contraseña. Intenta de nuevo."));
    } finally {
      if (montadoRef.current) setEnviando(false);
    }
  }

  const pwd = fortalezaPassword(password);

  return (
    <PantallaPublica>
      <section className="flex min-h-screen flex-col px-5 py-10">
        <Link href="/login" className="font-body text-xs text-[#f1d797] transition hover:text-white">
          ← Inicio de sesión
        </Link>

        <LogoRuum className="mx-auto mt-8 text-center" />

        <div className="mt-14 rounded-[14px] border border-[#4d5668] bg-[#232a3a] px-5 py-7 shadow-[0_22px_70px_rgba(0,0,0,0.18)]">
          {verificando ? (
            <p className="font-body text-sm text-[var(--ruum-dark-text-secondary)] text-center py-4">Verificando enlace…</p>
          ) : listo ? (
            <div className="grid gap-4 text-center">
              <div className="mx-auto flex size-14 items-center justify-center rounded-full bg-[#e6f9f0]">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none"
                  stroke="#1d9e75" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"
                  aria-hidden="true"><path d="M20 6L9 17l-5-5" /></svg>
              </div>
              <h1 className="font-display text-[22px] font-extrabold text-white">Contraseña actualizada</h1>
              <p className="font-body text-sm text-[var(--ruum-dark-text-secondary)]">
                Tu contraseña fue actualizada. Los cambios son inmediatos. Redirigiendo al inicio…
              </p>
            </div>
          ) : !sesionLista ? (
            <div className="grid gap-4">
              <h1 className="font-display text-[22px] font-extrabold text-white">Enlace inválido o expirado</h1>
              <p className="font-body text-sm leading-6 text-[var(--ruum-dark-text-secondary)]">
                El enlace de recuperación expiró o ya fue usado. Los enlaces son válidos por 60 minutos y solo se pueden usar una vez.
              </p>
              <Link href="/recuperar-password" className={botonAzul}>
                Solicitar un nuevo enlace
              </Link>
            </div>
          ) : (
            <>
              <h1 className="font-display text-[22px] font-extrabold leading-tight text-white">
                Nueva contraseña
              </h1>
              <p className="mt-2 font-body text-xs leading-5 text-[var(--ruum-dark-text-secondary)]">
                Elige una contraseña segura. Mínimo 8 caracteres.
              </p>

              <form className="mt-7 grid gap-4" onSubmit={establecer}>
                {/* Contraseña */}
                <div className="flex flex-col gap-1.5">
                  <Field
                    etiqueta="Nueva contraseña"
                    etiquetaClassName="!text-[#d4d9e2] !text-xs !font-medium"
                    type="password"
                    passwordToggleClassName="!text-white/60 hover:!bg-white/10 hover:!text-white focus-visible:!outline-[#f5a623]"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    minLength={8}
                    autoComplete="new-password"
                    placeholder="Mínimo 8 caracteres"
                    className="!border-[#4d5668] !bg-[#151a25] !text-white placeholder:!text-[var(--ruum-dark-text-tertiary)] focus:!border-[#1e88e5] focus:!ring-[#1e88e5]/25"
                  />
                  {password.length > 0 && (
                    <>
                      <div className="flex gap-1">
                        {[1, 2, 3].map(n => (
                          <div key={n} className={[
                            "h-1 flex-1 rounded-full transition-all",
                            n <= pwd.nivel
                              ? pwd.nivel === 1 ? "bg-red-500" : pwd.nivel === 2 ? "bg-[#f5a623]" : "bg-green-500"
                              : "bg-[#4d5668]",
                          ].join(" ")} />
                        ))}
                      </div>
                      {pwd.etiqueta && (
                        <span className="font-body text-xs text-[var(--ruum-dark-text-tertiary)]">{pwd.etiqueta}</span>
                      )}
                    </>
                  )}
                  <ul className="mt-1 flex flex-col gap-1 font-body text-xs leading-5" aria-label="Requisitos de contraseña">
                    {requisitosPassword(password).map((requisito) => {
                      const etiquetas: Record<string, string> = {
                        longitud: "Mínimo 8 caracteres",
                        minuscula: "Al menos una letra minúscula",
                        mayuscula: "Al menos una letra mayúscula",
                        numero: "Al menos un número",
                      };
                      return (
                        <li
                          key={requisito.clave}
                          className={requisito.cumplido ? "text-emerald-400" : "text-[var(--ruum-dark-text-tertiary)]"}
                        >
                          {requisito.cumplido ? "✓" : "○"} {etiquetas[requisito.clave]}
                        </li>
                      );
                    })}
                  </ul>
                </div>

                <Field
                  etiqueta="Confirmar nueva contraseña"
                  etiquetaClassName="!text-[#d4d9e2] !text-xs !font-medium"
                  type="password"
                  passwordToggleClassName="!text-white/60 hover:!bg-white/10 hover:!text-white focus-visible:!outline-[#f5a623]"
                  value={confirmar}
                  onChange={(e) => setConfirmar(e.target.value)}
                  required
                  autoComplete="new-password"
                  placeholder="Repite tu contraseña"
                  className="!border-[#4d5668] !bg-[#151a25] !text-white placeholder:!text-[var(--ruum-dark-text-tertiary)] focus:!border-[#1e88e5] focus:!ring-[#1e88e5]/25"
                />

                {error && (
                  <div aria-live="polite" aria-atomic="true">
                    <Aviso tono="danger">{error}</Aviso>
                  </div>
                )}

                <button type="submit" disabled={enviando} className={`${botonAzul} mt-2`}>
                  {enviando ? "Guardando…" : "Guardar nueva contraseña"}
                </button>
              </form>
            </>
          )}
        </div>
      </section>
    </PantallaPublica>
  );
}
