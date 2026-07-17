"use client";

import { useEffect, useRef, useState } from "react";
import { Aviso, Button } from "@ruum/ui";
import { TEXTOS_CARGANDO } from "@ruum/shared/constants";
import { traducirErrorOperativo } from "@ruum/shared/utils";
import {
  activarSoporteEmergenciaConductor,
  registrarInteraccionPanelEmergenciaConductor,
  reportarIncidencia
} from "@ruum/api/services";
import { crearClienteNavegador } from "../../../lib/supabase-browser";
import { CONTACTOS_SOPORTE_CONDUCTOR } from "../../../lib/contactos-soporte";
import { obtenerUbicacionActual } from "../../../lib/ubicacion";

type AccionPanel = "llamar_911" | "contactar_soporte" | "compartir_ubicacion" | "reportar_accidente" | "no_puedo_continuar";

const OPCIONES: Array<{
  id: AccionPanel;
  titulo: string;
  descripcion: string;
  tono?: "danger" | "normal";
}> = [
  {
    id: "llamar_911",
    titulo: "911",
    descripcion: "Llamar a emergencias. Requiere confirmación.",
    tono: "danger"
  },
  {
    id: "contactar_soporte",
    titulo: "Contactar soporte Ruum",
    descripcion: "Abrir WhatsApp con el equipo operativo."
  },
  {
    id: "compartir_ubicacion",
    titulo: "Compartir ubicación",
    descripcion: "Enviar tu ubicación actual sin escribir."
  },
  {
    id: "reportar_accidente",
    titulo: "Reportar accidente",
    descripcion: "Crear reporte prioritario para Torre de Control."
  },
  {
    id: "no_puedo_continuar",
    titulo: "No puedo continuar",
    descripcion: "Avisar que el traslado requiere apoyo operativo."
  }
];

function mapaUrl(lat: number, lng: number) {
  return `https://maps.google.com/?q=${lat},${lng}`;
}

export function EmergencyPanel({ trasladoId }: { trasladoId: string }) {
  const [abierto, setAbierto] = useState(false);
  const [confirmando911, setConfirmando911] = useState(false);
  const [procesando, setProcesando] = useState<AccionPanel | null>(null);
  const [mensaje, setMensaje] = useState<{ tono: "info" | "danger"; texto: string } | null>(null);
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const tituloRef = useRef<HTMLHeadingElement | null>(null);
  const elementoPrevioRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!abierto) return;
    const previoOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.setTimeout(() => tituloRef.current?.focus(), 0);

    function manejarTecla(evento: KeyboardEvent) {
      if (evento.key === "Escape") {
        evento.preventDefault();
        cerrarPanel();
        return;
      }

      if (evento.key !== "Tab") return;
      const dialogo = dialogRef.current;
      if (!dialogo) return;
      const enfocables = Array.from(
        dialogo.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'
        )
      ).filter((elemento) => !elemento.hasAttribute("disabled") && elemento.offsetParent !== null);
      if (enfocables.length === 0) return;

      const primero = enfocables[0];
      const ultimo = enfocables[enfocables.length - 1];
      if (evento.shiftKey && document.activeElement === primero) {
        evento.preventDefault();
        ultimo.focus();
      } else if (!evento.shiftKey && document.activeElement === ultimo) {
        evento.preventDefault();
        primero.focus();
      }
    }

    document.addEventListener("keydown", manejarTecla);
    return () => {
      document.removeEventListener("keydown", manejarTecla);
      document.body.style.overflow = previoOverflow;
      elementoPrevioRef.current?.focus();
    };
  }, [abierto]);

  async function registrar(accion: "apertura" | "seleccion", opcion: string, datos: Record<string, string | number | boolean | null> = {}) {
    try {
      const cliente = crearClienteNavegador();
      await registrarInteraccionPanelEmergenciaConductor(cliente, trasladoId, accion, opcion, datos);
    } catch {
      // La emergencia no debe bloquearse si la auditoría temporalmente falla.
    }
  }

  async function abrirPanel() {
    setMensaje(null);
    setConfirmando911(false);
    elementoPrevioRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    setAbierto(true);
    await registrar("apertura", "panel");
  }

  function cerrarPanel() {
    setAbierto(false);
    setConfirmando911(false);
    setMensaje(null);
  }

  async function llamar911() {
    if (!confirmando911) {
      setConfirmando911(true);
      setMensaje({ tono: "info", texto: "Confirma para iniciar la llamada al 911." });
      await registrar("seleccion", "llamar_911_preconfirmacion");
      return;
    }

    setProcesando("llamar_911");
    setMensaje(null);
    try {
      const cliente = crearClienteNavegador();
      await activarSoporteEmergenciaConductor(cliente, trasladoId);
      await registrar("seleccion", "llamar_911_confirmado");
      window.location.href = CONTACTOS_SOPORTE_CONDUCTOR.emergencia.telefono.href;
    } catch (err) {
      setMensaje({ tono: "danger", texto: traducirErrorOperativo(err, "No pudimos activar la llamada de emergencia.") });
    } finally {
      setProcesando(null);
    }
  }

  async function contactarSoporte() {
    await registrar("seleccion", "contactar_soporte", { canal: "whatsapp" });
    window.location.href = CONTACTOS_SOPORTE_CONDUCTOR.soporte.whatsapp.href;
  }

  async function compartirUbicacion() {
    setProcesando("compartir_ubicacion");
    setMensaje(null);
    try {
      const ubicacion = await obtenerUbicacionActual();
      if (!ubicacion) throw new Error("No pudimos obtener tu ubicación actual.");
      const url = mapaUrl(ubicacion.lat, ubicacion.lng);
      const texto = `Ubicación de emergencia Ruum Ruum: ${url}`;
      await registrar("seleccion", "compartir_ubicacion", {
        lat: ubicacion.lat,
        lng: ubicacion.lng,
        precision_m: ubicacion.precisionM ?? null
      });

      if (navigator.share) {
        try {
          await navigator.share({ title: "Ubicación de emergencia", text: texto, url });
          setMensaje({ tono: "info", texto: "Ubicación lista para compartir." });
        } catch (err) {
          if (err instanceof DOMException && err.name === "AbortError") {
            setMensaje({ tono: "info", texto: "Compartir ubicación fue cancelado." });
          } else {
            throw err;
          }
        }
      } else if (navigator.clipboard) {
        await navigator.clipboard.writeText(texto);
        setMensaje({ tono: "info", texto: "Ubicación copiada. Puedes pegarla en el chat o WhatsApp." });
      } else {
        window.location.href = `sms:?body=${encodeURIComponent(texto)}`;
      }
    } catch (err) {
      setMensaje({ tono: "danger", texto: traducirErrorOperativo(err, "No pudimos compartir la ubicación.") });
    } finally {
      setProcesando(null);
    }
  }

  async function reportar(tipo: "reportar_accidente" | "no_puedo_continuar") {
    setProcesando(tipo);
    setMensaje(null);
    try {
      const cliente = crearClienteNavegador();
      await reportarIncidencia(
        cliente,
        trasladoId,
        tipo === "reportar_accidente" ? "colision_robo_asalto" : "descompostura_en_ruta",
        "durante_traslado",
        tipo === "reportar_accidente"
          ? "Emergencia: el conductor reporta accidente desde el panel de emergencia."
          : "Emergencia: el conductor indica que no puede continuar el traslado."
      );
      await registrar("seleccion", tipo);
      setMensaje({ tono: "info", texto: "Reporte enviado. Torre de Control dará seguimiento." });
    } catch (err) {
      setMensaje({ tono: "danger", texto: traducirErrorOperativo(err, "No pudimos registrar el reporte.") });
    } finally {
      setProcesando(null);
    }
  }

  async function seleccionar(opcion: AccionPanel) {
    if (opcion !== "llamar_911") setConfirmando911(false);
    if (opcion === "llamar_911") return llamar911();
    if (opcion === "contactar_soporte") return contactarSoporte();
    if (opcion === "compartir_ubicacion") return compartirUbicacion();
    if (opcion === "reportar_accidente") return reportar("reportar_accidente");
    return reportar("no_puedo_continuar");
  }

  return (
    <section id="emergencia" className="mt-6 rounded-lg border border-danger-action bg-danger-soft px-4 py-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="font-body text-sm font-semibold text-danger-action">Emergencia</p>
          <p className="mt-1 font-body text-sm text-text-secondary">
            Abre opciones seguras para pedir ayuda, compartir ubicación o reportar un problema crítico.
          </p>
        </div>
        <Button variant="emergency" className="min-h-12 w-full sm:w-auto" onClick={abrirPanel}>
          Abrir emergencia
        </Button>
      </div>

      {abierto && (
        <div className="fixed inset-0 z-50 bg-black/60 px-3 py-[max(12px,env(safe-area-inset-top))]" role="presentation">
          <div
            ref={dialogRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="emergency-panel-title"
            className="mx-auto flex max-h-[calc(100dvh_-_24px_-_env(safe-area-inset-top)_-_env(safe-area-inset-bottom))] w-full max-w-md flex-col overflow-hidden rounded-2xl border border-border bg-surface shadow-[0_24px_80px_rgba(26,31,46,0.34)]"
            style={{ marginTop: "max(0px, env(safe-area-inset-top))" }}
          >
            <div className="flex items-start justify-between gap-3 border-b border-border px-4 py-4">
              <div>
                <p className="font-body text-sm font-semibold text-danger-action">Panel de emergencia</p>
                <h2 id="emergency-panel-title" ref={tituloRef} tabIndex={-1} className="mt-1 font-display text-xl font-semibold text-text-primary">
                  ¿Qué necesitas?
                </h2>
              </div>
              <button
                type="button"
                onClick={cerrarPanel}
                className="min-h-11 min-w-11 rounded-lg border border-border px-3 py-2 font-body text-sm font-semibold text-text-secondary"
              >
                Cerrar
              </button>
            </div>

            <div className="grid gap-2 overflow-y-auto px-4 py-4 pb-[max(16px,env(safe-area-inset-bottom))]">
              {mensaje && <Aviso tono={mensaje.tono}>{mensaje.texto}</Aviso>}
              {OPCIONES.map((opcion, indice) => {
                const es911 = opcion.id === "llamar_911";
                const cargando = procesando === opcion.id;
                return (
                  <button
                    key={opcion.id}
                    type="button"
                    onClick={() => void seleccionar(opcion.id)}
                    disabled={Boolean(procesando)}
                    className={[
                      "min-h-16 rounded-xl border px-4 py-3 text-left transition disabled:cursor-wait disabled:text-disabled",
                      "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-danger-action",
                      es911
                        ? "border-danger-action bg-danger-action text-white shadow-[0_10px_28px_rgba(179,38,38,0.24)]"
                        : "border-border bg-surface text-text-primary hover:border-route-action hover:bg-route-soft"
                    ].join(" ")}
                  >
                    <span className="flex items-center justify-between gap-3">
                      <span className="flex items-center gap-2">
                        {es911 && (
                          <span
                            className="inline-flex size-9 shrink-0 items-center justify-center rounded-full border border-current font-body text-base font-bold"
                            aria-hidden
                          >
                            !
                          </span>
                        )}
                        <span className={["font-body font-bold", es911 ? "text-xl" : "text-sm"].join(" ")}>
                          {cargando ? TEXTOS_CARGANDO.actualizando : opcion.titulo}
                        </span>
                      </span>
                      {indice === 0 && <span className="font-body text-sm font-semibold">Primero</span>}
                    </span>
                    <span className={["mt-1 block font-body text-sm leading-6", es911 ? "text-white/90" : "text-text-secondary"].join(" ")}>
                      {es911 && confirmando911 ? "Toca de nuevo para confirmar la llamada." : opcion.descripcion}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
