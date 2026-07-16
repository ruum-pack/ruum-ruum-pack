"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Aviso, Field } from "@ruum/ui";
import { VERSION_TERMINOS_VIGENTE } from "@ruum/shared/constants";
import { fortalezaPassword, traducirErrorAuth } from "@ruum/shared/utils";
import { registrarEventoUx } from "../../lib/analytics";
import { crearClienteNavegador, tieneSupabaseConfigurado } from "../../lib/supabase-browser";
import {
  botonAzul,
  botonContorno,
  CampoOscuro,
  LogoRuum,
  PantallaPublica,
} from "../experiencia-publica";

/* ─────────────────────────────────────────
   Helpers
───────────────────────────────────────── */
function soloDigitos(valor: string, maximo?: number) {
  const limpio = valor.replace(/\D/g, "");
  return maximo ? limpio.slice(0, maximo) : limpio;
}

function telefonoLocalMx(valor: string) {
  const limpio = soloDigitos(valor);
  const sinCodigoPais =
    limpio.length > 10 && limpio.startsWith("52") ? limpio.slice(2) : limpio;
  return sinCodigoPais.slice(0, 10);
}

function telefonoMx(diezDigitos: string) {
  const telefono = soloDigitos(diezDigitos, 10);
  return telefono ? `+52${telefono}` : "";
}

function nombreCompleto(nombre: string, apellido: string) {
  return [nombre.trim(), apellido.trim()].filter(Boolean).join(" ");
}

/* Barra de progreso visual */
function BarraProgreso({ paso }: { paso: 1 | 2 }) {
  return (
    <div className="mb-6 flex items-center gap-2">
      {[1, 2].map((n) => (
        <div key={n} className="flex flex-1 flex-col gap-1">
          <div
            className={[
              "h-1 rounded-full transition-all",
              n <= paso ? "bg-[#f5a623]" : "bg-[#4d5668]",
            ].join(" ")}
          />
          <span className="font-body text-xs text-[var(--ruum-dark-text-tertiary)]">
            {n === 1 ? "Datos básicos" : "Acceso"}
          </span>
        </div>
      ))}
    </div>
  );
}

/* ─────────────────────────────────────────
   Componente principal
───────────────────────────────────────── */
export default function PaginaRegistro() {
  const router = useRouter();

  /* Paso 1: datos básicos */
  const [tipoCuenta, setTipoCuenta] = useState<"personal" | "empresa">("personal");
  const [nombre, setNombre] = useState("");
  const [apellido, setApellido] = useState("");
  const [telefono, setTelefono] = useState("");

  /* Paso 2: credenciales */
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmarPassword, setConfirmarPassword] = useState("");
  const [aceptaTerminos, setAceptaTerminos] = useState(false);

  /* Estado de la UI */
  const [paso, setPaso] = useState<1 | 2>(1);
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const pwd = fortalezaPassword(password);

  useEffect(() => {
    registrarEventoUx("registro_visto", { paso: 1 });
  }, []);

  useEffect(() => {
    registrarEventoUx("registro_paso_visto", { paso });
  }, [paso]);

  /* ── Validación paso 1 ── */
  function validarPaso1(): string | null {
    if (!nombre.trim()) return "Escribe tu nombre.";
    if (!apellido.trim()) return "Escribe tu apellido.";
    const tel = soloDigitos(telefono);
    if (tel.length !== 10) return "El teléfono debe tener 10 dígitos.";
    return null;
  }

  /* ── Validación paso 2 ── */
  function validarPaso2(): string | null {
    if (!email.trim()) return "Escribe tu correo electrónico.";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
      return "El formato del correo no es válido.";
    if (password.length < 8) return "La contraseña debe tener al menos 8 caracteres.";
    if (password !== confirmarPassword) return "Las contraseñas no coinciden.";
    if (!aceptaTerminos) return "Acepta los términos para continuar.";
    return null;
  }

  function avanzarPaso2() {
    const err = validarPaso1();
    if (err) { setError(err); return; }
    setError(null);
    setPaso(2);
  }

  /* ── Crear cuenta ── */
  async function crearCuenta(e: React.FormEvent) {
    e.preventDefault();
    const err = validarPaso2();
    if (err) { setError(err); return; }

    setEnviando(true);
    setError(null);
    registrarEventoUx("registro_enviado", { tipo_cuenta: tipoCuenta });

    try {
      const cliente = crearClienteNavegador();

      /* tipo_registro='usuario' activa el trigger manejar_nuevo_usuario_auth.
         El mismo trigger persiste y audita la aceptación de términos, incluso
         cuando la confirmación de correo hace que signUp devuelva session=null. */
      const ahora = new Date().toISOString();
      const { data, error: errorAuth } = await cliente.auth.signUp({
        email: email.trim(),
        password,
        options: {
          data: {
            tipo_registro: "usuario",
            nombre: nombreCompleto(nombre, apellido),
            telefono: telefonoMx(telefono),
            tipo_cuenta: tipoCuenta,
            /* Términos: el trigger los registra si están presentes en los metadatos */
            version_terminos_aceptada: VERSION_TERMINOS_VIGENTE,
            terminos_aceptados_en: ahora,
          },
          emailRedirectTo: `${window.location.origin}/auth/callback?next=/onboarding?nuevo=1`,
        },
      });

      if (errorAuth) throw errorAuth;
      if (!data.user) throw new Error("No se pudo crear el usuario.");

      if (data.session) {
        registrarEventoUx("registro_exitoso", { tipo_cuenta: tipoCuenta, requiere_confirmacion: false });
        router.push("/onboarding?nuevo=1");
      } else {
        try {
          window.sessionStorage.setItem("ruum:correo-confirmacion", email.trim().toLowerCase());
        } catch { /* La pantalla también funciona si el navegador bloquea storage. */ }
        registrarEventoUx("registro_exitoso", { tipo_cuenta: tipoCuenta, requiere_confirmacion: true });
        // DESPUÉS
        const emailParam = encodeURIComponent(email.trim().toLowerCase());
        router.push(`/registro/confirma-correo?email=${emailParam}`);
      }
    } catch (err: unknown) {
      setError(traducirErrorAuth(err, "No pudimos crear la cuenta. Intenta de nuevo."));
      registrarEventoUx("registro_error", { tipo_cuenta: tipoCuenta });
    } finally {
      setEnviando(false);
    }
  }

  if (!tieneSupabaseConfigurado()) {
    return (
      <PantallaPublica>
        <section className="flex min-h-screen flex-col px-5 py-12 text-center">
          <LogoRuum className="mx-auto" />
          <h1 className="mt-16 font-display text-2xl font-extrabold">Crear cuenta</h1>
          <div className="mt-6">
            <Aviso tono="peligro">
              Supabase no está configurado. El registro no está disponible en este entorno.
            </Aviso>
          </div>
        </section>
      </PantallaPublica>
    );
  }

  return (
    <PantallaPublica>
      <section className="flex min-h-screen flex-col px-5 py-10">
        {/* Navegación superior */}
        <div className="flex items-center justify-between">
          {paso === 2 ? (
            <button
              type="button"
              onClick={() => { setError(null); setPaso(1); }}
              className="font-body text-xs text-[#f1d797] transition hover:text-white"
            >
              ← Atrás
            </button>
          ) : (
            <Link href="/" className="font-body text-xs text-[#f1d797] transition hover:text-white">
              ← Atrás
            </Link>
          )}
          <span className="font-body text-xs text-[var(--ruum-dark-text-tertiary)]">Paso {paso} de 2</span>
        </div>

        <LogoRuum className="mx-auto mt-8 text-center" />

        <div className="mt-10 rounded-[14px] border border-[#4d5668] bg-[#232a3a] px-5 py-7 shadow-[0_22px_70px_rgba(0,0,0,0.18)]">
          <BarraProgreso paso={paso} />

          {/* ════════════ PASO 1 ════════════ */}
          {paso === 1 && (
            <>
              <h1 className="font-display text-[22px] font-extrabold leading-tight text-white">
                Crea tu cuenta
              </h1>
              <p className="mt-2 font-body text-xs leading-5 text-[var(--ruum-dark-text-secondary)]">
                Solo necesitamos tus datos básicos para empezar.
              </p>

              {/* Tipo de cuenta */}
              <div className="mt-6 grid grid-cols-2 gap-2">
                {(["personal", "empresa"] as const).map((tipo) => (
                  <button
                    key={tipo}
                    type="button"
                    onClick={() => setTipoCuenta(tipo)}
                    className={[
                      "rounded-lg border py-2.5 font-body text-sm font-semibold transition",
                      tipoCuenta === tipo
                        ? "border-[#f5a623] bg-[#f5a623]/10 text-[#f5a623]"
                        : "border-[#4d5668] text-[var(--ruum-dark-text-tertiary)] hover:border-white/30 hover:text-white",
                    ].join(" ")}
                  >
                    {tipo === "personal" ? "Personal" : "Empresa"}
                  </button>
                ))}
              </div>

              <div className="mt-5 grid gap-4">
                <CampoOscuro
                  etiqueta="Nombre"
                  type="text"
                  value={nombre}
                  onChange={(e) => setNombre(e.target.value)}
                  required
                  autoComplete="given-name"
                  placeholder="Carlos"
                />
                <CampoOscuro
                  etiqueta="Apellido"
                  type="text"
                  value={apellido}
                  onChange={(e) => setApellido(e.target.value)}
                  required
                  autoComplete="family-name"
                  placeholder="Mendoza"
                />
                <CampoOscuro
                  etiqueta="Teléfono celular"
                  type="tel"
                  value={telefono}
                  onChange={(e) => setTelefono(telefonoLocalMx(e.target.value))}
                  required
                  autoComplete="tel"
                  placeholder="55 1234 5678"
                  ayuda="Para notificaciones de tu traslado. Sin código de país."
                  inputMode="numeric"
                />
              </div>

              {error && (
              <div role="status" aria-live="polite" aria-atomic="true" className="mt-4">
                <Aviso tono="peligro">{error}</Aviso>
              </div>
            )}

              <button type="button" onClick={avanzarPaso2} className={`${botonAzul} mt-6`}>
                Continuar
              </button>
            </>
          )}

          {/* ════════════ PASO 2 ════════════ */}
          {paso === 2 && (
            <form className="grid gap-4" onSubmit={crearCuenta}>
              <h1 className="font-display text-[22px] font-extrabold leading-tight text-white">
                Elige tus credenciales
              </h1>
              <p className="font-body text-xs leading-5 text-[var(--ruum-dark-text-secondary)]">
                Con esto accederás a tu cuenta y recibirás notificaciones de tus traslados.
              </p>

              <CampoOscuro
                etiqueta="Correo electrónico"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
                placeholder="correo@ejemplo.com"
              />

              <div className="flex flex-col gap-1.5">
                  <Field
                    etiqueta="Contraseña"
                    etiquetaClassName="!text-[#d4d9e2] !text-xs !font-medium"
                    type="password"
                    passwordToggleClassName="!text-white/60 hover:!bg-white/10 hover:!text-white focus-visible:!outline-[#f5a623]"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    autoComplete="new-password"
                    placeholder="Mínimo 8 caracteres"
                    className="!border-[#4d5668] !bg-[#151a25] !text-white placeholder:!text-[var(--ruum-dark-text-tertiary)] focus:!border-[#1e88e5] focus:!ring-[#1e88e5]/25"
                  />
                {password.length > 0 && (
                  <>
                    <div className="flex gap-1">
                      {[1, 2, 3].map((n) => (
                        <div
                          key={n}
                          className={[
                            "h-1 flex-1 rounded-full transition-all",
                            n <= pwd.nivel
                              ? pwd.nivel === 1
                                ? "bg-red-500"
                                : pwd.nivel === 2
                                ? "bg-[#f5a623]"
                                : "bg-green-500"
                              : "bg-[#4d5668]",
                          ].join(" ")}
                        />
                      ))}
                    </div>
                    {pwd.etiqueta && (
                      <span className="font-body text-xs leading-5 text-[var(--ruum-dark-text-tertiary)]">
                        {pwd.etiqueta}
                      </span>
                    )}
                  </>
                )}
              </div>

              <Field
                etiqueta="Confirmar contraseña"
                etiquetaClassName="!text-[#d4d9e2] !text-xs !font-medium"
                type="password"
                passwordToggleClassName="!text-white/60 hover:!bg-white/10 hover:!text-white focus-visible:!outline-[#f5a623]"
                value={confirmarPassword}
                onChange={(e) => setConfirmarPassword(e.target.value)}
                required
                autoComplete="new-password"
                placeholder="Repite tu contraseña"
                className="!border-[#4d5668] !bg-[#151a25] !text-white placeholder:!text-[var(--ruum-dark-text-tertiary)] focus:!border-[#1e88e5] focus:!ring-[#1e88e5]/25"
              />

              {/* Términos — inline, no como .docx descargable */}
              <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-[#4d5668] bg-[#1a2030] p-3.5">
                <input
                  type="checkbox"
                  checked={aceptaTerminos}
                  onChange={(e) => setAceptaTerminos(e.target.checked)}
                  className="mt-0.5 flex-shrink-0 accent-[#f5a623]"
                />
                <span className="font-body text-xs leading-5 text-[var(--ruum-dark-text-secondary)]">
                  Acepto los{" "}
                  <Link
                    href="/legal/terminos"
                    className="text-[#f5a623] underline-offset-2 hover:underline"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Términos y condiciones
                  </Link>{" "}
                  y el{" "}
                  <Link
                    href="/legal/privacidad"
                    className="text-[#f5a623] underline-offset-2 hover:underline"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Aviso de privacidad
                  </Link>{" "}
                  de Ruum Ruum.
                </span>
              </label>

              {error && (
              <div role="status" aria-live="polite" aria-atomic="true">
                <Aviso tono="peligro">{error}</Aviso>
              </div>
            )}

              <button type="submit" disabled={enviando} className={`${botonAzul} mt-1`}>
                {enviando ? "Creando cuenta…" : "Crear cuenta"}
              </button>
            </form>
          )}
        </div>

        {paso === 1 && (
          <Link href="/login" className={`${botonContorno} mt-4`}>
            Ya tengo cuenta — iniciar sesión
          </Link>
        )}
      </section>
    </PantallaPublica>
  );
}
