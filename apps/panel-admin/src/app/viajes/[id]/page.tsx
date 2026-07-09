"use client";

"use client";
import { useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { Button, Field, Aviso, EstadoBadge, EstadoStepper, PassportCard } from "@ruum/ui";
import { ETIQUETA_TIPO_VEHICULO, ETIQUETA_NIVEL_CONCER } from "@ruum/shared/constants";
import { ETIQUETA_ESTADO_TRASLADO, TRANSICIONES } from "@ruum/shared/states";
import type { Database } from "@ruum/shared/types";
import { crearClienteNavegador, puedeUsarDatosDemo, tieneSupabaseConfigurado } from "../../../lib/supabase-browser";
import {
  obtenerPasaporteDigital,
  listarConductoresAdmin,
  obtenerNotasInternas,
  agregarNotaInterna,
  asignarConductorAdmin,
  cambiarEstatusAdmin,
  ajustarPrecioFinalAdmin,
  obtenerAdminActual,
  obtenerAuditoriaTraslado,
  marcarTrasladoFallido
} from "@ruum/api/services";
import { VIAJES_DEMO, CONDUCTORES_DEMO, ADMIN_DEMO } from "../../../lib/datos-demo";

type PasaporteRow = Database["public"]["Views"]["pasaporte_digital"]["Row"];
type ConductorRow = Database["public"]["Tables"]["conductores"]["Row"];
type NotaRow = Database["public"]["Tables"]["notas_internas_traslado"]["Row"];
type AuditoriaRow = Database["public"]["Tables"]["registro_auditoria"]["Row"];
type EstadoTraslado = Database["public"]["Enums"]["estado_traslado"];
type CausaFallido = Database["public"]["Enums"]["causa_fallido"];

const CAUSAS_FALLIDO: { valor: CausaFallido; etiqueta: string }[] = [
  { valor: "imputable_cliente", etiqueta: "Imputable al cliente" },
  { valor: "operativo", etiqueta: "Operativo" },
  { valor: "fuerza_mayor", etiqueta: "Fuerza mayor" },
  { valor: "documentacion", etiqueta: "Documentación" },
  { valor: "vehiculo_no_circulable", etiqueta: "Vehículo no circulable" }
];

export default function PaginaDetalleViajeAdmin() {
  const { id } = useParams<{ id: string }>();

  const [pasaporte, setPasaporte] = useState<PasaporteRow | null>(null);
  const [conductores, setConductores] = useState<ConductorRow[]>([]);
  const [notas, setNotas] = useState<NotaRow[]>([]);
  const [auditoria, setAuditoria] = useState<AuditoriaRow[]>([]);
  const [esDemo, setEsDemo] = useState(true);
  const [cargando, setCargando] = useState(true);

  const [conductorSeleccionado, setConductorSeleccionado] = useState("");
  const [estadoSeleccionado, setEstadoSeleccionado] = useState<EstadoTraslado | "">("");
  const [precioFinalInput, setPrecioFinalInput] = useState("");
  const [causaFallido, setCausaFallido] = useState<CausaFallido>("operativo");
  const [notaNueva, setNotaNueva] = useState("");
  const [procesando, setProcesando] = useState<"conductor" | "estado" | "precio" | "nota" | "fallido" | null>(null);
  const [aviso, setAviso] = useState<{ tono: "info" | "peligro"; texto: string } | null>(null);
  const [adminId, setAdminId] = useState(ADMIN_DEMO.id);
  /* Ítem 17 — foco al aviso tras cada acción para operadores de teclado */
  const avisoRef = useRef<HTMLDivElement>(null);

  function mostrarAviso(aviso: { tono: "info" | "peligro"; texto: string }) {
    setAviso(aviso);
    setTimeout(() => avisoRef.current?.focus(), 50);
  }

  useEffect(() => {
    async function cargar() {
      const demo = VIAJES_DEMO.find((v) => v.traslado_id === id);
      if (!tieneSupabaseConfigurado() || demo) {
        setPasaporte(demo ?? null);
        setConductores(CONDUCTORES_DEMO);
        setNotas([]);
        setAuditoria([]);
        setPrecioFinalInput(demo?.precio_final != null ? String(demo.precio_final) : "");
        setEsDemo(true);
        setCargando(false);
        return;
      }

      try {
        const cliente = crearClienteNavegador();
        const [p, conds, notasReales, auditoriaReal, adminReal] = await Promise.all([
          obtenerPasaporteDigital(cliente, id),
          listarConductoresAdmin(cliente),
          obtenerNotasInternas(cliente, id),
          obtenerAuditoriaTraslado(cliente, id),
          obtenerAdminActual(cliente)
        ]);
        setPasaporte(p);
        setConductores(conds.filter((c) => c.estado === "activo" || c.estado === "modo_prueba_supervisada"));
        setNotas(notasReales);
        setAuditoria(auditoriaReal);
        setPrecioFinalInput(p?.precio_final != null ? String(p.precio_final) : "");
        if (adminReal) setAdminId(adminReal.id);
        setEsDemo(false);
      } catch {
        if (puedeUsarDatosDemo() || demo) {
          setPasaporte(demo ?? null);
          setConductores(CONDUCTORES_DEMO);
          setAuditoria([]);
          setPrecioFinalInput("");
          setEsDemo(true);
        } else {
          setPasaporte(null);
          setConductores([]);
          setAuditoria([]);
          setPrecioFinalInput("");
          setEsDemo(false);
        }
      } finally {
        setCargando(false);
      }
    }
    cargar();
  }, [id]);

  async function asignar() {
    if (!pasaporte || !conductorSeleccionado) return;
    setProcesando("conductor");
    setAviso(null);

    if (esDemo) {
      await new Promise((r) => setTimeout(r, 400));
      mostrarAviso({ tono: "info", texto: "Conductor asignado en modo demo." });
      setProcesando(null);
      return;
    }

    try {
      const cliente = crearClienteNavegador();
      await asignarConductorAdmin(cliente, pasaporte.traslado_id, conductorSeleccionado, pasaporte.estado);
      mostrarAviso({ tono: "info", texto: "Conductor asignado." });
      setPasaporte(await obtenerPasaporteDigital(cliente, pasaporte.traslado_id));
      setAuditoria(await obtenerAuditoriaTraslado(cliente, pasaporte.traslado_id));
    } catch (err) {
      mostrarAviso({ tono: "peligro", texto: err instanceof Error ? err.message : "No pudimos asignar el conductor." });
    } finally {
      setProcesando(null);
    }
  }

  async function cambiarEstatus() {
    if (!pasaporte || !estadoSeleccionado) return;
    setProcesando("estado");
    setAviso(null);

    if (esDemo) {
      await new Promise((r) => setTimeout(r, 400));
      mostrarAviso({ tono: "info", texto: "Estatus cambiado en modo demo." });
      setProcesando(null);
      return;
    }

    try {
      const cliente = crearClienteNavegador();
      await cambiarEstatusAdmin(cliente, pasaporte.traslado_id, pasaporte.estado, estadoSeleccionado);
      mostrarAviso({ tono: "info", texto: "Estatus actualizado." });
      setPasaporte(await obtenerPasaporteDigital(cliente, pasaporte.traslado_id));
      setAuditoria(await obtenerAuditoriaTraslado(cliente, pasaporte.traslado_id));
      setEstadoSeleccionado("");
    } catch (err) {
      mostrarAviso({ tono: "peligro", texto: err instanceof Error ? err.message : "No pudimos cambiar el estatus." });
    } finally {
      setProcesando(null);
    }
  }

  async function guardarPrecioFinal() {
    if (!pasaporte) return;

    const valor = Number(precioFinalInput);
    if (!precioFinalInput.trim() || Number.isNaN(valor) || valor < 0) {
      mostrarAviso({ tono: "peligro", texto: "Ingresa un monto válido para la tarifa final." });
      return;
    }

    setProcesando("precio");
    setAviso(null);

    if (esDemo) {
      await new Promise((r) => setTimeout(r, 400));
      setPasaporte((prev) => (prev ? { ...prev, precio_final: valor } : prev));
      mostrarAviso({ tono: "info", texto: "Tarifa final actualizada en modo demo." });
      setProcesando(null);
      return;
    }

    try {
      const cliente = crearClienteNavegador();
      await ajustarPrecioFinalAdmin(cliente, pasaporte.traslado_id, valor);
      mostrarAviso({ tono: "info", texto: "Tarifa final actualizada." });
      setPasaporte(await obtenerPasaporteDigital(cliente, pasaporte.traslado_id));
      setAuditoria(await obtenerAuditoriaTraslado(cliente, pasaporte.traslado_id));
    } catch (err) {
      mostrarAviso({ tono: "peligro", texto: err instanceof Error ? err.message : "No pudimos actualizar la tarifa final." });
    } finally {
      setProcesando(null);
    }
  }

  async function marcarFallido() {
    if (!pasaporte) return;
    setProcesando("fallido");
    setAviso(null);

    if (esDemo) {
      await new Promise((r) => setTimeout(r, 400));
      setPasaporte((prev) => (prev ? { ...prev, estado: "traslado_fallido", causa_fallido: causaFallido } : prev));
      mostrarAviso({ tono: "info", texto: "Traslado marcado como fallido en modo demo." });
      setProcesando(null);
      return;
    }

    try {
      const cliente = crearClienteNavegador();
      const resultado = await marcarTrasladoFallido(cliente, pasaporte.traslado_id, causaFallido);
      mostrarAviso({ tono: "info", texto: resultado.mensaje });
      setPasaporte(await obtenerPasaporteDigital(cliente, pasaporte.traslado_id));
      setAuditoria(await obtenerAuditoriaTraslado(cliente, pasaporte.traslado_id));
    } catch (err) {
      mostrarAviso({ tono: "peligro", texto: err instanceof Error ? err.message : "No pudimos marcar el traslado como fallido." });
    } finally {
      setProcesando(null);
    }
  }

  async function agregarNota() {
    if (!pasaporte || !notaNueva.trim()) return;
    setProcesando("nota");
    setAviso(null);

    if (esDemo) {
      await new Promise((r) => setTimeout(r, 300));
      setNotas((prev) => [
        { id: `demo-${Date.now()}`, traslado_id: pasaporte.traslado_id, admin_id: "demo", contenido: notaNueva, creada_en: new Date().toISOString() },
        ...prev
      ]);
      setNotaNueva("");
      setProcesando(null);
      return;
    }

    try {
      const cliente = crearClienteNavegador();
      await agregarNotaInterna(cliente, pasaporte.traslado_id, adminId, notaNueva);
      setNotas(await obtenerNotasInternas(cliente, pasaporte.traslado_id));
      setNotaNueva("");
    } catch (err) {
      mostrarAviso({ tono: "peligro", texto: err instanceof Error ? err.message : "No pudimos guardar la nota." });
    } finally {
      setProcesando(null);
    }
  }

  if (cargando) {
    return (
      <main className="mx-auto max-w-4xl px-6 py-8 sm:px-8 sm:py-10">
        <p className="font-body text-sm text-ink/50">Cargando…</p>
      </main>
    );
  }

  if (!pasaporte) {
    return (
      <main className="mx-auto max-w-4xl px-8 py-10 text-center">
        <h1 className="font-display text-xl font-semibold">No encontramos ese viaje</h1>
        <Link href="/viajes" className="mt-3 inline-block font-body text-sm text-route-dark hover:underline">
          ← Volver a viajes
        </Link>
      </main>
    );
  }

  const siguientesEstados = TRANSICIONES[pasaporte.estado] ?? [];

  return (
    <main className="mx-auto max-w-4xl px-6 py-8 sm:px-8 sm:py-10">
      <Link href="/viajes" className="font-body text-sm text-ink/55 hover:text-ink">
        ← Viajes
      </Link>

      {esDemo && (
        <div className="mt-4">
          <Aviso tono="info">Estás viendo datos de ejemplo, no un viaje real.</Aviso>
        </div>
      )}
      {aviso && (
        <div
          ref={avisoRef}
          tabIndex={-1}
          className="mt-4 outline-none"
          role="status"
          aria-live="polite"
          aria-atomic="true"
        >
          <Aviso tono={aviso.tono}>{aviso.texto}</Aviso>
        </div>
      )}

      <div className="mt-4 flex items-start justify-between gap-4">
        <div>
          <p className="font-body text-xs uppercase tracking-wide text-ink/45">Folio {pasaporte.traslado_id.slice(0, 8).toUpperCase()}</p>
          <h1 className="mt-1 font-display text-2xl font-semibold">
            {pasaporte.vehiculo_marca} {pasaporte.vehiculo_modelo} {pasaporte.vehiculo_anio}
          </h1>
        </div>
        <EstadoBadge estado={pasaporte.estado} />
      </div>

      <div className="mt-6">
        <EstadoStepper estado={pasaporte.estado} />
      </div>

      <div className="mt-8 grid grid-cols-1 gap-6 xl:grid-cols-2">
        {/* Bloque 1 — Resumen + Bloque 2 — Vehículo */}
        <PassportCard>
          <p className="font-body text-xs uppercase tracking-wide text-ink/45">Resumen</p>
          <dl className="mt-3 space-y-2 font-body text-sm">
            <div className="flex justify-between">
              <dt className="text-ink/45">Tipo de servicio</dt>
              <dd className="capitalize">{pasaporte.tipo_pago?.replaceAll("_", " ") ?? "—"}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-ink/45">Creado</dt>
              <dd>{new Date(pasaporte.creado_en).toLocaleString("es-MX")}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-ink/45">Conductor</dt>
              <dd>{pasaporte.conductor_nombre ?? "Sin asignar"}</dd>
            </div>
          </dl>
        </PassportCard>

        <PassportCard>
          <p className="font-body text-xs uppercase tracking-wide text-ink/45">Vehículo</p>
          <dl className="mt-3 space-y-2 font-body text-sm">
            <div className="flex justify-between">
              <dt className="text-ink/45">Marca / modelo</dt>
              <dd>
                {pasaporte.vehiculo_marca} {pasaporte.vehiculo_modelo}
              </dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-ink/45">Año</dt>
              <dd>{pasaporte.vehiculo_anio}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-ink/45">Tipo</dt>
              <dd>{pasaporte.vehiculo_tipo ? ETIQUETA_TIPO_VEHICULO[pasaporte.vehiculo_tipo] : "—"}</dd>
            </div>
          </dl>
        </PassportCard>

        {/* Bloque 4 — Evidencia */}
        <PassportCard>
          <p className="font-body text-xs uppercase tracking-wide text-ink/45">Evidencia</p>
          <dl className="mt-3 space-y-2 font-body text-sm">
            <div className="flex justify-between">
              <dt className="text-ink/45">Inicial</dt>
              <dd className="font-mono-ruum">{pasaporte.evidencia_inicial_fotos_sincronizadas} / 5 fotos</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-ink/45">Final</dt>
              <dd className="font-mono-ruum">{pasaporte.evidencia_final_fotos_sincronizadas} / 5 fotos</dd>
            </div>
          </dl>
          {pasaporte.tiene_incidencia_abierta && (
            <div className="mt-3">
              <Aviso tono="atencion">Incidencia abierta en este traslado.</Aviso>
            </div>
          )}
        </PassportCard>

        {/* Bloque 5 — Pagos */}
        <PassportCard>
          <p className="font-body text-xs uppercase tracking-wide text-ink/45">Pagos</p>
          <dl className="mt-3 space-y-2 font-body text-sm">
            <div className="flex justify-between">
              <dt className="text-ink/45">Tarifa cotizada</dt>
              <dd className="font-mono-ruum">${pasaporte.precio_cotizado?.toLocaleString("es-MX") ?? "—"}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-ink/45">Tarifa final</dt>
              <dd className="font-mono-ruum">${pasaporte.precio_final?.toLocaleString("es-MX") ?? "—"}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-ink/45">Monto pagado</dt>
              <dd className="font-mono-ruum">${pasaporte.monto_pagado?.toLocaleString("es-MX") ?? "0"}</dd>
            </div>
          </dl>
          <p className="mt-3 font-body text-xs text-ink/40">
           Pago al conductor, gastos y margen estimado: pendiente (ver &quot;Pagos&quot; en la barra lateral, próximamente).
         </p>
        </PassportCard>
      </div>

      {/* Acciones administrativas */}
      <div className="mt-8 grid grid-cols-1 gap-6 xl:grid-cols-2">
        <PassportCard>
          <p className="font-body text-xs uppercase tracking-wide text-ink/45">Asignar / cambiar conductor</p>
          <div className="mt-3 flex gap-2">
            <select
              value={conductorSeleccionado}
              onChange={(e) => setConductorSeleccionado(e.target.value)}
              className="flex-1 rounded-lg border border-ink/50 bg-mist px-3 py-2 font-body text-sm"
            >
              <option value="">Selecciona un conductor</option>
              {conductores.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nombre} · {ETIQUETA_NIVEL_CONCER[c.nivel_operativo_vigente]}
                </option>
              ))}
            </select>
            <Button onClick={asignar} disabled={!conductorSeleccionado || procesando === "conductor"}>
              {procesando === "conductor" ? "…" : "Asignar"}
            </Button>
          </div>
        </PassportCard>

        <PassportCard>
          <p className="font-body text-xs uppercase tracking-wide text-ink/45">Cambiar estatus</p>
          <div className="mt-3 flex gap-2">
            <select
              value={estadoSeleccionado}
              onChange={(e) => setEstadoSeleccionado(e.target.value as EstadoTraslado)}
              className="flex-1 rounded-lg border border-ink/50 bg-mist px-3 py-2 font-body text-sm"
              disabled={siguientesEstados.length === 0}
            >
              <option value="">{siguientesEstados.length === 0 ? "Sin transiciones disponibles" : "Selecciona el nuevo estatus"}</option>
              {siguientesEstados.map((e) => (
                <option key={e} value={e}>
                  {ETIQUETA_ESTADO_TRASLADO[e]}
                </option>
              ))}
            </select>
            <Button onClick={cambiarEstatus} disabled={!estadoSeleccionado || procesando === "estado"}>
              {procesando === "estado" ? "…" : "Cambiar"}
            </Button>
          </div>
        </PassportCard>
      </div>

      {/* Ajuste de tarifa final — PRD §4.6 "el precio puede ser dinámico" */}
      <div className="mt-6">
        <PassportCard>
          <p className="font-body text-xs uppercase tracking-wide text-ink/45">Tarifa final</p>
          <p className="mt-1 font-body text-xs text-ink/50">
            Si el monto a cobrar cambió respecto a la cotización (incidencia, ruta, etc.), ajústalo aquí. El cobro
            al cierre usa esta tarifa en cuanto exista; si se deja vacía, sigue usando la cotización original.
          </p>
          <div className="mt-3 flex items-end gap-2">
            <div className="w-48">
              <Field
                etiqueta="Monto (MXN)"
                type="number"
                min={0}
                step="0.01"
                placeholder={pasaporte.precio_cotizado != null ? String(pasaporte.precio_cotizado) : "0"}
                value={precioFinalInput}
                onChange={(e) => setPrecioFinalInput(e.target.value)}
              />
            </div>
            <Button onClick={guardarPrecioFinal} disabled={procesando === "precio"}>
              {procesando === "precio" ? "…" : "Guardar"}
            </Button>
          </div>
        </PassportCard>
      </div>

      <div className="mt-6">
        <PassportCard>
          <p className="font-body text-xs uppercase tracking-wide text-ink/45">Traslado fallido</p>
          <p className="mt-1 font-body text-xs text-ink/50">
            Usa esta acción cuando el viaje no puede continuar. Se calcula cargo, reagendamiento y descuento con la regla PRD §4.11.
          </p>
          <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-end">
            <select
              value={causaFallido}
              onChange={(e) => setCausaFallido(e.target.value as CausaFallido)}
              className="rounded-lg border border-ink/50 bg-mist px-3 py-2 font-body text-sm"
            >
              {CAUSAS_FALLIDO.map((causa) => (
                <option key={causa.valor} value={causa.valor}>
                  {causa.etiqueta}
                </option>
              ))}
            </select>
            <Button onClick={marcarFallido} disabled={procesando === "fallido" || pasaporte.estado === "traslado_fallido"}>
              {procesando === "fallido" ? "…" : "Marcar fallido"}
            </Button>
          </div>
        </PassportCard>
      </div>

      {/* Bloque 7 — Notas internas */}
      <div className="mt-6">
        <PassportCard>
          <p className="font-body text-xs uppercase tracking-wide text-ink/45">Notas internas</p>
          <div className="mt-3 flex items-end gap-2">
            <div className="flex-1">
              <Field
                etiqueta="Nueva nota"
                placeholder="Visible solo para el equipo de operación"
                value={notaNueva}
                onChange={(e) => setNotaNueva(e.target.value)}
              />
            </div>
            <Button onClick={agregarNota} disabled={!notaNueva.trim() || procesando === "nota"}>
              {procesando === "nota" ? "…" : "Agregar"}
            </Button>
          </div>
          <div className="mt-4 space-y-3 border-t border-ink/10 pt-4">
            {notas.length === 0 ? (
              <p className="font-body text-sm text-ink/45">Sin notas todavía.</p>
            ) : (
              notas.map((n) => (
                <div key={n.id} className="font-body text-sm">
                  <p>{n.contenido}</p>
                  <p className="mt-0.5 font-mono-ruum text-[10px] uppercase tracking-wide text-ink/40">
                    {new Date(n.creada_en).toLocaleString("es-MX")}
                  </p>
                </div>
              ))
            )}
          </div>
        </PassportCard>
      </div>

      {/* Bloque 6 — Línea de tiempo */}
      <div className="mt-6">
        <PassportCard>
          <p className="font-body text-xs uppercase tracking-wide text-ink/45">Línea de tiempo</p>
          <h2 className="mt-1 font-display text-lg font-semibold">Registro de auditoría</h2>
          <div className="mt-4 space-y-3">
            {auditoria.length === 0 ? (
              <p className="font-body text-sm text-ink/45">
                Sin eventos registrados todavía. Las acciones críticas nuevas escribirán aquí.
              </p>
            ) : (
              auditoria.map((evento) => (
                <div key={evento.id} className="rounded-lg border border-ink/10 px-4 py-3">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <p className="font-body text-sm font-semibold">{evento.evento.replaceAll("_", " ")}</p>
                      <p className="mt-1 font-body text-xs text-ink/50">
                        Actor: {evento.actor} · {evento.actor_id}
                      </p>
                    </div>
                    <p className="font-mono-ruum text-[10px] uppercase tracking-wide text-ink/40">
                      {new Date(evento.timestamp).toLocaleString("es-MX")}
                    </p>
                  </div>
                  <pre className="mt-3 max-h-32 overflow-auto rounded-lg bg-ink/[0.04] p-3 font-mono-ruum text-[11px] text-ink/60">
                    {JSON.stringify(evento.datos, null, 2)}
                  </pre>
                </div>
              ))
            )}
          </div>
        </PassportCard>
      </div>
    </main>
  );
}
