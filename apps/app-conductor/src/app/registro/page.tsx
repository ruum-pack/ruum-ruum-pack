"use client";

import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import type { FormEvent } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { Button, Field, Aviso, LogoMarca } from "@ruum/ui";
import { TEXTOS_CARGANDO } from "@ruum/shared/constants";
import { traducirErrorAuth, traducirErrorOperativo, fortalezaPassword } from "@ruum/shared/utils";
import {
  diasParaVencerLicencia,
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
  registrarEventoRegistroConductor,
  subirDocumentoSolicitudConductor
} from "@ruum/api/services";
import { crearClienteNavegador, tieneSupabaseConfigurado } from "../../lib/supabase-browser";
import { consultarCodigoPostalMx } from "../../lib/codigos-postales";
import { guardarBorradorRegistroLocal, leerBorradorRegistroLocal, limpiarBorradorRegistroLocal, type BorradorRegistroLocal as BorradorRegistro } from "../../lib/borrador-registro";
import { DatosSensiblesInfo, enmascararNombreArchivo, enmascararUltimos } from "../cuenta/datos-sensibles";

const PASOS = [
  {
    titulo: "Cuenta",
    objetivo: "Crea o confirma el acceso con el que podrás retomar tu registro.",
    tiempo: "2 min"
  },
  {
    titulo: "Identidad",
    objetivo: "Confirma quién eres y dónde podemos validar tu operación.",
    tiempo: "4 min"
  },
  {
    titulo: "Licencia y experiencia",
    objetivo: "Registra la licencia con la que conducirás y tus autorizaciones.",
    tiempo: "3 min"
  },
  {
    titulo: "Documentos",
    objetivo: "Carga tus archivos solo cuando tu cuenta ya esté verificada.",
    tiempo: "3 min"
  },
  {
    titulo: "Revisión y envío",
    objetivo: "Revisa todo tu expediente antes de enviarlo a operación.",
    tiempo: "2 min"
  }
];

const TIPOS_DOCUMENTO = {
  licenciaFrente: "licencia_frente",
  licenciaReverso: "licencia_reverso",
  identificacionOficial: "identificacion_oficial"
} as const;

const ETIQUETA_DOCUMENTO: Record<DocumentoKey, string> = {
  licenciaFrente: "licencia (frente)",
  licenciaReverso: "licencia (reverso)",
  identificacionOficial: "identificación oficial"
};

const TIPOS_LICENCIA = [
  "Tipo A - Automovilista",
  "Tipo B - Chofer",
  "Tipo C - Carga",
  "Tipo D - Motociclista",
  "Tipo E - Transporte especializado",
  "Licencia federal de conductor"
];

const TIPOS_ARCHIVO_PERMITIDOS = new Set(["image/jpeg", "image/png", "image/webp", "application/pdf"]);

type DocumentoKey = keyof typeof TIPOS_DOCUMENTO;
type EstadoDocumento = "pendiente" | "listo" | "subiendo" | "subido" | "error";
type EstadoGuardadoRemoto = "inactivo" | "guardando" | "guardado" | "sin_conexion" | "error";
const TEXTO_GUARDADO_REMOTO:Record<EstadoGuardadoRemoto,string>={
  inactivo:"",guardando:"Guardando…",guardado:"Guardado",sin_conexion:"Sin conexión",error:"Error al guardar"
};

function objetoJson(valor:unknown):Record<string,unknown> {
  return valor&&typeof valor==="object"&&!Array.isArray(valor)?valor as Record<string,unknown>:{};
}

function soloDigitos(valor: string, max = 10) {
  return valor.replace(/\D/g, "").slice(0, max);
}

function telefonoE164Mx(valor: string) {
  const nacional = soloDigitos(valor);
  return nacional ? `+52${nacional}` : "";
}

function formatoTelefonoNacional(valor: string) {
  const digitos = soloDigitos(valor);
  if (digitos.length <= 2) return digitos;
  if (digitos.length <= 6) return `${digitos.slice(0, 2)} ${digitos.slice(2)}`;
  return `${digitos.slice(0, 2)} ${digitos.slice(2, 6)} ${digitos.slice(6)}`;
}

function formatoFechaIsoParcial(valor: string) {
  const digitos = valor.replace(/\D/g, "").slice(0, 8);
  if (digitos.length <= 4) return digitos;
  if (digitos.length <= 6) return `${digitos.slice(0, 4)}-${digitos.slice(4)}`;
  return `${digitos.slice(0, 4)}-${digitos.slice(4, 6)}-${digitos.slice(6)}`;
}

function limpiarTexto(valor: string) {
  return valor.trim().replace(/\s+/g, " ");
}

const DIAS_ADVERTENCIA_VIGENCIA = 30;
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
const RETRASO_GUARDADO_LOCAL_MS = 600;
const RETRASO_GUARDADO_REMOTO_MS = 900;
// Fase 5 (auditoría H-3) — el borrador caduca: no queremos PII de bajo riesgo
// viviendo indefinidamente en el almacenamiento del dispositivo.

const CODIGO_OTP_LONGITUD = 6;
const ESPERA_REENVIO_OTP_SEGUNDOS = 60;

function estadoInicialDocumentos(): Record<DocumentoKey, EstadoDocumento> {
  return {
    licenciaFrente: "pendiente",
    licenciaReverso: "pendiente",
    identificacionOficial: "pendiente"
  };
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
  const [documentos, setDocumentos] = useState<Record<DocumentoKey, File | null>>({
    licenciaFrente: null,
    licenciaReverso: null,
    identificacionOficial: null
  });
  const [estadoDocumentos, setEstadoDocumentos] = useState<Record<DocumentoKey, EstadoDocumento>>(estadoInicialDocumentos);
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
  const [documentosRemotos,setDocumentosRemotos]=useState<Set<string>>(new Set());
  const [borradorLocalGuardado,setBorradorLocalGuardado]=useState(false);
  const [estadoGuardadoRemoto,setEstadoGuardadoRemoto]=useState<EstadoGuardadoRemoto>("inactivo");
  const [detalleGuardadoRemoto,setDetalleGuardadoRemoto]=useState<string|null>(null);
  const [reintentoConexion,setReintentoConexion]=useState(0);
  const hidratacionRemotaCompletaRef=useRef(false);
  const omitirPrimerGuardadoRemotoRef=useRef(false);
  const ultimoGuardadoRemotoRef=useRef("");
  const solicitudRemotaIdRef=useRef<string|null>(null);
  const aceptadosEnRef=useRef(new Date().toISOString());
  const telemetriaSesionRef=useRef("");
  const telemetriaInicioRef=useRef(0);
  const ultimoPasoTelemetriaRef=useRef(0);

  // Fase 4 — verificación por código (OTP) cuando Supabase exige confirmar el correo.
  const [pendienteOtp, setPendienteOtp] = useState(false);
  const [codigoOtp, setCodigoOtp] = useState("");
  const [verificandoOtp, setVerificandoOtp] = useState(false);
  const [errorOtp, setErrorOtp] = useState<string | null>(null);
  const [reenviandoOtp, setReenviandoOtp] = useState(false);
  const [esperaReenvioOtp, setEsperaReenvioOtp] = useState(0);

  // Fase 4 — borrador no sensible.
  const [borradorDisponible, setBorradorDisponible] = useState<BorradorRegistro | null>(null);

  const nombreCompleto = useMemo(() => limpiarTexto(`${nombre} ${apellidos}`), [nombre, apellidos]);
  const fuerzaPassword = useMemo(() => fortalezaPassword(password), [password]);
  const tieneErroresActivos = Object.values(erroresCampos).some(Boolean);

  const registrarTelemetria=useCallback((
    evento: Parameters<typeof registrarEventoRegistroConductor>[1]["evento"],
    pasoEvento?: number,
    codigo?: string
  )=>{
    if (!tieneSupabaseConfigurado()||!telemetriaSesionRef.current) return;
    const duracionMs=telemetriaInicioRef.current
      ? Math.max(0,Date.now()-telemetriaInicioRef.current)
      : undefined;
    void registrarEventoRegistroConductor(crearClienteNavegador(),{
      sesionId:telemetriaSesionRef.current,
      evento,
      paso:pasoEvento,
      codigo,
      duracionMs
    }).catch(()=>{
      // La observabilidad nunca debe bloquear ni distraer el alta.
    });
  },[]);

  useEffect(()=>{
    if (telemetriaSesionRef.current) return;
    telemetriaSesionRef.current=crypto.randomUUID();
    telemetriaInicioRef.current=Date.now();
    registrarTelemetria("registro_iniciado",1);
  },[registrarTelemetria]);

  useEffect(()=>{
    const pasoVisible=paso+1;
    if (!telemetriaSesionRef.current||ultimoPasoTelemetriaRef.current===pasoVisible) return;
    ultimoPasoTelemetriaRef.current=pasoVisible;
    registrarTelemetria("paso_visto",pasoVisible);
  },[paso,registrarTelemetria]);
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

  function documentoDisponible(campo:DocumentoKey) {
    return Boolean(documentos[campo]||documentosRemotos.has(TIPOS_DOCUMENTO[campo]));
  }

  function validarDocumento(campo: DocumentoKey) {
    return setCampoError(campo, documentoDisponible(campo) ? "" : "Carga este documento");
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
      setPaso((actual) => Math.min(actual + 1, PASOS.length - 1));
    }
  }

  function volver() {
    setError(null);
    setPaso((actual) => Math.max(actual - 1, 0));
  }

  function cambiarDocumento(campo: DocumentoKey, archivo: File | null) {
    if (archivo && archivo.size > 10 * 1024 * 1024) {
      setDocumentos((prev) => ({ ...prev, [campo]: null }));
      setEstadoDocumentos((prev) => ({ ...prev, [campo]: "error" }));
      setCampoError(campo, "El archivo debe pesar máximo 10 MB");
      return;
    }
    if (archivo && !TIPOS_ARCHIVO_PERMITIDOS.has(archivo.type)) {
      setDocumentos((prev) => ({ ...prev, [campo]: null }));
      setEstadoDocumentos((prev) => ({ ...prev, [campo]: "error" }));
      setCampoError(campo, "Sube una imagen JPG, PNG, WEBP o un PDF");
      return;
    }
    setDocumentos((prev) => ({ ...prev, [campo]: archivo }));
    setEstadoDocumentos((prev) => ({ ...prev, [campo]: archivo ? "listo" : "pendiente" }));
    if (archivo) limpiarErrorCampo(campo);
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

  async function cargarDocumentos(cliente: ReturnType<typeof crearClienteNavegador>, solicitudId: string) {
    const pendientes = (Object.entries(documentos) as [DocumentoKey, File | null][])
      .filter(([campo, archivo]) => archivo && estadoDocumentos[campo] !== "subido");

    setEstadoDocumentos((prev) => {
      const siguiente = { ...prev };
      for (const [campo] of pendientes) siguiente[campo] = "subiendo";
      return siguiente;
    });

    const resultados = await Promise.allSettled(
      pendientes.map(([campo, archivo]) => subirDocumentoSolicitudConductor(cliente, solicitudId, TIPOS_DOCUMENTO[campo], archivo as File))
    );

    resultados.forEach((resultado,indice)=>{
      if (resultado.status==="rejected") {
        registrarTelemetria("documento_fallo",paso+1,TIPOS_DOCUMENTO[pendientes[indice][0]]);
      }
    });

    let huboError = false;
    setEstadoDocumentos((prev) => {
      const siguiente = { ...prev };
      resultados.forEach((resultado, indice) => {
        const [campo] = pendientes[indice];
        if (resultado.status === "fulfilled") {
          siguiente[campo] = "subido";
        } else {
          siguiente[campo] = "error";
          huboError = true;
        }
      });
      return siguiente;
    });

    if (huboError) {
      const camposConError = pendientes
        .filter((_, indice) => resultados[indice].status === "rejected")
        .map(([campo]) => ETIQUETA_DOCUMENTO[campo])
        .join(", ");
      throw new Error(`No pudimos subir: ${camposConError}. Podrás reintentar desde Configuración.`);
    }
  }

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
    await guardarBorradorConductor(cliente, contratoExpediente(), PASOS.length);
    await cargarDocumentos(cliente, solicitudId);
    const resultado=await enviarSolicitudConductor(cliente);
    registrarTelemetria("solicitud_enviada",PASOS.length,"enviado");
    return resultado;
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
      if (paso < PASOS.length - 1) {
        await prepararSolicitudBorrador(cliente);
        setPendienteOtp(false);
        setPaso((actual) => Math.min(actual + 1, PASOS.length - 1));
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
        limpiarBorradorRegistroLocal();
        setBorradorDisponible(null);
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
        setPaso(Math.min(Math.max((solicitud.paso_actual??1)-1,0),PASOS.length-1));
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
  },[router,registrarTelemetria]);

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

  // Fase 4 — detectar borrador guardado al montar.
  useEffect(() => {
    const timer = setTimeout(() => setBorradorDisponible(leerBorradorRegistroLocal()), 0);
    return () => clearTimeout(timer);
  }, []);

  // RT-20 — borrador local mínimo, únicamente antes de que exista sesión.
  useEffect(() => {
    if (enviado || pendienteOtp || sesionAutenticada) return;
    const hayContenido = [nombre, apellidos, telefono, email, codigoPostal].some((v) => v.trim());
    if (!hayContenido) return;

    const timer = setTimeout(() => {
      guardarBorradorRegistroLocal({ paso,nombre,apellidos,telefono,email,codigoPostal,estado,ciudad,colonia,tipoLicencia,vigenciaLicencia });
      setBorradorLocalGuardado(true);
    }, RETRASO_GUARDADO_LOCAL_MS);

    return () => clearTimeout(timer);
  }, [
    enviado, pendienteOtp, sesionAutenticada, paso, nombre, apellidos, telefono, email, codigoPostal, estado, ciudad,
    colonia, tipoLicencia, vigenciaLicencia
  ]);

  function restaurarBorrador() {
    const borrador = borradorDisponible;
    if (!borrador) return;

    setNombre(borrador.nombre ?? "");
    setApellidos(borrador.apellidos ?? "");
    setTelefono(soloDigitos(borrador.telefono ?? ""));
    setEmail(borrador.email ?? "");
    setCodigoPostal(soloDigitos(borrador.codigoPostal ?? "", 5));
    setEstado(borrador.estado ?? "");
    setCiudad(borrador.ciudad ?? "");
    setColonia(borrador.colonia ?? "");
    setTipoLicencia(borrador.tipoLicencia ?? "");
    setVigenciaLicencia(borrador.vigenciaLicencia ?? "");

    // CURP, contraseña, domicilio preciso, licencia, contacto y archivos se
    // recapturan porque no deben permanecer en localStorage.
    setPaso(0);
    setBorradorDisponible(null);

    // Repoblar los selects de ciudad/colonia que dependen del CP.
    const cp = soloDigitos(borrador.codigoPostal ?? "", 5);
    if (cp.length === 5) void buscarCodigoPostal(cp);
  }

  function descartarBorrador() {
    limpiarBorradorRegistroLocal();
    setBorradorDisponible(null);
  }

  return (
    <div className="conductor-auth-shell flex items-center justify-center px-4 py-10 sm:px-6">
      <section className="conductor-auth-card p-6 sm:p-8" aria-labelledby="titulo-registro-conductor">
        <div className="-mx-2 -mt-2 mb-6 overflow-hidden rounded-xl border border-route-action bg-surface-strong">
          <Image
            src="/imagenes/registro-conductor.png"
            alt="Vehículo con puntos de registro digital para la certificación de traslado"
            width={1222}
            height={1222}
            priority
            className="aspect-[16/9] w-full object-cover"
          />
        </div>

        <div className="flex items-center gap-3">
          <LogoMarca tamano={34} color="signal" />
          <div>
            <p className="font-display text-lg font-extrabold tracking-tight text-text-primary">
              ruum<span className="text-signal">ruum</span>
            </p>
            <p className="font-body text-xs font-semibold text-text-tertiary">ruum by Movilia</p>
          </div>
        </div>

        {pendienteOtp ? (
          <div className="py-4">
            <h1 id="titulo-registro-conductor" className="mt-4 font-display text-2xl font-bold text-text-primary">
              Confirma tu correo
            </h1>
            <p className="mt-3 font-body text-sm leading-6 text-text-secondary">
              Enviamos un código de {CODIGO_OTP_LONGITUD} dígitos a{" "}
              <span className="font-semibold text-text-primary">{email.trim().toLowerCase()}</span>. Escríbelo aquí para
              activar tu cuenta y subir tus documentos sin salir de la app.
            </p>

            <form className="mt-6 grid gap-4" onSubmit={confirmarCodigoOtp}>
              <Field
                etiqueta="Código de verificación"
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={CODIGO_OTP_LONGITUD}
                value={codigoOtp}
                onChange={(e) => {
                  setCodigoOtp(soloDigitos(e.target.value, CODIGO_OTP_LONGITUD));
                  if (errorOtp) setErrorOtp(null);
                }}
                ayuda="Revisa también tu carpeta de spam o promociones."
                required
              />

              {errorOtp && <Aviso tono="danger">{errorOtp}</Aviso>}

              <Button type="submit" loading={verificandoOtp} disabled={verificandoOtp || codigoOtp.length !== CODIGO_OTP_LONGITUD}>
                {verificandoOtp ? "Verificando…" : "Confirmar y activar"}
              </Button>

              <div className="flex flex-wrap items-center justify-between gap-2">
                <button
                  type="button"
                  onClick={() => void reenviarCodigoOtp()}
                  disabled={esperaReenvioOtp > 0 || reenviandoOtp}
                  className="inline-flex min-h-11 items-center font-body text-sm font-semibold text-route-action hover:underline disabled:cursor-not-allowed disabled:text-text-disabled disabled:no-underline"
                >
                  {reenviandoOtp
                    ? "Reenviando…"
                    : esperaReenvioOtp > 0
                      ? `Reenviar código (${esperaReenvioOtp}s)`
                      : "Reenviar código"}
                </button>
                <button
                  type="button"
                  onClick={() => router.push("/login")}
                  className="inline-flex min-h-11 items-center font-body text-sm text-text-secondary hover:text-text-primary hover:underline"
                >
                  Ya confirmé desde el enlace del correo
                </button>
              </div>
            </form>
          </div>
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

            <div className="mt-6 grid grid-cols-5 gap-2" aria-label="Progreso de registro">
              {PASOS.map((pasoInfo, indice) => (
                <button
                  key={pasoInfo.titulo}
                  type="button"
                  onClick={() => indice < paso && setPaso(indice)}
                  className={[
                    "h-2 rounded-full transition-colors",
                    indice <= paso ? "bg-signal" : "bg-surface-elevated",
                    indice < paso ? "cursor-pointer" : "cursor-default"
                  ].join(" ")}
                  aria-label={`Paso ${indice + 1}: ${pasoInfo.titulo}`}
                />
              ))}
            </div>
            <p className="mt-3 font-body text-sm font-semibold text-text-tertiary">
              Paso {paso + 1} de {PASOS.length} · {PASOS[paso].tiempo}
            </p>
            <div className="mt-2 rounded-xl border border-border bg-surface px-4 py-3">
              <p className="font-body text-sm font-semibold text-text-primary">{PASOS[paso].titulo}</p>
              <p className="mt-1 font-body text-sm leading-6 text-text-secondary">{PASOS[paso].objetivo}</p>
            </div>
            {!sesionAutenticada&&borradorLocalGuardado&&(
              <p className="mt-2 font-body text-xs font-medium text-text-secondary" role="status" aria-live="polite">
                Guardado en este dispositivo
              </p>
            )}
            {sesionAutenticada&&estadoGuardadoRemoto!=="inactivo"&&(
              <p className={`mt-2 font-body text-xs font-medium ${estadoGuardadoRemoto==="error"?"text-danger-action":estadoGuardadoRemoto==="sin_conexion"?"text-warning":"text-secondary"}`} role="status" aria-live="polite" title={detalleGuardadoRemoto??undefined}>
                {TEXTO_GUARDADO_REMOTO[estadoGuardadoRemoto]}
                {estadoGuardadoRemoto==="error"&&detalleGuardadoRemoto?`: ${detalleGuardadoRemoto}`:""}
              </p>
            )}

            {!tieneSupabaseConfigurado() && (
              <div className="mt-5">
                <Aviso tono="danger">Supabase no está configurado. El registro no está disponible en este entorno.</Aviso>
              </div>
            )}

            <form className="mt-6 grid gap-5" onSubmit={crearCuenta}>
              {paso === 0 && (
                <fieldset className="grid gap-4">
                  <legend className="font-display text-xl font-bold text-text-primary">Cuenta</legend>
                  <p className="font-body text-sm leading-6 text-text-secondary">
                    Usaremos este acceso para guardar tu avance y permitirte continuar después. Los documentos se pedirán cuando la cuenta esté verificada.
                  </p>
                  <Field etiqueta="Teléfono" ayuda="10 dígitos, sin lada internacional." type="tel" inputMode="numeric" value={formatoTelefonoNacional(telefono)} onChange={(e) => { setTelefono(soloDigitos(e.target.value)); limpiarErrorCampo("telefono"); }} onBlur={() => validarTelefono("telefono", telefono, setTelefono)} error={erroresCampos.telefono || undefined} required autoComplete="tel-national" />
                  <Field etiqueta="Correo electrónico" type="email" value={email} onChange={(e) => { setEmail(e.target.value); limpiarErrorCampo("email"); }} onBlur={() => validarCampo("email", email)} error={erroresCampos.email || undefined} required autoComplete="email" readOnly={sesionAutenticada} />
                  {!sesionAutenticada&&<div className="grid gap-4 sm:grid-cols-2">
                    <div className="flex flex-col gap-2">
                      <Field etiqueta="Crea tu contraseña" type="password" value={password} ayuda="Mínimo 8 caracteres, con al menos un número o una mayúscula." onChange={(e) => { const valor = e.target.value; setPassword(valor); limpiarErrorCampo("password"); if (confirmacionPassword) validarConfirmacion(confirmacionPassword, valor); }} onBlur={() => validarPassword()} error={erroresCampos.password || undefined} required minLength={8} autoComplete="new-password" />
                      {password.length > 0 && (
                        <div className="flex flex-col gap-1" aria-live="polite">
                          <div className="flex gap-1" aria-hidden>
                            {[1, 2, 3].map((n) => (
                              <div
                                key={n}
                                className={[
                                  "h-1 flex-1 rounded-full transition-all",
                                  n <= fuerzaPassword.nivel
                                    ? fuerzaPassword.nivel === 1
                                      ? "bg-danger"
                                      : fuerzaPassword.nivel === 2
                                        ? "bg-signal"
                                        : "bg-control"
                                    : "bg-surface-elevated"
                                ].join(" ")}
                              />
                            ))}
                          </div>
                          {fuerzaPassword.etiqueta && (
                            <span className="font-body text-xs leading-4 text-text-secondary">{fuerzaPassword.etiqueta}</span>
                          )}
                        </div>
                      )}
                    </div>
                    <Field etiqueta="Confirma tu contraseña" type="password" value={confirmacionPassword} onChange={(e) => { setConfirmacionPassword(e.target.value); validarConfirmacion(e.target.value, password); }} error={erroresCampos.confirmacionPassword || undefined} required minLength={8} autoComplete="new-password" />
                  </div>}
                </fieldset>
              )}

              {paso === 1 && (
                <fieldset className="grid gap-4">
                  <legend className="font-display text-xl font-bold text-text-primary">Identidad</legend>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Field etiqueta="Nombre (s)" value={nombre} onChange={(e) => { setNombre(e.target.value); limpiarErrorCampo("nombre"); }} onBlur={() => validarCampo("nombre", nombre)} error={erroresCampos.nombre || undefined} required autoComplete="given-name" />
                    <Field etiqueta="Apellido (s)" value={apellidos} onChange={(e) => { setApellidos(e.target.value); limpiarErrorCampo("apellidos"); }} onBlur={() => validarCampo("apellidos", apellidos)} error={erroresCampos.apellidos || undefined} required autoComplete="family-name" />
                  </div>
                  <Field etiqueta="CURP" value={curp} onChange={(e) => { setCurp(e.target.value.toUpperCase()); limpiarErrorCampo("curp"); }} onBlur={() => validarCurp()} error={erroresCampos.curp || undefined} required maxLength={18} autoComplete="off" />
                  <DatosSensiblesInfo tipo="curp" compacto />
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Field etiqueta="Código Postal" inputMode="numeric" value={codigoPostal} ayuda={consultandoCp ? "Buscando domicilio..." : "Al capturar 5 dígitos se completa el domicilio."} onChange={(e) => {
                      const cp = soloDigitos(e.target.value, 5);
                      setCodigoPostal(cp);
                      limpiarErrorCampo("codigoPostal");
                      if (cp.length < 5) {
                        setEstado("");
                        setCiudad("");
                        setCiudades([]);
                        setColonia("");
                        setColonias([]);
                      }
                      if (cp.length === 5) buscarCodigoPostal(cp);
                    }} error={erroresCampos.codigoPostal || undefined} required autoComplete="postal-code" />
                    <Field etiqueta="Estado" value={estado} onChange={(e) => { setEstado(e.target.value); limpiarErrorCampo("estado"); }} error={erroresCampos.estado || undefined} required autoComplete="address-level1" readOnly={colonias.length > 0} />
                  </div>
                  {ciudades.length > 0 ? (
                    <SelectField
                      etiqueta="Ciudad o Municipio"
                      value={ciudad}
                      onChange={(valor) => { setCiudad(valor); limpiarErrorCampo("ciudad"); }}
                      error={erroresCampos.ciudad || undefined}
                      required
                      placeholder="Selecciona tu ciudad o municipio"
                      opciones={ciudades}
                    />
                  ) : (
                    <Field etiqueta="Ciudad o Municipio" ayuda={colonias.length > 0 ? "Captura el municipio; este CP no lo devolvió automáticamente." : undefined} value={ciudad} onChange={(e) => { setCiudad(e.target.value); limpiarErrorCampo("ciudad"); }} error={erroresCampos.ciudad || undefined} required autoComplete="address-level2" />
                  )}
                  <SelectField
                    etiqueta="Colonia"
                    value={colonia}
                    onChange={(valor) => { setColonia(valor); limpiarErrorCampo("colonia"); }}
                    error={erroresCampos.colonia || undefined}
                    required
                    disabled={colonias.length === 0}
                    placeholder={colonias.length === 0 ? "Captura primero un código postal válido" : "Selecciona tu colonia"}
                    opciones={colonias}
                  />
                  <div className="grid gap-4 sm:grid-cols-[1fr_120px]">
                    <Field etiqueta="Calle" value={calle} onChange={(e) => { setCalle(e.target.value); limpiarErrorCampo("calle"); }} error={erroresCampos.calle || undefined} required autoComplete="address-line1" />
                    <Field etiqueta="Número" value={numero} onChange={(e) => { setNumero(e.target.value); limpiarErrorCampo("numero"); }} error={erroresCampos.numero || undefined} required />
                  </div>
                  <Field etiqueta="Referencias" value={referencias} onChange={(e) => { setReferencias(e.target.value); limpiarErrorCampo("referencias"); }} error={erroresCampos.referencias || undefined} required />
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Field etiqueta="Contacto de emergencia (nombre)" value={contactoEmergenciaNombre} onChange={(e) => { setContactoEmergenciaNombre(e.target.value); limpiarErrorCampo("contactoEmergenciaNombre"); }} error={erroresCampos.contactoEmergenciaNombre || undefined} required />
                    <Field etiqueta="Teléfono del contacto" type="tel" inputMode="numeric" value={formatoTelefonoNacional(contactoEmergenciaTelefono)} onChange={(e) => { setContactoEmergenciaTelefono(soloDigitos(e.target.value)); limpiarErrorCampo("contactoEmergenciaTelefono"); }} onBlur={() => validarTelefono("contactoEmergenciaTelefono", contactoEmergenciaTelefono, setContactoEmergenciaTelefono)} error={erroresCampos.contactoEmergenciaTelefono || undefined} required autoComplete="tel-national" />
                  </div>
                  <DatosSensiblesInfo tipo="contacto_emergencia" compacto />
                </fieldset>
              )}

              {paso === 2 && (
                <fieldset className="grid gap-4">
                  <legend className="font-display text-xl font-bold text-text-primary">Licencia y experiencia</legend>
                  <Field etiqueta="Número de licencia" value={numeroLicencia} onChange={(e) => { setNumeroLicencia(e.target.value); limpiarErrorCampo("numeroLicencia"); }} error={erroresCampos.numeroLicencia || undefined} required />
                  <div className="grid gap-4 sm:grid-cols-2">
                    <SelectField etiqueta="Tipo de licencia" value={tipoLicencia} onChange={(valor) => { setTipoLicencia(valor); limpiarErrorCampo("tipoLicencia"); }} error={erroresCampos.tipoLicencia || undefined} required placeholder="Selecciona el tipo de licencia" opciones={TIPOS_LICENCIA} />
                    <Field
                      etiqueta="Vigencia"
                      value={vigenciaLicencia}
                      ayuda="Formato AAAA-MM-DD."
                      inputMode="numeric"
                      placeholder="2027-07-15"
                      pattern="\\d{4}-\\d{2}-\\d{2}"
                      maxLength={10}
                      onChange={(e) => {
                        setVigenciaLicencia(formatoFechaIsoParcial(e.target.value));
                        limpiarErrorCampo("vigenciaLicencia");
                      }}
                      onBlur={() => validarVigenciaLicencia()}
                      error={erroresCampos.vigenciaLicencia || undefined}
                      required
                    />
                  </div>
                  {vigenciaLicencia && !erroresCampos.vigenciaLicencia && diasParaVencerLicencia(vigenciaLicencia) >= 0 && diasParaVencerLicencia(vigenciaLicencia) <= DIAS_ADVERTENCIA_VIGENCIA && (
                    <Aviso tono="atencion">
                      Tu licencia vence en {diasParaVencerLicencia(vigenciaLicencia)} día{diasParaVencerLicencia(vigenciaLicencia) === 1 ? "" : "s"}. Puedes continuar, pero procura renovarla pronto para no perder actividad.
                    </Aviso>
                  )}
                  <DatosSensiblesInfo tipo="licencia" compacto />
                  <label className="flex gap-3 rounded-xl border border-border bg-surface p-4 font-body text-sm leading-6 text-text-secondary">
                    <input type="checkbox" checked={autorizaVerificacion} onChange={(e) => { setAutorizaVerificacion(e.target.checked); limpiarErrorCampo("autorizaVerificacion"); }} className="mt-1 size-4 accent-route-dark" />
                    <span>Autorizo la verificación de antecedentes y de mi historial de manejo ante las autoridades correspondientes.</span>
                  </label>
                  {erroresCampos.autorizaVerificacion && <p className="font-body text-xs font-medium text-danger-action">{erroresCampos.autorizaVerificacion}</p>}
                  <label className="flex gap-3 rounded-xl border border-border bg-surface p-4 font-body text-sm leading-6 text-text-secondary">
                    <input type="checkbox" checked={declaraSinSuspensiones} onChange={(e) => { setDeclaraSinSuspensiones(e.target.checked); limpiarErrorCampo("declaraSinSuspensiones"); }} className="mt-1 size-4 accent-route-dark" />
                    <span>Declaro que no tengo suspensiones vigentes de licencia ni procesos legales activos relacionados con el manejo de vehículos.</span>
                  </label>
                  {erroresCampos.declaraSinSuspensiones && <p className="font-body text-xs font-medium text-danger-action">{erroresCampos.declaraSinSuspensiones}</p>}
                </fieldset>
              )}

              {paso === 3 && (
                <fieldset className="grid gap-4">
                  <legend className="font-display text-xl font-bold text-text-primary">Documentos</legend>
                  <DatosSensiblesInfo tipo="documentos" compacto />
                  {!sesionAutenticada ? (
                    <Aviso tono="atencion">
                      Primero confirma tu cuenta. Después podrás cargar documentos y continuar desde cualquier dispositivo.
                    </Aviso>
                  ) : (
                    <>
                      <CampoDocumento
                        etiqueta="Foto de tu licencia (frente)"
                        archivo={documentos.licenciaFrente}
                        estado={estadoDocumentos.licenciaFrente}
                        error={erroresCampos.licenciaFrente || undefined}
                        onSeleccionar={(archivo) => cambiarDocumento("licenciaFrente", archivo)}
                      />
                      <CampoDocumento
                        etiqueta="Foto de tu licencia (reverso)"
                        archivo={documentos.licenciaReverso}
                        estado={estadoDocumentos.licenciaReverso}
                        error={erroresCampos.licenciaReverso || undefined}
                        onSeleccionar={(archivo) => cambiarDocumento("licenciaReverso", archivo)}
                      />
                      <CampoDocumento
                        etiqueta="Foto de tu Identificación oficial (INE/pasaporte)"
                        archivo={documentos.identificacionOficial}
                        estado={estadoDocumentos.identificacionOficial}
                        error={erroresCampos.identificacionOficial || undefined}
                        onSeleccionar={(archivo) => cambiarDocumento("identificacionOficial", archivo)}
                      />
                    </>
                  )}
                  {erroresCampos.cuentaVerificada && <p className="font-body text-xs font-medium text-danger-action">{erroresCampos.cuentaVerificada}</p>}
                </fieldset>
              )}

              {paso === 4 && (
                <fieldset className="grid gap-4">
                  <legend className="font-display text-xl font-bold text-text-primary">Revisa tu información</legend>
                  <p className="font-body text-sm leading-6 text-text-secondary">Verifica que todo sea correcto antes de enviar tu registro.</p>
                  <div className="grid gap-3 rounded-xl border border-border bg-surface p-4 font-body text-sm text-text-secondary">
                    <Resumen titulo="Cuenta" valores={[formatoTelefonoNacional(telefono), email.trim().toLowerCase(), sesionAutenticada ? "Cuenta verificada" : "Cuenta pendiente de verificación"]} onEditar={() => setPaso(0)} />
                    <Resumen titulo="Identidad" valores={[nombreCompleto, `CURP ${enmascararUltimos(curp.trim().toUpperCase())}`, `${calle} ${numero}`, `${colonia}, ${ciudad}`, `${estado}, C.P. ${codigoPostal}`, referencias, `Emergencia: contacto registrado · ${enmascararUltimos(contactoEmergenciaTelefono)}`]} onEditar={() => setPaso(1)} />
                    <Resumen titulo="Licencia y experiencia" valores={[`Licencia ${enmascararUltimos(numeroLicencia)}`, `Tipo ${tipoLicencia}`, `Vigente hasta ${vigenciaLicencia}`, autorizaVerificacion ? "Autoriza verificación de antecedentes" : "Verificación pendiente", declaraSinSuspensiones ? "Sin suspensiones ni procesos activos declarados" : "Declaración pendiente"]} onEditar={() => setPaso(2)} />
                    <Resumen titulo="Documentos" valores={[documentos.licenciaFrente?.name ? enmascararNombreArchivo(documentos.licenciaFrente.name) : (documentosRemotos.has("licencia_frente") ? "Licencia frente guardada" : "Licencia frente pendiente"), documentos.licenciaReverso?.name ? enmascararNombreArchivo(documentos.licenciaReverso.name) : (documentosRemotos.has("licencia_reverso") ? "Licencia reverso guardada" : "Licencia reverso pendiente"), documentos.identificacionOficial?.name ? enmascararNombreArchivo(documentos.identificacionOficial.name) : (documentosRemotos.has("identificacion_oficial") ? "Identificación guardada" : "Identificación pendiente")]} onEditar={() => setPaso(3)} />
                  </div>
                  <label className="flex gap-3 rounded-xl border border-route-action/20 bg-route-soft p-4 font-body text-sm leading-6 text-text-secondary">
                    <input type="checkbox" checked={aceptaTerminos} onChange={(e) => { setAceptaTerminos(e.target.checked); limpiarErrorCampo("aceptaTerminos"); }} className="mt-1 size-4 accent-route-dark" />
                    <span>
                      He leído y acepto los{" "}
                      <a href="/legal/terminos" target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()} className="font-semibold text-route-action underline underline-offset-2 hover:no-underline">
                        términos y condiciones
                      </a>{" "}
                      de ruum ruum by Movilia.
                    </span>
                  </label>
                  {erroresCampos.aceptaTerminos && <p className="font-body text-xs font-medium text-danger-action">{erroresCampos.aceptaTerminos}</p>}
                  <label className="flex gap-3 rounded-xl border border-route-action/20 bg-route-soft p-4 font-body text-sm leading-6 text-text-secondary">
                    <input type="checkbox" checked={confirmaPrivacidad} onChange={(e) => { setConfirmaPrivacidad(e.target.checked); limpiarErrorCampo("confirmaPrivacidad"); }} className="mt-1 size-4 accent-route-dark" />
                    <span>
                      Confirmo que he leído el{" "}
                      <a href="/legal/privacidad" target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()} className="font-semibold text-route-action underline underline-offset-2 hover:no-underline">
                        aviso de privacidad
                      </a>{" "}
                      de ruum ruum by Movilia.
                    </span>
                  </label>
                  {erroresCampos.confirmaPrivacidad && <p className="font-body text-xs font-medium text-danger-action">{erroresCampos.confirmaPrivacidad}</p>}
                </fieldset>
              )}

              {error && <Aviso tono="danger">{error}</Aviso>}

              <div className="grid gap-3 sm:grid-cols-2">
                {paso > 0 && <Button type="button" variant="secondary" onClick={volver}>Atrás</Button>}
                {paso < PASOS.length - 1 ? (
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
      </section>
    </div>
  );
}

function SelectField({
  etiqueta,
  value,
  onChange,
  opciones,
  placeholder,
  error,
  required,
  disabled
}: {
  etiqueta: string;
  value: string;
  onChange: (valor: string) => void;
  opciones: string[];
  placeholder: string;
  error?: string;
  required?: boolean;
  disabled?: boolean;
}) {
  const id = useId();

  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="font-body text-sm font-semibold text-text-primary">
        {etiqueta}
        {required ? <span className="ml-1 text-danger-action" aria-hidden> *</span> : null}
      </label>
      <select
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        required={required}
        aria-invalid={Boolean(error)}
        className={[
          "w-full min-h-12 rounded-[10px] border bg-surface px-3.5 py-2.5 font-body text-base text-text-primary shadow-[inset_0_1px_0_rgba(26,31,46,0.02)]",
          "transition-[border-color,box-shadow,background-color] duration-150 hover:border-border-strong focus:border-route-action focus:outline-none focus:ring-[3px] focus:ring-route-action/20",
          error ? "border-danger-action bg-danger-soft/20 focus:border-danger-action focus:ring-danger/15" : "border-border-strong",
          "disabled:cursor-not-allowed disabled:border-border disabled:bg-surface-elevated disabled:text-text-tertiary"
        ].join(" ")}
      >
        <option value="">{placeholder}</option>
        {opciones.map((opcion) => (
          <option key={opcion} value={opcion}>{opcion}</option>
        ))}
      </select>
      {error ? <p role="alert" className="font-body text-sm font-medium leading-5 text-danger-action">{error}</p> : null}
    </div>
  );
}

function textoEstadoDocumento(estado: EstadoDocumento, nombreArchivo: string) {
  const nombreProtegido = enmascararNombreArchivo(nombreArchivo);
  return {
    pendiente: "",
    listo: `Listo para subir: ${nombreProtegido}`,
    subiendo: `Subiendo: ${nombreProtegido}`,
    subido: `Subido correctamente: ${nombreProtegido}`,
    error: nombreArchivo ? `Error al subir: ${nombreProtegido}` : "Error en el archivo seleccionado"
  }[estado];
}

/**
 * Fase 3 — campo de documento con preview de imagen antes de enviar (para que el
 * conductor confirme que la foto no salió borrosa) y botón "Tomar otra foto" que
 * reemplaza solo ese documento, sin reiniciar el resto del wizard.
 */
function CampoDocumento({
  etiqueta,
  archivo,
  estado,
  error,
  onSeleccionar
}: {
  etiqueta: string;
  archivo: File | null;
  estado: EstadoDocumento;
  error?: string;
  onSeleccionar: (archivo: File | null) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const previewUrl = useMemo(() => {
    if (!archivo || !archivo.type.startsWith("image/")) return null;
    return URL.createObjectURL(archivo);
  }, [archivo]);

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  const colorTexto = estado === "error" ? "text-danger-action" : estado === "subido" ? "text-success" : "text-text-secondary";

  return (
    <div className="flex flex-col gap-1.5">
      <label className="font-body text-sm font-semibold text-text-primary">
        {etiqueta}
        <span className="ml-1 text-danger-action" aria-hidden> *</span>
      </label>
      <input
        ref={inputRef}
        type="file"
        accept="image/*,.pdf"
        capture="environment"
        className="hidden"
        onChange={(e) => {
          onSeleccionar(e.target.files?.[0] ?? null);
          e.target.value = "";
        }}
      />

      {archivo ? (
        <div
          className={[
            "flex items-center gap-3 rounded-[10px] border bg-surface px-3.5 py-2.5",
            error ? "border-danger-action bg-danger-soft/20" : "border-border-strong"
          ].join(" ")}
        >
          {previewUrl ? (
            // eslint-disable-next-line @next/next/no-img-element -- preview local de un File antes de subir, next/image no soporta blob: directamente
            <img src={previewUrl} alt="" className="size-12 shrink-0 rounded-lg object-cover" />
          ) : (
            <div className="flex size-12 shrink-0 items-center justify-center rounded-lg bg-surface-elevated font-body text-xs font-semibold text-text-tertiary" aria-hidden>
              PDF
            </div>
          )}
          <div className="min-w-0 flex-1">
            <p className="truncate font-body text-sm text-text-primary">{enmascararNombreArchivo(archivo.name)}</p>
            {estado !== "pendiente" && (
              <p className={`font-body text-sm font-medium leading-5 ${colorTexto}`}>
                {textoEstadoDocumento(estado, archivo.name)}
              </p>
            )}
          </div>
          <Button type="button" variant="quiet" onClick={() => inputRef.current?.click()}>
            Tomar otra foto
          </Button>
        </div>
      ) : estado==="subido" ? (
        <div className="rounded-[10px] border border-success bg-control-soft px-3.5 py-3">
          <p className="font-body text-sm font-semibold text-success">Documento guardado en tu expediente</p>
          <p className="mt-1 font-body text-sm text-text-secondary">No necesitas volver a cargarlo en este dispositivo.</p>
        </div>
      ) : (
        <Button type="button" variant="secondary" onClick={() => inputRef.current?.click()}>
          Elegir o tomar foto
        </Button>
      )}

      {error ? (
        <p role="alert" className="font-body text-sm font-medium leading-5 text-danger-action">{error}</p>
      ) : null}
    </div>
  );
}

function Resumen({ titulo, valores, onEditar }: { titulo: string; valores: Array<string | undefined>; onEditar?: () => void }) {
  return (
    <div className="border-b border-border pb-3 last:border-0 last:pb-0">
      <div className="flex items-center justify-between gap-3">
        <p className="font-body text-sm font-semibold text-text-tertiary">{titulo}</p>
        {onEditar && (
          <button type="button" onClick={onEditar} className="inline-flex min-h-11 items-center font-body text-sm font-semibold text-route-action underline-offset-4 hover:underline">
            Editar
          </button>
        )}
      </div>
      <ul className="mt-2 grid gap-1">
        {valores.filter(Boolean).map((valor) => (
          <li key={valor} className="font-body text-sm text-text-secondary">{valor}</li>
        ))}
      </ul>
    </div>
  );
}
