"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Aviso } from "@ruum/ui";
import { VERSION_TERMINOS_VIGENTE } from "@ruum/shared/constants";
import { HORAS_HABILES_VERIFICACION_CUENTA_NUEVA } from "@ruum/shared/rules";
import { registrarAceptacionTerminos, subirDocumentoIdentidad } from "@ruum/api/services";
import { consultarCodigoPostalMx } from "../../lib/codigos-postales";
import { crearClienteNavegador, tieneSupabaseConfigurado } from "../../lib/supabase-browser";
import {
  botonAzul,
  botonContorno,
  campoOscuro,
  CampoOscuro,
  etiquetaOscura,
  IconoLinea,
  LogoRuum,
  PantallaPublica
} from "../experiencia-publica";

const TIPOS_ACEPTADOS = ["image/jpeg", "image/png", "image/heic", "application/pdf"];
const TAMANO_MAXIMO_MB = 10;

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
  const [paso, setPaso] = useState<1 | 2 | 3>(1);
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
  const [aceptaTerminos, setAceptaTerminos] = useState(false);
  const [documento, setDocumento] = useState<File | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [enviado, setEnviado] = useState(false);
  const [documentoEnviado, setDocumentoEnviado] = useState(false);
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
        setCpAviso("Selecciona ciudad/municipio y colonia.");
      } else if (!datosCp.ciudades.length || !datosCp.colonias.length) {
        setCpAviso("Captura manualmente los campos que falten.");
      }
    } catch {
      setCiudadesCp([]);
      setColoniasCp([]);
      setCpAviso("No encontramos ese CP. Captura los datos manualmente.");
    } finally {
      setCpConsultando(false);
    }
  }

  function seleccionarDocumento(e: React.ChangeEvent<HTMLInputElement>) {
    const archivo = e.target.files?.[0] ?? null;
    if (!archivo) return;

    if (!TIPOS_ACEPTADOS.includes(archivo.type)) {
      setError("Solo se aceptan imágenes JPG, PNG, HEIC o PDF.");
      setDocumento(null);
      return;
    }

    if (archivo.size > TAMANO_MAXIMO_MB * 1024 * 1024) {
      setError(`El archivo no puede superar ${TAMANO_MAXIMO_MB} MB.`);
      setDocumento(null);
      return;
    }

    setError(null);
    setDocumento(archivo);
  }

  function validarPasoUno() {
    if (!nombre.trim() || !apellido.trim()) return "Captura nombre y apellido.";
    if (telefono.length !== 10) return "El teléfono debe tener 10 dígitos; el prefijo +52 ya está aplicado.";
    if (!email.trim()) return "Captura tu correo electrónico.";
    if (password.length < 8) return "La contraseña debe tener mínimo 8 caracteres.";
    if (password !== confirmarPassword) return "La contraseña y la confirmación no coinciden.";
    return null;
  }

  function validarPasoDos() {
    if (
      codigoPostal.length !== 5 ||
      !estado.trim() ||
      !ciudad.trim() ||
      !colonia.trim() ||
      !calle.trim() ||
      !numero.trim()
    ) {
      return "Completa Código Postal, estado, ciudad, colonia, calle y número.";
    }
    return null;
  }

  function avanzar() {
    const validacion = paso === 1 ? validarPasoUno() : validarPasoDos();
    if (validacion) {
      setError(validacion);
      return;
    }

    setError(null);
    setPaso(paso === 1 ? 2 : 3);
  }

  async function crearCuenta(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const errorPasoUno = validarPasoUno();
    const errorPasoDos = validarPasoDos();
    if (errorPasoUno || errorPasoDos) {
      setError(errorPasoUno ?? errorPasoDos);
      setPaso(errorPasoUno ? 1 : 2);
      return;
    }

    if (!documento) {
      setError("Sube una identificación oficial para enviar tu cuenta a revisión.");
      return;
    }

    if (!aceptaTerminos) {
      setError("Debes aceptar los Términos y condiciones y el Aviso de privacidad para continuar.");
      return;
    }

    if (!tieneSupabaseConfigurado()) {
      setError("Supabase no está configurado. No se puede crear una cuenta real en este entorno.");
      return;
    }

    setEnviando(true);

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
        // Si falla, el trigger/metadata conserva la versión aceptada para soporte.
      }

      try {
        await subirDocumentoIdentidad(cliente, documento);
        setDocumentoEnviado(true);
      } catch {
        setDocumentoEnviado(false);
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
      <PantallaPublica>
        <section className="flex min-h-screen flex-col px-5 py-10 text-center">
          <LogoRuum className="mx-auto" />
          <div className="mx-auto mt-16">
            <IconoLinea tipo={documentoEnviado ? "escudo" : "documento"} />
          </div>
          <h1 className="mt-6 font-display text-[24px] font-extrabold leading-tight text-white">Cuenta en revisión</h1>
          <p className="mx-auto mt-3 max-w-[285px] font-body text-xs leading-5 text-[#9db2cf]">
            Verificamos cuentas nuevas en menos de {HORAS_HABILES_VERIFICACION_CUENTA_NUEVA} horas hábiles. Te
            avisaremos en cuanto esté lista.
          </p>
          <div className="mt-7 rounded-xl border border-[#223553] bg-[#0a1429] p-4 text-left">
            <p className="font-display text-sm font-bold text-white">
              {documentoEnviado ? "Identificación recibida" : "Identificación pendiente"}
            </p>
            <p className="mt-1 font-body text-xs leading-5 text-[#90a8c5]">
              {documentoEnviado
                ? "Tu documento fue cargado y queda ligado a esta solicitud."
                : "Si tu correo requiere confirmación, inicia sesión después y sube tu identificación desde verificación."}
            </p>
          </div>
          <button onClick={() => router.push(documentoEnviado ? "/login" : "/verificacion")} className={`${botonAzul} mt-7`}>
            {documentoEnviado ? "Ir a iniciar sesión" : "Subir identificación"}
          </button>
        </section>
      </PantallaPublica>
    );
  }

  return (
    <PantallaPublica>
      <section className="min-h-screen px-4 py-5">
        <button onClick={() => (paso === 1 ? router.push("/") : setPaso(paso === 2 ? 1 : 2))} className="font-body text-xs text-[#8fb9ef] transition hover:text-white">
          ← Atrás
        </button>

        <form onSubmit={crearCuenta} className="mx-auto mt-3 rounded-[14px] border border-[#223553] bg-[#0a1429] px-5 py-7 shadow-[0_22px_70px_rgba(0,0,0,0.18)]">
          <span className="inline-flex rounded-full bg-[#0d2d61] px-3 py-1 font-display text-[10px] font-bold text-[#1683ff]">
            Paso {paso} de 3
          </span>

          {paso === 1 && (
            <div className="mt-5">
              <h1 className="font-display text-[21px] font-extrabold leading-tight text-white">Crea tu cuenta</h1>
              <p className="mt-4 font-body text-xs leading-5 text-[#90a8c5]">
                Registra tus datos para gestionar tus traslados.
              </p>

              <div className="mt-5 grid gap-3">
                <div className="grid grid-cols-2 gap-2 rounded-lg border border-[#223553] bg-[#050b1a] p-1">
                  {(["personal", "empresa"] as const).map((opcion) => (
                    <button
                      key={opcion}
                      type="button"
                      onClick={() => setTipoCuenta(opcion)}
                      className={`rounded-md px-3 py-2 font-display text-xs font-bold capitalize transition ${
                        tipoCuenta === opcion ? "bg-[#1683ff] text-white" : "text-[#8fb9ef] hover:bg-[#1683ff]/10"
                      }`}
                    >
                      {opcion}
                    </button>
                  ))}
                </div>
                <CampoOscuro etiqueta="Nombre(s)" value={nombre} onChange={(e) => setNombre(e.target.value)} required autoComplete="given-name" placeholder="JUAN CARLOS" />
                <CampoOscuro etiqueta="Apellido(s)" value={apellido} onChange={(e) => setApellido(e.target.value)} required autoComplete="family-name" placeholder="GARCIA LOPEZ" />
                <label className="flex flex-col gap-1.5">
                  <span className={etiquetaOscura}>Teléfono</span>
                  <div className="flex overflow-hidden rounded-lg border border-[#223553] bg-[#050b1a] focus-within:border-[#1683ff] focus-within:ring-2 focus-within:ring-[#1683ff]/20">
                    <span className="flex items-center border-r border-[#223553] px-3 font-body text-sm font-semibold text-[#74a2d7]">
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
                      className="min-w-0 flex-1 bg-transparent px-3.5 py-2.5 font-body text-sm text-white outline-none placeholder:text-white/35"
                      placeholder="55 0000 0000"
                    />
                  </div>
                </label>
                <CampoOscuro etiqueta="Correo electrónico" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" placeholder="correo@ejemplo.com" />
                <CampoOscuro etiqueta="Contraseña" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={8} autoComplete="new-password" placeholder="Mínimo 8 caracteres" />
                <CampoOscuro etiqueta="Confirmar contraseña" type="password" value={confirmarPassword} onChange={(e) => setConfirmarPassword(e.target.value)} required minLength={8} autoComplete="new-password" placeholder="Repite tu contraseña" />
              </div>
            </div>
          )}

          {paso === 2 && (
            <div className="mt-5">
              <h1 className="font-display text-[21px] font-extrabold leading-tight text-white">¿Dónde vives?</h1>
              <p className="mt-4 font-body text-xs leading-5 text-[#90a8c5]">
                Estos datos ayudan a validar tu cuenta y agilizar futuros traslados.
              </p>

              <div className="mt-5 grid gap-3">
                <CampoOscuro
                  etiqueta="Código Postal"
                  value={codigoPostal}
                  onChange={(e) => void consultarCodigoPostal(e.target.value)}
                  onBlur={(e) => consultarCodigoPostal(e.target.value)}
                  inputMode="numeric"
                  maxLength={5}
                  required
                  ayuda={cpConsultando ? "Consultando CP..." : cpAviso}
                  placeholder="00000"
                />
                <CampoOscuro etiqueta="Estado" value={estado} onChange={(e) => setEstado(e.target.value)} required placeholder="Estado" />
                <label className="flex flex-col gap-1.5">
                  <span className={etiquetaOscura}>Ciudad o municipio</span>
                  {ciudadesCp.length > 0 ? (
                    <select value={ciudad} onChange={(e) => setCiudad(e.target.value)} required className={campoOscuro}>
                      {ciudadesCp.map((opcion) => (
                        <option key={opcion} value={opcion}>
                          {opcion}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <input value={ciudad} onChange={(e) => setCiudad(e.target.value)} required className={campoOscuro} />
                  )}
                </label>
                <label className="flex flex-col gap-1.5">
                  <span className={etiquetaOscura}>Colonia</span>
                  {coloniasCp.length > 0 ? (
                    <select value={colonia} onChange={(e) => setColonia(e.target.value)} required className={campoOscuro}>
                      {coloniasCp.map((opcion) => (
                        <option key={opcion} value={opcion}>
                          {opcion}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <input value={colonia} onChange={(e) => setColonia(e.target.value)} required className={campoOscuro} />
                  )}
                </label>
                <div className="grid grid-cols-[1fr_92px] gap-3">
                  <CampoOscuro etiqueta="Calle" value={calle} onChange={(e) => setCalle(e.target.value)} required placeholder="Calle" />
                  <CampoOscuro etiqueta="Número" value={numero} onChange={(e) => setNumero(e.target.value)} required placeholder="123" />
                </div>
                <CampoOscuro etiqueta="Referencias" value={referencias} onChange={(e) => setReferencias(e.target.value)} placeholder="Entre calles, fachada, acceso..." />
              </div>
            </div>
          )}

          {paso === 3 && (
            <div className="mt-5">
              <h1 className="font-display text-[21px] font-extrabold leading-tight text-white">Cuenta en revisión</h1>
              <p className="mt-4 font-body text-xs leading-5 text-[#90a8c5]">
                Sube tu identificación y acepta términos para enviar la solicitud.
              </p>

              <div className="mt-5 grid gap-4">
                <label className="flex cursor-pointer flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-[#2f4a72] bg-[#050b1a] px-4 py-7 text-center transition hover:border-[#1683ff] hover:bg-[#1683ff]/10">
                  <IconoLinea tipo="documento" />
                  <span className="font-display text-sm font-bold text-white">
                    {documento ? documento.name : "Subir identificación"}
                  </span>
                  <span className="font-body text-[11px] leading-4 text-[#90a8c5]">JPG, PNG, HEIC o PDF. Máx. 10 MB.</span>
                  <input type="file" accept={TIPOS_ACEPTADOS.join(",")} className="hidden" onChange={seleccionarDocumento} />
                </label>

                <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-[#223553] bg-[#050b1a] p-4">
                  <input
                    type="checkbox"
                    className="mt-0.5 size-5 rounded border-[#2f4a72] accent-[#1683ff]"
                    checked={aceptaTerminos}
                    onChange={(e) => setAceptaTerminos(e.target.checked)}
                    required
                  />
                  <span className="font-body text-xs leading-5 text-[#b8c9df]">
                    Acepto los{" "}
                    <a href="/soporte#terminos" target="_blank" className="font-semibold text-[#1683ff] hover:underline">
                      Términos y condiciones
                    </a>{" "}
                    y el{" "}
                    <a href="/soporte#privacidad" target="_blank" className="font-semibold text-[#1683ff] hover:underline">
                      Aviso de privacidad
                    </a>{" "}
                    de Ruum Ruum.
                  </span>
                </label>

                <div className="rounded-xl border border-[#223553] bg-[#071226] p-4">
                  <p className="font-display text-sm font-bold text-white">Revisión final</p>
                  <p className="mt-1 font-body text-xs leading-5 text-[#90a8c5]">
                    Revisaremos tu cuenta antes de habilitar solicitudes reales de traslado.
                  </p>
                </div>
              </div>
            </div>
          )}

          {error && (
            <div className="mt-4">
              <Aviso tono="peligro">{error}</Aviso>
            </div>
          )}

          {!tieneSupabaseConfigurado() && (
            <div className="mt-4">
              <Aviso tono="peligro">Supabase no está configurado. No es posible crear cuentas reales en este entorno.</Aviso>
            </div>
          )}

          <div className="mt-5 grid gap-3">
            {paso < 3 ? (
              <button type="button" onClick={avanzar} className={botonAzul}>
                Continuar →
              </button>
            ) : (
              <button type="submit" disabled={enviando || !aceptaTerminos || !documento} className={botonAzul}>
                {enviando ? "Enviando..." : "Enviar a revisión"}
              </button>
            )}
            <button type="button" onClick={() => router.push("/login")} className="font-body text-xs font-semibold text-[#1683ff] hover:underline">
              Ya tengo cuenta
            </button>
          </div>
        </form>
      </section>
    </PantallaPublica>
  );
}
