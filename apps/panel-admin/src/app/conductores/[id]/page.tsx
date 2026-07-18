"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { Aviso, Button, PassportCard } from "@ruum/ui";
import type { Database, Json } from "@ruum/shared/types";
import {
  aprobarSolicitudConductorAdmin,
  obtenerDetalleSolicitudConductorAdmin,
  rechazarSolicitudConductorAdmin,
  revisarDocumentoConductorAdmin,
  type DetalleSolicitudConductorAdmin,
  type EstadoDocumentoConductor
} from "@ruum/api/services";
import { crearClienteNavegador, tieneSupabaseConfigurado } from "../../../lib/supabase-browser";

type DocumentoRow = Database["public"]["Tables"]["documentos_conductor"]["Row"];
type EstadoSolicitud = Database["public"]["Enums"]["estado_expediente_conductor"];

const DOCUMENTOS_REQUERIDOS = ["licencia_frente", "licencia_reverso", "identificacion_oficial"];
const ETIQUETA_DOCUMENTO: Record<string, string> = {
  licencia_frente: "Licencia · frente",
  licencia_reverso: "Licencia · reverso",
  identificacion_oficial: "Identificación oficial",
  documento_operativo: "Documento operativo adicional"
};
const ETIQUETA_CONSENTIMIENTO: Record<string, string> = {
  terminos_servicio: "Términos de servicio",
  aviso_privacidad: "Aviso de privacidad",
  autorizacion_antecedentes: "Autorización de antecedentes",
  declaracion_suspensiones: "Declaración de no suspensión"
};
const ETIQUETA_ESTADO: Record<EstadoSolicitud, string> = {
  borrador: "Borrador", correo_pendiente: "Correo pendiente", datos_incompletos: "Datos incompletos",
  documentos_pendientes: "Documentos pendientes", listo_para_enviar: "Lista para enviar", en_revision: "En revisión",
  requiere_correccion: "Requiere corrección", aprobado: "Aprobada", rechazado: "Rechazada", suspendido: "Suspendida"
};
const ETIQUETA_DECISION: Record<string, string> = {
  registro_inicial: "Estado inicial", cambio_estado: "Cambio de estado", aprobar_documento: "Documento aprobado",
  rechazar_documento: "Documento rechazado", vencer_documento: "Documento vencido",
  solicitar_correccion: "Corrección solicitada", aprobar_solicitud: "Solicitud aprobada", rechazar_solicitud: "Solicitud rechazada"
};
const ESTADO_DOCUMENTO: Record<string, { texto: string; clase: string }> = {
  en_revision: { texto: "En revisión", clase: "border-status-info/30 bg-status-info-soft text-status-info" },
  aprobado: { texto: "Aprobado", clase: "border-status-success/30 bg-status-success-soft text-status-success" },
  rechazado: { texto: "Rechazado", clase: "border-status-error/25 bg-status-error-soft text-status-error" },
  vencido: { texto: "Vencido", clase: "border-status-error/25 bg-status-error-soft text-status-error" }
};

function textoJson(valor: Json, llave: string) {
  if (!valor || typeof valor !== "object" || Array.isArray(valor)) return null;
  const dato = valor[llave];
  return typeof dato === "string" && dato.trim() ? dato.trim() : null;
}

function fecha(valor: string | null) {
  return valor ? new Date(valor).toLocaleString("es-MX", { dateStyle: "medium", timeStyle: "short" }) : "—";
}

function FilaDocumento({ documento, onRevisado }: {
  documento: DocumentoRow;
  onRevisado: (id: string, estado: EstadoDocumentoConductor, notas?: string) => Promise<void>;
}) {
  const [procesando, setProcesando] = useState(false);
  const [motivo, setMotivo] = useState("");
  const [rechazando, setRechazando] = useState(false);
  const [url, setUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const estado = ESTADO_DOCUMENTO[documento.estado] ?? ESTADO_DOCUMENTO.en_revision;

  async function ver() {
    setProcesando(true);
    setError(null);
    try {
      const { data, error: errorUrl } = await crearClienteNavegador().storage
        .from("documentos-conductor").createSignedUrl(documento.url, 60 * 30);
      if (errorUrl) throw errorUrl;
      setUrl(data.signedUrl);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No pudimos abrir el documento.");
    } finally { setProcesando(false); }
  }

  async function decidir(nuevoEstado: EstadoDocumentoConductor, notas?: string) {
    setProcesando(true);
    setError(null);
    try {
      await onRevisado(documento.id, nuevoEstado, notas);
      setRechazando(false);
      setMotivo("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "No pudimos registrar la decisión.");
    } finally { setProcesando(false); }
  }

  return (
    <div className="rounded-lg border border-ink/10 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="font-body text-sm font-semibold">{ETIQUETA_DOCUMENTO[documento.tipo] ?? documento.tipo}</p>
          <p className="mt-0.5 font-body text-xs text-text-tertiary">Versión {documento.version} · {documento.nombre_archivo}</p>
        </div>
        <span className={`rounded-full border px-2.5 py-1 font-body text-xs font-medium ${estado.clase}`}>{estado.texto}</span>
      </div>
      {(documento.motivo_rechazo || documento.notas_admin) && (
        <p className="mt-3 rounded-lg bg-status-warning-soft px-3 py-2 font-body text-xs text-status-warning">{documento.motivo_rechazo ?? documento.notas_admin}</p>
      )}
      {error && <div className="mt-3"><Aviso tono="danger">{error}</Aviso></div>}
      <div className="mt-3 flex flex-wrap gap-2">
        {url ? <a href={url} target="_blank" rel="noreferrer" className="font-body text-sm text-status-info hover:underline">Abrir documento</a>
          : <Button variant="quiet" onClick={ver} disabled={procesando}>Ver documento</Button>}
        {documento.estado === "en_revision" && !rechazando && (
          <>
            <Button onClick={() => decidir("aprobado")} disabled={procesando}>Aprobar</Button>
            <Button variant="danger" onClick={() => setRechazando(true)} disabled={procesando}>Solicitar corrección</Button>
          </>
        )}
      </div>
      {rechazando && (
        <div className="mt-3 rounded-lg border border-status-warning/30 bg-status-warning-soft/40 p-3">
          <label className="font-body text-xs font-medium">Motivo para el conductor</label>
          <textarea value={motivo} onChange={(e) => setMotivo(e.target.value)} maxLength={500}
            className="mt-2 min-h-20 w-full rounded-lg border border-ink/20 bg-surface-primary px-3 py-2 font-body text-sm focus:border-focus-default focus:outline-none"
            placeholder="Indica exactamente qué debe corregir." />
          <div className="mt-2 flex gap-2">
            <Button variant="danger" onClick={() => decidir("rechazado", motivo)} disabled={procesando || motivo.trim().length < 5}>Confirmar</Button>
            <Button variant="quiet" onClick={() => { setRechazando(false); setMotivo(""); }} disabled={procesando}>Cancelar</Button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function PaginaDetalleSolicitudConductorAdmin() {
  const { id } = useParams<{ id: string }>();
  const [detalle, setDetalle] = useState<DetalleSolicitudConductorAdmin | null>(null);
  const [cargando, setCargando] = useState(true);
  const [procesando, setProcesando] = useState(false);
  const [accion, setAccion] = useState<"aprobar" | "rechazar" | null>(null);
  const [motivo, setMotivo] = useState("");
  const [aviso, setAviso] = useState<{ tono: "info" | "danger"; texto: string } | null>(null);

  const cargar = useCallback(async () => {
    if (!tieneSupabaseConfigurado()) { setCargando(false); return; }
    try {
      setDetalle(await obtenerDetalleSolicitudConductorAdmin(crearClienteNavegador(), id));
    } catch (err) {
      setAviso({ tono: "danger", texto: err instanceof Error ? err.message : "No pudimos cargar el expediente." });
    } finally { setCargando(false); }
  }, [id]);

  useEffect(() => {
    const timer = setTimeout(() => { void cargar(); }, 0);
    return () => clearTimeout(timer);
  }, [cargar]);

  const consentimientosActuales = useMemo(() => {
    const porTipo = new Map<string, DetalleSolicitudConductorAdmin["consentimientos"][number]>();
    for (const consentimiento of detalle?.consentimientos ?? []) {
      if (!porTipo.has(consentimiento.tipo_documento)) porTipo.set(consentimiento.tipo_documento, consentimiento);
    }
    return [...porTipo.values()];
  }, [detalle]);

  async function revisarDocumento(documentoId: string, estado: EstadoDocumentoConductor, notas?: string) {
    await revisarDocumentoConductorAdmin(crearClienteNavegador(), documentoId, estado, notas);
    await cargar();
  }

  async function decidir() {
    if (!detalle || !accion) return;
    setProcesando(true);
    setAviso(null);
    try {
      if (accion === "aprobar") {
        await aprobarSolicitudConductorAdmin(crearClienteNavegador(), detalle.solicitud.id, motivo);
        setAviso({ tono: "info", texto: "Solicitud aprobada y conductor activado." });
      } else {
        await rechazarSolicitudConductorAdmin(crearClienteNavegador(), detalle.solicitud.id, motivo);
        setAviso({ tono: "info", texto: "Solicitud rechazada con decisión registrada." });
      }
      setAccion(null);
      setMotivo("");
      await cargar();
    } catch (err) {
      setAviso({ tono: "danger", texto: err instanceof Error ? err.message : "No pudimos registrar la decisión." });
    } finally { setProcesando(false); }
  }

  if (cargando) return <main className="mx-auto max-w-4xl px-8 py-10"><p className="font-body text-sm text-text-tertiary">Cargando…</p></main>;
  if (!detalle) return (
    <main className="mx-auto max-w-4xl px-8 py-10 text-center">
      <h1 className="font-display text-xl font-semibold">No encontramos esa solicitud</h1>
      {aviso && <div className="mt-4"><Aviso tono={aviso.tono}>{aviso.texto}</Aviso></div>}
      <Link href="/conductores" className="mt-4 inline-block font-body text-sm text-status-info hover:underline">← Volver a la bandeja</Link>
    </main>
  );

  const { solicitud, documentos, historial } = detalle;
  const nombre = textoJson(solicitud.datos_personales, "nombre") ?? "Conductor sin nombre";
  const documentosAprobados = DOCUMENTOS_REQUERIDOS.every((tipo) => documentos.some((d) => d.tipo === tipo && d.estado === "aprobado"));
  const puedeAprobar = solicitud.estado === "en_revision" && documentosAprobados && consentimientosActuales.length === 4;

  return (
    <main className="mx-auto max-w-4xl px-6 py-8 sm:px-8 sm:py-10">
      <Link href="/conductores" className="font-body text-sm text-text-secondary hover:text-ink">← Solicitudes</Link>
      {aviso && <div className="mt-4"><Aviso tono={aviso.tono}>{aviso.texto}</Aviso></div>}

      <div className="mt-5 flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="font-body text-xs uppercase tracking-wide text-text-tertiary">Expediente {solicitud.id.slice(0, 8)}</p>
          <h1 className="mt-1 font-display text-2xl font-semibold">{nombre}</h1>
          <p className="mt-1 font-body text-sm text-text-tertiary">{solicitud.curp_normalizada ?? "CURP no registrada"} · {solicitud.telefono_normalizado ?? "Sin teléfono"}</p>
        </div>
        <span className="rounded-full border border-ink/15 bg-ink/[0.04] px-3 py-1 font-body text-xs font-medium">{ETIQUETA_ESTADO[solicitud.estado]}</span>
      </div>

      <div className="mt-6 grid gap-5 md:grid-cols-2">
        <PassportCard>
          <h2 className="font-display text-lg font-semibold">Datos del expediente</h2>
          <dl className="mt-3 space-y-2 font-body text-sm">
            <div className="flex justify-between gap-4"><dt className="text-text-tertiary">Paso actual</dt><dd>{solicitud.paso_actual}</dd></div>
            <div className="flex justify-between gap-4"><dt className="text-text-tertiary">Enviado</dt><dd>{fecha(solicitud.enviado_en)}</dd></div>
            <div className="flex justify-between gap-4"><dt className="text-text-tertiary">Licencia</dt><dd>{solicitud.licencia_normalizada ?? "—"}</dd></div>
            <div className="flex justify-between gap-4"><dt className="text-text-tertiary">Vigencia</dt><dd>{textoJson(solicitud.licencia, "vigencia") ?? "—"}</dd></div>
            <div className="flex justify-between gap-4"><dt className="text-text-tertiary">Domicilio</dt><dd className="text-right">{[textoJson(solicitud.domicilio, "colonia"), textoJson(solicitud.domicilio, "ciudad_municipio"), textoJson(solicitud.domicilio, "estado")].filter(Boolean).join(", ") || "—"}</dd></div>
          </dl>
        </PassportCard>
        <PassportCard>
          <h2 className="font-display text-lg font-semibold">Consentimientos</h2>
          <div className="mt-3 space-y-2">
            {consentimientosActuales.length === 0 ? <p className="font-body text-sm text-text-tertiary">Sin consentimientos registrados.</p> : consentimientosActuales.map((c) => (
              <div key={c.id} className="rounded-lg border border-ink/10 px-3 py-2 font-body text-sm">
                <p className="font-medium">{ETIQUETA_CONSENTIMIENTO[c.tipo_documento]}</p>
                <p className="mt-0.5 text-xs text-text-tertiary">Versión {c.version} · {fecha(c.aceptado_en)} · {c.canal}</p>
                <p className="mt-1 truncate font-mono-ruum text-[10px] text-text-tertiary" title={c.hash_documento}>Hash {c.hash_documento}</p>
              </div>
            ))}
          </div>
        </PassportCard>
      </div>

      <div className="mt-6"><PassportCard>
        <h2 className="font-display text-lg font-semibold">Documentos vigentes</h2>
        <div className="mt-4 space-y-3">
          {documentos.length === 0 ? <p className="font-body text-sm text-text-tertiary">No hay documentos vigentes.</p>
            : documentos.map((documento) => <FilaDocumento key={documento.id} documento={documento} onRevisado={revisarDocumento} />)}
        </div>
      </PassportCard></div>

      <div className="mt-6"><PassportCard>
        <h2 className="font-display text-lg font-semibold">Decisión administrativa</h2>
        {solicitud.estado === "en_revision" ? (
          <>
            <div className="mt-4 flex flex-wrap gap-2">
              <Button onClick={() => setAccion("aprobar")} disabled={!puedeAprobar || procesando}>Aprobar solicitud</Button>
              <Button variant="danger" onClick={() => setAccion("rechazar")} disabled={procesando}>Rechazar solicitud</Button>
            </div>
            {!puedeAprobar && <p className="mt-2 font-body text-xs text-text-tertiary">Para aprobar se requieren los 3 documentos aprobados y los 4 consentimientos registrados.</p>}
          </>
        ) : <p className="mt-3 font-body text-sm text-text-tertiary">La solicitud no admite una decisión final en su estado actual.</p>}
        {accion && (
          <div className="mt-4 rounded-lg border border-ink/10 bg-ink/[0.02] p-4">
            <label className="font-body text-sm font-medium">Motivo de la decisión {accion === "rechazar" && <span className="text-status-error">*</span>}</label>
            <textarea value={motivo} onChange={(e) => setMotivo(e.target.value)} maxLength={800}
              placeholder={accion === "aprobar" ? "Opcional: observaciones de la aprobación." : "Explica el motivo del rechazo."}
              className="mt-2 min-h-24 w-full rounded-lg border border-ink/20 bg-surface-primary px-3 py-2 font-body text-sm focus:border-focus-default focus:outline-none" />
            <div className="mt-3 flex gap-2">
              <Button variant={accion === "rechazar" ? "danger" : "primary"} onClick={decidir} disabled={procesando || (accion === "rechazar" && motivo.trim().length < 5)}>
                {procesando ? "Registrando…" : "Confirmar decisión"}
              </Button>
              <Button variant="quiet" onClick={() => { setAccion(null); setMotivo(""); }} disabled={procesando}>Cancelar</Button>
            </div>
          </div>
        )}
      </PassportCard></div>

      <div className="mt-6"><PassportCard>
        <h2 className="font-display text-lg font-semibold">Historial de estados y decisiones</h2>
        <ol className="mt-4 space-y-4">
          {historial.map((evento) => (
            <li key={evento.id} className="border-l-2 border-status-info/25 pl-4 font-body text-sm">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="font-semibold">{ETIQUETA_DECISION[evento.decision] ?? evento.decision}</p>
                <time className="text-xs text-text-tertiary">{fecha(evento.revisado_en)}</time>
              </div>
              <p className="mt-1 text-xs text-text-tertiary">{ETIQUETA_ESTADO[evento.estado_anterior]} → {ETIQUETA_ESTADO[evento.estado_nuevo]} · {evento.revisor_nombre ?? "Sistema/conductor"}</p>
              {evento.motivo && <p className="mt-1 text-text-secondary">{evento.motivo}</p>}
            </li>
          ))}
        </ol>
      </PassportCard></div>
    </main>
  );
}
