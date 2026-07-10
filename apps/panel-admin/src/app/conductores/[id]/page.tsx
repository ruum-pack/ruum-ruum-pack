"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { Button, Aviso, PassportCard } from "@ruum/ui";
import { ETIQUETA_NIVEL_CONCER } from "@ruum/shared/constants";
import type { Database } from "@ruum/shared/types";
import { crearClienteNavegador, puedeUsarDatosDemo, tieneSupabaseConfigurado } from "../../../lib/supabase-browser";
import {
  obtenerDetalleConductorAdmin,
  revisarDocumentoConductorAdmin,
  activarConductorAdmin,
  type EstadoDocumentoConductor
} from "@ruum/api/services";
import { CONDUCTORES_DEMO } from "../../../lib/datos-demo";

type ConductorRow = Database["public"]["Tables"]["conductores"]["Row"];
type DocumentoConductorRow = Database["public"]["Tables"]["documentos_conductor"]["Row"];

const ETIQUETA_ESTADO: Record<ConductorRow["estado"], string> = {
  activo: "Activo",
  suspendido_7d: "Suspendido (7 días)",
  suspendido_14d: "Suspendido (14 días)",
  suspendido_30d: "Suspendido (30 días)",
  suspendido_indefinido: "Suspendido indefinido",
  bloqueado_permanente: "Bloqueado permanente",
  modo_prueba_supervisada: "Modo de prueba supervisada",
  pendiente_verificacion: "Pendiente de validación"
};

const TIPOS_DOCUMENTO: { valor: string; etiqueta: string }[] = [
  { valor: "licencia_frente", etiqueta: "Licencia - frente" },
  { valor: "licencia_reverso", etiqueta: "Licencia - reverso" },
  { valor: "identificacion_oficial", etiqueta: "Identificación oficial" },
  { valor: "documento_operativo", etiqueta: "Documento operativo adicional" }
];

const DOCUMENTOS_REQUERIDOS = ["licencia_frente", "licencia_reverso", "identificacion_oficial"];

const ESTADO_DOCUMENTO: Record<string, { texto: string; clase: string }> = {
  pendiente: { texto: "Pendiente de carga", clase: "border-ink/15 bg-ink/[0.04] text-ink/60" },
  en_revision: { texto: "En revisión", clase: "border-route/30 bg-route-soft text-route-dark" },
  aprobado: { texto: "Aprobado", clase: "border-control/30 bg-control-soft text-control" },
  rechazado: { texto: "Rechazado", clase: "border-danger/25 bg-danger-soft text-danger" },
  vencido: { texto: "Vencido", clase: "border-danger/25 bg-danger-soft text-danger" },
  actualizacion: { texto: "Requiere actualización", clase: "border-warn/40 bg-warn-soft text-warn" }
};

function etiquetaTipo(tipo: string) {
  return TIPOS_DOCUMENTO.find((t) => t.valor === tipo)?.etiqueta ?? tipo;
}

/** Fase 2 — tarjeta de revisión individual por documento, mismo patrón que AccionesVerificacion (usuarios). */
function FilaDocumento({
  documento,
  esDemo,
  onRevisado
}: {
  documento: DocumentoConductorRow;
  esDemo: boolean;
  onRevisado: (documentoId: string, estado: EstadoDocumentoConductor, notas?: string) => Promise<void>;
}) {
  const [procesando, setProcesando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [urlDocumento, setUrlDocumento] = useState<string | null>(null);
  const [confirmando, setConfirmando] = useState<"rechazado" | "actualizacion" | null>(null);
  const [motivo, setMotivo] = useState("");

  const estadoInfo = ESTADO_DOCUMENTO[documento.estado] ?? ESTADO_DOCUMENTO.pendiente;
  const esFinal = documento.estado === "aprobado";

  async function verDocumento() {
    if (esDemo) {
      setUrlDocumento("#");
      return;
    }
    setProcesando(true);
    setError(null);
    try {
      const cliente = crearClienteNavegador();
      const { data, error: errUrl } = await cliente.storage.from("documentos-conductor").createSignedUrl(documento.url, 60 * 30);
      if (errUrl) throw errUrl;
      setUrlDocumento(data.signedUrl);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No pudimos obtener el documento.");
    } finally {
      setProcesando(false);
    }
  }

  async function aplicar(estado: EstadoDocumentoConductor, notas?: string) {
    setProcesando(true);
    setError(null);
    try {
      await onRevisado(documento.id, estado, notas);
      setConfirmando(null);
      setMotivo("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "No pudimos actualizar el documento.");
    } finally {
      setProcesando(false);
    }
  }

  return (
    <div className="rounded-lg border border-ink/10 px-4 py-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="font-body text-sm font-semibold">{etiquetaTipo(documento.tipo)}</p>
          <p className="mt-0.5 font-body text-xs text-ink/50">{documento.nombre_archivo}</p>
        </div>
        <span className={`rounded-full border px-2.5 py-1 font-body text-xs font-medium ${estadoInfo.clase}`}>
          {estadoInfo.texto}
        </span>
      </div>

      {documento.notas_admin && (
        <p className="mt-2 rounded-lg bg-warn-soft px-3 py-2 font-body text-xs text-warn">
          Nota para el conductor: {documento.notas_admin}
        </p>
      )}

      {error && (
        <div className="mt-2">
          <Aviso tono="peligro">{error}</Aviso>
        </div>
      )}

      <div className="mt-3 flex flex-wrap items-center gap-2">
        {urlDocumento ? (
          <a
            href={urlDocumento}
            target="_blank"
            rel="noopener noreferrer"
            className="font-body text-sm text-route-dark underline-offset-2 hover:underline"
          >
            Abrir documento (enlace válido 30 min)
          </a>
        ) : (
          <Button variant="fantasma" onClick={verDocumento} disabled={procesando}>
            Ver documento
          </Button>
        )}
      </div>

      {!esFinal &&
        (confirmando ? (
          <div className={`mt-3 rounded-lg border p-3 ${confirmando === "rechazado" ? "border-danger/25 bg-danger-soft/40" : "border-warn/35 bg-warn-soft/50"}`}>
            <p className="font-body text-sm font-semibold">
              {confirmando === "rechazado" ? "Rechazar documento" : "Solicitar actualización"}
            </p>
            <label className="mt-2 flex flex-col gap-1.5">
              <span className="font-body text-xs font-medium text-ink/70">
                Motivo <span className="text-danger">*</span>
              </span>
              <textarea
                value={motivo}
                onChange={(e) => setMotivo(e.target.value)}
                placeholder="Ej. La foto está borrosa, no se lee el número de licencia."
                className="min-h-[64px] resize-none rounded-lg border border-ink/20 bg-mist px-3 py-2 font-body text-sm text-ink focus:border-route-dark focus:outline-none focus:ring-2 focus:ring-route-dark/20"
                maxLength={500}
              />
            </label>
            <div className="mt-3 flex gap-2">
              <Button
                variant={confirmando === "rechazado" ? "peligro" : "secundario"}
                onClick={() => aplicar(confirmando, motivo)}
                disabled={procesando || motivo.trim().length < 5}
              >
                {procesando ? "Guardando…" : "Confirmar"}
              </Button>
              <Button variant="fantasma" onClick={() => { setConfirmando(null); setMotivo(""); }} disabled={procesando}>
                Cancelar
              </Button>
            </div>
          </div>
        ) : (
          <div className="mt-3 flex flex-wrap gap-2">
            <Button onClick={() => aplicar("aprobado")} disabled={procesando}>
              {procesando ? "…" : "Aprobar"}
            </Button>
            <Button variant="secundario" onClick={() => setConfirmando("actualizacion")} disabled={procesando}>
              Pedir actualización
            </Button>
            <Button variant="peligro" onClick={() => setConfirmando("rechazado")} disabled={procesando}>
              Rechazar
            </Button>
          </div>
        ))}
    </div>
  );
}

export default function PaginaDetalleConductorAdmin() {
  const { id } = useParams<{ id: string }>();

  const [conductor, setConductor] = useState<ConductorRow | null>(null);
  const [documentos, setDocumentos] = useState<DocumentoConductorRow[]>([]);
  const [esDemo, setEsDemo] = useState(true);
  const [cargando, setCargando] = useState(true);
  const [aviso, setAviso] = useState<{ tono: "info" | "peligro"; texto: string } | null>(null);
  const [activando, setActivando] = useState(false);

  async function cargar() {
    const demo = CONDUCTORES_DEMO.find((c) => c.id === id);
    if (!tieneSupabaseConfigurado() || demo) {
      setConductor(demo ?? null);
      setDocumentos([]);
      setEsDemo(true);
      setCargando(false);
      return;
    }
    try {
      const cliente = crearClienteNavegador();
      const detalle = await obtenerDetalleConductorAdmin(cliente, id);
      setConductor(detalle.conductor);
      setDocumentos(detalle.documentos);
      setEsDemo(false);
    } catch {
      if (puedeUsarDatosDemo()) {
        setConductor(demo ?? null);
        setDocumentos([]);
        setEsDemo(true);
      } else {
        setConductor(null);
        setDocumentos([]);
        setEsDemo(false);
      }
    } finally {
      setCargando(false);
    }
  }

  useEffect(() => {
    const timer = setTimeout(() => { void cargar(); }, 0);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  async function revisarDocumento(documentoId: string, estado: EstadoDocumentoConductor, notas?: string) {
    if (esDemo) {
      await new Promise((r) => setTimeout(r, 300));
      setDocumentos((prev) => prev.map((d) => (d.id === documentoId ? { ...d, estado, notas_admin: notas ?? null } : d)));
      return;
    }
    const cliente = crearClienteNavegador();
    await revisarDocumentoConductorAdmin(cliente, documentoId, estado, notas);
    await cargar();
  }

  async function activar() {
    if (!conductor) return;
    setActivando(true);
    setAviso(null);

    if (esDemo) {
      await new Promise((r) => setTimeout(r, 400));
      setConductor((prev) => (prev ? { ...prev, estado: "activo", documentos_vigentes: true } : prev));
      setAviso({ tono: "info", texto: "Conductor activado en modo demo." });
      setActivando(false);
      return;
    }

    try {
      const cliente = crearClienteNavegador();
      await activarConductorAdmin(cliente, conductor.id);
      setAviso({ tono: "info", texto: "Conductor activado. Ya puede recibir traslados." });
      await cargar();
    } catch (err) {
      setAviso({ tono: "peligro", texto: err instanceof Error ? err.message : "No pudimos activar al conductor." });
    } finally {
      setActivando(false);
    }
  }

  if (cargando) {
    return (
      <main className="mx-auto max-w-4xl px-6 py-8 sm:px-8 sm:py-10">
        <p className="font-body text-sm text-ink/50">Cargando…</p>
      </main>
    );
  }

  if (!conductor) {
    return (
      <main className="mx-auto max-w-4xl px-8 py-10 text-center">
        <h1 className="font-display text-xl font-semibold">No encontramos ese conductor</h1>
        <Link href="/conductores" className="mt-3 inline-block font-body text-sm text-route-dark hover:underline">
          ← Volver a conductores
        </Link>
      </main>
    );
  }

  const documentosRequeridosAprobados = DOCUMENTOS_REQUERIDOS.every((tipo) =>
    documentos.some((d) => d.tipo === tipo && d.estado === "aprobado")
  );
  const puedeActivar = conductor.estado === "pendiente_verificacion" && documentosRequeridosAprobados;

  return (
    <main className="mx-auto max-w-3xl px-6 py-8 sm:px-8 sm:py-10">
      <Link href="/conductores" className="font-body text-sm text-ink/55 hover:text-ink">
        ← Conductores
      </Link>

      {esDemo && (
        <div className="mt-4">
          <Aviso tono="info">
            Estás viendo datos de ejemplo{documentos.length === 0 ? " y este conductor demo no tiene documentos cargados" : ""}.
          </Aviso>
        </div>
      )}
      {aviso && (
        <div className="mt-4" role="status" aria-live="polite" aria-atomic="true">
          <Aviso tono={aviso.tono}>{aviso.texto}</Aviso>
        </div>
      )}

      <div className="mt-4 flex items-start justify-between gap-4">
        <div>
          <p className="font-body text-xs uppercase tracking-wide text-ink/45">Expediente de conductor</p>
          <h1 className="mt-1 font-display text-2xl font-semibold">{conductor.nombre}</h1>
          <p className="mt-1 font-body text-sm text-ink/50">{conductor.telefono ?? "Sin teléfono registrado"}</p>
        </div>
        <span className="rounded-full border border-ink/15 bg-ink/[0.04] px-3 py-1 font-body text-xs font-medium text-ink/70">
          {ETIQUETA_ESTADO[conductor.estado]}
        </span>
      </div>

      <div className="mt-6">
        <PassportCard>
          <p className="font-body text-xs uppercase tracking-wide text-ink/45">Resumen operativo</p>
          <dl className="mt-3 space-y-2 font-body text-sm">
            <div className="flex justify-between">
              <dt className="text-ink/45">Nivel vigente</dt>
              <dd>{conductor.nivel_operativo_vigente ? ETIQUETA_NIVEL_CONCER[conductor.nivel_operativo_vigente] : "—"}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-ink/45">Calificación</dt>
              <dd className="font-mono-ruum">{conductor.calificacion_promedio || "—"}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-ink/45">Traslados completados</dt>
              <dd className="font-mono-ruum">{conductor.traslados_completados}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-ink/45">Registrado</dt>
              <dd>{new Date(conductor.creado_en).toLocaleString("es-MX")}</dd>
            </div>
          </dl>
        </PassportCard>
      </div>

      <div className="mt-6">
        <PassportCard>
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="font-body text-xs uppercase tracking-wide text-ink/45">Expediente documental</p>
              <h2 className="mt-1 font-display text-lg font-semibold">Documentos</h2>
            </div>
          </div>

          <div className="mt-4 space-y-3">
            {documentos.length === 0 ? (
              <p className="font-body text-sm text-ink/45">
                {esDemo ? "Sin documentos en modo demo." : "El conductor todavía no ha subido documentos."}
              </p>
            ) : (
              documentos.map((d) => (
                <FilaDocumento key={d.id} documento={d} esDemo={esDemo} onRevisado={revisarDocumento} />
              ))
            )}
          </div>

          <div className="mt-5 border-t border-ink/10 pt-4">
            {conductor.estado === "pendiente_verificacion" ? (
              <>
                <Button onClick={activar} disabled={!puedeActivar || activando}>
                  {activando ? "Activando…" : "Activar conductor"}
                </Button>
                {!documentosRequeridosAprobados && (
                  <p className="mt-2 font-body text-xs text-ink/40">
                    Se habilita cuando los 3 documentos obligatorios (licencia frente, licencia reverso e identificación
                    oficial) estén aprobados.
                  </p>
                )}
              </>
            ) : (
              <p className="font-body text-xs text-ink/40">
                Este conductor ya no está en revisión inicial (estado actual: {ETIQUETA_ESTADO[conductor.estado]}).
              </p>
            )}
          </div>
        </PassportCard>
      </div>
    </main>
  );
}
