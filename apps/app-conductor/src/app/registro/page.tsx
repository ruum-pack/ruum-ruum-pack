"use client";

import { useMemo, useState } from "react";
import type { ChangeEvent, FormEvent } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { Button, Field, Aviso, LogoMarca } from "@ruum/ui";
import { TEXTOS_CARGANDO } from "@ruum/shared/constants";
import { traducirErrorAuth } from "@ruum/shared/utils";
import { obtenerConductorActual, registrarDocumentoConductor } from "@ruum/api/services";
import { crearClienteNavegador, tieneSupabaseConfigurado } from "../../lib/supabase-browser";

const PASOS = [
  "Vamos a conocerte",
  "¿Dónde vives?",
  "Tus documentos",
  "Verificación",
  "Revisa tu información"
];

const TIPOS_DOCUMENTO = {
  licenciaFrente: "licencia_frente",
  licenciaReverso: "licencia_reverso",
  identificacionOficial: "identificacion_oficial"
} as const;

type DocumentoKey = keyof typeof TIPOS_DOCUMENTO;

function telefonoE164(valor: string) {
  const normalizado = valor.trim();
  if (!normalizado) return normalizado;
  return (normalizado.startsWith("+") ? normalizado : `+${normalizado}`).replace(/\s+/g, "");
}

function limpiarTexto(valor: string) {
  return valor.trim().replace(/\s+/g, " ");
}

function nombreArchivoSeguro(nombre: string) {
  return nombre.replace(/[^a-zA-Z0-9_.-]/g, "_");
}

function esperar(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export default function PaginaRegistroConductor() {
  const router = useRouter();
  const [paso, setPaso] = useState(0);
  const [nombre, setNombre] = useState("");
  const [apellidos, setApellidos] = useState("");
  const [curp, setCurp] = useState("");
  const [telefono, setTelefono] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmacionPassword, setConfirmacionPassword] = useState("");
  const [codigoPostal, setCodigoPostal] = useState("");
  const [estado, setEstado] = useState("");
  const [ciudad, setCiudad] = useState("");
  const [colonia, setColonia] = useState("");
  const [calle, setCalle] = useState("");
  const [numero, setNumero] = useState("");
  const [referencias, setReferencias] = useState("");
  const [numeroLicencia, setNumeroLicencia] = useState("");
  const [tipoLicencia, setTipoLicencia] = useState("");
  const [vigenciaLicencia, setVigenciaLicencia] = useState("");
  const [documentos, setDocumentos] = useState<Record<DocumentoKey, File | null>>({
    licenciaFrente: null,
    licenciaReverso: null,
    identificacionOficial: null
  });
  const [autorizaVerificacion, setAutorizaVerificacion] = useState(false);
  const [declaraSinSuspensiones, setDeclaraSinSuspensiones] = useState(false);
  const [contactoEmergenciaNombre, setContactoEmergenciaNombre] = useState("");
  const [contactoEmergenciaTelefono, setContactoEmergenciaTelefono] = useState("");
  const [aceptaLegales, setAceptaLegales] = useState(false);
  const [erroresCampos, setErroresCampos] = useState<Record<string, string>>({});
  const [enviando, setEnviando] = useState(false);
  const [enviado, setEnviado] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [advertenciaDocumentos, setAdvertenciaDocumentos] = useState<string | null>(null);

  const nombreCompleto = useMemo(() => limpiarTexto(`${nombre} ${apellidos}`), [nombre, apellidos]);
  const tieneErroresActivos = Object.values(erroresCampos).some(Boolean);
  const puedeEnviar = !enviando && !tieneErroresActivos && aceptaLegales && formularioCompleto();

  function setCampoError(campo: string, mensaje: string) {
    setErroresCampos((prev) => ({ ...prev, [campo]: mensaje }));
    return !mensaje;
  }

  function limpiarErrorCampo(campo: string) {
    if (erroresCampos[campo]) setErroresCampos((prev) => ({ ...prev, [campo]: "" }));
  }

  function validarTexto(campo: string, valor: string, mensaje: string, min = 2) {
    return setCampoError(campo, limpiarTexto(valor).length < min ? mensaje : "");
  }

  function validarCurp(valor = curp) {
    return setCampoError("curp", /^[A-Z]{4}\d{6}[HM][A-Z]{5}[A-Z0-9]\d$/i.test(valor.trim()) ? "" : "Escribe una CURP válida de 18 caracteres");
  }

  function validarTelefono(campo: string, valor: string, setter: (valor: string) => void) {
    const normalizado = telefonoE164(valor);
    if (normalizado !== valor) setter(normalizado);
    return setCampoError(
      campo,
      /^\+[1-9]\d{7,14}$/.test(normalizado) ? "" : "Incluye el código de país, por ejemplo +52 55 0000 0000"
    );
  }

  function validarPassword(valor = password) {
    return setCampoError("password", valor.length < 6 ? "Mínimo 6 caracteres" : "");
  }

  function validarConfirmacion(valor = confirmacionPassword, base = password) {
    return setCampoError("confirmacionPassword", valor && valor !== base ? "Las contraseñas no coinciden" : "");
  }

  function validarDocumento(campo: DocumentoKey) {
    return setCampoError(campo, documentos[campo] ? "" : "Carga este documento");
  }

  function validarPaso(indice = paso) {
    if (indice === 0) {
      return [
        validarTexto("nombre", nombre, "Escribe tu nombre como aparece en tu identificación oficial"),
        validarTexto("apellidos", apellidos, "Escribe tus apellidos como aparecen en tu identificación oficial"),
        validarCurp(),
        validarTelefono("telefono", telefono, setTelefono),
        setCampoError("email", /^\S+@\S+\.\S+$/.test(email.trim()) ? "" : "Escribe un correo electrónico válido"),
        validarPassword(),
        validarConfirmacion()
      ].every(Boolean);
    }
    if (indice === 1) {
      return [
        validarTexto("codigoPostal", codigoPostal, "Escribe tu código postal", 5),
        validarTexto("estado", estado, "Escribe tu estado"),
        validarTexto("ciudad", ciudad, "Escribe tu ciudad o municipio"),
        validarTexto("colonia", colonia, "Escribe tu colonia"),
        validarTexto("calle", calle, "Escribe tu calle"),
        validarTexto("numero", numero, "Escribe el número de tu domicilio", 1),
        validarTexto("referencias", referencias, "Agrega una referencia breve")
      ].every(Boolean);
    }
    if (indice === 2) {
      return [
        validarTexto("numeroLicencia", numeroLicencia, "Escribe tu número de licencia"),
        validarTexto("tipoLicencia", tipoLicencia, "Selecciona o escribe el tipo de licencia"),
        setCampoError("vigenciaLicencia", vigenciaLicencia ? "" : "Indica la vigencia de tu licencia"),
        validarDocumento("licenciaFrente"),
        validarDocumento("licenciaReverso"),
        validarDocumento("identificacionOficial")
      ].every(Boolean);
    }
    if (indice === 3) {
      return [
        setCampoError("autorizaVerificacion", autorizaVerificacion ? "" : "Debes autorizar la verificación de antecedentes"),
        setCampoError("declaraSinSuspensiones", declaraSinSuspensiones ? "" : "Debes confirmar esta declaración"),
        validarTexto("contactoEmergenciaNombre", contactoEmergenciaNombre, "Escribe el nombre del contacto"),
        validarTelefono("contactoEmergenciaTelefono", contactoEmergenciaTelefono, setContactoEmergenciaTelefono)
      ].every(Boolean);
    }
    return setCampoError("aceptaLegales", aceptaLegales ? "" : "Debes aceptar los términos y el aviso de privacidad");
  }

  function formularioCompleto() {
    return Boolean(
      nombre.trim() &&
        apellidos.trim() &&
        curp.trim() &&
        telefono.trim() &&
        email.trim() &&
        password &&
        confirmacionPassword &&
        codigoPostal.trim() &&
        estado.trim() &&
        ciudad.trim() &&
        colonia.trim() &&
        calle.trim() &&
        numero.trim() &&
        referencias.trim() &&
        numeroLicencia.trim() &&
        tipoLicencia.trim() &&
        vigenciaLicencia &&
        documentos.licenciaFrente &&
        documentos.licenciaReverso &&
        documentos.identificacionOficial &&
        autorizaVerificacion &&
        declaraSinSuspensiones &&
        contactoEmergenciaNombre.trim() &&
        contactoEmergenciaTelefono.trim()
    );
  }

  function avanzar() {
    setError(null);
    if (validarPaso()) setPaso((actual) => Math.min(actual + 1, PASOS.length - 1));
  }

  function volver() {
    setError(null);
    setPaso((actual) => Math.max(actual - 1, 0));
  }

  function cambiarDocumento(campo: DocumentoKey, evento: ChangeEvent<HTMLInputElement>) {
    const archivo = evento.target.files?.[0] ?? null;
    setDocumentos((prev) => ({ ...prev, [campo]: archivo }));
    if (archivo) limpiarErrorCampo(campo);
  }

  async function obtenerConductorConReintento(cliente: ReturnType<typeof crearClienteNavegador>) {
    for (let intento = 0; intento < 5; intento += 1) {
      const conductor = await obtenerConductorActual(cliente);
      if (conductor) return conductor;
      await esperar(350);
    }
    return null;
  }

  async function cargarDocumentos(cliente: ReturnType<typeof crearClienteNavegador>, userId: string) {
    const conductor = await obtenerConductorConReintento(cliente);
    if (!conductor) {
      setAdvertenciaDocumentos("La cuenta se creó, pero los documentos no pudieron ligarse todavía. Podrás cargarlos desde Configuración.");
      return;
    }

    for (const [campo, archivo] of Object.entries(documentos) as [DocumentoKey, File | null][]) {
      if (!archivo) continue;
      const ruta = `${userId}/${conductor.id}/${Date.now()}-${campo}-${nombreArchivoSeguro(archivo.name)}`;
      const { error: errorStorage } = await cliente.storage.from("documentos-conductor").upload(ruta, archivo, { upsert: false });
      if (errorStorage) throw errorStorage;
      await registrarDocumentoConductor(cliente, conductor.id, TIPOS_DOCUMENTO[campo], archivo.name, ruta);
    }
  }

  async function crearCuenta(e: FormEvent) {
    e.preventDefault();
    const todoValido = PASOS.every((_, indice) => validarPaso(indice));
    if (!todoValido) {
      const primerPasoConError = PASOS.findIndex((_, indice) => !validarPaso(indice));
      setPaso(primerPasoConError >= 0 ? primerPasoConError : paso);
      return;
    }
    if (!tieneSupabaseConfigurado()) {
      setError("Supabase no está configurado. El registro no está disponible en este entorno.");
      return;
    }

    setEnviando(true);
    setError(null);
    setAdvertenciaDocumentos(null);

    try {
      const cliente = crearClienteNavegador();
      const telefonoLimpio = telefonoE164(telefono);
      const contactoTelefonoLimpio = telefonoE164(contactoEmergenciaTelefono);

      const { data: datosAuth, error: errorAuth } = await cliente.auth.signUp({
        email: email.trim().toLowerCase(),
        password,
        options: {
          data: {
            tipo_registro: "conductor",
            nombre: nombreCompleto,
            telefono: telefonoLimpio,
            curp: curp.trim().toUpperCase(),
            domicilio: {
              codigo_postal: codigoPostal.trim(),
              estado: limpiarTexto(estado),
              ciudad_municipio: limpiarTexto(ciudad),
              colonia: limpiarTexto(colonia),
              calle: limpiarTexto(calle),
              numero: limpiarTexto(numero),
              referencias: limpiarTexto(referencias)
            },
            licencia: {
              numero: limpiarTexto(numeroLicencia),
              tipo: limpiarTexto(tipoLicencia),
              vigencia: vigenciaLicencia
            },
            verificacion: {
              autoriza_antecedentes: autorizaVerificacion,
              declara_sin_suspensiones: declaraSinSuspensiones
            },
            contacto_emergencia: {
              nombre: limpiarTexto(contactoEmergenciaNombre),
              telefono: contactoTelefonoLimpio
            },
            legales: {
              acepta_terminos_privacidad: aceptaLegales,
              marca: "ruum ruum by Movilia"
            }
          }
        }
      });
      if (errorAuth) throw errorAuth;
      if (!datosAuth.user) throw new Error("No se pudo crear la cuenta. Intenta de nuevo.");

      if (datosAuth.session) {
        try {
          await cargarDocumentos(cliente, datosAuth.user.id);
        } catch {
          setAdvertenciaDocumentos("La cuenta se creó, pero no pudimos subir todos los documentos. Podrás cargarlos desde Configuración.");
        }
      } else {
        setAdvertenciaDocumentos("Confirma tu correo para iniciar sesión y cargar los documentos desde Configuración.");
      }

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
            <p className="font-mono-ruum text-[10px] uppercase tracking-[0.14em] text-ink/50">ruum by Movilia</p>
          </div>
        </div>

        {enviado ? (
          <div className="py-8 text-center">
            <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-control-soft font-display text-xl font-bold text-control" aria-hidden>✓</div>
            <h1 id="titulo-registro-conductor" className="mt-5 font-display text-2xl font-bold">Solicitud en revisión</h1>
            <p className="mt-3 font-body text-sm leading-6 text-ink/65">
              Tu cuenta está pendiente de validación. Cuando la revisión esté completa, podrás consultar y aceptar viajes.
            </p>
            {advertenciaDocumentos && <div className="mt-5"><Aviso tono="info">{advertenciaDocumentos}</Aviso></div>}
            <Button variant="secundario" className="mt-7" onClick={() => router.push("/login")}>Volver al acceso</Button>
          </div>
        ) : (
          <>
            <h1 id="titulo-registro-conductor" className="mt-8 font-display text-2xl font-bold text-ink">Registro de conductor</h1>
            <p className="mt-2 font-body text-sm leading-6 text-ink/65">
              Completa los cinco pasos para enviar tu solicitud a ruum ruum by Movilia.
            </p>

            <div className="mt-6 grid grid-cols-5 gap-2" aria-label="Progreso de registro">
              {PASOS.map((titulo, indice) => (
                <button
                  key={titulo}
                  type="button"
                  onClick={() => indice < paso && setPaso(indice)}
                  className={[
                    "h-2 rounded-full transition-colors",
                    indice <= paso ? "bg-signal" : "bg-ink/10",
                    indice < paso ? "cursor-pointer" : "cursor-default"
                  ].join(" ")}
                  aria-label={`Paso ${indice + 1}: ${titulo}`}
                />
              ))}
            </div>
            <p className="mt-3 font-mono-ruum text-[11px] uppercase tracking-[0.12em] text-ink/45">
              Paso {paso + 1} de {PASOS.length}
            </p>

            {!tieneSupabaseConfigurado() && (
              <div className="mt-5">
                <Aviso tono="peligro">Supabase no está configurado. El registro no está disponible en este entorno.</Aviso>
              </div>
            )}

            <form className="mt-6 grid gap-5" onSubmit={crearCuenta}>
              {paso === 0 && (
                <fieldset className="grid gap-4">
                  <legend className="font-display text-xl font-bold text-ink">Vamos a conocerte</legend>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Field etiqueta="Nombre (s)" value={nombre} onChange={(e) => { setNombre(e.target.value); limpiarErrorCampo("nombre"); }} onBlur={() => validarTexto("nombre", nombre, "Escribe tu nombre como aparece en tu identificación oficial")} error={erroresCampos.nombre || undefined} required autoComplete="given-name" />
                    <Field etiqueta="Apellido (s)" value={apellidos} onChange={(e) => { setApellidos(e.target.value); limpiarErrorCampo("apellidos"); }} onBlur={() => validarTexto("apellidos", apellidos, "Escribe tus apellidos como aparecen en tu identificación oficial")} error={erroresCampos.apellidos || undefined} required autoComplete="family-name" />
                  </div>
                  <Field etiqueta="CURP" value={curp} onChange={(e) => { setCurp(e.target.value.toUpperCase()); limpiarErrorCampo("curp"); }} onBlur={() => validarCurp()} error={erroresCampos.curp || undefined} required maxLength={18} autoComplete="off" />
                  <Field etiqueta="Teléfono" ayuda="Incluye el código de país, por ejemplo +52." type="tel" value={telefono} onChange={(e) => { setTelefono(e.target.value); limpiarErrorCampo("telefono"); }} onBlur={() => validarTelefono("telefono", telefono, setTelefono)} error={erroresCampos.telefono || undefined} required autoComplete="tel" />
                  <Field etiqueta="Correo electrónico" type="email" value={email} onChange={(e) => { setEmail(e.target.value); limpiarErrorCampo("email"); }} onBlur={() => setCampoError("email", /^\S+@\S+\.\S+$/.test(email.trim()) ? "" : "Escribe un correo electrónico válido")} error={erroresCampos.email || undefined} required autoComplete="email" />
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Field etiqueta="Crea tu contraseña" type="password" value={password} ayuda="Mínimo 6 caracteres" onChange={(e) => { const valor = e.target.value; setPassword(valor); limpiarErrorCampo("password"); if (confirmacionPassword) validarConfirmacion(confirmacionPassword, valor); }} onBlur={() => validarPassword()} error={erroresCampos.password || undefined} required minLength={6} autoComplete="new-password" />
                    <Field etiqueta="Confirma tu contraseña" type="password" value={confirmacionPassword} onChange={(e) => { setConfirmacionPassword(e.target.value); validarConfirmacion(e.target.value, password); }} error={erroresCampos.confirmacionPassword || undefined} required minLength={6} autoComplete="new-password" />
                  </div>
                </fieldset>
              )}

              {paso === 1 && (
                <fieldset className="grid gap-4">
                  <legend className="font-display text-xl font-bold text-ink">¿Dónde vives?</legend>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Field etiqueta="Código Postal" inputMode="numeric" value={codigoPostal} onChange={(e) => { setCodigoPostal(e.target.value); limpiarErrorCampo("codigoPostal"); }} error={erroresCampos.codigoPostal || undefined} required autoComplete="postal-code" />
                    <Field etiqueta="Estado" value={estado} onChange={(e) => { setEstado(e.target.value); limpiarErrorCampo("estado"); }} error={erroresCampos.estado || undefined} required autoComplete="address-level1" />
                  </div>
                  <Field etiqueta="Ciudad o Municipio" value={ciudad} onChange={(e) => { setCiudad(e.target.value); limpiarErrorCampo("ciudad"); }} error={erroresCampos.ciudad || undefined} required autoComplete="address-level2" />
                  <Field etiqueta="Colonia" value={colonia} onChange={(e) => { setColonia(e.target.value); limpiarErrorCampo("colonia"); }} error={erroresCampos.colonia || undefined} required />
                  <div className="grid gap-4 sm:grid-cols-[1fr_120px]">
                    <Field etiqueta="Calle" value={calle} onChange={(e) => { setCalle(e.target.value); limpiarErrorCampo("calle"); }} error={erroresCampos.calle || undefined} required autoComplete="address-line1" />
                    <Field etiqueta="Número" value={numero} onChange={(e) => { setNumero(e.target.value); limpiarErrorCampo("numero"); }} error={erroresCampos.numero || undefined} required />
                  </div>
                  <Field etiqueta="Referencias" value={referencias} onChange={(e) => { setReferencias(e.target.value); limpiarErrorCampo("referencias"); }} error={erroresCampos.referencias || undefined} required />
                </fieldset>
              )}

              {paso === 2 && (
                <fieldset className="grid gap-4">
                  <legend className="font-display text-xl font-bold text-ink">Tus documentos</legend>
                  <Field etiqueta="Número de licencia" value={numeroLicencia} onChange={(e) => { setNumeroLicencia(e.target.value); limpiarErrorCampo("numeroLicencia"); }} error={erroresCampos.numeroLicencia || undefined} required />
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Field etiqueta="Tipo de licencia" value={tipoLicencia} onChange={(e) => { setTipoLicencia(e.target.value); limpiarErrorCampo("tipoLicencia"); }} error={erroresCampos.tipoLicencia || undefined} required />
                    <Field etiqueta="Vigencia" type="date" value={vigenciaLicencia} onChange={(e) => { setVigenciaLicencia(e.target.value); limpiarErrorCampo("vigenciaLicencia"); }} error={erroresCampos.vigenciaLicencia || undefined} required />
                  </div>
                  <Field etiqueta="Foto de tu licencia (frente)" type="file" accept="image/*,.pdf" onChange={(e) => cambiarDocumento("licenciaFrente", e)} error={erroresCampos.licenciaFrente || undefined} required />
                  <Field etiqueta="Foto de tu licencia (reverso)" type="file" accept="image/*,.pdf" onChange={(e) => cambiarDocumento("licenciaReverso", e)} error={erroresCampos.licenciaReverso || undefined} required />
                  <Field etiqueta="Foto de tu Identificación oficial (INE/pasaporte)" type="file" accept="image/*,.pdf" onChange={(e) => cambiarDocumento("identificacionOficial", e)} error={erroresCampos.identificacionOficial || undefined} required />
                </fieldset>
              )}

              {paso === 3 && (
                <fieldset className="grid gap-4">
                  <legend className="font-display text-xl font-bold text-ink">Verificación y contacto de emergencia</legend>
                  <label className="flex gap-3 rounded-xl border border-ink/15 bg-mist p-4 font-body text-sm leading-6 text-ink/75">
                    <input type="checkbox" checked={autorizaVerificacion} onChange={(e) => { setAutorizaVerificacion(e.target.checked); limpiarErrorCampo("autorizaVerificacion"); }} className="mt-1 size-4 accent-route-dark" />
                    <span>Autorizo la verificación de antecedentes y de mi historial de manejo ante las autoridades correspondientes.</span>
                  </label>
                  {erroresCampos.autorizaVerificacion && <p className="font-body text-xs font-medium text-danger">{erroresCampos.autorizaVerificacion}</p>}
                  <label className="flex gap-3 rounded-xl border border-ink/15 bg-mist p-4 font-body text-sm leading-6 text-ink/75">
                    <input type="checkbox" checked={declaraSinSuspensiones} onChange={(e) => { setDeclaraSinSuspensiones(e.target.checked); limpiarErrorCampo("declaraSinSuspensiones"); }} className="mt-1 size-4 accent-route-dark" />
                    <span>Declaro que no tengo suspensiones vigentes de licencia ni procesos legales activos relacionados con el manejo de vehículos.</span>
                  </label>
                  {erroresCampos.declaraSinSuspensiones && <p className="font-body text-xs font-medium text-danger">{erroresCampos.declaraSinSuspensiones}</p>}
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Field etiqueta="Contacto de emergencia (nombre)" value={contactoEmergenciaNombre} onChange={(e) => { setContactoEmergenciaNombre(e.target.value); limpiarErrorCampo("contactoEmergenciaNombre"); }} error={erroresCampos.contactoEmergenciaNombre || undefined} required />
                    <Field etiqueta="Teléfono del contacto" type="tel" value={contactoEmergenciaTelefono} onChange={(e) => { setContactoEmergenciaTelefono(e.target.value); limpiarErrorCampo("contactoEmergenciaTelefono"); }} onBlur={() => validarTelefono("contactoEmergenciaTelefono", contactoEmergenciaTelefono, setContactoEmergenciaTelefono)} error={erroresCampos.contactoEmergenciaTelefono || undefined} required />
                  </div>
                </fieldset>
              )}

              {paso === 4 && (
                <fieldset className="grid gap-4">
                  <legend className="font-display text-xl font-bold text-ink">Revisa tu información</legend>
                  <p className="font-body text-sm leading-6 text-ink/65">Verifica que todo sea correcto antes de enviar tu registro.</p>
                  <div className="grid gap-3 rounded-xl border border-ink/15 bg-mist p-4 font-body text-sm text-ink/75">
                    <Resumen titulo="Datos personales" valores={[nombreCompleto, curp.trim().toUpperCase(), telefonoE164(telefono), email.trim().toLowerCase()]} />
                    <Resumen titulo="Domicilio" valores={[`${calle} ${numero}`, `${colonia}, ${ciudad}`, `${estado}, C.P. ${codigoPostal}`, referencias]} />
                    <Resumen titulo="Documentación" valores={[`Licencia ${numeroLicencia}`, `Tipo ${tipoLicencia}`, `Vigente hasta ${vigenciaLicencia}`, documentos.licenciaFrente?.name ?? "Licencia frente pendiente", documentos.licenciaReverso?.name ?? "Licencia reverso pendiente", documentos.identificacionOficial?.name ?? "Identificación pendiente"]} />
                    <Resumen titulo="Verificación" valores={[autorizaVerificacion ? "Autoriza verificación de antecedentes" : "Verificación pendiente", declaraSinSuspensiones ? "Sin suspensiones ni procesos activos declarados" : "Declaración pendiente", `Emergencia: ${contactoEmergenciaNombre} · ${contactoEmergenciaTelefono}`]} />
                  </div>
                  <label className="flex gap-3 rounded-xl border border-route-dark/20 bg-route-soft p-4 font-body text-sm leading-6 text-ink/75">
                    <input type="checkbox" checked={aceptaLegales} onChange={(e) => { setAceptaLegales(e.target.checked); limpiarErrorCampo("aceptaLegales"); }} className="mt-1 size-4 accent-route-dark" />
                    <span>He leído y acepto los términos y condiciones y el aviso de privacidad de ruum ruum by Movilia.</span>
                  </label>
                  {erroresCampos.aceptaLegales && <p className="font-body text-xs font-medium text-danger">{erroresCampos.aceptaLegales}</p>}
                </fieldset>
              )}

              {error && <Aviso tono="peligro">{error}</Aviso>}

              <div className="grid gap-3 sm:grid-cols-2">
                {paso > 0 && <Button type="button" variant="secundario" onClick={volver}>Atrás</Button>}
                {paso < PASOS.length - 1 ? (
                  <Button type="button" className={paso === 0 ? "sm:col-start-2" : ""} onClick={avanzar}>Continuar</Button>
                ) : (
                  <Button type="submit" disabled={!puedeEnviar || !tieneSupabaseConfigurado()} loading={enviando}>
                    {enviando ? TEXTOS_CARGANDO.enviando : "Enviar registro"}
                  </Button>
                )}
              </div>
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

function Resumen({ titulo, valores }: { titulo: string; valores: Array<string | undefined> }) {
  return (
    <div className="border-b border-ink/10 pb-3 last:border-0 last:pb-0">
      <p className="font-body text-xs font-semibold uppercase tracking-wide text-ink/45">{titulo}</p>
      <ul className="mt-2 grid gap-1">
        {valores.filter(Boolean).map((valor) => (
          <li key={valor} className="font-body text-sm text-ink/75">{valor}</li>
        ))}
      </ul>
    </div>
  );
}
