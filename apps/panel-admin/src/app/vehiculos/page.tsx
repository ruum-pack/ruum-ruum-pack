"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Aviso } from "@ruum/ui";
import { ETIQUETA_TIPO_VEHICULO } from "@ruum/shared/constants";
import type { Database } from "@ruum/shared/types";
import { listarVehiculosAdmin, type DatosVehiculosAdmin } from "@ruum/api/services";
import { crearClienteNavegador, puedeUsarDatosDemo, tieneSupabaseConfigurado } from "../../lib/supabase-browser";
import { VIAJES_DEMO } from "../../lib/datos-demo";
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

function vehiculosDemo(): DatosVehiculosAdmin {
  const vehiculos = new Map<string, Vehiculo>();
  for (const traslado of VIAJES_DEMO) {
    if (!traslado.vehiculo_id || !traslado.vehiculo_tipo || !traslado.vehiculo_marca || !traslado.vehiculo_modelo || !traslado.vehiculo_anio || !traslado.usuario_id) continue;
    vehiculos.set(traslado.vehiculo_id, {
      id: traslado.vehiculo_id,
      usuario_id: traslado.usuario_id,
      tipo: traslado.vehiculo_tipo,
      marca: traslado.vehiculo_marca,
      modelo: traslado.vehiculo_modelo,
      anio: traslado.vehiculo_anio,
      color: traslado.vehiculo_color,
      placas: traslado.vehiculo_placas,
      vin: traslado.vehiculo_vin,
      alias: null,
      transmision: null,
      estado_general_declarado: null,
      fotos_urls: [],
      permiso_especial_vigente: null,
      tiene_placas: Boolean(traslado.vehiculo_placas),
      tiene_tarjeta_circulacion: Boolean(traslado.vehiculo_placas),
      tiene_verificacion: true,
      puede_circular_rodando: traslado.estado !== "traslado_fallido",
      categoria_tarifa: traslado.vehiculo_categoria_tarifa,
      gama: traslado.vehiculo_gama,
      condicion: traslado.vehiculo_condicion,
      creado_en: traslado.creado_en ?? new Date(0).toISOString()
    });
  }

  return {
    vehiculos: [...vehiculos.values()],
    usuarios: [
      { id: "demo-usuario-1", nombre: "Cliente demo 1", correo_facturacion: "cliente1@demo.ruum" } as Usuario,
      { id: "demo-usuario-2", nombre: "Cliente demo 2", correo_facturacion: "cliente2@demo.ruum" } as Usuario,
      { id: "demo-usuario-3", nombre: "Cliente demo 3", correo_facturacion: "cliente3@demo.ruum" } as Usuario
    ]
  };
}

function estadoDocumental(vehiculo: Vehiculo) {
  const completo = vehiculo.tiene_placas && vehiculo.tiene_tarjeta_circulacion && vehiculo.tiene_verificacion && vehiculo.puede_circular_rodando;
  if (completo) return { texto: "Listo", clase: "border-status-success/30 bg-status-success-soft text-status-success" };
  return { texto: "Revisión", clase: "border-status-warning/30 bg-status-warning-soft text-status-warning" };
}

function fecha(fechaIso: string | null | undefined) {
  return fechaIso ? new Date(fechaIso).toLocaleDateString("es-MX", { dateStyle: "medium" }) : "—";
}

type EstadoConexionVista = "datos_en_vivo" | "actualizando" | "sin_conexion" | "demo";

export default function PaginaVehiculosAdmin() {
  const [datos, setDatos] = useState<DatosVehiculosAdmin>(() => vehiculosDemo());
  const [esDemo, setEsDemo] = useState(true);
  const [cargando, setCargando] = useState(true);
  const [actualizandoManual, setActualizandoManual] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busqueda, setBusqueda] = useState("");
  const [estadoConexion, setEstadoConexion] = useState<EstadoConexionVista>("actualizando");
  const [ultimaActualizacion, setUltimaActualizacion] = useState<Date | null>(null);

  const cargar = useCallback(async (manual = false) => {
    if (manual) setActualizandoManual(true);
    else setCargando(true);

    if (!tieneSupabaseConfigurado()) {
      setDatos(vehiculosDemo());
      setEsDemo(true);
      setError(null);
      setEstadoConexion("demo");
      setUltimaActualizacion(new Date());
      setCargando(false);
      setActualizandoManual(false);
      return;
    }

    try {
      setError(null);
      setDatos(await listarVehiculosAdmin(crearClienteNavegador()));
      setEsDemo(false);
      setEstadoConexion("datos_en_vivo");
      setUltimaActualizacion(new Date());
    } catch {
      if (puedeUsarDatosDemo()) {
        setDatos(vehiculosDemo());
        setEsDemo(true);
        setError(null);
        setEstadoConexion("demo");
        setUltimaActualizacion(new Date());
      } else {
        setDatos({ vehiculos: [], usuarios: [] });
        setEsDemo(false);
        setError("No pudimos cargar el inventario de vehículos.");
        setEstadoConexion("sin_conexion");
      }
    } finally {
      setCargando(false);
      setActualizandoManual(false);
    }
  }, []);

  useEffect(() => {
    void cargar();
  }, [cargar]);

  const usuarioPorId = useMemo(() => new Map(datos.usuarios.map((usuario) => [usuario.id, usuario])), [datos.usuarios]);
  const vehiculosFiltrados = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    if (!q) return datos.vehiculos;
    return datos.vehiculos.filter((vehiculo) => {
      const propietario = usuarioPorId.get(vehiculo.usuario_id);
      return [
        vehiculo.marca,
        vehiculo.modelo,
        vehiculo.placas,
        vehiculo.vin,
        propietario?.nombre,
        propietario?.correo_facturacion
      ].some((valor) => valor?.toLowerCase().includes(q));
    });
  }, [busqueda, datos.vehiculos, usuarioPorId]);

  return (
    <main className="admin-page-shell">
      <AdminPageHeader
        etiqueta="Gestión"
        titulo="Vehículos"
        descripcion="Registro operativo de vehículos asociados a usuarios, documentación mínima, placas y clasificación tarifaria."
        estadoConexion={estadoConexion}
        ultimaActualizacion={ultimaActualizacion}
        tipoDatos="administrativos"
        contadorResultados={vehiculosFiltrados.length}
        accion={(
          <AdminButton variant="secondary" loading={actualizandoManual} onClick={() => void cargar(true)}>
            Actualizar
          </AdminButton>
        )}
      />

      {esDemo && (
        <div className="mt-4">
          <Aviso tono="info">Estás viendo datos de ejemplo, no vehículos reales.</Aviso>
        </div>
      )}

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
          value={busqueda}
          onChange={(event) => setBusqueda(event.target.value)}
          placeholder="Buscar por marca, modelo, placas, VIN o usuario..."
          className="flex-1 rounded-lg border border-ink/20 bg-surface-primary px-3.5 py-2.5 font-body text-sm text-ink placeholder:text-text-tertiary focus:border-focus-default focus:outline-none focus:ring-2 focus:ring-focus-default/20"
        />
        {busqueda && (
          <AdminButton variant="quiet" onClick={() => setBusqueda("")} aria-label="Limpiar búsqueda">
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
              <AdminButton variant="secondary" onClick={() => setBusqueda("")}>
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
                    <td className="font-body text-sm text-text-secondary" data-label="Alta">{fecha(vehiculo.creado_en)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </AdminPanel>
      )}
    </main>
  );
}
