"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { Aviso, Button, PassportCard } from "@ruum/ui";
import type { Database } from "@ruum/shared/types";
import { crearClienteNavegador, tieneSupabaseConfigurado } from "../../../../lib/supabase-browser";
import {
  obtenerConductorAdmin,
  actualizarConductorAdmin,
  suspenderConductorAdmin,
  reactivarConductorAdmin,
  darBajaConductorAdmin,
  obtenerVehiculosDeConductorAdmin,
  obtenerEmpresaDeConductorAdmin,
  obtenerHistorialEstatusConductorAdmin,
  verificarVigenciasDocumentosConductor
} from "@ruum/api/services";

type ConductorRow = Database["public"]["Tables"]["conductores"]["Row"];
type DocumentoRow = Database["public"]["Tables"]["documentos_conductor"]["Row"];
type VehiculoRow = Database["public"]["Tables"]["vehiculos"]["Row"];
type EmpresaRow = Database["public"]["Tables"]["empresas"]["Row"];
type HistorialEstatus = {
  id: string;
  conductor_id: string;
  estado_anterior: string | null;
  estado_nuevo: string;
  motivo: string | null;
  cambiado_por: string;
  cambiado_en: string;
};

const ESTADO_CLASE: Record<string, string> = {
  activo: "border-status-success/30 bg-status-success-soft text-status-success",
  suspendido_7d: "border-status-error/30 bg-status-error-soft text-status-error",
  suspendido_14d: "border-status-error/30 bg-status-error-soft text-status-error",
  suspendido_30d: "border-status-error/30 bg-status-error-soft text-status-error",
  suspendido_indefinido: "border-status-error/30 bg-status-error-soft text-status-error",
  bloqueado_permanente: "border-ink/30 bg-ink/10 text-text-tertiary",
  modo_prueba_supervisada: "border-status-warning/30 bg-status-warning-soft text-status-warning",
  pendiente_verificacion: "border-ink/30 bg-ink/10 text-text-tertiary"
};

const ETIQUETA_ESTADO: Record<string, string> = {
  activo: "Activo",
  suspendido_7d: "Suspendido (7d)",
  suspendido_14d: "Suspendido (14d)",
  suspendido_30d: "Suspendido (30d)",
  suspendido_indefinido: "Suspendido",
  bloqueado_permanente: "Baja",
  modo_prueba_supervisada: "Modo prueba",
  pendiente_verificacion: "Pendiente"
};

const ETIQUETA_DOCUMENTO: Record<string, string> = {
  licencia_frente: "Licencia · frente",
  licencia_reverso: "Licencia · reverso",
  identificacion_oficial: "Identificación oficial",
  documento_operativo: "Documento operativo adicional"
};

const ESTADO_DOCUMENTO: Record<string, { texto: string; clase: string }> = {
  en_revision: { texto: "En revisión", clase: "border-status-info/30 bg-status-info-soft text-status-info" },
  aprobado: { texto: "Aprobado", clase: "border-status-success/30 bg-status-success-soft text-status-success" },
  rechazado: { texto: "Rechazado", clase: "border-status-error/25 bg-status-error-soft text-status-error" },
  vencido: { texto: "Vencido", clase: "border-status-error/25 bg-status-error-soft text-status-error" }
};

function fecha(valor: string | null) {
  return valor ? new Date(valor).toLocaleString("es-MX", { dateStyle: "medium", timeStyle: "short" }) : "—";
}

export default function PaginaDetalleConductorAdmin() {
  const { id } = useParams<{ id: string }>();

  const [conductor, setConductor] = useState<ConductorRow | null>(null);
  const [documentos, setDocumentos] = useState<DocumentoRow[]>([]);
  const [vehiculos, setVehiculos] = useState<VehiculoRow[]>([]);
  const [empresa, setEmpresa] = useState<EmpresaRow | null>(null);
  const [historial, setHistorial] = useState<HistorialEstatus[]>([]);
  const [cargando, setCargando] = useState(true);
  const [aviso, setAviso] = useState<{ tono: "info" | "danger"; texto: string } | null>(null);

  const cargar = useCallback(async () => {
    if (!tieneSupabaseConfigurado()) { setCargando(false); return; }
    try {
      const cliente = crearClienteNavegador();
      const [c, d, v, e, h, a] = await Promise.all([
        obtenerConductorAdmin(cliente, id),
        cliente.from("documentos_conductor").select("*").eq("conductor_id", id).order("creado_en", { ascending: false }),
        obtenerVehiculosDeConductorAdmin(cliente, id),
        obtenerEmpresaDeConductorAdmin(cliente, id),
        obtenerHistorialEstatusConductorAdmin(cliente, id),
        verificarVigenciasDocumentosConductor(cliente, id)
      ]);
      setConductor(c);
      if (!d.error) setDocumentos(d.data ?? []);
      setVehiculos(v);
      setEmpresa(e);
      setHistorial(h);
      void a;
    } catch { setConductor(null); }
    finally { setCargando(false); }
  }, [id]);

  useEffect(() => { void cargar(); }, [cargar]);

  if (cargando) return <main className="mx-auto max-w-3xl px-6 py-8"><p className="font-body text-text-tertiary">Cargando…</p></main>;
  if (!conductor) return (
    <main className="mx-auto max-w-3xl px-6 py-8">
      <Aviso tono="danger">No se encontró el conductor.</Aviso>
      <Link href="/conductores/activos" className="mt-4 inline-block font-body text-sm text-focus-default hover:underline">Volver</Link>
    </main>
  );

  const documentosActuales = Object.entries(
    documentos.reduce((acc, doc) => {
      if (!acc[doc.tipo] || doc.version > acc[doc.tipo].version) acc[doc.tipo] = doc;
      return acc;
    }, {} as Record<string, DocumentoRow>)
  ).map(([, doc]) => doc);

  return (
    <main className="mx-auto max-w-3xl px-6 py-8 sm:px-8 sm:py-10">
      <div className="flex items-center gap-3">
        <Link href="/conductores/activos" className="font-body text-sm text-text-tertiary hover:text-ink">&larr; Conductores</Link>
      </div>

      {aviso && <div className="mt-4"><Aviso tono={aviso.tono}>{aviso.texto}</Aviso></div>}

      <div className="mt-6">
        <h1 className="font-display text-2xl font-semibold">{conductor.nombre}</h1>
        <p className="mt-1 font-body text-sm text-text-secondary">{conductor.curp ?? "Sin CURP"} · {conductor.telefono ?? "Sin teléfono"}</p>
        <div className="mt-3 flex flex-wrap gap-2">
          <span className={`rounded-full border px-3 py-1 font-body text-xs font-medium ${ESTADO_CLASE[conductor.estado] ?? ""}`}>{ETIQUETA_ESTADO[conductor.estado] ?? conductor.estado}</span>
          <span className="rounded-full bg-ink/10 px-3 py-1 font-body text-xs">Licencia: {conductor.licencia_numero ?? "—"}</span>
        </div>
      </div>

      <div className="mt-8 grid gap-6 sm:grid-cols-2">
        <Seccion titulo="Datos personales">
          <Dato etiqueta="Nombre" valor={conductor.nombre} />
          <Dato etiqueta="Teléfono" valor={conductor.telefono} />
          <Dato etiqueta="CURP" valor={conductor.curp} />
          <Dato etiqueta="Licencia" valor={conductor.licencia_numero} />
          <Dato etiqueta="Tipo licencia" valor={conductor.licencia_tipo} />
          <Dato etiqueta="Vigencia" valor={conductor.licencia_vigencia} />
          <Dato etiqueta="Contacto emergencia" valor={conductor.contacto_emergencia_nombre} />
          <Dato etiqueta="Tel. emergencia" valor={conductor.contacto_emergencia_telefono} />
        </Seccion>

        <Seccion titulo="Domicilio">
          <Dato etiqueta="Calle" valor={conductor.calle} />
          <Dato etiqueta="Número" valor={conductor.numero} />
          <Dato etiqueta="Colonia" valor={conductor.colonia} />
          <Dato etiqueta="Ciudad/Municipio" valor={conductor.ciudad_municipio} />
          <Dato etiqueta="Estado" valor={conductor.estado_residencia} />
          <Dato etiqueta="Código postal" valor={conductor.codigo_postal} />
        </Seccion>

        <Seccion titulo="Estados y fechas">
          <Dato etiqueta="Estado actual" valor={ETIQUETA_ESTADO[conductor.estado] ?? conductor.estado} />
          <Dato etiqueta="Registrado" valor={fecha(conductor.creado_en)} />
          <Dato etiqueta="Actualizado" valor={fecha(conductor.actualizado_en)} />
        </Seccion>
      </div>

      <div className="mt-10">
        <EditarConductor conductor={conductor} onActualizado={(c) => { setConductor(c); setAviso({ tono: "info", texto: "Conductor actualizado." }); }} />
      </div>

      <div className="mt-10">
        <h2 className="font-display text-lg font-semibold">Documentos</h2>
        <div className="mt-3 rounded-card border border-ink/10 bg-surface-primary p-4">
          {documentosActuales.length === 0 ? <p className="font-body text-sm text-text-tertiary">Sin documentos registrados.</p> : (
            <div className="space-y-3">
              {documentosActuales.map((doc) => (
                <FilaDocumento key={doc.id} documento={doc} />
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="mt-10 border-t border-ink/10 pt-8">
        <h2 className="font-display text-lg font-semibold text-status-error">Zona de riesgo</h2>
        <p className="mt-1 font-body text-sm text-text-secondary">Estas acciones afectan la cuenta del conductor.</p>
        <div className="mt-4 flex flex-wrap gap-3">
          {conductor.estado === "activo" && (
            <SuspenderConductor conductorId={conductor.id} onCompletado={() => { void cargar(); setAviso({ tono: "info", texto: "Conductor suspendido." }); }} />
          )}
          {(conductor.estado === "suspendido_7d" || conductor.estado === "suspendido_14d" || conductor.estado === "suspendido_30d" || conductor.estado === "suspendido_indefinido") && (
            <ReactivarConductor conductorId={conductor.id} onCompletado={() => { void cargar(); setAviso({ tono: "info", texto: "Conductor reactivado." }); }} />
          )}
          {conductor.estado !== "bloqueado_permanente" && (
            <DarBajaConductor conductorId={conductor.id} onCompletado={() => { void cargar(); setAviso({ tono: "info", texto: "Conductor dado de baja." }); }} />
          )}
        </div>
      </div>
    </main>
  );
}

function Seccion({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <div className="rounded-card border border-ink/10 bg-surface-primary p-4">
      <h3 className="font-display text-sm font-semibold uppercase tracking-wide text-text-tertiary">{titulo}</h3>
      <div className="mt-3 space-y-2">{children}</div>
    </div>
  );
}

function Dato({ etiqueta, valor }: { etiqueta: string; valor: string | null | undefined }) {
  return (
    <div className="flex justify-between gap-2 font-body text-sm">
      <span className="text-text-secondary">{etiqueta}</span>
      <span className="text-right font-medium text-ink">{valor ?? <span className="text-text-tertiary">—</span>}</span>
    </div>
  );
}

function FilaDocumento({ documento }: { documento: DocumentoRow }) {
  const [url, setUrl] = useState<string | null>(null);
  const [procesando, setProcesando] = useState(false);
  const estado = ESTADO_DOCUMENTO[documento.estado] ?? ESTADO_DOCUMENTO.en_revision;

  async function ver() {
    setProcesando(true);
    try {
      const { data, error } = await crearClienteNavegador().storage.from("documentos-conductor").createSignedUrl(documento.url, 60 * 30);
      if (error) throw error;
      setUrl(data.signedUrl);
    } catch (err) {
      console.error(err);
    } finally {
      setProcesando(false);
    }
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
      <div className="mt-3 flex flex-wrap gap-2">
        {url ? <a href={url} target="_blank" rel="noopener noreferrer" className="font-body text-sm text-status-info hover:underline">Abrir documento</a> : <Button variant="quiet" onClick={ver} disabled={procesando}>{procesando ? "Cargando…" : "Ver documento"}</Button>}
      </div>
    </div>
  );
}

function EditarConductor({ conductor, onActualizado }: { conductor: ConductorRow; onActualizado: (c: ConductorRow) => void }) {
  const [editando, setEditando] = useState(false);
  const [datos, setDatos] = useState({
    nombre: conductor.nombre ?? "",
    telefono: conductor.telefono ?? "",
    curp: conductor.curp ?? "",
    licencia_numero: conductor.licencia_numero ?? "",
    licencia_tipo: conductor.licencia_tipo ?? "",
    licencia_vigencia: conductor.licencia_vigencia ?? "",
    codigo_postal: conductor.codigo_postal ?? "",
    estado_residencia: conductor.estado_residencia ?? "",
    ciudad_municipio: conductor.ciudad_municipio ?? "",
    colonia: conductor.colonia ?? "",
    calle: conductor.calle ?? "",
    numero: conductor.numero ?? "",
    referencias: conductor.referencias ?? "",
    contacto_emergencia_nombre: conductor.contacto_emergencia_nombre ?? "",
    contacto_emergencia_telefono: conductor.contacto_emergencia_telefono ?? ""
  });
  const [procesando, setProcesando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!editando) {
    return (
      <div>
        <h2 className="font-display text-lg font-semibold">Editar datos</h2>
        <p className="mt-1 font-body text-sm text-text-secondary">Modifica la información del conductor.</p>
        <button onClick={() => setEditando(true)} className="mt-3 rounded-lg border border-ink/20 px-4 py-2 font-body text-sm font-medium hover:bg-ink/5">Editar</button>
      </div>
    );
  }

  async function guardar() {
    setProcesando(true);
    setError(null);
    try {
      const cliente = crearClienteNavegador();
      const actualizado = await actualizarConductorAdmin(cliente, conductor.id, datos);
      onActualizado(actualizado);
      setEditando(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo actualizar.");
    } finally {
      setProcesando(false);
    }
  }

  return (
    <div>
      <h2 className="font-display text-lg font-semibold">Editar datos</h2>
      {error && <div className="mt-2"><Aviso tono="danger">{error}</Aviso></div>}
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <Campo label="Nombre" value={datos.nombre} onChange={(v) => setDatos({ ...datos, nombre: v })} />
        <Campo label="Teléfono" value={datos.telefono} onChange={(v) => setDatos({ ...datos, telefono: v })} />
        <Campo label="CURP" value={datos.curp} onChange={(v) => setDatos({ ...datos, curp: v })} />
        <Campo label="Licencia" value={datos.licencia_numero} onChange={(v) => setDatos({ ...datos, licencia_numero: v })} />
        <Campo label="Tipo licencia" value={datos.licencia_tipo} onChange={(v) => setDatos({ ...datos, licencia_tipo: v })} />
        <Campo label="Vigencia" value={datos.licencia_vigencia} onChange={(v) => setDatos({ ...datos, licencia_vigencia: v })} />
        <Campo label="Código postal" value={datos.codigo_postal} onChange={(v) => setDatos({ ...datos, codigo_postal: v })} />
        <Campo label="Estado" value={datos.estado_residencia} onChange={(v) => setDatos({ ...datos, estado_residencia: v })} />
        <Campo label="Ciudad/Municipio" value={datos.ciudad_municipio} onChange={(v) => setDatos({ ...datos, ciudad_municipio: v })} />
        <Campo label="Colonia" value={datos.colonia} onChange={(v) => setDatos({ ...datos, colonia: v })} />
        <Campo label="Calle" value={datos.calle} onChange={(v) => setDatos({ ...datos, calle: v })} />
        <Campo label="Número" value={datos.numero} onChange={(v) => setDatos({ ...datos, numero: v })} />
        <Campo label="Referencias" value={datos.referencias} onChange={(v) => setDatos({ ...datos, referencias: v })} />
        <Campo label="Contacto emergencia" value={datos.contacto_emergencia_nombre} onChange={(v) => setDatos({ ...datos, contacto_emergencia_nombre: v })} />
        <Campo label="Tel. emergencia" value={datos.contacto_emergencia_telefono} onChange={(v) => setDatos({ ...datos, contacto_emergencia_telefono: v })} />
      </div>
      <div className="mt-4 flex gap-2">
        <button onClick={guardar} disabled={procesando} className="rounded-lg bg-ink px-4 py-2 font-body text-sm font-semibold text-surface-primary hover:bg-ink/90 disabled:opacity-50">{procesando ? "Guardando…" : "Guardar cambios"}</button>
        <button onClick={() => setEditando(false)} disabled={procesando} className="rounded-lg border border-ink/20 px-4 py-2 font-body text-sm font-medium hover:bg-ink/5">Cancelar</button>
      </div>
    </div>
  );
}

function Campo({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="font-body text-xs font-medium text-text-secondary">{label}</span>
      <input type="text" value={value} onChange={(e) => onChange(e.target.value)} className="rounded-lg border border-ink/20 px-3 py-2 font-body text-sm focus:border-focus-default focus:outline-none focus:ring-2 focus:ring-focus-default/20" />
    </label>
  );
}

function SuspenderConductor({ conductorId, onCompletado }: { conductorId: string; onCompletado: () => void }) {
  const [abierto, setAbierto] = useState(false);
  const [motivo, setMotivo] = useState("");
  const [procesando, setProcesando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  if (!abierto) return <button onClick={() => setAbierto(true)} className="rounded-lg border border-status-error/40 bg-status-error/10 px-4 py-2 font-body text-sm font-medium text-status-error hover:bg-status-error/20">Suspender</button>;
  async function ejecutar() {
    if (!motivo.trim()) return;
    setProcesando(true); setError(null);
    try { const cliente = crearClienteNavegador(); await suspenderConductorAdmin(cliente, conductorId, motivo.trim()); setAbierto(false); onCompletado(); }
    catch (err) { setError(err instanceof Error ? err.message : "No se pudo suspender."); }
    finally { setProcesando(false); }
  }
  return (
    <div className="rounded-lg border border-status-error/30 bg-status-error-soft/20 p-4">
      <p className="font-body text-sm font-semibold text-status-error">Suspender conductor</p>
      <p className="mt-1 font-body text-xs text-text-secondary">No podrá recibir nuevos traslados.</p>
      {error && <div className="mt-2"><Aviso tono="danger">{error}</Aviso></div>}
      <textarea value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder="Motivo de la suspensión" className="mt-3 w-full rounded-lg border border-ink/20 px-3 py-2 font-body text-sm" rows={2} />
      <div className="mt-3 flex gap-2">
        <button onClick={ejecutar} disabled={procesando || !motivo.trim()} className="rounded-lg bg-status-error px-4 py-2 font-body text-sm font-semibold text-surface-primary disabled:opacity-50">{procesando ? "Suspendiendo…" : "Confirmar suspensión"}</button>
        <button onClick={() => setAbierto(false)} disabled={procesando} className="rounded-lg border border-ink/20 px-4 py-2 font-body text-sm font-medium hover:bg-ink/5">Cancelar</button>
      </div>
    </div>
  );
}

function ReactivarConductor({ conductorId, onCompletado }: { conductorId: string; onCompletado: () => void }) {
  const [abierto, setAbierto] = useState(false);
  const [motivo, setMotivo] = useState("");
  const [procesando, setProcesando] = useState(false);
  if (!abierto) return <button onClick={() => setAbierto(true)} className="rounded-lg border border-status-success/40 bg-status-success/10 px-4 py-2 font-body text-sm font-medium text-status-success hover:bg-status-success/20">Reactivar</button>;
  async function ejecutar() {
    if (!motivo.trim()) return; setProcesando(true);
    try { const cliente = crearClienteNavegador(); await reactivarConductorAdmin(cliente, conductorId, motivo.trim()); setAbierto(false); onCompletado(); }
    catch { /* error handled by parent */ }
    finally { setProcesando(false); }
  }
  return (
    <div className="rounded-lg border border-status-success/30 bg-status-success-soft/20 p-4">
      <p className="font-body text-sm font-semibold text-status-success">Reactivar conductor</p>
      <textarea value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder="Motivo de la reactivación" className="mt-3 w-full rounded-lg border border-ink/20 px-3 py-2 font-body text-sm" rows={2} />
      <div className="mt-3 flex gap-2">
        <button onClick={ejecutar} disabled={procesando || !motivo.trim()} className="rounded-lg bg-status-success px-4 py-2 font-body text-sm font-semibold text-surface-primary disabled:opacity-50">{procesando ? "Reactivando…" : "Confirmar reactivación"}</button>
        <button onClick={() => setAbierto(false)} disabled={procesando} className="rounded-lg border border-ink/20 px-4 py-2 font-body text-sm font-medium">Cancelar</button>
      </div>
    </div>
  );
}

function DarBajaConductor({ conductorId, onCompletado }: { conductorId: string; onCompletado: () => void }) {
  const [abierto, setAbierto] = useState(false);
  const [motivo, setMotivo] = useState("");
  const [confirmacion, setConfirmacion] = useState("");
  const [procesando, setProcesando] = useState(false);
  if (!abierto) return <button onClick={() => setAbierto(true)} className="rounded-lg border border-ink/40 bg-ink/10 px-4 py-2 font-body text-sm font-medium text-ink hover:bg-ink/20">Baja definitiva</button>;
  async function ejecutar() {
    if (!motivo.trim() || confirmacion !== "BAJA") return; setProcesando(true);
    try { const cliente = crearClienteNavegador(); await darBajaConductorAdmin(cliente, conductorId, motivo.trim()); setAbierto(false); onCompletado(); }
    catch { /* error handled by parent */ }
    finally { setProcesando(false); }
  }
  return (
    <div className="rounded-lg border border-ink/30 bg-ink/5 p-4">
      <p className="font-body text-sm font-semibold">Baja definitiva</p>
      <p className="mt-1 font-body text-xs text-text-secondary">Acción irreversible.</p>
      <textarea value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder="Motivo de la baja" className="mt-3 w-full rounded-lg border border-ink/20 px-3 py-2 font-body text-sm" rows={2} />
      <label className="mt-3 flex flex-col gap-1">
        <span className="font-body text-xs font-medium text-text-secondary">Escribe BAJA para confirmar</span>
        <input type="text" value={confirmacion} onChange={(e) => setConfirmacion(e.target.value)} className="rounded-lg border border-ink/20 px-3 py-2 font-body text-sm" />
      </label>
      <div className="mt-3 flex gap-2">
        <button onClick={ejecutar} disabled={procesando || !motivo.trim() || confirmacion !== "BAJA"} className="rounded-lg bg-ink px-4 py-2 font-body text-sm font-semibold text-surface-primary disabled:opacity-50">{procesando ? "Dando de baja…" : "Dar de baja definitivamente"}</button>
        <button onClick={() => setAbierto(false)} disabled={procesando} className="rounded-lg border border-ink/20 px-4 py-2 font-body text-sm font-medium">Cancelar</button>
      </div>
    </div>
  );
}