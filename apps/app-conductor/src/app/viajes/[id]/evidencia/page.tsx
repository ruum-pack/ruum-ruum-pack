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
import { SecondaryTripNavBar } from "../SecondaryTripNavBar";

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
  const [kilometraje, setKilometraje] = useState("");
  const [gasolinaSegments, setGasolinaSegments] = useState(4); // default 4/8 (1/2)
  const [llavesCount, setLlavesCount] = useState(2);
  const [tarjetaCirculacion, setTarjetaCirculacion] = useState("");
  const [talonVerificacion, setTalonVerificacion] = useState("");
  const [hologramaVerificacion, setHologramaVerificacion] = useState("");
  const [placaDelantera, setPlacaDelantera] = useState("");
  const [placaTrasera, setPlacaTrasera] = useState("");
  const [notas, setNotas] = useState("");

  // Accordion states for Documentos/Placas and Notas
  const [acordeonDocsAbierto, setAcordeonDocsAbierto] = useState(true);
  const [acordeonNotasAbierto, setAcordeonNotasAbierto] = useState(true);

  // Custom states for damages and receipt modal
  const [presentaDanosNuevos, setPresentaDanosNuevos] = useState(false);
  const [mostrarRecibo, setMostrarRecibo] = useState(false);
  const [tipoReporteEnviado, setTipoReporteEnviado] = useState<"sms" | "email" | null>(null);
  const [enviandoCopia, setEnviandoCopia] = useState(false);

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

  const fotosObligatorias = 5; // frente, lado_piloto, lado_copiloto, trasera, tablero (adicional es opcional)
  const totalRequisitos = fotosObligatorias + 1 + 5; // fotos obligatorias + kilometraje + 5 docs/placas = 11
  // Calculate progress count
  const angulosObligatorios: AnguloEvidencia[] = ["frente", "lado_piloto", "lado_copiloto", "trasera", "tablero"];
  const fotosObligCapturadas = angulosObligatorios.filter((a) => fotos.some((f) => f.angulo === a)).length;
  const docsCapturados = [tarjetaCirculacion, talonVerificacion, hologramaVerificacion, placaDelantera, placaTrasera].filter((v) => v === "si").length;
  const totalCapturados = fotosObligCapturadas + docsCapturados + (kilometraje.trim() ? 1 : 0);

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
      
      const offline = typeof navigator !== "undefined" && !navigator.onLine;
      if (offline) {
        setAviso("⚠️ Sin conexión. Guardamos la fotografía en la caché local del dispositivo de forma segura.");
      } else {
        setAvisoExito(`Fotografía "${angulo}" registrada localmente.`);
      }
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
      setAvisoExito(`✓ Conexión recuperada. Sincronizamos ${subidas} foto${subidas === 1 ? "" : "s"} en segundo plano con éxito.`);
    } catch (err) {
      setError(traducirErrorOperativo(err, "No pudimos sincronizar las fotos pendientes."));
    }
  }, [drenarColaPendiente, refrescarEvidencia, tipo]);

  useEffect(() => {
    if (!tipo) return;
    const timer = setTimeout(() => {
      void drenarCola();
    }, 500);

    const alVolverEnLinea = () => {
      void drenarCola();
    };

    window.addEventListener("online", alVolverEnLinea);

    return () => {
      clearTimeout(timer);
      window.removeEventListener("online", alVolverEnLinea);
    };
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
      const estadoEsperado = tipo === "inicial" ? "evidencia_inicial_en_proceso" : "evidencia_final_en_proceso";
      await confirmarEvidenciaCompleta(cliente, id, estadoActual || estadoEsperado, tipo);
      setAvisoExito("Evidencias completadas y enviadas con éxito.");
      setTimeout(() => {
        router.push(`/viajes/${id}`);
      }, 500);
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
        <div className="w-8 h-8 border-4 border-signal border-t-transparent rounded-full animate-spin mx-auto mb-4" />
        <p className="font-body text-sm font-semibold text-text-secondary">Cargando checklist de evidencias...</p>
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
        <header className="hidden md:flex justify-between items-center pb-4 border-b border-border/20">
          <div className="flex items-center gap-2">
            <span className="font-display text-lg font-black tracking-tight text-text-primary">
              ruum<span className="text-signal">ruum</span>
            </span>
            <div className="bg-surface-elevated border border-border/30 px-2 py-0.5 rounded-md">
              <span className="font-display text-[9px] font-black text-signal tracking-wider">CONDUCTOR CERTIFICADO</span>
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

        {/* Step Breadcrumbs — Brand Book: titular Montserrat Bold + línea ruta */}
        <div className="mt-6 flex flex-col gap-1">
          <span className="font-body text-[10px] text-text-tertiary font-bold tracking-wide">
            Traslados › {tipo === "inicial" ? origen : (pasaporte?.destino_ciudad || "Destino")} › <span className="text-text-primary">Paso 2 de 2</span>
          </span>
          <span className="font-display text-[9px] font-black text-route-action tracking-widest uppercase mt-0.5">
            {tipo === "inicial" ? "RECOLECCIÓN DE UNIDAD" : "ENTREGA DE UNIDAD"} · Evidencia documentada
          </span>
          <h1 className="font-display text-2xl font-black tracking-tight text-text-primary leading-tight mt-1">
            {tipo === "inicial" ? "Checklist de Origen" : "Checklist de Destino"}
          </h1>
          <p className="font-body text-xs text-text-secondary leading-relaxed mt-1">
            <span className="font-bold text-signal block mb-0.5">
              {tipo === "inicial" ? "Verificación y evidencia de salida" : "Verificación y evidencia de entrega"}
            </span>
            {tipo === "inicial" 
              ? "Captura las fotografías y datos del vehículo antes de iniciar el traslado. Cada traslado inicia con evidencia." 
              : "Captura las fotografías y datos del vehículo en el punto de entrega de destino. Cada traslado termina con confirmación."}
          </p>
          <div className="conductor-ruta-divider mt-2 max-w-[260px]" aria-hidden />
        </div>

        {/* Progress Bar Container with Prominent Percent Badge */}
        {(() => {
          const porcentaje = Math.round((totalCapturados / Math.max(1, totalRequisitos)) * 100);
          return (
            <div className="mt-5 bg-surface-elevated border border-border/20 rounded-2xl p-4.5 flex flex-col gap-3 shadow-xs">
              <div className="flex items-center justify-between">
                <div className="flex flex-col">
                  <span className="font-display text-[9px] font-black text-text-tertiary tracking-widest uppercase">
                    PROGRESO GENERAL DE REVISIÓN
                  </span>
                  <span className="font-body text-xs text-text-secondary font-bold mt-0.5">
                    {totalCapturados} de {totalRequisitos} verificaciones completadas
                  </span>
                </div>
                <div className={`flex flex-col items-end px-3 py-1.5 rounded-xl border ${
                  porcentaje === 100
                    ? "bg-signal/15 border-signal/30 text-signal"
                    : "bg-route-action/10 border-route-action/30 text-route-action"
                }`}>
                  <span className="font-display text-xl font-black leading-none">{porcentaje}%</span>
                  <span className="font-display text-[8px] font-extrabold uppercase tracking-wider mt-0.5">COMPLETADO</span>
                </div>
              </div>

              {/* Progress Bar Track */}
              <div className="w-full bg-surface rounded-full h-3.5 overflow-hidden border border-border/15 relative p-0.5">
                <div 
                  className={`h-full rounded-full transition-all duration-500 ${
                    porcentaje === 100 
                      ? "bg-signal shadow-[0_0_12px_rgba(255,196,0,0.4)]" 
                      : "bg-route-action shadow-[0_0_10px_rgba(30,136,229,0.3)]"
                  }`}
                  style={{ width: `${porcentaje}%` }}
                />
              </div>

              {porcentaje === 100 ? (
                <span className="font-body text-xs text-signal font-extrabold flex items-center gap-1.5 animate-pulse">
                  ✓ ¡Checklist completado al 100%! Puedes finalizar evidencias.
                </span>
              ) : (
                <span className="font-body text-[11px] text-amber-400 font-bold flex items-center gap-1">
                  ⚠️ Faltan {totalRequisitos - totalCapturados} elementos por verificar para poder finalizar.
                </span>
              )}
            </div>
          );
        })()}

        {/* Stepper sticky 5 pasos — P1 + sync status */}
        {(() => {
          const pasos = [
            { id: "evid-fotos", label: "Fotos", sub: `${fotosObligCapturadas}/${fotosObligatorias}`, done: fotosObligCapturadas === fotosObligatorias },
            { id: "evid-km", label: "KM", sub: kilometraje.trim() ? "OK" : "Falta", done: Boolean(kilometraje.trim()) },
            { id: "evid-llaves", label: "Llaves", sub: `${llavesCount}`, done: true },
            { id: "evid-docs", label: "Docs", sub: `${docsCapturados}/5`, done: docsCapturados === 5 },
            { id: "evid-notas", label: "Notas", sub: notas.trim().length > 5 ? "OK" : "Opc.", done: true },
          ] as const;
          const pendientes = fotosObligatorias - fotosObligCapturadas;
          return (
            <>
              <nav aria-label="Pasos de evidencia" className="sticky top-0 z-20 -mx-4 px-4 sm:-mx-6 sm:px-6 bg-surface/95 backdrop-blur supports-[backdrop-filter]:bg-surface/80 border-y border-border/20 mt-6 -mb-2 py-2 overflow-x-auto scrollbar-none">
                <ol className="flex items-center gap-2 min-w-max">
                  {pasos.map((p, idx) => (
                    <li key={p.id} className="flex items-center gap-2">
                      <a
                        href={`#${p.id}`}
                        onClick={(e) => {
                          e.preventDefault();
                          document.getElementById(p.id)?.scrollIntoView({ behavior: "smooth", block: "start" });
                        }}
                        className={`inline-flex items-center gap-2 rounded-full border px-3 py-2 min-h-9 text-xs font-bold transition-colors focus-visible:outline focus-visible:outline-[3px] focus-visible:outline-offset-2 focus-visible:outline-route-action ${p.done ? "bg-signal/15 border-signal/30 text-signal" : "bg-surface-elevated border-border/30 text-text-secondary hover:text-text-primary"}`}
                      >
                        <span className={`flex size-5 items-center justify-center rounded-full text-[11px] font-black ${p.done ? "bg-signal text-slate-950" : "bg-surface border border-border/30 text-text-tertiary"}`}>
                          {p.done ? "✓" : idx + 1}
                        </span>
                        <span className="hidden sm:inline">{p.label}</span>
                        <span className="text-[10px] opacity-70 tabular-nums">{p.sub}</span>
                      </a>
                      {idx < pasos.length - 1 && <span className="h-px w-4 bg-border/30 hidden sm:block" aria-hidden />}
                    </li>
                  ))}
                </ol>
              </nav>
              {pendientes > 0 && (
                <div className="mt-3 rounded-xl border border-amber-500/20 bg-amber-500/10 px-3 py-2 flex items-center justify-between">
                  <span className="font-body text-xs font-semibold text-amber-600 dark:text-amber-400">Faltan {pendientes} fotos obligatorias</span>
                  <a href="#evid-fotos" onClick={(e) => { e.preventDefault(); document.getElementById("evid-fotos")?.scrollIntoView({ behavior: "smooth" }); }} className="font-body text-xs font-bold text-amber-600 hover:underline">Ir a fotos →</a>
                </div>
              )}
            </>
          );
        })()}

        {/* Section 1: FOTOGRAFÍAS DEL VEHÍCULO */}
        <section id="evid-fotos" className="mt-8 flex flex-col gap-3 scroll-mt-20">
          <div className="flex items-center gap-2">
            <span className="w-5 h-5 rounded-md bg-route-action/15 border border-route-action/30 text-route-action flex items-center justify-center font-display text-[10px] font-bold">
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
                  ? "bg-surface-elevated border-signal/60"
                  : "bg-surface-elevated/20 border-border/40 border-dashed hover:border-route-action"
              }`}
            >
              {isPhotoCaptured("frente") && (
                <span className="absolute top-1.5 right-1.5 w-4 h-4 rounded-full bg-signal text-slate-950 flex items-center justify-center text-[8px] font-black">✓</span>
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
                  ? "bg-surface-elevated border-signal/60"
                  : "bg-surface-elevated/20 border-border/40 border-dashed hover:border-route-action"
              }`}
            >
              {isPhotoCaptured("lado_piloto") && (
                <span className="absolute top-1.5 right-1.5 w-4 h-4 rounded-full bg-signal text-slate-950 flex items-center justify-center text-[8px] font-black">✓</span>
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
                  ? "bg-surface-elevated border-signal/60"
                  : "bg-surface-elevated/20 border-border/40 border-dashed hover:border-route-action"
              }`}
            >
              {isPhotoCaptured("lado_copiloto") && (
                <span className="absolute top-1.5 right-1.5 w-4 h-4 rounded-full bg-signal text-slate-950 flex items-center justify-center text-[8px] font-black">✓</span>
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
                  ? "bg-surface-elevated border-signal/60"
                  : "bg-surface-elevated/20 border-border/40 border-dashed hover:border-route-action"
              }`}
            >
              {isPhotoCaptured("trasera") && (
                <span className="absolute top-1.5 right-1.5 w-4 h-4 rounded-full bg-signal text-slate-950 flex items-center justify-center text-[8px] font-black">✓</span>
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
                  ? "bg-surface-elevated border-signal/60"
                  : "bg-surface-elevated/20 border-border/40 border-dashed hover:border-route-action"
              }`}
            >
              {isPhotoCaptured("tablero") && (
                <span className="absolute top-1.5 right-1.5 w-4 h-4 rounded-full bg-signal text-slate-950 flex items-center justify-center text-[8px] font-black">✓</span>
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
                  ? "bg-surface-elevated border-signal/60"
                  : "bg-surface-elevated/20 border-border/40 border-dashed hover:border-route-action"
              }`}
            >
              {isPhotoCaptured("adicional") && (
                <span className="absolute top-1.5 right-1.5 w-4 h-4 rounded-full bg-signal text-slate-950 flex items-center justify-center text-[8px] font-black">✓</span>
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
        <section id="evid-km" className="mt-8 flex flex-col gap-3 scroll-mt-20">
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
            <div className={`rounded-2xl border p-4.5 flex flex-col gap-2 transition-all ${
              kilometraje.trim().length > 0 
                ? "border-emerald-500/40 bg-emerald-500/5" 
                : "border-border/30 bg-surface-elevated/20"
            }`}>
              <div className="flex justify-between items-center">
                <span className="font-display text-[9px] font-black text-text-tertiary tracking-wider uppercase">
                  KILOMETRAJE ACTUAL
                </span>
                {kilometraje.trim().length > 0 && (
                  <span className="font-display text-[8px] font-extrabold text-emerald-400 uppercase tracking-wider">
                    ✓ REGISTRADO
                  </span>
                )}
              </div>
              <div className="flex items-baseline gap-1 mt-1">
                <input 
                  type="text" 
                  inputMode="numeric"
                  pattern="[0-9]*"
                  autoComplete="off"
                  placeholder="0"
                  aria-label="Kilometraje actual"
                  value={kilometraje} 
                  onChange={(e) => setKilometraje(e.target.value.replace(/[^0-9,.\s]/g, ""))}
                  className="font-display text-2xl font-black text-text-primary bg-transparent border-none outline-hidden p-0 w-24 max-w-full focus:outline-hidden placeholder:text-text-tertiary/60"
                />
                <span className="font-body text-[10px] font-bold text-text-secondary">km</span>
              </div>
            </div>

            {/* Nivel de Gasolina */}
            <div className={`rounded-2xl border p-4.5 flex flex-col gap-2 transition-all ${
              gasolinaSegments > 0 
                ? "border-emerald-500/40 bg-emerald-500/5" 
                : "border-border/30 bg-surface-elevated/20"
            }`}>
              <div className="flex justify-between items-center w-full">
                <span className="font-display text-[9px] font-black text-text-tertiary tracking-wider uppercase">
                  NIVEL DE GASOLINA
                </span>
                <div className="flex items-center gap-1.5">
                  {gasolinaSegments > 0 && (
                    <span className="font-display text-[8px] font-extrabold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">
                      ✓ REGISTRADO
                    </span>
                  )}
                  <span className="font-body text-[8px] font-bold text-text-secondary">{getFuelText(gasolinaSegments)}</span>
                </div>
              </div>

              {/* Gasolina segments indicator (clickable) */}
              <div className="flex gap-0.5 mt-2.5 items-center">
                {Array.from({ length: 8 }).map((_, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => setGasolinaSegments(idx + 1)}
                    aria-label={`Nivel ${idx + 1} de 8`}
                    className={`flex-1 h-3 rounded-xs border-none cursor-pointer transition-all focus-visible:outline focus-visible:outline-[2px] focus-visible:outline-offset-1 focus-visible:outline-signal ${
                      idx < gasolinaSegments ? "bg-signal" : "bg-border/30"
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
        <section id="evid-llaves" className="mt-8 flex flex-col gap-3 scroll-mt-20">
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
            <div className="flex items-center gap-2 bg-surface border border-border/30 rounded-lg p-1 shrink-0">
              <button
                type="button"
                onClick={() => setLlavesCount(Math.max(0, llavesCount - 1))}
                className="w-8 h-8 rounded-md bg-transparent hover:bg-border/20 border-none text-text-primary text-lg font-black cursor-pointer select-none flex items-center justify-center"
              >
                -
              </button>
              <span className="font-display text-base font-extrabold text-text-primary w-5 text-center">{llavesCount}</span>
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

        {/* Section 4: DOCUMENTOS Y PLACAS - Menú Tipo Acordeón */}
        <section id="evid-docs" className="mt-8 flex flex-col rounded-2xl border border-border/30 bg-surface-elevated/20 overflow-hidden shadow-xs scroll-mt-20">
          <button
            type="button"
            onClick={() => setAcordeonDocsAbierto(!acordeonDocsAbierto)}
            className="w-full flex items-center justify-between p-4 bg-surface-elevated/40 hover:bg-surface-elevated/70 transition-colors text-left cursor-pointer select-none"
            aria-expanded={acordeonDocsAbierto}
            aria-label="Alternar sección de documentos y placas"
          >
            <div className="flex items-center gap-2.5">
              <span className="w-6 h-6 rounded-lg bg-surface-elevated border border-border/40 text-text-secondary flex items-center justify-center font-display text-xs font-black">
                4
              </span>
              <div className="flex flex-col">
                <h2 className="font-display text-xs font-black text-text-primary tracking-widest uppercase">
                  DOCUMENTOS Y PLACAS
                </h2>
                <span className="font-body text-[11px] text-text-tertiary">
                  {docsCapturados} de 5 elementos verificados
                </span>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <span className={`font-display text-[10px] font-black px-2.5 py-1 rounded-md tracking-wide ${
                docsCapturados === 5
                  ? "bg-signal/15 text-signal border border-signal/25"
                  : "bg-amber-500/15 text-amber-500 border border-amber-500/25"
              }`}>
                {docsCapturados === 5 ? "✓ COMPLETADO" : `${docsCapturados}/5 VERIFICADOS`}
              </span>
              <svg
                className={`w-5 h-5 text-text-secondary transition-transform duration-200 ${
                  acordeonDocsAbierto ? "rotate-180" : "rotate-0"
                }`}
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
              >
                <polyline points="6 9 12 15 18 9" />
              </svg>
            </div>
          </button>

          {acordeonDocsAbierto && (
            <div className="p-4 border-t border-border/20 flex flex-col gap-2.5 text-xs font-body text-text-secondary">
              {/* Tarjeta de circulación */}
              <label className="bg-surface-elevated/20 border border-border/20 rounded-2xl p-4 flex justify-between items-center cursor-pointer hover:border-route-action/40 transition-all select-none">
                <div className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    checked={tarjetaCirculacion === "si"}
                    onChange={(e) => setTarjetaCirculacion(e.target.checked ? "si" : "no")}
                    className="w-5 h-5 rounded border-border/60 text-signal focus:ring-signal focus:ring-offset-2 cursor-pointer"
                  />
                  <span className="font-body text-sm font-semibold text-text-primary">💳 Tarjeta de circulación</span>
                </div>
                <span className={`font-display text-[10px] font-black px-2.5 py-1 rounded-md tracking-wide ${
                  tarjetaCirculacion === "si"
                    ? "bg-signal/15 text-signal border border-signal/25"
                    : "bg-amber-500/15 text-amber-500 border border-amber-500/25"
                }`}>
                  {tarjetaCirculacion === "si" ? "✓ VERIFICADO" : "📋 PENDIENTE"}
                </span>
              </label>

              {/* Talón de verificación */}
              <label className="bg-surface-elevated/20 border border-border/20 rounded-2xl p-4 flex justify-between items-center cursor-pointer hover:border-route-action/40 transition-all select-none">
                <div className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    checked={talonVerificacion === "si"}
                    onChange={(e) => setTalonVerificacion(e.target.checked ? "si" : "no")}
                    className="w-5 h-5 rounded border-border/60 text-signal focus:ring-signal focus:ring-offset-2 cursor-pointer"
                  />
                  <span className="font-body text-sm font-semibold text-text-primary">📄 Talón de verificación</span>
                </div>
                <span className={`font-display text-[10px] font-black px-2.5 py-1 rounded-md tracking-wide ${
                  talonVerificacion === "si"
                    ? "bg-signal/15 text-signal border border-signal/25"
                    : "bg-amber-500/15 text-amber-500 border border-amber-500/25"
                }`}>
                  {talonVerificacion === "si" ? "✓ VERIFICADO" : "📋 PENDIENTE"}
                </span>
              </label>

              {/* Holograma de verificación */}
              <label className="bg-surface-elevated/20 border border-border/20 rounded-2xl p-4 flex justify-between items-center cursor-pointer hover:border-route-action/40 transition-all select-none">
                <div className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    checked={hologramaVerificacion === "si"}
                    onChange={(e) => setHologramaVerificacion(e.target.checked ? "si" : "no")}
                    className="w-5 h-5 rounded border-border/60 text-signal focus:ring-signal focus:ring-offset-2 cursor-pointer"
                  />
                  <span className="font-body text-sm font-semibold text-text-primary">🔖 Holograma de verificación</span>
                </div>
                <span className={`font-display text-[10px] font-black px-2.5 py-1 rounded-md tracking-wide ${
                  hologramaVerificacion === "si"
                    ? "bg-signal/15 text-signal border border-signal/25"
                    : "bg-amber-500/15 text-amber-500 border border-amber-500/25"
                }`}>
                  {hologramaVerificacion === "si" ? "✓ VERIFICADO" : "📋 PENDIENTE"}
                </span>
              </label>

              {/* Placa delantera */}
              <label className="bg-surface-elevated/20 border border-border/20 rounded-2xl p-4 flex justify-between items-center cursor-pointer hover:border-route-action/40 transition-all select-none">
                <div className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    checked={placaDelantera === "si"}
                    onChange={(e) => setPlacaDelantera(e.target.checked ? "si" : "no")}
                    className="w-5 h-5 rounded border-border/60 text-signal focus:ring-signal focus:ring-offset-2 cursor-pointer"
                  />
                  <span className="font-body text-sm font-semibold text-text-primary">◽ Placa delantera</span>
                </div>
                <span className={`font-display text-[10px] font-black px-2.5 py-1 rounded-md tracking-wide ${
                  placaDelantera === "si"
                    ? "bg-signal/15 text-signal border border-signal/25"
                    : "bg-amber-500/15 text-amber-500 border border-amber-500/25"
                }`}>
                  {placaDelantera === "si" ? "✓ VERIFICADO" : "📋 PENDIENTE"}
                </span>
              </label>

              {/* Placa trasera */}
              <label className="bg-surface-elevated/20 border border-border/20 rounded-2xl p-4 flex justify-between items-center cursor-pointer hover:border-route-action/40 transition-all select-none">
                <div className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    checked={placaTrasera === "si"}
                    onChange={(e) => setPlacaTrasera(e.target.checked ? "si" : "no")}
                    className="w-5 h-5 rounded border-border/60 text-signal focus:ring-signal focus:ring-offset-2 cursor-pointer"
                  />
                  <span className="font-body text-sm font-semibold text-text-primary">◽ Placa trasera</span>
                </div>
                <span className={`font-display text-[10px] font-black px-2.5 py-1 rounded-md tracking-wide ${
                  placaTrasera === "si"
                    ? "bg-signal/15 text-signal border border-signal/25"
                    : "bg-amber-500/15 text-amber-500 border border-amber-500/25"
                }`}>
                  {placaTrasera === "si" ? "✓ VERIFICADO" : "📋 PENDIENTE"}
                </span>
              </label>
            </div>
          )}
        </section>

        {/* Section 5: NOTAS DE RECOGIDA / ENTREGA - Menú Tipo Acordeón */}
        <section id="evid-notas" className="mt-6 flex flex-col rounded-2xl border border-border/30 bg-surface-elevated/20 overflow-hidden shadow-xs scroll-mt-20">
          <button
            type="button"
            onClick={() => setAcordeonNotasAbierto(!acordeonNotasAbierto)}
            className="w-full flex items-center justify-between p-4 bg-surface-elevated/40 hover:bg-surface-elevated/70 transition-colors text-left cursor-pointer select-none"
            aria-expanded={acordeonNotasAbierto}
            aria-label="Alternar sección de notas"
          >
            <div className="flex items-center gap-2.5">
              <span className="w-6 h-6 rounded-lg bg-route-action/15 border border-route-action/30 text-route-action flex items-center justify-center font-display text-xs font-black">
                5
              </span>
              <div className="flex flex-col">
                <h2 className="font-display text-xs font-black text-text-primary tracking-widest uppercase">
                  {tipo === "inicial" ? "NOTAS DE RECOGIDA" : "NOTAS DE ENTREGA"}
                </h2>
                <span className="font-body text-[11px] text-text-tertiary">
                  {notas.trim().length > 0 ? "Comentarios capturados" : "Observaciones y atajos rápidos"}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-3">
              {notas.trim().length > 5 ? (
                <span className="font-display text-[10px] font-black px-2.5 py-1 rounded-md tracking-wide bg-signal/15 text-signal border border-signal/25">
                  ✓ REGISTRADO
                </span>
              ) : (
                <span className="font-display text-[10px] font-bold text-text-tertiary px-2 py-0.5 rounded-md bg-surface border border-border/30">
                  OPCIONAL
                </span>
              )}
              <svg
                className={`w-5 h-5 text-text-secondary transition-transform duration-200 ${
                  acordeonNotasAbierto ? "rotate-180" : "rotate-0"
                }`}
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
              >
                <polyline points="6 9 12 15 18 9" />
              </svg>
            </div>
          </button>

          {acordeonNotasAbierto && (
            <div className="p-4 border-t border-border/20 flex flex-col gap-3">
              {tipo === "final" && (
                <div className="bg-surface-elevated/25 border border-border/20 rounded-2xl p-4 flex flex-col gap-3 mb-2">
                  <div className="flex justify-between items-center">
                    <span className="font-body text-xs font-bold text-text-primary">
                      ¿Presenta daños nuevos respecto al Origen?
                    </span>
                    <button
                      type="button"
                      onClick={() => setPresentaDanosNuevos(!presentaDanosNuevos)}
                      className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-hidden ${
                        presentaDanosNuevos ? "bg-signal" : "bg-border/40"
                      }`}
                    >
                      <span
                        className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-sm ring-0 transition duration-200 ease-in-out ${
                          presentaDanosNuevos ? "translate-x-5" : "translate-x-0"
                        }`}
                      />
                    </button>
                  </div>

                  {presentaDanosNuevos && (
                    <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-3 flex flex-col gap-1.5 text-[11px] font-body text-amber-500 leading-relaxed">
                      <span className="font-bold flex items-center gap-1">
                        ⚠️ SUGERENCIA DE REGISTRO FOTOGRÁFICO:
                      </span>
                      <p>
                        Se recomienda capturar fotos a detalle de la incidencia usando las opciones de subida de arriba (sección 1) y documentar claramente en las notas de abajo:
                      </p>
                      <ul className="list-disc pl-4 flex flex-col gap-1 font-medium mt-1 text-text-secondary">
                        <li>Fotografía en primer plano del rayón, abolladura o daño nuevo.</li>
                        <li>Fotografía de contexto que muestre la zona del vehículo afectada.</li>
                        <li>Detalla en el cuadro de texto los hallazgos y especifica el daño.</li>
                      </ul>
                    </div>
                  )}
                </div>
              )}

              {/* Quick Tags Pills */}
              <div className="flex flex-col gap-1.5 my-1">
                <span className="font-display text-[9px] font-extrabold text-text-tertiary uppercase tracking-wider">
                  Atajos de observaciones (toca para insertar):
                </span>
                <div className="flex flex-wrap gap-1.5 select-none">
                  {[
                    "Rayón",
                    "Golpe",
                    "Mancha",
                    "Sin llanta de refacción",
                    "Parabrisas estrellado",
                    "Asiento sucio",
                    "Sin tapetes",
                    "Rayón en fascia"
                  ].map((etiqueta) => (
                    <button
                      key={etiqueta}
                      type="button"
                      onClick={() => {
                        setNotas((prev) => {
                          const trimmed = prev.trim();
                          if (!trimmed) return `[${etiqueta}]`;
                          return `${trimmed}, [${etiqueta}]`;
                        });
                      }}
                      className="px-2.5 py-1 rounded-lg bg-surface-elevated/60 border border-border/30 hover:border-route-action text-text-secondary hover:text-text-primary hover:bg-surface-elevated font-body text-[11px] font-bold transition-all cursor-pointer active:scale-95"
                    >
                      + {etiqueta}
                    </button>
                  ))}
                </div>
              </div>

              <textarea
                value={notas}
                onChange={(e) => setNotas(e.target.value)}
                rows={4}
                placeholder={
                  tipo === "inicial"
                    ? "Documenta cualquier detalle observado durante la recolección..."
                    : "Detalla rayones, golpes nuevos o cualquier novedad respecto al punto de origen..."
                }
                className={`w-full border rounded-2xl p-4.5 text-xs font-body text-text-secondary leading-relaxed outline-hidden transition-all font-inherit ${
                  notas.trim().length > 5 
                    ? "border-signal/40 bg-signal/5 focus:border-signal/60" 
                    : "border-border/30 bg-surface-elevated/20 focus:border-route-action/50"
                }`}
              />
            </div>
          )}
        </section>

        {error && (
          <div className="mt-4 px-1">
            <Aviso tono="danger">{error}</Aviso>
          </div>
        )}
        {avisoExito && (
          <div className="mt-4 px-1">
            <Aviso tono="info">{avisoExito}</Aviso>
          </div>
        )}

        <div className="text-center font-body text-[9px] text-text-tertiary font-bold mt-6 tracking-wide select-none">
          ruumruum · evidencias generadas previas al {tipo === "inicial" ? "inicio" : "cierre"} del traslado
        </div>

      </div>

      {/* Sticky Primary Action Buttons Bar — respeta secondary nav + safe-area */}
      <div className="fixed bottom-[calc(56px+env(safe-area-inset-bottom))] inset-x-0 z-40 bg-surface/95 backdrop-blur-md border-t border-border/20 py-3 px-4 shadow-2xl select-none">
        <div className="max-w-md mx-auto flex gap-3">
          {/* GUARDAR BORRADOR (Estilo Outline Definido) */}
          <button
            type="button"
            onClick={guardarBorrador}
            disabled={Boolean(enviando)}
            className="flex-1 min-h-11 rounded-xl bg-transparent border-2 border-border/60 hover:border-white text-text-primary font-display text-xs font-bold tracking-wide transition-all cursor-pointer shadow-xs select-none flex items-center justify-center focus-visible:outline focus-visible:outline-[3px] focus-visible:outline-offset-2 focus-visible:outline-route-action disabled:opacity-50"
          >
            {enviando === "guardar" ? "Guardando…" : "Guardar borrador"}
          </button>
          
          {/* FINALIZAR EVIDENCIAS (Botón Primario con validación) */}
          <button
            type="button"
            onClick={finalizar}
            disabled={Boolean(enviando) || totalCapturados < totalRequisitos}
            title={totalCapturados < totalRequisitos ? `Faltan ${totalRequisitos - totalCapturados} requisitos` : undefined}
            className={`flex-1 min-h-11 rounded-xl font-display text-xs font-black tracking-wide transition-all cursor-pointer shadow-md select-none flex items-center justify-center gap-1.5 focus-visible:outline focus-visible:outline-[3px] focus-visible:outline-offset-2 focus-visible:outline-signal disabled:cursor-not-allowed ${
              totalCapturados === totalRequisitos
                ? "bg-signal hover:bg-signal/90 text-slate-950"
                : "bg-signal/60 text-slate-950/60 cursor-not-allowed"
            }`}
          >
            {enviando === "confirmar" ? TEXTOS_CARGANDO.actualizando : `Finalizar evidencias ${totalCapturados === totalRequisitos ? "✓" : `(${totalCapturados}/${totalRequisitos})`}`}
          </button>
        </div>
        {totalCapturados < totalRequisitos && (
          <p className="max-w-md mx-auto mt-2 text-center font-body text-[11px] font-semibold text-text-tertiary">
            Completa {totalRequisitos - totalCapturados} requisitos para habilitar el envío
          </p>
        )}
      </div>

      {/* Secondary Bottom Navigation Bar (Detalles, Gastos, Incidencia) */}
      {pasaporte && (
        <SecondaryTripNavBar trasladoId={id} pasaporte={pasaporte} />
      )}

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
