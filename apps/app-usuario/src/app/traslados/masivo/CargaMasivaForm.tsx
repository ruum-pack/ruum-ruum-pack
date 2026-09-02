"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Aviso, Button } from "@ruum/ui";
import {
  COLUMNAS_PLANTILLA,
  COLUMNAS_REQUERIDAS,
  EJEMPLO_CSV_PLANTILLA,
  pLimit,
  revisarCsv,
  type FilaCsv
} from "@ruum/shared/utils";
import {
  categoriaTarifaSugeridaParaVehiculo,
  gamaSugeridaParaVehiculo,
  tipoSugeridoParaVehiculo
} from "@ruum/shared/catalogos";
import {
  crearTrasladosMasivosUsuario,
  procesarCargaTrasladosMasivosUsuario,
  type FilaTrasladoMasivoNormalizada,
  type ResultadoCargaTrasladosMasivos
} from "@ruum/api/services";
import { crearClienteNavegador, tieneSupabaseConfigurado } from "../../../lib/supabase-browser";
import { consultarCodigoPostalMx } from "../../../lib/codigos-postales";
import {
  calcularRutaMapbox,
  geocodificarDireccion,
  tieneMapboxConfigurado
} from "../../../lib/mapbox";

interface FilaPrevalidada {
  numero: number;
  datos: FilaTrasladoMasivoNormalizada;
  errores: string[];
  advertencias: string[];
}

function limpiar(v: string | undefined): string {
  return v?.trim() ?? "";
}

function numeroTexto(v: string | undefined): string {
  const limpio = limpiar(v);
  return limpio && !Number.isNaN(Number(limpio)) ? limpio : "";
}

function construirDireccionCompleta(calle: string, numero: string, colonia: string, cp: string, ciudad: string, estado: string) {
  return [calle, numero, colonia, cp, ciudad, estado, "México"].map((val) => val.trim()).filter(Boolean).join(", ");
}

async function calcularSha256(archivo: File): Promise<string> {
  const buffer = await archivo.arrayBuffer();
  const digest = await crypto.subtle.digest("SHA-256", buffer);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export function CargaMasivaForm() {
  const router = useRouter();
  const [paso, setPaso] = useState<1 | 2 | 3 | 4>(1);
  const [archivo, setArchivo] = useState<File | null>(null);
  const [analizando, setAnalizando] = useState(false);
  const [progresoGeocodificacion, setProgresoGeocodificacion] = useState<{ actual: number; total: number } | null>(null);
  const [filas, setFilas] = useState<FilaPrevalidada[]>([]);
  const [errorGeneral, setErrorGeneral] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [resultado, setResultado] = useState<ResultadoCargaTrasladosMasivos | null>(null);
  const [filtroTabla, setFiltroTabla] = useState<"todas" | "validas" | "advertencias" | "errores">("todas");

  const totalErrores = filas.filter((f) => f.errores.length > 0).length;
  const totalAdvertencias = filas.filter((f) => f.errores.length === 0 && f.advertencias.length > 0).length;
  const totalValidas = filas.filter((f) => f.errores.length === 0).length;

  // ── 1. Descarga de plantilla CSV ─────────────────────────────────────────
  const descargarPlantilla = () => {
    const blob = new Blob([EJEMPLO_CSV_PLANTILLA], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "plantilla-traslados-masivos-ruum.csv";
    link.click();
    URL.revokeObjectURL(url);
  };

  // ── 2. Descarga de errores CSV ───────────────────────────────────────────
  const descargarReporteErrores = (contenido: string) => {
    const blob = new Blob([contenido], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `reporte-errores-traslados-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  // ── 3. Procesar archivo CSV seleccionado ─────────────────────────────────
  const manejarArchivo = async (archivoSeleccionado: File) => {
    setErrorGeneral(null);
    if (!archivoSeleccionado.name.toLowerCase().endsWith(".csv")) {
      setErrorGeneral("El archivo debe tener formato .csv");
      return;
    }
    if (archivoSeleccionado.size > 5 * 1024 * 1024) {
      setErrorGeneral("El archivo no debe exceder 5 MB.");
      return;
    }

    setArchivo(archivoSeleccionado);
    setAnalizando(true);

    try {
      const texto = await archivoSeleccionado.text();
      const revision = revisarCsv(texto);

      if (revision.errores.length > 0) {
        setErrorGeneral(`Error en el formato del archivo: ${revision.errores.slice(0, 3).join(", ")}`);
        setAnalizando(false);
        return;
      }

      if (revision.filas.length === 0) {
        setErrorGeneral("El archivo no contiene filas de datos.");
        setAnalizando(false);
        return;
      }

      if (revision.filas.length > 100) {
        setErrorGeneral(`El archivo contiene ${revision.filas.length} filas. El límite por carga es de 100 traslados.`);
        setAnalizando(false);
        return;
      }

      // Enriquecimiento y geocodificación con concurrencia controlada (pLimit 3)
      const limit = pLimit(3);
      let completadas = 0;
      setProgresoGeocodificacion({ actual: 0, total: revision.filas.length });

      const tareas = revision.filas.map((fila, index) =>
        limit(async () => {
          const prevalidada = await enriquecerFilaUsuario(fila, index + 1);
          completadas += 1;
          setProgresoGeocodificacion({ actual: completadas, total: revision.filas.length });
          return prevalidada;
        })
      );

      const filasEnriquecidas = await Promise.all(tareas);
      setFilas(filasEnriquecidas);
      setPaso(2);
    } catch (err) {
      setErrorGeneral(err instanceof Error ? err.message : "Error al procesar el archivo CSV.");
    } finally {
      setAnalizando(false);
      setProgresoGeocodificacion(null);
    }
  };

  // ── 4. Enriquecer fila individual ────────────────────────────────────────
  const enriquecerFilaUsuario = async (fila: FilaCsv, numero: number): Promise<FilaPrevalidada> => {
    const errores: string[] = [];
    const advertencias: string[] = [];

    // Validar requeridos
    for (const col of COLUMNAS_REQUERIDAS) {
      if (!fila[col]?.trim()) errores.push(`${col} es requerido`);
    }
    if (!fila.vehiculo_placas?.trim() && !fila.vehiculo_vin?.trim()) {
      errores.push("Placas o VIN requeridos");
    }

    const modalidad = fila.modalidad_programacion?.trim() || "lo_antes_posible";
    if (modalidad === "programado" && !fila.fecha_hora_programada?.trim()) {
      errores.push("Fecha y hora requerida para modalidad programada");
    }

    // Consulta de código postal SEPOMEX
    const origenCp = limpiar(fila.origen_codigo_postal);
    const destinoCp = limpiar(fila.destino_codigo_postal);
    const [origenCpDatos, destinoCpDatos] = await Promise.all([
      consultarCodigoPostalMx(origenCp),
      consultarCodigoPostalMx(destinoCp)
    ]);

    if (origenCp && !origenCpDatos) advertencias.push("CP origen no encontrado en SEPOMEX");
    if (destinoCp && !destinoCpDatos) advertencias.push("CP destino no encontrado en SEPOMEX");

    const origenEstado = origenCpDatos?.estado ?? "";
    const destinoEstado = destinoCpDatos?.estado ?? "";
    const origenCiudad = origenCpDatos?.ciudades[0] ?? "";
    const destinoCiudad = destinoCpDatos?.ciudades[0] ?? "";
    const origenColonia = limpiar(fila.origen_colonia);
    const destinoColonia = limpiar(fila.destino_colonia);

    const origenDireccion = construirDireccionCompleta(
      limpiar(fila.origen_calle),
      limpiar(fila.origen_numero),
      origenColonia,
      origenCp,
      origenCiudad,
      origenEstado
    );
    const destinoDireccion = construirDireccionCompleta(
      limpiar(fila.destino_calle),
      limpiar(fila.destino_numero),
      destinoColonia,
      destinoCp,
      destinoCiudad,
      destinoEstado
    );

    let origenLat = numeroTexto(fila.origen_lat);
    let origenLng = numeroTexto(fila.origen_lng);
    let destinoLat = numeroTexto(fila.destino_lat);
    let destinoLng = numeroTexto(fila.destino_lng);
    let distanciaKm = numeroTexto(fila.distancia_km);
    let tiempoEstimadoHoras = numeroTexto(fila.tiempo_estimado_horas);

    // Geocodificación Mapbox si faltan coordenadas
    if (tieneMapboxConfigurado()) {
      try {
        const [geoOrigen, geoDestino] = await Promise.all([
          origenLat && origenLng ? null : geocodificarDireccion(origenDireccion),
          destinoLat && destinoLng ? null : geocodificarDireccion(destinoDireccion)
        ]);
        if (geoOrigen) {
          origenLat = String(geoOrigen.lat);
          origenLng = String(geoOrigen.lng);
        }
        if (geoDestino) {
          destinoLat = String(geoDestino.lat);
          destinoLng = String(geoDestino.lng);
        }

        // Calcular distancia y tiempo si faltan
        if ((!distanciaKm || !tiempoEstimadoHoras) && origenLat && origenLng && destinoLat && destinoLng) {
          const ruta = await calcularRutaMapbox(
            { lat: Number(origenLat), lng: Number(origenLng) },
            { lat: Number(destinoLat), lng: Number(destinoLng) }
          );
          if (ruta) {
            distanciaKm = String(ruta.distanciaKm);
            tiempoEstimadoHoras = String(ruta.tiempoEstimadoHoras);
          }
        }
      } catch {
        advertencias.push("No se pudo calcular la ruta Mapbox automáticamente");
      }
    }

    const marca = limpiar(fila.vehiculo_marca);
    const modelo = limpiar(fila.vehiculo_modelo);
    const tipoVehiculo = tipoSugeridoParaVehiculo(marca, modelo) ?? "sedan";
    const categoriaTarifa = categoriaTarifaSugeridaParaVehiculo(marca, modelo) ?? "ligero_a";
    const gama = gamaSugeridaParaVehiculo(marca, modelo) ?? "entrada";

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
        contacto_entrega_telefono: limpiar(fila.contacto_entrega_telefono),
        contacto_recepcion_nombre: limpiar(fila.contacto_recepcion_nombre),
        contacto_recepcion_telefono: limpiar(fila.contacto_recepcion_telefono),
        origen_direccion: origenDireccion,
        origen_ciudad: origenCiudad || "CDMX",
        origen_lat: origenLat || undefined,
        origen_lng: origenLng || undefined,
        origen_referencias: limpiar(fila.origen_referencias),
        destino_direccion: destinoDireccion,
        destino_ciudad: destinoCiudad || "CDMX",
        destino_lat: destinoLat || undefined,
        destino_lng: destinoLng || undefined,
        destino_referencias: limpiar(fila.destino_referencias),
        modalidad_programacion: modalidad,
        fecha_hora_programada: limpiar(fila.fecha_hora_programada) || undefined,
        distancia_km: distanciaKm || undefined,
        tiempo_estimado_horas: tiempoEstimadoHoras || undefined,
        instrucciones_especiales: limpiar(fila.instrucciones_especiales)
      }
    };
  };

  // ── 5. Confirmar y procesar carga en backend ─────────────────────────────
  const ejecutarCarga = async () => {
    if (!archivo || filas.length === 0) return;
    setEnviando(true);
    setErrorGeneral(null);

    try {
      if (!tieneSupabaseConfigurado()) {
        throw new Error("Supabase no está configurado.");
      }
      const cliente = crearClienteNavegador();
      const hash = await calcularSha256(archivo);

      // 1. Encolar carga en backend
      const resCreacion = await crearTrasladosMasivosUsuario(cliente, {
        nombreArchivo: archivo.name,
        filas: filas.map((f) => f.datos),
        hashArchivo: hash,
        tamanoBytes: archivo.size,
        mimeType: archivo.type || "text/csv"
      });

      // 2. Procesar lote en chunks
      let resProcesamiento = await procesarCargaTrasladosMasivosUsuario(cliente, resCreacion.carga_id, 50);

      // Si quedan pendientes, continuar procesando
      while (resProcesamiento.estado === "procesando") {
        resProcesamiento = await procesarCargaTrasladosMasivosUsuario(cliente, resCreacion.carga_id, 50);
      }

      setResultado(resProcesamiento);
      setPaso(4);
    } catch (err) {
      setErrorGeneral(err instanceof Error ? err.message : "Error al procesar la carga masiva.");
    } finally {
      setEnviando(false);
    }
  };

  const filasFiltradas = filas.filter((f) => {
    if (filtroTabla === "errores") return f.errores.length > 0;
    if (filtroTabla === "advertencias") return f.errores.length === 0 && f.advertencias.length > 0;
    if (filtroTabla === "validas") return f.errores.length === 0;
    return true;
  });

  return (
    <div className="w-full max-w-4xl mx-auto space-y-6">
      {/* Encabezado */}
      <header className="space-y-2 border-b border-[#1C2A3E]/60 pb-4">
        <div className="flex items-center justify-between">
          <Link
            href="/traslados/nuevo"
            className="text-xs font-semibold text-[#8E9CAE] hover:text-[#FFC400] transition flex items-center gap-1"
          >
            ← Volver a traslado individual
          </Link>
          <span className="text-[11px] font-mono tracking-wide uppercase px-2.5 py-1 rounded bg-[#141F32] text-[#FFC400] border border-[#FFC400]/20">
            Carga Masiva CSV
          </span>
        </div>
        <h1 className="text-xl sm:text-2xl font-bold font-display text-white">
          Creación masiva de traslados
        </h1>
        <p className="text-xs sm:text-sm font-body text-[#8E9CAE]">
          Sube un archivo CSV con hasta 100 vehículos y rutas para cotizar y programar en lote de forma segura.
        </p>
      </header>

      {/* Indicador de pasos */}
      <nav aria-label="Progreso de carga masiva" className="grid grid-cols-4 gap-2 text-center text-xs font-display">
        {[
          { num: 1, label: "1. Archivo" },
          { num: 2, label: "2. Revisión" },
          { num: 3, label: "3. Resumen" },
          { num: 4, label: "4. Resultado" }
        ].map((p) => (
          <div
            key={p.num}
            className={`py-2 rounded-lg border font-bold transition ${
              paso === p.num
                ? "border-[#FFC400] bg-[#FFC400]/10 text-[#FFC400]"
                : paso > p.num
                ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-400"
                : "border-[#1C2A3E] bg-[#0A1220] text-[#64748B]"
            }`}
          >
            {p.label}
          </div>
        ))}
      </nav>

      {errorGeneral && (
        <Aviso tono="danger" aria-live="assertive">
          {errorGeneral}
        </Aviso>
      )}

      {/* ── PASO 1: SUBIR ARCHIVO ───────────────────────────────────────── */}
      {paso === 1 && (
        <section className="space-y-6 rounded-2xl border border-[#1C2A3E] bg-[#0A1220]/95 p-6 shadow-xl">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-[#1C2A3E]/60 pb-5">
            <div>
              <h2 className="text-base font-bold text-white font-display">Plantilla recomendada</h2>
              <p className="text-xs text-[#8E9CAE] mt-0.5">
                Usa nuestra plantilla oficial con encabezados válidos y formatos de ejemplo.
              </p>
            </div>
            <Button variant="secondary" onClick={descargarPlantilla} type="button">
              Descargar plantilla CSV
            </Button>
          </div>

          <div className="space-y-3">
            <label
              htmlFor="archivo-csv"
              className="flex flex-col items-center justify-center border-2 border-dashed border-[#1C2A3E] hover:border-[#FFC400]/50 bg-[#070D18]/80 rounded-xl p-8 text-center cursor-pointer transition"
            >
              <div className="size-12 rounded-full bg-[#141F32] flex items-center justify-center text-[#FFC400] mb-3">
                <svg className="size-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                </svg>
              </div>
              <p className="text-sm font-bold text-white font-display">
                Arrastra tu archivo CSV o haz clic para seleccionarlo
              </p>
              <p className="text-xs text-[#8E9CAE] mt-1">
                Archivos .csv hasta 5 MB (máximo 100 traslados por lote)
              </p>
              <input
                id="archivo-csv"
                type="file"
                accept=".csv,text/csv"
                className="sr-only"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) void manejarArchivo(f);
                }}
              />
            </label>
          </div>

          {analizando && (
            <div className="p-4 rounded-xl border border-[#FFC400]/30 bg-[#FFC400]/5 space-y-2">
              <div className="flex items-center justify-between text-xs text-[#FFC400] font-bold">
                <span>Analizando archivo y calculando rutas...</span>
                {progresoGeocodificacion && (
                  <span>
                    {progresoGeocodificacion.actual} / {progresoGeocodificacion.total}
                  </span>
                )}
              </div>
              <div className="w-full bg-[#141F32] rounded-full h-2 overflow-hidden">
                <div
                  className="bg-[#FFC400] h-full transition-all duration-300"
                  style={{
                    width: progresoGeocodificacion
                      ? `${Math.round((progresoGeocodificacion.actual / progresoGeocodificacion.total) * 100)}%`
                      : "25%"
                  }}
                />
              </div>
            </div>
          )}
        </section>
      )}

      {/* ── PASO 2: REVISIÓN TABULAR ────────────────────────────────────── */}
      {paso === 2 && (
        <section className="space-y-6">
          {/* Métricas de revisión */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <button
              type="button"
              onClick={() => setFiltroTabla("todas")}
              className={`p-4 rounded-xl border text-left transition ${
                filtroTabla === "todas" ? "border-sky-500 bg-sky-500/10" : "border-[#1C2A3E] bg-[#0A1220]"
              }`}
            >
              <p className="text-xs text-[#8E9CAE]">Total filas</p>
              <p className="text-xl font-extrabold text-white mt-1 font-mono">{filas.length}</p>
            </button>
            <button
              type="button"
              onClick={() => setFiltroTabla("validas")}
              className={`p-4 rounded-xl border text-left transition ${
                filtroTabla === "validas" ? "border-emerald-500 bg-emerald-500/10" : "border-[#1C2A3E] bg-[#0A1220]"
              }`}
            >
              <p className="text-xs text-[#8E9CAE]">Listas para crear</p>
              <p className="text-xl font-extrabold text-emerald-400 mt-1 font-mono">{totalValidas}</p>
            </button>
            <button
              type="button"
              onClick={() => setFiltroTabla("advertencias")}
              className={`p-4 rounded-xl border text-left transition ${
                filtroTabla === "advertencias" ? "border-amber-500 bg-amber-500/10" : "border-[#1C2A3E] bg-[#0A1220]"
              }`}
            >
              <p className="text-xs text-[#8E9CAE]">Advertencias</p>
              <p className="text-xl font-extrabold text-amber-400 mt-1 font-mono">{totalAdvertencias}</p>
            </button>
            <button
              type="button"
              onClick={() => setFiltroTabla("errores")}
              className={`p-4 rounded-xl border text-left transition ${
                filtroTabla === "errores" ? "border-rose-500 bg-rose-500/10" : "border-[#1C2A3E] bg-[#0A1220]"
              }`}
            >
              <p className="text-xs text-[#8E9CAE]">Con errores</p>
              <p className="text-xl font-extrabold text-rose-400 mt-1 font-mono">{totalErrores}</p>
            </button>
          </div>

          {totalErrores > 0 && (
            <Aviso tono="atencion">
              {totalErrores} {totalErrores === 1 ? "fila contiene errores bloqueantes" : "filas contienen errores bloqueantes"}.
              Se omitirán durante la creación o puedes corregir tu archivo antes de continuar.
            </Aviso>
          )}

          {/* Tabla de filas */}
          <div className="rounded-2xl border border-[#1C2A3E] bg-[#0A1220]/95 overflow-hidden shadow-xl">
            <div className="overflow-x-auto max-h-[460px]">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="sticky top-0 bg-[#141F32] border-b border-[#1C2A3E] text-[#8E9CAE] uppercase font-mono">
                  <tr>
                    <th className="py-3 px-3">#</th>
                    <th className="py-3 px-3">Estado</th>
                    <th className="py-3 px-3">Vehículo</th>
                    <th className="py-3 px-3">Origen</th>
                    <th className="py-3 px-3">Destino</th>
                    <th className="py-3 px-3">Distancia</th>
                    <th className="py-3 px-3">Detalle</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#1C2A3E]/60 text-slate-200">
                  {filasFiltradas.map((f) => {
                    const tieneError = f.errores.length > 0;
                    const tieneAdv = f.advertencias.length > 0;
                    return (
                      <tr key={f.numero} className="hover:bg-white/5 transition">
                        <td className="py-2.5 px-3 font-mono text-[#8E9CAE]">{f.numero}</td>
                        <td className="py-2.5 px-3">
                          {tieneError ? (
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-rose-500/20 text-rose-300 border border-rose-500/30">
                              Error
                            </span>
                          ) : tieneAdv ? (
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                              Aviso
                            </span>
                          ) : (
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                              Listo
                            </span>
                          )}
                        </td>
                        <td className="py-2.5 px-3 font-medium text-white whitespace-nowrap">
                          {f.datos.vehiculo_marca} {f.datos.vehiculo_modelo} ({f.datos.vehiculo_anio})
                          <span className="block text-[11px] text-[#8E9CAE] font-mono">
                            {f.datos.vehiculo_placas || f.datos.vehiculo_vin || "Sin placa"}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 max-w-[200px] truncate" title={f.datos.origen_direccion}>
                          {f.datos.origen_direccion}
                        </td>
                        <td className="py-2.5 px-3 max-w-[200px] truncate" title={f.datos.destino_direccion}>
                          {f.datos.destino_direccion}
                        </td>
                        <td className="py-2.5 px-3 whitespace-nowrap font-mono">
                          {f.datos.distancia_km ? `${Number(f.datos.distancia_km).toFixed(1)} km` : "Pendiente"}
                        </td>
                        <td className="py-2.5 px-3 text-[11px]">
                          {tieneError ? (
                            <span className="text-rose-400">{f.errores.join("; ")}</span>
                          ) : tieneAdv ? (
                            <span className="text-amber-400">{f.advertencias.join("; ")}</span>
                          ) : (
                            <span className="text-emerald-400">Ruta lista</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          <div className="flex items-center justify-between pt-2">
            <Button variant="secondary" onClick={() => setPaso(1)} type="button">
              Cargar otro archivo
            </Button>
            <Button
              variant="primary"
              disabled={totalValidas === 0}
              onClick={() => setPaso(3)}
              type="button"
            >
              Continuar al resumen ({totalValidas} listos)
            </Button>
          </div>
        </section>
      )}

      {/* ── PASO 3: RESUMEN Y CONFIRMACIÓN ─────────────────────────────── */}
      {paso === 3 && (
        <section className="space-y-6 rounded-2xl border border-[#1C2A3E] bg-[#0A1220]/95 p-6 shadow-xl">
          <h2 className="text-lg font-bold font-display text-white border-b border-[#1C2A3E] pb-3">
            Confirmación del lote de traslados
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="p-4 rounded-xl border border-[#1C2A3E] bg-[#070D18]">
              <p className="text-xs text-[#8E9CAE]">Traslados a procesar</p>
              <p className="text-2xl font-extrabold text-[#FFC400] font-mono mt-1">{totalValidas}</p>
            </div>
            <div className="p-4 rounded-xl border border-[#1C2A3E] bg-[#070D18]">
              <p className="text-xs text-[#8E9CAE]">Archivo origen</p>
              <p className="text-sm font-semibold text-white mt-2 truncate">{archivo?.name}</p>
            </div>
            <div className="p-4 rounded-xl border border-[#1C2A3E] bg-[#070D18]">
              <p className="text-xs text-[#8E9CAE]">Filas omitidas por error</p>
              <p className="text-2xl font-extrabold text-rose-400 font-mono mt-1">{totalErrores}</p>
            </div>
          </div>

          <div className="p-4 rounded-xl border border-sky-500/30 bg-sky-500/5 text-xs text-sky-200 space-y-1">
            <p className="font-bold text-sky-400">ℹ️ Cálculo tarifario server-side</p>
            <p>
              Cada traslado se creará en estado de cotización generada con la tarifa oficial calculada en base a la
              categoría del vehículo, distancia y ventanas de tiempo.
            </p>
          </div>

          <div className="flex items-center justify-between pt-4 border-t border-[#1C2A3E]">
            <Button variant="secondary" onClick={() => setPaso(2)} type="button" disabled={enviando}>
              Volver a la tabla
            </Button>
            <Button
              variant="primary"
              loading={enviando}
              disabled={enviando || totalValidas === 0}
              onClick={ejecutarCarga}
              type="button"
            >
              Crear {totalValidas} traslados
            </Button>
          </div>
        </section>
      )}

      {/* ── PASO 4: RESULTADO Y REPORTE ─────────────────────────────────── */}
      {paso === 4 && resultado && (
        <section className="space-y-6 rounded-2xl border border-[#1C2A3E] bg-[#0A1220]/95 p-6 shadow-xl text-center">
          <div className="size-16 rounded-full bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center mx-auto text-emerald-400">
            <svg className="size-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 13l4 4L19 7" />
            </svg>
          </div>

          <div className="space-y-2">
            <h2 className="text-xl font-bold font-display text-white">
              Carga masiva procesada
            </h2>
            <p className="text-sm text-[#8E9CAE]">
              {resultado.filas_creadas} traslados fueron registrados exitosamente en tu cuenta.
            </p>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 max-w-lg mx-auto py-2">
            <div className="p-3 rounded-xl border border-[#1C2A3E] bg-[#070D18]">
              <p className="text-[11px] text-[#8E9CAE]">Creados</p>
              <p className="text-xl font-bold text-emerald-400 font-mono">{resultado.filas_creadas}</p>
            </div>
            <div className="p-3 rounded-xl border border-[#1C2A3E] bg-[#070D18]">
              <p className="text-[11px] text-[#8E9CAE]">Con error</p>
              <p className="text-xl font-bold text-rose-400 font-mono">{resultado.filas_error}</p>
            </div>
            <div className="p-3 rounded-xl border border-[#1C2A3E] bg-[#070D18] col-span-2 sm:col-span-1">
              <p className="text-[11px] text-[#8E9CAE]">Total procesados</p>
              <p className="text-xl font-bold text-white font-mono">{resultado.filas_procesadas}</p>
            </div>
          </div>

          {resultado.filas_error > 0 && (
            <div className="max-w-md mx-auto">
              <Aviso tono="atencion">
                Algunas filas no pudieron crearse. Puedes descargar el reporte de errores para corregirlas.
              </Aviso>
              <div className="mt-3">
                <Button
                  variant="secondary"
                  onClick={() => descargarReporteErrores(
                    filas
                      .filter((f) => f.errores.length > 0)
                      .map((f) => `${f.numero},"${f.datos.referencia_externa || ""}","${f.errores.join("; ")}"`)
                      .join("\n")
                  )}
                  type="button"
                >
                  Descargar reporte de errores (.csv)
                </Button>
              </div>
            </div>
          )}

          <div className="pt-4 flex flex-col sm:flex-row items-center justify-center gap-3 border-t border-[#1C2A3E]">
            <Button variant="secondary" onClick={() => { setPaso(1); setArchivo(null); setFilas([]); }} type="button">
              Cargar otro archivo
            </Button>
            <Button variant="primary" onClick={() => router.push("/mis-viajes")} type="button">
              Ver mis traslados
            </Button>
          </div>
        </section>
      )}
    </div>
  );
}
