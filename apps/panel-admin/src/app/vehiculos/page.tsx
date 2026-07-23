"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Aviso } from "@ruum/ui";
import { ETIQUETA_TIPO_VEHICULO } from "@ruum/shared/constants";
import type { Database } from "@ruum/shared/types";
import { listarVehiculosAdminPaginados, obtenerEvidenciaVehiculo, actualizarVehiculoAdmin, resolverUrlEvidencia, type DatosVehiculosAdmin, type EvidenciaVehiculoTraslado, type VehiculoActualizarAdmin } from "@ruum/api/services";
import { crearClienteNavegador, tieneSupabaseConfigurado } from "../../lib/supabase-browser";
import { AdminPageHeader, AdminPanel } from "../admin-ui";
import { AdminButton, AdminEmptyState, AdminErrorState, AdminLoadingState } from "../admin-components";

type Vehiculo = Database["public"]["Tables"]["vehiculos"]["Row"];
type Usuario = Database["public"]["Tables"]["usuarios"]["Row"];
type CategoriaTarifa = Database["public"]["Enums"]["categoria_tarifa_vehiculo"];
type GamaVehiculo = Database["public"]["Enums"]["gama_vehiculo"];
type CondicionVehiculo = Database["public"]["Enums"]["condicion_vehiculo"];

const ETIQUETA_CATEGORIA: Record<CategoriaTarifa, string> = {
  ligero_a: "Ligero A",
  ligero_b: "Ligero B",
  mediano: "Mediano",
  camion: "Camión"
};

const ETIQUETA_GAMA: Record<GamaVehiculo, string> = {
  entrada: "Entrada",
  media: "Media",
  alta: "Alta",
  premium: "Premium"
};

const ETIQUETA_CONDICION: Record<CondicionVehiculo, string> = {
  nueva: "Nueva",
  seminueva: "Seminueva",
  rescate_mecanico: "Rescate mecánico"
};

const ETIQUETA_ANGULO: Record<string, string> = {
  frente: "Frente",
  lado_piloto: "Lado piloto",
  lado_copiloto: "Lado copiloto",
  trasera: "Trasera",
  tablero: "Tablero",
  dano_previo: "Daño previo",
  adicional: "Adicional"
};

const ETIQUETA_TIPO_EVIDENCIA: Record<string, string> = {
  inicial: "Registro inicial",
  final: "Registro final"
};

function estadoDocumental(vehiculo: Vehiculo) {
  const completo = vehiculo.tiene_placas && vehiculo.tiene_tarjeta_circulacion && vehiculo.tiene_verificacion && vehiculo.puede_circular_rodando;
  if (completo) return { texto: "Listo", clase: "border-status-success/30 bg-status-success-soft text-status-success" };
  return { texto: "Revisión", clase: "border-status-warning/30 bg-status-warning-soft text-status-warning" };
}

function fechaCorta(fechaIso: string | null | undefined) {
  return fechaIso ? new Date(fechaIso).toLocaleDateString("es-MX", { dateStyle: "medium" }) : "—";
}

function fechaHora(fechaIso: string | null | undefined) {
  return fechaIso ? new Date(fechaIso).toLocaleString("es-MX") : "—";
}

type EstadoConexionVista = "datos_en_vivo" | "actualizando" | "sin_conexion" | "desactualizado";
const TAMANO_PAGINA = 25;

export default function PaginaVehiculosAdmin() {
  const [datos, setDatos] = useState<DatosVehiculosAdmin>({ vehiculos: [], usuarios: [] });
  const [cargando, setCargando] = useState(true);
  const [actualizandoManual, setActualizandoManual] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busquedaInput, setBusquedaInput] = useState("");
  const [busqueda, setBusqueda] = useState("");
  const [pagina, setPagina] = useState(1);
  const [totalResultados, setTotalResultados] = useState(0);
  const [totalPaginas, setTotalPaginas] = useState(0);
  const [estadoConexion, setEstadoConexion] = useState<EstadoConexionVista>("actualizando");
  const [ultimaActualizacion, setUltimaActualizacion] = useState<Date | null>(null);

  const [detalleVehiculoId, setDetalleVehiculoId] = useState<string | null>(null);
  const [evidencia, setEvidencia] = useState<EvidenciaVehiculoTraslado[]>([]);
  const [cargandoEvidencia, setCargandoEvidencia] = useState(false);
  const [urlsFirmadas, setUrlsFirmadas] = useState<Map<string, string>>(new Map());
  const [errorEvidencia, setErrorEvidencia] = useState<string | null>(null);

  const [editando, setEditando] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<VehiculoActualizarAdmin>({});
  const [versionEditando, setVersionEditando] = useState(0);
  const [guardando, setGuardando] = useState(false);
  const [errorEdicion, setErrorEdicion] = useState<string | null>(null);
  const [avisoGuardado, setAvisoGuardado] = useState<string | null>(null);

  const cargar = useCallback(async (manual = false, paginaSolicitada = pagina) => {
    if (manual) setActualizandoManual(true);
    else setCargando(true);

    if (!tieneSupabaseConfigurado()) {
      setDatos({ vehiculos: [], usuarios: [] });
      setError("Supabase no configurado.");
      setEstadoConexion("sin_conexion");
      setUltimaActualizacion(new Date());
      setCargando(false);
      setActualizandoManual(false);
      return;
    }

    try {
      setError(null);
      const respuesta = await listarVehiculosAdminPaginados(crearClienteNavegador(), paginaSolicitada, TAMANO_PAGINA, busqueda);
      setDatos({ vehiculos: respuesta.vehiculos, usuarios: respuesta.usuarios });
      setPagina(respuesta.paginacion.pagina);
      setTotalResultados(respuesta.paginacion.total);
      setTotalPaginas(respuesta.paginacion.total_paginas);
      setEstadoConexion("datos_en_vivo");
      setUltimaActualizacion(new Date());
    } catch {
      setError("No pudimos cargar el inventario de vehículos.");
      setEstadoConexion((estadoAnterior) => estadoAnterior === "datos_en_vivo" ? "desactualizado" : "sin_conexion");
    } finally {
      setCargando(false);
      setActualizandoManual(false);
    }
  }, [busqueda, pagina]);

  useEffect(() => {
    void cargar();
  }, [cargar]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setPagina(1);
      setBusqueda(busquedaInput.trim());
    }, 350);
    return () => window.clearTimeout(timer);
  }, [busquedaInput]);

  const usuarioPorId = useMemo(() => new Map(datos.usuarios.map((usuario) => [usuario.id, usuario])), [datos.usuarios]);
  const vehiculosFiltrados = datos.vehiculos;

  async function abrirDetalle(vehiculoId: string) {
    setDetalleVehiculoId(vehiculoId);
    setCargandoEvidencia(true);
    setErrorEvidencia(null);
    setUrlsFirmadas(new Map());
    try {
      const cliente = crearClienteNavegador();
      const evidenciaData = await obtenerEvidenciaVehiculo(cliente, vehiculoId);
      setEvidencia(evidenciaData);

      const urls = new Map<string, string>();
      for (const traslado of evidenciaData) {
        for (const foto of traslado.fotos) {
          if (foto.url) {
            const firmada = await resolverUrlEvidencia(cliente, foto.url);
            if (firmada) urls.set(foto.id, firmada);
          }
        }
      }
      setUrlsFirmadas(urls);
    } catch {
      setErrorEvidencia("No se pudo cargar la evidencia del vehículo.");
    } finally {
      setCargandoEvidencia(false);
    }
  }

  function cerrarDetalle() {
    setDetalleVehiculoId(null);
    setEvidencia([]);
    setEditando(null);
    setErrorEdicion(null);
    setAvisoGuardado(null);
  }

  function iniciarEdicion(vehiculo: Vehiculo) {
    setEditando(vehiculo.id);
    setVersionEditando((vehiculo as Vehiculo & { version?: number }).version ?? 0);
    setEditForm({
      tipo: vehiculo.tipo,
      marca: vehiculo.marca,
      modelo: vehiculo.modelo,
      anio: vehiculo.anio,
      color: vehiculo.color ?? undefined,
      placas: vehiculo.placas ?? undefined,
      vin: vehiculo.vin ?? undefined,
      transmision: vehiculo.transmision ?? undefined,
      tiene_tarjeta_circulacion: vehiculo.tiene_tarjeta_circulacion,
      tiene_verificacion: vehiculo.tiene_verificacion,
      tiene_placas: vehiculo.tiene_placas,
      puede_circular_rodando: vehiculo.puede_circular_rodando,
      permiso_especial_vigente: vehiculo.permiso_especial_vigente ?? undefined,
      estado_general_declarado: vehiculo.estado_general_declarado ?? undefined,
      categoria_tarifa: vehiculo.categoria_tarifa ?? undefined,
      gama: vehiculo.gama ?? undefined,
      condicion: vehiculo.condicion ?? undefined
    });
    setErrorEdicion(null);
    setAvisoGuardado(null);
  }

  async function guardarEdicion() {
    if (!editando) return;
    setGuardando(true);
    setErrorEdicion(null);
    setAvisoGuardado(null);
    try {
      const datosLimpios: VehiculoActualizarAdmin = {};
      for (const [key, value] of Object.entries(editForm)) {
        if (value !== undefined) {
          (datosLimpios as Record<string, unknown>)[key] = value;
        }
      }
      const cliente = crearClienteNavegador();
      await actualizarVehiculoAdmin(cliente, editando, datosLimpios, versionEditando)
      setAvisoGuardado("Vehículo actualizado correctamente.");
      setEditando(null);
      void cargar(true, pagina);
    } catch (err) {
      setErrorEdicion(err instanceof Error ? err.message : "Error al guardar los cambios.");
    } finally {
      setGuardando(false);
    }
  }

  const vehiculoDetalle = useMemo(
    () => vehiculosFiltrados.find((v) => v.id === detalleVehiculoId) ?? null,
    [detalleVehiculoId, vehiculosFiltrados]
  );
  const exportHref = `/api/exportaciones/vehiculos${busqueda ? `?busqueda=${encodeURIComponent(busqueda)}` : ""}`;

  return (
    <main className="admin-page-shell">
      <AdminPageHeader
        etiqueta="Gestión"
        titulo="Vehículos"
        descripcion="Registro operativo de vehículos asociados a usuarios, documentación mínima, placas y clasificación tarifaria."
        estadoConexion={estadoConexion}
        ultimaActualizacion={ultimaActualizacion}
        tipoDatos="administrativos"
        contadorResultados={totalResultados}
        accion={(
          <div className="flex flex-wrap gap-2">
            <a className="inline-flex items-center rounded-lg border border-ink/20 px-4 py-2 font-body text-sm font-semibold text-ink transition hover:bg-surface-secondary" href={exportHref}>
              Exportar CSV
            </a>
            <AdminButton variant="secondary" loading={actualizandoManual} onClick={() => void cargar(true, pagina)}>
              Actualizar
            </AdminButton>
          </div>
        )}
      />

      {error && (
        <div className="mt-4">
          <AdminErrorState
            description={error}
            action={(
              <AdminButton variant="secondary" onClick={() => void cargar(true)}>
                Reintentar
              </AdminButton>
            )}
          />
        </div>
      )}

      <div className="mt-4 flex items-center gap-3">
        <label className="sr-only" htmlFor="buscar-vehiculos">Buscar vehículos</label>
        <input
          id="buscar-vehiculos"
          type="search"
          value={busquedaInput}
          onChange={(event) => setBusquedaInput(event.target.value)}
          placeholder="Buscar por marca, modelo, placas, VIN o usuario..."
          className="flex-1 rounded-lg border border-ink/20 bg-surface-primary px-3.5 py-2.5 font-body text-sm text-ink placeholder:text-text-tertiary focus:border-focus-default focus:outline-none focus:ring-2 focus:ring-focus-default/20"
        />
        {(busquedaInput || busqueda) && (
          <AdminButton variant="quiet" onClick={() => { setBusquedaInput(""); setBusqueda(""); setPagina(1); }} aria-label="Limpiar búsqueda">
            Limpiar
          </AdminButton>
        )}
      </div>

      {cargando ? (
        <div className="mt-4">
          <AdminLoadingState label="Cargando vehículos" />
        </div>
      ) : vehiculosFiltrados.length === 0 ? (
        <div className="mt-4">
          <AdminEmptyState
            title={busqueda.trim() ? "Sin resultados" : "Sin vehículos"}
            description={busqueda.trim() ? "No encontramos vehículos con esa búsqueda." : "No hay vehículos registrados."}
            action={busqueda.trim() ? (
              <AdminButton variant="secondary" onClick={() => { setBusquedaInput(""); setBusqueda(""); setPagina(1); }}>
                Limpiar búsqueda
              </AdminButton>
            ) : undefined}
          />
        </div>
      ) : (
        <AdminPanel className="admin-table-card mt-4">
          <table>
            <caption className="sr-only">Lista de vehículos registrados</caption>
            <thead>
              <tr>
                <th>Vehículo</th>
                <th>Usuario</th>
                <th>Placas / VIN</th>
                <th>Documentación</th>
                <th>Tarifa</th>
                <th>Alta</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {vehiculosFiltrados.map((vehiculo) => {
                const usuario = usuarioPorId.get(vehiculo.usuario_id);
                const documental = estadoDocumental(vehiculo);
                return (
                  <tr key={vehiculo.id}>
                    <td data-label="Vehículo">
                      <p className="font-body font-semibold text-ink">{vehiculo.marca} {vehiculo.modelo} {vehiculo.anio}</p>
                      <p className="mt-1 text-xs text-text-tertiary">{ETIQUETA_TIPO_VEHICULO[vehiculo.tipo]}{vehiculo.color ? ` · ${vehiculo.color}` : ""}</p>
                    </td>
                    <td data-label="Usuario">
                      <p className="font-body text-sm text-ink">{usuario?.nombre ?? usuario?.razon_social ?? "Usuario sin nombre"}</p>
                      <p className="mt-1 font-mono-ruum text-admin-tabla text-text-tertiary">{usuario?.correo_facturacion ?? vehiculo.usuario_id.slice(0, 8).toUpperCase()}</p>
                    </td>
                    <td data-label="Placas / VIN">
                      <p className="font-mono-ruum text-xs text-ink">{vehiculo.placas ?? "Sin placas"}</p>
                      <p className="mt-1 font-mono-ruum text-admin-tabla text-text-tertiary">{vehiculo.vin ?? "VIN pendiente"}</p>
                    </td>
                    <td data-label="Documentación">
                      <span className={`rounded-full border px-2.5 py-1 font-body text-xs font-semibold ${documental.clase}`}>{documental.texto}</span>
                    </td>
                    <td data-label="Tarifa">
                      <p className="font-body text-sm text-ink">{vehiculo.categoria_tarifa ? ETIQUETA_CATEGORIA[vehiculo.categoria_tarifa] : "Sin categoría"}</p>
                      <p className="mt-1 text-xs text-text-tertiary">
                        {[vehiculo.gama ? ETIQUETA_GAMA[vehiculo.gama] : null, vehiculo.condicion ? ETIQUETA_CONDICION[vehiculo.condicion] : null].filter(Boolean).join(" · ") || "Pendiente"}
                      </p>
                    </td>
                    <td className="font-body text-sm text-text-secondary" data-label="Alta">{fechaCorta(vehiculo.creado_en)}</td>
                    <td data-label="Acciones">
                      <div className="flex gap-2">
                        <AdminButton variant="quiet" onClick={() => void abrirDetalle(vehiculo.id)}>
                          Evidencia
                        </AdminButton>
                        <AdminButton variant="quiet" onClick={() => iniciarEdicion(vehiculo)}>
                          Editar
                        </AdminButton>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border-default px-4 py-3">
            <p className="font-body text-sm text-text-secondary">
              Página {totalPaginas === 0 ? 0 : pagina} de {totalPaginas} · {totalResultados} vehículos
            </p>
            <div className="flex gap-2">
              <AdminButton
                variant="secondary"
                disabled={pagina <= 1 || actualizandoManual}
                onClick={() => {
                  const anterior = Math.max(1, pagina - 1);
                  setPagina(anterior);
                }}
              >
                Anterior
              </AdminButton>
              <AdminButton
                variant="secondary"
                disabled={pagina >= totalPaginas || actualizandoManual}
                onClick={() => {
                  const siguiente = Math.min(totalPaginas, pagina + 1);
                  setPagina(siguiente);
                }}
              >
                Siguiente
              </AdminButton>
            </div>
          </div>
        </AdminPanel>
      )}

      {detalleVehiculoId && vehiculoDetalle && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/50 pt-10">
          <div className="mx-4 mb-10 w-full max-w-3xl rounded-card border border-border-default bg-surface-primary shadow-xl">
            <div className="flex items-center justify-between border-b border-border-default px-6 py-4">
              <div>
                <h2 className="font-display text-lg font-semibold text-ink">
                  {vehiculoDetalle.marca} {vehiculoDetalle.modelo} {vehiculoDetalle.anio}
                </h2>
                <p className="font-body text-sm text-text-tertiary">
                  {vehiculoDetalle.placas ?? "Sin placas"} · VIN: {vehiculoDetalle.vin ?? "Pendiente"}
                </p>
              </div>
              <button
                type="button"
                onClick={cerrarDetalle}
                className="rounded-lg p-2 text-text-tertiary hover:bg-surface-secondary hover:text-ink"
                aria-label="Cerrar detalle"
              >
                ✕
              </button>
            </div>

            <div className="space-y-6 p-6">
              {errorEvidencia && (
                <Aviso tono="atencion">{errorEvidencia}</Aviso>
              )}

              {cargandoEvidencia ? (
                <AdminLoadingState label="Cargando evidencia del vehículo" />
              ) : evidencia.length === 0 ? (
                <div className="rounded-lg border border-border-default bg-surface-secondary p-6 text-center">
                  <p className="font-body text-sm text-text-tertiary">Este vehículo no tiene traslados con evidencia registrada.</p>
                </div>
              ) : (
                evidencia.map((traslado) => (
                  <div key={traslado.traslado_id} className="rounded-lg border border-border-default bg-surface-secondary p-4">
                    <div className="mb-3 flex items-center justify-between">
                      <p className="font-body text-sm font-semibold text-ink">
                        Traslado: {traslado.traslado_id.slice(0, 8).toUpperCase()}
                      </p>
                      <span className="rounded-full border border-ink/20 px-2.5 py-0.5 font-body text-xs font-semibold text-text-secondary">
                        {traslado.traslado_estado}
                      </span>
                    </div>
                    {traslado.fotos.length === 0 ? (
                      <p className="font-body text-xs text-text-tertiary">Sin fotos en este traslado.</p>
                    ) : (
                      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
                        {traslado.fotos.map((foto) => {
                          const url = urlsFirmadas.get(foto.id);
                          return (
                            <div key={foto.id} className="group relative rounded-lg border border-border-default bg-surface-primary p-2">
                              {url ? (
                                <a href={url} target="_blank" rel="noopener noreferrer">
                                  <img
                                    src={url}
                                    alt={`${ETIQUETA_TIPO_EVIDENCIA[foto.tipo] ?? foto.tipo} - ${ETIQUETA_ANGULO[foto.angulo] ?? foto.angulo}`}
                                    className="h-24 w-full rounded object-cover"
                                  />
                                </a>
                              ) : (
                                <div className="flex h-24 items-center justify-center rounded bg-surface-secondary text-xs text-text-tertiary">
                                  {foto.sincronizada ? "Sin URL" : "No sincronizada"}
                                </div>
                              )}
                              <div className="mt-1 text-center">
                                <p className="truncate font-body text-xs font-semibold text-ink">
                                  {ETIQUETA_ANGULO[foto.angulo] ?? foto.angulo}
                                </p>
                                <p className="font-body text-[10px] text-text-tertiary">
                                  {ETIQUETA_TIPO_EVIDENCIA[foto.tipo] ?? foto.tipo}
                                </p>
                                <p className="font-body text-[10px] text-text-tertiary">{fechaHora(foto.capturada_en)}</p>
                              </div>
                              <span className={`absolute right-3 top-3 h-2 w-2 rounded-full ${foto.sincronizada ? "bg-status-success" : "bg-status-warning"}`} title={foto.sincronizada ? "Sincronizada" : "Pendiente"} />
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {editando && vehiculoDetalle && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/50 pt-10">
          <div className="mx-4 mb-10 w-full max-w-2xl rounded-card border border-border-default bg-surface-primary shadow-xl">
            <div className="flex items-center justify-between border-b border-border-default px-6 py-4">
              <div>
                <h2 className="font-display text-lg font-semibold text-ink">Editar vehículo</h2>
                <p className="font-body text-sm text-text-tertiary">v{versionEditando} · Los cambios se auditan automáticamente</p>
              </div>
              <button
                type="button"
                onClick={() => { setEditando(null); setErrorEdicion(null); setAvisoGuardado(null); }}
                className="rounded-lg p-2 text-text-tertiary hover:bg-surface-secondary hover:text-ink"
                aria-label="Cerrar edición"
              >
                ✕
              </button>
            </div>

            <div className="space-y-4 p-6">
              {errorEdicion && (
                <Aviso tono="danger">{errorEdicion}</Aviso>
              )}
              {avisoGuardado && (
                <Aviso tono="info">{avisoGuardado}</Aviso>
              )}

              <div className="grid grid-cols-2 gap-4">
                <CampoEdicion label="Marca">
                  <input value={editForm.marca ?? ""} onChange={(e) => setEditForm((prev) => ({ ...prev, marca: e.target.value }))} className="w-full rounded-lg border border-ink/20 bg-surface-primary px-3 py-2 font-body text-sm" />
                </CampoEdicion>
                <CampoEdicion label="Modelo">
                  <input value={editForm.modelo ?? ""} onChange={(e) => setEditForm((prev) => ({ ...prev, modelo: e.target.value }))} className="w-full rounded-lg border border-ink/20 bg-surface-primary px-3 py-2 font-body text-sm" />
                </CampoEdicion>
                <CampoEdicion label="Año">
                  <input type="number" value={editForm.anio ?? ""} onChange={(e) => setEditForm((prev) => ({ ...prev, anio: Number(e.target.value) }))} className="w-full rounded-lg border border-ink/20 bg-surface-primary px-3 py-2 font-body text-sm" />
                </CampoEdicion>
                <CampoEdicion label="Color">
                  <input value={editForm.color ?? ""} onChange={(e) => setEditForm((prev) => ({ ...prev, color: e.target.value }))} className="w-full rounded-lg border border-ink/20 bg-surface-primary px-3 py-2 font-body text-sm" />
                </CampoEdicion>
                <CampoEdicion label="Placas">
                  <input value={editForm.placas ?? ""} onChange={(e) => setEditForm((prev) => ({ ...prev, placas: e.target.value }))} className="w-full rounded-lg border border-ink/20 bg-surface-primary px-3 py-2 font-body text-sm" />
                </CampoEdicion>
                <CampoEdicion label="VIN">
                  <input value={editForm.vin ?? ""} onChange={(e) => setEditForm((prev) => ({ ...prev, vin: e.target.value }))} className="w-full rounded-lg border border-ink/20 bg-surface-primary px-3 py-2 font-body text-sm" />
                </CampoEdicion>
              </div>

              <div className="border-t border-border-default pt-4">
                <p className="mb-3 font-body text-sm font-semibold text-ink">Documentación</p>
                <div className="grid grid-cols-2 gap-3">
                  <CheckboxField label="Tarjeta de circulación" checked={editForm.tiene_tarjeta_circulacion ?? false} onChange={(v) => setEditForm((prev) => ({ ...prev, tiene_tarjeta_circulacion: v }))} />
                  <CheckboxField label="Verificación" checked={editForm.tiene_verificacion ?? false} onChange={(v) => setEditForm((prev) => ({ ...prev, tiene_verificacion: v }))} />
                  <CheckboxField label="Placas" checked={editForm.tiene_placas ?? false} onChange={(v) => setEditForm((prev) => ({ ...prev, tiene_placas: v }))} />
                  <CheckboxField label="Puede circular rodando" checked={editForm.puede_circular_rodando ?? false} onChange={(v) => setEditForm((prev) => ({ ...prev, puede_circular_rodando: v }))} />
                </div>
              </div>

              <div className="flex items-center justify-between border-t border-border-default pt-4">
                <p className="font-body text-xs text-text-tertiary">
                  Versión actual: {versionEditando} · Se incrementará al guardar
                </p>
                <div className="flex gap-2">
                  <AdminButton variant="secondary" onClick={() => { setEditando(null); setErrorEdicion(null); }}>Cancelar</AdminButton>
                  <AdminButton loading={guardando} onClick={() => void guardarEdicion()}>Guardar cambios</AdminButton>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

function CampoEdicion({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block font-body text-xs font-semibold text-text-tertiary">{label}</span>
      {children}
    </label>
  );
}

function CheckboxField({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex items-center gap-2 rounded-lg border border-ink/20 px-3 py-2.5 hover:bg-surface-secondary">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="h-4 w-4 rounded border-ink/30 text-signal focus:ring-signal/30" />
      <span className="font-body text-sm text-ink">{label}</span>
    </label>
  );
}
