import type { Database } from "@ruum/shared/types";
import type { Conductor } from "@ruum/shared/types";

type PasaporteRow = Database["public"]["Views"]["pasaporte_digital"]["Row"];

// Mismo criterio que apps/app-usuario/src/lib/datos-demo.ts: estas pantallas
// SIEMPRE muestran el aviso "Datos de ejemplo" cuando se usa este archivo —
// nunca se presenta como dato real.

// PRD §4.1, §4.3 — conductor de relleno mientras no exista login real (ver
// "Pendiente" en README de este app). Con id vacío para que sea imposible
// confundirlo con un id real si alguna vez se intenta usar contra Supabase.
export const CONDUCTOR_DEMO: Conductor = {
  id: "",
  nombre: "Conductor Demo",
  estado: "activo",
  calificacion_promedio: 4.6,
  traslados_completados: 12,
  suspensiones_activas: 0,
  no_presentaciones_6m: 0,
  cancelaciones_sin_justificacion_count: 0,
  documentos_vigentes: true,
  certificaciones: [],
  incidencias_graves_6m: 0,
  incidencias_graves_12m: 0,
  creado_en: new Date(Date.now() - 1000 * 60 * 60 * 24 * 200).toISOString()
};

export const VIAJES_DISPONIBLES_DEMO: PasaporteRow[] = [
  {
    traslado_id: "demo-disponible-001",
    usuario_id: "demo-usuario-1",
    vehiculo_id: "demo-vehiculo-1",
    conductor_id: null,
    estado: "pendiente_de_conductor",
    tiene_incidencia_abierta: false,
    tipo_pago: "anticipado",
    causa_fallido: null,
    precio_cotizado: 1800,
    precio_final: null,
    creado_en: new Date(Date.now() - 1000 * 60 * 30).toISOString(),
    actualizado_en: new Date().toISOString(),
    vehiculo_tipo: "suv",
    vehiculo_marca: "Honda",
    vehiculo_modelo: "CR-V",
    vehiculo_anio: 2023,
    conductor_nombre: null,
    conductor_estado: null,
    conductor_nivel: null,
    conductor_calificacion: null,
    evidencia_inicial_fotos_sincronizadas: 0,
    evidencia_final_fotos_sincronizadas: 0,
    incidencias_abiertas: 0,
    monto_pagado: 0
  },
  {
    traslado_id: "demo-disponible-002",
    usuario_id: "demo-usuario-2",
    vehiculo_id: "demo-vehiculo-2",
    conductor_id: null,
    estado: "pendiente_de_conductor",
    tiene_incidencia_abierta: false,
    tipo_pago: "al_cierre",
    causa_fallido: null,
    precio_cotizado: 950,
    precio_final: null,
    creado_en: new Date(Date.now() - 1000 * 60 * 90).toISOString(),
    actualizado_en: new Date().toISOString(),
    vehiculo_tipo: "sedan",
    vehiculo_marca: "Toyota",
    vehiculo_modelo: "Corolla",
    vehiculo_anio: 2021,
    conductor_nombre: null,
    conductor_estado: null,
    conductor_nivel: null,
    conductor_calificacion: null,
    evidencia_inicial_fotos_sincronizadas: 0,
    evidencia_final_fotos_sincronizadas: 0,
    incidencias_abiertas: 0,
    monto_pagado: 0
  }
];

export const VIAJES_ACEPTADOS_DEMO: PasaporteRow[] = [
  {
    traslado_id: "demo-aceptado-001",
    usuario_id: "demo-usuario-3",
    vehiculo_id: "demo-vehiculo-3",
    conductor_id: "demo-conductor",
    estado: "traslado_en_curso",
    tiene_incidencia_abierta: false,
    tipo_pago: "anticipado",
    causa_fallido: null,
    precio_cotizado: 1500,
    precio_final: null,
    creado_en: new Date(Date.now() - 1000 * 60 * 60 * 3).toISOString(),
    actualizado_en: new Date().toISOString(),
    vehiculo_tipo: "sedan",
    vehiculo_marca: "Nissan",
    vehiculo_modelo: "Versa",
    vehiculo_anio: 2022,
    conductor_nombre: "Conductor Demo",
    conductor_estado: "activo",
    conductor_nivel: "ejecutivo",
    conductor_calificacion: 4.6,
    evidencia_inicial_fotos_sincronizadas: 5,
    evidencia_final_fotos_sincronizadas: 0,
    incidencias_abiertas: 0,
    monto_pagado: 1500
  },
  {
    // Único propósito de este registro: dejar un viaje demo alcanzable
    // tocando pantalla (Aceptados → Ver detalle → botón) que ya esté en
    // evidencia_inicial_en_proceso, para poder probar la cámara real sin
    // depender de que el modo demo avance estados (no lo hace — el botón
    // "avanzar" en modo demo no modifica datos, ver AccionesViaje.tsx).
    traslado_id: "demo-aceptado-002",
    usuario_id: "demo-usuario-5",
    vehiculo_id: "demo-vehiculo-5",
    conductor_id: "demo-conductor",
    estado: "evidencia_inicial_en_proceso",
    tiene_incidencia_abierta: false,
    tipo_pago: "anticipado",
    causa_fallido: null,
    precio_cotizado: 1200,
    precio_final: null,
    creado_en: new Date(Date.now() - 1000 * 60 * 15).toISOString(),
    actualizado_en: new Date().toISOString(),
    vehiculo_tipo: "suv",
    vehiculo_marca: "Mazda",
    vehiculo_modelo: "CX-5",
    vehiculo_anio: 2023,
    conductor_nombre: "Conductor Demo",
    conductor_estado: "activo",
    conductor_nivel: "ejecutivo",
    conductor_calificacion: 4.6,
    evidencia_inicial_fotos_sincronizadas: 0,
    evidencia_final_fotos_sincronizadas: 0,
    incidencias_abiertas: 0,
    monto_pagado: 0
  }
];

// PRD §16.4 — "Mis ganancias". No existe todavía una tabla de ganancias/
// payouts del conductor (ver README de este app, sección "Pendiente"): el
// pago semanal por transferencia (PRD §4.6) es un proceso distinto a
// supabase/migrations/0007_pagos.sql (que registra el cobro al usuario, no
// el payout al conductor) y queda pendiente de modelar junto con la
// integración de Stripe Connect. Esta sección es 100% demo, sin excepción.
export interface RegistroGananciaDemo {
  fecha: string;
  ruta: string;
  monto: number;
  gastos: number;
  estatus: "pagado" | "pendiente" | "en_revision";
}

export const GANANCIAS_DEMO: RegistroGananciaDemo[] = [
  { fecha: "2026-06-21", ruta: "CDMX → Puebla", monto: 1500, gastos: 0, estatus: "pagado" },
  { fecha: "2026-06-23", ruta: "CDMX → Querétaro", monto: 1800, gastos: 150, estatus: "pagado" },
  { fecha: "2026-06-26", ruta: "Puebla → CDMX", monto: 1500, gastos: 0, estatus: "pendiente" }
];

export const RESUMEN_SEMANAL_DEMO = {
  ganancias_generadas: 4800,
  gastos_autorizados: 150,
  ajustes: 0,
  deposito_final: 4650,
  fecha_pago: "2026-06-26",
  metodo: "Depósito a cuenta terminación ****4821"
};
