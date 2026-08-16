"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Aviso } from "@ruum/ui";
import type { Database } from "@ruum/shared/types";
import { traducirErrorOperativo } from "@ruum/shared/utils";
import { crearClienteNavegador } from "../../../lib/supabase-browser";
import { avanzarEstadoTraslado } from "@ruum/api/services";

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
      
      // 3. Transition: evidencia_final_completada -> entrega_confirmada
      await avanzarEstadoTraslado(cliente, trasladoId, "evidencia_final_completada");
      
      // Wait 300ms for Supabase trigger propagation
      await new Promise((resolve) => setTimeout(resolve, 300));
      
      // 4. Transition: entrega_confirmada -> servicio_cerrado
      await avanzarEstadoTraslado(cliente, trasladoId, "entrega_confirmada");

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

  const writable = estadoActual === "evidencia_final_completada";

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

      <div className="w-full flex flex-col flex-1 animate-fade-in">
        
        {/* Top Header */}
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

        {/* Header section */}
        <div className="mt-6 flex flex-col gap-1.5">
          <div className="flex justify-between items-center">
            <span className="font-body text-[10px] text-text-tertiary font-bold tracking-wide">
              Resumen del Traslado
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
        <div className="mt-6 bg-surface-elevated/45 border border-border/20 rounded-2xl p-4.5">
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
                  TRASLADO ID
                </span>
                <p className="font-display text-xs font-black text-text-primary mt-0.5">
                  {pasaporte.traslado_id?.slice(0, 8).toUpperCase()}
                </p>
              </div>
            </div>
            
            <div className="border-t border-border/10 pt-3 flex justify-between items-center text-xs font-body text-text-secondary">
              <div className="flex flex-col">
                <span className="text-[9px] text-text-tertiary font-black font-display tracking-widest uppercase">ORIGEN</span>
                <span className="font-bold text-text-primary mt-0.5">{pasaporte.origen_ciudad}</span>
              </div>
              <span className="text-text-tertiary">➔</span>
              <div className="flex flex-col text-right">
                <span className="text-[9px] text-text-tertiary font-black font-display tracking-widest uppercase">DESTINO</span>
                <span className="font-bold text-text-primary mt-0.5">{pasaporte.destino_ciudad}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Card: Checklist Conciliación */}
        <section className="mt-8 flex flex-col gap-3">
          <div className="flex items-center gap-2">
            <span className="w-5 h-5 rounded-md bg-[#1C2C24] border border-[#234D37] text-[#00B4D8] flex items-center justify-center font-display text-[10px] font-bold">
              1
            </span>
            <h2 className="font-display text-xs font-black text-text-tertiary tracking-widest uppercase">
              CONCILIACIÓN DE EVIDENCIAS
            </h2>
          </div>

          <div className="bg-surface-elevated/25 border border-border/20 rounded-2xl overflow-hidden text-xs font-body">
            <div className="grid grid-cols-3 gap-2 bg-surface/50 border-b border-border/15 p-3 font-bold text-text-tertiary text-[10px] tracking-wider font-display uppercase">
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
                <div className="grid grid-cols-3 gap-2 p-2.5 bg-emerald-500/5 items-center">
                  <span className="font-bold text-emerald-400 pl-1 text-[11px]">Distancia recorrida</span>
                  <span />
                  <span className="text-center text-emerald-400 font-black font-display text-[13px] font-mono">
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
          <div className="bg-surface-elevated/15 border border-border/20 rounded-2xl p-4.5 flex flex-col gap-3.5 text-xs font-body mt-1">
            {inspeccionInicial?.notas ? (
              <div className="flex flex-col gap-1">
                <span className="font-bold text-text-tertiary text-[10px] tracking-wider font-display uppercase">Notas de Recolección (Origen)</span>
                <p className="text-text-secondary leading-relaxed italic bg-surface/30 p-2.5 rounded-xl">{inspeccionInicial.notas}</p>
              </div>
            ) : null}
            {inspeccionFinal?.notas ? (
              <div className="flex flex-col gap-1">
                <span className="font-bold text-text-tertiary text-[10px] tracking-wider font-display uppercase">Notas de Entrega (Destino)</span>
                <p className="text-text-secondary leading-relaxed italic bg-surface/30 p-2.5 rounded-xl">{inspeccionFinal.notas}</p>
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
        <section className="mt-8 flex flex-col gap-3">
          <div className="flex items-center gap-2">
            <span className="w-5 h-5 rounded-md bg-[#1C2C24] border border-[#234D37] text-[#00B4D8] flex items-center justify-center font-display text-[10px] font-bold">
              2
            </span>
            <h2 className="font-display text-xs font-black text-text-tertiary tracking-widest uppercase">
              GASTOS DEL TRASLADO
            </h2>
          </div>

          {/* Form to add expenses */}
          {writable && (
            <form onSubmit={handleAgregarGasto} className="bg-surface-elevated/45 border border-border/20 rounded-2xl p-4.5 flex flex-col gap-3.5">
              <div className="grid grid-cols-2 gap-2.5">
                <div className="flex flex-col gap-1">
                  <label htmlFor="tipo_gasto" className="font-display text-[9px] font-black text-text-tertiary tracking-widest uppercase pl-0.5">Tipo de Gasto</label>
                  <select
                    id="tipo_gasto"
                    value={tipoGasto}
                    onChange={(e) => setTipoGasto(e.target.value as GastoData["tipo"])}
                    className="w-full bg-surface-elevated/20 border border-border/40 rounded-xl px-3 py-2 text-xs font-body text-text-primary outline-hidden focus:border-[#00B4D8]/50 transition-colors font-inherit h-10 select-none cursor-pointer"
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
                    className="w-full bg-surface-elevated/20 border border-border/40 rounded-xl px-3 py-2 text-xs font-body text-text-primary outline-hidden focus:border-[#00B4D8]/50 transition-colors font-inherit h-10"
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
                  className="w-full bg-surface-elevated/20 border border-border/40 rounded-xl px-3 py-2 text-xs font-body text-text-primary outline-hidden focus:border-[#00B4D8]/50 transition-colors font-inherit h-10"
                />
              </div>

              {/* Ticket upload field */}
              <div className="flex flex-col gap-1">
                <span className="font-display text-[9px] font-black text-text-tertiary tracking-widest uppercase pl-0.5">
                  Ticket / Comprobante (Obligatorio para Gasolina y Casetas)
                </span>
                <div className="flex items-center gap-3">
                  <label
                    htmlFor="comprobante_upload"
                    className={`flex-1 h-10 rounded-xl border border-dashed flex items-center justify-center gap-1.5 text-xs font-body cursor-pointer select-none transition-all ${
                      comprobanteArchivo
                        ? "border-emerald-500/40 bg-emerald-500/5 text-emerald-400 font-semibold"
                        : "border-border/40 bg-surface-elevated/20 text-text-secondary hover:border-[#00B4D8]/50"
                    }`}
                  >
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) => setComprobanteArchivo(e.target.files?.[0] || null)}
                      className="hidden"
                      id="comprobante_upload"
                    />
                    <span>📷</span>
                    {comprobanteArchivo ? `✓ ${comprobanteArchivo.name.slice(0, 20)}...` : "Adjuntar foto de ticket"}
                  </label>
                  {comprobanteArchivo && (
                    <button
                      type="button"
                      onClick={() => setComprobanteArchivo(null)}
                      className="text-red-400 font-extrabold text-sm px-2 cursor-pointer bg-transparent border-none"
                    >
                      ✕
                    </button>
                  )}
                </div>
              </div>

              <button
                type="submit"
                disabled={procesando}
                className="w-full h-10 rounded-xl border border-dashed border-[#00B4D8]/60 hover:border-[#00B4D8] text-[#00B4D8] hover:text-white font-display text-xs font-black tracking-wider transition-all cursor-pointer flex items-center justify-center select-none mt-1"
              >
                + REGISTRAR GASTO
              </button>
            </form>
          )}

          {/* Expenses List */}
          <div className="bg-surface-elevated/25 border border-border/20 rounded-2xl overflow-hidden text-xs font-body">
            <div className="grid grid-cols-12 bg-surface/50 border-b border-border/15 p-3 font-bold text-text-tertiary text-[10px] tracking-wider font-display uppercase">
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
                <div className="grid grid-cols-12 p-3.5 bg-surface/60 font-bold items-center border-t border-border/15">
                  <span className="col-span-7 font-display text-[10px] font-black text-text-tertiary tracking-widest uppercase">Total Gastos Registrados</span>
                  <span className="col-span-3 text-right font-display text-sm font-black text-emerald-400 font-mono">${totalGastos.toFixed(2)}</span>
                  <span className="col-span-2" />
                </div>
              </div>
            )}
          </div>
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

        {/* Summary Notes */}
        <div className="text-center font-body text-[9px] text-text-tertiary font-bold mt-8 tracking-wide select-none mb-4">
          ruumruum · conciliación y cierre de traslado definitivo
        </div>

        {/* Sticky footer for action buttons */}
        <div className="sticky bottom-0 inset-x-0 z-20 bg-[#090D1A]/95 backdrop-blur-md border-t border-border/20 py-4 px-4 -mx-4 sm:-mx-6 flex flex-col gap-3 mt-8">
          {writable ? (
            <button
              type="button"
              onClick={() => setConfirmarCierreAbierto(true)}
              disabled={procesando}
              className="w-full min-h-12 rounded-xl bg-emerald-600 text-white hover:bg-emerald-500 font-display text-xs font-black tracking-widest uppercase transition-all cursor-pointer shadow-lg select-none flex items-center justify-center focus:outline-hidden focus-visible:ring-2 focus-visible:ring-emerald-500"
            >
              {procesando ? (
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                "FINALIZAR Y ENTREGAR VEHÍCULO"
              )}
            </button>
          ) : (
            <button
              type="button"
              onClick={() => router.push("/viajes")}
              className="w-full min-h-12 rounded-xl bg-control-soft hover:bg-border/60 text-text-primary font-display text-xs font-black tracking-widest uppercase transition-all cursor-pointer shadow-xs select-none flex items-center justify-center"
            >
              VOLVER A TRASLADOS
            </button>
          )}
        </div>

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
