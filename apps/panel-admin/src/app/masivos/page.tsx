"use client";

import { useEffect, useMemo, useState } from "react";
import { Aviso, Button } from "@ruum/ui";
import type { Database } from "@ruum/shared/types";
import {
  cancelarCargaTrasladosMasivosAdmin,
  crearTrasladosMasivosAdmin,
  listarCargasTrasladosMasivosAdmin,
  listarEmpresasAdmin,
  procesarCargaTrasladosMasivosAdmin,
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
type RevisionArchivo = {
  filas: FilaCsv[];
  errores: string[];
};

const DATOS_EMPRESAS_DEMO: DatosEmpresasAdmin = {
  empresas: [],
  usuarios: [],
  traslados: [],
  vehiculos: [],
  conductores: [],
  documentos: [],
  versionesFiscales: [],
  versionesCondiciones: [],
  cambiosSensibles: []
};
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

function revisarCsv(contenido: string): RevisionArchivo {
  const lineas = contenido.replace(/^\uFEFF/, "").split(/\r?\n/).filter((linea) => linea.trim());
  if (lineas.length < 2) return { filas: [], errores: ["El archivo debe incluir encabezados y al menos una fila."] };
  const delimitador = lineas[0]!.split(";").length > lineas[0]!.split(",").length ? ";" : ",";
  const encabezados = separarCsv(lineas[0]!, delimitador).map(normalizarEncabezado);
  const desconocidas = encabezados.filter((encabezado) => !CAMPOS_PERMITIDOS.has(encabezado));
  const faltantes = COLUMNAS_REQUERIDAS.filter((columna) => !encabezados.includes(columna));
  const errores = [
    ...desconocidas.map((columna) => `Columna no permitida: ${columna}`),
    ...faltantes.map((columna) => `Columna requerida faltante: ${columna}`)
  ];

  const filas = lineas.slice(1).map((linea) => {
    const celdas = separarCsv(linea, delimitador);
    return encabezados.reduce<FilaCsv>((fila, encabezado, indice) => {
      if (CAMPOS_PERMITIDOS.has(encabezado)) fila[encabezado] = celdas[indice]?.trim() ?? "";
      return fila;
    }, {});
  });

  return { filas, errores };
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
  if (estado === "rechazada" || estado === "cancelada") return "border-status-error/25 bg-status-error-soft text-status-error";
  return "border-status-warning/40 bg-status-warning-soft text-status-warning";
}

function fecha(fechaIso: string) {
  return new Intl.DateTimeFormat("es-MX", { dateStyle: "medium", timeStyle: "short" }).format(new Date(fechaIso));
}

function progresoCarga(carga: CargaTrasladosMasivosAdmin) {
  if (carga.total_filas === 0) return 0;
  return Math.min(100, Math.round((carga.filas_procesadas / carga.total_filas) * 100));
}

function descargarCsv(nombre: string, contenido: string) {
  const enlace = document.createElement("a");
  enlace.href = `data:text/csv;charset=utf-8,${encodeURIComponent(contenido)}`;
  enlace.download = nombre;
  enlace.click();
}

async function sha256Archivo(archivo: File) {
  const buffer = await archivo.arrayBuffer();
  const hash = await crypto.subtle.digest("SHA-256", buffer);
  return Array.from(new Uint8Array(hash)).map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

const ESTADOS_TERMINALES = new Set<CargaTrasladosMasivosAdmin["estado"]>(["procesada", "procesada_con_errores", "rechazada", "cancelada"]);

export default function PaginaTrasladosMasivosAdmin() {
  const [empresasDatos, setEmpresasDatos] = useState<DatosEmpresasAdmin>(DATOS_EMPRESAS_DEMO);
  const [cargas, setCargas] = useState<CargaTrasladosMasivosAdmin[]>([]);
  const [filas, setFilas] = useState<FilaCargaTrasladosMasivosAdmin[]>([]);
  const [empresaId, setEmpresaId] = useState("");
  const [usuarioId, setUsuarioId] = useState("");
  const [nombreArchivo, setNombreArchivo] = useState("");
  const [hashArchivo, setHashArchivo] = useState("");
  const [tamanoArchivo, setTamanoArchivo] = useState(0);
  const [mimeArchivo, setMimeArchivo] = useState("text/csv");
  const [filasCsv, setFilasCsv] = useState<FilaPrevalidada[]>([]);
  const [erroresArchivo, setErroresArchivo] = useState<string[]>([]);
  const [aviso, setAviso] = useState<{ tono: "info" | "danger" | "atencion"; texto: string } | null>(null);
  const [resultado, setResultado] = useState<ResultadoCargaTrasladosMasivos | null>(null);
  const [cargando, setCargando] = useState(true);
  const [procesando, setProcesando] = useState(false);
  const [cargaActivaId, setCargaActivaId] = useState<string | null>(null);
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
  const cargaActiva = useMemo(() => cargas.find((carga) => carga.id === cargaActivaId) ?? null, [cargaActivaId, cargas]);
  const filasPorCarga = useMemo(() => {
    const mapa = new Map<string, FilaCargaTrasladosMasivosAdmin[]>();
    for (const fila of filas) mapa.set(fila.carga_id, [...(mapa.get(fila.carga_id) ?? []), fila]);
    return mapa;
  }, [filas]);

  async function leerArchivo(archivo: File | null) {
    setResultado(null);
    setAviso(null);
    setHashArchivo("");
    setTamanoArchivo(0);
    setMimeArchivo("text/csv");
    setErroresArchivo([]);
    setCargaActivaId(null);
    if (!archivo) return;
    if (!archivo.name.toLowerCase().endsWith(".csv")) {
      setAviso({ tono: "danger", texto: "El archivo debe ser CSV." });
      return;
    }
    if (archivo.size > 5 * 1024 * 1024) {
      setAviso({ tono: "danger", texto: "El archivo debe pesar máximo 5 MB." });
      return;
    }
    setNombreArchivo(archivo.name);
    setTamanoArchivo(archivo.size);
    setMimeArchivo(archivo.type || "text/csv");
    const contenido = await archivo.text();
    const revision = revisarCsv(contenido);
    const filasParseadas = revision.filas.map((fila, indice) => normalizarFila(fila, indice + 2));
    const hash = await sha256Archivo(archivo);
    setHashArchivo(hash);
    setErroresArchivo(revision.errores);
    setFilasCsv(filasParseadas);
    setAviso({
      tono: revision.errores.length > 0 ? "danger" : "info",
      texto: `Archivo leído: ${filasParseadas.length} filas. ${filasParseadas.filter((fila) => fila.errores.length === 0).length} listas para encolar.`
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
    if (erroresArchivo.length > 0) {
      setAviso({ tono: "danger", texto: "Corrige el formato del archivo antes de encolar el lote." });
      return;
    }
    if (filasConError.length > 0) {
      setAviso({ tono: "danger", texto: "Corrige las filas con error antes de enviar el lote." });
      return;
    }
    if (!hashArchivo) {
      setAviso({ tono: "danger", texto: "No se pudo calcular la huella SHA-256 del archivo." });
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
        hashArchivo,
        tamanoBytes: tamanoArchivo,
        mimeType: mimeArchivo,
        filas: filasValidas.map((fila) => fila.datos)
      });
      setResultado(respuesta);
      setCargaActivaId(respuesta.carga_id);
      setAviso({ tono: "info", texto: respuesta.reutilizada ? "Archivo ya registrado. Retomando progreso del lote existente." : "Carga validada en backend y encolada." });
      await cargar();
      await procesarCarga(respuesta.carga_id);
    } catch (error) {
      setAviso({ tono: "danger", texto: error instanceof Error ? error.message : "No se pudo procesar la carga masiva." });
    } finally {
      setProcesando(false);
    }
  }

  async function procesarCarga(cargaId: string) {
    setProcesando(true);
    setCargaActivaId(cargaId);
    try {
      let actual: ResultadoCargaTrasladosMasivos | null = null;
      for (let intento = 0; intento < 60; intento += 1) {
        actual = await procesarCargaTrasladosMasivosAdmin(crearClienteNavegador(), cargaId, 50);
        setResultado(actual);
        await cargar();
        if (ESTADOS_TERMINALES.has(actual.estado)) break;
      }
      if (actual) {
        setAviso({
          tono: actual.estado === "procesada" ? "info" : actual.estado === "procesada_con_errores" ? "atencion" : "danger",
          texto: `Carga ${actual.estado.replaceAll("_", " ")}: ${actual.filas_creadas} creadas, ${actual.filas_error} con error.`
        });
      }
    } catch (error) {
      setAviso({ tono: "danger", texto: error instanceof Error ? error.message : "No se pudo continuar el procesamiento." });
    } finally {
      setProcesando(false);
    }
  }

  async function cancelarCarga(cargaId: string) {
    try {
      await cancelarCargaTrasladosMasivosAdmin(crearClienteNavegador(), cargaId, "Cancelada desde panel antes de iniciar procesamiento");
      setAviso({ tono: "info", texto: "Carga cancelada." });
      await cargar();
    } catch (error) {
      setAviso({ tono: "danger", texto: error instanceof Error ? error.message : "No se pudo cancelar la carga." });
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
                <p className="mt-1 font-body text-sm text-ink/55">Máximo según rol y 5 MB. No incluyas precio, tarifa ni descuento.</p>
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
            {erroresArchivo.length > 0 && (
              <Aviso tono="danger">Formato inválido: {erroresArchivo.slice(0, 4).join(", ")}</Aviso>
            )}
            {hashArchivo && (
              <p className="font-mono-ruum text-admin-secundario text-text-tertiary">
                SHA-256 {hashArchivo.slice(0, 16)}... · {Math.round(tamanoArchivo / 1024)} KB · {mimeArchivo}
              </p>
            )}
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
                      <td className="font-mono-ruum text-admin-tabla">{fila.numero}</td>
                      <td>{fila.datos.referencia_externa || "Sin referencia"}</td>
                      <td>{fila.datos.vehiculo_marca} {fila.datos.vehiculo_modelo}</td>
                      <td>{fila.datos.origen_ciudad || "Origen"} → {fila.datos.destino_ciudad || "Destino"}</td>
                      <td>
                        {fila.errores.length === 0 ? (
                          <span className="rounded-full border border-status-success/30 bg-status-success-soft px-2.5 py-1 font-body text-xs font-semibold text-status-success">Lista</span>
                        ) : (
                          <span className="font-body text-admin-secundario text-status-error">{fila.errores.join(", ")}</span>
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
            <div className="flex items-center justify-between">
              <dt className="font-body text-sm text-text-secondary">Hash</dt>
              <dd className="font-mono-ruum text-xs text-ink">{hashArchivo ? `${hashArchivo.slice(0, 10)}...` : "Pendiente"}</dd>
            </div>
          </dl>
          {cargaActiva && (
            <div className="mt-4 rounded-lg border border-ink/10 p-3">
              <div className="flex items-center justify-between font-body text-sm">
                <span>{cargaActiva.estado.replaceAll("_", " ")}</span>
                <span className="font-mono-ruum">{progresoCarga(cargaActiva)}%</span>
              </div>
              <div className="mt-2 h-2 overflow-hidden rounded-full bg-ink/10">
                <div className="h-full bg-status-info" style={{ width: `${progresoCarga(cargaActiva)}%` }} />
              </div>
              <p className="mt-2 font-body text-xs text-text-tertiary">
                {cargaActiva.filas_procesadas}/{cargaActiva.total_filas} filas procesadas
              </p>
            </div>
          )}
          <Button className="mt-5 w-full" onClick={enviar} disabled={procesando || cargando || filasCsv.length === 0 || erroresArchivo.length > 0}>
            {procesando ? "Procesando..." : "Encolar y procesar"}
          </Button>
          {resultado && (
            <p className="mt-3 font-body text-sm text-text-secondary">
              Lote {resultado.carga_id.slice(0, 8).toUpperCase()} · {resultado.estado.replaceAll("_", " ")} · {resultado.filas_procesadas}/{resultado.total_filas}
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
              <th>Progreso</th>
              <th>Estado</th>
              <th>Fecha</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {cargando ? (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-center text-text-tertiary">Cargando...</td>
              </tr>
            ) : cargas.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-center text-text-tertiary">
                  No hay cargas masivas registradas.
                </td>
              </tr>
            ) : (
              cargas.map((carga) => {
                const errores = (filasPorCarga.get(carga.id) ?? []).filter((fila) => fila.estado === "error");
                return (
                  <tr key={carga.id}>
                    <td className="font-mono-ruum text-admin-tabla text-status-info">{carga.id.slice(0, 8).toUpperCase()}</td>
                    <td>
                      {carga.nombre_archivo}
                      {carga.hash_archivo && <p className="font-mono-ruum text-admin-secundario text-text-tertiary">{carga.hash_archivo.slice(0, 12)}...</p>}
                    </td>
                    <td>
                      <div className="min-w-36">
                        <div className="flex items-center justify-between font-body text-xs text-text-secondary">
                          <span>{carga.filas_procesadas}/{carga.total_filas}</span>
                          <span>{progresoCarga(carga)}%</span>
                        </div>
                        <div className="mt-1 h-2 overflow-hidden rounded-full bg-ink/10">
                          <div className="h-full bg-status-info" style={{ width: `${progresoCarga(carga)}%` }} />
                        </div>
                        <p className="mt-1 text-admin-secundario">{carga.filas_creadas} creadas · {carga.filas_error} error</p>
                      </div>
                    </td>
                    <td>
                      <span className={`rounded-full border px-2.5 py-1 font-body text-xs font-semibold ${estadoCarga(carga.estado)}`}>
                        {carga.estado.replaceAll("_", " ")}
                      </span>
                      {errores[0]?.errores[0] && <p className="mt-1 text-admin-secundario text-status-error">{errores[0].errores[0]}</p>}
                    </td>
                    <td className="font-body text-sm text-text-secondary">{fecha(carga.creado_en)}</td>
                    <td>
                      <div className="flex flex-wrap gap-2">
                        {(carga.estado === "pendiente" || carga.estado === "procesando") && (
                          <Button variant="quiet" disabled={procesando} onClick={() => void procesarCarga(carga.id)}>
                            Reanudar
                          </Button>
                        )}
                        {carga.estado === "pendiente" && (
                          <Button variant="quiet" disabled={procesando} onClick={() => void cancelarCarga(carga.id)}>
                            Cancelar
                          </Button>
                        )}
                        {carga.reporte_errores_csv && (
                          <Button variant="quiet" onClick={() => descargarCsv(`errores-${carga.id.slice(0, 8)}.csv`, carga.reporte_errores_csv ?? "")}>
                            Errores CSV
                          </Button>
                        )}
                      </div>
                    </td>
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
