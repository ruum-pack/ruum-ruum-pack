"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Field, Aviso } from "@ruum/ui";
import { VERSION_TERMINOS_VIGENTE } from "@ruum/shared/constants";
import { HORAS_HABILES_VERIFICACION_CUENTA_NUEVA } from "@ruum/shared/rules";
import { registrarAceptacionTerminos } from "@ruum/api/services";
import { consultarCodigoPostalMx } from "../../lib/codigos-postales";
import { crearClienteNavegador, tieneSupabaseConfigurado } from "../../lib/supabase-browser";

function soloDigitos(valor: string, maximo?: number) {
  const limpio = valor.replace(/\D/g, "");
  return maximo ? limpio.slice(0, maximo) : limpio;
}

function telefonoLocalMx(valor: string) {
  const limpio = soloDigitos(valor);
  const sinCodigoPais = limpio.length > 10 && limpio.startsWith("52") ? limpio.slice(2) : limpio;
  return sinCodigoPais.slice(0, 10);
}

function telefonoMx(diezDigitos: string) {
  const telefono = soloDigitos(diezDigitos, 10);
  return telefono ? `+52${telefono}` : "";
}

function nombreCompleto(nombre: string, apellido: string) {
  return [nombre.trim(), apellido.trim()].filter(Boolean).join(" ");
}

function domicilioCompleto({
  calle,
  numero,
  colonia,
  codigoPostal,
  ciudad,
  estado,
  referencias
}: {
  calle: string;
  numero: string;
  colonia: string;
  codigoPostal: string;
  ciudad: string;
  estado: string;
  referencias: string;
}) {
  return [
    [calle.trim(), numero.trim()].filter(Boolean).join(" "),
    colonia.trim() ? `Col. ${colonia.trim()}` : "",
    codigoPostal.trim() ? `CP ${codigoPostal.trim()}` : "",
    ciudad.trim(),
    estado.trim(),
    referencias.trim() ? `Ref. ${referencias.trim()}` : ""
  ]
    .filter(Boolean)
    .join(", ");
}

export default function PaginaRegistro() {
  const router = useRouter();
  const [tipoCuenta, setTipoCuenta] = useState<"personal" | "empresa">("personal");
  const [nombre, setNombre] = useState("");
  const [apellido, setApellido] = useState("");
  const [telefono, setTelefono] = useState("");
  const [codigoPostal, setCodigoPostal] = useState("");
  const [estado, setEstado] = useState("");
  const [ciudad, setCiudad] = useState("");
  const [colonia, setColonia] = useState("");
  const [calle, setCalle] = useState("");
  const [numero, setNumero] = useState("");
  const [referencias, setReferencias] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmarPassword, setConfirmarPassword] = useState("");
  const [mostrarPassword, setMostrarPassword] = useState(false);
  const [aceptaTerminos, setAceptaTerminos] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [enviado, setEnviado] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cpConsultando, setCpConsultando] = useState(false);
  const [cpAviso, setCpAviso] = useState<string | null>(null);
  const [ciudadesCp, setCiudadesCp] = useState<string[]>([]);
  const [coloniasCp, setColoniasCp] = useState<string[]>([]);

  async function consultarCodigoPostal(valor: string) {
    const cp = soloDigitos(valor, 5);
    setCodigoPostal(cp);

    if (cp.length !== 5) {
      setCpAviso(null);
      setCiudadesCp([]);
      setColoniasCp([]);
      return;
    }

    setCpConsultando(true);
    setCpAviso(null);

    try {
      const datosCp = await consultarCodigoPostalMx(cp);
      if (!datosCp) throw new Error("CP no encontrado");

      setEstado(datosCp.estado);
      setCiudadesCp(datosCp.ciudades);
      setColoniasCp(datosCp.colonias);
      setCiudad(datosCp.ciudades[0] ?? "");
      setColonia(datosCp.colonias[0] ?? "");
      if (datosCp.ciudades.length > 1 || datosCp.colonias.length > 1) {
        setCpAviso("Selecciona la ciudad o municipio y la colonia que correspondan al CP.");
      } else if (!datosCp.ciudades.length || !datosCp.colonias.length) {
        setCpAviso("Captura manualmente los campos que no se prellenaron con el CP.");
      }
    } catch {
      setCiudadesCp([]);
      setColoniasCp([]);
      setCpAviso("No pudimos encontrar ese CP. Captura estado, ciudad y colonia manualmente.");
    } finally {
      setCpConsultando(false);
    }
  }

  async function crearCuenta(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!nombre.trim() || !apellido.trim()) {
      setError("Captura nombre y apellido.");
      return;
    }

    if (telefono.length !== 10) {
      setError("El teléfono debe tener 10 dígitos; el prefijo +52 ya está aplicado.");
      return;
    }

    if (
      codigoPostal.length !== 5 ||
      !estado.trim() ||
      !ciudad.trim() ||
      !colonia.trim() ||
      !calle.trim() ||
      !numero.trim()
    ) {
      setError("Completa Código Postal, estado, ciudad, colonia, calle y número.");
      return;
    }

    if (password !== confirmarPassword) {
      setError("La contraseña y la confirmación no coinciden.");
      return;
    }

    if (!aceptaTerminos) {
      setError("Debes aceptar los Términos y condiciones y el Aviso de privacidad para continuar.");
      return;
    }

    setEnviando(true);

    if (!tieneSupabaseConfigurado()) {
      setError("Supabase no está configurado. No se puede crear una cuenta real en este entorno.");
      setEnviando(false);
      return;
    }

    try {
      const cliente = crearClienteNavegador();
      const terminosAceptadosEn = new Date().toISOString();
      const nombreFinal = nombreCompleto(nombre, apellido);
      const telefonoFinal = telefonoMx(telefono);
      const direccionPrincipal = domicilioCompleto({
        calle,
        numero,
        colonia,
        codigoPostal,
        ciudad,
        estado,
        referencias
      });
      const { data: datosAuth, error: errorAuth } = await cliente.auth.signUp({
        email,
        password,
        options: {
          data: {
            tipo_registro: "usuario",
            nombre: nombreFinal,
            apellido,
            telefono: telefonoFinal,
            tipo_cuenta: tipoCuenta,
            pais: "México",
            estado,
            ciudad,
            colonia,
            calle,
            numero,
            codigo_postal: codigoPostal,
            referencias,
            direccion_principal: direccionPrincipal,
            version_terminos_aceptada: VERSION_TERMINOS_VIGENTE,
            terminos_aceptados_en: terminosAceptadosEn
          }
        }
      });

      if (errorAuth) throw errorAuth;
      if (!datosAuth.user) throw new Error("No se pudo crear la cuenta. Intenta de nuevo.");

      try {
        await registrarAceptacionTerminos(cliente, datosAuth.user.id);
      } catch {
        // La cuenta ya existe; si este update falla se puede corregir desde soporte/admin.
      }

      setEnviado(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No pudimos crear tu cuenta. Intenta de nuevo.");
    } finally {
      setEnviando(false);
    }
  }

  if (enviado) {
    return (
      <main className="mx-auto max-w-md px-6 py-20 text-center">
        <h1 className="font-display text-2xl font-semibold">Cuenta en revisión</h1>
        <p className="mt-3 font-body text-sm text-ink/60">
          Verificamos cuentas nuevas en menos de {HORAS_HABILES_VERIFICACION_CUENTA_NUEVA} horas hábiles. Te
          avisaremos en cuanto esté lista.
        </p>
        <div className="mt-6">
          <Button onClick={() => router.push("/verificacion")}>Subir identificación</Button>
        </div>
        {tieneSupabaseConfigurado() && (
          <p className="mt-4 font-body text-xs text-ink/45">
            Si tu proyecto de Supabase exige confirmar el correo, revisa tu bandeja antes de iniciar sesión.
          </p>
        )}
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-2xl px-6 py-12">
      <h1 className="font-display text-2xl font-semibold">Crear cuenta</h1>
      <p className="mt-2 font-body text-sm text-ink/60">
        Una cuenta verificada te permite solicitar traslados y, con historial, pagar al cierre en vez de por
        adelantado.
      </p>

      {!tieneSupabaseConfigurado() && (
        <div className="mt-4">
          <Aviso tono="peligro">Supabase no está configurado. No es posible crear cuentas reales en este entorno.</Aviso>
        </div>
      )}

      <form className="mt-8 grid gap-4" onSubmit={crearCuenta}>
        <fieldset className="flex gap-4 font-body text-sm">
          <label className="flex items-center gap-2">
            <input
              type="radio"
              name="tipo_cuenta"
              checked={tipoCuenta === "personal"}
              onChange={() => setTipoCuenta("personal")}
            />
            Personal
          </label>
          <label className="flex items-center gap-2">
            <input
              type="radio"
              name="tipo_cuenta"
              checked={tipoCuenta === "empresa"}
              onChange={() => setTipoCuenta("empresa")}
            />
            Empresa
          </label>
        </fieldset>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field etiqueta="Nombre" value={nombre} onChange={(e) => setNombre(e.target.value)} required autoComplete="given-name" />
          <Field etiqueta="Apellido" value={apellido} onChange={(e) => setApellido(e.target.value)} required autoComplete="family-name" />
        </div>
        <label className="flex flex-col gap-1.5">
          <span className="font-body text-sm font-medium">Teléfono</span>
          <div className="flex overflow-hidden rounded-lg border border-ink/50 bg-mist">
            <span className="flex items-center border-r border-ink/10 px-3.5 font-body text-sm font-semibold text-ink/70">
              +52
            </span>
            <input
              type="tel"
              value={telefono}
              onChange={(e) => setTelefono(telefonoLocalMx(e.target.value))}
              inputMode="numeric"
              maxLength={10}
              required
              autoComplete="tel-national"
              className="min-w-0 flex-1 bg-transparent px-3.5 py-2.5 font-body text-sm text-ink placeholder:text-ink/65 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-route"
              placeholder="10 dígitos"
            />
          </div>
        </label>

        <div className="grid gap-4 rounded-lg border border-ink/10 p-4">
          <p className="font-body text-sm font-semibold">Domicilio</p>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field
              etiqueta="Código Postal"
              value={codigoPostal}
              onChange={(e) => void consultarCodigoPostal(e.target.value)}
              onBlur={(e) => consultarCodigoPostal(e.target.value)}
              inputMode="numeric"
              maxLength={5}
              required
              ayuda={cpConsultando ? "Consultando CP..." : cpAviso}
            />
            <Field etiqueta="Estado" value={estado} onChange={(e) => setEstado(e.target.value)} required />
            <label className="flex flex-col gap-1.5">
              <span className="font-body text-sm font-medium">Ciudad o municipio</span>
              {ciudadesCp.length > 0 ? (
                <select
                  value={ciudad}
                  onChange={(e) => setCiudad(e.target.value)}
                  required
                  className="w-full rounded-lg border border-ink/50 bg-mist px-3.5 py-2.5 font-body text-sm text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-route"
                >
                  {ciudadesCp.map((opcion) => (
                    <option key={opcion} value={opcion}>
                      {opcion}
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  value={ciudad}
                  onChange={(e) => setCiudad(e.target.value)}
                  required
                  className="w-full rounded-lg border border-ink/50 bg-mist px-3.5 py-2.5 font-body text-sm text-ink placeholder:text-ink/65 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-route"
                />
              )}
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="font-body text-sm font-medium">Colonia</span>
              {coloniasCp.length > 0 ? (
                <select
                  value={colonia}
                  onChange={(e) => setColonia(e.target.value)}
                  required
                  className="w-full rounded-lg border border-ink/50 bg-mist px-3.5 py-2.5 font-body text-sm text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-route"
                >
                  {coloniasCp.map((opcion) => (
                    <option key={opcion} value={opcion}>
                      {opcion}
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  value={colonia}
                  onChange={(e) => setColonia(e.target.value)}
                  required
                  className="w-full rounded-lg border border-ink/50 bg-mist px-3.5 py-2.5 font-body text-sm text-ink placeholder:text-ink/65 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-route"
                />
              )}
            </label>
            <Field etiqueta="Calle" value={calle} onChange={(e) => setCalle(e.target.value)} required />
            <Field etiqueta="Número" value={numero} onChange={(e) => setNumero(e.target.value)} required />
          </div>
          <Field
            etiqueta="Referencias"
            value={referencias}
            onChange={(e) => setReferencias(e.target.value)}
            placeholder="Entre calles, color de fachada, acceso, piso, etc."
          />
        </div>

        <Field etiqueta="Correo" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" />
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="flex flex-col gap-1.5">
            <span className="font-body text-sm font-medium">Contraseña</span>
            <div className="flex overflow-hidden rounded-lg border border-ink/50 bg-mist">
              <input
                type={mostrarPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
                autoComplete="new-password"
                className="min-w-0 flex-1 bg-transparent px-3.5 py-2.5 font-body text-sm text-ink placeholder:text-ink/65 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-route"
              />
            </div>
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="font-body text-sm font-medium">Confirmar contraseña</span>
            <div className="flex overflow-hidden rounded-lg border border-ink/50 bg-mist">
              <input
                type={mostrarPassword ? "text" : "password"}
                value={confirmarPassword}
                onChange={(e) => setConfirmarPassword(e.target.value)}
                required
                minLength={6}
                autoComplete="new-password"
                className="min-w-0 flex-1 bg-transparent px-3.5 py-2.5 font-body text-sm text-ink placeholder:text-ink/65 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-route"
              />
            </div>
          </label>
        </div>
        <label className="flex items-center gap-2 font-body text-sm text-ink/65">
          <input
            type="checkbox"
            checked={mostrarPassword}
            onChange={(e) => setMostrarPassword(e.target.checked)}
            className="size-5 rounded border-ink/50 accent-signal"
          />
          Mostrar contraseña
        </label>

        <div className="mt-2 rounded-xl border border-ink/10 bg-mist p-4">
          <label className="flex cursor-pointer items-start gap-3">
            <input
              type="checkbox"
              className="mt-0.5 h-5 w-5 rounded border-ink/50 accent-signal"
              checked={aceptaTerminos}
              onChange={(e) => setAceptaTerminos(e.target.checked)}
              required
            />
            <span className="font-body text-sm leading-snug text-ink/70">
              He leído y acepto los{" "}
              <a href="/soporte#terminos" target="_blank" className="font-medium text-route underline-offset-2 hover:underline">
                Términos y condiciones
              </a>{" "}
              y el{" "}
              <a href="/soporte#privacidad" target="_blank" className="font-medium text-route underline-offset-2 hover:underline">
                Aviso de privacidad
              </a>{" "}
              de Ruum Ruum.
            </span>
          </label>
        </div>

        {error && <Aviso tono="peligro">{error}</Aviso>}
        <Aviso tono="info">Después de crear tu cuenta te pediremos un documento de identidad para verificarla.</Aviso>

        <Button type="submit" disabled={enviando || !aceptaTerminos} className="mt-2">
          {enviando ? "Creando…" : "Crear cuenta"}
        </Button>
      </form>

      <p className="mt-6 text-center font-body text-sm text-ink/55">
        ¿Ya tienes cuenta?{" "}
        <button onClick={() => router.push("/login")} className="font-medium text-route hover:underline">
          Inicia sesión
        </button>
      </p>
    </main>
  );
}
