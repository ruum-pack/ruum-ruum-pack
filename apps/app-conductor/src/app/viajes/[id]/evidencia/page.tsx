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
    const remotas = await obtenerEvidenciaDeTraslado(cliente, id, tipoEvidencia);
    const remotasFirmadas = await firmarUrlsEvidencia(cliente, remotas);
    setFotos(remotasFirmadas);
  }, [id]);

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
      const cliente = crearClienteNavegador();
      
      // Upload file directly using Supabase Storage
      const bucketName = "evidencia";
      const blob = await fetch(dataUrl).then((r) => r.blob());
      const ext = blob.type.split("/")[1] || "jpg";
      const filePath = `${id}/${tipo}/${angulo}-${Date.now()}.${ext}`;

      const { error: uploadError } = await cliente.storage
        .from(bucketName)
        .upload(filePath, blob, { contentType: blob.type, cacheControl: "3600" });

      if (uploadError) throw uploadError;

      // Upsert record to database
      const { error: insertError } = await cliente.from("evidencia_fotos").upsert(
        {
          traslado_id: id,
          tipo,
          angulo,
          url: filePath,
          capturada_en: new Date().toISOString()
        },
        { onConflict: "traslado_id,tipo,angulo" }
      );

      if (insertError) throw insertError;

      setAvisoExito(`Fotografía "${angulo}" subida correctamente.`);
      await refrescarEvidencia(tipo);
    } catch (err) {
      setError(traducirErrorOperativo(err, "No pudimos guardar la fotografía."));
    } finally {
      setEnviando(null);
    }
  }

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
        <div className="w-8 h-8 border-4 border-[#00BBC9] border-t-transparent rounded-full animate-spin mx-auto mb-4" />
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
              ruum<span className="text-[#00BBC9]">ruum</span>
            </span>
            <div className="bg-[#1C2C24] border border-[#234D37] px-2 py-0.5 rounded-md">
              <span className="font-display text-[9px] font-black text-[#00BBC9] tracking-wider">CONDUCTOR</span>
            </div>
          </div>
          
          <nav className="flex items-center gap-4 text-xs font-body text-text-secondary">
            <Link href="/panel" className="hover:text-text-primary transition-colors">Inicio</Link>
            <Link href="/viajes" className="text-signal hover:text-text-primary transition-colors font-extrabold border-b-2 border-signal pb-0.5">Traslados</Link>
            <Link href="/ganancias" className="hover:text-text-primary transition-colors">Ganancias</Link>
          </nav>
        </header>

        {/* Step Breadcrumbs Tracker */}
        <div className="mt-6 flex flex-col gap-1">
          <span className="font-body text-[10px] text-text-tertiary font-bold tracking-wide">
            Traslados › {origen} › <span className="text-text-primary">Paso 2 de 2</span>
          </span>
          <span className="font-display text-[9px] font-black text-[#00BBC9] tracking-widest uppercase mt-0.5">
            RECOLECCIÓN DE UNIDAD
          </span>
          <h1 className="font-display text-2xl font-black text-text-primary leading-tight mt-1">
            Evidencias
          </h1>
          <p className="font-body text-xs text-text-secondary leading-relaxed mt-1">
            Captura las fotografías y datos del vehículo antes de iniciar el traslado.
          </p>
        </div>

        {/* Progress Bar Container */}
        <div className="mt-4 flex flex-col gap-1.5">
          <div className="w-full bg-surface-elevated/45 rounded-full h-2 overflow-hidden border border-border/20 relative">
            <div 
              className="bg-[#00BBC9] h-full transition-all duration-300"
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
            <span className="w-5 h-5 rounded-md bg-[#1C2C24] border border-[#234D37] text-[#00BBC9] flex items-center justify-center font-display text-[10px] font-bold">
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
                  : "bg-surface-elevated/20 border-border/40 border-dashed hover:border-[#00BBC9]/60"
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
                  : "bg-surface-elevated/20 border-border/40 border-dashed hover:border-[#00BBC9]/60"
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
                  : "bg-surface-elevated/20 border-border/40 border-dashed hover:border-[#00BBC9]/60"
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
                  : "bg-surface-elevated/20 border-border/40 border-dashed hover:border-[#00BBC9]/60"
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
                  : "bg-surface-elevated/20 border-border/40 border-dashed hover:border-[#00BBC9]/60"
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
                  : "bg-surface-elevated/20 border-border/40 border-dashed hover:border-[#00BBC9]/60"
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
            className="w-full bg-surface-elevated/20 border border-border/30 rounded-2xl p-4.5 text-xs font-body text-text-secondary leading-relaxed outline-hidden focus:border-[#00BBC9]/50 transition-all font-inherit"
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
          ruumruum · evidencias generadas previas al inicio del traslado
        </div>

      </div>
    </div>
  );
}
