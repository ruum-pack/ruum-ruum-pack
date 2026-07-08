"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Aviso } from "@ruum/ui";
import { fortalezaPassword } from "@ruum/shared/utils";
import { registrarAceptacionTerminos } from "@ruum/api/services";
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
          <span className="font-body text-[10px] text-white/40">
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
  const [mostrarPassword, setMostrarPassword] = useState(false);
  const [aceptaTerminos, setAceptaTerminos] = useState(false);

  /* Estado de la UI */
  const [paso, setPaso] = useState<1 | 2>(1);
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const pwd = fortalezaPassword(password);

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

    try {
      const cliente = crearClienteNavegador();

      /* FIX: tipo_registro='usuario' activa el trigger manejar_nuevo_usuario_auth
         que crea la fila en public.usuarios. Sin este campo, el trigger no inserta
         nada y el UPDATE posterior en registrarAceptacionTerminos no encuentra la fila. */
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
            version_terminos_aceptada: 1,
            terminos_aceptados_en: ahora,
          },
        },
      });

      if (errorAuth) throw errorAuth;
      if (!data.user) throw new Error("No se pudo crear el usuario.");

      /* registrarAceptacionTerminos(cliente, authUserId) — solo 2 argumentos.
         FIX: eliminado el 3er argumento (VERSION_TERMINOS_VIGENTE) que no existe
         en la firma de la función del paquete @ruum/api/services. */
      try {
        await registrarAceptacionTerminos(cliente, data.user.id);
      } catch {
        /* no bloqueante — el trigger ya lo registró */
      }

      router.push("/onboarding?nuevo=1");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Ocurrió un error. Intenta de nuevo.";
      setError(
        msg.includes("already registered") || msg.includes("User already registered")
          ? "Ya existe una cuenta con ese correo. ¿Quieres iniciar sesión?"
          : msg
      );
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
          <span className="font-body text-[10px] text-white/35">Paso {paso} de 2</span>
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
              <p className="mt-2 font-body text-xs leading-5 text-[#c9cfda]">
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
                        : "border-[#4d5668] text-white/50 hover:border-white/30 hover:text-white/70",
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
              <p className="font-body text-xs leading-5 text-[#c9cfda]">
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

              {/* Contraseña + toggle visibilidad */}
              <label className="flex flex-col gap-1.5">
                <span className="font-body text-xs font-medium text-[#d4d9e2]">Contraseña</span>
                <div className="relative">
                  <input
                    type={mostrarPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    autoComplete="new-password"
                    placeholder="Mínimo 8 caracteres"
                    className="w-full rounded-lg border border-[#4d5668] bg-[#151a25] px-3.5 py-2.5 pr-10 font-body text-sm text-white outline-none transition placeholder:text-white/40 focus:border-[#1e88e5] focus:ring-2 focus:ring-[#1e88e5]/25"
                  />
                  <button
                    type="button"
                    onClick={() => setMostrarPassword((v) => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-white/40 hover:text-white/70"
                    aria-label={mostrarPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
                  >
                    {mostrarPassword ? "●" : "○"}
                  </button>
                </div>
                {/* Indicador de fortaleza */}
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
                      <span className="font-body text-[11px] leading-4 text-white/42">
                        {pwd.etiqueta}
                      </span>
                    )}
                  </>
                )}
              </label>

              <CampoOscuro
                etiqueta="Confirmar contraseña"
                type={mostrarPassword ? "text" : "password"}
                value={confirmarPassword}
                onChange={(e) => setConfirmarPassword(e.target.value)}
                required
                autoComplete="new-password"
                placeholder="Repite tu contraseña"
              />

              {/* Términos — inline, no como .docx descargable */}
              <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-[#4d5668] bg-[#1a2030] p-3.5">
                <input
                  type="checkbox"
                  checked={aceptaTerminos}
                  onChange={(e) => setAceptaTerminos(e.target.checked)}
                  className="mt-0.5 flex-shrink-0 accent-[#f5a623]"
                />
                <span className="font-body text-[11px] leading-5 text-[#c9cfda]">
                  Acepto los{" "}
                  <Link
                    href="/legal/terminos"
                    className="text-[#f5a623] underline-offset-2 hover:underline"
                    target="_blank"
                  >
                    Términos y condiciones
                  </Link>{" "}
                  y el{" "}
                  <Link
                    href="/legal/privacidad"
                    className="text-[#f5a623] underline-offset-2 hover:underline"
                    target="_blank"
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
