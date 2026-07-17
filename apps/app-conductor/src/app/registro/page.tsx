"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Button, Aviso } from "@ruum/ui";
import { TEXTOS_CARGANDO } from "@ruum/shared/constants";
import { traducirErrorAuth, traducirErrorOperativo, fortalezaPassword } from "@ruum/shared/utils";
import {
  validarCampoRegistroConductor,
  type CampoRegistroConductor
} from "@ruum/shared/validacion";
import {
  enviarSolicitudConductor,
  guardarBorradorConductor,
  iniciarSolicitudConductor,
  obtenerConductorActual,
  obtenerSolicitudConductorActual,
  registrarConsentimientosConductor,
} from "@ruum/api/services";
import { crearClienteNavegador, tieneSupabaseConfigurado } from "../../lib/supabase-browser";
import { consultarCodigoPostalMx } from "../../lib/codigos-postales";
import { limpiarBorradorRegistroLocal } from "../../lib/borrador-registro";
import { AccountStep } from "./AccountStep";
import { DocumentsStep } from "./DocumentsStep";
import { IdentityStep } from "./IdentityStep";
import { LicenseStep } from "./LicenseStep";
import { OtpVerification } from "./OtpVerification";
import { RegistrationProgress } from "./RegistrationProgress";
import { RegistrationShell } from "./RegistrationShell";
import { ReviewStep } from "./ReviewStep";
import {
  PASOS_REGISTRO,
  TIPOS_DOCUMENTO,
  type EstadoGuardadoRemoto
} from "./registration-types";
import {
  limpiarTexto,
  objetoJson,
  soloDigitos,
  telefonoE164Mx
} from "./registration-validation";
import { useRegistrationDocuments } from "./useRegistrationDocuments";
import { useRegistrationDraft } from "./useRegistrationDraft";
import { useRegistrationTelemetry } from "./useRegistrationTelemetry";

const VERSION_APP_REGISTRO = process.env.NEXT_PUBLIC_APP_VERSION ?? "0.0.1";

function canalRegistro(): "web" | "android" | "ios" {
  if (/android/i.test(navigator.userAgent)) return "android";
  if (/iPad|iPhone|iPod/i.test(navigator.userAgent)) return "ios";
  return "web";
}

/**
 * Fase 4 — borrador NO sensible del wizard.
 * Se guardan solo datos de bajo riesgo para retomar el registro si la app se
 * cierra a medio camino. Excluidos deliberadamente: contraseña, CURP y los
 * archivos de documentos (los File no sobreviven un reinicio y la contraseña
 * y la CURP no deben tocar el almacenamiento local del dispositivo).
 */
const RETRASO_GUARDADO_REMOTO_MS = 900;
// Fase 5 (auditoría H-3) — el borrador caduca: no queremos PII de bajo riesgo
// viviendo indefinidamente en el almacenamiento del dispositivo.

const CODIGO_OTP_LONGITUD = 6;
const ESPERA_REENVIO_OTP_SEGUNDOS = 60;

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
  const [ciudades, setCiudades] = useState<string[]>([]);
  const [colonias, setColonias] = useState<string[]>([]);
  const [consultandoCp, setConsultandoCp] = useState(false);
  const [colonia, setColonia] = useState("");
  const [calle, setCalle] = useState("");
  const [numero, setNumero] = useState("");
  const [referencias, setReferencias] = useState("");
  const [numeroLicencia, setNumeroLicencia] = useState("");
  const [tipoLicencia, setTipoLicencia] = useState("");
  const [vigenciaLicencia, setVigenciaLicencia] = useState("");
  const [autorizaVerificacion, setAutorizaVerificacion] = useState(false);
  const [declaraSinSuspensiones, setDeclaraSinSuspensiones] = useState(false);
  const [contactoEmergenciaNombre, setContactoEmergenciaNombre] = useState("");
  const [contactoEmergenciaTelefono, setContactoEmergenciaTelefono] = useState("");
  const [aceptaTerminos, setAceptaTerminos] = useState(false);
  const [confirmaPrivacidad, setConfirmaPrivacidad] = useState(false);
  const [erroresCampos, setErroresCampos] = useState<Record<string, string>>({});
  const [enviando, setEnviando] = useState(false);
  const [enviado, setEnviado] = useState(false);
  const [sesionActivaTrasRegistro, setSesionActivaTrasRegistro] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sesionAutenticada,setSesionAutenticada]=useState(false);
  const [solicitudRemotaId,setSolicitudRemotaId]=useState<string|null>(null);
  const [estadoGuardadoRemoto,setEstadoGuardadoRemoto]=useState<EstadoGuardadoRemoto>("inactivo");
  const [detalleGuardadoRemoto,setDetalleGuardadoRemoto]=useState<string|null>(null);
  const [reintentoConexion,setReintentoConexion]=useState(0);
  const hidratacionRemotaCompletaRef=useRef(false);
  const omitirPrimerGuardadoRemotoRef=useRef(false);
  const ultimoGuardadoRemotoRef=useRef("");
  const solicitudRemotaIdRef=useRef<string|null>(null);
  const aceptadosEnRef=useRef(new Date().toISOString());

  // Fase 4 — verificación por código (OTP) cuando Supabase exige confirmar el correo.
  const [pendienteOtp, setPendienteOtp] = useState(false);
  const [codigoOtp, setCodigoOtp] = useState("");
  const [verificandoOtp, setVerificandoOtp] = useState(false);
  const [errorOtp, setErrorOtp] = useState<string | null>(null);
  const [reenviandoOtp, setReenviandoOtp] = useState(false);
  const [esperaReenvioOtp, setEsperaReenvioOtp] = useState(0);

  const nombreCompleto = useMemo(() => limpiarTexto(`${nombre} ${apellidos}`), [nombre, apellidos]);
  const fuerzaPassword = useMemo(() => fortalezaPassword(password), [password]);
  const borradorLocal = useMemo(() => ({
    paso,
    nombre,
    apellidos,
    telefono,
    email,
    codigoPostal,
    estado,
    ciudad,
    colonia,
    tipoLicencia,
    vigenciaLicencia
  }), [paso, nombre, apellidos, telefono, email, codigoPostal, estado, ciudad, colonia, tipoLicencia, vigenciaLicencia]);
  const tieneErroresActivos = Object.values(erroresCampos).some(Boolean);

  const registrarTelemetria = useRegistrationTelemetry(paso);

  const {
    documentos,
    estadoDocumentos,
    documentosRemotos,
    setDocumentosRemotos,
    setEstadoDocumentos,
    documentoDisponible,
    validarDocumento,
    cambiarDocumento,
    cargarDocumentos
  } = useRegistrationDocuments({
    setCampoError,
    limpiarErrorCampo,
    registrarTelemetria,
    paso
  });
  const {
    borradorDisponible,
    borradorLocalGuardado,
    restaurarBorrador,
    descartarBorrador
  } = useRegistrationDraft({
    enabled: !enviado && !pendienteOtp && !sesionAutenticada,
    snapshot: borradorLocal,
    onRestore: (borrador) => {
      setNombre(borrador.nombre ?? "");
      setApellidos(borrador.apellidos ?? "");
      setTelefono(borrador.telefono ?? "");
      setEmail(borrador.email ?? "");
      setCodigoPostal(borrador.codigoPostal ?? "");
      setEstado(borrador.estado ?? "");
      setCiudad(borrador.ciudad ?? "");
      setColonia(borrador.colonia ?? "");
      setTipoLicencia(borrador.tipoLicencia ?? "");
      setVigenciaLicencia(borrador.vigenciaLicencia ?? "");
      setPaso(0);

      const cp = soloDigitos(borrador.codigoPostal ?? "", 5);
      if (cp.length === 5) void buscarCodigoPostal(cp);
    }
  });
  const puedeEnviar = !enviando && !tieneErroresActivos && aceptaTerminos && confirmaPrivacidad && formularioCompleto();

  function setCampoError(campo: string, mensaje: string) {
    setErroresCampos((prev) => ({ ...prev, [campo]: mensaje }));
    return !mensaje;
  }

  function limpiarErrorCampo(campo: string) {
    if (erroresCampos[campo]) setErroresCampos((prev) => ({ ...prev, [campo]: "" }));
  }

  // Fase 4 — las reglas y mensajes viven en @ruum/shared/validacion (una sola
  // fuente para app-conductor, panel-admin y backend).
  function validarCampo(campo: CampoRegistroConductor, valor: string) {
    return setCampoError(campo, validarCampoRegistroConductor(campo, valor));
  }

  function validarCurp(valor = curp) {
    return validarCampo("curp", valor);
  }

  function validarTelefono(campo: "telefono" | "contactoEmergenciaTelefono", valor: string, setter: (valor: string) => void) {
    const normalizado = soloDigitos(valor);
    if (normalizado !== valor) setter(normalizado);
    return validarCampo(campo, normalizado);
  }

  function validarPassword(valor = password) {
    return validarCampo("password", valor);
  }

  function validarConfirmacion(valor = confirmacionPassword, base = password) {
    if (sesionAutenticada) return setCampoError("confirmacionPassword", "");
    if (!valor) return setCampoError("confirmacionPassword", "Confirma tu contraseña");
    return setCampoError("confirmacionPassword", valor !== base ? "Las contraseñas no coinciden" : "");
  }

  function validarVigenciaLicencia(valor = vigenciaLicencia) {
    return validarCampo("vigenciaLicencia", valor);
  }

  async function buscarCodigoPostal(cp: string) {
    setConsultandoCp(true);
    setCampoError("codigoPostal", "");
    try {
      const datos = await consultarCodigoPostalMx(cp);
      if (!datos) throw new Error("CP no encontrado");
      setEstado(datos.estado);
      setCiudades(datos.ciudades);
      setCiudad(datos.ciudades[0] ?? "");
      setColonias(datos.colonias);
      setColonia(datos.colonias[0] ?? "");
      setErroresCampos((prev) => ({ ...prev, estado: "", ciudad: "", colonia: "" }));
    } catch {
      setEstado("");
      setCiudad("");
      setCiudades([]);
      setColonias([]);
      setColonia("");
      setCampoError("codigoPostal", "No encontramos ese código postal. Verifica que tenga 5 dígitos o captura el domicilio manualmente.");
    } finally {
      setConsultandoCp(false);
    }
  }

  function validarPaso(indice = paso) {
    if (indice === 0) {
      return [
        validarTelefono("telefono", telefono, setTelefono),
        validarCampo("email", email),
        sesionAutenticada ? setCampoError("password", "") : validarPassword(),
        validarConfirmacion()
      ].every(Boolean);
    }
    if (indice === 1) {
      return [
        validarCampo("nombre", nombre),
        validarCampo("apellidos", apellidos),
        validarCurp(),
        validarCampo("codigoPostal", codigoPostal),
        validarCampo("estado", estado),
        validarCampo("ciudad", ciudad),
        validarCampo("colonia", colonia),
        validarCampo("calle", calle),
        validarCampo("numero", numero),
        validarCampo("referencias", referencias),
        validarCampo("contactoEmergenciaNombre", contactoEmergenciaNombre),
        validarTelefono("contactoEmergenciaTelefono", contactoEmergenciaTelefono, setContactoEmergenciaTelefono)
      ].every(Boolean);
    }
    if (indice === 2) {
      return [
        validarCampo("numeroLicencia", numeroLicencia),
        validarCampo("tipoLicencia", tipoLicencia),
        validarVigenciaLicencia(),
        setCampoError("autorizaVerificacion", autorizaVerificacion ? "" : "Debes autorizar la verificación de antecedentes"),
        setCampoError("declaraSinSuspensiones", declaraSinSuspensiones ? "" : "Debes confirmar esta declaración")
      ].every(Boolean);
    }
    if (indice === 3) {
      return [
        setCampoError("cuentaVerificada", sesionAutenticada ? "" : "Confirma tu cuenta antes de cargar documentos"),
        validarDocumento("licenciaFrente"),
        validarDocumento("licenciaReverso"),
        validarDocumento("identificacionOficial")
      ].every(Boolean);
    }
    return [
      setCampoError("aceptaTerminos", aceptaTerminos ? "" : "Debes aceptar los términos de servicio"),
      setCampoError("confirmaPrivacidad", confirmaPrivacidad ? "" : "Debes confirmar que leíste el aviso de privacidad")
    ].every(Boolean);
  }

  function formularioCompleto() {
    return Boolean(
      nombre.trim() &&
        apellidos.trim() &&
        curp.trim() &&
        telefono.trim() &&
        email.trim() &&
        (sesionAutenticada || (password && confirmacionPassword)) &&
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
        documentoDisponible("licenciaFrente") &&
        documentoDisponible("licenciaReverso") &&
        documentoDisponible("identificacionOficial") &&
        autorizaVerificacion &&
        declaraSinSuspensiones &&
        contactoEmergenciaNombre.trim() &&
        contactoEmergenciaTelefono.trim()
    );
  }

  async function avanzar() {
    setError(null);
    if (paso === 0 && !sesionAutenticada) {
      const cuentaLista = await crearCuentaParaContinuar();
      if (!cuentaLista) return;
    }
    if (validarPaso()) {
      registrarTelemetria("paso_completado",paso+1);
      setPaso((actual) => Math.min(actual + 1, PASOS_REGISTRO.length - 1));
    }
  }

  function volver() {
    setError(null);
    setPaso((actual) => Math.max(actual - 1, 0));
  }

  const contratoExpediente=useCallback(()=>{
    const aceptadosEn = aceptadosEnRef.current;
    return {
      datosPersonales: {
        nombre: nombreCompleto,
        nombres: limpiarTexto(nombre),
        apellidos: limpiarTexto(apellidos),
        telefono: telefonoE164Mx(telefono),
        curp: curp.trim().toUpperCase(),
        autoriza_verificacion_antecedentes: autorizaVerificacion,
        declara_sin_suspensiones: declaraSinSuspensiones,
        acepta_terminos_servicio: aceptaTerminos,
        confirma_aviso_privacidad: confirmaPrivacidad,
        version_terminos_aceptada: 1,
        version_aviso_privacidad: 1,
        terminos_aceptados_en: aceptadosEn,
        marca_terminos: "ruum ruum by Movilia"
      },
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
      contactoEmergencia: {
        nombre: limpiarTexto(contactoEmergenciaNombre),
        telefono: soloDigitos(contactoEmergenciaTelefono)
      }
    };
  },[nombreCompleto,nombre,apellidos,telefono,curp,autorizaVerificacion,declaraSinSuspensiones,aceptaTerminos,confirmaPrivacidad,codigoPostal,estado,ciudad,colonia,calle,numero,referencias,numeroLicencia,tipoLicencia,vigenciaLicencia,contactoEmergenciaNombre,contactoEmergenciaTelefono]);

  async function prepararSolicitudBorrador(cliente: ReturnType<typeof crearClienteNavegador>) {
    const inicio = await iniciarSolicitudConductor(cliente);
    if (!inicio.solicitudId) {
      throw new Error(
        inicio.conductorId
          ? "Esta cuenta ya tiene un perfil de conductor operativo."
          : "No pudimos iniciar la solicitud."
      );
    }
    setSesionAutenticada(true);
    setSolicitudRemotaId(inicio.solicitudId);
    solicitudRemotaIdRef.current = inicio.solicitudId;
    hidratacionRemotaCompletaRef.current = true;
    omitirPrimerGuardadoRemotoRef.current = true;
    limpiarBorradorRegistroLocal();
    await guardarBorradorConductor(cliente, contratoExpediente(), Math.max(paso + 1, 1));
    setEstadoGuardadoRemoto("guardado");
    return inicio.solicitudId;
  }

  async function crearCuentaParaContinuar() {
    if (!validarPaso(0)) return false;
    if (!tieneSupabaseConfigurado()) {
      setError("Supabase no está configurado. El registro no está disponible en este entorno.");
      return false;
    }
    setEnviando(true);
    setError(null);
    try {
      const cliente = crearClienteNavegador();
      if (sesionAutenticada) {
        if (!solicitudRemotaIdRef.current && !solicitudRemotaId) await prepararSolicitudBorrador(cliente);
        return true;
      }
      const { data: datosAuth, error: errorAuth } = await cliente.auth.signUp({
        email: email.trim().toLowerCase(),
        password,
        options: {
          data: {
            tipo_registro: "conductor",
            version_registro: 2
          }
        }
      });
      if (errorAuth) throw errorAuth;
      if (!datosAuth.user) throw new Error("No se pudo crear la cuenta. Intenta de nuevo.");
      limpiarBorradorRegistroLocal();
      if (datosAuth.session) {
        await prepararSolicitudBorrador(cliente);
        setSesionActivaTrasRegistro(true);
        return true;
      }
      setEsperaReenvioOtp(ESPERA_REENVIO_OTP_SEGUNDOS);
      setPendienteOtp(true);
      return false;
    } catch (err) {
      setError(traducirErrorAuth(err));
      return false;
    } finally {
      setEnviando(false);
    }
  }

  async function procesarSolicitudAutenticada(cliente: ReturnType<typeof crearClienteNavegador>) {
    const solicitudId = solicitudRemotaIdRef.current ?? solicitudRemotaId ?? await prepararSolicitudBorrador(cliente);
    await registrarConsentimientosConductor(
      cliente,
      solicitudId,
      [
        { tipoDocumento: "terminos_servicio", version: 1 },
        { tipoDocumento: "aviso_privacidad", version: 1 },
        { tipoDocumento: "autorizacion_antecedentes", version: 1 },
        { tipoDocumento: "declaracion_suspensiones", version: 1 }
      ],
      canalRegistro(),
      VERSION_APP_REGISTRO
    );
    await guardarBorradorConductor(cliente, contratoExpediente(), PASOS_REGISTRO.length);
    await cargarDocumentos(cliente, solicitudId);
    const resultado=await enviarSolicitudConductor(cliente);
    registrarTelemetria("solicitud_enviada",PASOS_REGISTRO.length,"enviado");
    return resultado;
  }

  async function crearCuenta(e: FormEvent) {
    e.preventDefault();
    const todoValido = PASOS_REGISTRO.every((_, indice) => validarPaso(indice));
    if (!todoValido) {
      const primerPasoConError = PASOS_REGISTRO.findIndex((_, indice) => !validarPaso(indice));
      setPaso(primerPasoConError >= 0 ? primerPasoConError : paso);
      return;
    }
    if (!tieneSupabaseConfigurado()) {
      setError("Supabase no está configurado. El registro no está disponible en este entorno.");
      return;
    }

    setEnviando(true);
    setError(null);
    let cuentaCreada=sesionAutenticada;

    try {
      const cliente = crearClienteNavegador();
      if (!sesionAutenticada) {
        const cuentaLista = await crearCuentaParaContinuar();
        if (!cuentaLista) return;
        cuentaCreada = true;
        setSesionActivaTrasRegistro(true);
        await procesarSolicitudAutenticada(cliente);
        limpiarBorradorRegistroLocal();
        setEnviado(true);
        return;
      }
      if (sesionAutenticada) {
        setSesionActivaTrasRegistro(true);
        await procesarSolicitudAutenticada(cliente);
        limpiarBorradorRegistroLocal();
        setEnviado(true);
        return;
      }
      const { data: datosAuth, error: errorAuth } = await cliente.auth.signUp({
        email: email.trim().toLowerCase(),
        password,
        options: {
          data: {
            tipo_registro: "conductor",
            version_registro: 2
          }
        }
      });
      if (errorAuth) throw errorAuth;
      if (!datosAuth.user) throw new Error("No se pudo crear la cuenta. Intenta de nuevo.");
      cuentaCreada=true;
      limpiarBorradorRegistroLocal();

      if (datosAuth.session) {
        setSesionActivaTrasRegistro(true);
        await procesarSolicitudAutenticada(cliente);
        limpiarBorradorRegistroLocal();
        setEnviado(true);
      } else {
        // Fase 4 — la cuenta requiere confirmar el correo. En vez de mandar al
        // conductor a su bandeja (y perderlo), pedimos aquí mismo el código de
        // 6 dígitos que Supabase incluye en el correo de confirmación.
        setEsperaReenvioOtp(ESPERA_REENVIO_OTP_SEGUNDOS);
        setPendienteOtp(true);
      }
    } catch (err) {
      if (cuentaCreada) registrarTelemetria("rpc_error",paso+1,"enviar_solicitud");
      setError(cuentaCreada?traducirErrorOperativo(err,"No pudimos enviar tu solicitud. Tu cuenta quedó creada y puedes reintentar."):traducirErrorAuth(err));
    } finally {
      setEnviando(false);
    }
  }

  /**
   * Fase 4 — verifica el código de 6 dígitos del correo de confirmación.
   * Al validarse queda sesión activa, así que aprovechamos para subir los
   * documentos en ese mismo momento (el flujo original los perdía hasta
   * que el conductor entrara a Configuración).
   */
  async function confirmarCodigoOtp(e: FormEvent) {
    e.preventDefault();
    const codigo = codigoOtp.trim();
    if (!new RegExp(`^\\d{${CODIGO_OTP_LONGITUD}}$`).test(codigo)) {
      setErrorOtp(`Escribe el código de ${CODIGO_OTP_LONGITUD} dígitos que enviamos a tu correo.`);
      return;
    }

    setVerificandoOtp(true);
    setErrorOtp(null);
    let cuentaVerificada=false;
    try {
      const cliente = crearClienteNavegador();
      const { data, error: errorVerificacion } = await cliente.auth.verifyOtp({
        email: email.trim().toLowerCase(),
        token: codigo,
        type: "signup"
      });
      if (errorVerificacion) throw errorVerificacion;
      if (!data.session) throw new Error("El código se validó pero no pudimos iniciar tu sesión. Entra desde el acceso.");
      cuentaVerificada=true;

      setSesionActivaTrasRegistro(true);
      if (paso < PASOS_REGISTRO.length - 1) {
        await prepararSolicitudBorrador(cliente);
        setPendienteOtp(false);
        setPaso((actual) => Math.min(actual + 1, PASOS_REGISTRO.length - 1));
        return;
      }
      await procesarSolicitudAutenticada(cliente);
      limpiarBorradorRegistroLocal();
      setPendienteOtp(false);
      setEnviado(true);
    } catch (err) {
      if(cuentaVerificada) {
        registrarTelemetria("rpc_error",paso+1,"enviar_solicitud");
        setPendienteOtp(false);
        setError(traducirErrorOperativo(err,"Tu cuenta quedó verificada, pero no pudimos enviar la solicitud. Puedes reintentar."));
      } else {
        registrarTelemetria("otp_error",paso+1,"verificar_otp");
        setErrorOtp(traducirErrorAuth(err));
      }
    } finally {
      setVerificandoOtp(false);
    }
  }

  async function reenviarCodigoOtp() {
    if (esperaReenvioOtp > 0 || reenviandoOtp) return;
    setReenviandoOtp(true);
    setErrorOtp(null);
    try {
      const cliente = crearClienteNavegador();
      const { error: errorReenvio } = await cliente.auth.resend({
        type: "signup",
        email: email.trim().toLowerCase()
      });
      if (errorReenvio) throw errorReenvio;
      setEsperaReenvioOtp(ESPERA_REENVIO_OTP_SEGUNDOS);
    } catch (err) {
      registrarTelemetria("otp_error",paso+1,"reenviar_otp");
      setErrorOtp(traducirErrorAuth(err));
    } finally {
      setReenviandoOtp(false);
    }
  }

  // Cooldown del botón de reenvío.
  useEffect(() => {
    if (!pendienteOtp || esperaReenvioOtp <= 0) return;
    const intervalo = setInterval(() => setEsperaReenvioOtp((s) => Math.max(0, s - 1)), 1000);
    return () => clearInterval(intervalo);
  }, [pendienteOtp, esperaReenvioOtp]);

  // RT-19 — al volver desde cualquier dispositivo, la sesión hidrata el
  // expediente remoto y deja de depender del borrador del navegador.
  useEffect(() => {
    if (!tieneSupabaseConfigurado()) { hidratacionRemotaCompletaRef.current=true; return; }
    let activo=true;
    const cliente=crearClienteNavegador();
    async function hidratar() {
      try {
        const {data:sesion}=await cliente.auth.getUser();
        if (!activo||!sesion.user) { hidratacionRemotaCompletaRef.current=true; return; }
        setSesionAutenticada(true);
        descartarBorrador();
        setEmail(sesion.user.email??"");
        const solicitud=await obtenerSolicitudConductorActual(cliente);
        if (!solicitud) {
          // H-5 — antes asumíamos "sesión sin solicitud = ya eres conductor
          // certificado" y mandábamos directo a /panel sin comprobarlo. Eso
          // dejaba varada a cualquier cuenta autenticada que en realidad
          // nunca llegó a iniciar su solicitud (p. ej. confirmó el correo
          // desde el enlace crudo del correo en vez de terminar el flujo de
          // verificación dentro de la app: el enlace sí confirma la cuenta,
          // pero iniciar_solicitud_conductor solo se llama desde acá). /panel
          // tampoco rescataba a ese usuario — quedaba viendo un dashboard
          // vacío sin ruta de regreso. Verificamos primero si de verdad
          // existe un conductor antes de mandar a /panel; si no existe ni
          // conductor ni solicitud, creamos la solicitud aquí mismo y
          // dejamos que el registro siga normalmente.
          const conductorExistente = await obtenerConductorActual(cliente);
          if (conductorExistente) { router.replace("/panel"); return; }
          const inicio = await iniciarSolicitudConductor(cliente);
          if (!inicio.solicitudId) { router.replace("/panel"); return; }
          setSolicitudRemotaId(inicio.solicitudId);
          solicitudRemotaIdRef.current=inicio.solicitudId;
          hidratacionRemotaCompletaRef.current=true;
          omitirPrimerGuardadoRemotoRef.current=true;
          setEstadoGuardadoRemoto("guardado");
          return;
        }
        if (["listo_para_enviar","en_revision","requiere_correccion","aprobado","rechazado","suspendido"].includes(solicitud.estado)) {
          router.replace("/panel"); return;
        }
        const [resultadoDocs,resultadoConsentimientos]=await Promise.all([
          cliente.from("documentos_conductor").select("tipo,estado,es_actual").eq("solicitud_id",solicitud.id).eq("es_actual",true),
          cliente.from("consentimientos_usuario").select("tipo_documento,aceptado_en").eq("solicitud_id",solicitud.id)
        ]);
        if (resultadoDocs.error) throw resultadoDocs.error;
        if (resultadoConsentimientos.error) throw resultadoConsentimientos.error;
        const personales=objetoJson(solicitud.datos_personales);
        const domicilio=objetoJson(solicitud.domicilio);
        const licencia=objetoJson(solicitud.licencia);
        const contacto=objetoJson(solicitud.contacto_emergencia);
        const nombreCompletoRemoto=String(personales.nombre??"").trim();
        const partesNombre=nombreCompletoRemoto.split(/\s+/).filter(Boolean);
        setNombre(String(personales.nombres??partesNombre[0]??""));
        setApellidos(String(personales.apellidos??partesNombre.slice(1).join(" ")));
        setCurp(String(personales.curp??""));
        setTelefono(soloDigitos(String(personales.telefono??"").replace(/^\+?52/,"")));
        setCodigoPostal(String(domicilio.codigo_postal??""));
        setEstado(String(domicilio.estado??""));
        setCiudad(String(domicilio.ciudad_municipio??""));
        setColonia(String(domicilio.colonia??""));
        if (domicilio.ciudad_municipio) setCiudades([String(domicilio.ciudad_municipio)]);
        if (domicilio.colonia) setColonias([String(domicilio.colonia)]);
        setCalle(String(domicilio.calle??""));
        setNumero(String(domicilio.numero??""));
        setReferencias(String(domicilio.referencias??""));
        setNumeroLicencia(String(licencia.numero??""));
        setTipoLicencia(String(licencia.tipo??""));
        setVigenciaLicencia(String(licencia.vigencia??""));
        setContactoEmergenciaNombre(String(contacto.nombre??""));
        setContactoEmergenciaTelefono(soloDigitos(String(contacto.telefono??"")));
        const consentimientos=new Set((resultadoConsentimientos.data??[]).map((fila)=>fila.tipo_documento));
        setAceptaTerminos(consentimientos.has("terminos_servicio"));
        setConfirmaPrivacidad(consentimientos.has("aviso_privacidad"));
        setAutorizaVerificacion(consentimientos.has("autorizacion_antecedentes"));
        setDeclaraSinSuspensiones(consentimientos.has("declaracion_suspensiones"));
        const aceptacion=(resultadoConsentimientos.data??[])[0]?.aceptado_en;
        if (aceptacion) aceptadosEnRef.current=aceptacion;
        const tiposRemotos=new Set((resultadoDocs.data??[]).map((doc)=>doc.tipo));
        setDocumentosRemotos(tiposRemotos);
        setEstadoDocumentos({
          licenciaFrente:tiposRemotos.has("licencia_frente")?"subido":"pendiente",
          licenciaReverso:tiposRemotos.has("licencia_reverso")?"subido":"pendiente",
          identificacionOficial:tiposRemotos.has("identificacion_oficial")?"subido":"pendiente"
        });
        setSolicitudRemotaId(solicitud.id);
        solicitudRemotaIdRef.current=solicitud.id;
        setPaso(Math.min(Math.max((solicitud.paso_actual??1)-1,0),PASOS_REGISTRO.length-1));
        omitirPrimerGuardadoRemotoRef.current=true;
        hidratacionRemotaCompletaRef.current=true;
        setEstadoGuardadoRemoto("guardado");
      } catch (err) {
        hidratacionRemotaCompletaRef.current=true;
        registrarTelemetria("rpc_error",undefined,"recuperar_expediente");
        setError(traducirErrorOperativo(err,"No pudimos recuperar tu expediente. Vuelve a intentarlo."));
      }
    }
    void hidratar();
    const {data:suscripcion}=cliente.auth.onAuthStateChange((evento)=>{
      if (evento==="SIGNED_OUT") limpiarBorradorRegistroLocal();
    });
    return()=>{activo=false;suscripcion.subscription.unsubscribe();};
  },[router,registrarTelemetria,descartarBorrador,setDocumentosRemotos,setEstadoDocumentos]);

  useEffect(()=>{
    const sinConexion=()=>setEstadoGuardadoRemoto("sin_conexion");
    const conConexion=()=>{setEstadoGuardadoRemoto("guardado");setReintentoConexion((valor)=>valor+1);};
    window.addEventListener("offline",sinConexion);
    window.addEventListener("online",conConexion);
    return()=>{window.removeEventListener("offline",sinConexion);window.removeEventListener("online",conConexion);};
  },[]);

  // RT-19 — un único lote remoto 900 ms después del último cambio.
  useEffect(()=>{
    if (!sesionAutenticada||!solicitudRemotaId||!hidratacionRemotaCompletaRef.current||enviado||pendienteOtp) return;
    if (omitirPrimerGuardadoRemotoRef.current) { omitirPrimerGuardadoRemotoRef.current=false; return; }
    if (!navigator.onLine) {
      const offlineTimer=setTimeout(()=>setEstadoGuardadoRemoto("sin_conexion"),0);
      return()=>clearTimeout(offlineTimer);
    }
    const expediente=contratoExpediente();
    const consentimientos=[
      aceptaTerminos?{tipoDocumento:"terminos_servicio" as const,version:1}:null,
      confirmaPrivacidad?{tipoDocumento:"aviso_privacidad" as const,version:1}:null,
      autorizaVerificacion?{tipoDocumento:"autorizacion_antecedentes" as const,version:1}:null,
      declaraSinSuspensiones?{tipoDocumento:"declaracion_suspensiones" as const,version:1}:null
    ].filter((valor):valor is NonNullable<typeof valor>=>valor!==null);
    const firma=JSON.stringify({expediente,paso,consentimientos});
    if (firma===ultimoGuardadoRemotoRef.current) return;
    setEstadoGuardadoRemoto("guardando");
    setDetalleGuardadoRemoto(null);
    const timer=setTimeout(async()=>{
      try {
        const cliente=crearClienteNavegador();
        if (consentimientos.length) await registrarConsentimientosConductor(cliente,solicitudRemotaId,consentimientos,canalRegistro(),VERSION_APP_REGISTRO);
        await guardarBorradorConductor(cliente,expediente,paso+1);
        ultimoGuardadoRemotoRef.current=firma;
        setEstadoGuardadoRemoto("guardado");
      } catch(err) {
        registrarTelemetria("rpc_error",paso+1,"guardar_borrador");
        const mensaje=traducirErrorOperativo(err);
        setDetalleGuardadoRemoto(mensaje);
        setEstadoGuardadoRemoto(navigator.onLine?"error":"sin_conexion");
      }
    },RETRASO_GUARDADO_REMOTO_MS);
    return()=>clearTimeout(timer);
  },[sesionAutenticada,solicitudRemotaId,enviado,pendienteOtp,reintentoConexion,paso,contratoExpediente,autorizaVerificacion,declaraSinSuspensiones,aceptaTerminos,confirmaPrivacidad,registrarTelemetria]);

  return (
    <RegistrationShell>
        {pendienteOtp ? (
          <OtpVerification
            email={email}
            codigoOtp={codigoOtp}
            setCodigoOtp={setCodigoOtp}
            errorOtp={errorOtp}
            clearErrorOtp={() => setErrorOtp(null)}
            verificandoOtp={verificandoOtp}
            reenviandoOtp={reenviandoOtp}
            esperaReenvioOtp={esperaReenvioOtp}
            codigoLongitud={CODIGO_OTP_LONGITUD}
            onSubmit={confirmarCodigoOtp}
            onResend={() => void reenviarCodigoOtp()}
            onAlreadyConfirmed={() => router.push("/login")}
          />
        ) : enviado ? (
          <div className="py-8 text-center">
            <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-control-soft font-display text-xl font-bold text-success" aria-hidden>✓</div>
            <h1 id="titulo-registro-conductor" className="mt-5 font-display text-2xl font-bold">Solicitud en revisión</h1>
            <p className="mt-3 font-body text-sm leading-6 text-text-secondary">
              Tu cuenta está pendiente de validación. Cuando la revisión esté completa, podrás consultar y aceptar viajes.
            </p>
            <Button
              variant="secondary"
              className="mt-7"
              onClick={() => router.push(sesionActivaTrasRegistro ? "/panel" : "/login")}
            >
              {sesionActivaTrasRegistro ? "Ver estado de mi solicitud" : "Volver al acceso"}
            </Button>
          </div>
        ) : (
          <>
            <h1 id="titulo-registro-conductor" className="mt-8 font-display text-2xl font-bold text-text-primary">Registro de conductor</h1>
            <p className="mt-2 font-body text-sm leading-6 text-text-secondary">
              Completa una etapa a la vez. Guardamos tu avance para que puedas continuar posteriormente.
            </p>

            {borradorDisponible && (
              <div className="mt-5 rounded-xl border border-route-action bg-route-soft p-4">
                <p className="font-body text-sm font-semibold text-text-primary">Encontramos un registro sin terminar</p>
                <p className="mt-1 font-body text-xs leading-5 text-text-secondary">
                  Guardado el {new Date(borradorDisponible.guardadoEn).toLocaleString("es-MX")} y disponible por 24 horas.
                  Por seguridad no guardamos CURP, contraseña, domicilio preciso, licencia, contacto ni archivos.
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Button type="button" onClick={restaurarBorrador}>Continuar donde iba</Button>
                  <Button type="button" variant="quiet" onClick={descartarBorrador}>Empezar de cero</Button>
                </div>
              </div>
            )}

            <RegistrationProgress
              paso={paso}
              onGoToStep={setPaso}
              borradorLocalGuardado={borradorLocalGuardado}
              sesionAutenticada={sesionAutenticada}
              estadoGuardadoRemoto={estadoGuardadoRemoto}
              detalleGuardadoRemoto={detalleGuardadoRemoto}
            />

            {!tieneSupabaseConfigurado() && (
              <div className="mt-5">
                <Aviso tono="danger">Supabase no está configurado. El registro no está disponible en este entorno.</Aviso>
              </div>
            )}

            <form className="mt-6 grid gap-5" onSubmit={crearCuenta}>
              {paso === 0 && (
                <AccountStep
                  telefono={telefono}
                  setTelefono={setTelefono}
                  email={email}
                  setEmail={setEmail}
                  password={password}
                  setPassword={setPassword}
                  confirmacionPassword={confirmacionPassword}
                  setConfirmacionPassword={setConfirmacionPassword}
                  fuerzaPassword={fuerzaPassword}
                  sesionAutenticada={sesionAutenticada}
                  erroresCampos={erroresCampos}
                  limpiarErrorCampo={limpiarErrorCampo}
                  validarTelefono={validarTelefono}
                  validarCampo={validarCampo}
                  validarPassword={validarPassword}
                  validarConfirmacion={validarConfirmacion}
                />
              )}

              {paso === 1 && (
                <IdentityStep
                  nombre={nombre}
                  setNombre={setNombre}
                  apellidos={apellidos}
                  setApellidos={setApellidos}
                  curp={curp}
                  setCurp={setCurp}
                  codigoPostal={codigoPostal}
                  setCodigoPostal={setCodigoPostal}
                  estado={estado}
                  setEstado={setEstado}
                  ciudad={ciudad}
                  setCiudad={setCiudad}
                  ciudades={ciudades}
                  setCiudades={setCiudades}
                  colonia={colonia}
                  setColonia={setColonia}
                  colonias={colonias}
                  setColonias={setColonias}
                  calle={calle}
                  setCalle={setCalle}
                  numero={numero}
                  setNumero={setNumero}
                  referencias={referencias}
                  setReferencias={setReferencias}
                  contactoEmergenciaNombre={contactoEmergenciaNombre}
                  setContactoEmergenciaNombre={setContactoEmergenciaNombre}
                  contactoEmergenciaTelefono={contactoEmergenciaTelefono}
                  setContactoEmergenciaTelefono={setContactoEmergenciaTelefono}
                  consultandoCp={consultandoCp}
                  erroresCampos={erroresCampos}
                  limpiarErrorCampo={limpiarErrorCampo}
                  validarCampo={validarCampo}
                  validarCurp={validarCurp}
                  validarTelefono={validarTelefono}
                  buscarCodigoPostal={(cp) => void buscarCodigoPostal(cp)}
                />
              )}

              {paso === 2 && (
                <LicenseStep
                  numeroLicencia={numeroLicencia}
                  setNumeroLicencia={setNumeroLicencia}
                  tipoLicencia={tipoLicencia}
                  setTipoLicencia={setTipoLicencia}
                  vigenciaLicencia={vigenciaLicencia}
                  setVigenciaLicencia={setVigenciaLicencia}
                  autorizaVerificacion={autorizaVerificacion}
                  setAutorizaVerificacion={setAutorizaVerificacion}
                  declaraSinSuspensiones={declaraSinSuspensiones}
                  setDeclaraSinSuspensiones={setDeclaraSinSuspensiones}
                  erroresCampos={erroresCampos}
                  limpiarErrorCampo={limpiarErrorCampo}
                  validarCampo={validarCampo}
                  validarVigenciaLicencia={validarVigenciaLicencia}
                />
              )}

              {paso === 3 && (
                <DocumentsStep
                  sesionAutenticada={sesionAutenticada}
                  documentos={documentos}
                  estadoDocumentos={estadoDocumentos}
                  erroresCampos={erroresCampos}
                  cambiarDocumento={cambiarDocumento}
                />
              )}

              {paso === 4 && (
                <ReviewStep
                  telefono={telefono}
                  email={email}
                  sesionAutenticada={sesionAutenticada}
                  nombreCompleto={nombreCompleto}
                  curp={curp}
                  calle={calle}
                  numero={numero}
                  colonia={colonia}
                  ciudad={ciudad}
                  estado={estado}
                  codigoPostal={codigoPostal}
                  referencias={referencias}
                  contactoEmergenciaTelefono={contactoEmergenciaTelefono}
                  numeroLicencia={numeroLicencia}
                  tipoLicencia={tipoLicencia}
                  vigenciaLicencia={vigenciaLicencia}
                  autorizaVerificacion={autorizaVerificacion}
                  declaraSinSuspensiones={declaraSinSuspensiones}
                  documentos={documentos}
                  documentosRemotos={documentosRemotos}
                  aceptaTerminos={aceptaTerminos}
                  setAceptaTerminos={setAceptaTerminos}
                  confirmaPrivacidad={confirmaPrivacidad}
                  setConfirmaPrivacidad={setConfirmaPrivacidad}
                  erroresCampos={erroresCampos}
                  limpiarErrorCampo={limpiarErrorCampo}
                  onEditar={setPaso}
                />
              )}

              {error && <Aviso tono="danger">{error}</Aviso>}

              <div className="grid gap-3 sm:grid-cols-2">
                {paso > 0 && <Button type="button" variant="secondary" onClick={volver}>Atrás</Button>}
                {paso < PASOS_REGISTRO.length - 1 ? (
                  <Button type="button" className={paso === 0 ? "sm:col-start-2" : ""} onClick={avanzar} loading={enviando} disabled={enviando}>
                    {paso === 0 && !sesionAutenticada ? "Crear cuenta y continuar" : "Continuar"}
                  </Button>
                ) : (
                  <Button type="submit" disabled={!puedeEnviar || !tieneSupabaseConfigurado()} loading={enviando}>
                    {enviando ? TEXTOS_CARGANDO.enviando : "Enviar registro"}
                  </Button>
                )}
              </div>
            </form>

            <p className="mt-6 text-center font-body text-sm text-text-secondary">
              ¿Ya tienes cuenta?{" "}
              <button type="button" onClick={() => router.push("/login")} className="inline-flex min-h-11 items-center font-semibold text-route-action hover:underline">
                Inicia sesión
              </button>
            </p>
          </>
        )}
    </RegistrationShell>
  );
}
