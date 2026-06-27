import type { Database } from "@ruum/shared/types";

type PasaporteRow = Database["public"]["Views"]["pasaporte_digital"]["Row"];

// Mismo escenario que supabase/seed.sql, para que la pantalla de
// seguimiento se vea completa en `next dev` antes de conectar un proyecto
// de Supabase real. Las pantallas que usan esto SIEMPRE muestran el aviso
// "Datos de ejemplo" — nunca se presenta como dato real.
export const PASAPORTE_DEMO: PasaporteRow = {
  traslado_id: "demo-0001",
  usuario_id: "demo-usuario",
  vehiculo_id: "demo-vehiculo",
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
  conductor_calificacion: 4.8,
  evidencia_inicial_fotos_sincronizadas: 5,
  evidencia_final_fotos_sincronizadas: 0,
  incidencias_abiertas: 0,
  monto_pagado: 1500
};
