"use client";

import { useEffect, useMemo, useState } from "react";
import { Aviso, Button } from "@ruum/ui";
import type { Database } from "@ruum/shared/types";
import {
  crearTrasladosMasivosAdmin,
  listarCargasTrasladosMasivosAdmin,
  listarEmpresasAdmin,
  type CargaTrasladosMasivosAdmin,
  type DatosEmpresasAdmin,
  type FilaCargaTrasladosMasivosAdmin,
  type FilaTrasladoMasivoNormalizada,
  type ResultadoCargaTrasladosMasivos
} from "@ruum/api/services";
import { crearClienteNavegador, puedeUsarDatosDemo, tieneSupabaseConfigurado } from "../../lib/supabase-browser";
import { AdminPageHeader, AdminPanel } from "../admin-ui";

type Empresa = Database["public"]["Tables"]["empresas"]["Row"];
type Usuario = Database["public"]["Tables"]["usuarios"]["Row"];

type FilaCsv = Record<string, string>;
type FilaPrevalidada = {
  numero: number;
  datos: FilaTrasladoMasivoNormalizada;
  errores: string[];
};

const DATOS_EMPRESAS_DEMO: DatosEmpresasAdmin = { empresas: [], usuarios: [], traslados: [] };
const COLUMNAS_REQUERIDAS = [
  "vehiculo_marca",
  "vehiculo_modelo",
  "vehiculo_anio",
  "vehiculo_tipo",
  "categoria_tarifa",
  "gama",
  "condicion",
  "origen_lat",
  "origen_lng",
  "destino_lat",
  "destino_lng"
] as const;

const COLUMNAS_PLANTILLA = [
  "referencia_externa",
  "vehiculo_placas",
  "vehiculo_vin",
  "vehiculo_marca",
  "vehiculo_modelo",
  "vehiculo_anio",
  "vehiculo_tipo",
  "vehiculo_color",
  "categoria_tarifa",
  "gama",
  "condicion",
  "contacto_entrega_nombre",
  "contacto_entrega_telefono",
  "contacto_recepcion_nombre",
  "contacto_recepcion_telefono",
  "origen_direccion",
  "origen_ciudad",
  "origen_lat",
  "origen_lng",
  "destino_direccion",
  "destino_ciudad",
  "destino_lat",
  "destino_lng",
  "modalidad_programacion",
  "fecha_hora_programada",
  "tipo_pago",
  "tipo_ruta",
  "tipo_servicio",
  "motivo_servicio",
  "distancia_km",
  "tiempo_estimado_horas",
  "instrucciones_especiales"
] as const;

const EJEMPLO_CSV = [
  COLUMNAS_PLANTILLA.join(","),
  [
    "FLOT-001",
    "ABC123",
    "",
    "Nissan",
    "Versa",
    "2024",
    "sedan",
    "Blanco",
    "ligero_a",
    "entrada",
    "seminueva",
    "Operaciones",
    "+525500000000",
    "Recepcion",
    "+525500000001",
    "Av. Reforma 100",
    "CDMX",
    "19.4326",
    "-99.1332",
    "Av. Universidad 300",
    "CDMX",
    "19.3670",
    "-99.1660",
    "programado",
    "2026-07-20T12:00:00-06:00",
    "al_cierre",
    "local",
    "flotilla",
    "traslado_especial",
    "12.4",
    "0.7",
    "Unidad prioritaria"
  ].join(",")
].join("\n");

const CAMPOS_PERMITIDOS = new Set<string>(COLUMNAS_PLANTILLA);

function normalizarEncabezado(valor: string) {
  return valor.trim().toLowerCase().replace(/\s+/g, "_");
}

function separarCsv(linea: string, delimitador: string) {
  const celdas: string[] = [];
  let actual = "";
  let entreComillas = false;

  for (let indice = 0; indice < linea.length; indice += 1) {
    const caracter = linea[indice];
    const siguiente = linea[indice + 1];
    if (caracter === '"' && siguiente === '"') {
      actual += '"';
      indice += 1;
      continue;
    }
    if (caracter === '"') {
      entreComillas = !entreComillas;
      continue;
    }
    if (caracter === delimitador && !entreComillas) {
      celdas.push(actual.trim());
      actual = "";
      continue;
    }
    actual += caracter;
  }

  celdas.push(actual.trim());
  return celdas;
}

function parsearCsv(contenido: string): FilaCsv[] {
  const lineas = contenido.replace(/^\uFEFF/, "").split(/\r?\n/).filter((linea) => linea.trim());
  if (lineas.length < 2) return [];
  const delimitador = lineas[0]!.split(";").length > lineas[0]!.split(",").length ? ";" : ",";
  const encabezados = separarCsv(lineas[0]!, delimitador).map(normalizarEncabezado);

  return lineas.slice(1).map((linea) => {
    const celdas = separarCsv(linea, delimitador);
    return encabezados.reduce<FilaCsv>((fila, encabezado, indice) => {
      if (CAMPOS_PERMITIDOS.has(encabezado)) fila[encabezado] = celdas[indice]?.trim() ?? "";
      return fila;
    }, {});
  });
}

function normalizarFila(fila: FilaCsv, numero: number): FilaPrevalidada {
  const errores: string[] = [];
  for (const columna of COLUMNAS_REQUERIDAS) {
    if (!fila[columna]?.trim()) errores.push(`${columna} requerido`);
  }
  if (!fila.vehiculo_placas?.trim() && !fila.vehiculo_vin?.trim()) errores.push("vehiculo_placas o vehiculo_vin requerido");
  for (const campo of ["origen_lat", "origen_lng", "destino_lat", "destino_lng", "distancia_km", "tiempo_estimado_horas"]) {
    if (fila[campo]?.trim() && Number.isNaN(Number(fila[campo]))) errores.push(`${campo} debe ser numérico`);
  }
  if (fila.vehiculo_anio?.trim() && Number.isNaN(Number(fila.vehiculo_anio))) errores.push("vehiculo_anio debe ser numérico");

  const modalidad = fila.modalidad_programacion?.trim() || "lo_antes_posible";
  if (modalidad === "programado" && !fila.fecha_hora_programada?.trim()) errores.push("fecha_hora_programada requerida para programado");
  if (modalidad === "lo_antes_posible" && fila.fecha_hora_programada?.trim()) errores.push("fecha_hora_programada no aplica para lo_antes_posible");

  return {
    numero,
    errores,
    datos: {
      ...fila,
      modalidad_programacion: modalidad,
      tipo_pago: fila.tipo_pago?.trim() || "al_cierre",
      tipo_ruta: fila.tipo_ruta?.trim() || "local",
      tipo_servicio: fila.tipo_servicio?.trim() || "flotilla",
      motivo_servicio: fila.motivo_servicio?.trim() || "traslado_especial"
    } as FilaTrasladoMasivoNormalizada
  };
}

function estadoCarga(estado: CargaTrasladosMasivosAdmin["estado"]) {
  if (estado === "procesada") return "border-status-success/30 bg-status-success-soft text-status-success";
  if (estado === "rechazada") return "border-status-error/25 bg-status-error-soft text-status-error";
  return "border-status-warning/40 bg-status-warning-soft text-status-warning";
}

function fecha(fechaIso: string) {
  return new Intl.DateTimeFormat("es-MX", { dateStyle: "medium", timeStyle: "short" }).format(new Date(fechaIso));
}

export default function PaginaTrasladosMasivosAdmin() {
  const [empresasDatos, setEmpresasDatos] = useState<DatosEmpresasAdmin>(DATOS_EMPRESAS_DEMO);
  const [cargas, setCargas] = useState<CargaTrasladosMasivosAdmin[]>([]);
  const [filas, setFilas] = useState<FilaCargaTrasladosMasivosAdmin[]>([]);
  const [empresaId, setEmpresaId] = useState("");
  const [usuarioId, setUsuarioId] = useState("");
  const [nombreArchivo, setNombreArchivo] = useState("");
  const [filasCsv, setFilasCsv] = useState<FilaPrevalidada[]>([]);
  const [aviso, setAviso] = useState<{ tono: "info" | "danger" | "atencion"; texto: string } | null>(null);
  const [resultado, setResultado] = useState<ResultadoCargaTrasladosMasivos | null>(null);
  const [cargando, setCargando] = useState(true);
  const [procesando, setProcesando] = useState(false);
  const [esDemo, setEsDemo] = useState(true);

  async function cargar() {
    if (!tieneSupabaseConfigurado()) {
      setEmpresasDatos(DATOS_EMPRESAS_DEMO);
      setCargas([]);
      setFilas([]);
      setEsDemo(true);
      setCargando(false);
      return;
    }

    try {
      const cliente = crearClienteNavegador();
      const [empresas, masivos] = await Promise.all([
        listarEmpresasAdmin(cliente),
        listarCargasTrasladosMasivosAdmin(cliente)
      ]);
      setEmpresasDatos(empresas);
      setCargas(masivos.cargas);
      setFilas(masivos.filas);
      setEsDemo(false);
    } catch {
      if (puedeUsarDatosDemo()) {
        setEmpresasDatos(DATOS_EMPRESAS_DEMO);
        setCargas([]);
        setFilas([]);
        setEsDemo(true);
      } else {
        setAviso({ tono: "danger", texto: "No se pudieron cargar empresas o cargas masivas." });
        setEsDemo(false);
      }
    } finally {
      setCargando(false);
    }
  }

  useEffect(() => {
    void cargar();
  }, []);

  const empresas = empresasDatos.empresas;
  const usuariosEmpresa = useMemo(
    () => empresasDatos.usuarios.filter((usuario) => usuario.empresa_id === empresaId),
    [empresaId, empresasDatos.usuarios]
  );
  const filasConError = filasCsv.filter((fila) => fila.errores.length > 0);
  const filasValidas = filasCsv.filter((fila) => fila.errores.length === 0);
  const filasPorCarga = useMemo(() => {
    const mapa = new Map<string, FilaCargaTrasladosMasivosAdmin[]>();
    for (const fila of filas) mapa.set(fila.carga_id, [...(mapa.get(fila.carga_id) ?? []), fila]);
    return mapa;
  }, [filas]);

  async function leerArchivo(archivo: File | null) {
    setResultado(null);
    setAviso(null);
    if (!archivo) return;
    setNombreArchivo(archivo.name);
    const contenido = await archivo.text();
    const filasParseadas = parsearCsv(contenido).map((fila, indice) => normalizarFila(fila, indice + 2));
    setFilasCsv(filasParseadas);
    setAviso({
      tono: "info",
      texto: `Archivo leído: ${filasParseadas.length} filas. ${filasParseadas.filter((fila) => fila.errores.length === 0).length} listas para enviar.`
    });
  }

  async function enviar() {
    setAviso(null);
    setResultado(null);
    if (!empresaId) {
      setAviso({ tono: "danger", texto: "Selecciona una empresa." });
      return;
    }
    if (!usuarioId) {
      setAviso({ tono: "danger", texto: "Selecciona el usuario solicitante." });
      return;
    }
    if (filasCsv.length === 0) {
      setAviso({ tono: "danger", texto: "Carga un CSV antes de procesar." });
      return;
    }
    if (filasConError.length > 0) {
      setAviso({ tono: "danger", texto: "Corrige las filas con error antes de enviar el lote." });
      return;
    }

    if (esDemo) {
      setAviso({ tono: "atencion", texto: "La carga masiva requiere conexión real a Supabase." });
      return;
    }

    setProcesando(true);
    try {
      const respuesta = await crearTrasladosMasivosAdmin(crearClienteNavegador(), {
        empresaId,
        usuarioId,
        nombreArchivo,
        filas: filasValidas.map((fila) => fila.datos)
      });
      setResultado(respuesta);
      setAviso({ tono: "info", texto: `Carga procesada: ${respuesta.filas_creadas} traslados creados, ${respuesta.filas_error} filas con error.` });
      setFilasCsv([]);
      await cargar();
    } catch (error) {
      setAviso({ tono: "danger", texto: error instanceof Error ? error.message : "No se pudo procesar la carga masiva." });
    } finally {
      setProcesando(false);
    }
  }

  return (
    <main className="admin-page-shell">
      <AdminPageHeader
        etiqueta="Corporativos"
        titulo="Traslados masivos"
        descripcion="Carga CSV para empresas: vehículos, origen, destino y datos operativos. Las tarifas se aplican desde la política normativa vigente."
      />

      {aviso && (
        <div className="mt-4">
          <Aviso tono={aviso.tono}>{aviso.texto}</Aviso>
        </div>
      )}

      <div className="mt-6 grid gap-4 lg:grid-cols-[minmax(0,1fr)_360px]">
        <AdminPanel>
          <div className="grid gap-4 md:grid-cols-2">
            <label className="grid gap-1.5">
              <span className="font-body text-xs font-semibold uppercase tracking-wide text-text-tertiary">Empresa</span>
              <select
                value={empresaId}
                onChange={(event) => {
                  setEmpresaId(event.target.value);
                  setUsuarioId("");
                }}
                className="rounded-lg border border-ink/20 bg-surface-primary px-3.5 py-2.5 font-body text-sm text-ink focus:border-focus-default focus:outline-none focus:ring-2 focus:ring-focus-default/20"
              >
                <option value="">Seleccionar empresa</option>
                {empresas.map((empresa: Empresa) => (
                  <option key={empresa.id} value={empresa.id}>{empresa.nombre}</option>
                ))}
              </select>
            </label>

            <label className="grid gap-1.5">
              <span className="font-body text-xs font-semibold uppercase tracking-wide text-text-tertiary">Usuario solicitante</span>
              <select
                value={usuarioId}
                onChange={(event) => setUsuarioId(event.target.value)}
                className="rounded-lg border border-ink/20 bg-surface-primary px-3.5 py-2.5 font-body text-sm text-ink focus:border-focus-default focus:outline-none focus:ring-2 focus:ring-focus-default/20"
                disabled={!empresaId}
              >
                <option value="">Seleccionar usuario</option>
                {usuariosEmpresa.map((usuario: Usuario) => (
                  <option key={usuario.id} value={usuario.id}>
                    {usuario.nombre ?? usuario.correo_facturacion ?? usuario.id.slice(0, 8).toUpperCase()} · {usuario.rol.replaceAll("_", " ")}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="mt-5 grid gap-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="font-body text-sm font-semibold text-ink">Archivo CSV</p>
                <p className="mt-1 font-body text-sm text-ink/55">Máximo 500 filas. No incluyas precio, tarifa ni descuento.</p>
              </div>
              <a
                href={`data:text/csv;charset=utf-8,${encodeURIComponent(EJEMPLO_CSV)}`}
                download="plantilla-traslados-masivos-ruum.csv"
                className="rounded-lg border border-ink/15 px-3 py-2 font-body text-sm font-semibold text-text-secondary transition-colors hover:border-status-info/40 hover:text-status-info"
              >
                Descargar plantilla
              </a>
            </div>
            <input
              type="file"
              accept=".csv,text/csv"
              onChange={(event) => void leerArchivo(event.target.files?.[0] ?? null)}
              className="rounded-lg border border-dashed border-ink/25 bg-surface-primary px-3.5 py-4 font-body text-sm text-ink file:mr-4 file:rounded-md file:border-0 file:bg-ink file:px-3 file:py-2 file:font-body file:text-sm file:font-semibold file:text-mist"
            />
          </div>

          {filasCsv.length > 0 && (
            <div className="mt-5 overflow-x-auto">
              <table className="min-w-full">
                <caption className="sr-only">Prevalidación de filas CSV</caption>
                <thead>
                  <tr>
                    <th>Fila</th>
                    <th>Referencia</th>
                    <th>Vehículo</th>
                    <th>Ruta</th>
                    <th>Estado</th>
                  </tr>
                </thead>
                <tbody>
                  {filasCsv.slice(0, 80).map((fila) => (
                    <tr key={fila.numero}>
                      <td className="font-mono-ruum text-xs">{fila.numero}</td>
                      <td>{fila.datos.referencia_externa || "Sin referencia"}</td>
                      <td>{fila.datos.vehiculo_marca} {fila.datos.vehiculo_modelo}</td>
                      <td>{fila.datos.origen_ciudad || "Origen"} → {fila.datos.destino_ciudad || "Destino"}</td>
                      <td>
                        {fila.errores.length === 0 ? (
                          <span className="rounded-full border border-status-success/30 bg-status-success-soft px-2.5 py-1 font-body text-xs font-semibold text-status-success">Lista</span>
                        ) : (
                          <span className="font-body text-xs text-status-error">{fila.errores.join(", ")}</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </AdminPanel>

        <AdminPanel>
          <p className="font-body text-xs font-semibold uppercase tracking-wide text-text-tertiary">Resumen</p>
          <dl className="mt-4 grid gap-3">
            <div className="flex items-center justify-between">
              <dt className="font-body text-sm text-text-secondary">Archivo</dt>
              <dd className="font-body text-sm font-semibold text-ink">{nombreArchivo || "Pendiente"}</dd>
            </div>
            <div className="flex items-center justify-between">
              <dt className="font-body text-sm text-text-secondary">Filas leídas</dt>
              <dd className="font-mono-ruum text-sm text-ink">{filasCsv.length}</dd>
            </div>
            <div className="flex items-center justify-between">
              <dt className="font-body text-sm text-text-secondary">Listas</dt>
              <dd className="font-mono-ruum text-sm text-status-success">{filasValidas.length}</dd>
            </div>
            <div className="flex items-center justify-between">
              <dt className="font-body text-sm text-text-secondary">Con error</dt>
              <dd className="font-mono-ruum text-sm text-status-error">{filasConError.length}</dd>
            </div>
          </dl>
          <Button className="mt-5 w-full" onClick={enviar} disabled={procesando || cargando || filasCsv.length === 0}>
            {procesando ? "Procesando..." : "Crear traslados"}
          </Button>
          {resultado && (
            <p className="mt-3 font-body text-sm text-text-secondary">
              Lote {resultado.carga_id.slice(0, 8).toUpperCase()} · {resultado.estado.replaceAll("_", " ")}
            </p>
          )}
        </AdminPanel>
      </div>

      <AdminPanel className="admin-table-card mt-6">
        <table>
          <caption className="sr-only">Historial de cargas masivas</caption>
          <thead>
            <tr>
              <th>Lote</th>
              <th>Archivo</th>
              <th>Resultado</th>
              <th>Estado</th>
              <th>Fecha</th>
            </tr>
          </thead>
          <tbody>
            {cargando ? (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-text-tertiary">Cargando...</td>
              </tr>
            ) : cargas.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-text-tertiary">
                  No hay cargas masivas registradas.
                </td>
              </tr>
            ) : (
              cargas.map((carga) => {
                const errores = (filasPorCarga.get(carga.id) ?? []).filter((fila) => fila.estado === "error");
                return (
                  <tr key={carga.id}>
                    <td className="font-mono-ruum text-xs text-status-info">{carga.id.slice(0, 8).toUpperCase()}</td>
                    <td>{carga.nombre_archivo}</td>
                    <td>{carga.filas_creadas} creadas · {carga.filas_error} error</td>
                    <td>
                      <span className={`rounded-full border px-2.5 py-1 font-body text-xs font-semibold ${estadoCarga(carga.estado)}`}>
                        {carga.estado.replaceAll("_", " ")}
                      </span>
                      {errores[0]?.errores[0] && <p className="mt-1 text-xs text-status-error">{errores[0].errores[0]}</p>}
                    </td>
                    <td className="font-body text-sm text-text-secondary">{fecha(carga.creado_en)}</td>
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
