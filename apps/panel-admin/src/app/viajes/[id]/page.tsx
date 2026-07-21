"use client";
import { useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { Button, Field, Aviso, EstadoBadge, EstadoStepper, PassportCard } from "@ruum/ui";
import { AdminPageHeader } from "../../admin-ui";
import { AdminLoadingState, AdminEmptyState, AdminErrorState } from "../../admin-components";
import { ETIQUETA_TIPO_VEHICULO, ETIQUETA_NIVEL_CONCER } from "@ruum/shared/constants";
import { resumenClasificacionVehiculo } from "@ruum/shared/catalogos";
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
  obtenerAdminActual,
  obtenerAuditoriaTraslado,
  marcarTrasladoFallido,
  guardarDistanciaYTiempoTraslado,
  sugerirTarifaTraslado,
  clasificarVehiculoParaTarifa,
  aplicarTarifaNormativaAdmin,
  obtenerTrazabilidadMasivaTraslado,
  type TrazabilidadMasivaTraslado
} from "@ruum/api/services";
import { obtenerRutaMapbox, tieneMapboxConfigurado } from "../../../lib/mapbox-rutas";
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

function fechaAdministrativa(fechaIso: string | null | undefined) {
  return fechaIso ? new Date(fechaIso).toLocaleString("es-MX") : "Pendiente";
}

export default function PaginaDetalleViajeAdmin() {
  const { id } = useParams<{ id: string }>();

  const [pasaporte, setPasaporte] = useState<PasaporteRow | null>(null);
  const [conductores, setConductores] = useState<ConductorRow[]>([]);
  const [notas, setNotas] = useState<NotaRow[]>([]);
  const [auditoria, setAuditoria] = useState<AuditoriaRow[]>([]);
  const [trazabilidadMasiva, setTrazabilidadMasiva] = useState<TrazabilidadMasivaTraslado | null>(null);
  const [esDemo, setEsDemo] = useState(true);
  const [cargando, setCargando] = useState(true);

  const [conductorSeleccionado, setConductorSeleccionado] = useState("");
  const [estadoSeleccionado, setEstadoSeleccionado] = useState<EstadoTraslado | "">("");
  const [precioFinalInput, setPrecioFinalInput] = useState("");
  const [causaFallido, setCausaFallido] = useState<CausaFallido>("operativo");
  const [notaNueva, setNotaNueva] = useState("");
  const [procesando, setProcesando] = useState<"conductor" | "estado" | "precio" | "nota" | "fallido" | "sugerencia" | null>(null);
  const [aviso, setAviso] = useState<{ tono: "info" | "danger"; texto: string } | null>(null);
  const [adminId, setAdminId] = useState(ADMIN_DEMO.id);
  /* Ítem 17 — foco al aviso tras cada acción para operadores de teclado */
  const avisoRef = useRef<HTMLDivElement>(null);

  function mostrarAviso(aviso: { tono: "info" | "danger"; texto: string }) {
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
        setTrazabilidadMasiva(null);
        setPrecioFinalInput(demo?.precio_final != null ? String(demo.precio_final) : "");
        setEsDemo(true);
        setCargando(false);
        return;
      }

      try {
        const cliente = crearClienteNavegador();
        const [p, conds, notasReales, auditoriaReal, adminReal, trazabilidadReal] = await Promise.all([
          obtenerPasaporteDigital(cliente, id),
          listarConductoresAdmin(cliente),
          obtenerNotasInternas(cliente, id),
          obtenerAuditoriaTraslado(cliente, id),
          obtenerAdminActual(cliente),
          obtenerTrazabilidadMasivaTraslado(cliente, id)
        ]);
        setPasaporte(p);
        setConductores(conds.filter((c) => c.estado === "activo" || c.estado === "modo_prueba_supervisada"));
        setNotas(notasReales);
        setAuditoria(auditoriaReal);
        setTrazabilidadMasiva(trazabilidadReal);
        setPrecioFinalInput(p?.precio_final != null ? String(p.precio_final) : "");
        if (adminReal) setAdminId(adminReal.id);
        setEsDemo(false);
      } catch {
        if (puedeUsarDatosDemo() || demo) {
          setPasaporte(demo ?? null);
          setConductores(CONDUCTORES_DEMO);
          setAuditoria([]);
          setTrazabilidadMasiva(null);
          setPrecioFinalInput("");
          setEsDemo(true);
        } else {
          setPasaporte(null);
          setConductores([]);
          setAuditoria([]);
          setTrazabilidadMasiva(null);
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
    if (!pasaporte.traslado_id || !pasaporte.estado) {
      mostrarAviso({ tono: "danger", texto: "El traslado no tiene folio o estado operativo suficiente para asignar conductor." });
      return;
    }
    const trasladoId = pasaporte.traslado_id;
    const estadoActual = pasaporte.estado;
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
      await asignarConductorAdmin(cliente, trasladoId, conductorSeleccionado, estadoActual);
      mostrarAviso({ tono: "info", texto: "Conductor asignado." });
      setPasaporte(await obtenerPasaporteDigital(cliente, trasladoId));
      setAuditoria(await obtenerAuditoriaTraslado(cliente, trasladoId));
    } catch (err) {
      mostrarAviso({ tono: "danger", texto: err instanceof Error ? err.message : "No pudimos asignar el conductor." });
    } finally {
      setProcesando(null);
    }
  }

  async function cambiarEstatus() {
    if (!pasaporte || !estadoSeleccionado) return;
    if (!pasaporte.traslado_id || !pasaporte.estado) {
      mostrarAviso({ tono: "danger", texto: "El traslado no tiene folio o estado operativo suficiente para cambiar estatus." });
      return;
    }
    const trasladoId = pasaporte.traslado_id;
    const estadoActual = pasaporte.estado;
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
      await cambiarEstatusAdmin(cliente, trasladoId, estadoActual, estadoSeleccionado);
      mostrarAviso({ tono: "info", texto: "Estatus actualizado." });
      setPasaporte(await obtenerPasaporteDigital(cliente, trasladoId));
      setAuditoria(await obtenerAuditoriaTraslado(cliente, trasladoId));
      setEstadoSeleccionado("");
    } catch (err) {
      mostrarAviso({ tono: "danger", texto: err instanceof Error ? err.message : "No pudimos cambiar el estatus." });
    } finally {
      setProcesando(null);
    }
  }

  const [categoriaTarifaInput, setCategoriaTarifaInput] = useState<Database["public"]["Enums"]["categoria_tarifa_vehiculo"] | "">("");
  const [gamaInput, setGamaInput] = useState<Database["public"]["Enums"]["gama_vehiculo"] | "">("");
  const [condicionInput, setCondicionInput] = useState<Database["public"]["Enums"]["condicion_vehiculo"] | "">("");

  async function guardarClasificacionVehiculo() {
    if (!pasaporte || !pasaporte.vehiculo_id || !pasaporte.traslado_id) return;
    const trasladoId = pasaporte.traslado_id;
    if (!categoriaTarifaInput || !gamaInput || !condicionInput) {
      mostrarAviso({ tono: "danger", texto: "Selecciona categoría, gama y condición." });
      return;
    }
    if (esDemo) {
      mostrarAviso({ tono: "info", texto: "La clasificación de vehículo no está disponible en modo demo." });
      return;
    }
    setProcesando("sugerencia");
    setAviso(null);
    try {
      const cliente = crearClienteNavegador();
      await clasificarVehiculoParaTarifa(cliente, pasaporte.vehiculo_id, {
        categoria_tarifa: categoriaTarifaInput,
        gama: gamaInput,
        condicion: condicionInput
      });
      setPasaporte(await obtenerPasaporteDigital(cliente, trasladoId));
      mostrarAviso({ tono: "info", texto: "Clasificación del vehículo guardada." });
    } catch (err) {
      mostrarAviso({ tono: "danger", texto: err instanceof Error ? err.message : "No se pudo guardar la clasificación." });
    } finally {
      setProcesando(null);
    }
  }

  async function calcularTarifaNormativa() {
    if (!pasaporte) return;
    if (!pasaporte.traslado_id) {
      mostrarAviso({ tono: "danger", texto: "El traslado no tiene folio suficiente para calcular tarifa." });
      return null;
    }
    const trasladoId = pasaporte.traslado_id;
    if (esDemo) {
      mostrarAviso({ tono: "info", texto: "El cálculo normativo de tarifa no está disponible en modo demo." });
      return null;
    }
    const coordenadasCompletas =
      pasaporte.origen_lat != null && pasaporte.origen_lng != null &&
      pasaporte.destino_lat != null && pasaporte.destino_lng != null;
    if (!coordenadasCompletas) {
      mostrarAviso({ tono: "danger", texto: "El traslado no tiene coordenadas de origen/destino completas." });
      return null;
    }
    const requiereRuta = pasaporte.distancia_km == null || pasaporte.tiempo_estimado_horas == null;
    if (requiereRuta && !tieneMapboxConfigurado()) {
      mostrarAviso({ tono: "danger", texto: "NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN no está configurado en este entorno." });
      return null;
    }

    setProcesando("sugerencia");
    setAviso(null);
    try {
      const cliente = crearClienteNavegador();
      let distanciaKm = pasaporte.distancia_km;
      let tiempoHoras = pasaporte.tiempo_estimado_horas;

      if (requiereRuta) {
        const ruta = await obtenerRutaMapbox(
          [pasaporte.origen_lng!, pasaporte.origen_lat!],
          [pasaporte.destino_lng!, pasaporte.destino_lat!]
        );
        distanciaKm = ruta.distanciaKm;
        tiempoHoras = ruta.tiempoHoras;
        if (distanciaKm == null || tiempoHoras == null) {
          mostrarAviso({ tono: "danger", texto: "Mapbox Directions no devolvió una ruta calculable para este origen/destino." });
          return null;
        }

        await guardarDistanciaYTiempoTraslado(cliente, trasladoId, {
          distancia_km: distanciaKm,
          tiempo_estimado_horas: tiempoHoras
        });
      }

      const tarifa = await sugerirTarifaTraslado(cliente, trasladoId);
      setPrecioFinalInput(String(tarifa));
      setPasaporte(await obtenerPasaporteDigital(cliente, trasladoId));
      mostrarAviso({
        tono: "info",
        texto: `Tarifa normativa calculada: $${tarifa.toLocaleString("es-MX")} · Ruta: ${distanciaKm} km, ${tiempoHoras} h.`
      });
      return tarifa;
    } catch (err) {
      mostrarAviso({
        tono: "danger",
        texto: err instanceof Error ? err.message : "No se pudo calcular la tarifa normativa."
      });
      return null;
    } finally {
      setProcesando(null);
    }
  }

  async function aplicarTarifaNormativa() {
    if (!pasaporte) return;
    if (!pasaporte.traslado_id) {
      mostrarAviso({ tono: "danger", texto: "El traslado no tiene folio suficiente para emitir cotización." });
      return;
    }
    const trasladoId = pasaporte.traslado_id;

    setAviso(null);

    if (esDemo) {
      setProcesando("precio");
      await new Promise((r) => setTimeout(r, 400));
      setPasaporte((prev) => (prev ? { ...prev, precio_cotizado: 1800, estado: "cotizacion_generada" } : prev));
      setPrecioFinalInput("1800");
      mostrarAviso({ tono: "info", texto: "Tarifa normativa aplicada en modo demo." });
      setProcesando(null);
      return;
    }

    try {
      const tarifa = await calcularTarifaNormativa();
      if (tarifa == null || Number.isNaN(tarifa) || tarifa <= 0) {
        mostrarAviso({ tono: "danger", texto: "No se pudo obtener una tarifa normativa válida para aplicar." });
        return;
      }
      setProcesando("precio");
      const cliente = crearClienteNavegador();
      const aplicada = await aplicarTarifaNormativaAdmin(cliente, trasladoId);
      setPrecioFinalInput(String(aplicada));
      mostrarAviso({ tono: "info", texto: "Tarifa normativa aplicada y cotización emitida para aceptación del usuario." });
      setPasaporte(await obtenerPasaporteDigital(cliente, trasladoId));
      setAuditoria(await obtenerAuditoriaTraslado(cliente, trasladoId));
    } catch (err) {
      mostrarAviso({ tono: "danger", texto: err instanceof Error ? err.message : "No pudimos aplicar la tarifa normativa." });
    } finally {
      setProcesando(null);
    }
  }

  async function marcarFallido() {
    if (!pasaporte) return;
    if (!pasaporte.traslado_id) {
      mostrarAviso({ tono: "danger", texto: "El traslado no tiene folio suficiente para marcarlo como fallido." });
      return;
    }
    const trasladoId = pasaporte.traslado_id;
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
      const resultado = await marcarTrasladoFallido(cliente, trasladoId, causaFallido);
      mostrarAviso({ tono: "info", texto: resultado.mensaje });
      setPasaporte(await obtenerPasaporteDigital(cliente, trasladoId));
      setAuditoria(await obtenerAuditoriaTraslado(cliente, trasladoId));
    } catch (err) {
      mostrarAviso({ tono: "danger", texto: err instanceof Error ? err.message : "No pudimos marcar el traslado como fallido." });
    } finally {
      setProcesando(null);
    }
  }

  async function agregarNota() {
    if (!pasaporte || !notaNueva.trim()) return;
    if (!pasaporte.traslado_id) {
      mostrarAviso({ tono: "danger", texto: "El traslado no tiene folio suficiente para agregar notas." });
      return;
    }
    const trasladoId = pasaporte.traslado_id;
    setProcesando("nota");
    setAviso(null);

    if (esDemo) {
      await new Promise((r) => setTimeout(r, 300));
      setNotas((prev) => [
        { id: `demo-${Date.now()}`, traslado_id: trasladoId, admin_id: "demo", contenido: notaNueva, creada_en: new Date().toISOString() },
        ...prev
      ]);
      setNotaNueva("");
      setProcesando(null);
      return;
    }

    try {
      const cliente = crearClienteNavegador();
      await agregarNotaInterna(cliente, trasladoId, adminId, notaNueva);
      setNotas(await obtenerNotasInternas(cliente, trasladoId));
      setNotaNueva("");
    } catch (err) {
      mostrarAviso({ tono: "danger", texto: err instanceof Error ? err.message : "No pudimos guardar la nota." });
    } finally {
      setProcesando(null);
    }
  }

  if (cargando) {
    return (
      <main className="admin-page-shell">
        <AdminLoadingState label="Cargando detalle del traslado" />
      </main>
    );
  }

  if (!pasaporte) {
    return (
      <main className="admin-page-shell">
        <AdminEmptyState
          title="No encontramos ese traslado"
          description="El traslado que buscas no existe o no está disponible."
          action={<Link href="/viajes" className="admin-button-primary inline-flex min-h-10 items-center justify-center rounded-lg bg-signal px-4 py-2 font-body text-admin-boton font-semibold text-ink">← Volver a traslados</Link>}
        />
      </main>
    );
  }

  if (!pasaporte.traslado_id || !pasaporte.estado) {
    return (
      <main className="admin-page-shell">
        <AdminErrorState
          title="No pudimos cargar el estado del traslado"
          description="El registro no incluye folio o estado operativo suficiente para administrarlo."
          action={<Link href="/viajes" className="admin-button-primary inline-flex min-h-10 items-center justify-center rounded-lg bg-signal px-4 py-2 font-body text-admin-boton font-semibold text-ink">← Volver a traslados</Link>}
        />
      </main>
    );
  }

  const siguientesEstados = TRANSICIONES[pasaporte.estado] ?? [];
  const clasificacionCatalogo = resumenClasificacionVehiculo(
    pasaporte.vehiculo_marca ?? "",
    pasaporte.vehiculo_modelo ?? "",
  );

  return (
    <main className="admin-page-shell">
      <AdminPageHeader
        etiqueta="Operación"
        titulo={`${pasaporte.vehiculo_marca} ${pasaporte.vehiculo_modelo} ${pasaporte.vehiculo_anio ?? ""}`}
        descripcion={`Folio ${pasaporte.traslado_id.slice(0, 8).toUpperCase()}`}
        breadcrumb={[
          { label: "Traslados", href: "/viajes" },
          { label: pasaporte.traslado_id.slice(0, 8).toUpperCase() }
        ]}
        accion={<EstadoBadge estado={pasaporte.estado} />}
      />

      {esDemo && (
        <div className="mt-4">
          <Aviso tono="info">Estás viendo datos de ejemplo, no un traslado real.</Aviso>
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

      <div className="mt-6">
        <EstadoStepper estado={pasaporte.estado} />
      </div>

      {trazabilidadMasiva && (
        <div className="mt-6">
          <PassportCard>
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <p className="font-body text-xs uppercase tracking-wide text-text-tertiary">Origen corporativo</p>
                <h2 className="mt-1 font-display text-lg font-semibold text-ink">Carga masiva</h2>
                <p className="mt-1 font-body text-sm text-text-secondary">
                  Archivo {trazabilidadMasiva.carga.nombre_archivo} · fila {trazabilidadMasiva.fila.numero_fila}
                </p>
              </div>
              <span className="w-fit rounded-full border border-route-dark/25 bg-route-soft px-3 py-1.5 font-body text-xs font-semibold text-route-dark">
                Corporativo
              </span>
            </div>
            <dl className="mt-4 grid gap-3 font-body text-sm sm:grid-cols-2">
              <div>
                <dt className="text-text-tertiary">Referencia externa</dt>
                <dd className="mt-1 font-mono-ruum text-xs text-ink">{trazabilidadMasiva.fila.referencia_externa ?? "Sin referencia"}</dd>
              </div>
              <div>
                <dt className="text-text-tertiary">Lote</dt>
                <dd className="mt-1 font-mono-ruum text-xs text-ink">{trazabilidadMasiva.carga.id.slice(0, 8).toUpperCase()}</dd>
              </div>
              <div>
                <dt className="text-text-tertiary">Resultado del lote</dt>
                <dd className="mt-1 text-ink">
                  {trazabilidadMasiva.carga.filas_creadas} creadas · {trazabilidadMasiva.carga.filas_error} error
                </dd>
              </div>
              <div>
                <dt className="text-text-tertiary">Procesado</dt>
                <dd className="mt-1 text-ink">{fechaAdministrativa(trazabilidadMasiva.carga.creado_en)}</dd>
              </div>
            </dl>
          </PassportCard>
        </div>
      )}

      <div className="mt-8 grid grid-cols-1 gap-6 xl:grid-cols-2">
        {/* Bloque 1 — Resumen + Bloque 2 — Vehículo */}
        <PassportCard>
          <p className="font-body text-xs uppercase tracking-wide text-text-tertiary">Resumen</p>
          <dl className="mt-3 space-y-2 font-body text-sm">
            <div className="flex justify-between">
              <dt className="text-text-tertiary">Tipo de servicio</dt>
              <dd className="capitalize">{pasaporte.tipo_pago?.replaceAll("_", " ") ?? "—"}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-text-tertiary">Creado</dt>
              <dd>{fechaAdministrativa(pasaporte.creado_en)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-text-tertiary">Conductor</dt>
              <dd>{pasaporte.conductor_nombre ?? "Sin asignar"}</dd>
            </div>
          </dl>
        </PassportCard>

        <PassportCard>
          <p className="font-body text-xs uppercase tracking-wide text-text-tertiary">Vehículo</p>
          <dl className="mt-3 space-y-2 font-body text-sm">
            <div className="flex justify-between">
              <dt className="text-text-tertiary">Marca / modelo</dt>
              <dd>
                {pasaporte.vehiculo_marca} {pasaporte.vehiculo_modelo}
              </dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-text-tertiary">Año</dt>
              <dd>{pasaporte.vehiculo_anio}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-text-tertiary">Tipo</dt>
              <dd>{pasaporte.vehiculo_tipo ? ETIQUETA_TIPO_VEHICULO[pasaporte.vehiculo_tipo] : "—"}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-text-tertiary">Clasificación catálogo</dt>
              <dd className="text-right">{clasificacionCatalogo ?? "Sin coincidencia"}</dd>
            </div>
          </dl>
        </PassportCard>

        {/* Bloque 4 — Evidencia */}
        <PassportCard>
          <p className="font-body text-xs uppercase tracking-wide text-text-tertiary">Evidencia</p>
          <dl className="mt-3 space-y-2 font-body text-sm">
            <div className="flex justify-between">
              <dt className="text-text-tertiary">Inicial</dt>
              <dd className="font-mono-ruum">{pasaporte.evidencia_inicial_fotos_sincronizadas} / 5 fotos</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-text-tertiary">Final</dt>
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
          <p className="font-body text-xs uppercase tracking-wide text-text-tertiary">Pagos</p>
          <dl className="mt-3 space-y-2 font-body text-sm">
            <div className="flex justify-between">
              <dt className="text-text-tertiary">Tarifa cotizada</dt>
              <dd className="font-mono-ruum">${pasaporte.precio_cotizado?.toLocaleString("es-MX") ?? "—"}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-text-tertiary">Tarifa final</dt>
              <dd className="font-mono-ruum">${pasaporte.precio_final?.toLocaleString("es-MX") ?? "—"}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-text-tertiary">Monto pagado</dt>
              <dd className="font-mono-ruum">${pasaporte.monto_pagado?.toLocaleString("es-MX") ?? "0"}</dd>
            </div>
          </dl>
          <p className="mt-3 font-body text-xs text-text-tertiary">
           Pago al conductor, gastos y margen estimado: pendiente (ver &quot;Pagos&quot; en la barra lateral, próximamente).
         </p>
        </PassportCard>
      </div>

      {/* Acciones administrativas */}
      <div className="mt-8 grid grid-cols-1 gap-6 xl:grid-cols-2">
        <PassportCard>
          <p className="font-body text-xs uppercase tracking-wide text-text-tertiary">Asignar / cambiar conductor</p>
          <div className="mt-3 flex gap-2">
            <select
              value={conductorSeleccionado}
              onChange={(e) => setConductorSeleccionado(e.target.value)}
              className="flex-1 rounded-lg border border-ink/50 bg-surface-primary px-3 py-2 font-body text-sm"
            >
              <option value="">Selecciona un conductor</option>
              {conductores.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nombre} · {c.nivel_operativo_vigente ? ETIQUETA_NIVEL_CONCER[c.nivel_operativo_vigente] : "Nivel pendiente"}
                </option>
              ))}
            </select>
            <Button onClick={asignar} disabled={!conductorSeleccionado || procesando === "conductor"}>
              {procesando === "conductor" ? "…" : "Asignar"}
            </Button>
          </div>
        </PassportCard>

        <PassportCard>
          <p className="font-body text-xs uppercase tracking-wide text-text-tertiary">Cambiar estatus</p>
          <div className="mt-3 flex gap-2">
            <select
              value={estadoSeleccionado}
              onChange={(e) => setEstadoSeleccionado(e.target.value as EstadoTraslado)}
              className="flex-1 rounded-lg border border-ink/50 bg-surface-primary px-3 py-2 font-body text-sm"
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

      {/* Clasificación del vehículo para tarifa (RT-12) — la asigna Torre de
          Control, no el usuario, para que no pueda autoasignarse la
          categoría más barata. */}
      <div className="mt-6">
        <PassportCard>
          <p className="font-body text-xs uppercase tracking-wide text-text-tertiary">Clasificación de tarifa del vehículo</p>
          <p className="mt-1 font-body text-xs text-text-tertiary">
            Actual: {pasaporte.vehiculo_categoria_tarifa ?? "sin asignar"} · {pasaporte.vehiculo_gama ?? "sin asignar"} ·{" "}
            {pasaporte.vehiculo_condicion ?? "sin asignar"}
          </p>
          <div className="mt-3 flex flex-wrap items-end gap-2">
            <select
              value={categoriaTarifaInput}
              onChange={(e) => setCategoriaTarifaInput(e.target.value as typeof categoriaTarifaInput)}
              className="min-h-12 rounded-[10px] border border-ink/30 bg-surface-primary px-3 font-body text-sm text-ink"
            >
              <option value="">Categoría…</option>
              <option value="ligero_a">Ligero A</option>
              <option value="ligero_b">Ligero B</option>
              <option value="mediano">Mediano</option>
              <option value="camion">Camión</option>
            </select>
            <select
              value={gamaInput}
              onChange={(e) => setGamaInput(e.target.value as typeof gamaInput)}
              className="min-h-12 rounded-[10px] border border-ink/30 bg-surface-primary px-3 font-body text-sm text-ink"
            >
              <option value="">Gama…</option>
              <option value="entrada">Entrada</option>
              <option value="media">Media</option>
              <option value="alta">Alta</option>
              <option value="premium">Premium</option>
            </select>
            <select
              value={condicionInput}
              onChange={(e) => setCondicionInput(e.target.value as typeof condicionInput)}
              className="min-h-12 rounded-[10px] border border-ink/30 bg-surface-primary px-3 font-body text-sm text-ink"
            >
              <option value="">Condición…</option>
              <option value="nueva">Nueva</option>
              <option value="seminueva">Seminueva</option>
              <option value="rescate_mecanico">Rescate mecánico</option>
            </select>
            <Button variant="quiet" onClick={guardarClasificacionVehiculo} disabled={procesando === "sugerencia"}>
              Guardar clasificación
            </Button>
          </div>
        </PassportCard>
      </div>

      {/* Aplicación de política tarifaria autorizada */}
      <div className="mt-6">
        <PassportCard>
          <p className="font-body text-xs uppercase tracking-wide text-text-tertiary">Tarifa normativa</p>
          <p className="mt-1 font-body text-xs text-text-tertiary">
            El precio sale de la política vigente en Tarifas. Operación no captura montos libres; sólo aplica el cálculo autorizado y auditable.
          </p>
          <div className="mt-3">
            <Button variant="quiet" onClick={calcularTarifaNormativa} disabled={procesando === "sugerencia"}>
              {procesando === "sugerencia" ? "Calculando tarifa…" : "Calcular tarifa normativa"}
            </Button>
            {pasaporte.distancia_km != null && pasaporte.tiempo_estimado_horas != null && (
              <span className="ml-3 font-body text-xs text-text-tertiary">
                Última ruta calculada: {pasaporte.distancia_km} km, {pasaporte.tiempo_estimado_horas} h
              </span>
            )}
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-3 rounded-lg border border-ink/10 bg-ink/[0.03] px-4 py-3">
            <div>
              <p className="font-body text-xs text-text-tertiary">Tarifa calculada</p>
              <p className="font-mono-ruum text-lg font-semibold text-ink">
                {precioFinalInput ? `$${Number(precioFinalInput).toLocaleString("es-MX")}` : "Pendiente"}
              </p>
            </div>
            <Button onClick={aplicarTarifaNormativa} disabled={procesando === "precio"}>
              {procesando === "precio" ? "…" : "Aplicar tarifa normativa"}
            </Button>
          </div>
        </PassportCard>
      </div>

      <div className="mt-6">
        <PassportCard>
          <p className="font-body text-xs uppercase tracking-wide text-text-tertiary">Traslado fallido</p>
          <p className="mt-1 font-body text-xs text-text-tertiary">
            Usa esta acción cuando el traslado no puede continuar. Se calcula cargo, reagendamiento y descuento con la regla PRD §4.11.
          </p>
          <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-end">
            <select
              value={causaFallido}
              onChange={(e) => setCausaFallido(e.target.value as CausaFallido)}
              className="rounded-lg border border-ink/50 bg-surface-primary px-3 py-2 font-body text-sm"
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
          <p className="font-body text-xs uppercase tracking-wide text-text-tertiary">Notas internas</p>
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
              <p className="font-body text-sm text-text-tertiary">Sin notas todavía.</p>
            ) : (
              notas.map((n) => (
                <div key={n.id} className="font-body text-sm">
                  <p>{n.contenido}</p>
                  <p className="mt-0.5 font-mono-ruum text-admin-secundario uppercase tracking-wide text-text-tertiary">
                    {fechaAdministrativa(n.creada_en)}
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
          <p className="font-body text-xs uppercase tracking-wide text-text-tertiary">Línea de tiempo</p>
          <h2 className="mt-1 font-display text-lg font-semibold">Registro de auditoría</h2>
          <div className="mt-4 space-y-0">
            {auditoria.length === 0 ? (
              <p className="font-body text-sm text-text-tertiary">Sin eventos registrados todavía.</p>
            ) : (
              <div className="relative">
                <div className="absolute left-[11px] top-2 h-[calc(100%-16px)] w-0.5 bg-ink/10" aria-hidden="true" />
                {auditoria.map((evento, indice) => {
                  const eventoLabel = evento.evento.replaceAll("_", " ");
                  const eventoData = JSON.stringify(evento.datos, null, 2);
                  return (
                    <div key={evento.id} className="relative flex gap-4 pb-5 last:pb-0">
                      <div className={`relative mt-1.5 size-[23px] shrink-0 rounded-full border-2 ${indice === 0 ? "border-signal bg-signal" : "border-ink/20 bg-surface-primary"}`} aria-hidden="true">
                        {indice === 0 && <span className="absolute inset-0 flex items-center justify-center text-[10px] text-ink">●</span>}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between">
                          <p className="font-body text-sm font-semibold capitalize">{eventoLabel}</p>
                          <p className="whitespace-nowrap font-mono-ruum text-admin-secundario uppercase tracking-wide text-text-tertiary">
                            {fechaAdministrativa(evento.timestamp)}
                          </p>
                        </div>
                        <p className="mt-0.5 font-body text-xs text-text-tertiary">
                          Actor: {evento.actor} · {evento.actor_id}
                        </p>
                        {eventoData !== "{}" && (
                          <details className="mt-2">
                            <summary className="cursor-pointer font-body text-xs font-semibold text-status-info hover:underline">Ver datos</summary>
                            <pre className="mt-2 max-h-32 overflow-auto rounded-lg bg-ink/[0.04] p-3 font-mono-ruum text-admin-secundario text-text-secondary">
                              {eventoData}
                            </pre>
                          </details>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </PassportCard>
      </div>
    </main>
  );
}
