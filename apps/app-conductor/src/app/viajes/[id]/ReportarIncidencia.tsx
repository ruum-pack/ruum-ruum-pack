"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Aviso, Button, Field } from "@ruum/ui";
import { TEXTOS_CARGANDO } from "@ruum/shared/constants";
import type { Database } from "@ruum/shared/types";
import { traducirErrorOperativo } from "@ruum/shared/utils";
import { activarSoporteEmergenciaConductor, reportarIncidencia } from "@ruum/api/services";
import { crearClienteNavegador } from "../../../lib/supabase-browser";

type TipoIncidencia = Database["public"]["Enums"]["tipo_incidencia"];
type MomentoIncidencia = Database["public"]["Enums"]["momento_incidencia"];

type ProblemaVisible =
  | "contacto"
  | "ubicacion"
  | "vehiculo"
  | "danos"
  | "no_inicia"
  | "no_continuar"
  | "emergencia";

type OpcionProblema = {
  id: ProblemaVisible;
  etiqueta: string;
  ayuda: string;
  tipo: TipoIncidencia;
  momento: MomentoIncidencia;
  pregunta: string;
  placeholder: string;
  requiereEvidencia?: boolean;
  urgente?: boolean;
};

const MAX_EVIDENCIA_BYTES = 10 * 1024 * 1024;
const BUCKET_EVIDENCIA = "evidencia";

const OPCIONES: OpcionProblema[] = [
  {
    id: "contacto",
    etiqueta: "No encuentro al contacto.",
    ayuda: "Cuando la persona no responde o no está en el punto.",
    tipo: "contacto_no_localizado",
    momento: "recoleccion",
    pregunta: "¿Qué intentaste para encontrarlo?",
    placeholder: "Ej. Llamé dos veces y esperé en la entrada principal."
  },
  {
    id: "ubicacion",
    etiqueta: "Ubicación incorrecta.",
    ayuda: "La dirección o el pin no coincide con el lugar real.",
    tipo: "perdida_conectividad",
    momento: "recoleccion",
    pregunta: "¿Dónde estás y qué no coincide?",
    placeholder: "Ej. El pin manda a otra calle; estoy frente al número 40."
  },
  {
    id: "vehiculo",
    etiqueta: "No encuentro el vehículo.",
    ayuda: "El contacto está, pero el vehículo no aparece o no coincide.",
    tipo: "documentacion_incompleta",
    momento: "recoleccion",
    pregunta: "¿Qué dato no coincide o qué falta?",
    placeholder: "Ej. Las placas no coinciden con las del traslado.",
    requiereEvidencia: true
  },
  {
    id: "danos",
    etiqueta: "Vehículo con daños.",
    ayuda: "Daños visibles antes de moverlo o al entregarlo.",
    tipo: "dano_previo_relevante",
    momento: "recoleccion",
    pregunta: "¿Qué daño ves y en qué parte del vehículo?",
    placeholder: "Ej. Golpe en defensa trasera del lado derecho.",
    requiereEvidencia: true
  },
  {
    id: "no_inicia",
    etiqueta: "No puedo iniciar.",
    ayuda: "El vehículo no enciende o no está en condición de salida.",
    tipo: "vehiculo_no_enciende",
    momento: "recoleccion",
    pregunta: "¿Qué impide iniciar el traslado?",
    placeholder: "Ej. El motor no enciende y aparece alerta en tablero.",
    requiereEvidencia: true
  },
  {
    id: "no_continuar",
    etiqueta: "No puedo continuar.",
    ayuda: "Algo ocurrió durante la ruta y necesitas apoyo.",
    tipo: "descompostura_en_ruta",
    momento: "durante_traslado",
    pregunta: "¿Qué pasó y dónde estás detenido?",
    placeholder: "Ej. El vehículo perdió potencia en avenida principal.",
    requiereEvidencia: true,
    urgente: true
  },
  {
    id: "emergencia",
    etiqueta: "Accidente o emergencia.",
    ayuda: "Colisión, robo, asalto o emergencia médica.",
    tipo: "colision_robo_asalto",
    momento: "durante_traslado",
    pregunta: "¿Qué ocurrió y necesitas llamar a emergencias?",
    placeholder: "Ej. Hubo una colisión leve; estoy en zona segura.",
    requiereEvidencia: true,
    urgente: true
  }
];

function opcionPorId(id: ProblemaVisible) {
  return OPCIONES.find((opcion) => opcion.id === id) ?? OPCIONES[0];
}

function extensionArchivo(nombre: string) {
  const extension = nombre.split(".").pop()?.toLowerCase();
  return extension && /^[a-z0-9]+$/.test(extension) ? extension : "jpg";
}

function limpiarNombreArchivo(nombre: string) {
  const sinExtension = nombre.replace(/\.[^.]+$/, "");
  return sinExtension
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80) || "evidencia.jpg";
}

async function subirEvidenciaIncidencia(
  cliente: ReturnType<typeof crearClienteNavegador>,
  trasladoId: string,
  archivo: File
) {
  if (!archivo.type.startsWith("image/")) {
    throw new Error("La evidencia debe ser una imagen.");
  }
  if (archivo.size > MAX_EVIDENCIA_BYTES) {
    throw new Error("La evidencia debe pesar máximo 10 MB.");
  }

  const { data: sesion } = await cliente.auth.getUser();
  const authUserId = sesion.user?.id;
  if (!authUserId) throw new Error("Sin sesión activa para subir evidencia.");

  const extension = extensionArchivo(archivo.name);
  const nombre = limpiarNombreArchivo(archivo.name);
  const id = typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now()}`;
  const ruta = `${authUserId}/${trasladoId}/incidencias/${id}-${nombre}.${extension}`;

  const { error: uploadError } = await cliente.storage.from(BUCKET_EVIDENCIA).upload(ruta, archivo, {
    upsert: false,
    contentType: archivo.type
  });
  if (uploadError) throw uploadError;

  const { data, error: signedUrlError } = await cliente.storage.from(BUCKET_EVIDENCIA).createSignedUrl(ruta, 60 * 60 * 24 * 7);
  if (signedUrlError) throw signedUrlError;

  return {
    nombre: archivo.name,
    ruta,
    urlTemporal: data.signedUrl
  };
}

export function ReportarIncidencia({ trasladoId }: { trasladoId: string }) {
  const router = useRouter();
  const [abierto, setAbierto] = useState(false);
  const [problema, setProblema] = useState<ProblemaVisible | null>(null);
  const [detalle, setDetalle] = useState("");
  const [adjunto, setAdjunto] = useState<File | null>(null);
  const [procesando, setProcesando] = useState(false);
  const [mensaje, setMensaje] = useState<{ tono: "info" | "danger"; texto: string } | null>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const tituloRef = useRef<HTMLHeadingElement | null>(null);
  const elementoPrevioRef = useRef<HTMLElement | null>(null);

  const opcion = problema ? opcionPorId(problema) : null;
  const detalleMinimo = opcion?.urgente ? 5 : 10;
  const puedeEnviar = Boolean(opcion) && detalle.trim().length >= detalleMinimo;

  const cerrarSheet = useCallback(() => {
    if (procesando) return;
    setAbierto(false);
  }, [procesando]);

  useEffect(() => {
    if (!abierto) return;
    const previoOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.setTimeout(() => tituloRef.current?.focus(), 0);

    function manejarTecla(evento: KeyboardEvent) {
      if (evento.key === "Escape") {
        evento.preventDefault();
        cerrarSheet();
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
  }, [abierto, cerrarSheet]);

  function abrirSheet() {
    elementoPrevioRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    setAbierto(true);
  }

  async function enviar() {
    if (!opcion) return;
    setProcesando(true);
    setMensaje(null);
    try {
      const cliente = crearClienteNavegador();
      const evidencia = adjunto ? await subirEvidenciaIncidencia(cliente, trasladoId, adjunto) : null;
      const descripcion = [
        opcion.etiqueta,
        detalle.trim(),
        evidencia
          ? `Evidencia adjunta: ${evidencia.nombre}\nRuta: ${evidencia.ruta}\nURL temporal: ${evidencia.urlTemporal}`
          : null,
        opcion.urgente ? "Escalamiento automático: caso urgente." : null
      ].filter(Boolean).join("\n\n");

      await reportarIncidencia(cliente, trasladoId, opcion.tipo, opcion.momento, descripcion);
      if (opcion.urgente) {
        await activarSoporteEmergenciaConductor(cliente, trasladoId);
      }
      setMensaje({
        tono: "info",
        texto: opcion.urgente ? "Reporte urgente enviado. Operación lo atenderá con prioridad." : "Problema reportado. Operación dará seguimiento."
      });
      setDetalle("");
      setAdjunto(null);
      setProblema(null);
      setAbierto(false);
      router.refresh();
    } catch (err) {
      setMensaje({ tono: "danger", texto: traducirErrorOperativo(err, "No pudimos reportar el problema.") });
    } finally {
      setProcesando(false);
    }
  }

  return (
    <section id="reportar-problema" className="mt-6 rounded-lg border border-border bg-surface px-4 py-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="font-body text-sm font-semibold text-text-primary">Reportar un problema</p>
          <p className="mt-1 font-body text-sm leading-6 text-text-secondary">
            Abre un reporte operativo cuando algo impide avanzar o requiere seguimiento.
          </p>
        </div>
        <Button variant="secondary" className="min-h-12 w-full sm:w-auto" onClick={abrirSheet}>
          Abrir reporte
        </Button>
      </div>

      {mensaje && !abierto && (
        <output className="mt-4" aria-live="polite" aria-atomic="true">
          <Aviso tono={mensaje.tono}>{mensaje.texto}</Aviso>
        </output>
      )}

      {abierto && (
        <div className="fixed inset-0 z-50 flex items-end bg-black/60 px-3 pb-[max(12px,env(safe-area-inset-bottom))] pt-[max(12px,env(safe-area-inset-top))]">
          <dialog
            ref={dialogRef}
            aria-modal="true"
            aria-labelledby="reportar-problema-titulo"
            className="mx-auto flex max-h-[min(86dvh,720px)] w-full max-w-lg flex-col overflow-hidden rounded-t-2xl border border-border bg-surface shadow-[0_-18px_70px_rgba(26,31,46,0.28)] sm:rounded-2xl"
          >
            <div className="flex items-start justify-between gap-3 border-b border-border px-4 py-4">
              <div>
                <p className="font-body text-sm font-semibold text-route-action">Reporte operativo</p>
                <h2 id="reportar-problema-titulo" ref={tituloRef} tabIndex={-1} className="mt-1 font-display text-xl font-semibold text-text-primary">
                  ¿Qué está ocurriendo?
                </h2>
              </div>
              <button
                type="button"
                onClick={cerrarSheet}
                disabled={procesando}
                className="min-h-11 min-w-11 rounded-lg border border-border px-3 py-2 font-body text-sm font-semibold text-text-secondary disabled:text-disabled"
              >
                Cerrar
              </button>
            </div>

            <div className="overflow-y-auto px-4 pb-[max(16px,env(safe-area-inset-bottom))] pt-4">
              {mensaje && (
                <output aria-live="polite" aria-atomic="true">
                  <Aviso tono={mensaje.tono}>{mensaje.texto}</Aviso>
                </output>
              )}

              <fieldset className="mt-4">
                <legend className="sr-only">¿Qué está ocurriendo?</legend>
                <div className="mt-3 grid gap-2">
                  {OPCIONES.map((opcionProblema) => {
                    const activo = problema === opcionProblema.id;
                    return (
                      <button
                        key={opcionProblema.id}
                        type="button"
                        onClick={() => {
                          setProblema(opcionProblema.id);
                          setMensaje(null);
                        }}
                        className={[
                          "rounded-xl border px-3 py-3 text-left transition",
                          activo ? "border-route-action bg-route-soft" : "border-border bg-surface-elevated hover:border-route-action",
                          opcionProblema.urgente ? "border-danger-action" : ""
                        ].join(" ")}
                      >
                        <span className="block font-body text-sm font-semibold text-text-primary">{opcionProblema.etiqueta}</span>
                        <span className="mt-1 block font-body text-sm leading-6 text-text-secondary">{opcionProblema.ayuda}</span>
                      </button>
                    );
                  })}
                </div>
              </fieldset>

              {opcion && (
                <div className="mt-5 grid gap-4">
                  {opcion.urgente && (
                    <Aviso tono="danger">Este caso se enviará como urgente. Si hay riesgo inmediato, usa el panel de emergencia.</Aviso>
                  )}
                  <Field
                    etiqueta={opcion.pregunta}
                    value={detalle}
                    onChange={(event) => setDetalle(event.target.value)}
                    placeholder={opcion.placeholder}
                  />
                  {opcion.requiereEvidencia && (
                    <label className="grid gap-1">
                      <span className="font-body text-sm font-semibold text-text-tertiary">Evidencia</span>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={(event) => setAdjunto(event.target.files?.[0] ?? null)}
                        className="rounded-lg border border-border bg-surface px-3 py-2 font-body text-base text-text-primary"
                      />
                      <span className="font-body text-xs text-text-tertiary">
                        {adjunto ? `Adjunto listo: ${adjunto.name}` : "Adjunta una foto si te ayuda a explicar el problema."}
                      </span>
                    </label>
                  )}
                  <Button onClick={enviar} disabled={!puedeEnviar || procesando} loading={procesando}>
                    {procesando ? TEXTOS_CARGANDO.enviando : opcion.urgente ? "Enviar urgente" : "Enviar reporte"}
                  </Button>
                </div>
              )}
            </div>
          </dialog>
        </div>
      )}
    </section>
  );
}
