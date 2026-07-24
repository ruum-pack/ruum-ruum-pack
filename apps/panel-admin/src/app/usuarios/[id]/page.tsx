"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { Aviso } from "@ruum/ui";
import type { Database } from "@ruum/shared/types";
import { crearClienteNavegador, tieneSupabaseConfigurado } from "../../../lib/supabase-browser";
import { AdminBadge, AdminDialog, AdminDrawer } from "../../admin-components";
import {
  obtenerUsuarioAdmin, actualizarUsuarioAdmin,
  suspenderUsuarioAdmin, reactivarUsuarioAdmin, cerrarCuentaUsuarioAdmin,
  listarSesionesUsuario, revocarSesionUsuario,
  listarPagosDeUsuario, listarIncidenciasDeUsuario, listarEmpresasDeUsuario,
  obtenerAuditoriaUsuario
} from "@ruum/api/services";
import { listarTrasladosDeUsuario } from "@ruum/api/services";
import { AccionesVerificacion } from "../AccionesVerificacion";

type UsuarioRow = Database["public"]["Tables"]["usuarios"]["Row"];
type PagosRow = Database["public"]["Tables"]["pagos"]["Row"];
type IncidenciaRow = Database["public"]["Tables"]["incidencias"]["Row"];
type EmpresaRow = Database["public"]["Tables"]["empresas"]["Row"];
type ViajeRow = Database["public"]["Views"]["pasaporte_digital"]["Row"];
type FormatoExportacionPrivacidad = "json" | "csv" | "pdf";
type BitacoraPrivacidad = { tipo: "exportacion" | "anonimizacion"; fecha: string; detalle: string };

type Tab = "datos" | "viajes" | "pagos" | "incidencias" | "sesiones" | "privacidad" | "auditoria";

const ETIQUETA_VERIFICACION: Record<string, string> = {
  pendiente: "Pendiente", en_revision: "En revisión", verificado: "Verificado", rechazado: "Rechazado"
};
const ETIQUETA_ESTADO_CUENTA: Record<string, string> = {
  activa: "Activa", suspendida: "Suspendida", cerrada: "Cerrada"
};
const TAB_ETIQUETAS: Record<Tab, string> = {
  datos: "Datos", viajes: "Viajes", pagos: "Pagos",
  incidencias: "Incidencias", sesiones: "Sesiones", privacidad: "Privacidad", auditoria: "Auditoría"
};

type ConteosTabs = Partial<Record<Tab, number | null>>;

export default function PaginaDetalleUsuario() {
  const { id } = useParams<{ id: string }>();
  const [tab, setTab] = useState<Tab>("datos");
  const [usuario, setUsuario] = useState<UsuarioRow | null>(null);
  const [conteosTabs, setConteosTabs] = useState<ConteosTabs>({});
  const [cargando, setCargando] = useState(true);
  const [aviso, setAviso] = useState<{ tono: "info" | "danger"; texto: string } | null>(null);

  const cargar = useCallback(async () => {
    if (!tieneSupabaseConfigurado()) { setCargando(false); return; }
    try {
      const cliente = crearClienteNavegador();
      setUsuario(await obtenerUsuarioAdmin(cliente, id));
    } catch { setUsuario(null); }
    finally { setCargando(false); }
  }, [id]);

  useEffect(() => { void cargar(); }, [cargar]);

  useEffect(() => {
    if (!usuario || !tieneSupabaseConfigurado()) return;
    const usuarioActual = usuario;
    let cancelado = false;
    setConteosTabs({
      viajes: null,
      pagos: null,
      incidencias: null,
      sesiones: null,
      auditoria: null
    });

    async function cargarConteos() {
      const cliente = crearClienteNavegador();
      const resultados = await Promise.allSettled([
        listarTrasladosDeUsuario(cliente, usuarioActual.id),
        listarPagosDeUsuario(cliente, usuarioActual.id),
        listarIncidenciasDeUsuario(cliente, usuarioActual.id),
        listarSesionesUsuario(cliente, usuarioActual.id),
        obtenerAuditoriaUsuario(cliente, usuarioActual.id)
      ]);
      if (cancelado) return;
      const longitud = (resultado: PromiseSettledResult<unknown[]>) => resultado.status === "fulfilled" ? resultado.value.length : 0;
      setConteosTabs({
        viajes: longitud(resultados[0]),
        pagos: longitud(resultados[1]),
        incidencias: longitud(resultados[2]),
        sesiones: longitud(resultados[3]),
        auditoria: longitud(resultados[4])
      });
    }

    void cargarConteos();
    return () => { cancelado = true; };
  }, [usuario]);

  if (cargando) return <main className="mx-auto max-w-5xl px-6 py-8"><p className="font-body text-text-tertiary">Cargando...</p></main>;
  if (!usuario) return (
    <main className="mx-auto max-w-5xl px-6 py-8">
      <Aviso tono="danger">No se encontró el usuario.</Aviso>
      <Link href="/usuarios" className="mt-4 inline-block font-body text-sm text-focus-default hover:underline">Volver a usuarios</Link>
    </main>
  );

  return (
    <main className="mx-auto max-w-5xl px-6 py-8 sm:px-8 sm:py-10">
      <div className="flex items-center gap-3">
        <Link href="/usuarios" className="font-body text-sm text-text-tertiary hover:text-ink">&larr; Usuarios</Link>
      </div>

      {aviso && <div className="mt-4"><Aviso tono={aviso.tono}>{aviso.texto}</Aviso></div>}

      <div className="mt-6">
        <h1 className="font-display text-2xl font-semibold">{aTitleCase(usuario.nombre) || "Sin nombre"}</h1>
        <p className="mt-1 font-body text-sm text-text-secondary">{usuario.correo_facturacion ?? "Sin correo registrado"}</p>
        <div className="mt-3 flex flex-wrap gap-2">
          <AdminBadge>{aTitleCase(usuario.tipo_cuenta)}</AdminBadge>
          <AdminBadge>{aTitleCase(usuario.rol.replaceAll("_", " "))}</AdminBadge>
          <BadgeVerificacion estado={usuario.estado_verificacion} />
          <BadgeCuenta estado={usuario.estado_cuenta ?? "activa"} />
        </div>
      </div>

      <div className="mt-6 flex gap-1 border-b border-ink/10">
        {(Object.keys(TAB_ETIQUETAS) as Tab[]).map((t) => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-4 py-2 font-body text-sm font-medium transition-colors ${
              tab === t ? "border-b-2 border-ink text-ink" : "text-text-tertiary hover:text-ink"
            }`}
          >
            {TAB_ETIQUETAS[t]}
            {conteosTabs[t] !== undefined && (
              <span className={`ml-2 rounded-full px-2 py-0.5 text-xs ${tab === t ? "bg-ink text-surface-primary" : "bg-ink/10 text-text-secondary"}`}>
                {conteosTabs[t] ?? "..."}
              </span>
            )}
          </button>
        ))}
      </div>

      <div className="mt-6">
        {tab === "datos" && <TabDatos usuario={usuario} onActualizado={(u) => setUsuario(u)} onAviso={setAviso} />}
        {tab === "viajes" && <TabViajes usuarioId={usuario.id} />}
        {tab === "pagos" && <TabPagos usuarioId={usuario.id} />}
        {tab === "incidencias" && <TabIncidencias usuarioId={usuario.id} />}
        {tab === "sesiones" && <TabSesiones usuarioId={usuario.id} />}
        {tab === "privacidad" && <TabPrivacidad usuario={usuario} onActualizado={() => void cargar()} />}
        {tab === "auditoria" && <TabAuditoria usuarioId={usuario.id} />}
      </div>
    </main>
  );
}

function TabDatos({ usuario, onActualizado, onAviso }: { usuario: UsuarioRow; onActualizado: (u: UsuarioRow) => void; onAviso: (a: { tono: "info" | "danger"; texto: string }) => void }) {
  const direccionVacia = !usuario.calle && !usuario.numero && !usuario.colonia && !usuario.ciudad && !usuario.estado && !usuario.pais && !usuario.codigo_postal;
  return (
    <>
      <div className="grid gap-6 sm:grid-cols-2">
        <Seccion titulo="Datos personales">
          <Dato etiqueta="Nombre" valor={aTitleCase(usuario.nombre)} />
          <Dato etiqueta="Teléfono" valor={formatearTelefono(usuario.telefono)} />
          <Dato etiqueta="Correo de facturación" valor={usuario.correo_facturacion} />
          <Dato etiqueta="Tipo de cuenta" valor={aTitleCase(usuario.tipo_cuenta)} />
          <Dato etiqueta="Rol" valor={aTitleCase(usuario.rol.replaceAll("_", " "))} />
          <Dato etiqueta="RFC" valor={usuario.rfc} />
          <Dato etiqueta="Razón social" valor={aTitleCase(usuario.razon_social)} />
        </Seccion>
        <Seccion titulo="Dirección">
          {direccionVacia && <a href="#editar-datos-usuario" className="mb-2 inline-flex font-body text-sm font-semibold text-focus-default hover:underline">+ Agregar dirección</a>}
          <Dato etiqueta="Calle" valor={usuario.calle} />
          <Dato etiqueta="Número" valor={usuario.numero} />
          <Dato etiqueta="Colonia" valor={usuario.colonia} />
          <Dato etiqueta="Ciudad" valor={usuario.ciudad} />
          <Dato etiqueta="Estado" valor={usuario.estado} />
          <Dato etiqueta="País" valor={usuario.pais} />
          <Dato etiqueta="Código postal" valor={usuario.codigo_postal} />
        </Seccion>
        <Seccion titulo="Estados">
          <Dato etiqueta="Verificación" valor={ETIQUETA_VERIFICACION[usuario.estado_verificacion]} />
          <Dato etiqueta="Estado de cuenta" valor={ETIQUETA_ESTADO_CUENTA[usuario.estado_cuenta ?? "activa"]} />
          <Dato etiqueta="Método de pago" valor={usuario.metodo_pago_registrado ? "Registrado" : "Sin registrar"} />
          <Dato etiqueta="Traslados sin incidencia" valor={String(usuario.traslados_completados_sin_incidencia)} />
        </Seccion>
        <Seccion titulo="Fechas">
          <Dato etiqueta="Registrado" valor={new Date(usuario.creado_en).toLocaleString("es-MX")} />
          <Dato etiqueta="Actualizado" valor={usuario.actualizado_en ? new Date(usuario.actualizado_en).toLocaleString("es-MX") : null} />
          <Dato etiqueta="Términos aceptados" valor={usuario.terminos_aceptados_en ? new Date(usuario.terminos_aceptados_en).toLocaleString("es-MX") : "No aceptados"} />
        </Seccion>
      </div>

      <div className="mt-10">
        <EditarUsuario usuario={usuario} onActualizado={(u) => { onActualizado(u); onAviso({ tono: "info", texto: "Usuario actualizado." }); }} />
      </div>

      <div className="mt-10">
        <h2 className="font-display text-lg font-semibold">Verificación y documentos</h2>
        <div className="mt-3 rounded-card border border-ink/10 bg-surface-primary p-4">
          <AccionesVerificacion usuario={usuario} onActualizado={() => window.location.reload()} />
        </div>
      </div>

      <div className="mt-10 border-t border-ink/10 pt-8">
        <h2 className="font-display text-lg font-semibold text-status-error">Zona de riesgo</h2>
        <p className="mt-1 font-body text-sm text-text-secondary">Estas acciones afectan la cuenta del usuario de forma permanente o temporal.</p>
        <div className="mt-4 flex flex-wrap gap-3">
          {(usuario.estado_cuenta ?? "activa") !== "suspendida" && (
            <SuspenderCuenta usuarioId={usuario.id} onCompletado={() => { window.location.reload(); }} />
          )}
          {(usuario.estado_cuenta ?? "activa") !== "activa" && (
            <ReactivarCuenta usuarioId={usuario.id} onCompletado={() => { window.location.reload(); }} />
          )}
          {(usuario.estado_cuenta ?? "activa") !== "cerrada" && (
            <CerrarCuenta usuarioId={usuario.id} onCompletado={() => { window.location.reload(); }} />
          )}
        </div>
      </div>
    </>
  );
}

function TabViajes({ usuarioId }: { usuarioId: string }) {
  const [viajes, setViajes] = useState<ViajeRow[] | null>(null);
  const [cargando, setCargando] = useState(true);
  const [busqueda, setBusqueda] = useState("");
  const [estadoFiltro, setEstadoFiltro] = useState("todos");
  const [fechaDesde, setFechaDesde] = useState("");
  const [fechaHasta, setFechaHasta] = useState("");
  const [pagina, setPagina] = useState(1);
  const [seleccionado, setSeleccionado] = useState<ViajeRow | null>(null);
  const tamanoPagina = 10;

  useEffect(() => {
    const cliente = crearClienteNavegador();
    listarTrasladosDeUsuario(cliente, usuarioId).then(setViajes).catch(() => setViajes([])).finally(() => setCargando(false));
  }, [usuarioId]);

  const estados = useMemo(() => {
    return Array.from(new Set((viajes ?? []).map((viaje) => viaje.estado).filter(Boolean) as string[])).sort();
  }, [viajes]);

  const viajesFiltrados = useMemo(() => {
    const termino = busqueda.trim().toLocaleLowerCase("es-MX");
    return (viajes ?? []).filter((viaje) => {
      const folio = viaje.traslado_id?.toLocaleLowerCase("es-MX") ?? "";
      const coincideFolio = !termino || folio.includes(termino);
      const coincideEstado = estadoFiltro === "todos" || viaje.estado === estadoFiltro;
      const fecha = viaje.creado_en ? new Date(viaje.creado_en) : null;
      const despuesDeInicio = !fechaDesde || (fecha && fecha >= new Date(`${fechaDesde}T00:00:00`));
      const antesDeFin = !fechaHasta || (fecha && fecha <= new Date(`${fechaHasta}T23:59:59`));
      return coincideFolio && coincideEstado && despuesDeInicio && antesDeFin;
    });
  }, [busqueda, estadoFiltro, fechaDesde, fechaHasta, viajes]);

  useEffect(() => { setPagina(1); }, [busqueda, estadoFiltro, fechaDesde, fechaHasta]);

  const totalPaginas = Math.max(1, Math.ceil(viajesFiltrados.length / tamanoPagina));
  const paginaActual = Math.min(pagina, totalPaginas);
  const viajesPagina = viajesFiltrados.slice((paginaActual - 1) * tamanoPagina, paginaActual * tamanoPagina);

  async function copiarFolio(evento: React.MouseEvent, folio: string | null) {
    evento.stopPropagation();
    if (!folio) return;
    await navigator.clipboard.writeText(folio);
  }

  if (cargando) return <p className="font-body text-text-tertiary">Cargando traslados...</p>;
  if (!viajes?.length) return <p className="font-body text-text-tertiary">Sin traslados registrados.</p>;

  return (
    <div className="space-y-4">
      <div className="rounded-card border border-ink/10 bg-surface-primary p-4">
        <div className="grid gap-3 lg:grid-cols-[minmax(180px,1fr)_180px_160px_160px]">
          <label className="flex flex-col gap-1">
            <span className="font-body text-xs font-medium text-text-secondary">Buscar por folio</span>
            <input type="search" value={busqueda} onChange={(evento) => setBusqueda(evento.target.value)} placeholder="Ej. 8f2a1c3b" className="rounded-lg border border-ink/20 px-3 py-2 font-body text-sm focus:border-focus-default focus:outline-none focus:ring-2 focus:ring-focus-default/20" />
          </label>
          <label className="flex flex-col gap-1">
            <span className="font-body text-xs font-medium text-text-secondary">Estado</span>
            <select value={estadoFiltro} onChange={(evento) => setEstadoFiltro(evento.target.value)} className="rounded-lg border border-ink/20 px-3 py-2 font-body text-sm focus:border-focus-default focus:outline-none focus:ring-2 focus:ring-focus-default/20">
              <option value="todos">Todos</option>
              {estados.map((estado) => <option key={estado} value={estado}>{etiquetaEstadoTraslado(estado)}</option>)}
            </select>
          </label>
          <label className="flex flex-col gap-1">
            <span className="font-body text-xs font-medium text-text-secondary">Desde</span>
            <input type="date" value={fechaDesde} onChange={(evento) => setFechaDesde(evento.target.value)} className="rounded-lg border border-ink/20 px-3 py-2 font-body text-sm focus:border-focus-default focus:outline-none focus:ring-2 focus:ring-focus-default/20" />
          </label>
          <label className="flex flex-col gap-1">
            <span className="font-body text-xs font-medium text-text-secondary">Hasta</span>
            <input type="date" value={fechaHasta} onChange={(evento) => setFechaHasta(evento.target.value)} className="rounded-lg border border-ink/20 px-3 py-2 font-body text-sm focus:border-focus-default focus:outline-none focus:ring-2 focus:ring-focus-default/20" />
          </label>
        </div>
      </div>

      <div className="overflow-hidden rounded-card border border-ink/10 bg-surface-primary">
        <table className="w-full font-body text-sm">
          <thead><tr className="border-b border-ink/10 text-left text-xs uppercase tracking-wide text-text-tertiary">
            <th className="px-4 py-3">Folio</th>
            <th className="px-4 py-3">Estado</th>
            <th className="px-4 py-3">Origen</th>
            <th className="px-4 py-3">Destino</th>
            <th className="px-4 py-3">Creación</th>
            <th className="px-4 py-3 text-right">Acción</th>
          </tr></thead>
          <tbody>
            {viajesPagina.map((viaje) => (
              <tr key={viaje.traslado_id} onClick={() => setSeleccionado(viaje)} className="group cursor-pointer border-b border-ink/5 transition-colors last:border-0 hover:bg-surface-secondary/70">
                <td className="px-4 py-3">
                  <span className="font-mono-ruum text-sm font-semibold text-ink">{folioCorto(viaje.traslado_id)}</span>
                  <span className="ml-2 font-body text-xs text-text-tertiary opacity-0 transition-opacity group-hover:opacity-100">clic para detalle</span>
                </td>
                <td className="px-4 py-3"><BadgeEstadoTraslado viaje={viaje} /></td>
                <td className="px-4 py-3 text-text-secondary">{viaje.origen_direccion || viaje.origen_ciudad || <ValorVacio />}</td>
                <td className="px-4 py-3 text-text-secondary">{viaje.destino_direccion || viaje.destino_ciudad || <ValorVacio />}</td>
                <td className="px-4 py-3 text-text-secondary">{formatearFechaOperativa(viaje.creado_en)}</td>
                <td className="px-4 py-3">
                  <div className="flex justify-end gap-2 opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100">
                    <button type="button" onClick={(evento) => copiarFolio(evento, viaje.traslado_id)} className="rounded-md border border-ink/20 px-2.5 py-1 font-body text-xs font-semibold text-text-secondary hover:border-focus-default hover:text-focus-default">Copiar folio</button>
                    <button type="button" onClick={(evento) => { evento.stopPropagation(); setSeleccionado(viaje); }} className="rounded-md border border-ink/20 px-2.5 py-1 font-body text-xs font-semibold text-text-secondary hover:border-focus-default hover:text-focus-default">Ver detalle</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!viajesPagina.length && <p className="px-4 py-8 text-center font-body text-sm text-text-tertiary">Sin traslados para los filtros seleccionados.</p>}
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-ink/10 px-4 py-3">
          <p className="font-body text-sm text-text-secondary">Mostrando {viajesPagina.length} de {viajesFiltrados.length} traslados</p>
          <div className="flex gap-2">
            <button type="button" onClick={() => setPagina((valor) => Math.max(1, valor - 1))} disabled={paginaActual === 1} className="rounded-lg border border-ink/20 px-3 py-1.5 font-body text-sm font-semibold text-text-secondary disabled:opacity-50">Anterior</button>
            <span className="rounded-lg bg-ink/5 px-3 py-1.5 font-body text-sm text-text-secondary">Página {paginaActual} de {totalPaginas}</span>
            <button type="button" onClick={() => setPagina((valor) => Math.min(totalPaginas, valor + 1))} disabled={paginaActual === totalPaginas} className="rounded-lg border border-ink/20 px-3 py-1.5 font-body text-sm font-semibold text-text-secondary disabled:opacity-50">Siguiente</button>
          </div>
        </div>
      </div>

      <DetalleViajeDrawer viaje={seleccionado} onCerrar={() => setSeleccionado(null)} />
    </div>
  );
}

function BadgeEstadoTraslado({ viaje }: { viaje: ViajeRow }) {
  const estado = viaje.tiene_incidencia_abierta || Number(viaje.incidencias_abiertas ?? 0) > 0 ? "incidencia" : viaje.estado;
  const tone = tonoEstadoTraslado(estado);
  return <AdminBadge tone={tone}>{etiquetaEstadoTraslado(estado)}</AdminBadge>;
}

function DetalleViajeDrawer({ viaje, onCerrar }: { viaje: ViajeRow | null; onCerrar: () => void }) {
  return (
    <AdminDrawer
      open={Boolean(viaje)}
      title={viaje ? `Traslado ${folioCorto(viaje.traslado_id)}` : "Detalle de traslado"}
      description={viaje ? `${etiquetaEstadoTraslado(viaje.tiene_incidencia_abierta ? "incidencia" : viaje.estado)} · ${formatearFechaOperativa(viaje.creado_en)}` : undefined}
      onOpenChange={(open) => { if (!open) onCerrar(); }}
      footer={viaje && <Link href={`/viajes/${viaje.traslado_id}`} className="rounded-lg border border-ink/20 px-4 py-2 font-body text-sm font-semibold text-ink hover:bg-surface-secondary">Abrir página completa</Link>}
    >
      {viaje && (
        <div className="space-y-5">
          <Seccion titulo="Resumen">
            <Dato etiqueta="Folio" valor={viaje.traslado_id} />
            <Dato etiqueta="Estado" valor={etiquetaEstadoTraslado(viaje.tiene_incidencia_abierta ? "incidencia" : viaje.estado)} />
            <Dato etiqueta="Creación" valor={formatearFechaOperativa(viaje.creado_en)} />
            <Dato etiqueta="Tipo de servicio" valor={aTitleCase(viaje.vehiculo_tipo ?? viaje.vehiculo_categoria_tarifa)} />
          </Seccion>
          <Seccion titulo="Ruta">
            <Dato etiqueta="Origen" valor={viaje.origen_direccion || viaje.origen_ciudad} />
            <Dato etiqueta="Destino" valor={viaje.destino_direccion || viaje.destino_ciudad} />
            <Dato etiqueta="Distancia" valor={viaje.distancia_km != null ? `${viaje.distancia_km.toFixed(1)} km` : null} />
            <Dato etiqueta="Tiempo estimado" valor={viaje.tiempo_estimado_horas != null ? `${viaje.tiempo_estimado_horas.toFixed(1)} h` : null} />
          </Seccion>
          <Seccion titulo="Vehículo y conductor">
            <Dato etiqueta="Vehículo" valor={descripcionVehiculo(viaje)} />
            <Dato etiqueta="Placas" valor={viaje.vehiculo_placas} />
            <Dato etiqueta="Conductor" valor={aTitleCase(viaje.conductor_nombre)} />
            <Dato etiqueta="Calificación" valor={viaje.conductor_calificacion != null ? viaje.conductor_calificacion.toFixed(1) : null} />
          </Seccion>
          <Seccion titulo="Operación">
            <Dato etiqueta="Incidencias abiertas" valor={String(viaje.incidencias_abiertas ?? 0)} />
            <Dato etiqueta="Pago" valor={viaje.monto_pagado != null ? dinero(viaje.monto_pagado) : null} />
            <Dato etiqueta="Precio final" valor={viaje.precio_final != null ? dinero(viaje.precio_final) : null} />
          </Seccion>
        </div>
      )}
    </AdminDrawer>
  );
}

function tonoEstadoTraslado(estado: string | null | undefined): "neutral" | "info" | "success" | "warning" | "danger" {
  if (!estado) return "neutral";
  if (estado === "solicitud_creada" || estado === "cotizacion_generada") return "info";
  if (estado === "servicio_completado" || estado === "entrega_confirmada" || estado === "evidencia_final_completada") return "success";
  if (estado.includes("cancel") || estado.includes("fall") || estado.includes("incidencia") || estado === "rechazado") return "danger";
  if (estado.includes("traslado") || estado.includes("conductor") || estado.includes("proceso") || estado.includes("confirmado") || estado.includes("evidencia")) return "warning";
  return "neutral";
}

function etiquetaEstadoTraslado(estado: string | null | undefined) {
  if (!estado) return "Sin estado";
  const etiquetas: Record<string, string> = {
    solicitud_creada: "Solicitud creada",
    cotizacion_generada: "Cotización generada",
    servicio_confirmado: "Servicio confirmado",
    pendiente_de_conductor: "Pendiente de conductor",
    conductor_asignado: "Conductor asignado",
    en_recoleccion: "En recolección",
    en_traslado: "En traslado",
    evidencia_inicial_en_proceso: "Evidencia inicial en proceso",
    evidencia_inicial_completada: "Evidencia inicial completada",
    evidencia_final_en_proceso: "Evidencia final en proceso",
    evidencia_final_completada: "Evidencia final completada",
    entrega_confirmada: "Entrega confirmada",
    servicio_completado: "Completado",
    cancelado: "Cancelado",
    cancelado_por_usuario: "Cancelado por usuario",
    cancelado_por_admin: "Cancelado por admin",
    incidencia: "Incidencia"
  };
  return etiquetas[estado] ?? aTitleCase(estado.replaceAll("_", " ")) ?? "Sin estado";
}

function folioCorto(folio: string | null | undefined) {
  return folio ? folio.slice(0, 8) : "Sin folio";
}

function formatearFechaOperativa(fecha: string | null | undefined) {
  if (!fecha) return "Sin fecha";
  const valor = new Date(fecha);
  return `${valor.toLocaleDateString("es-MX")} - ${valor.toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" })} hrs`;
}

function descripcionVehiculo(viaje: ViajeRow) {
  const partes = [viaje.vehiculo_marca, viaje.vehiculo_modelo, viaje.vehiculo_anio].filter(Boolean);
  return partes.length ? partes.join(" ") : null;
}

function dinero(monto: number) {
  return new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" }).format(monto);
}

function TabPagos({ usuarioId }: { usuarioId: string }) {
  const [pagos, setPagos] = useState<PagosRow[] | null>(null);
  const [cargando, setCargando] = useState(true);
  useEffect(() => {
    const cliente = crearClienteNavegador();
    listarPagosDeUsuario(cliente, usuarioId).then(setPagos).catch(() => setPagos([])).finally(() => setCargando(false));
  }, [usuarioId]);

  if (cargando) return <p className="font-body text-text-tertiary">Cargando pagos...</p>;
  if (!pagos?.length) return <p className="font-body text-text-tertiary">Sin pagos registrados.</p>;

  return (
    <div className="overflow-hidden rounded-card border border-ink/10 bg-surface-primary">
      <table className="w-full font-body text-sm">
        <thead><tr className="border-b border-ink/10 text-left text-xs uppercase tracking-wide text-text-tertiary">
          <th className="px-4 py-3">Monto</th>
          <th className="px-4 py-3">Estado</th>
          <th className="px-4 py-3">Método</th>
          <th className="px-4 py-3">Fecha</th>
        </tr></thead>
        <tbody>
          {pagos.map((p) => (
            <tr key={p.id} className="border-b border-ink/5 last:border-0">
              <td className="px-4 py-3 font-mono-ruum">${(p.monto ?? 0).toFixed(2)}</td>
              <td className="px-4 py-3 capitalize">{p.estado?.replaceAll("_", " ")}</td>
              <td className="px-4 py-3 text-text-secondary">{p.metodo || <ValorVacio />}</td>
              <td className="px-4 py-3 text-text-secondary">{new Date(p.registrado_en).toLocaleDateString("es-MX")}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function TabIncidencias({ usuarioId }: { usuarioId: string }) {
  const [incidencias, setIncidencias] = useState<IncidenciaRow[] | null>(null);
  const [cargando, setCargando] = useState(true);
  useEffect(() => {
    const cliente = crearClienteNavegador();
    listarIncidenciasDeUsuario(cliente, usuarioId).then(setIncidencias).catch(() => setIncidencias([])).finally(() => setCargando(false));
  }, [usuarioId]);

  if (cargando) return <p className="font-body text-text-tertiary">Cargando incidencias...</p>;
  if (!incidencias?.length) return <p className="font-body text-text-tertiary">Sin incidencias registradas.</p>;

  return (
    <div className="overflow-hidden rounded-card border border-ink/10 bg-surface-primary">
      <table className="w-full font-body text-sm">
        <thead><tr className="border-b border-ink/10 text-left text-xs uppercase tracking-wide text-text-tertiary">
          <th className="px-4 py-3">Tipo</th>
          <th className="px-4 py-3">Estado</th>
          <th className="px-4 py-3">Fecha</th>
        </tr></thead>
        <tbody>
          {incidencias.map((inc) => (
            <tr key={inc.id} className="border-b border-ink/5 last:border-0">
              <td className="px-4 py-3 capitalize">{inc.tipo?.replaceAll("_", " ")}</td>
              <td className="px-4 py-3 capitalize">{inc.resuelta ? "Resuelta" : "Abierta"}</td>
              <td className="px-4 py-3 text-text-secondary">{new Date(inc.creada_en).toLocaleDateString("es-MX")}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function TabSesiones({ usuarioId }: { usuarioId: string }) {
  const [sesiones, setSesiones] = useState<Array<{ id: string; creada_en: string; ultimo_acceso: string | null; agente_usuario: string | null; direccion_ip: string | null; activa: boolean }> | null>(null);
  const [cargando, setCargando] = useState(true);
  const [revocando, setRevocando] = useState<string | null>(null);

  const cargar = useCallback(async () => {
    const cliente = crearClienteNavegador();
    listarSesionesUsuario(cliente, usuarioId).then(setSesiones).catch(() => setSesiones([])).finally(() => setCargando(false));
  }, [usuarioId]);

  useEffect(() => { void cargar(); }, [cargar]);

  async function revocar(sesionId: string) {
    setRevocando(sesionId);
    try {
      const cliente = crearClienteNavegador();
      await revocarSesionUsuario(cliente, sesionId);
      void cargar();
    } catch { /* ignore */ }
    finally { setRevocando(null); }
  }

  if (cargando) return <p className="font-body text-text-tertiary">Cargando sesiones...</p>;
  if (!sesiones?.length) return <p className="font-body text-text-tertiary">Sin sesiones activas.</p>;

  return (
    <div className="overflow-hidden rounded-card border border-ink/10 bg-surface-primary">
      <table className="w-full font-body text-sm">
        <thead><tr className="border-b border-ink/10 text-left text-xs uppercase tracking-wide text-text-tertiary">
          <th className="px-4 py-3">Dispositivo</th>
          <th className="px-4 py-3">IP</th>
          <th className="px-4 py-3">Último acceso</th>
          <th className="px-4 py-3">Estado</th>
          <th className="px-4 py-3">Acción</th>
        </tr></thead>
        <tbody>
          {sesiones.map((s) => (
            <tr key={s.id} className="border-b border-ink/5 last:border-0">
              <td className="px-4 py-3 font-body text-sm">{s.agente_usuario?.slice(0, 60) || <ValorVacio />}</td>
              <td className="px-4 py-3 font-mono-ruum text-xs">{s.direccion_ip || <ValorVacio />}</td>
              <td className="px-4 py-3 text-text-secondary">{s.ultimo_acceso ? new Date(s.ultimo_acceso).toLocaleString("es-MX") : <ValorVacio />}</td>
              <td className="px-4 py-3">
                <AdminBadge tone={s.activa ? "success" : "danger"}>{s.activa ? "Activa" : "Revocada"}</AdminBadge>
              </td>
              <td className="px-4 py-3">
                {s.activa && (
                  <button onClick={() => revocar(s.id)} disabled={revocando === s.id}
                    className="rounded-md border border-status-error/40 px-3 py-1 font-body text-xs text-status-error hover:bg-status-error/10 disabled:opacity-50"
                  >{revocando === s.id ? "Revocando..." : "Revocar"}</button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function TabPrivacidad({ usuario, onActualizado }: { usuario: UsuarioRow; onActualizado: () => void }) {
  const [anonimizando, setAnonimizando] = useState(false);
  const [exportando, setExportando] = useState(false);
  const [formatoExportacion, setFormatoExportacion] = useState<FormatoExportacionPrivacidad>("json");
  const [confirmandoAnonimizacion, setConfirmandoAnonimizacion] = useState(false);
  const [confirmacionAnonimizacion, setConfirmacionAnonimizacion] = useState("");
  const [bitacora, setBitacora] = useState<BitacoraPrivacidad[]>([]);
  const [aviso, setAviso] = useState<string | null>(null);
  const documento = estadoDocumentoIdentidad(usuario);

  async function anonimizarDatos() {
    if (confirmacionAnonimizacion !== "ANONIMIZAR") return;
    setAnonimizando(true);
    setAviso(null);
    try {
      const cliente = crearClienteNavegador();
      await actualizarUsuarioAdmin(cliente, usuario.id, {
        nombre: "[anonimizado]",
        telefono: null,
        correo_facturacion: null,
        calle: null, numero: null, colonia: null, ciudad: null, estado: null, pais: null, codigo_postal: null,
        direccion_principal: null, foto_url: null
      });
      setAviso("Datos anonimizados correctamente.");
      setBitacora((actual) => [{ tipo: "anonimizacion", fecha: new Date().toISOString(), detalle: "Anonimización ejecutada desde panel admin." }, ...actual]);
      setConfirmandoAnonimizacion(false);
      setConfirmacionAnonimizacion("");
      onActualizado();
    } catch (err) {
      setAviso(err instanceof Error ? err.message : "Error al anonimizar.");
    } finally { setAnonimizando(false); }
  }

  async function exportarDatos() {
    setExportando(true);
    setAviso(null);
    try {
      const cliente = crearClienteNavegador();
      const [viajes, pagos] = await Promise.all([
        listarTrasladosDeUsuario(cliente, usuario.id),
        listarPagosDeUsuario(cliente, usuario.id)
      ]);
      const datos = { usuario, viajes, pagos, exportado_en: new Date().toISOString(), formato: formatoExportacion };
      const blob = crearArchivoExportacionPrivacidad(datos, formatoExportacion);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a"); a.href = url; a.download = `datos-usuario-${usuario.id}.${formatoExportacion}`; a.click();
      URL.revokeObjectURL(url);
      setAviso("Exportación completada.");
      setBitacora((actual) => [{ tipo: "exportacion", fecha: new Date().toISOString(), detalle: `Exportación ${formatoExportacion.toUpperCase()} generada.` }, ...actual]);
    } catch (err) {
      setAviso(err instanceof Error ? err.message : "Error al exportar.");
    } finally { setExportando(false); }
  }

  return (
    <div className="space-y-6">
      {aviso && <Aviso tono="info">{aviso}</Aviso>}

      <div className="rounded-card border border-ink/10 bg-surface-primary p-4">
        <h3 className="font-display text-sm font-semibold uppercase tracking-wide text-text-tertiary">Exportar datos</h3>
        <p className="mt-1 font-body text-sm text-text-secondary">Descarga información del usuario, traslados y pagos para migración o solicitudes de derechos de datos.</p>
        <div className="mt-4 grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto]">
          <label className="flex flex-col gap-1">
            <span className="font-body text-xs font-medium text-text-secondary">Formato de exportación</span>
            <select value={formatoExportacion} onChange={(evento) => setFormatoExportacion(evento.target.value as FormatoExportacionPrivacidad)} className="rounded-lg border border-ink/20 px-3 py-2 font-body text-sm focus:border-focus-default focus:outline-none focus:ring-2 focus:ring-focus-default/20">
              <option value="json">JSON - desarrolladores / migraciones</option>
              <option value="pdf">PDF - solicitudes ARCO / GDPR / Ley de datos</option>
              <option value="csv">CSV - revisión tabular</option>
            </select>
          </label>
          <button onClick={exportarDatos} disabled={exportando}
            className="self-end rounded-lg border border-ink/20 px-4 py-2 font-body text-sm font-semibold hover:bg-ink/5 disabled:opacity-50"
          >{exportando ? "Exportando..." : "Exportar datos"}</button>
        </div>
      </div>

      <div className="rounded-card border border-status-error/35 bg-status-error-soft p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <AdminBadge tone="danger">Zona de seguridad</AdminBadge>
            <h3 className="mt-3 font-display text-sm font-semibold uppercase tracking-wide text-status-error">Anonimizar datos personales</h3>
            <p className="mt-1 font-body text-sm text-text-secondary">Reemplaza datos personales con valores anonimizados. Los traslados e historial se conservan para referencia operativa y obligaciones aplicables.</p>
          </div>
          <button onClick={() => setConfirmandoAnonimizacion(true)} disabled={anonimizando}
            className="rounded-lg border border-status-error bg-surface-primary px-4 py-2 font-body text-sm font-semibold text-status-error hover:bg-status-error hover:text-surface-primary disabled:opacity-50"
          >Anonimizar datos</button>
        </div>
      </div>

      <div className="rounded-card border border-ink/10 bg-surface-primary p-4">
        <h3 className="font-display text-sm font-semibold uppercase tracking-wide text-text-tertiary">Minimización de datos</h3>
        <p className="mt-1 font-body text-sm text-text-secondary">El sistema solo conserva los datos estrictamente necesarios para la operación. Los documentos de identidad antiguos se eliminan automáticamente tras 90 días.</p>
        <div className="mt-4 grid gap-3">
          <MinimizacionItem estado="Activo" tono="info" titulo="Datos personales básicos" detalle="Nombre, teléfono y correo necesarios para atención operativa." />
          <MinimizacionItem estado="Fiscal" tono="warning" titulo="Dirección fiscal" detalle="Conservada para facturación y obligaciones administrativas." />
          <MinimizacionItem estado="Retenido" tono="warning" titulo="Historial de traslados" detalle="Conservado por trazabilidad operativa y obligación fiscal." />
          <MinimizacionItem estado={documento.estado} tono={documento.tono} titulo="Documento de identidad" detalle={documento.detalle} />
        </div>
      </div>

      <div className="rounded-card border border-ink/10 bg-surface-primary p-4">
        <h3 className="font-display text-sm font-semibold uppercase tracking-wide text-text-tertiary">Bitácora de solicitudes</h3>
        {bitacora.length ? (
          <div className="mt-3 space-y-2">
            {bitacora.map((evento) => (
              <div key={`${evento.tipo}-${evento.fecha}`} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-ink/10 px-3 py-2">
                <span className="font-body text-sm text-ink">{evento.detalle}</span>
                <span className="font-mono-ruum text-xs text-text-tertiary">{formatearFechaOperativa(evento.fecha)}</span>
              </div>
            ))}
          </div>
        ) : (
          <p className="mt-2 font-body text-sm text-text-tertiary">Sin solicitudes registradas en esta sesión.</p>
        )}
      </div>

      <AdminDialog
        open={confirmandoAnonimizacion}
        title="Confirmar anonimización"
        description="Esta acción no se puede deshacer desde el panel. Escribe ANONIMIZAR para continuar."
        onOpenChange={(open) => { if (!anonimizando) setConfirmandoAnonimizacion(open); }}
        footer={<>
          <button type="button" onClick={() => setConfirmandoAnonimizacion(false)} disabled={anonimizando} className="rounded-lg border border-ink/20 px-4 py-2 font-body text-sm font-semibold text-ink hover:bg-surface-secondary">Cancelar</button>
          <button type="button" onClick={anonimizarDatos} disabled={anonimizando || confirmacionAnonimizacion !== "ANONIMIZAR"} className="rounded-lg bg-status-error px-4 py-2 font-body text-sm font-semibold text-surface-primary disabled:opacity-50">{anonimizando ? "Anonimizando..." : "Anonimizar definitivamente"}</button>
        </>}
      >
        <label className="flex flex-col gap-1">
          <span className="font-body text-xs font-medium text-text-secondary">Confirmación requerida</span>
          <input value={confirmacionAnonimizacion} onChange={(evento) => setConfirmacionAnonimizacion(evento.target.value)} className="rounded-lg border border-status-error/30 px-3 py-2 font-body text-sm focus:border-status-error focus:outline-none focus:ring-2 focus:ring-status-error/20" />
        </label>
      </AdminDialog>
    </div>
  );
}

function MinimizacionItem({ estado, tono, titulo, detalle }: { estado: string; tono: "neutral" | "info" | "success" | "warning" | "danger"; titulo: string; detalle: string }) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3 rounded-lg border border-ink/10 px-3 py-3">
      <div>
        <p className="font-body text-sm font-semibold text-ink">{titulo}</p>
        <p className="mt-1 font-body text-sm text-text-secondary">{detalle}</p>
      </div>
      <AdminBadge tone={tono}>{estado}</AdminBadge>
    </div>
  );
}

function estadoDocumentoIdentidad(usuario: UsuarioRow): { estado: string; tono: "neutral" | "info" | "success" | "warning" | "danger"; detalle: string } {
  if (!usuario.doc_identidad_url && !usuario.doc_identidad_subido_en) {
    return { estado: "Sin documento", tono: "neutral", detalle: "No hay documento de identidad activo ni fecha de carga registrada." };
  }

  if (!usuario.doc_identidad_subido_en) {
    return { estado: usuario.doc_identidad_url ? "Activo" : "Sin documento", tono: usuario.doc_identidad_url ? "info" : "neutral", detalle: "El documento no tiene fecha de carga disponible para calcular retención." };
  }

  const carga = new Date(usuario.doc_identidad_subido_en);
  const vence = new Date(carga);
  vence.setDate(vence.getDate() + 90);
  const diasRestantes = Math.ceil((vence.getTime() - Date.now()) / (1000 * 60 * 60 * 24));

  if (!usuario.doc_identidad_url) {
    return { estado: "Sin documento activo", tono: "success", detalle: `Última retención calculada hasta ${vence.toLocaleDateString("es-MX", { day: "2-digit", month: "short", year: "numeric" })}.` };
  }

  if (diasRestantes <= 0) {
    return { estado: "Retención vencida", tono: "danger", detalle: `Debe eliminarse o revisarse: venció el ${vence.toLocaleDateString("es-MX", { day: "2-digit", month: "short", year: "numeric" })}.` };
  }

  return { estado: `Expira en ${diasRestantes} días`, tono: diasRestantes <= 15 ? "warning" : "info", detalle: `Documento de identidad cargado; eliminación automática prevista para ${vence.toLocaleDateString("es-MX", { day: "2-digit", month: "short", year: "numeric" })}.` };
}

function crearArchivoExportacionPrivacidad(datos: { usuario: UsuarioRow; viajes: ViajeRow[]; pagos: PagosRow[]; exportado_en: string; formato: FormatoExportacionPrivacidad }, formato: FormatoExportacionPrivacidad) {
  if (formato === "json") return new Blob([JSON.stringify(datos, null, 2)], { type: "application/json" });
  if (formato === "csv") return new Blob([crearCsvPrivacidad(datos)], { type: "text/csv;charset=utf-8" });
  return new Blob([crearPdfSimple(crearTextoPdfPrivacidad(datos))], { type: "application/pdf" });
}

function crearCsvPrivacidad(datos: { usuario: UsuarioRow; viajes: ViajeRow[]; pagos: PagosRow[]; exportado_en: string }) {
  const filas = [
    ["seccion", "campo", "valor"],
    ["usuario", "id", datos.usuario.id],
    ["usuario", "nombre", datos.usuario.nombre ?? ""],
    ["usuario", "telefono", datos.usuario.telefono ?? ""],
    ["usuario", "correo_facturacion", datos.usuario.correo_facturacion ?? ""],
    ["usuario", "estado_cuenta", datos.usuario.estado_cuenta ?? "activa"],
    ["usuario", "estado_verificacion", datos.usuario.estado_verificacion],
    ["resumen", "traslados", String(datos.viajes.length)],
    ["resumen", "pagos", String(datos.pagos.length)],
    ["exportacion", "exportado_en", datos.exportado_en]
  ];
  return filas.map((fila) => fila.map((valor) => `"${String(valor).replaceAll('"', '""')}"`).join(",")).join("\n");
}

function crearTextoPdfPrivacidad(datos: { usuario: UsuarioRow; viajes: ViajeRow[]; pagos: PagosRow[]; exportado_en: string }) {
  return [
    "Exportación de datos personales",
    `Usuario: ${datos.usuario.id}`,
    `Nombre: ${datos.usuario.nombre ?? "Sin dato"}`,
    `Teléfono: ${formatearTelefono(datos.usuario.telefono) ?? "Sin dato"}`,
    `Correo de facturación: ${datos.usuario.correo_facturacion ?? "Sin dato"}`,
    `Estado de cuenta: ${datos.usuario.estado_cuenta ?? "activa"}`,
    `Estado de verificación: ${datos.usuario.estado_verificacion}`,
    `Traslados incluidos: ${datos.viajes.length}`,
    `Pagos incluidos: ${datos.pagos.length}`,
    `Exportado: ${formatearFechaOperativa(datos.exportado_en)}`
  ].join("\n");
}

function crearPdfSimple(texto: string) {
  const lineas = texto.split("\n").slice(0, 32);
  const contenido = ["BT", "/F1 12 Tf", "50 780 Td", ...lineas.flatMap((linea, indice) => [`${indice === 0 ? "" : "0 -18 Td"}(${escaparPdf(linea)}) Tj`]), "ET"].join("\n");
  const objetos = [
    "1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj",
    "2 0 obj << /Type /Pages /Kids [3 0 R] /Count 1 >> endobj",
    "3 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >> endobj",
    "4 0 obj << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> endobj",
    `5 0 obj << /Length ${contenido.length} >> stream\n${contenido}\nendstream endobj`
  ];
  let salida = "%PDF-1.4\n";
  const offsets = [0];
  for (const objeto of objetos) {
    offsets.push(salida.length);
    salida += `${objeto}\n`;
  }
  const xref = salida.length;
  salida += `xref\n0 ${objetos.length + 1}\n0000000000 65535 f \n`;
  salida += offsets.slice(1).map((offset) => `${String(offset).padStart(10, "0")} 00000 n \n`).join("");
  salida += `trailer << /Size ${objetos.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  return salida;
}

function escaparPdf(valor: string) {
  return valor.replaceAll("\\", "\\\\").replaceAll("(", "\\(").replaceAll(")", "\\)");
}

function TabAuditoria({ usuarioId }: { usuarioId: string }) {
  const [eventos, setEventos] = useState<Array<{ evento: string; creado_en: string; datos: Record<string, unknown> | null }> | null>(null);
  const [cargando, setCargando] = useState(true);
  useEffect(() => {
    const cliente = crearClienteNavegador();
    obtenerAuditoriaUsuario(cliente, usuarioId).then(setEventos).catch(() => setEventos([])).finally(() => setCargando(false));
  }, [usuarioId]);

  if (cargando) return <p className="font-body text-text-tertiary">Cargando auditoría...</p>;
  if (!eventos?.length) return <p className="font-body text-text-tertiary">Sin eventos de auditoría.</p>;

  return (
    <div className="overflow-hidden rounded-card border border-ink/10 bg-surface-primary">
      <table className="w-full font-body text-sm">
        <thead><tr className="border-b border-ink/10 text-left text-xs uppercase tracking-wide text-text-tertiary">
          <th className="px-4 py-3">Evento</th>
          <th className="px-4 py-3">Fecha</th>
          <th className="px-4 py-3">Detalle</th>
        </tr></thead>
        <tbody>
          {eventos.map((e, i) => (
            <tr key={i} className="border-b border-ink/5 last:border-0">
              <td className="px-4 py-3 font-medium capitalize">{e.evento.replaceAll("_", " ")}</td>
              <td className="px-4 py-3 text-text-secondary">{new Date(e.creado_en).toLocaleString("es-MX")}</td>
              <td className="px-4 py-3 font-mono-ruum text-xs text-text-tertiary">{e.datos ? JSON.stringify(e.datos).slice(0, 120) : <ValorVacio />}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
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
      <span className="text-right font-medium text-ink">{valor || <ValorVacio />}</span>
    </div>
  );
}

function ValorVacio({ texto = "Sin dato" }: { texto?: string }) {
  return <span className="font-normal text-text-tertiary">{texto}</span>;
}

function BadgeVerificacion({ estado }: { estado: string }) {
  const tone = estado === "verificado" ? "success" : estado === "rechazado" ? "danger" : "warning";
  return <AdminBadge tone={tone}>{ETIQUETA_VERIFICACION[estado] ?? aTitleCase(estado.replaceAll("_", " "))}</AdminBadge>;
}

function BadgeCuenta({ estado }: { estado: string }) {
  const tone = estado === "activa" ? "success" : "danger";
  return <AdminBadge tone={tone}>{ETIQUETA_ESTADO_CUENTA[estado] ?? aTitleCase(estado.replaceAll("_", " "))}</AdminBadge>;
}

function formatearTelefono(valor: string | null | undefined) {
  if (!valor) return null;
  const digitos = valor.replace(/\D/g, "");
  const nacional = digitos.length === 12 && digitos.startsWith("52") ? digitos.slice(2) : digitos;
  if (nacional.length !== 10) return valor;
  return `(${nacional.slice(0, 3)}) ${nacional.slice(3, 6)}-${nacional.slice(6)}`;
}

function aTitleCase(valor: string | null | undefined) {
  if (!valor) return null;
  const palabrasMinusculas = new Set(["de", "del", "la", "las", "los", "y", "e"]);
  const acronimos = new Set(["sa", "s.a.", "cv", "c.v.", "rfc"]);
  return valor
    .toLocaleLowerCase("es-MX")
    .split(/(\s+)/)
    .map((parte, indice) => {
      if (/^\s+$/.test(parte)) return parte;
      if (acronimos.has(parte)) return parte.toLocaleUpperCase("es-MX");
      if (indice > 0 && palabrasMinusculas.has(parte)) return parte;
      return parte.charAt(0).toLocaleUpperCase("es-MX") + parte.slice(1);
    })
    .join("");
}

function EditarUsuario({ usuario, onActualizado }: { usuario: UsuarioRow; onActualizado: (u: UsuarioRow) => void }) {
  const [editando, setEditando] = useState(false);
  const [nombre, setNombre] = useState(usuario.nombre ?? "");
  const [telefono, setTelefono] = useState(usuario.telefono ?? "");
  const [correoFacturacion, setCorreoFacturacion] = useState(usuario.correo_facturacion ?? "");
  const [calle, setCalle] = useState(usuario.calle ?? "");
  const [numero, setNumero] = useState(usuario.numero ?? "");
  const [colonia, setColonia] = useState(usuario.colonia ?? "");
  const [ciudad, setCiudad] = useState(usuario.ciudad ?? "");
  const [estado, setEstado] = useState(usuario.estado ?? "");
  const [pais, setPais] = useState(usuario.pais ?? "");
  const [codigoPostal, setCodigoPostal] = useState(usuario.codigo_postal ?? "");
  const [procesando, setProcesando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!editando) {
    return (
      <div id="editar-datos-usuario">
        <h2 className="font-display text-lg font-semibold">Editar datos</h2>
        <p className="mt-1 font-body text-sm text-text-secondary">Modifica la información del usuario.</p>
        <button onClick={() => setEditando(true)} className="mt-3 rounded-lg border border-ink/20 px-4 py-2 font-body text-sm font-medium hover:bg-ink/5">Editar</button>
      </div>
    );
  }

  async function guardar() {
    setProcesando(true);
    setError(null);
    try {
      const cliente = crearClienteNavegador();
      const actualizado = await actualizarUsuarioAdmin(cliente, usuario.id, {
        nombre: nombre.trim() || null,
        telefono: telefono.trim() || null,
        correo_facturacion: correoFacturacion.trim() || null,
        calle: calle.trim() || null,
        numero: numero.trim() || null,
        colonia: colonia.trim() || null,
        ciudad: ciudad.trim() || null,
        estado: estado.trim() || null,
        pais: pais.trim() || null,
        codigo_postal: codigoPostal.trim() || null
      });
      onActualizado(actualizado);
      setEditando(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo actualizar.");
    } finally {
      setProcesando(false);
    }
  }

  return (
    <div id="editar-datos-usuario">
      <h2 className="font-display text-lg font-semibold">Editar datos</h2>
      {error && <div className="mt-2"><Aviso tono="danger">{error}</Aviso></div>}
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <Campo label="Nombre" value={nombre} onChange={setNombre} />
        <Campo label="Teléfono" value={telefono} onChange={setTelefono} />
        <Campo label="Correo de facturación" value={correoFacturacion} onChange={setCorreoFacturacion} />
        <Campo label="Calle" value={calle} onChange={setCalle} />
        <Campo label="Número" value={numero} onChange={setNumero} />
        <Campo label="Colonia" value={colonia} onChange={setColonia} />
        <Campo label="Ciudad" value={ciudad} onChange={setCiudad} />
        <Campo label="Estado" value={estado} onChange={setEstado} />
        <Campo label="País" value={pais} onChange={setPais} />
        <Campo label="Código postal" value={codigoPostal} onChange={setCodigoPostal} />
      </div>
      <div className="mt-4 flex gap-2">
        <button onClick={guardar} disabled={procesando} className="rounded-lg bg-ink px-4 py-2 font-body text-sm font-semibold text-surface-primary hover:bg-ink/90 disabled:opacity-50">
          {procesando ? "Guardando..." : "Guardar cambios"}
        </button>
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

function SuspenderCuenta({ usuarioId, onCompletado }: { usuarioId: string; onCompletado: () => void }) {
  const [abierto, setAbierto] = useState(false);
  const [motivo, setMotivo] = useState("");
  const [confirmado, setConfirmado] = useState(false);
  const [procesando, setProcesando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function ejecutar() {
    if (!motivo.trim() || !confirmado) return;
    setProcesando(true); setError(null);
    try { const cliente = crearClienteNavegador(); await suspenderUsuarioAdmin(cliente, usuarioId, motivo.trim()); setAbierto(false); onCompletado(); }
    catch (err) { setError(err instanceof Error ? err.message : "No se pudo suspender."); }
    finally { setProcesando(false); }
  }
  return (
    <>
      <button onClick={() => setAbierto(true)} className="rounded-lg border border-status-error bg-status-error-soft px-4 py-2 font-body text-sm font-semibold text-status-error shadow-sm hover:bg-status-error hover:text-surface-primary">Suspender cuenta</button>
      <AdminDialog
        open={abierto}
        title="Suspender cuenta"
        description="El usuario no podrá acceder hasta que un administrador reactive la cuenta."
        onOpenChange={(open) => { if (!procesando) setAbierto(open); }}
        footer={<>
          <button onClick={() => setAbierto(false)} disabled={procesando} className="rounded-lg border border-ink/20 px-4 py-2 font-body text-sm font-medium">Cancelar</button>
          <button onClick={ejecutar} disabled={procesando || !motivo.trim() || !confirmado} className="rounded-lg bg-status-error px-4 py-2 font-body text-sm font-semibold text-surface-primary disabled:opacity-50">{procesando ? "Suspendiendo..." : "Confirmar suspensión"}</button>
        </>}
      >
        <div className="space-y-3">
          {error && <Aviso tono="danger">{error}</Aviso>}
          <label className="flex flex-col gap-1">
            <span className="font-body text-xs font-medium text-text-secondary">Motivo de la suspensión</span>
            <textarea value={motivo} onChange={(e) => setMotivo(e.target.value)} className="min-h-[88px] rounded-lg border border-ink/20 px-3 py-2 font-body text-sm" rows={3} />
          </label>
          <label className="flex gap-2 rounded-lg border border-status-error/25 bg-status-error-soft/30 p-3 font-body text-sm text-text-secondary">
            <input type="checkbox" checked={confirmado} onChange={(e) => setConfirmado(e.target.checked)} className="mt-1" />
            Confirmo que revisé el expediente y entiendo que esta acción bloquea el acceso del usuario.
          </label>
        </div>
      </AdminDialog>
    </>
  );
}

function ReactivarCuenta({ usuarioId, onCompletado }: { usuarioId: string; onCompletado: () => void }) {
  const [abierto, setAbierto] = useState(false);
  const [motivo, setMotivo] = useState("");
  const [procesando, setProcesando] = useState(false);
  if (!abierto) return <button onClick={() => setAbierto(true)} className="rounded-lg border border-status-success/40 bg-status-success/10 px-4 py-2 font-body text-sm font-medium text-status-success hover:bg-status-success/20">Reactivar cuenta</button>;
  async function ejecutar() {
    if (!motivo.trim()) return; setProcesando(true);
    try { const cliente = crearClienteNavegador(); await reactivarUsuarioAdmin(cliente, usuarioId, motivo.trim()); setAbierto(false); onCompletado(); } catch { /* */ }
    finally { setProcesando(false); }
  }
  return (
    <div className="rounded-lg border border-status-success/30 bg-status-success-soft/20 p-4">
      <p className="font-body text-sm font-semibold text-status-success">Reactivar cuenta</p>
      <textarea value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder="Motivo de la reactivación" className="mt-3 w-full rounded-lg border border-ink/20 px-3 py-2 font-body text-sm" rows={2} />
      <div className="mt-3 flex gap-2">
        <button onClick={ejecutar} disabled={procesando || !motivo.trim()} className="rounded-lg bg-status-success px-4 py-2 font-body text-sm font-semibold text-surface-primary disabled:opacity-50">{procesando ? "Reactivando..." : "Confirmar reactivación"}</button>
        <button onClick={() => setAbierto(false)} disabled={procesando} className="rounded-lg border border-ink/20 px-4 py-2 font-body text-sm font-medium">Cancelar</button>
      </div>
    </div>
  );
}

function CerrarCuenta({ usuarioId, onCompletado }: { usuarioId: string; onCompletado: () => void }) {
  const [abierto, setAbierto] = useState(false);
  const [motivo, setMotivo] = useState("");
  const [confirmacion, setConfirmacion] = useState("");
  const [procesando, setProcesando] = useState(false);
  async function ejecutar() {
    if (!motivo.trim() || confirmacion !== "CERRAR") return; setProcesando(true);
    try { const cliente = crearClienteNavegador(); await cerrarCuentaUsuarioAdmin(cliente, usuarioId, motivo.trim()); setAbierto(false); onCompletado(); } catch { /* */ }
    finally { setProcesando(false); }
  }
  return (
    <>
      <button onClick={() => setAbierto(true)} className="rounded-lg border border-status-error bg-status-error px-4 py-2 font-body text-sm font-semibold text-surface-primary shadow-sm hover:bg-status-error/90">Cerrar cuenta</button>
      <AdminDialog
        open={abierto}
        title="Cerrar cuenta permanentemente"
        description="Esta acción no se puede deshacer y debe quedar justificada para auditoría."
        onOpenChange={(open) => { if (!procesando) setAbierto(open); }}
        footer={<>
          <button onClick={() => setAbierto(false)} disabled={procesando} className="rounded-lg border border-ink/20 px-4 py-2 font-body text-sm font-medium">Cancelar</button>
          <button onClick={ejecutar} disabled={procesando || !motivo.trim() || confirmacion !== "CERRAR"} className="rounded-lg bg-status-error px-4 py-2 font-body text-sm font-semibold text-surface-primary disabled:opacity-50">{procesando ? "Cerrando..." : "Cerrar cuenta definitivamente"}</button>
        </>}
      >
        <div className="space-y-3">
          <label className="flex flex-col gap-1">
            <span className="font-body text-xs font-medium text-text-secondary">Motivo del cierre</span>
            <textarea value={motivo} onChange={(e) => setMotivo(e.target.value)} className="min-h-[88px] rounded-lg border border-ink/20 px-3 py-2 font-body text-sm" rows={3} />
          </label>
          <label className="flex flex-col gap-1 rounded-lg border border-status-error/25 bg-status-error-soft/30 p-3">
            <span className="font-body text-xs font-medium text-status-error">Escribe CERRAR para confirmar</span>
            <input type="text" value={confirmacion} onChange={(e) => setConfirmacion(e.target.value)} className="rounded-lg border border-status-error/30 px-3 py-2 font-body text-sm" />
          </label>
        </div>
      </AdminDialog>
    </>
  );
}
