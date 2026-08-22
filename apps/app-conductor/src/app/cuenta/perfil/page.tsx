"use client";

import { ConfirmDialog } from "../../../components/ConfirmDialog";

import { ChangeEvent, useEffect, useState } from "react";
import Image from "next/image";
import { Aviso, Button, Card } from "@ruum/ui";
import { actualizarPerfilConductor, subirFotoPerfilConductor } from "@ruum/api/services";
import { consultarCodigoPostalMx, traducirErrorOperativo, type DatosCodigoPostal } from "@ruum/shared/utils";
import { crearClienteNavegador } from "../../../lib/supabase-browser";
import { CuentaHeader } from "../CuentaHeader";
import { cargarConductorCuenta, telefonoE164, type ConductorCuenta } from "../cuenta-utils";
import { DatosSensiblesTooltip, enmascararUltimos, type TipoDatoSensible } from "../datos-sensibles";

const PERFIL_DEFAULT = {
  nombre: "",
  email: "",
  telefono: "",
  curp: "",
  licencia_numero: "",
  licencia_tipo: "",
  licencia_vigencia: "",
  codigo_postal: "",
  estado_residencia: "",
  ciudad_municipio: "",
  colonia: "",
  calle: "",
  numero: "",
  referencias: "",
  contacto_emergencia_nombre: "",
  contacto_emergencia_telefono: ""
};

type CampoPerfil = keyof typeof PERFIL_DEFAULT;
type CampoSensiblePerfil = "curp" | "licencia_numero" | "contacto_emergencia_nombre" | "contacto_emergencia_telefono";
type IdPestana = "identidad" | "documentacion" | "ubicacion";

type NotificacionPerfil = { tipo: "success" | "error" | "info"; mensaje: string } | null;

const PESTANAS: { id: IdPestana; titulo: string; icono: string; descripcion: string; campos: CampoPerfil[] }[] = [
  {
    id: "identidad",
    titulo: "Identidad",
    icono: "👤",
    descripcion: "Fotografía, datos personales, correo y teléfono de contacto",
    campos: ["nombre", "email", "telefono", "curp"]
  },
  {
    id: "documentacion",
    titulo: "Documentación",
    icono: "📄",
    descripcion: "Licencia de conducir y vigencia operativa",
    campos: ["licencia_numero", "licencia_tipo", "licencia_vigencia"]
  },
  {
    id: "ubicacion",
    titulo: "Ubicación y emergencia",
    icono: "📍",
    descripcion: "Domicilio particular y contacto de emergencia",
    campos: [
      "codigo_postal",
      "estado_residencia",
      "ciudad_municipio",
      "colonia",
      "calle",
      "numero",
      "referencias",
      "contacto_emergencia_nombre",
      "contacto_emergencia_telefono"
    ]
  }
];

const CAMPO_CONFIG: Record<CampoPerfil, { etiqueta: string; tipo?: string; colSpan?: string; placeholder?: string }> = {
  nombre: { etiqueta: "Nombre completo", placeholder: "Ej. Juan Pérez López" },
  email: { etiqueta: "Correo electrónico", tipo: "email", placeholder: "correo@ejemplo.com" },
  telefono: { etiqueta: "Teléfono", placeholder: "10 dígitos" },
  curp: { etiqueta: "CURP", placeholder: "18 caracteres" },
  licencia_numero: { etiqueta: "Número de licencia", placeholder: "Ej. B12345678" },
  licencia_tipo: { etiqueta: "Tipo de licencia" },
  licencia_vigencia: { etiqueta: "Vigencia de licencia", tipo: "date" },
  codigo_postal: { etiqueta: "Código postal", placeholder: "5 dígitos" },
  estado_residencia: { etiqueta: "Estado", placeholder: "Estado de residencia" },
  ciudad_municipio: { etiqueta: "Ciudad o municipio", placeholder: "Municipio" },
  colonia: { etiqueta: "Colonia", placeholder: "Nombre de colonia" },
  calle: { etiqueta: "Calle", placeholder: "Calle principal" },
  numero: { etiqueta: "Número", placeholder: "Ext. / Int." },
  referencias: { etiqueta: "Referencias", colSpan: "sm:col-span-2", placeholder: "Entre qué calles o referencias visuales" },
  contacto_emergencia_nombre: { etiqueta: "Contacto de emergencia", placeholder: "Nombre del familiar o contacto" },
  contacto_emergencia_telefono: { etiqueta: "Teléfono de emergencia", placeholder: "10 dígitos" }
};

const CAMPOS_SENSIBLES = new Set<CampoPerfil>(["curp", "licencia_numero", "contacto_emergencia_nombre", "contacto_emergencia_telefono"]);
const CAMPOS_SOLO_LECTURA = new Set<CampoPerfil>(["licencia_tipo"]);

function tipoDatoSensibleCampo(campo: CampoPerfil): TipoDatoSensible | null {
  if (campo === "curp") return "curp";
  if (campo === "licencia_numero" || campo === "licencia_tipo" || campo === "licencia_vigencia") return "licencia";
  if (campo === "contacto_emergencia_nombre" || campo === "contacto_emergencia_telefono") return "contacto_emergencia";
  return null;
}

function perfilDesdeConductor(conductor: ConductorCuenta | null) {
  return {
    nombre: conductor?.nombre ?? "",
    email: conductor?.email ?? "",
    telefono: conductor?.telefono ?? "",
    curp: conductor?.curp ?? "",
    licencia_numero: conductor?.licencia_numero ?? "",
    licencia_tipo: conductor?.licencia_tipo ?? "",
    licencia_vigencia: conductor?.licencia_vigencia ?? "",
    codigo_postal: conductor?.codigo_postal ?? "",
    estado_residencia: conductor?.estado_residencia ?? "",
    ciudad_municipio: conductor?.ciudad_municipio ?? "",
    colonia: conductor?.colonia ?? "",
    calle: conductor?.calle ?? "",
    numero: conductor?.numero ?? "",
    referencias: conductor?.referencias ?? "",
    contacto_emergencia_nombre: conductor?.contacto_emergencia_nombre ?? "",
    contacto_emergencia_telefono: conductor?.contacto_emergencia_telefono ?? ""
  };
}

function evaluarValidacionInline(clave: CampoPerfil, valor: string): { esValido: boolean | null; mensaje?: string } {
  const limpio = valor.trim();
  if (!limpio) return { esValido: null };

  switch (clave) {
    case "email": {
      const ok = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(limpio);
      return { esValido: ok, mensaje: ok ? "Formato válido" : "Formato de correo inválido" };
    }
    case "telefono":
    case "contacto_emergencia_telefono": {
      const digitos = limpio.replace(/\D/g, "");
      const ok = digitos.length === 10 || (digitos.length === 12 && digitos.startsWith("52"));
      return { esValido: ok, mensaje: ok ? "Formato válido" : "Ingresa 10 dígitos" };
    }
    case "curp": {
      const ok = /^[A-Z]{4}\d{6}[HM][A-Z]{5}[0-9A-Z]\d$/i.test(limpio);
      return { esValido: ok, mensaje: ok ? "CURP válida" : "Deben ser 18 caracteres" };
    }
    case "licencia_numero": {
      const ok = limpio.length >= 5;
      return { esValido: ok, mensaje: ok ? "Válido" : "Mínimo 5 caracteres" };
    }
    case "licencia_vigencia": {
      const fecha = new Date(limpio);
      const hoy = new Date();
      hoy.setHours(0, 0, 0, 0);
      const ok = !isNaN(fecha.getTime()) && fecha >= hoy;
      return { esValido: ok, mensaje: ok ? "Vigente" : "La fecha no debe estar vencida" };
    }
    case "codigo_postal": {
      const ok = /^\d{5}$/.test(limpio);
      return { esValido: ok, mensaje: ok ? "Código de 5 dígitos" : "Debe tener 5 dígitos" };
    }
    case "nombre":
    case "contacto_emergencia_nombre": {
      const ok = limpio.length >= 3;
      return { esValido: ok };
    }
    default:
      return { esValido: null };
  }
}

export default function PaginaPerfilCuenta() {
  const [confirmacionAbierta, setConfirmacionAbierta] = useState(false);
  const [conductor, setConductor] = useState<ConductorCuenta | null>(null);
  const [perfil, setPerfil] = useState(PERFIL_DEFAULT);
  const [sensiblesEditados, setSensiblesEditados] = useState<Set<CampoSensiblePerfil>>(new Set());
  const [notificacion, setNotificacion] = useState<NotificacionPerfil>(null);
  const [errorCarga, setErrorCarga] = useState<string | null>(null);
  const [cargando, setCargando] = useState(true);
  const [subiendoFoto, setSubiendoFoto] = useState(false);
  const [vistaPreviaFoto, setVistaPreviaFoto] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);
  const [pestanaActiva, setPestanaActiva] = useState<IdPestana>("identidad");

  // Autocompletado inteligente de CP (SEPOMEX)
  const [buscandoCp, setBuscandoCp] = useState(false);
  const [coloniasDisponibles, setColoniasDisponibles] = useState<string[]>([]);
  const [cpDetectado, setCpDetectado] = useState(false);

  async function cargar() {
    try {
      const actual = await cargarConductorCuenta();
      setConductor(actual);
      const siguiente = perfilDesdeConductor(actual);
      siguiente.curp = "";
      siguiente.licencia_numero = "";
      siguiente.contacto_emergencia_nombre = "";
      siguiente.contacto_emergencia_telefono = "";
      setPerfil(siguiente);
      setSensiblesEditados(new Set());
      setVistaPreviaFoto(null);
      setErrorCarga(null);
    } catch {
      setErrorCarga("No se pudieron cargar tus datos. Inténtalo de nuevo.");
    } finally {
      setCargando(false);
    }
  }

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void cargar();
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!notificacion) return;
    const timer = window.setTimeout(() => setNotificacion(null), 4200);
    return () => window.clearTimeout(timer);
  }, [notificacion]);

  // Consulta automática de CP cuando el usuario escribe 5 dígitos
  async function manejarCambioCp(valorCp: string) {
    const limpio = valorCp.replace(/\D/g, "").slice(0, 5);
    setPerfil((actual) => ({ ...actual, codigo_postal: limpio }));

    if (limpio.length === 5) {
      setBuscandoCp(true);
      try {
        const resultado: DatosCodigoPostal | null = await consultarCodigoPostalMx(limpio);
        if (resultado) {
          setPerfil((actual) => ({
            ...actual,
            estado_residencia: resultado.estado,
            ciudad_municipio: resultado.ciudades[0] ?? actual.ciudad_municipio,
            colonia: resultado.colonias.includes(actual.colonia)
              ? actual.colonia
              : resultado.colonias[0] ?? actual.colonia
          }));
          setColoniasDisponibles(resultado.colonias);
          setCpDetectado(true);
        } else {
          setColoniasDisponibles([]);
          setCpDetectado(false);
        }
      } catch {
        setColoniasDisponibles([]);
        setCpDetectado(false);
      } finally {
        setBuscandoCp(false);
      }
    } else {
      setColoniasDisponibles([]);
      setCpDetectado(false);
    }
  }

  async function guardarPerfil() {
    if (!conductor || guardando) return;
    if (sensiblesEditados.size > 0 && !confirmacionAbierta) {
      setConfirmacionAbierta(true);
      return;
    }
    setConfirmacionAbierta(false);
    setNotificacion(null);
    setGuardando(true);
    try {
      const cliente = crearClienteNavegador();
      const perfilParaGuardar = {
        ...perfil,
        curp: sensiblesEditados.has("curp") ? perfil.curp : conductor.curp ?? "",
        licencia_numero: sensiblesEditados.has("licencia_numero") ? perfil.licencia_numero : conductor.licencia_numero ?? "",
        contacto_emergencia_nombre: sensiblesEditados.has("contacto_emergencia_nombre") ? perfil.contacto_emergencia_nombre : conductor.contacto_emergencia_nombre ?? "",
        contacto_emergencia_telefono: sensiblesEditados.has("contacto_emergencia_telefono") ? perfil.contacto_emergencia_telefono : conductor.contacto_emergencia_telefono ?? ""
      };
      if (perfil.email.trim() && perfil.email.trim().toLowerCase() !== (conductor.email ?? "").toLowerCase()) {
        const { error: errorAuthEmail } = await cliente.auth.updateUser({ email: perfil.email.trim() });
        if (errorAuthEmail) throw errorAuthEmail;
      }
      await actualizarPerfilConductor(cliente, conductor.id, {
        ...perfilParaGuardar,
        telefono: telefonoE164(perfilParaGuardar.telefono),
        contacto_emergencia_telefono: telefonoE164(perfilParaGuardar.contacto_emergencia_telefono)
      });
      await cargar();
      setNotificacion({ tipo: "success", mensaje: "Perfil actualizado correctamente." });
    } catch (error) {
      setNotificacion({ tipo: "error", mensaje: traducirErrorOperativo(error, "No se pudo actualizar el perfil.") });
    } finally {
      setGuardando(false);
    }
  }

  async function subirFotoPerfil(evento: ChangeEvent<HTMLInputElement>) {
    const archivo = evento.target.files?.[0];
    if (!archivo || !conductor) return;

    // Vista previa instantánea
    const urlTemp = URL.createObjectURL(archivo);
    setVistaPreviaFoto(urlTemp);

    setNotificacion(null);
    setSubiendoFoto(true);
    try {
      const cliente = crearClienteNavegador();
      const fotoUrl = await subirFotoPerfilConductor(cliente, conductor.id, archivo);
      setConductor({ ...conductor, foto_perfil_url: fotoUrl });
      setNotificacion({ tipo: "success", mensaje: "Fotografía de perfil actualizada." });
      setVistaPreviaFoto(null);
      URL.revokeObjectURL(urlTemp);
    } catch (error) {
      setNotificacion({ tipo: "error", mensaje: traducirErrorOperativo(error, "No pudimos actualizar la fotografía de perfil.") });
      setVistaPreviaFoto(null);
      URL.revokeObjectURL(urlTemp);
    } finally {
      setSubiendoFoto(false);
      evento.target.value = "";
    }
  }

  useEffect(() => {
    return () => {
      if (vistaPreviaFoto) URL.revokeObjectURL(vistaPreviaFoto);
    };
  }, [vistaPreviaFoto]);

  function placeholderSensible(campo: CampoPerfil) {
    if (!conductor) return "";
    if (campo === "curp") return conductor.curp ? enmascararUltimos(conductor.curp) : "";
    if (campo === "licencia_numero") return conductor.licencia_numero ? enmascararUltimos(conductor.licencia_numero) : "";
    if (campo === "contacto_emergencia_nombre") return conductor.contacto_emergencia_nombre ? enmascararUltimos(conductor.contacto_emergencia_nombre, 2) : "";
    if (campo === "contacto_emergencia_telefono") return conductor.contacto_emergencia_telefono ? enmascararUltimos(conductor.contacto_emergencia_telefono) : "";
    return "";
  }

  function valorSensibleExiste(campo: CampoPerfil) {
    if (!conductor) return false;
    if (campo === "curp") return Boolean(conductor.curp);
    if (campo === "licencia_numero") return Boolean(conductor.licencia_numero);
    if (campo === "contacto_emergencia_nombre") return Boolean(conductor.contacto_emergencia_nombre);
    if (campo === "contacto_emergencia_telefono") return Boolean(conductor.contacto_emergencia_telefono);
    return false;
  }

  function claseToast(tipo: NonNullable<NotificacionPerfil>["tipo"]) {
    if (tipo === "success") return "border-success/35 bg-success/12 text-text-primary";
    if (tipo === "error") return "border-danger-action/38 bg-danger-action/12 text-text-primary";
    return "border-route-action/35 bg-surface-elevated text-text-primary";
  }

  // Comprueba si hay cambios reales en el formulario respecto al objeto conductor
  const hayCambiosReales = Boolean(
    conductor && (
      perfil.nombre.trim() !== (conductor.nombre ?? "") ||
      perfil.email.trim().toLowerCase() !== (conductor.email ?? "").toLowerCase() ||
      perfil.telefono.trim() !== (conductor.telefono ?? "") ||
      perfil.codigo_postal.trim() !== (conductor.codigo_postal ?? "") ||
      perfil.estado_residencia.trim() !== (conductor.estado_residencia ?? "") ||
      perfil.ciudad_municipio.trim() !== (conductor.ciudad_municipio ?? "") ||
      perfil.colonia.trim() !== (conductor.colonia ?? "") ||
      perfil.calle.trim() !== (conductor.calle ?? "") ||
      perfil.numero.trim() !== (conductor.numero ?? "") ||
      perfil.referencias.trim() !== (conductor.referencias ?? "") ||
      perfil.licencia_vigencia.trim() !== (conductor.licencia_vigencia ?? "") ||
      sensiblesEditados.size > 0
    )
  );

  const seccionActual = PESTANAS.find((p) => p.id === pestanaActiva) ?? PESTANAS[0];

  return (
    <>
      <ConfirmDialog
        open={confirmacionAbierta}
        title="Guardar cambios sensibles"
        consequence="Operación podría revisar nuevamente tu expediente antes de aprobar los cambios."
        maskedData={[`Campos modificados: ${sensiblesEditados.size}`]}
        confirmLabel="Guardar y enviar a revisión"
        busy={guardando}
        onCancel={() => setConfirmacionAbierta(false)}
        onConfirm={() => void guardarPerfil()}
      />

      <div className="mx-auto w-full max-w-3xl px-4 py-8 pb-28 sm:px-6 sm:py-12 sm:pb-14">
        <CuentaHeader titulo="Perfil del Conductor" descripcion="Administra tus datos personales, documentación y contactos operativos." />

        {notificacion && (
          <div
            aria-live="polite"
            aria-atomic="true"
            className={`conductor-toast-bottom fixed inset-x-4 z-50 rounded-xl border px-4 py-3 font-body text-sm font-semibold shadow-[0_18px_48px_rgba(0,0,0,0.42)] sm:left-auto sm:right-6 sm:max-w-sm ${claseToast(notificacion.tipo)}`}
            style={{ bottom: "calc(var(--conductor-mobile-nav-offset,80px) + env(safe-area-inset-bottom) + 16px)" }}
          >
            {notificacion.mensaje}
          </div>
        )}

        {/* 1. Alertas accionables destacadas */}
        {sensiblesEditados.size > 0 && (
          <div className="mt-6 flex flex-col gap-3 rounded-2xl border border-amber-500/40 bg-amber-500/10 p-4 font-body text-sm text-amber-900 dark:text-amber-200 sm:flex-row sm:items-center sm:justify-between shadow-sm">
            <div className="flex items-start gap-3">
              <div className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full bg-amber-500/20 font-bold text-amber-600 dark:text-amber-300">
                ⚠️
              </div>
              <div>
                <p className="font-display font-extrabold text-amber-950 dark:text-amber-100">
                  Acción requerida para confirmar cambios
                </p>
                <p className="mt-0.5 text-xs font-medium text-amber-900/90 dark:text-amber-200/90">
                  Has modificado {sensiblesEditados.size} {sensiblesEditados.size === 1 ? "campo sensible" : "campos sensibles"}. Al guardar, tu perfil será enviado a revisión operativa.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => void guardarPerfil()}
              className="inline-flex shrink-0 items-center justify-center rounded-xl bg-amber-500 px-4 py-2.5 font-display text-xs font-bold text-slate-950 transition hover:bg-amber-400 active:scale-95 shadow-xs"
            >
              Solucionar ahora
            </button>
          </div>
        )}

        {/* 3. Carga de fotografía de perfil moderna */}
        <Card className="mt-6">
          {cargando ? (
            <div className="py-8 text-center font-body text-sm text-text-secondary">Cargando perfil...</div>
          ) : errorCarga ? (
            <div className="py-8 text-center">
              <Aviso tono="danger">{errorCarga}</Aviso>
            </div>
          ) : (
            <div className="grid gap-6">
              <div className="flex flex-col items-center gap-4 rounded-2xl border border-border/40 bg-surface-elevated/40 p-4 sm:p-5 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex flex-col sm:flex-row items-center gap-4 w-full sm:w-auto">
                  <div className="relative group flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-full border-2 border-signal bg-signal-soft font-display text-2xl font-bold text-text-primary shadow-md transition hover:opacity-90">
                    {vistaPreviaFoto || conductor?.foto_perfil_url ? (
                      <Image
                        src={vistaPreviaFoto || conductor?.foto_perfil_url || ""}
                        alt="Fotografía del conductor"
                        width={80}
                        height={80}
                        sizes="80px"
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      (perfil.nombre || "CD").slice(0, 2).toUpperCase()
                    )}
                    {subiendoFoto && (
                      <div className="absolute inset-0 flex items-center justify-center bg-black/60 text-white font-body text-xs font-bold">
                        Subiendo...
                      </div>
                    )}
                  </div>
                  <div>
                    <h2 className="font-display text-lg font-bold text-text-primary">
                      {conductor?.nombre || "Conductor Ruum Ruum"}
                    </h2>
                    {/* Calificación del conductor */}
                    <div className="mt-1 flex items-center gap-2">
                      <div className="inline-flex items-center gap-1.5 rounded-full bg-signal/20 border border-signal/40 px-2.5 py-0.5 text-xs font-bold text-text-primary shadow-2xs">
                        <span className="text-amber-500 text-sm leading-none" aria-hidden="true">★</span>
                        <span className="font-display font-extrabold tracking-wide">
                          {typeof conductor?.calificacion_promedio === "number"
                            ? conductor.calificacion_promedio.toFixed(1)
                            : "5.0"}
                        </span>
                      </div>
                      <span className="font-body text-xs font-medium text-text-tertiary">
                        Calificación del conductor
                      </span>
                    </div>
                    <p className="mt-1 font-body text-xs text-text-tertiary">
                      Fotografía de perfil activa para identificación operativa
                    </p>
                  </div>
                </div>

                <label className="inline-flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-border bg-surface px-4 py-2.5 font-body text-sm font-semibold text-text-primary shadow-xs transition hover:border-route-action hover:bg-surface-elevated active:scale-95">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
                    <circle cx="12" cy="13" r="4" />
                  </svg>
                  {subiendoFoto ? "Cargando imagen..." : "Cambiar fotografía"}
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    className="sr-only"
                    onChange={subirFotoPerfil}
                    disabled={!conductor || subiendoFoto}
                  />
                </label>
              </div>

              {/* 1. Segmentación por Pestañas (Tabs) */}
              <div className="border-b border-border/40" role="tablist" aria-label="Secciones del perfil">
                <nav className="-mb-px flex space-x-2 sm:space-x-6 overflow-x-auto no-scrollbar snap-x snap-mandatory" aria-label="Tabs">
                  {PESTANAS.map((tab) => {
                    const activa = tab.id === pestanaActiva;
                    return (
                      <button
                        key={tab.id}
                        type="button"
                        role="tab"
                        aria-selected={activa}
                        onClick={() => setPestanaActiva(tab.id)}
                        className={[
                          "inline-flex items-center gap-2 whitespace-nowrap border-b-2 px-3 py-3.5 font-display text-sm font-bold transition-all min-h-11 snap-start",
                          activa
                            ? "border-route-action text-route-action"
                            : "border-transparent text-text-tertiary hover:border-border hover:text-text-primary"
                        ].join(" ")}
                      >
                        <span className="text-base">{tab.icono}</span>
                        {tab.titulo}
                      </button>
                    );
                  })}
                </nav>
              </div>

              {/* Contenido de la Pestaña Activa */}
              <section key={seccionActual.id} className="grid gap-5 pt-2" role="tabpanel">
                <div>
                  <h3 className="font-display text-base font-bold text-text-primary">{seccionActual.titulo}</h3>
                  <p className="font-body text-xs text-text-tertiary">{seccionActual.descripcion}</p>
                </div>

                <div className="grid gap-5 sm:grid-cols-2">
                  {seccionActual.campos.map((clave, indice) => {
                    const campo = CAMPO_CONFIG[clave];
                    const inputId = `perfil-${clave}`;
                    const tipoDatoSensible = tipoDatoSensibleCampo(clave);
                    const tooltipAlign = indice % 2 === 0 ? "start" : "end";
                    const esSensible = CAMPOS_SENSIBLES.has(clave);
                    const esSoloLectura = CAMPOS_SOLO_LECTURA.has(clave);

                    const tieneValorRegistrado = valorSensibleExiste(clave);
                    const estaEnEdicionSensible = sensiblesEditados.has(clave as CampoSensiblePerfil);
                    const evaluacion = evaluarValidacionInline(clave, perfil[clave]);

                    return (
                      <div key={clave} className={`grid gap-1.5 font-body text-sm font-semibold text-text-tertiary ${campo.colSpan ?? ""}`}>
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <label htmlFor={inputId} className="text-text-primary">{campo.etiqueta}</label>
                            {tipoDatoSensible && <DatosSensiblesTooltip tipo={tipoDatoSensible} align={tooltipAlign} />}
                            {esSoloLectura && (
                              <span className="inline-flex items-center gap-1 rounded-full border border-text-tertiary/28 bg-surface-muted px-2 py-0.5 text-xs font-semibold normal-case tracking-normal text-text-tertiary">
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                                  <rect x="4" y="11" width="16" height="9" rx="2" />
                                  <path d="M8 11V7a4 4 0 0 1 8 0v4" />
                                </svg>
                                Solo lectura
                              </span>
                            )}
                          </div>

                          {/* 2. Validación Inline real-time feedback */}
                          {evaluacion.esValido === true && (
                            <span className="inline-flex items-center gap-1 font-body text-xs font-bold text-emerald-600 dark:text-emerald-400">
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                <polyline points="20 6 9 17 4 12" />
                              </svg>
                              {evaluacion.mensaje ?? "✓ OK"}
                            </span>
                          )}
                        </div>

                        {/* 2. Estados de campos sensibles (Edición protegida por ícono Lápiz) */}
                        {esSensible && tieneValorRegistrado && !estaEnEdicionSensible ? (
                          <div className="flex items-center justify-between gap-3 rounded-xl border border-border/60 bg-surface-elevated/70 px-3.5 py-2.5 transition">
                            <div className="flex items-center gap-2.5 overflow-hidden">
                              <span className="font-mono text-sm tracking-wider text-text-primary font-bold">
                                {placeholderSensible(clave)}
                              </span>
                              <span className="rounded-md border border-border bg-surface px-2 py-0.5 text-[11px] font-semibold text-text-tertiary">
                                Protegido
                              </span>
                            </div>
                            <button
                              type="button"
                              onClick={() => {
                                setSensiblesEditados((actual) => new Set(actual).add(clave as CampoSensiblePerfil));
                                setPerfil((actual) => ({ ...actual, [clave]: "" }));
                              }}
                              className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-surface px-3 py-1.5 font-body text-xs font-bold text-route-action transition hover:border-route-action hover:bg-route-action/10 active:scale-95"
                            >
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                              </svg>
                              Editar
                            </button>
                          </div>
                        ) : clave === "colonia" && coloniasDisponibles.length > 0 ? (
                          /* 2. Autocompletado inteligente CP — Desplegable de colonias SEPOMEX */
                          <div className="relative">
                            <select
                              id={inputId}
                              value={perfil.colonia}
                              onChange={(e) => setPerfil((actual) => ({ ...actual, colonia: e.target.value }))}
                              className="w-full rounded-xl border border-border bg-surface px-3.5 py-2.5 font-body text-base text-text-primary outline-none focus:border-signal"
                            >
                              {coloniasDisponibles.map((col) => (
                                <option key={col} value={col}>{col}</option>
                              ))}
                            </select>
                            <span className="mt-1 block font-body text-xs text-emerald-600 dark:text-emerald-400 font-semibold">
                              ✓ Colonias detectadas oficialmente por SEPOMEX
                            </span>
                          </div>
                        ) : (
                          /* Input Estándar */
                          <div className="relative">
                            <input
                              id={inputId}
                              type={campo.tipo ?? "text"}
                              value={perfil[clave]}
                              placeholder={campo.placeholder ?? (esSensible ? placeholderSensible(clave) : undefined)}
                              readOnly={esSoloLectura}
                              aria-readonly={esSoloLectura || undefined}
                              data-ruum-label={campo.etiqueta}
                              onChange={(event) => {
                                if (esSoloLectura) return;
                                if (clave === "codigo_postal") {
                                  void manejarCambioCp(event.target.value);
                                  return;
                                }
                                if (esSensible) {
                                  setSensiblesEditados((actual) => new Set(actual).add(clave as CampoSensiblePerfil));
                                }
                                const valor = clave === "licencia_numero" ? event.target.value.toLocaleUpperCase("es-MX") : event.target.value;
                                setPerfil((actual) => ({ ...actual, [clave]: valor }));
                              }}
                              className={[
                                "w-full rounded-xl border px-3.5 py-2.5 font-body text-base normal-case tracking-normal text-text-primary placeholder:text-text-tertiary/60 outline-none transition focus:border-signal",
                                esSoloLectura
                                  ? "border-border/12 bg-surface-muted text-text-tertiary"
                                  : evaluacion.esValido === false
                                  ? "border-red-500/80 bg-red-500/5 focus:border-red-500"
                                  : "border-border bg-surface"
                              ].join(" ")}
                            />

                            {clave === "codigo_postal" && buscandoCp && (
                              <span className="absolute right-3 top-3 font-body text-xs text-text-tertiary animate-pulse">
                                Buscando CP...
                              </span>
                            )}
                            {clave === "codigo_postal" && cpDetectado && !buscandoCp && (
                              <span className="mt-1 block font-body text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                                ✓ Ubicación y colonias autocompletadas (SEPOMEX)
                              </span>
                            )}
                            {evaluacion.esValido === false && evaluacion.mensaje && (
                              <span className="mt-1 block font-body text-xs font-semibold text-red-500">
                                {evaluacion.mensaje}
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </section>
            </div>
          )}
        </Card>

        {/* 3. Botón de acción flotante (Sticky Button) para móvil y escritorio */}
        <div className="fixed bottom-0 left-0 right-0 z-40 border-t border-border/40 bg-surface/95 px-4 py-3 backdrop-blur-md shadow-lg sm:relative sm:z-auto sm:mt-6 sm:border-0 sm:bg-transparent sm:p-0 sm:shadow-none" style={{ paddingBottom: "max(12px, env(safe-area-inset-bottom))" }}>
          <div className="mx-auto max-w-3xl flex items-center justify-between gap-4">
            <p className="hidden font-body text-xs text-text-tertiary sm:block">
              {hayCambiosReales ? "Hay cambios pendientes por guardar" : "Sin cambios detectados"}
            </p>
            <Button
              variant={hayCambiosReales ? "primary" : "secondary"}
              onClick={() => void guardarPerfil()}
              loading={guardando}
              disabled={!conductor || !hayCambiosReales || guardando}
              className={`w-full sm:w-auto min-w-[200px] min-h-12 transition-all ${hayCambiosReales ? "shadow-md animate-pulse sm:animate-none" : "opacity-75"}`}
            >
              {guardando ? "Guardando perfil..." : "Guardar perfil"}
            </Button>
          </div>
        </div>
      </div>
    </>
  );
}
