"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Aviso } from "@ruum/ui";
import type { Database } from "@ruum/shared/types";
import { traducirErrorOperativo } from "@ruum/shared/utils";
import { crearClienteNavegador } from "../../../lib/supabase-browser";
import { avanzarEstadoTraslado } from "@ruum/api/services";
import { SecondaryTripNavBar } from "./SecondaryTripNavBar";

type PasaporteRow = Database["public"]["Views"]["pasaporte_digital"]["Row"];
type EstadoTraslado = Database["public"]["Enums"]["estado_traslado"];

interface InspeccionData {
  tipo: "inicial" | "final";
  combustible: string | null;
  kilometraje: number | null;
  llaves_recibidas: string | null;
  tarjeta_circulacion: string | null;
  talon_verificacion: string | null;
  holograma_verificacion: boolean | null;
  placa_delantera: string | null;
  placa_trasera: string | null;
  notas: string | null;
}

interface GastoData {
  id: string;
  tipo: "combustible" | "caseta" | "maniobra" | "estadia" | "penalizacion" | "otro";
  monto: number;
  descripcion: string | null;
  registrado_en: string;
}

export function CierreTrasladoDetails({
  pasaporte,
  volver
}: {
  pasaporte: PasaporteRow;
  volver: string;
}) {
  const router = useRouter();
  const trasladoId = pasaporte.traslado_id || "";
  const estadoActual = pasaporte.estado as EstadoTraslado;

  // State
  const [inspeccionInicial, setInspeccionInicial] = useState<InspeccionData | null>(null);
  const [inspeccionFinal, setInspeccionFinal] = useState<InspeccionData | null>(null);
  const [gastos, setGastos] = useState<GastoData[]>([]);
  
  // Form states for adding expense
  const [tipoGasto, setTipoGasto] = useState<GastoData["tipo"]>("caseta");
  const [montoGasto, setMontoGasto] = useState("");
  const [descGasto, setDescGasto] = useState("");
  const [comprobanteArchivo, setComprobanteArchivo] = useState<File | null>(null);

  const [confirmarCierreAbierto, setConfirmarCierreAbierto] = useState(false);

  const [cargando, setCargando] = useState(true);
  const [procesando, setProcesando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [avisoExito, setAvisoExito] = useState<string | null>(null);
  const [soporteAbierto, setSoporteAbierto] = useState(false);

  useEffect(() => {
    async function loadCierreData() {
      if (!trasladoId) return;
      setCargando(true);
      setError(null);
      try {
        const cliente = crearClienteNavegador() as any;
        
        // Fetch inspections
        const { data: insps, error: inspError } = await cliente
          .from("evidencia_inspecciones")
          .select("*")
          .eq("traslado_id", trasladoId);

        if (inspError) throw inspError;

        if (insps) {
          const inicial = insps.find((i: any) => i.tipo === "inicial") as InspeccionData | undefined;
          const final = insps.find((i: any) => i.tipo === "final") as InspeccionData | undefined;
          if (inicial) setInspeccionInicial(inicial);
          if (final) setInspeccionFinal(final);
        }

        // Fetch expenses
        const { data: gst, error: gstError } = await cliente
          .from("gastos_traslado")
          .select("*")
          .eq("traslado_id", trasladoId)
          .order("registrado_en", { ascending: false });

        if (gstError) throw gstError;
        if (gst) {
          setGastos(
            gst.map((g: any) => ({
              id: g.id,
              tipo: g.tipo as GastoData["tipo"],
              monto: Number(g.monto),
              descripcion: g.descripcion,
              registrado_en: g.registrado_en
            }))
          );
        }
      } catch (err) {
        setError(traducirErrorOperativo(err, "No pudimos cargar la información de cierre."));
      } finally {
        setCargando(false);
      }
    }
    loadCierreData();
  }, [trasladoId]);

  async function handleAgregarGasto(e: React.FormEvent) {
    e.preventDefault();
    if (procesando) return;
    setError(null);

    const montoVal = Number(montoGasto);
    if (isNaN(montoVal) || montoVal <= 0) {
      setError("El monto del gasto debe ser un número mayor a cero.");
      return;
    }

    if ((tipoGasto === "combustible" || tipoGasto === "caseta") && !comprobanteArchivo) {
      setError(`El comprobante de pago (foto del ticket) es obligatorio para registrar gastos de ${labelGasto(tipoGasto)}.`);
      return;
    }

    setProcesando(true);
    try {
      const cliente = crearClienteNavegador() as any;
      
      const finalDesc = comprobanteArchivo 
        ? `[TICKET ADJUNTO] ${descGasto.trim() || labelGasto(tipoGasto)}`
        : descGasto.trim() || null;

      const { data, error: insertError } = await cliente
        .from("gastos_traslado")
        .insert({
          traslado_id: trasladoId,
          tipo: tipoGasto,
          monto: montoVal,
          descripcion: finalDesc
        })
        .select()
        .single();

      if (insertError) throw insertError;

      if (data) {
        const nuevoGasto: GastoData = {
          id: data.id,
          tipo: data.tipo as GastoData["tipo"],
          monto: Number(data.monto),
          descripcion: data.descripcion,
          registrado_en: data.registrado_en
        };
        setGastos((prev) => [nuevoGasto, ...prev]);
        setMontoGasto("");
        setDescGasto("");
        setComprobanteArchivo(null);
      }
    } catch (err) {
      setError(traducirErrorOperativo(err, "No pudimos registrar el gasto."));
    } finally {
      setProcesando(false);
    }
  }

  async function handleEliminarGasto(id: string) {
    if (procesando) return;
    setError(null);
    setProcesando(true);
    try {
      const cliente = crearClienteNavegador() as any;
      const { error: deleteError } = await cliente
        .from("gastos_traslado")
        .delete()
        .eq("id", id);

      if (deleteError) throw deleteError;
      setGastos((prev) => prev.filter((g) => g.id !== id));
    } catch (err) {
      setError(traducirErrorOperativo(err, "No pudimos eliminar el gasto."));
    } finally {
      setProcesando(false);
    }
  }

  async function handleFinalizarTraslado() {
    if (procesando) return;
    setProcesando(true);
    setError(null);
    setAvisoExito(null);

    // 1. Validation: Kilometraje final must be greater than initial
    if (
      inspeccionInicial?.kilometraje &&
      inspeccionFinal?.kilometraje &&
      inspeccionFinal.kilometraje <= inspeccionInicial.kilometraje
    ) {
      setError(`Incoherencia en kilometraje: El kilometraje final (${inspeccionFinal.kilometraje.toLocaleString("es-MX")} km) debe ser mayor al inicial (${inspeccionInicial.kilometraje.toLocaleString("es-MX")} km). Por favor, contacta a soporte o corrige el registro.`);
      setProcesando(false);
      return;
    }

    try {
      const cliente = crearClienteNavegador();

      // 2. Auto-save pending expense if fields are filled
      if (montoGasto.trim() !== "") {
        const montoVal = Number(montoGasto);
        if (!isNaN(montoVal) && montoVal > 0) {
          // If it requires a ticket but none is selected, block the finalization
          if ((tipoGasto === "combustible" || tipoGasto === "caseta") && !comprobanteArchivo) {
            setError(`Tienes un gasto de ${labelGasto(tipoGasto)} pendiente por agregar. Para registrarlo, debes adjuntar la foto del ticket.`);
            setProcesando(false);
            return;
          }

          const finalDesc = comprobanteArchivo 
            ? `[TICKET ADJUNTO] ${descGasto.trim() || labelGasto(tipoGasto)}`
            : descGasto.trim() || null;

          const { error: insertError } = await (cliente as any)
            .from("gastos_traslado")
            .insert({
              traslado_id: trasladoId,
              tipo: tipoGasto,
              monto: montoVal,
              descripcion: finalDesc
            });
          if (insertError) throw insertError;
          
          setMontoGasto("");
          setDescGasto("");
          setComprobanteArchivo(null);
        }
      }
      
      // 3. Transición segura a entrega_confirmada y servicio_cerrado
      if (estadoActual === "evidencia_final_completada") {
        await avanzarEstadoTraslado(cliente, trasladoId, "evidencia_final_completada");
        await new Promise((resolve) => setTimeout(resolve, 300));
        await avanzarEstadoTraslado(cliente, trasladoId, "entrega_confirmada");
      } else if (estadoActual === "entrega_confirmada") {
        await avanzarEstadoTraslado(cliente, trasladoId, "entrega_confirmada");
      }

      setAvisoExito("¡Vehículo entregado y traslado finalizado exitosamente!");
      setTimeout(() => {
        router.push("/viajes");
      }, 1500);
    } catch (err) {
      setError(traducirErrorOperativo(err, "No pudimos completar el cierre del traslado."));
      setProcesando(false);
    }
  }

  const labelGasto = (tipo: GastoData["tipo"]) => {
    switch (tipo) {
      case "combustible": return "Gasolina";
      case "caseta": return "Caseta";
      case "maniobra": return "Maniobra";
      case "estadia": return "Estadía";
      case "penalizacion": return "Penalización";
      default: return "Otro";
    }
  };

  const totalGastos = gastos.reduce((sum, g) => sum + g.monto, 0);

  const renderBadge = () => {
    if (estadoActual === "evidencia_final_completada") {
      return (
        <span className="bg-amber-500/10 border border-amber-500/30 text-amber-500 px-3 py-1 rounded-full text-[10px] font-black tracking-widest font-display uppercase">
          Pendiente de Entrega
        </span>
      );
    }
    if (estadoActual === "entrega_confirmada") {
      return (
        <span className="bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 px-3 py-1 rounded-full text-[10px] font-black tracking-widest font-display uppercase">
          Entrega Confirmada
        </span>
      );
    }
    return (
      <span className="bg-emerald-600/20 border border-emerald-500/30 text-emerald-500 px-3 py-1 rounded-full text-[10px] font-black tracking-widest font-display uppercase">
        Servicio Cerrado
      </span>
    );
  };

  // Fuel level display helper
  const renderCombustible = (fuelText: string | null) => {
    if (!fuelText) return "No registrado";
    return fuelText;
  };

  // Kilometraje diff helper
  const getKmDiff = () => {
    if (!inspeccionInicial?.kilometraje || !inspeccionFinal?.kilometraje) return null;
    return inspeccionFinal.kilometraje - inspeccionInicial.kilometraje;
  };

  if (cargando) {
    return (
      <div className="mx-auto w-full max-w-md px-6 py-20 text-center text-text-primary">
        <div className="w-8 h-8 border-4 border-[#00B4D8] border-t-transparent rounded-full animate-spin mx-auto mb-4" />
        <p className="font-body text-sm font-semibold">Cargando detalles de cierre...</p>
      </div>
    );
  }

  // --- NUEVA PANTALLA DE CIERRE/ÉXITO LIMPIA (ESTADO CERRADO) ---
  if (estadoActual === "servicio_cerrado") {
    const gananciaTotal = pasaporte.ganancia_conductor || 0;
    const totalGastos = gastos.reduce((acc, g) => acc + g.monto, 0);

    return (
      <div className="mx-auto w-full max-w-md bg-surface min-h-[calc(100vh-100px)] flex flex-col items-center justify-center text-text-primary pb-6 px-4 animate-in fade-in zoom-in duration-500">
        
        <div className="w-24 h-24 rounded-full bg-signal/15 border-2 border-signal/30 flex items-center justify-center mb-6 shadow-[0_0_40px_rgba(255,196,0,0.15)]">
          <svg className="w-12 h-12 text-signal" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" /><polyline points="22 4 12 14.01 9 11.01" />
          </svg>
        </div>

        <span className="text-[10px] text-signal font-bold uppercase tracking-widest mb-2">
          TRASLADO COMPLETADO
        </span>
        <h1 className="font-display text-3xl font-black text-center mb-2 leading-tight text-text-primary">
          ¡Excelente trabajo!
        </h1>
        <p className="font-body text-text-secondary text-center mb-8 px-4 text-sm">
          Has completado el traslado #{trasladoId.slice(0, 8).toUpperCase()} con trazabilidad certificada.
        </p>

        <div className="bg-surface-elevated border border-border/20 rounded-3xl p-6 w-full shadow-lg relative overflow-hidden">
          <span className="text-[10px] text-text-tertiary font-bold uppercase tracking-widest block text-center mb-1">
            Ganancia Neta del Viaje
          </span>
          <div className="text-center">
            <span className="font-display text-4xl font-black text-signal tabular-nums">
              ${gananciaTotal.toLocaleString("es-MX", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
            <span className="text-xs text-text-secondary ml-1.5 font-bold uppercase">MXN</span>
          </div>

          {totalGastos > 0 && (
            <div className="mt-4 pt-4 border-t border-border/15 flex justify-between items-center text-sm">
              <span className="text-text-secondary text-xs">Gastos registrados reembolsables</span>
              <span className="font-bold text-route-action font-mono text-xs">
                + ${totalGastos.toLocaleString("es-MX", { minimumFractionDigits: 2 })}
              </span>
            </div>
          )}
        </div>

        <div className="mt-8 w-full flex flex-col gap-3">
          <Link
            href="/viajes"
            className="flex min-h-[48px] w-full items-center justify-center gap-2 rounded-2xl bg-signal hover:bg-signal/85 px-4 py-3.5 font-display text-xs font-black tracking-widest text-slate-950 uppercase shadow-md active:scale-[0.98] transition-all cursor-pointer"
          >
            VOLVER AL PANEL
          </Link>
          <Link
            href={`/viajes/${trasladoId}/detalles`}
            className="text-text-tertiary hover:text-text-primary text-xs font-bold uppercase tracking-widest text-center py-2 transition-colors"
          >
            Ver resumen completo
          </Link>
        </div>
      </div>
    );
  }

  const writable = estadoActual === "evidencia_final_completada";

  return (
    <div className="mx-auto w-full max-w-md md:max-w-xl px-4 py-5 flex flex-col justify-between min-h-screen text-text-primary">
      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        .animate-fade-in {
          animation: fadeIn 0.3s ease-out forwards;
        }
      ` }} />

      <div className="w-full flex flex-col flex-1 animate-fade-in pb-36">
        
        {/* Header (Volver, Detalle del traslado, ID, Ayuda) */}
        <header className="grid grid-cols-[auto_1fr_auto] items-center pb-3 border-b border-border/10 select-none">
          <Link
            href={volver}
            className="p-1.5 text-text-secondary hover:text-text-primary transition-colors shrink-0 rounded-full hover:bg-surface-elevated/60"
            aria-label="Volver"
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <polyline points="15 18 9 12 15 6" />
            </svg>
          </Link>
          <div className="flex flex-col items-center justify-center text-center">
            <span className="font-display text-sm font-bold text-text-primary">Cierre de Traslado</span>
            <span className="font-mono text-[10px] text-text-tertiary mt-0.5 tracking-wider uppercase">ID {trasladoId.slice(0, 8).toUpperCase()}</span>
          </div>
          <Link
            href={`/cuenta/soporte?traslado=${trasladoId}`}
            className="flex h-9 w-9 items-center justify-center rounded-full border border-border/15 bg-[#0E1524]/60 hover:bg-[#0E1524] text-text-primary hover:text-[#00B4D8] transition-colors shadow-xs"
            aria-label="Ayuda"
          >
            <span className="font-display text-xs font-black">?</span>
          </Link>
        </header>

        {/* Header status badge section */}
        <div className="mt-4 flex flex-col gap-1.5">
          <div className="flex justify-between items-center">
            <span className="font-body text-[10px] text-text-tertiary font-bold tracking-wide uppercase">
              REVISION Y CONCILIACION
            </span>
            {renderBadge()}
          </div>
          <h1 className="font-display text-2xl font-black text-text-primary leading-tight mt-0.5">
            Cierre de Traslado
          </h1>
          <p className="font-body text-xs text-text-secondary leading-relaxed mt-0.5">
            Resumen de conciliación de entrega y registro de gastos finales.
          </p>
        </div>

        {/* Card: Vehicle and Route info */}
        <div className="mt-5 bg-[#0E1524] border border-border/20 rounded-2xl p-4.5 shadow-xs">
          <div className="flex flex-col gap-3">
            <div className="flex justify-between items-start">
              <div>
                <span className="font-display text-[9px] font-black text-[#00B4D8] tracking-widest uppercase">
                  UNIDAD
                </span>
                <h3 className="font-display text-sm font-bold text-text-primary mt-0.5">
                  {pasaporte.vehiculo_marca} {pasaporte.vehiculo_modelo} {pasaporte.vehiculo_anio}
                </h3>
                <p className="font-body text-[11px] text-text-tertiary mt-0.5">
                  Placas: <span className="text-text-secondary font-bold font-mono">{pasaporte.vehiculo_placas || "Por confirmar"}</span>
                </p>
              </div>
              <div className="text-right">
                <span className="font-display text-[9px] font-black text-[#00B4D8] tracking-widest uppercase">
                  FOLIO VIAJE
                </span>
                <p className="font-display text-xs font-black text-text-primary mt-0.5 font-mono">
                  #{trasladoId.slice(0, 8).toUpperCase()}
                </p>
              </div>
            </div>
            
            <div className="border-t border-border/10 pt-3 flex justify-between items-center text-xs font-body text-text-secondary">
              <div className="flex flex-col">
                <span className="text-[9px] text-text-tertiary font-black font-display tracking-widest uppercase">ORIGEN</span>
                <span className="font-bold text-text-primary mt-0.5">{pasaporte.origen_ciudad}</span>
              </div>
              <span className="text-text-tertiary font-bold">➔</span>
              <div className="flex flex-col text-right">
                <span className="text-[9px] text-text-tertiary font-black font-display tracking-widest uppercase">DESTINO</span>
                <span className="font-bold text-text-primary mt-0.5">{pasaporte.destino_ciudad}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Card: Checklist Conciliación */}
        <section className="mt-6 flex flex-col gap-3">
          <div className="flex items-center gap-2">
            <span className="w-5 h-5 rounded-md bg-[#1C2C24] border border-[#234D37] text-[#00B4D8] flex items-center justify-center font-display text-[10px] font-bold">
              1
            </span>
            <h2 className="font-display text-xs font-black text-text-tertiary tracking-widest uppercase">
              CONCILIACIÓN DE EVIDENCIAS
            </h2>
          </div>

          <div className="bg-surface-elevated border border-border/20 rounded-2xl overflow-hidden text-xs font-body shadow-xs">
            <div className="grid grid-cols-3 gap-2 bg-surface border-b border-border/15 p-3 font-bold text-text-tertiary text-[10px] tracking-wider font-display uppercase">
              <span>Elemento</span>
              <span className="text-center">Origen (Inicial)</span>
              <span className="text-center">Entrega (Final)</span>
            </div>
            
            <div className="flex flex-col divide-y divide-border/10">
              <div className="grid grid-cols-3 gap-2 p-3 items-center">
                <span className="font-bold text-text-secondary">Kilometraje</span>
                <span className="text-center text-text-primary font-bold font-mono">
                  {inspeccionInicial?.kilometraje ? `${inspeccionInicial.kilometraje.toLocaleString("es-MX")} km` : "—"}
                </span>
                <span className="text-center text-text-primary font-bold font-mono">
                  {inspeccionFinal?.kilometraje ? `${inspeccionFinal.kilometraje.toLocaleString("es-MX")} km` : "—"}
                </span>
              </div>

              {getKmDiff() !== null && (
                <div className="grid grid-cols-3 gap-2 p-2.5 bg-signal/10 items-center">
                  <span className="font-bold text-signal pl-1 text-[11px]">Distancia recorrida</span>
                  <span />
                  <span className="text-center text-signal font-black font-display text-[13px] font-mono">
                    +{getKmDiff()?.toLocaleString("es-MX")} km
                  </span>
                </div>
              )}

              <div className="grid grid-cols-3 gap-2 p-3 items-center">
                <span className="font-bold text-text-secondary">Gasolina (Nivel)</span>
                <span className="text-center text-text-primary font-bold">
                  {renderCombustible(inspeccionInicial?.combustible || null)}
                </span>
                <span className="text-center text-text-primary font-bold">
                  {renderCombustible(inspeccionFinal?.combustible || null)}
                </span>
              </div>

              <div className="grid grid-cols-3 gap-2 p-3 items-center">
                <span className="font-bold text-text-secondary">Llaves</span>
                <span className="text-center text-text-primary">
                  {inspeccionInicial?.llaves_recibidas ? `${inspeccionInicial.llaves_recibidas} pz` : "—"}
                </span>
                <span className="text-center text-text-primary">
                  {inspeccionFinal?.llaves_recibidas ? `${inspeccionFinal.llaves_recibidas} pz` : "—"}
                </span>
              </div>

              <div className="grid grid-cols-3 gap-2 p-3 items-center">
                <span className="font-bold text-text-secondary">Tarjeta Circulación</span>
                <span className="text-center text-text-primary">
                  {inspeccionInicial?.tarjeta_circulacion === "si" ? "Sí" : "No"}
                </span>
                <span className="text-center text-text-primary">
                  {inspeccionFinal?.tarjeta_circulacion === "si" ? "Sí" : "No"}
                </span>
              </div>

              <div className="grid grid-cols-3 gap-2 p-3 items-center">
                <span className="font-bold text-text-secondary">Placa Delantera</span>
                <span className="text-center text-text-primary">
                  {inspeccionInicial?.placa_delantera === "si" ? "Sí" : "No"}
                </span>
                <span className="text-center text-text-primary">
                  {inspeccionFinal?.placa_delantera === "si" ? "Sí" : "No"}
                </span>
              </div>

              <div className="grid grid-cols-3 gap-2 p-3 items-center">
                <span className="font-bold text-text-secondary">Placa Trasera</span>
                <span className="text-center text-text-primary">
                  {inspeccionInicial?.placa_trasera === "si" ? "Sí" : "No"}
                </span>
                <span className="text-center text-text-primary">
                  {inspeccionFinal?.placa_trasera === "si" ? "Sí" : "No"}
                </span>
              </div>
            </div>
          </div>

          {/* Observaciones Comparison */}
          <div className="bg-surface-elevated border border-border/20 rounded-2xl p-4 flex flex-col gap-3 text-xs font-body mt-1">
            {inspeccionInicial?.notas ? (
              <div className="flex flex-col gap-1">
                <span className="font-bold text-text-tertiary text-[10px] tracking-wider font-display uppercase">Notas de Recolección (Origen)</span>
                <p className="text-text-secondary leading-relaxed italic bg-surface p-3 rounded-xl border border-border/10">{inspeccionInicial.notas}</p>
              </div>
            ) : null}
            {inspeccionFinal?.notas ? (
              <div className="flex flex-col gap-1">
                <span className="font-bold text-text-tertiary text-[10px] tracking-wider font-display uppercase">Notas de Entrega (Destino)</span>
                <p className="text-text-secondary leading-relaxed italic bg-surface p-3 rounded-xl border border-border/10">{inspeccionFinal.notas}</p>
              </div>
            ) : (
              <div className="flex flex-col gap-1">
                <span className="font-bold text-text-tertiary text-[10px] tracking-wider font-display uppercase">Notas de Entrega (Destino)</span>
                <p className="text-text-tertiary italic">Sin comentarios registrados al entregar.</p>
              </div>
            )}
          </div>
        </section>

        {/* Section: Gastos de Traslado */}
        <section className="mt-6 flex flex-col gap-3">
          <div className="flex items-center gap-2">
            <span className="w-5 h-5 rounded-md bg-route-action/15 border border-route-action/30 text-route-action flex items-center justify-center font-display text-[10px] font-bold">
              2
            </span>
            <h2 className="font-display text-xs font-black text-text-tertiary tracking-widest uppercase">
              GASTOS DEL TRASLADO
            </h2>
          </div>

          {/* Formulario de Registro de Gastos */}
          {writable && (
            <form onSubmit={handleAgregarGasto} className="bg-surface-elevated border border-border/25 shadow-md rounded-2xl p-4.5 flex flex-col gap-3.5">
              <div className="flex items-center gap-1.5 border-b border-border/15 pb-2">
                <span className="text-sm">💵</span>
                <span className="font-display text-xs font-bold text-text-primary">Registrar Nuevo Gasto</span>
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div className="flex flex-col gap-1">
                  <label htmlFor="tipo_gasto" className="font-display text-[9px] font-black text-text-tertiary tracking-widest uppercase pl-0.5">Tipo de Gasto</label>
                  <select
                    id="tipo_gasto"
                    value={tipoGasto}
                    onChange={(e) => setTipoGasto(e.target.value as GastoData["tipo"])}
                    className="w-full bg-surface border border-border/40 rounded-xl px-3 py-2 text-xs font-body text-text-primary outline-hidden focus:border-route-action transition-colors font-inherit h-11 select-none cursor-pointer"
                  >
                    <option value="caseta">Caseta</option>
                    <option value="combustible">Gasolina</option>
                    <option value="maniobra">Maniobra</option>
                    <option value="estadia">Estadía</option>
                    <option value="penalizacion">Penalización</option>
                    <option value="otro">Otro</option>
                  </select>
                </div>
                <div className="flex flex-col gap-1">
                  <label htmlFor="monto_gasto" className="font-display text-[9px] font-black text-text-tertiary tracking-widest uppercase pl-0.5">Monto ($)</label>
                  <input
                    id="monto_gasto"
                    type="number"
                    step="0.01"
                    placeholder="0.00"
                    value={montoGasto}
                    onChange={(e) => setMontoGasto(e.target.value)}
                    required
                    className="w-full bg-surface border border-border/40 rounded-xl px-3 py-2 text-xs font-body text-text-primary outline-hidden focus:border-route-action transition-colors font-inherit h-11 font-mono font-bold"
                  />
                </div>
              </div>

              <div className="flex flex-col gap-1">
                <label htmlFor="descripcion_gasto" className="font-display text-[9px] font-black text-text-tertiary tracking-widest uppercase pl-0.5">Descripción / Concepto</label>
                <input
                  id="descripcion_gasto"
                  type="text"
                  placeholder="Ej. Caseta México-Querétaro"
                  value={descGasto}
                  onChange={(e) => setDescGasto(e.target.value)}
                  className="w-full bg-surface border border-border/40 rounded-xl px-3 py-2 text-xs font-body text-text-primary outline-hidden focus:border-route-action transition-colors font-inherit h-11"
                />
              </div>

              {/* Botón de Subida de Ticket */}
              <div className="flex flex-col gap-1.5">
                <span className="font-display text-[9px] font-black text-text-tertiary tracking-widest uppercase pl-0.5">
                  Ticket / Comprobante (Obligatorio para Gasolina y Casetas)
                </span>
                <label
                  htmlFor="comprobante_upload"
                  className={`w-full min-h-[56px] rounded-2xl border-2 border-dashed flex flex-col items-center justify-center p-3 text-xs font-body cursor-pointer select-none transition-all touch-manipulation active:scale-[0.99] ${
                    comprobanteArchivo
                      ? "border-emerald-500/60 bg-emerald-500/10 text-emerald-400 font-bold"
                      : "border-route-action/40 bg-surface hover:bg-surface-elevated text-text-secondary hover:border-route-action"
                  }`}
                >
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => setComprobanteArchivo(e.target.files?.[0] || null)}
                    className="hidden"
                    id="comprobante_upload"
                  />
                  <div className="flex items-center gap-2">
                    <span className="text-xl">📷</span>
                    <span className="font-bold text-xs">
                      {comprobanteArchivo ? `✓ ${comprobanteArchivo.name.slice(0, 26)}...` : "Toca para adjuntar foto del ticket"}
                    </span>
                  </div>
                  {!comprobanteArchivo && (
                    <span className="text-[10px] text-text-tertiary mt-0.5">Soporta JPG, PNG y fotos directas de cámara</span>
                  )}
                </label>
                {comprobanteArchivo && (
                  <button
                    type="button"
                    onClick={() => setComprobanteArchivo(null)}
                    className="text-red-400 hover:text-red-300 font-bold text-xs cursor-pointer bg-transparent border-none text-left pl-1"
                  >
                    ✕ Quitar ticket adjunto
                  </button>
                )}
              </div>

              {/* Botón Acción Secundaria */}
              <button
                type="submit"
                disabled={procesando}
                className="w-full min-h-[46px] rounded-xl bg-route-action/15 hover:bg-route-action/25 border border-route-action/40 text-route-action hover:text-white font-display text-xs font-black tracking-wider transition-all cursor-pointer flex items-center justify-center gap-1.5 select-none shadow-xs mt-1 active:scale-98"
              >
                + REGISTRAR GASTO
              </button>
            </form>
          )}

          {/* Tabla / Lista Separada de Gastos Guardados */}
          <div className="bg-surface-elevated border border-border/20 rounded-2xl overflow-hidden text-xs font-body shadow-xs">
            <div className="grid grid-cols-12 bg-surface border-b border-border/15 p-3 font-bold text-text-tertiary text-[10px] tracking-wider font-display uppercase">
              <span className="col-span-4">Concepto</span>
              <span className="col-span-3 text-center">Tipo</span>
              <span className="col-span-3 text-right">Monto</span>
              <span className="col-span-2" />
            </div>

            {gastos.length === 0 ? (
              <div className="p-6 text-center text-text-tertiary italic">
                No hay gastos registrados en este traslado.
              </div>
            ) : (
              <div className="flex flex-col divide-y divide-border/10">
                {gastos.map((g) => (
                  <div key={g.id} className="grid grid-cols-12 p-3 items-center">
                    <div className="col-span-4 flex flex-col">
                      <span className="font-semibold text-text-primary truncate">{g.descripcion || "Sin descripción"}</span>
                      <span className="text-[9px] text-text-tertiary font-mono">
                        {new Date(g.registrado_en).toLocaleDateString("es-MX", { day: "numeric", month: "short" })}
                      </span>
                    </div>
                    <span className="col-span-3 text-center font-bold text-text-secondary">{labelGasto(g.tipo)}</span>
                    <span className="col-span-3 text-right font-bold text-text-primary font-mono">${g.monto.toFixed(2)}</span>
                    <div className="col-span-2 text-right">
                      {writable && (
                        <button
                          type="button"
                          onClick={() => handleEliminarGasto(g.id)}
                          disabled={procesando}
                          className="text-red-400 hover:text-red-500 font-extrabold text-[13px] px-2.5 py-1 cursor-pointer bg-transparent border-none outline-hidden"
                          title="Eliminar gasto"
                        >
                          ✕
                        </button>
                      )}
                    </div>
                  </div>
                ))}

                {/* Sum of expenses */}
                <div className="grid grid-cols-12 p-3.5 bg-surface font-bold items-center border-t border-border/15">
                  <span className="col-span-7 font-display text-[10px] font-black text-text-tertiary tracking-widest uppercase">Total Gastos Registrados</span>
                  <span className="col-span-3 text-right font-display text-sm font-black text-signal font-mono">${totalGastos.toFixed(2)}</span>
                  <span className="col-span-2" />
                </div>
              </div>
            )}
          </div>
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

      </div>

      {/* Sticky footer for action buttons (Fixed directly ABOVE Secondary Trip Bottom Bar) */}
      <div className="fixed bottom-[60px] inset-x-0 z-40 bg-surface/95 backdrop-blur-md border-t border-border/20 py-3 px-4 shadow-2xl select-none">
        <div className="max-w-md md:max-w-xl mx-auto flex flex-col gap-2">
          
          {/* Leyenda Legal / Aclaratoria */}
          <div className="bg-surface-elevated border border-border/20 rounded-xl px-3 py-1.5 text-center text-[10px] font-body text-text-secondary font-semibold">
            Ruum Ruum by MoviliaX · Seguridad, evidencia y trazabilidad
          </div>

          {writable ? (
            <button
              type="button"
              onClick={() => setConfirmarCierreAbierto(true)}
              disabled={procesando}
              className="w-full min-h-[48px] rounded-2xl bg-signal hover:bg-signal/85 text-slate-950 font-display text-xs font-black tracking-widest uppercase transition-all cursor-pointer shadow-lg select-none flex items-center justify-center focus:outline-hidden"
            >
              {procesando ? (
                <div className="w-5 h-5 border-2 border-slate-950 border-t-transparent rounded-full animate-spin" />
              ) : (
                "FINALIZAR Y ENTREGAR VEHÍCULO"
              )}
            </button>
          ) : (
            <button
              type="button"
              onClick={() => router.push("/viajes")}
              className="w-full min-h-[48px] rounded-2xl bg-surface-elevated hover:bg-border/60 text-text-primary font-display text-xs font-black tracking-widest uppercase transition-all cursor-pointer shadow-xs select-none flex items-center justify-center"
            >
              VOLVER A TRASLADOS
            </button>
          )}
        </div>
      </div>

      {/* Secondary Bottom Navigation Bar (Detalles, Gastos, Incidencia) */}
      <SecondaryTripNavBar trasladoId={trasladoId} pasaporte={pasaporte} />

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

      {/* Confirmation Modal for Finalization */}
      {confirmarCierreAbierto && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-fade-in">
          <div className="w-full max-w-sm bg-[#090D1A] border border-border/40 rounded-3xl p-6 flex flex-col gap-4 shadow-2xl animate-slideUp">
            <h3 className="font-display text-base font-black text-text-primary uppercase tracking-wider flex items-center gap-2">
              ⚠️ Confirmar Entrega
            </h3>
            <p className="font-body text-xs text-text-secondary leading-relaxed">
              ¿Estás seguro de finalizar el traslado y entregar el vehículo? Esta acción es definitiva y no se puede deshacer.
            </p>
            <div className="flex gap-3 mt-2">
              <button
                type="button"
                onClick={() => setConfirmarCierreAbierto(false)}
                className="flex-1 min-h-11 rounded-xl bg-transparent border border-border/80 text-text-secondary hover:text-text-primary font-display text-xs font-black tracking-wider transition-colors cursor-pointer select-none"
              >
                CANCELAR
              </button>
              <button
                type="button"
                onClick={() => {
                  setConfirmarCierreAbierto(false);
                  handleFinalizarTraslado();
                }}
                disabled={procesando}
                className="flex-[2] min-h-11 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-display text-xs font-black tracking-wider transition-colors cursor-pointer shadow-md select-none flex items-center justify-center"
              >
                {procesando ? (
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  "SÍ, ENTREGAR"
                )}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
