import type { Database } from "@ruum/shared/types";

type PasaporteRow = Database["public"]["Views"]["pasaporte_digital"]["Row"];
type UsuarioRow = Database["public"]["Tables"]["usuarios"]["Row"];

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

// Mismo usuario al que "pertenecen" PASAPORTE_DEMO y el resto de
// TRASLADOS_DEMO — usado para previsualizar la sección de Inicio (saludo,
// estado de verificación) sin una sesión real de Supabase.
export const USUARIO_DEMO: UsuarioRow = {
  id: "demo-usuario",
  auth_user_id: null,
  nombre: "Cliente Demo",
  tipo_cuenta: "personal",
  rol: "personal",
  empresa_id: null,
  estado_verificacion: "verificado",
  traslados_completados_sin_incidencia: 1,
  metodo_pago_registrado: true,
  telefono: "+525500000000",
  creado_en: new Date(Date.now() - 1000 * 60 * 60 * 24 * 30).toISOString(),
  actualizado_en: new Date().toISOString()
};

// Escenario de Inicio para modo demo: un traslado en curso (PASAPORTE_DEMO,
// el más reciente) más historial con variedad de estados, para que las
// secciones de notificaciones y "últimos viajes" se vean completas antes de
// conectar Supabase. Igual que PASAPORTE_DEMO, SIEMPRE se presenta junto al
// aviso "Datos de ejemplo" — nunca como un traslado real.
export const TRASLADOS_DEMO: PasaporteRow[] = [
  PASAPORTE_DEMO,
  {
    traslado_id: "demo-0002",
    usuario_id: "demo-usuario",
    vehiculo_id: "demo-vehiculo-2",
    conductor_id: "demo-conductor-2",
    estado: "incidencia_reportada",
    tiene_incidencia_abierta: true,
    tipo_pago: "anticipado",
    causa_fallido: null,
    precio_cotizado: 2200,
    precio_final: null,
    creado_en: new Date(Date.now() - 1000 * 60 * 60 * 24 * 2).toISOString(),
    actualizado_en: new Date(Date.now() - 1000 * 60 * 60 * 5).toISOString(),
    vehiculo_tipo: "suv",
    vehiculo_marca: "Honda",
    vehiculo_modelo: "CR-V",
    vehiculo_anio: 2021,
    conductor_nombre: "Conductora Demo",
    conductor_estado: "activo",
    conductor_nivel: "basico",
    conductor_calificacion: 4.6,
    evidencia_inicial_fotos_sincronizadas: 5,
    evidencia_final_fotos_sincronizadas: 0,
    incidencias_abiertas: 1,
    monto_pagado: 2200
  },
  {
    traslado_id: "demo-0003",
    usuario_id: "demo-usuario",
    vehiculo_id: "demo-vehiculo-3",
    conductor_id: "demo-conductor-3",
    estado: "pago_pendiente",
    tiene_incidencia_abierta: false,
    tipo_pago: "al_cierre",
    causa_fallido: null,
    precio_cotizado: 980,
    precio_final: 980,
    creado_en: new Date(Date.now() - 1000 * 60 * 60 * 24 * 5).toISOString(),
    actualizado_en: new Date(Date.now() - 1000 * 60 * 60 * 24 * 4).toISOString(),
    vehiculo_tipo: "sedan",
    vehiculo_marca: "Volkswagen",
    vehiculo_modelo: "Jetta",
    vehiculo_anio: 2019,
    conductor_nombre: "Conductor Demo 3",
    conductor_estado: "activo",
    conductor_nivel: "basico",
    conductor_calificacion: 4.5,
    evidencia_inicial_fotos_sincronizadas: 5,
    evidencia_final_fotos_sincronizadas: 5,
    incidencias_abiertas: 0,
    monto_pagado: 0
  },
  {
    traslado_id: "demo-0004",
    usuario_id: "demo-usuario",
    vehiculo_id: "demo-vehiculo-4",
    conductor_id: "demo-conductor-4",
    estado: "servicio_cerrado",
    tiene_incidencia_abierta: false,
    tipo_pago: "anticipado",
    causa_fallido: null,
    precio_cotizado: 1750,
    precio_final: 1750,
    creado_en: new Date(Date.now() - 1000 * 60 * 60 * 24 * 12).toISOString(),
    actualizado_en: new Date(Date.now() - 1000 * 60 * 60 * 24 * 11).toISOString(),
    vehiculo_tipo: "pick_up",
    vehiculo_marca: "Toyota",
    vehiculo_modelo: "Hilux",
    vehiculo_anio: 2020,
    conductor_nombre: "Conductor Demo 4",
    conductor_estado: "activo",
    conductor_nivel: "ejecutivo",
    conductor_calificacion: 4.9,
    evidencia_inicial_fotos_sincronizadas: 5,
    evidencia_final_fotos_sincronizadas: 5,
    incidencias_abiertas: 0,
    monto_pagado: 1750
  }
];
