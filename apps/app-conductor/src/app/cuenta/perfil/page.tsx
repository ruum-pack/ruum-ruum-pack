"use client";

import { ConfirmDialog } from "../../../components/ConfirmDialog";

import { ChangeEvent, useEffect, useState } from "react";
import { Button, Card } from "@ruum/ui";
import { actualizarPerfilConductor, subirFotoPerfilConductor } from "@ruum/api/services";
import { traducirErrorOperativo } from "@ruum/shared/utils";
import { crearClienteNavegador } from "../../../lib/supabase-browser";
import { CuentaHeader } from "../CuentaHeader";
import { cargarConductorCuenta, telefonoE164, type ConductorCuenta } from "../cuenta-utils";
import { DatosSensiblesTooltip, enmascararUltimos, type TipoDatoSensible } from "../datos-sensibles";

const PERFIL_DEFAULT = {
  nombre: "",
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

type NotificacionPerfil = { tipo: "success" | "error" | "info"; mensaje: string } | null;

const CAMPO_CONFIG: Record<CampoPerfil, { etiqueta: string; tipo?: string; colSpan?: string }> = {
  nombre: { etiqueta: "Nombre completo" },
  telefono: { etiqueta: "Teléfono" },
  curp: { etiqueta: "CURP" },
  licencia_numero: { etiqueta: "Número de licencia" },
  licencia_tipo: { etiqueta: "Tipo de licencia" },
  licencia_vigencia: { etiqueta: "Vigencia de licencia", tipo: "date" },
  codigo_postal: { etiqueta: "Código postal" },
  estado_residencia: { etiqueta: "Estado" },
  ciudad_municipio: { etiqueta: "Ciudad o municipio" },
  colonia: { etiqueta: "Colonia" },
  calle: { etiqueta: "Calle" },
  numero: { etiqueta: "Número" },
  referencias: { etiqueta: "Referencias", colSpan: "sm:col-span-2" },
  contacto_emergencia_nombre: { etiqueta: "Contacto de emergencia" },
  contacto_emergencia_telefono: { etiqueta: "Teléfono de emergencia" }
};

const SECCIONES_PERFIL: { titulo: string; campos: CampoPerfil[] }[] = [
  { titulo: "Identidad", campos: ["nombre", "telefono", "curp"] },
  { titulo: "Documentación operativa", campos: ["licencia_numero", "licencia_tipo", "licencia_vigencia"] },
  {
    titulo: "Ubicación y emergencia",
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

export default function PaginaPerfilCuenta() {
  const [confirmacionAbierta, setConfirmacionAbierta] = useState(false);
  const [conductor, setConductor] = useState<ConductorCuenta | null>(null);
  const [perfil, setPerfil] = useState(PERFIL_DEFAULT);
  const [sensiblesEditados, setSensiblesEditados] = useState<Set<CampoSensiblePerfil>>(new Set());
  const [notificacion, setNotificacion] = useState<NotificacionPerfil>(null);
  const [cargando, setCargando] = useState(true);
  const [subiendoFoto, setSubiendoFoto] = useState(false);
  const [guardando, setGuardando] = useState(false);

  async function cargar() {
    const actual = await cargarConductorCuenta();
    setConductor(actual);
    const siguiente = perfilDesdeConductor(actual);
    siguiente.curp = "";
    siguiente.licencia_numero = "";
    siguiente.contacto_emergencia_nombre = "";
    siguiente.contacto_emergencia_telefono = "";
    setPerfil(siguiente);
    setSensiblesEditados(new Set());
    setCargando(false);
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
      await actualizarPerfilConductor(cliente, conductor.id, {
        ...perfilParaGuardar,
        telefono: telefonoE164(perfilParaGuardar.telefono),
        contacto_emergencia_telefono: telefonoE164(perfilParaGuardar.contacto_emergencia_telefono)
      });
      await cargar();
      setNotificacion({ tipo: "success", mensaje: "Perfil actualizado correctamente" });
    } catch (error) {
      setNotificacion({ tipo: "error", mensaje: traducirErrorOperativo(error, "No se pudo actualizar el perfil.") });
    } finally {
      setGuardando(false);
    }
  }

  async function subirFotoPerfil(evento: ChangeEvent<HTMLInputElement>) {
    const archivo = evento.target.files?.[0];
    if (!archivo || !conductor) return;
    setNotificacion(null);
    setSubiendoFoto(true);
    try {
      const cliente = crearClienteNavegador();
      const fotoUrl = await subirFotoPerfilConductor(cliente, conductor.id, archivo);
      setConductor({ ...conductor, foto_perfil_url: fotoUrl });
      setNotificacion({ tipo: "success", mensaje: "Fotografía de perfil actualizada." });
    } catch (error) {
      setNotificacion({ tipo: "error", mensaje: traducirErrorOperativo(error, "No pudimos actualizar la fotografía de perfil.") });
    } finally {
      setSubiendoFoto(false);
      evento.target.value = "";
    }
  }

  function placeholderSensible(campo: CampoPerfil) {
    if (!conductor) return "";
    if (campo === "curp") return conductor.curp ? enmascararUltimos(conductor.curp) : "";
    if (campo === "licencia_numero") return conductor.licencia_numero ? enmascararUltimos(conductor.licencia_numero) : "";
    if (campo === "contacto_emergencia_nombre") return conductor.contacto_emergencia_nombre ? enmascararUltimos(conductor.contacto_emergencia_nombre, 2) : "";
    if (campo === "contacto_emergencia_telefono") return conductor.contacto_emergencia_telefono ? enmascararUltimos(conductor.contacto_emergencia_telefono) : "";
    return "";
  }

  function claseToast(tipo: NonNullable<NotificacionPerfil>["tipo"]) {
    if (tipo === "success") return "border-success/35 bg-success/12 text-text-primary";
    if (tipo === "error") return "border-danger-action/38 bg-danger-action/12 text-text-primary";
    return "border-route-action/35 bg-surface-elevated text-text-primary";
  }

  return (
    <>
      <ConfirmDialog open={confirmacionAbierta} title="Guardar cambios sensibles" consequence="Operación podría revisar nuevamente tu expediente antes de aprobar los cambios." maskedData={[`Campos modificados: ${sensiblesEditados.size}`]} confirmLabel="Guardar y enviar a revisión" busy={guardando} onCancel={() => setConfirmacionAbierta(false)} onConfirm={() => void guardarPerfil()} />
    <div className="mx-auto w-full max-w-3xl px-6 py-10 sm:py-14">
      <CuentaHeader titulo="Perfil" descripcion="Actualiza tus datos personales y de contacto operativo." />
      {notificacion && (
        <div
          role="status"
          aria-live="polite"
          className={`conductor-toast-bottom fixed right-4 z-50 max-w-[calc(100vw-2rem)] rounded-xl border px-4 py-3 font-body text-sm font-semibold shadow-[0_18px_48px_rgba(0,0,0,0.42)] sm:right-6 sm:max-w-sm ${claseToast(notificacion.tipo)}`}
        >
          {notificacion.mensaje}
        </div>
      )}
      <Card className="mt-6">
        {cargando ? <p className="font-body text-sm text-text-secondary">Cargando perfil...</p> : (
          <div className="grid gap-5">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
              <div className="flex h-24 w-24 shrink-0 items-center justify-center overflow-hidden rounded-full bg-signal-soft font-display text-3xl font-semibold text-text-primary">
                {conductor?.foto_perfil_url ? <img src={conductor.foto_perfil_url} alt="" className="h-full w-full object-cover" /> : (perfil.nombre || "CD").slice(0, 2).toUpperCase()}
              </div>
              <label className="inline-flex cursor-pointer items-center justify-center rounded-lg border border-border bg-surface px-4 py-2 font-body text-sm font-semibold text-text-secondary hover:border-signal">
                {subiendoFoto ? "Subiendo..." : "Subir o actualizar foto"}
                <input type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" onChange={subirFotoPerfil} disabled={!conductor || subiendoFoto} />
              </label>
            </div>
            {SECCIONES_PERFIL.map((seccion) => (
              <section key={seccion.titulo} className="grid gap-4 border-t border-border/16 pt-5 first:border-t-0 first:pt-0">
                <h2 className="font-display text-base font-semibold text-text-primary">{seccion.titulo}</h2>
                <div className="grid gap-4 sm:grid-cols-2">
                  {seccion.campos.map((clave, indice) => {
                    const campo = CAMPO_CONFIG[clave];
                    const inputId = `perfil-${clave}`;
                    const tipoDatoSensible = tipoDatoSensibleCampo(clave);
                    const tooltipAlign = indice % 2 === 0 ? "start" : "end";
                    const esSensible = CAMPOS_SENSIBLES.has(clave);
                    const esSoloLectura = CAMPOS_SOLO_LECTURA.has(clave);

                    return (
                      <div key={clave} className={`grid gap-1 font-body text-sm font-semibold text-text-tertiary ${campo.colSpan ?? ""}`}>
                        <div className="flex items-center gap-2">
                          <label htmlFor={inputId}>{campo.etiqueta}</label>
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
                        <input
                          id={inputId}
                          type={campo.tipo ?? "text"}
                          value={perfil[clave]}
                          placeholder={esSensible ? placeholderSensible(clave) : undefined}
                          readOnly={esSoloLectura}
                          aria-readonly={esSoloLectura || undefined}
                          onChange={(event) => {
                            if (esSoloLectura) return;
                            if (esSensible) {
                              setSensiblesEditados((actual) => new Set(actual).add(clave as CampoSensiblePerfil));
                            }
                            setPerfil((actual) => ({ ...actual, [clave]: event.target.value }));
                          }}
                          className={[
                            "rounded-lg border px-3 py-2 font-body text-base normal-case tracking-normal text-text-primary placeholder:text-text-tertiary",
                            esSoloLectura
                              ? "border-border/12 bg-surface-muted text-text-tertiary outline-none"
                              : "border-border bg-surface"
                          ].join(" ")}
                        />
                        {esSensible && (
                          <span className="font-body text-xs normal-case tracking-normal text-text-tertiary">Escribe para actualizar.</span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </section>
            ))}
            <Button variant="secondary" onClick={guardarPerfil} loading={guardando} disabled={!conductor}>
              Guardar perfil
            </Button>
          </div>
        )}
      </Card>
    </div>
    </>
  );
}
