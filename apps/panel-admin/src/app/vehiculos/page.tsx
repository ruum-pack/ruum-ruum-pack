"use client";

import { useEffect, useMemo, useState } from "react";
import { Aviso } from "@ruum/ui";
import { ETIQUETA_TIPO_VEHICULO } from "@ruum/shared/constants";
import type { Database } from "@ruum/shared/types";
import { listarVehiculosAdmin, type DatosVehiculosAdmin } from "@ruum/api/services";
import { crearClienteNavegador, puedeUsarDatosDemo, tieneSupabaseConfigurado } from "../../lib/supabase-browser";
import { VIAJES_DEMO } from "../../lib/datos-demo";
import { AdminPageHeader, AdminPanel } from "../admin-ui";

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
  if (completo) return { texto: "Listo", clase: "border-control/30 bg-control-soft text-control" };
  return { texto: "Revisión", clase: "border-warn/30 bg-warn-soft text-warn" };
}

function fecha(fechaIso: string | null | undefined) {
  return fechaIso ? new Date(fechaIso).toLocaleDateString("es-MX", { dateStyle: "medium" }) : "—";
}

export default function PaginaVehiculosAdmin() {
  const [datos, setDatos] = useState<DatosVehiculosAdmin>(() => vehiculosDemo());
  const [esDemo, setEsDemo] = useState(true);
  const [cargando, setCargando] = useState(true);
  const [busqueda, setBusqueda] = useState("");

  useEffect(() => {
    async function cargar() {
      if (!tieneSupabaseConfigurado()) {
        setDatos(vehiculosDemo());
        setEsDemo(true);
        setCargando(false);
        return;
      }

      try {
        setDatos(await listarVehiculosAdmin(crearClienteNavegador()));
        setEsDemo(false);
      } catch {
        if (puedeUsarDatosDemo()) {
          setDatos(vehiculosDemo());
          setEsDemo(true);
        } else {
          setDatos({ vehiculos: [], usuarios: [] });
          setEsDemo(false);
        }
      } finally {
        setCargando(false);
      }
    }

    cargar();
  }, []);

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
        etiqueta="Inventario"
        titulo="Vehículos"
        descripcion="Registro operativo de vehículos asociados a usuarios, documentación mínima, placas y clasificación tarifaria."
      />

      {esDemo && (
        <div className="mt-4">
          <Aviso tono="info">Estás viendo datos de ejemplo, no vehículos reales.</Aviso>
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
          className="flex-1 rounded-lg border border-ink/20 bg-mist px-3.5 py-2.5 font-body text-sm text-ink placeholder:text-ink/40 focus:border-route-dark focus:outline-none focus:ring-2 focus:ring-route-dark/20"
        />
        {busqueda && (
          <button onClick={() => setBusqueda("")} className="font-body text-sm text-ink/50 hover:text-ink" aria-label="Limpiar búsqueda">
            Limpiar
          </button>
        )}
      </div>

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
            {cargando ? (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-center text-ink/50">Cargando...</td>
              </tr>
            ) : vehiculosFiltrados.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-center text-ink/50">
                  {busqueda.trim() ? "No encontramos vehículos con esa búsqueda." : "No hay vehículos registrados."}
                </td>
              </tr>
            ) : (
              vehiculosFiltrados.map((vehiculo) => {
                const usuario = usuarioPorId.get(vehiculo.usuario_id);
                const documental = estadoDocumental(vehiculo);
                return (
                  <tr key={vehiculo.id}>
                    <td>
                      <p className="font-body font-semibold text-ink">{vehiculo.marca} {vehiculo.modelo} {vehiculo.anio}</p>
                      <p className="mt-1 text-xs text-ink/45">{ETIQUETA_TIPO_VEHICULO[vehiculo.tipo]}{vehiculo.color ? ` · ${vehiculo.color}` : ""}</p>
                    </td>
                    <td>
                      <p className="font-body text-sm text-ink">{usuario?.nombre ?? usuario?.razon_social ?? "Usuario sin nombre"}</p>
                      <p className="mt-1 font-mono-ruum text-[11px] text-ink/40">{usuario?.correo_facturacion ?? vehiculo.usuario_id.slice(0, 8).toUpperCase()}</p>
                    </td>
                    <td>
                      <p className="font-mono-ruum text-xs text-ink">{vehiculo.placas ?? "Sin placas"}</p>
                      <p className="mt-1 font-mono-ruum text-[11px] text-ink/40">{vehiculo.vin ?? "VIN pendiente"}</p>
                    </td>
                    <td>
                      <span className={`rounded-full border px-2.5 py-1 font-body text-xs font-semibold ${documental.clase}`}>{documental.texto}</span>
                    </td>
                    <td>
                      <p className="font-body text-sm text-ink">{vehiculo.categoria_tarifa ? ETIQUETA_CATEGORIA[vehiculo.categoria_tarifa] : "Sin categoría"}</p>
                      <p className="mt-1 text-xs text-ink/45">
                        {[vehiculo.gama ? ETIQUETA_GAMA[vehiculo.gama] : null, vehiculo.condicion ? ETIQUETA_CONDICION[vehiculo.condicion] : null].filter(Boolean).join(" · ") || "Pendiente"}
                      </p>
                    </td>
                    <td className="font-body text-sm text-ink/60">{fecha(vehiculo.creado_en)}</td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </AdminPanel>
    </main>
  );
}
