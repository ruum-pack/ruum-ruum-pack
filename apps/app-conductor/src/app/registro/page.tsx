"use client";

import { useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { Button, Field, Aviso, LogoMarca } from "@ruum/ui";
import { TEXTOS_CARGANDO } from "@ruum/shared/constants";
import { traducirErrorAuth } from "@ruum/shared/utils";
import { crearClienteNavegador, tieneSupabaseConfigurado } from "../../lib/supabase-browser";

function telefonoE164(valor: string) {
  const normalizado = valor.trim();
  if (!normalizado) return normalizado;
  return (normalizado.startsWith("+") ? normalizado : `+${normalizado}`).replace(/\s+/g, "");
}

export default function PaginaRegistroConductor() {
  const router = useRouter();
  const [nombre, setNombre] = useState("");
  const [apellidos, setApellidos] = useState("");
  const [telefono, setTelefono] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmacionPassword, setConfirmacionPassword] = useState("");
  const [erroresCampos, setErroresCampos] = useState({
    nombre: "",
    apellidos: "",
    telefono: "",
    password: "",
    confirmacionPassword: ""
  });
  const [enviando, setEnviando] = useState(false);
  const [enviado, setEnviado] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const tieneErroresActivos = Object.values(erroresCampos).some(Boolean);
  const formularioIncompleto = !nombre.trim() || !apellidos.trim() || !telefono.trim() || !email.trim() || !password || !confirmacionPassword;

  function validarNombre(valor = nombre) {
    const mensaje = valor.trim().length < 2 ? "Escribe tu nombre como aparece en tu identificación oficial" : "";
    setErroresCampos((prev) => ({ ...prev, nombre: mensaje }));
    return !mensaje;
  }

  function validarApellidos(valor = apellidos) {
    const mensaje = valor.trim().length < 2 ? "Escribe tus apellidos como aparecen en tu identificación oficial" : "";
    setErroresCampos((prev) => ({ ...prev, apellidos: mensaje }));
    return !mensaje;
  }

  function normalizarTelefono(valor: string) {
    return telefonoE164(valor);
  }

  function validarTelefono(valor = telefono) {
    const normalizado = normalizarTelefono(valor);
    if (normalizado !== telefono) {
      setTelefono(normalizado);
    }
    const mensaje = /^\+[1-9]\d{7,14}$/.test(normalizado.replace(/\s+/g, ""))
      ? ""
      : "Incluye el código de país, por ejemplo +52 55 0000 0000";
    setErroresCampos((prev) => ({ ...prev, telefono: mensaje }));
    return !mensaje;
  }

  function validarPassword(valor = password) {
    const mensaje = valor.length < 6 ? "Mínimo 6 caracteres" : "";
    setErroresCampos((prev) => ({ ...prev, password: mensaje }));
    return !mensaje;
  }

  function validarConfirmacion(valor = confirmacionPassword, base = password) {
    const mensaje = valor && valor !== base ? "Las contraseñas no coinciden" : "";
    setErroresCampos((prev) => ({ ...prev, confirmacionPassword: mensaje }));
    return !mensaje;
  }

  async function crearCuenta(e: React.FormEvent) {
    e.preventDefault();
    const nombreValido = validarNombre();
    const apellidosValidos = validarApellidos();
    const telefonoValido = validarTelefono();
    const passwordValida = validarPassword();
    const confirmacionValida = validarConfirmacion();
    if (!nombreValido || !apellidosValidos || !telefonoValido || !passwordValida || !confirmacionValida) return;
    if (!tieneSupabaseConfigurado()) {
      setError("Supabase no está configurado. El registro no está disponible en este entorno.");
      return;
    }

    setEnviando(true);
    setError(null);

    try {
      const cliente = crearClienteNavegador();
      const nombreLimpio = `${nombre} ${apellidos}`.trim().replace(/\s+/g, " ");
      const telefonoLimpio = telefonoE164(telefono);

      const { data: datosAuth, error: errorAuth } = await cliente.auth.signUp({
        email: email.trim().toLowerCase(),
        password,
        options: { data: { tipo_registro: "conductor", nombre: nombreLimpio, telefono: telefonoLimpio } }
      });
      if (errorAuth) throw errorAuth;
      if (!datosAuth.user) throw new Error("No se pudo crear la cuenta. Intenta de nuevo.");

      setEnviado(true);
    } catch (err) {
      setError(traducirErrorAuth(err));
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="conductor-auth-shell flex items-center justify-center px-4 py-10 sm:px-6">
      <section className="conductor-auth-card p-6 sm:p-8" aria-labelledby="titulo-registro-conductor">
        <div className="-mx-2 -mt-2 mb-6 overflow-hidden rounded-xl border border-route/20 bg-ink">
          <Image
            src="/imagenes/registro-conductor.png"
            alt="Vehículo con puntos de evidencia digital para la certificación de traslado"
            width={1222}
            height={1222}
            priority
            className="aspect-[16/9] w-full object-cover"
          />
        </div>

        <div className="flex items-center gap-3">
          <LogoMarca tamano={34} color="signal" />
          <div>
            <p className="font-display text-lg font-extrabold tracking-tight text-ink">
              ruum<span className="text-signal">ruum</span>
            </p>
            <p className="font-mono-ruum text-[10px] uppercase tracking-[0.14em] text-ink/50">Certificación CONCER</p>
          </div>
        </div>

        {enviado ? (
          <div className="py-8 text-center">
            <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-control-soft font-display text-xl font-bold text-control" aria-hidden>✓</div>
            <h1 id="titulo-registro-conductor" className="mt-5 font-display text-2xl font-bold">Solicitud en revisión</h1>
            <p className="mt-3 font-body text-sm leading-6 text-ink/65">
              Tu cuenta está pendiente de validación CONCER. Cuando la validación esté completa, podrás consultar y aceptar viajes.
            </p>
            <Button variant="secundario" className="mt-7" onClick={() => router.push("/login")}>Volver al acceso</Button>
          </div>
        ) : (
          <>
            <h1 id="titulo-registro-conductor" className="mt-8 font-display text-2xl font-bold text-ink">Solicitar certificación</h1>
            <p className="mt-2 font-body text-sm leading-6 text-ink/65">
              Crea tu cuenta para iniciar la validación como conductor certificado.
            </p>

            {!tieneSupabaseConfigurado() && (
              <div className="mt-5">
                <Aviso tono="peligro">Supabase no está configurado. El registro no está disponible en este entorno.</Aviso>
              </div>
            )}

            <form className="mt-7 grid gap-4" onSubmit={crearCuenta}>
              <Field
                etiqueta="Nombre (s)"
                value={nombre}
                onChange={(e) => {
                  setNombre(e.target.value);
                  if (erroresCampos.nombre) {
                    setErroresCampos((prev) => ({ ...prev, nombre: "" }));
                  }
                }}
                onBlur={() => validarNombre()}
                error={erroresCampos.nombre || undefined}
                required
                autoComplete="given-name"
              />
              <Field
                etiqueta="Apellido (s)"
                value={apellidos}
                onChange={(e) => {
                  setApellidos(e.target.value);
                  if (erroresCampos.apellidos) {
                    setErroresCampos((prev) => ({ ...prev, apellidos: "" }));
                  }
                }}
                onBlur={() => validarApellidos()}
                error={erroresCampos.apellidos || undefined}
                required
                autoComplete="family-name"
              />
              <Field
                etiqueta="Teléfono"
                ayuda="Incluye el código de país, por ejemplo +52."
                type="tel"
                value={telefono}
                onChange={(e) => {
                  setTelefono(e.target.value);
                  if (erroresCampos.telefono) {
                    setErroresCampos((prev) => ({ ...prev, telefono: "" }));
                  }
                }}
                onBlur={() => validarTelefono()}
                error={erroresCampos.telefono || undefined}
                required
                autoComplete="tel"
              />
              <Field
                etiqueta="Correo"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
              />
              <Field
                etiqueta="Contraseña"
                type="password"
                value={password}
                ayuda="Mínimo 6 caracteres"
                onChange={(e) => {
                  const valor = e.target.value;
                  setPassword(valor);
                  if (erroresCampos.password) {
                    setErroresCampos((prev) => ({ ...prev, password: "" }));
                  }
                  if (confirmacionPassword) {
                    validarConfirmacion(confirmacionPassword, valor);
                  }
                }}
                onBlur={() => validarPassword()}
                error={erroresCampos.password || undefined}
                required
                minLength={6}
                autoComplete="new-password"
              />
              <Field
                etiqueta="Confirmar contraseña"
                type="password"
                value={confirmacionPassword}
                onChange={(e) => {
                  const valor = e.target.value;
                  setConfirmacionPassword(valor);
                  validarConfirmacion(valor, password);
                }}
                error={erroresCampos.confirmacionPassword || undefined}
                required
                minLength={6}
                autoComplete="new-password"
              />

              {error && <Aviso tono="peligro">{error}</Aviso>}

              <Button
                type="submit"
                disabled={enviando || formularioIncompleto || tieneErroresActivos || !tieneSupabaseConfigurado()}
                className="mt-2 w-full"
              >
                {enviando ? TEXTOS_CARGANDO.enviando : "Solicitar certificación"}
              </Button>
            </form>

            <p className="mt-6 text-center font-body text-sm text-ink/60">
              ¿Ya tienes cuenta?{" "}
              <button type="button" onClick={() => router.push("/login")} className="font-semibold text-route-dark hover:underline">
                Inicia sesión
              </button>
            </p>
          </>
        )}
      </section>
    </div>
  );
}
