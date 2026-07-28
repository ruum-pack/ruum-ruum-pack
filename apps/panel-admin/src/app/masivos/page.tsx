"use client";

import { useEffect, useMemo, useState } from "react";
import { Aviso, Button } from "@ruum/ui";
import type { Database } from "@ruum/shared/types";
import { consultarCodigoPostalMx } from "@ruum/shared/utils";
import {
  categoriaTarifaSugeridaParaVehiculo,
  gamaSugeridaParaVehiculo,
  tipoSugeridoParaVehiculo
} from "@ruum/shared/catalogos";
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
import { calcularRutaMasiva, geocodificarDireccionMasiva, tieneMapboxMasivosConfigurado } from "../../lib/mapbox-masivos";
import { AdminPageHeader, AdminPanel } from "../admin-ui";

type Empresa = Database["public"]["Tables"]["empresas"]["Row"];
type Usuario = Database["public"]["Tables"]["usuarios"]["Row"];

type FilaCsv = Record<string, string>;
type FilaPrevalidada = {
  numero: number;
  datos: FilaTrasladoMasivoNormalizada;
  errores: string[];
  advertencias: string[];
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
  "condicion",
  "origen_codigo_postal",
  "origen_colonia",
  "origen_calle",
  "origen_numero",
  "destino_codigo_postal",
  "destino_colonia",
  "destino_calle",
  "destino_numero"
] as const;

const COLUMNAS_PLANTILLA = [
  "referencia_externa",
  "centro_costo",
  "orden_compra",
  "prioridad",
  "vehiculo_placas",
  "vehiculo_vin",
  "vehiculo_marca",
  "vehiculo_modelo",
  "vehiculo_anio",
  "vehiculo_color",
  "condicion",
  "contacto_entrega_nombre",
  "contacto_entrega_telefono",
  "contacto_recepcion_nombre",
  "contacto_recepcion_telefono",
  "origen_codigo_postal",
  "origen_colonia",
  "origen_calle",
  "origen_numero",
  "origen_referencias",
  "destino_codigo_postal",
  "destino_colonia",
  "destino_calle",
  "destino_numero",
  "destino_referencias",
  "modalidad_programacion",
  "fecha_hora_programada",
  "ventana_recoleccion",
  "ventana_entrega",
  "instrucciones_especiales"
] as const;

const COLUMNAS_TECNICAS_OPCIONALES = [
  "origen_lat",
  "origen_lng",
  "destino_lat",
  "destino_lng",
  "distancia_km",
  "tiempo_estimado_horas"
] as const;

const EJEMPLO_CSV = [
  COLUMNAS_PLANTILLA.join(","),
  [
    "FLOT-001",
    "CC-NORTE",
    "OC-45881",
    "normal",
    "ABC123",
    "",
    "Nissan",
    "Versa",
    "2024",
    "Blanco",
    "seminueva",
    "Operaciones",
    "+525500000000",
    "Recepcion",
    "+525500000001",
    "06700",
    "Roma Norte",
    "Av. Reforma",
    "100",
    "Acceso por estacionamiento",
    "04360",
    "Copilco Universidad",
    "Av. Universidad",
    "300",
    "Entregar en recepción",
    "programado",
    "2026-07-20T12:00:00-06:00",
    "2026-07-20T11:00:00-06:00",
    "2026-07-20T14:00:00-06:00",
    "Unidad prioritaria"
  ].join(",")
].join("\n");

const CAMPOS_PERMITIDOS = new Set<string>([...COLUMNAS_PLANTILLA, ...COLUMNAS_TECNICAS_OPCIONALES]);

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

function limpiar(valor: string | undefined) {
  return valor?.trim() ?? "";
}

function numeroTexto(valor: string | undefined) {
  const limpio = limpiar(valor);
  return limpio && !Number.isNaN(Number(limpio)) ? limpio : "";
}

function telefonoMx(valor: string | undefined) {
  const limpio = limpiar(valor);
  if (!limpio) return "";
  const digitos = limpio.replace(/\D/g, "");
  if (digitos.length === 10) return `+52${digitos}`;
  if (digitos.length === 12 && digitos.startsWith("52")) return `+${digitos}`;
  return limpio.startsWith("+") ? limpio : `+${digitos}`;
}

function construirDireccion(calle: string, numero: string, colonia: string, cp: string, ciudad: string, estado: string) {
  return [calle, numero, colonia, cp, ciudad, estado, "México"].map((valor) => valor.trim()).filter(Boolean).join(", ");
}

function normalizarCategoria(categoria: string | null) {
  return categoria ?? "ligero_a";
}

function normalizarGama(gama: string | null) {
  return gama ?? "entrada";
}

async function enriquecerFila(fila: FilaCsv, numero: number): Promise<FilaPrevalidada> {
  const errores: string[] = [];
  const advertencias: string[] = [];
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

  const origenCp = limpiar(fila.origen_codigo_postal);
  const destinoCp = limpiar(fila.destino_codigo_postal);
  const [origenCpDatos, destinoCpDatos] = await Promise.all([
    consultarCodigoPostalMx(origenCp, { rutaBase: "/api/codigos-postales" }),
    consultarCodigoPostalMx(destinoCp, { rutaBase: "/api/codigos-postales" })
  ]);
  if (origenCp && !origenCpDatos) advertencias.push("CP origen no encontrado en catálogo SEPOMEX");
  if (destinoCp && !destinoCpDatos) advertencias.push("CP destino no encontrado en catálogo SEPOMEX");

  const origenEstado = origenCpDatos?.estado ?? "";
  const destinoEstado = destinoCpDatos?.estado ?? "";
  const origenCiudad = origenCpDatos?.ciudades[0] ?? "";
  const destinoCiudad = destinoCpDatos?.ciudades[0] ?? "";
  const origenColonia = limpiar(fila.origen_colonia);
  const destinoColonia = limpiar(fila.destino_colonia);
  if (origenCpDatos && origenColonia && !origenCpDatos.colonias.some((colonia) => colonia.toLowerCase() === origenColonia.toLowerCase())) {
    advertencias.push("Colonia origen no coincide exactamente con el CP");
  }
  if (destinoCpDatos && destinoColonia && !destinoCpDatos.colonias.some((colonia) => colonia.toLowerCase() === destinoColonia.toLowerCase())) {
    advertencias.push("Colonia destino no coincide exactamente con el CP");
  }

  const origenDireccion = construirDireccion(limpiar(fila.origen_calle), limpiar(fila.origen_numero), origenColonia, origenCp, origenCiudad, origenEstado);
  const destinoDireccion = construirDireccion(limpiar(fila.destino_calle), limpiar(fila.destino_numero), destinoColonia, destinoCp, destinoCiudad, destinoEstado);
  let origenLat = numeroTexto(fila.origen_lat);
  let origenLng = numeroTexto(fila.origen_lng);
  let destinoLat = numeroTexto(fila.destino_lat);
  let destinoLng = numeroTexto(fila.destino_lng);
  let distanciaKm = numeroTexto(fila.distancia_km);
  let tiempoEstimadoHoras = numeroTexto(fila.tiempo_estimado_horas);

  const origenManual = origenLat && origenLng ? { lat: Number(origenLat), lng: Number(origenLng) } : null;
  const destinoManual = destinoLat && destinoLng ? { lat: Number(destinoLat), lng: Number(destinoLng) } : null;
  const [origenGeocodificado, destinoGeocodificado] = await Promise.all([
    origenManual ? Promise.resolve(origenManual) : geocodificarDireccionMasiva(origenDireccion),
    destinoManual ? Promise.resolve(destinoManual) : geocodificarDireccionMasiva(destinoDireccion)
  ]);

  if (!origenManual && origenGeocodificado) {
    origenLat = String(origenGeocodificado.lat);
    origenLng = String(origenGeocodificado.lng);
  }
  if (!destinoManual && destinoGeocodificado) {
    destinoLat = String(destinoGeocodificado.lat);
    destinoLng = String(destinoGeocodificado.lng);
  }
  if ((!origenLat || !origenLng || !destinoLat || !destinoLng) && tieneMapboxMasivosConfigurado()) {
    advertencias.push("Mapbox no resolvió coordenadas completas; operaciones deberá revisar la ruta");
  }
  if (!tieneMapboxMasivosConfigurado()) {
    advertencias.push("Mapbox no está configurado; se encolará sin coordenadas calculadas");
  }

  if (!distanciaKm || !tiempoEstimadoHoras) {
    const ruta = await calcularRutaMasiva(origenGeocodificado, destinoGeocodificado);
    if (ruta?.distanciaKm != null) distanciaKm = String(ruta.distanciaKm);
    if (ruta?.tiempoEstimadoHoras != null) tiempoEstimadoHoras = String(ruta.tiempoEstimadoHoras);
  }

  const marca = limpiar(fila.vehiculo_marca);
  const modelo = limpiar(fila.vehiculo_modelo);
  const tipoVehiculo = tipoSugeridoParaVehiculo(marca, modelo) ?? "sedan";
  const categoriaTarifa = normalizarCategoria(categoriaTarifaSugeridaParaVehiculo(marca, modelo));
  const gama = normalizarGama(gamaSugeridaParaVehiculo(marca, modelo));
  if (!tipoSugeridoParaVehiculo(marca, modelo)) advertencias.push("Clasificación vehicular sugerida por defecto; validar modelo si impacta tarifa");

  const etiquetas = [
    limpiar(fila.centro_costo) ? `Centro de costo: ${limpiar(fila.centro_costo)}` : "",
    limpiar(fila.orden_compra) ? `Orden de compra: ${limpiar(fila.orden_compra)}` : "",
    limpiar(fila.prioridad) && limpiar(fila.prioridad) !== "normal" ? `Prioridad: ${limpiar(fila.prioridad)}` : "",
    limpiar(fila.instrucciones_especiales)
  ].filter(Boolean).join(" | ");

  return {
    numero,
    errores,
    advertencias,
    datos: {
      referencia_externa: limpiar(fila.referencia_externa),
      vehiculo_placas: limpiar(fila.vehiculo_placas).toUpperCase(),
      vehiculo_vin: limpiar(fila.vehiculo_vin).toUpperCase(),
      vehiculo_marca: marca,
      vehiculo_modelo: modelo,
      vehiculo_anio: limpiar(fila.vehiculo_anio),
      vehiculo_tipo: tipoVehiculo,
      vehiculo_color: limpiar(fila.vehiculo_color),
      categoria_tarifa: categoriaTarifa,
      gama,
      condicion: limpiar(fila.condicion) || "seminueva",
      contacto_entrega_nombre: limpiar(fila.contacto_entrega_nombre),
      contacto_entrega_telefono: telefonoMx(fila.contacto_entrega_telefono),
      contacto_recepcion_nombre: limpiar(fila.contacto_recepcion_nombre),
      contacto_recepcion_telefono: telefonoMx(fila.contacto_recepcion_telefono),
      origen_direccion: origenDireccion,
      origen_ciudad: [origenCiudad, origenEstado].filter(Boolean).join(", "),
      origen_lat: origenLat,
      origen_lng: origenLng,
      origen_referencias: limpiar(fila.origen_referencias),
      destino_direccion: destinoDireccion,
      destino_ciudad: [destinoCiudad, destinoEstado].filter(Boolean).join(", "),
      destino_lat: destinoLat,
      destino_lng: destinoLng,
      destino_referencias: limpiar(fila.destino_referencias),
      instrucciones_especiales: etiquetas,
      modalidad_programacion: modalidad,
      fecha_hora_programada: limpiar(fila.fecha_hora_programada),
      tipo_pago: "al_cierre",
      tipo_ruta: origenEstado && destinoEstado && origenEstado !== destinoEstado ? "foraneo" : "local",
      ventana_recoleccion: limpiar(fila.ventana_recoleccion),
      ventana_entrega: limpiar(fila.ventana_entrega),
      tipo_servicio: fila.tipo_servicio?.trim() || "flotilla",
      motivo_servicio: "traslado_especial",
      distancia_km: distanciaKm,
      tiempo_estimado_horas: tiempoEstimadoHoras
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
    setAviso({ tono: "info", texto: `Archivo leído: ${revision.filas.length} filas. Enriqueciendo CP, clasificación y ruta...` });
    const filasParseadas = await Promise.all(revision.filas.map((fila, indice) => enriquecerFila(fila, indice + 2)));
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
                <p className="font-body text-sm font-semibold text-ink">Orden operativa CSV</p>
                <p className="mt-1 font-body text-sm text-ink/55">Máximo según rol y 5 MB. Captura vehículo, dirección humana, contactos y programación; Ruum completa CP, ruta y clasificación.</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <a
                  href="/api/plantillas/traslados-masivos"
                  download="plantilla-traslados-masivos-ruum.xlsx"
                  className="rounded-lg border border-status-info bg-status-info px-3 py-2 font-body text-sm font-semibold text-surface-primary transition-colors hover:bg-status-info/90"
                >
                  Descargar orden XLSX
                </a>
                <a
                  href={`data:text/csv;charset=utf-8,${encodeURIComponent(EJEMPLO_CSV)}`}
                  download="plantilla-traslados-masivos-ruum.csv"
                  className="rounded-lg border border-ink/15 px-3 py-2 font-body text-sm font-semibold text-text-secondary transition-colors hover:border-status-info/40 hover:text-status-info"
                >
                  Orden CSV
                </a>
              </div>
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
                          <span className="rounded-full border border-status-success/30 bg-status-success-soft px-2.5 py-1 font-body text-xs font-semibold text-status-success">
                            {fila.advertencias.length > 0 ? `Lista con ${fila.advertencias.length} alerta(s)` : "Lista"}
                          </span>
                        ) : (
                          <span className="font-body text-admin-secundario text-status-error">{fila.errores.join(", ")}</span>
                        )}
                        {fila.errores.length === 0 && fila.advertencias.length > 0 && (
                          <p className="mt-1 max-w-md font-body text-xs text-text-tertiary">{fila.advertencias.slice(0, 2).join(" · ")}</p>
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
