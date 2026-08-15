"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Aviso } from "@ruum/ui";
import { TEXTOS_CARGANDO } from "@ruum/shared/constants";
import type { AnguloEvidencia, FotoEvidencia, TipoEvidencia } from "@ruum/shared/types";
import { traducirErrorOperativo } from "@ruum/shared/utils";
import { crearClienteNavegador, tieneSupabaseConfigurado } from "../../../../lib/supabase-browser";
import { esNativo } from "../../../../lib/capacitor";
import { capturarFoto, seleccionarFotoGaleria } from "../../../../lib/camara";
import {
  obtenerPasaporteDigital,
  obtenerEvidenciaDeTraslado,
  confirmarEvidenciaCompleta,
  firmarUrlsEvidencia
} from "@ruum/api/services";
import { useEvidenceQueue } from "./useEvidenceQueue";

type EstadoTraslado = "pendiente_de_conductor" | "conductor_asignado" | "conductor_en_camino_al_origen" | "conductor_en_punto_de_recoleccion" | "verificacion_vehiculo_en_proceso" | "evidencia_inicial_en_proceso" | "traslado_en_curso" | "llegada_a_destino" | "evidencia_final_en_proceso" | "servicio_cerrado";

// Map trip state to evidence type
function tipoEvidenciaPorEstado(estado: EstadoTraslado): TipoEvidencia | null {
  if (["conductor_en_punto_de_recoleccion", "verificacion_vehiculo_en_proceso", "evidencia_inicial_en_proceso"].includes(estado)) {
    return "inicial";
  }
  if (["llegada_a_destino", "evidencia_final_en_proceso"].includes(estado)) {
    return "final";
  }
  return null;
}

export default function PaginaEvidencia() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const inputArchivoRef = useRef<HTMLInputElement | null>(null);
  const anguloArchivoRef = useRef<AnguloEvidencia | null>(null);

  const [estadoActual, setEstadoActual] = useState<EstadoTraslado | null>(null);
  const [pasaporte, setPasaporte] = useState<any>(null);
  const [tipo, setTipo] = useState<TipoEvidencia | null>(null);
  const [soporteAbierto, setSoporteAbierto] = useState(false);
  
  // Inspeccion Form Values
  const [kilometraje, setKilometraje] = useState("48,213");
  const [gasolinaSegments, setGasolinaSegments] = useState(4); // default 4/8 (1/2)
  const [llavesCount, setLlavesCount] = useState(2);
  const [tarjetaCirculacion, setTarjetaCirculacion] = useState("si");
  const [talonVerificacion, setTalonVerificacion] = useState("no");
  const [hologramaVerificacion, setHologramaVerificacion] = useState("no");
  const [placaDelantera, setPlacaDelantera] = useState("si");
  const [placaTrasera, setPlacaTrasera] = useState("no");
  const [notas, setNotas] = useState("Vehículo con rayón leve en puerta trasera derecha, ya documentado en fotografía. Sin faltantes visibles. Entrega conforme.");

  // Uploaded photos
  const [fotos, setFotos] = useState<FotoEvidencia[]>([]);
  const [cargando, setCargando] = useState(true);
  const [enviando, setEnviando] = useState<AnguloEvidencia | "guardar" | "confirmar" | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [avisoExito, setAvisoExito] = useState<string | null>(null);
  const [procesando, setProcesando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const {
    cargarPendientesLocales,
    drenarColaPendiente,
    registrarFotoEnCola
  } = useEvidenceQueue({ trasladoId: id, tipo });

  const totalRequisitos = 12; // 6 photos + 1 mileage + 5 documents/plates

  // Calculate progress count
  const fotosCapturadas = fotos.length;
  const docsCapturados = [tarjetaCirculacion, talonVerificacion, hologramaVerificacion, placaDelantera, placaTrasera].filter((v) => v === "si").length;
  const totalCapturados = fotosCapturadas + docsCapturados + (kilometraje ? 1 : 0);

  const origen = pasaporte?.origen_ciudad || "San Mateo Atenco";
  const folio = pasaporte?.traslado_id?.slice(0, 8).toUpperCase() || id.slice(0, 8).toUpperCase();

  // Load inspection from database
  const loadInspeccion = useCallback(async (tipoEvidencia: TipoEvidencia) => {
    const cliente = crearClienteNavegador();
    const { data, error } = await cliente
      .from("evidencia_inspecciones")
      .select("*")
      .eq("traslado_id", id)
      .eq("tipo", tipoEvidencia)
      .maybeSingle();

    if (error) throw error;
    if (data) {
      if (data.kilometraje !== null) {
        setKilometraje(data.kilometraje.toLocaleString("es-MX"));
      }
      setLlavesCount(Number(data.llaves_recibidas) || 2);
      setTarjetaCirculacion(data.tarjeta_circulacion || "no");
      setTalonVerificacion(data.talon_verificacion || "no");
      setHologramaVerificacion(data.holograma_verificacion ? "si" : "no");
      setPlacaDelantera(data.placa_delantera || "no");
      setPlacaTrasera(data.placa_trasera || "no");
      setNotas(data.notas || "");

      // Fuel map to segments
      if (data.combustible) {
        if (data.combustible === "Lleno") setGasolinaSegments(8);
        else if (data.combustible === "3/4") setGasolinaSegments(6);
        else if (data.combustible === "1/2") setGasolinaSegments(4);
        else if (data.combustible === "1/4") setGasolinaSegments(2);
        else if (data.combustible === "Reserva") setGasolinaSegments(1);
      }
    }
  }, [id]);

  const refrescarEvidencia = useCallback(async (tipoEvidencia: TipoEvidencia) => {
    const cliente = crearClienteNavegador();
    const [remotas, locales] = await Promise.all([
      obtenerEvidenciaDeTraslado(cliente, id, tipoEvidencia),
      cargarPendientesLocales()
    ]);
    const remotasFirmadas = await firmarUrlsEvidencia(cliente, remotas);
    setFotos([
      ...remotasFirmadas,
      ...locales.filter(
        (local) => local.tipo === tipoEvidencia && !remotasFirmadas.some((remota) => remota.id === local.id)
      )
    ]);
  }, [cargarPendientesLocales, id]);

  useEffect(() => {
    async function init() {
      if (!tieneSupabaseConfigurado()) {
        setAviso("Supabase no está configurado.");
        setCargando(false);
        return;
      }
      try {
        const cliente = crearClienteNavegador();
        const p = await obtenerPasaporteDigital(cliente, id);
        if (p) {
          setPasaporte(p);
          setEstadoActual(p.estado as EstadoTraslado);
          const t = tipoEvidenciaPorEstado(p.estado as EstadoTraslado) || "inicial";
          setTipo(t);
          await Promise.all([loadInspeccion(t), refrescarEvidencia(t)]);
        }
      } catch (err) {
        setAviso(traducirErrorOperativo(err, "No pudimos cargar la información de evidencias."));
      } finally {
        setCargando(false);
      }
    }
    init();
  }, [id, loadInspeccion, refrescarEvidencia]);

  // Handle local file selection
  async function registrarFotoLocal(angulo: AnguloEvidencia, dataUrl: string) {
    if (!tipo) return;
    setEnviando(angulo);
    setError(null);
    setAviso(null);
    try {
      const locales = await registrarFotoEnCola({ angulo, dataUrl });
      setFotos((prev) => [
        ...prev.filter((foto) => !locales.some((local) => local.id === foto.id)),
        ...locales.filter((local) => local.tipo === tipo)
      ]);
      setAvisoExito(`Fotografía "${angulo}" registrada localmente.`);
      void drenarCola();
    } catch (err) {
      setError(traducirErrorOperativo(err, "No pudimos guardar la fotografía."));
    } finally {
      setEnviando(null);
    }
  }

  const drenarCola = useCallback(async () => {
    if (!tipo) return;
    try {
      const subidas = await drenarColaPendiente();
      if (!subidas) return;
      await refrescarEvidencia(tipo);
      setAvisoExito(`${subidas} foto${subidas === 1 ? "" : "s"} sincronizada${subidas === 1 ? "" : "s"}.`);
    } catch (err) {
      setError(traducirErrorOperativo(err, "No pudimos sincronizar las fotos pendientes."));
    }
  }, [drenarColaPendiente, refrescarEvidencia, tipo]);

  useEffect(() => {
    if (!tipo) return;
    const timer = setTimeout(() => {
      void drenarCola();
    }, 500);
    return () => clearTimeout(timer);
  }, [tipo, drenarCola]);

  async function capturar(angulo: AnguloEvidencia) {
    if (esNativo()) {
      try {
        const foto = await capturarFoto();
        if (foto?.dataUrl) {
          await registrarFotoLocal(angulo, foto.dataUrl);
        }
      } catch (err) {
        setError(traducirErrorOperativo(err, "Error al tomar fotografía."));
      }
    } else {
      anguloArchivoRef.current = angulo;
      inputArchivoRef.current?.click();
    }
  }

  async function procesarArchivoSeleccionado(archivo: File | undefined) {
    const angulo = anguloArchivoRef.current;
    if (!archivo || !angulo) return;
    try {
      const reader = new FileReader();
      reader.onload = async () => {
        if (reader.result) {
          await registrarFotoLocal(angulo, String(reader.result));
        }
      };
      reader.readAsDataURL(archivo);
    } catch (err) {
      setError("No se pudo leer el archivo seleccionado.");
    } finally {
      anguloArchivoRef.current = null;
      if (inputArchivoRef.current) inputArchivoRef.current.value = "";
    }
  }

  // Get fuel text value based on segments count
  function getFuelText(segments: number) {
    if (segments >= 8) return "Lleno";
    if (segments >= 6) return "3/4";
    if (segments >= 4) return "1/2";
    if (segments >= 2) return "1/4";
    return "Reserva";
  }

  async function guardarBorrador() {
    if (!tipo) return;
    setEnviando("guardar");
    setError(null);
    setAviso(null);
    setAvisoExito(null);

    const cleanKilometraje = Number(kilometraje.replace(/[^0-9]/g, ""));

    try {
      const cliente = crearClienteNavegador();
      const { error: upsertError } = await cliente.from("evidencia_inspecciones").upsert(
        {
          traslado_id: id,
          tipo,
          combustible: getFuelText(gasolinaSegments),
          kilometraje: cleanKilometraje || null,
          llaves_recibidas: String(llavesCount),
          holograma_verificacion: hologramaVerificacion === "si",
          talon_verificacion: talonVerificacion,
          tarjeta_circulacion: tarjetaCirculacion,
          placa_delantera: placaDelantera,
          placa_trasera: placaTrasera,
          notas: notas.trim() || null
        },
        { onConflict: "traslado_id,tipo" }
      );

      if (upsertError) throw upsertError;
      setAvisoExito("Borrador guardado exitosamente.");
    } catch (err) {
      setError(traducirErrorOperativo(err, "No pudimos guardar el borrador."));
    } finally {
      setEnviando(null);
    }
  }

  async function finalizar() {
    if (!tipo) return;
    setEnviando("confirmar");
    setError(null);
    setAviso(null);
    setAvisoExito(null);

    // Validate that required photos are present
    const requiredAngles: AnguloEvidencia[] = ["frente", "lado_piloto", "lado_copiloto", "trasera", "tablero"];
    const missingPhotos = requiredAngles.filter(
      (angle) => !fotos.some((f) => f.angulo === angle)
    );

    if (missingPhotos.length > 0) {
      setError(`Falta registrar fotografías obligatorias: ${missingPhotos.join(", ")}.`);
      setEnviando(null);
      return;
    }

    try {
      // First save current inspection
      const cleanKilometraje = Number(kilometraje.replace(/[^0-9]/g, ""));
      const cliente = crearClienteNavegador();
      const { error: upsertError } = await cliente.from("evidencia_inspecciones").upsert(
        {
          traslado_id: id,
          tipo,
          combustible: getFuelText(gasolinaSegments),
          kilometraje: cleanKilometraje || null,
          llaves_recibidas: String(llavesCount),
          holograma_verificacion: hologramaVerificacion === "si",
          talon_verificacion: talonVerificacion,
          tarjeta_circulacion: tarjetaCirculacion,
          placa_delantera: placaDelantera,
          placa_trasera: placaTrasera,
          notas: notas.trim() || null
        },
        { onConflict: "traslado_id,tipo" }
      );

      if (upsertError) throw upsertError;

      // Call API to complete evidence
      await confirmarEvidenciaCompleta(cliente, id, estadoActual || "evidencia_inicial_en_proceso", tipo);
      setAvisoExito("Evidencias completadas y enviadas con éxito.");
      setTimeout(() => {
        router.push(`/viajes/${id}`);
      }, 1500);
    } catch (err) {
      setError(traducirErrorOperativo(err, "No pudimos finalizar el registro de evidencias."));
    } finally {
      setEnviando(null);
    }
  }

  const isPhotoCaptured = (angulo: AnguloEvidencia) => fotos.some((f) => f.angulo === angulo);

  if (cargando) {
    return (
      <div className="mx-auto w-full max-w-md px-6 py-20 text-center text-text-primary">
        <div className="w-8 h-8 border-4 border-[#00B4D8] border-t-transparent rounded-full animate-spin mx-auto mb-4" />
        <p className="font-body text-sm font-semibold">Cargando checklist de evidencias...</p>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-md px-4 py-6 sm:px-6 sm:py-10 flex flex-col justify-between min-h-screen text-text-primary">
      
      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        .animate-fade-in {
          animation: fadeIn 0.3s ease-out forwards;
        }
      ` }} />

      <div className="w-full flex flex-col flex-1 animate-fade-in pb-20">
        
        {/* Top Navbar Header */}
        <header className="flex justify-between items-center pb-4 border-b border-border/20">
          <div className="flex items-center gap-2">
            <span className="font-display text-lg font-black tracking-tight text-white">
              ruum<span className="text-[#00B4D8]">ruum</span>
            </span>
            <div className="bg-[#1C2C24] border border-[#234D37] px-2 py-0.5 rounded-md">
              <span className="font-display text-[9px] font-black text-[#00B4D8] tracking-wider">CONDUCTOR</span>
            </div>
          </div>
          
          <div className="flex items-center gap-3 shrink-0">
            <button 
              type="button" 
              onClick={() => setSoporteAbierto(true)}
              className="p-1.5 text-text-primary hover:text-signal transition-colors cursor-pointer bg-transparent border-none outline-hidden" 
              aria-label="Soporte rápido"
            >
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-text-secondary hover:text-text-primary transition-colors">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
              </svg>
            </button>
            <Link 
              href="/cuenta" 
              className="p-1.5 text-text-secondary hover:text-text-primary transition-colors shrink-0" 
              aria-label="Ajustes de cuenta"
            >
              <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
                <path d="M19.14 12.94c.04-.3.06-.61.06-.94 0-.32-.02-.64-.07-.94l2.03-1.58c.18-.14.23-.41.12-.61l-1.92-3.32c-.12-.22-.37-.29-.59-.22l-2.39.96c-.5-.38-1.03-.7-1.62-.94l-.36-2.54c-.04-.24-.24-.41-.48-.41h-3.84c-.24 0-.43.17-.47.41l-.36 2.54c-.59.24-1.13.57-1.62.94l-2.39-.96c-.22-.08-.47 0-.59.22L2.74 8.87c-.12.21-.08.47.12.61l2.03 1.58c-.05.3-.09.63-.09.94s.02.64.07.94l-2.03 1.58c-.18.14-.23.41-.12.61l1.92 3.32.12.22.37.29.59.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.05.24.24.41.48.41h3.84c.24 0 .44-.17.47-.41l.36-2.54c.59-.24 1.13-.56 1.62-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32c.12-.22.07-.47-.12-.61l-2.01-1.58zM12 15.6c-1.98 0-3.6-1.62-3.6-3.6s1.62-3.6 3.6-3.6 3.6 1.62 3.6 3.6-1.62 3.6-3.6 3.6z" />
              </svg>
            </Link>
          </div>
        </header>

        {/* Step Breadcrumbs Tracker */}
        <div className="mt-6 flex flex-col gap-1">
          <span className="font-body text-[10px] text-text-tertiary font-bold tracking-wide">
            Traslados › {tipo === "inicial" ? origen : (pasaporte?.destino_ciudad || "Destino")} › <span className="text-text-primary">Paso 2 de 2</span>
          </span>
          <span className="font-display text-[9px] font-black text-[#00B4D8] tracking-widest uppercase mt-0.5">
            {tipo === "inicial" ? "RECOLECCIÓN DE UNIDAD" : "ENTREGA DE UNIDAD"}
          </span>
          <h1 className="font-display text-2xl font-black text-text-primary leading-tight mt-1">
            {tipo === "inicial" ? "Evidencias Iniciales" : "Evidencias de Destino"}
          </h1>
          <p className="font-body text-xs text-text-secondary leading-relaxed mt-1">
            {tipo === "inicial" 
              ? "Captura las fotografías y datos del vehículo antes de iniciar el traslado." 
              : "Captura las fotografías y datos del vehículo en el punto de entrega de destino."}
          </p>
        </div>

        {/* Progress Bar Container */}
        <div className="mt-4 flex flex-col gap-1.5">
          <div className="w-full bg-surface-elevated/45 rounded-full h-2 overflow-hidden border border-border/20 relative">
            <div 
              className="bg-[#00B4D8] h-full transition-all duration-300"
              style={{ width: `${(totalCapturados / totalRequisitos) * 100}%` }}
            />
          </div>
          <span className="self-end font-body text-[10px] text-text-tertiary font-bold">
            {totalCapturados} / {totalRequisitos} capturadas
          </span>
        </div>

        {/* Section 1: FOTOGRAFÍAS DEL VEHÍCULO */}
        <section className="mt-8 flex flex-col gap-3">
          <div className="flex items-center gap-2">
            <span className="w-5 h-5 rounded-md bg-[#1C2C24] border border-[#234D37] text-[#00B4D8] flex items-center justify-center font-display text-[10px] font-bold">
              1
            </span>
            <h2 className="font-display text-xs font-black text-text-tertiary tracking-widest uppercase">
              FOTOGRAFÍAS DEL VEHÍCULO
            </h2>
          </div>

          <div className="grid grid-cols-3 gap-2.5">
            {/* Frente */}
            <button
              type="button"
              onClick={() => capturar("frente")}
              className={`relative rounded-xl border p-4 flex flex-col items-center justify-center gap-2 aspect-square cursor-pointer transition-all select-none ${
                isPhotoCaptured("frente")
                  ? "bg-[#1C2C24]/10 border-[#0D6E4B]/80"
                  : "bg-surface-elevated/20 border-border/40 border-dashed hover:border-[#00B4D8]/60"
              }`}
            >
              {isPhotoCaptured("frente") && (
                <span className="absolute top-1.5 right-1.5 w-4 h-4 rounded-full bg-emerald-600 border border-emerald-500/30 flex items-center justify-center text-[8px] text-white">✓</span>
              )}
              <span className="text-xl">📷</span>
              <span className="font-body text-[10px] font-bold text-text-secondary">Frente</span>
            </button>

            {/* Lado piloto */}
            <button
              type="button"
              onClick={() => capturar("lado_piloto")}
              className={`relative rounded-xl border p-4 flex flex-col items-center justify-center gap-2 aspect-square cursor-pointer transition-all select-none ${
                isPhotoCaptured("lado_piloto")
                  ? "bg-[#1C2C24]/10 border-[#0D6E4B]/80"
                  : "bg-surface-elevated/20 border-border/40 border-dashed hover:border-[#00B4D8]/60"
              }`}
            >
              {isPhotoCaptured("lado_piloto") && (
                <span className="absolute top-1.5 right-1.5 w-4 h-4 rounded-full bg-emerald-600 border border-emerald-500/30 flex items-center justify-center text-[8px] text-white">✓</span>
              )}
              <span className="text-xl">📷</span>
              <span className="font-body text-[10px] font-bold text-text-secondary">Lado piloto</span>
            </button>

            {/* Lado copiloto */}
            <button
              type="button"
              onClick={() => capturar("lado_copiloto")}
              className={`relative rounded-xl border p-4 flex flex-col items-center justify-center gap-2 aspect-square cursor-pointer transition-all select-none ${
                isPhotoCaptured("lado_copiloto")
                  ? "bg-[#1C2C24]/10 border-[#0D6E4B]/80"
                  : "bg-surface-elevated/20 border-border/40 border-dashed hover:border-[#00B4D8]/60"
              }`}
            >
              {isPhotoCaptured("lado_copiloto") && (
                <span className="absolute top-1.5 right-1.5 w-4 h-4 rounded-full bg-emerald-600 border border-emerald-500/30 flex items-center justify-center text-[8px] text-white">✓</span>
              )}
              <span className="text-xl">📷</span>
              <span className="font-body text-[10px] font-bold text-text-secondary">Lado copiloto</span>
            </button>

            {/* Trasera */}
            <button
              type="button"
              onClick={() => capturar("trasera")}
              className={`relative rounded-xl border p-4 flex flex-col items-center justify-center gap-2 aspect-square cursor-pointer transition-all select-none ${
                isPhotoCaptured("trasera")
                  ? "bg-[#1C2C24]/10 border-[#0D6E4B]/80"
                  : "bg-surface-elevated/20 border-border/40 border-dashed hover:border-[#00B4D8]/60"
              }`}
            >
              {isPhotoCaptured("trasera") && (
                <span className="absolute top-1.5 right-1.5 w-4 h-4 rounded-full bg-emerald-600 border border-emerald-500/30 flex items-center justify-center text-[8px] text-white">✓</span>
              )}
              <span className="text-xl">📷</span>
              <span className="font-body text-[10px] font-bold text-text-secondary">Trasera</span>
            </button>

            {/* Tablero */}
            <button
              type="button"
              onClick={() => capturar("tablero")}
              className={`relative rounded-xl border p-4 flex flex-col items-center justify-center gap-2 aspect-square cursor-pointer transition-all select-none ${
                isPhotoCaptured("tablero")
                  ? "bg-[#1C2C24]/10 border-[#0D6E4B]/80"
                  : "bg-surface-elevated/20 border-border/40 border-dashed hover:border-[#00B4D8]/60"
              }`}
            >
              {isPhotoCaptured("tablero") && (
                <span className="absolute top-1.5 right-1.5 w-4 h-4 rounded-full bg-emerald-600 border border-emerald-500/30 flex items-center justify-center text-[8px] text-white">✓</span>
              )}
              <span className="text-xl">📷</span>
              <span className="font-body text-[10px] font-bold text-text-secondary">Tablero</span>
            </button>

            {/* Adicionales */}
            <button
              type="button"
              onClick={() => capturar("adicional")}
              className={`relative rounded-xl border p-4 flex flex-col items-center justify-center gap-2 aspect-square cursor-pointer transition-all select-none ${
                isPhotoCaptured("adicional")
                  ? "bg-[#1C2C24]/10 border-[#0D6E4B]/80"
                  : "bg-surface-elevated/20 border-border/40 border-dashed hover:border-[#00B4D8]/60"
              }`}
            >
              {isPhotoCaptured("adicional") && (
                <span className="absolute top-1.5 right-1.5 w-4 h-4 rounded-full bg-emerald-600 border border-emerald-500/30 flex items-center justify-center text-[8px] text-white">✓</span>
              )}
              <span className="text-xl">+</span>
              <span className="font-body text-[10px] font-bold text-text-secondary">Adicionales <span className="font-normal text-[8px] text-text-tertiary">(opc.)</span></span>
            </button>
          </div>
          
          <input
            ref={inputArchivoRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => void procesarArchivoSeleccionado(e.target.files?.[0])}
          />
        </section>

        {/* Section 2: KILOMETRAJE Y COMBUSTIBLE */}
        <section className="mt-8 flex flex-col gap-3">
          <div className="flex items-center gap-2">
            <span className="w-5 h-5 rounded-md bg-surface-elevated text-text-secondary flex items-center justify-center font-display text-[10px] font-bold">
              2
            </span>
            <h2 className="font-display text-xs font-black text-text-tertiary tracking-widest uppercase">
              KILOMETRAJE Y COMBUSTIBLE
            </h2>
          </div>

          <div className="grid grid-cols-2 gap-3">
            {/* Kilometraje Actual */}
            <div className="rounded-2xl border border-border/30 bg-surface-elevated/20 p-4.5 flex flex-col gap-2">
              <span className="font-display text-[9px] font-black text-text-tertiary tracking-wider uppercase">
                KILOMETRAJE ACTUAL
              </span>
              <div className="flex items-baseline gap-1 mt-1">
                <input 
                  type="text" 
                  value={kilometraje} 
                  onChange={(e) => setKilometraje(e.target.value)}
                  className="font-display text-2xl font-black text-white bg-transparent border-none outline-hidden p-0 w-24 max-w-full"
                />
                <span className="font-body text-[10px] font-bold text-text-secondary">km</span>
              </div>
            </div>

            {/* Nivel de Gasolina */}
            <div className="rounded-2xl border border-border/30 bg-surface-elevated/20 p-4.5 flex flex-col gap-2">
              <div className="flex justify-between items-center w-full">
                <span className="font-display text-[9px] font-black text-text-tertiary tracking-wider uppercase">
                  NIVEL DE GASOLINA
                </span>
                <span className="font-body text-[8px] font-bold text-[#DCA24C]">{getFuelText(gasolinaSegments)}</span>
              </div>

              {/* Gasolina segments indicator (clickable) */}
              <div className="flex gap-0.5 mt-2.5 items-center">
                {Array.from({ length: 8 }).map((_, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => setGasolinaSegments(idx + 1)}
                    className={`flex-1 h-3 rounded-xs border-none cursor-pointer transition-all ${
                      idx < gasolinaSegments ? "bg-[#DCA24C]" : "bg-border/30"
                    }`}
                  />
                ))}
              </div>
              <div className="flex justify-between items-center text-[7px] text-text-tertiary font-bold mt-1 px-0.5 select-none">
                <span>E</span>
                <span>¼</span>
                <span>½</span>
                <span>¾</span>
                <span>F</span>
              </div>
            </div>
          </div>
        </section>

        {/* Section 3: LLAVES ENTREGADAS */}
        <section className="mt-8 flex flex-col gap-3">
          <div className="flex items-center gap-2">
            <span className="w-5 h-5 rounded-md bg-surface-elevated text-text-secondary flex items-center justify-center font-display text-[10px] font-bold">
              3
            </span>
            <h2 className="font-display text-xs font-black text-text-tertiary tracking-widest uppercase">
              LLAVES ENTREGADAS
            </h2>
          </div>

          <div className="bg-surface-elevated/40 border border-border/30 rounded-2xl p-4 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-xs font-bold text-text-secondary">
              <span className="text-lg">🔑</span>
              <span>Número de llaves recibidas</span>
            </div>

            {/* Stepper counter */}
            <div className="flex items-center gap-2 bg-[#17231E]/40 border border-border/30 rounded-lg p-1 shrink-0">
              <button
                type="button"
                onClick={() => setLlavesCount(Math.max(0, llavesCount - 1))}
                className="w-8 h-8 rounded-md bg-transparent hover:bg-border/20 border-none text-text-primary text-lg font-black cursor-pointer select-none flex items-center justify-center"
              >
                -
              </button>
              <span className="font-display text-base font-extrabold text-white w-5 text-center">{llavesCount}</span>
              <button
                type="button"
                onClick={() => setLlavesCount(llavesCount + 1)}
                className="w-8 h-8 rounded-md bg-transparent hover:bg-border/20 border-none text-text-primary text-lg font-black cursor-pointer select-none flex items-center justify-center"
              >
                +
              </button>
            </div>
          </div>
        </section>

        {/* Section 4: DOCUMENTOS Y PLACAS */}
        <section className="mt-8 flex flex-col gap-3">
          <div className="flex items-center gap-2">
            <span className="w-5 h-5 rounded-md bg-surface-elevated text-text-secondary flex items-center justify-center font-display text-[10px] font-bold">
              4
            </span>
            <h2 className="font-display text-xs font-black text-text-tertiary tracking-widest uppercase">
              DOCUMENTOS Y PLACAS
            </h2>
          </div>

          <div className="flex flex-col gap-2 text-xs font-body text-text-secondary">
            {/* Tarjeta de circulación */}
            <div className="bg-surface-elevated/20 border border-border/20 rounded-2xl p-3.5 flex justify-between items-center">
              <span className="flex items-center gap-2 font-bold">💳 Tarjeta de circulación</span>
              <button
                type="button"
                onClick={() => setTarjetaCirculacion(tarjetaCirculacion === "si" ? "no" : "si")}
                className={`border text-[9px] font-extrabold px-3 py-1.5 rounded-lg cursor-pointer transition-all select-none ${
                  tarjetaCirculacion === "si"
                    ? "border-emerald-500/40 text-emerald-400 bg-emerald-500/10"
                    : "border-amber-500/40 text-amber-500 bg-amber-500/10"
                }`}
              >
                {tarjetaCirculacion === "si" ? "✓ CAPTURADA" : "📋 PENDIENTE"}
              </button>
            </div>

            {/* Talón de verificación */}
            <div className="bg-surface-elevated/20 border border-border/20 rounded-2xl p-3.5 flex justify-between items-center">
              <span className="flex items-center gap-2 font-bold">📄 Talón de verificación</span>
              <button
                type="button"
                onClick={() => setTalonVerificacion(talonVerificacion === "si" ? "no" : "si")}
                className={`border text-[9px] font-extrabold px-3 py-1.5 rounded-lg cursor-pointer transition-all select-none ${
                  talonVerificacion === "si"
                    ? "border-emerald-500/40 text-emerald-400 bg-emerald-500/10"
                    : "border-amber-500/40 text-amber-500 bg-amber-500/10"
                }`}
              >
                {talonVerificacion === "si" ? "✓ CAPTURADA" : "📋 PENDIENTE"}
              </button>
            </div>

            {/* Holograma de verificación */}
            <div className="bg-surface-elevated/20 border border-border/20 rounded-2xl p-3.5 flex justify-between items-center">
              <span className="flex items-center gap-2 font-bold">🔖 Holograma de verificación</span>
              <button
                type="button"
                onClick={() => setHologramaVerificacion(hologramaVerificacion === "si" ? "no" : "si")}
                className={`border text-[9px] font-extrabold px-3 py-1.5 rounded-lg cursor-pointer transition-all select-none ${
                  hologramaVerificacion === "si"
                    ? "border-emerald-500/40 text-emerald-400 bg-emerald-500/10"
                    : "border-amber-500/40 text-amber-500 bg-amber-500/10"
                }`}
              >
                {hologramaVerificacion === "si" ? "✓ CAPTURADA" : "📋 PENDIENTE"}
              </button>
            </div>

            {/* Placa delantera */}
            <div className="bg-surface-elevated/20 border border-border/20 rounded-2xl p-3.5 flex justify-between items-center">
              <span className="flex items-center gap-2 font-bold">◽ Placa delantera</span>
              <button
                type="button"
                onClick={() => setPlacaDelantera(placaDelantera === "si" ? "no" : "si")}
                className={`border text-[9px] font-extrabold px-3 py-1.5 rounded-lg cursor-pointer transition-all select-none ${
                  placaDelantera === "si"
                    ? "border-emerald-500/40 text-emerald-400 bg-emerald-500/10"
                    : "border-amber-500/40 text-amber-500 bg-amber-500/10"
                }`}
              >
                {placaDelantera === "si" ? "✓ CAPTURADA" : "📋 PENDIENTE"}
              </button>
            </div>

            {/* Placa trasera */}
            <div className="bg-surface-elevated/20 border border-border/20 rounded-2xl p-3.5 flex justify-between items-center">
              <span className="flex items-center gap-2 font-bold">◽ Placa trasera</span>
              <button
                type="button"
                onClick={() => setPlacaTrasera(placaTrasera === "si" ? "no" : "si")}
                className={`border text-[9px] font-extrabold px-3 py-1.5 rounded-lg cursor-pointer transition-all select-none ${
                  placaTrasera === "si"
                    ? "border-emerald-500/40 text-emerald-400 bg-emerald-500/10"
                    : "border-amber-500/40 text-amber-500 bg-amber-500/10"
                }`}
              >
                {placaTrasera === "si" ? "✓ CAPTURADA" : "📋 PENDIENTE"}
              </button>
            </div>
          </div>
        </section>

        {/* Section 5: NOTAS DE RECOGIDA */}
        <section className="mt-8 flex flex-col gap-3">
          <div className="flex items-center gap-2">
            <span className="w-5 h-5 rounded-md bg-surface-elevated text-text-secondary flex items-center justify-center font-display text-[10px] font-bold">
              5
            </span>
            <h2 className="font-display text-xs font-black text-text-tertiary tracking-widest uppercase">
              NOTAS DE RECOGIDA
            </h2>
          </div>

          <textarea
            value={notas}
            onChange={(e) => setNotas(e.target.value)}
            rows={4}
            className="w-full bg-surface-elevated/20 border border-border/30 rounded-2xl p-4.5 text-xs font-body text-text-secondary leading-relaxed outline-hidden focus:border-[#00B4D8]/50 transition-all font-inherit"
          />
        </section>

        {/* Actions Button Row */}
        <section className="mt-8 flex gap-3">
          <button
            type="button"
            onClick={guardarBorrador}
            disabled={procesando}
            className="flex-1 min-h-12 rounded-xl bg-transparent hover:bg-surface border border-border/40 text-text-primary font-display text-xs font-black tracking-wide transition-all cursor-pointer shadow-xs select-none flex items-center justify-center"
          >
            GUARDAR BORRADOR
          </button>
          <button
            type="button"
            onClick={finalizar}
            disabled={procesando}
            className="flex-1 min-h-12 rounded-xl bg-[#0D6E4B] text-white hover:bg-[#0D6E4B]/90 font-display text-xs font-black tracking-wide transition-all cursor-pointer shadow-md select-none flex items-center justify-center"
          >
            FINALIZAR EVIDENCIAS
          </button>
        </section>

        {error && (
          <div className="mt-4">
            <Aviso tono="danger">{error}</Aviso>
          </div>
        )}
        {avisoExito && (
          <div className="mt-4">
            <Aviso tono="info">{avisoExito}</Aviso>
          </div>
        )}

        <div className="text-center font-body text-[9px] text-text-tertiary font-bold mt-6 tracking-wide select-none">
          ruumruum · evidencias generadas previas al {tipo === "inicial" ? "inicio" : "cierre"} del traslado
        </div>

      </div>

      {/* Floating Bottom Navigation Bar */}
      <div className="fixed inset-x-0 bottom-4 z-40 px-4">
        <nav
          aria-label="Navegación principal móvil"
          className="mx-auto max-w-md rounded-full border border-border/40 bg-surface-elevated/90 shadow-[0_8px_30px_rgba(0,0,0,0.2)] px-5 py-3.5 backdrop-blur-md"
        >
          <div className="grid grid-cols-3 gap-1">
            <Link
              href="/panel"
              className="relative flex flex-col items-center justify-center gap-1.5 rounded-2xl px-1 py-1 font-body text-xs text-text-secondary hover:text-text-primary transition-colors select-none"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="3" width="7" height="9" />
                <rect x="14" y="3" width="7" height="5" />
                <rect x="14" y="12" width="7" height="9" />
                <rect x="3" y="16" width="7" height="5" />
              </svg>
              <span>Inicio</span>
            </Link>

            <Link
              href="/viajes"
              className="relative flex flex-col items-center justify-center gap-1.5 rounded-2xl px-1 py-1 font-body text-xs text-signal font-extrabold transition-colors select-none"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polygon points="3 6 9 3 15 6 21 3 21 18 15 21 9 18 3 21" />
                <line x1="9" y1="3" x2="9" y2="18" />
                <line x1="15" y1="6" x2="15" y2="21" />
              </svg>
              <span>Traslados</span>
            </Link>

            <Link
              href="/ganancias"
              className="relative flex flex-col items-center justify-center gap-1.5 rounded-2xl px-1 py-1 font-body text-xs text-text-secondary hover:text-text-primary transition-colors select-none"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="12" y1="1" x2="12" y2="23" />
                <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
              </svg>
              <span>Ganancias</span>
            </Link>
          </div>
        </nav>
      </div>

      {/* Bottom Sheet de Soporte */}
      {soporteAbierto && (
        <div className="fixed inset-0 z-50 flex items-end justify-center">
          {/* Backdrop de cierre */}
          <button 
            type="button" 
            className="absolute inset-0 bg-black/60 backdrop-blur-xs transition-opacity duration-300 animate-fadeIn cursor-default w-full h-full border-none outline-hidden" 
            onClick={() => setSoporteAbierto(false)}
            aria-label="Cerrar soporte"
          />
          {/* Tarjeta de contenido */}
          <div className="relative w-full max-w-md bg-surface-elevated rounded-t-[2rem] border-t border-border/40 p-6 flex flex-col gap-4 animate-slideUp shadow-2xl">
            <div className="flex justify-between items-center pb-2 border-b border-border/20">
              <h2 className="font-display text-lg font-bold text-text-primary flex items-center gap-2">
                <span>💬</span> Soporte Rápido Ruum
              </h2>
              <button 
                type="button" 
                onClick={() => setSoporteAbierto(false)}
                className="text-text-tertiary hover:text-text-primary p-1 cursor-pointer font-bold text-sm"
              >
                ✕
              </button>
            </div>
            <p className="font-body text-xs text-text-secondary">
              Selecciona un medio de contacto para comunicarte con el equipo operativo de guardia.
            </p>
            <div className="flex flex-col gap-2.5 mt-2">
              <a
                href="https://wa.me/525548210937"
                className="flex items-center gap-3 p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-xl hover:bg-emerald-500/20 transition-colors"
              >
                <span className="text-xl">💬</span>
                <div className="flex flex-col items-start">
                  <span className="font-display text-sm font-bold text-emerald-400">WhatsApp de Soporte</span>
                  <span className="font-body text-[11px] text-text-secondary">Mensajería instantánea y respuesta inmediata</span>
                </div>
              </a>
              <a
                href="tel:+525548210937"
                className="flex items-center gap-3 p-4 bg-route-soft border border-route-action/20 rounded-xl hover:bg-route-action/10 transition-colors"
              >
                <span className="text-xl">📞</span>
                <div className="flex flex-col items-start">
                  <span className="font-display text-sm font-bold text-route-action">Llamar a Soporte</span>
                  <span className="font-body text-[11px] text-text-secondary">Habla por teléfono directamente con un operador</span>
                </div>
              </a>
              <a
                href="mailto:soporte@ruumruum.com"
                className="flex items-center gap-3 p-4 bg-surface rounded-xl border border-border/40 hover:bg-surface-elevated transition-colors"
              >
                <span className="text-xl">✉️</span>
                <div className="flex flex-col items-start">
                  <span className="font-display text-sm font-bold text-text-primary">Correo Electrónico</span>
                  <span className="font-body text-[11px] text-text-secondary">Reportar incidencias técnicas no urgentes</span>
                </div>
              </a>
            </div>
            <button
              type="button"
              onClick={() => setSoporteAbierto(false)}
              className="w-full min-h-11 mt-2 rounded-xl bg-control-soft font-display text-sm font-bold text-text-primary hover:bg-border/60 transition-colors cursor-pointer"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

    </div>
  );
}
