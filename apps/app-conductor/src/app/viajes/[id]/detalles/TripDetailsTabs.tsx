"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ETIQUETA_TIPO_VEHICULO } from "@ruum/shared/constants";
import type { Database } from "@ruum/shared/types";
import { crearClienteNavegador } from "../../../../lib/supabase-browser";
import { formatearDuracion, nombreVehiculo } from "../../trips-utils";

function formatearMoneda(valor: number) {
  return new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN", maximumFractionDigits: 2 }).format(valor);
}

type PasaporteRow = Database["public"]["Views"]["pasaporte_digital"]["Row"];

function limpiarTelefono(tel?: string | null) {
  if (!tel) return "";
  const digits = tel.replace(/\D/g, "");
  return digits.length === 10 ? `52${digits}` : digits;
}

function enlaceTel(tel?: string | null) {
  if (!tel) return "#";
  const digits = tel.replace(/\D/g, "");
  return `tel:${digits}`;
}

function enlaceWhatsApp(tel?: string | null, mensaje?: string) {
  const clean = limpiarTelefono(tel);
  if (!clean) return "#";
  const url = `https://wa.me/${clean}`;
  return mensaje ? `${url}?text=${encodeURIComponent(mensaje)}` : url;
}

type TabId = "itinerario" | "vehiculo" | "pago" | "operacion";

function copiar(texto: string) {
  if (typeof navigator !== "undefined" && navigator.clipboard) void navigator.clipboard.writeText(texto);
}

export function TripDetailsTabs({ pasaporte }: { pasaporte: PasaporteRow }) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<TabId>("itinerario");
  const [copiado, setCopiado] = useState<string | null>(null);
  const [reembolsoPago, setReembolsoPago] = useState(0);
  
  const trasladoId = pasaporte.traslado_id!;
  const folio = trasladoId.slice(0, 8).toUpperCase();
  
  const origenCiudad = pasaporte.origen_ciudad || "Ciudad de Origen";
  const origenDir = pasaporte.origen_direccion || "Dirección pendiente";
  const destinoCiudad = pasaporte.destino_ciudad || "Ciudad Destino";
  const destinoDir = pasaporte.destino_direccion || "Dirección pendiente";
  const distancia = pasaporte.distancia_km != null ? `${pasaporte.distancia_km.toFixed(1)} km` : "Por confirmar";
  const tiempoEstimado = formatearDuracion(pasaporte.tiempo_estimado_horas);
  
  const vehiculo = nombreVehiculo(pasaporte);
  const placas = pasaporte.vehiculo_placas || "POR ASIGNAR";
  const vin = pasaporte.vehiculo_vin || "POR CONFIRMAR";
  const marca = pasaporte.vehiculo_marca || (pasaporte.vehiculo_modelo ? pasaporte.vehiculo_modelo.split(" ")[0] : "No especificada");
  const modelo = pasaporte.vehiculo_modelo || "No especificado";
  const anio = pasaporte.vehiculo_anio ? String(pasaporte.vehiculo_anio) : "No especificado";
  const color = pasaporte.vehiculo_color || "No especificado";
  const condicion = pasaporte.vehiculo_condicion || "En condiciones de circular rodando";
  const categoria = pasaporte.vehiculo_categoria_tarifa || (pasaporte.vehiculo_tipo ? ETIQUETA_TIPO_VEHICULO[pasaporte.vehiculo_tipo] : "Particular / Estándar");
  const gama = pasaporte.vehiculo_gama || "Comercial / Convencional";
  const tipoVehiculo = pasaporte.vehiculo_tipo ? ETIQUETA_TIPO_VEHICULO[pasaporte.vehiculo_tipo] : "Traslado vehicular";
  const tipoOperativo = pasaporte.vehiculo_tipo 
    ? `${ETIQUETA_TIPO_VEHICULO[pasaporte.vehiculo_tipo]} · Traslado rodando con conductor certificado`
    : "Traslado rodando con conductor certificado";

  const fotosIniciales = pasaporte.evidencia_inicial_fotos_sincronizadas ?? 0;
  const estadoTraslado = pasaporte.estado;
  let estadoRecepcionTexto = "Pendiente de inspección en origen";
  let estadoRecepcionTono: "warning" | "success" = "warning";

  if (
    fotosIniciales > 0 ||
    estadoTraslado === "evidencia_inicial_completada" ||
    estadoTraslado === "vehiculo_recibido" ||
    estadoTraslado === "traslado_en_curso" ||
    estadoTraslado === "llegada_a_destino" ||
    estadoTraslado === "evidencia_final_en_proceso" ||
    estadoTraslado === "evidencia_final_completada" ||
    estadoTraslado === "entrega_confirmada" ||
    estadoTraslado === "servicio_cerrado"
  ) {
    estadoRecepcionTexto = fotosIniciales > 0
      ? `Inspeccionado (${fotosIniciales} fotos sincronizadas)`
      : "Recepción completada y documentada";
    estadoRecepcionTono = "success";
  } else if (
    estadoTraslado === "conductor_en_punto_de_recoleccion" ||
    estadoTraslado === "verificacion_vehiculo_en_proceso" ||
    estadoTraslado === "evidencia_inicial_en_proceso"
  ) {
    estadoRecepcionTexto = "En proceso de inspección y recepción en origen";
    estadoRecepcionTono = "warning";
  }
  
  const pagoTotal = pasaporte.ganancia_conductor || 0;
  const fecha = pasaporte.creado_en ? new Date(pasaporte.creado_en).toLocaleDateString("es-MX", { weekday: "short", day: "numeric", month: "long", year: "numeric" }) : "Fecha pendiente";
  const horaInicio = pasaporte.creado_en ? new Date(pasaporte.creado_en).toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" }) + " hrs" : "Por confirmar";
  // Ventanas desde formulario de solicitud (traslados.ventana_*), con fallback si pasaporte no las proyecta
  const [ventanaRecoleccion, setVentanaRecoleccion] = useState<string | null>((pasaporte as unknown as { ventana_recoleccion?: string | null }).ventana_recoleccion ?? null);
  const [ventanaEntrega, setVentanaEntrega] = useState<string | null>((pasaporte as unknown as { ventana_entrega?: string | null }).ventana_entrega ?? null);
  // Solicitante = titular de la cuenta usuario (traslados.usuario_id -> usuarios)
  const [solicitanteNombre, setSolicitanteNombre] = useState<string>(pasaporte.contacto_entrega_nombre || "Cliente Solicitante");
  const [solicitanteTelefono, setSolicitanteTelefono] = useState<string>(pasaporte.contacto_entrega_telefono || "");

  useEffect(() => {
    let cancelado = false;
    async function cargarVentanasYTitular() {
      try {
        const cliente = crearClienteNavegador();
        const trasladoId = pasaporte.traslado_id;
        const usuarioId = pasaporte.usuario_id;
        if (!trasladoId) return;
        // Ventanas: si pasaporte no las trae, leer traslados
        if (!ventanaRecoleccion || !ventanaEntrega) {
          const { data: d } = await cliente
            .from("traslados")
            .select("ventana_recoleccion, ventana_entrega")
            .eq("id", trasladoId)
            .maybeSingle();
          if (!cancelado && d) {
            if (d.ventana_recoleccion) setVentanaRecoleccion(d.ventana_recoleccion);
            if (d.ventana_entrega) setVentanaEntrega(d.ventana_entrega);
          }
        }
        // Titular: usuarios.id = traslados.usuario_id
        if (usuarioId) {
          const { data: u } = await cliente
            .from("usuarios")
            .select("nombre, telefono")
            .eq("id", usuarioId)
            .maybeSingle();
          if (!cancelado && u) {
            if (u.nombre) setSolicitanteNombre(u.nombre);
            if (u.telefono) setSolicitanteTelefono(u.telefono);
          }
        }
      } catch {
        // fallback silencioso a valores ya mostrados
      }
    }
    void cargarVentanasYTitular();
    return () => { cancelado = true; };
  }, [pasaporte.traslado_id, pasaporte.usuario_id, ventanaRecoleccion, ventanaEntrega]);

  const entregaNombre = pasaporte.contacto_entrega_nombre || "Contacto en Origen";
  const entregaTelefono = pasaporte.contacto_entrega_telefono || "";

  const recepcionNombre = pasaporte.contacto_recepcion_nombre || "Contacto en Destino";
  const recepcionTelefono = pasaporte.contacto_recepcion_telefono || "";

  const notasRecogida = pasaporte.origen_referencias || "Sin notas adicionales de recogida registradas.";
  const notasEntrega = pasaporte.destino_referencias || "Sin notas adicionales de entrega registradas.";

  // Pago — mismo desglose que /ganancias: Precio base + Bonos + Ajuste - Tasa Ruum-Ruum + Reembolso
  const precioBasePago = Number(pasaporte.precio_final ?? pasaporte.precio_cotizado ?? (pagoTotal ? pagoTotal / 0.85 : 0));
  const tasaPago = precioBasePago > 0 ? Math.max(0, precioBasePago - pagoTotal) : 0;
  const bonosPago = 0;
  const ajustesPago = 0;

  useEffect(() => {
    let cancelado = false;
    async function cargarReembolso() {
      try {
        const cliente = crearClienteNavegador();
        const resp = await (cliente as unknown as { from: (table: string) => { select: (cols: string) => { eq: (col: string, val: string) => Promise<{ data: { monto: number }[] | null }> } } }).from("gastos_traslado").select("monto").eq("traslado_id", trasladoId);
        const data = (resp as { data: { monto: number }[] | null }).data;
        if (!cancelado && data) {
          const total = data.reduce((s: number, g: { monto: number }) => s + Number(g.monto || 0), 0);
          setReembolsoPago(total);
        }
      } catch {
        // ignora
      }
    }
    void cargarReembolso();
    return () => { cancelado = true; };
  }, [trasladoId]);

  const depositoPago = Math.max(0, precioBasePago + bonosPago + ajustesPago - tasaPago + reembolsoPago);

  return (
    <div className="mx-auto w-full max-w-md bg-surface min-h-screen flex flex-col text-text-primary pb-6 px-4">
      {/* HEADER */}
      <header className="flex items-center justify-between py-4 border-b border-border/15">
        <Link href={`/viajes/${trasladoId}`} className="p-2 -ml-2 min-h-[44px] min-w-[44px] flex items-center justify-center text-text-secondary hover:text-text-primary transition-colors rounded-full hover:bg-surface-elevated">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="19" y1="12" x2="5" y2="12" /><polyline points="12 19 5 12 12 5" /></svg>
        </Link>
        <span className="font-display text-xs font-black uppercase tracking-widest text-text-primary">DETALLES DEL TRASLADO</span>
        <div className="w-10" />
      </header>

      {/* TABS */}
      <div className="mt-4 flex w-full rounded-full border border-border/20 bg-surface-elevated p-1 select-none overflow-x-auto no-scrollbar">
        {[
          { id: "itinerario", label: "Ruta" },
          { id: "vehiculo", label: "Vehículo" },
          { id: "pago", label: "Pago" },
          { id: "operacion", label: "Operación" }
        ].map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id as TabId)}
            className={`flex-1 rounded-full px-3 py-2 text-center text-[10px] font-black uppercase tracking-widest transition-all duration-200 cursor-pointer min-w-max ${
              activeTab === tab.id
                ? "bg-route-action text-white shadow-md"
                : "text-text-secondary hover:text-text-primary"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* CONTENT */}
      <div className="mt-5 flex-1 animate-in fade-in slide-in-from-bottom-2 duration-300">
        {activeTab === "itinerario" && (
          <div className="bg-surface-elevated rounded-3xl border border-border/20 p-5 shadow-sm relative flex flex-col gap-5">
            <div className="flex gap-4">
              <div className="flex flex-col items-center mt-1">
                <span className="h-3 w-3 rounded-full border-2 border-emerald-500 bg-transparent shrink-0" />
                <div className="w-[1px] h-10 bg-border/40 my-1" />
                <span className="h-3 w-3 rounded-full bg-route-action shrink-0 block" />
              </div>
              <div className="flex flex-col justify-between py-0.5 min-w-0">
                <div className="flex flex-col mb-3">
                  <span className="font-display text-[9px] font-bold text-emerald-600 dark:text-emerald-400 tracking-widest uppercase">PUNTO DE RECOLECCIÓN</span>
                  <span className="font-display text-base font-black text-text-primary leading-tight mt-0.5">{origenCiudad}</span>
                  <span className="font-body text-xs text-text-secondary mt-0.5 leading-snug">{origenDir}</span>
                </div>
                <div className="flex flex-col">
                  <span className="font-display text-[9px] font-bold text-route-action tracking-widest uppercase">PUNTO DE ENTREGA</span>
                  <span className="font-display text-base font-black text-text-primary leading-tight mt-0.5">{destinoCiudad}</span>
                  <span className="font-body text-xs text-text-secondary mt-0.5 leading-snug">{destinoDir}</span>
                </div>
              </div>
            </div>

            <div className="h-px w-full bg-border/20 my-1" />

            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col">
                <span className="text-[10px] text-text-tertiary font-bold uppercase tracking-widest">Distancia estimada</span>
                <span className="font-display text-base font-black text-text-primary mt-0.5 tabular-nums">{distancia}</span>
              </div>
              <div className="flex flex-col text-right">
                <span className="text-[10px] text-text-tertiary font-bold uppercase tracking-widest">Tiempo estimado</span>
                <span className="font-display text-base font-black text-text-primary mt-0.5 tabular-nums">{tiempoEstimado}</span>
              </div>
            </div>
          </div>
        )}

        {activeTab === "vehiculo" && (
          <div className="bg-surface-elevated rounded-3xl border border-border/20 p-5 shadow-sm relative flex flex-col gap-4">
             <div className="flex items-center justify-between">
               <div className="flex flex-col">
                 <span className="text-[10px] text-text-tertiary font-extrabold uppercase tracking-widest">Unidad a trasladar</span>
                 <span className="font-display text-lg font-black text-text-primary mt-0.5">{vehiculo}</span>
               </div>
               <div className="border border-border/60 bg-surface px-3 py-1.5 rounded-xl shadow-xs">
                 <span className="font-mono text-xs font-black tracking-widest text-text-primary">{placas}</span>
               </div>
             </div>

             <div className="grid grid-cols-2 gap-2.5 mt-1">
                {/* 1. Placas */}
                <div className="flex flex-col bg-surface p-3 rounded-xl border border-border/15">
                  <div className="flex items-center justify-between gap-1">
                    <span className="text-[9px] text-text-tertiary font-bold uppercase tracking-widest">Placas</span>
                    <button type="button" onClick={() => { copiar(placas); setCopiado("placas"); setTimeout(()=>setCopiado(null),1200); }} className="text-[10px] font-bold text-route-action hover:underline focus-visible:outline focus-visible:outline-[2px] focus-visible:outline-offset-1 focus-visible:outline-route-action rounded px-1 -mx-1 min-h-6">{copiado==="placas"?"Copiado ✓":"Copiar"}</button>
                  </div>
                  <span className="font-mono text-xs font-black mt-0.5 text-text-primary">{placas}</span>
                </div>

                {/* 2. Número VIN */}
                <div className="flex flex-col bg-surface p-3 rounded-xl border border-border/15">
                  <div className="flex items-center justify-between gap-1">
                    <span className="text-[9px] text-text-tertiary font-bold uppercase tracking-widest">Número VIN</span>
                    <button type="button" onClick={() => { copiar(vin); setCopiado("vin"); setTimeout(()=>setCopiado(null),1200); }} className="text-[10px] font-bold text-route-action hover:underline focus-visible:outline focus-visible:outline-[2px] focus-visible:outline-offset-1 focus-visible:outline-route-action rounded px-1 -mx-1 min-h-6">{copiado==="vin"?"Copiado ✓":"Copiar"}</button>
                  </div>
                  <span className="font-mono text-xs font-black mt-0.5 text-text-primary truncate" title={vin}>{vin}</span>
                </div>

               {/* 3. Marca */}
               <div className="flex flex-col bg-surface p-3 rounded-xl border border-border/15">
                 <span className="text-[9px] text-text-tertiary font-bold uppercase tracking-widest">Marca</span>
                 <span className="font-semibold text-xs mt-0.5 text-text-primary">{marca}</span>
               </div>

               {/* 4. Modelo */}
               <div className="flex flex-col bg-surface p-3 rounded-xl border border-border/15">
                 <span className="text-[9px] text-text-tertiary font-bold uppercase tracking-widest">Modelo</span>
                 <span className="font-semibold text-xs mt-0.5 text-text-primary truncate" title={modelo}>{modelo}</span>
               </div>

               {/* 5. Año */}
               <div className="flex flex-col bg-surface p-3 rounded-xl border border-border/15">
                 <span className="text-[9px] text-text-tertiary font-bold uppercase tracking-widest">Año</span>
                 <span className="font-semibold text-xs mt-0.5 text-text-primary tabular-nums">{anio}</span>
               </div>

               {/* 6. Color */}
               <div className="flex flex-col bg-surface p-3 rounded-xl border border-border/15">
                 <span className="text-[9px] text-text-tertiary font-bold uppercase tracking-widest">Color</span>
                 <span className="font-semibold text-xs mt-0.5 text-text-primary capitalize">{color}</span>
               </div>

               {/* 7. Categoría */}
               <div className="flex flex-col bg-surface p-3 rounded-xl border border-border/15">
                 <span className="text-[9px] text-text-tertiary font-bold uppercase tracking-widest">Categoría</span>
                 <span className="font-semibold text-xs mt-0.5 text-text-primary capitalize">{categoria}</span>
               </div>

               {/* 8. Gama */}
               <div className="flex flex-col bg-surface p-3 rounded-xl border border-border/15">
                 <span className="text-[9px] text-text-tertiary font-bold uppercase tracking-widest">Gama</span>
                 <span className="font-semibold text-xs mt-0.5 text-text-primary capitalize">{gama}</span>
               </div>

               {/* 9. Condición */}
               <div className="flex flex-col col-span-2 bg-surface p-3 rounded-xl border border-border/15">
                 <span className="text-[9px] text-text-tertiary font-bold uppercase tracking-widest">Condición</span>
                 <span className="font-semibold text-xs mt-0.5 text-text-primary">{condicion}</span>
               </div>

               {/* 10. Tipo Operativo */}
               <div className="flex flex-col col-span-2 bg-surface p-3 rounded-xl border border-border/15">
                 <span className="text-[9px] text-text-tertiary font-bold uppercase tracking-widest">Tipo Operativo</span>
                 <span className="font-semibold text-xs mt-0.5 text-text-primary">{tipoOperativo}</span>
               </div>

               {/* 11. Estado General de Recepción */}
               <div className="flex flex-col col-span-2 bg-surface p-3.5 rounded-xl border border-border/15 gap-1">
                 <span className="text-[9px] text-text-tertiary font-bold uppercase tracking-widest">Estado General de Recepción</span>
                 <div className="flex items-center gap-2 mt-0.5">
                   <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold ${
                     estadoRecepcionTono === "success"
                       ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30"
                       : "bg-warning/15 text-warning border border-warning/30"
                   }`}>
                     <span>{estadoRecepcionTono === "success" ? "✓" : "⏳"}</span>
                     <span>{estadoRecepcionTexto}</span>
                   </span>
                 </div>
               </div>
             </div>

             <div className="h-px w-full bg-border/20 my-1" />
             
             <div className="flex flex-col gap-2">
               <span className="text-[10px] text-text-tertiary font-bold uppercase tracking-widest">Garantía de Evidencia Ruum Ruum</span>
               <div className="p-3 bg-surface rounded-xl border border-border/15 flex items-center gap-2.5">
                 <span className="text-base">🛡️</span>
                 <span className="text-[11px] text-text-secondary leading-snug">
                   Inspección 360° fotográfica obligatoria antes de iniciar y al concluir la entrega documentada.
                 </span>
               </div>
             </div>
          </div>
        )}

        {activeTab === "pago" && (
          <div className="bg-surface-elevated rounded-3xl border border-border/20 p-5 shadow-sm relative flex flex-col gap-4">
            {/* Mismo desglose que /ganancias — Depósito acumulado */}
            <div className="flex flex-col p-4 bg-surface rounded-2xl border border-border/60 text-left">
              <h3 className="font-display text-lg font-black tracking-tight text-text-primary">Deposito acumulado</h3>
              <p className="mt-1 font-display text-3xl font-black tracking-tight text-text-primary tabular-nums">{formatearMoneda(depositoPago)}</p>
              <p className="mt-1 font-body text-xs font-semibold text-text-tertiary">Traslado #{folio}</p>
              <button type="button" onClick={() => { copiar(String(depositoPago)); setCopiado("pago"); setTimeout(()=>setCopiado(null),1200); }} className="mt-2 self-start text-xs font-bold text-route-action hover:underline focus-visible:outline focus-visible:outline-[2px] focus-visible:outline-offset-1 focus-visible:outline-route-action rounded px-2 py-1 min-h-8">{copiado==="pago"?"Copiado ✓":"Copiar depósito"}</button>
            </div>

            <div className="rounded-2xl border border-border/40 bg-surface overflow-hidden">
              <p className="px-4 pt-3 pb-1 font-body text-[11px] font-bold uppercase tracking-widest text-text-tertiary">Desglose:</p>
              <div className="grid divide-y divide-border/30">
                <div className="flex items-center justify-between gap-3 px-4 py-3">
                  <span className="flex items-center gap-1.5 font-body text-xs font-semibold text-text-secondary">
                    Precio base
                    <span className="group relative inline-flex">
                      <button type="button" aria-label="Qué es el precio base" className="flex size-4 items-center justify-center rounded-full border border-border bg-surface text-[10px] font-bold text-text-tertiary">?</button>
                      <span className="pointer-events-none absolute left-1/2 top-full z-10 hidden w-56 -translate-x-1/2 mt-2 rounded-xl border border-border bg-surface-elevated p-3 font-body text-xs leading-5 text-text-secondary shadow-lg group-hover:block group-focus-within:block">Tarifa cotizada antes de comisiones. Base de cálculo.</span>
                    </span>
                  </span>
                  <span className="font-display text-xs font-bold text-text-primary tabular-nums">{formatearMoneda(precioBasePago)}</span>
                </div>
                <div className="flex items-center justify-between gap-3 px-4 py-3">
                  <span className="flex items-center gap-1.5 font-body text-xs font-semibold text-text-secondary">
                    Bonos
                    <span className="group relative inline-flex">
                      <button type="button" aria-label="Qué son los bonos" className="flex size-4 items-center justify-center rounded-full border border-border bg-surface text-[10px] font-bold text-text-tertiary">?</button>
                      <span className="pointer-events-none absolute left-1/2 top-full z-10 hidden w-56 -translate-x-1/2 mt-2 rounded-xl border border-border bg-surface-elevated p-3 font-body text-xs leading-5 text-text-secondary shadow-lg group-hover:block group-focus-within:block">Incentivos por puntualidad/campañas.</span>
                    </span>
                  </span>
                  <span className="font-display text-xs font-bold text-emerald-600 dark:text-emerald-400 tabular-nums">+ {formatearMoneda(bonosPago)}</span>
                </div>
                <div className="flex items-center justify-between gap-3 px-4 py-3">
                  <span className="flex items-center gap-1.5 font-body text-xs font-semibold text-text-secondary">
                    Ajustes
                    <span className="group relative inline-flex">
                      <button type="button" aria-label="Qué son los ajustes" className="flex size-4 items-center justify-center rounded-full border border-border bg-surface text-[10px] font-bold text-text-tertiary">?</button>
                      <span className="pointer-events-none absolute left-1/2 top-full z-10 hidden w-56 -translate-x-1/2 mt-2 rounded-xl border border-border bg-surface-elevated p-3 font-body text-xs leading-5 text-text-secondary shadow-lg group-hover:block group-focus-within:block">Correcciones operativas. Pueden ser positivas o negativas.</span>
                    </span>
                  </span>
                  <span className="font-display text-xs font-bold text-text-primary tabular-nums">+ {formatearMoneda(ajustesPago)}</span>
                </div>
                <div className="flex items-center justify-between gap-3 px-4 py-3 bg-danger/5">
                  <span className="flex items-center gap-1.5 font-body text-xs font-semibold text-red-500">
                    Tasa Ruum-Ruum (-)
                    <span className="group relative inline-flex">
                      <button type="button" aria-label="Qué es la tasa" className="flex size-4 items-center justify-center rounded-full border border-danger/30 bg-surface text-[10px] font-bold text-red-500">?</button>
                      <span className="pointer-events-none absolute left-1/2 top-full z-10 hidden w-56 -translate-x-1/2 mt-2 rounded-xl border border-border bg-surface-elevated p-3 font-body text-xs leading-5 text-text-secondary shadow-lg group-hover:block group-focus-within:block">Comisión de plataforma.</span>
                    </span>
                  </span>
                  <span className="font-display text-xs font-bold text-red-500 tabular-nums">− {formatearMoneda(tasaPago)}</span>
                </div>
                <div className="flex items-center justify-between gap-3 px-4 py-3">
                  <span className="flex items-center gap-1.5 font-body text-xs font-semibold text-text-secondary">
                    Reembolso gastos (+)
                    <span className="group relative inline-flex">
                      <button type="button" aria-label="Qué es reembolso" className="flex size-4 items-center justify-center rounded-full border border-border bg-surface text-[10px] font-bold text-text-tertiary">?</button>
                      <span className="pointer-events-none absolute left-1/2 top-full z-10 hidden w-56 -translate-x-1/2 mt-2 rounded-xl border border-border bg-surface-elevated p-3 font-body text-xs leading-5 text-text-secondary shadow-lg group-hover:block group-focus-within:block">Gastos autorizados comprobados.</span>
                    </span>
                  </span>
                  <span className="font-display text-xs font-bold text-text-primary tabular-nums">+ {formatearMoneda(reembolsoPago)}</span>
                </div>
              </div>
            </div>

            <div className="flex justify-between items-center bg-surface p-3 rounded-xl border border-border/15">
              <div className="flex flex-col">
                <span className="text-[9px] text-text-tertiary font-bold uppercase tracking-widest">Modalidad de Dispersión</span>
                <span className="font-semibold text-xs text-text-primary mt-0.5">Transferencia Bancaria SPEI</span>
              </div>
              <div className="flex flex-col text-right">
                <span className="text-[9px] text-text-tertiary font-bold uppercase tracking-widest">Acreditación</span>
                <span className="text-xs font-black text-text-primary mt-0.5">Al Cierre Operativo</span>
              </div>
            </div>
          </div>
        )}

        {activeTab === "operacion" && (
          <div className="bg-surface-elevated rounded-3xl border border-border/20 p-5 shadow-sm relative flex flex-col gap-4">
            {/* Cabecera de Operación */}
            <div className="flex items-center justify-between">
              <div className="flex flex-col">
                <span className="text-[10px] text-text-tertiary font-extrabold uppercase tracking-widest">Operación y Despacho</span>
                <span className="font-display text-lg font-black text-text-primary mt-0.5">#TR-{folio}</span>
              </div>
              <span className="px-2.5 py-1 rounded-lg bg-surface border border-border/30 text-[10px] font-black text-route-action uppercase tracking-wider">
                Certificado
              </span>
            </div>

            {/* Grid de tiempos y ventanas operativas */}
            <div className="grid grid-cols-2 gap-2.5 mt-1">
              <div className="flex flex-col bg-surface p-3 rounded-xl border border-border/15">
                <span className="text-[9px] text-text-tertiary font-bold uppercase tracking-widest"># Traslado</span>
                <span className="font-mono text-xs font-black mt-0.5 text-text-primary">#TR-{folio}</span>
              </div>

              <div className="flex flex-col bg-surface p-3 rounded-xl border border-border/15">
                <span className="text-[9px] text-text-tertiary font-bold uppercase tracking-widest">Fecha de Traslado</span>
                <span className="font-semibold text-xs mt-0.5 text-text-primary capitalize">{fecha}</span>
              </div>

              <div className="flex flex-col bg-surface p-3 rounded-xl border border-border/15">
                <span className="text-[9px] text-text-tertiary font-bold uppercase tracking-widest">Hora de Inicio</span>
                <span className="font-semibold text-xs mt-0.5 text-text-primary tabular-nums">{horaInicio}</span>
              </div>

              <div className="flex flex-col bg-surface p-3 rounded-xl border border-border/15">
                <span className="text-[9px] text-text-tertiary font-bold uppercase tracking-widest">Ventana de Recolección</span>
                <span className="font-semibold text-xs mt-0.5 text-text-primary">{ventanaRecoleccion ?? "No especificada"}</span>
                <span className="font-body text-[10px] text-text-tertiary">Según formulario de solicitud</span>
              </div>

              <div className="flex flex-col col-span-2 bg-surface p-3 rounded-xl border border-border/15">
                <span className="text-[9px] text-text-tertiary font-bold uppercase tracking-widest">Ventana de Entrega</span>
                <span className="font-semibold text-xs mt-0.5 text-text-primary">{ventanaEntrega ?? "No especificada"}</span>
                <span className="font-body text-[10px] text-text-tertiary">Según formulario de solicitud</span>
              </div>
            </div>

            <div className="h-px w-full bg-border/20 my-1" />

            {/* Directorio de Contactos con Llamada y WhatsApp */}
            <div className="flex flex-col gap-3">
              <span className="text-[10px] text-text-tertiary font-extrabold uppercase tracking-widest">Contactos Operativos</span>

              {/* 1. Solicitante */}
              <div className="flex items-center justify-between bg-surface rounded-2xl p-3.5 border border-border/15">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-10 h-10 rounded-full bg-route-action/10 text-route-action flex items-center justify-center font-bold text-sm shrink-0">
                    {solicitanteNombre.charAt(0).toUpperCase()}
                  </div>
                  <div className="flex flex-col min-w-0">
                    <span className="text-[9px] text-route-action font-bold uppercase tracking-wider">Solicitante del Servicio</span>
                    <span className="font-bold text-xs text-text-primary truncate">{solicitanteNombre}</span>
                    <span className="font-mono text-[11px] text-text-secondary flex items-center gap-1">{solicitanteTelefono || "Teléfono no disponible"}{solicitanteTelefono && <button type="button" onClick={()=>{ copiar(solicitanteTelefono); setCopiado("sol"); setTimeout(()=>setCopiado(null),1200); }} className="text-[10px] font-bold text-route-action hover:underline px-1">{copiado==="sol"?"Copiado":"Copiar"}</button>}</span>
                  </div>
                </div>
                {solicitanteTelefono && (
                  <div className="flex items-center gap-1.5 shrink-0 ml-2">
                    <a
                      href={enlaceWhatsApp(solicitanteTelefono, `Hola ${solicitanteNombre}, me comunico como tu conductor certificado de Ruum Ruum respecto al traslado #TR-${folio}.`)}
                      target="_blank"
                      rel="noreferrer"
                      className="min-h-11 min-w-11 rounded-xl bg-emerald-500/15 text-emerald-400 flex items-center justify-center border border-emerald-500/30 active:scale-95 transition-transform hover:bg-emerald-500/25 focus-visible:outline focus-visible:outline-[3px] focus-visible:outline-offset-2 focus-visible:outline-route-action"
                      aria-label={`WhatsApp a ${solicitanteNombre}`}
                      title="Enviar WhatsApp"
                    >
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden>
                        <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
                      </svg>
                    </a>
                    <a
                      href={enlaceTel(solicitanteTelefono)}
                      className="min-h-11 min-w-11 rounded-xl bg-route-action/15 text-route-action flex items-center justify-center border border-route-action/30 active:scale-95 transition-transform hover:bg-route-action/25 focus-visible:outline focus-visible:outline-[3px] focus-visible:outline-offset-2 focus-visible:outline-route-action"
                      aria-label={`Llamar a ${solicitanteNombre}`}
                      title="Llamar"
                    >
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden>
                        <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
                      </svg>
                    </a>
                  </div>
                )}
              </div>

              {/* 2. Persona quien entrega */}
              <div className="flex items-center justify-between bg-surface rounded-2xl p-3.5 border border-border/15">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-10 h-10 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center font-bold text-sm shrink-0">
                    {entregaNombre.charAt(0).toUpperCase()}
                  </div>
                  <div className="flex flex-col min-w-0">
                    <span className="text-[9px] text-emerald-600 dark:text-emerald-400 font-bold uppercase tracking-wider">Persona quien Entrega (Origen)</span>
                    <span className="font-bold text-xs text-text-primary truncate">{entregaNombre}</span>
                    <span className="font-mono text-[11px] text-text-secondary flex items-center gap-1">{entregaTelefono || "Teléfono no disponible"}{entregaTelefono && <button type="button" onClick={()=>{ copiar(entregaTelefono); setCopiado("ent"); setTimeout(()=>setCopiado(null),1200); }} className="text-[10px] font-bold text-route-action hover:underline px-1">{copiado==="ent"?"Copiado":"Copiar"}</button>}</span>
                  </div>
                </div>
                {entregaTelefono && (
                  <div className="flex items-center gap-1.5 shrink-0 ml-2">
                    <a
                      href={enlaceWhatsApp(entregaTelefono, `Hola ${entregaNombre}, soy el conductor de Ruum Ruum asignado para recolectar el vehículo del traslado #TR-${folio}.`)}
                      target="_blank"
                      rel="noreferrer"
                      className="min-h-11 min-w-11 rounded-xl bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 flex items-center justify-center border border-emerald-500/30 active:scale-95 transition-transform hover:bg-emerald-500/25 focus-visible:outline focus-visible:outline-[3px] focus-visible:outline-offset-2 focus-visible:outline-route-action"
                      aria-label={`WhatsApp a ${entregaNombre}`}
                      title="Enviar WhatsApp"
                    >
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden>
                        <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
                      </svg>
                    </a>
                    <a
                      href={enlaceTel(entregaTelefono)}
                      className="min-h-11 min-w-11 rounded-xl bg-route-action/15 text-route-action flex items-center justify-center border border-route-action/30 active:scale-95 transition-transform hover:bg-route-action/25 focus-visible:outline focus-visible:outline-[3px] focus-visible:outline-offset-2 focus-visible:outline-route-action"
                      aria-label={`Llamar a ${entregaNombre}`}
                      title="Llamar"
                    >
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden>
                        <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
                      </svg>
                    </a>
                  </div>
                )}
              </div>

              {/* 3. Persona quien recibe */}
              <div className="flex items-center justify-between bg-surface rounded-2xl p-3.5 border border-border/15">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-10 h-10 rounded-full bg-surface-elevated border border-border/60 text-text-primary flex items-center justify-center font-bold text-sm shrink-0">
                    {recepcionNombre.charAt(0).toUpperCase()}
                  </div>
                  <div className="flex flex-col min-w-0">
                    <span className="text-[9px] text-text-secondary font-bold uppercase tracking-wider">Persona quien Recibe (Destino)</span>
                    <span className="font-bold text-xs text-text-primary truncate">{recepcionNombre}</span>
                    <span className="font-mono text-[11px] text-text-secondary flex items-center gap-1">{recepcionTelefono || "Teléfono no disponible"}{recepcionTelefono && <button type="button" onClick={()=>{ copiar(recepcionTelefono); setCopiado("rec"); setTimeout(()=>setCopiado(null),1200); }} className="text-[10px] font-bold text-route-action hover:underline px-1">{copiado==="rec"?"Copiado":"Copiar"}</button>}</span>
                  </div>
                </div>
                {recepcionTelefono && (
                  <div className="flex items-center gap-1.5 shrink-0 ml-2">
                    <a
                      href={enlaceWhatsApp(recepcionTelefono, `Hola ${recepcionNombre}, soy el conductor de Ruum Ruum en camino a tu ubicación con el traslado #TR-${folio}.`)}
                      target="_blank"
                      rel="noreferrer"
                      className="min-h-11 min-w-11 rounded-xl bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 flex items-center justify-center border border-emerald-500/30 active:scale-95 transition-transform hover:bg-emerald-500/25 focus-visible:outline focus-visible:outline-[3px] focus-visible:outline-offset-2 focus-visible:outline-route-action"
                      aria-label={`WhatsApp a ${recepcionNombre}`}
                      title="Enviar WhatsApp"
                    >
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden>
                        <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
                      </svg>
                    </a>
                    <a
                      href={enlaceTel(recepcionTelefono)}
                      className="min-h-11 min-w-11 rounded-xl bg-route-action/15 text-route-action flex items-center justify-center border border-route-action/30 active:scale-95 transition-transform hover:bg-route-action/25 focus-visible:outline focus-visible:outline-[3px] focus-visible:outline-offset-2 focus-visible:outline-route-action"
                      aria-label={`Llamar a ${recepcionNombre}`}
                      title="Llamar"
                    >
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden>
                        <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
                      </svg>
                    </a>
                  </div>
                )}
              </div>
            </div>

            <div className="h-px w-full bg-border/20 my-1" />

            {/* Notas Operativas: Recogida y Entrega */}
            <div className="flex flex-col gap-3">
              <span className="text-[10px] text-text-tertiary font-extrabold uppercase tracking-widest">Notas y Referencias</span>

              {/* Notas de recogida */}
              <div className="flex flex-col bg-surface p-3.5 rounded-2xl border border-border/15">
                <div className="flex items-center gap-1.5 mb-1">
                  <span className="h-2 w-2 rounded-full bg-emerald-500" />
                  <span className="text-[9px] text-emerald-600 dark:text-emerald-400 font-bold uppercase tracking-widest">Notas de Recogida (Origen)</span>
                </div>
                <span className="font-body text-xs text-text-secondary leading-relaxed whitespace-pre-wrap">{notasRecogida}</span>
              </div>

              {/* Notas de entrega */}
              <div className="flex flex-col bg-surface p-3.5 rounded-2xl border border-border/15">
                <div className="flex items-center gap-1.5 mb-1">
                  <span className="h-2 w-2 rounded-full bg-route-action" />
                  <span className="text-[9px] text-route-action font-bold uppercase tracking-widest">Notas de Entrega (Destino)</span>
                </div>
                <span className="font-body text-xs text-text-secondary leading-relaxed whitespace-pre-wrap">{notasEntrega}</span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
