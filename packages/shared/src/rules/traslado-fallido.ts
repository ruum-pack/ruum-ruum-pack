import type { CausaFallido } from "../types/traslado";

export interface ResultadoTrasladoFallido {
  causa: CausaFallido;
  // PRD §4.11: "Todo traslado fallido debe registrarse con una causa
  // específica para alimentar pagos, descuentos, métricas y soporte."
  // El PRD distingue causas imputables al cliente de causas no imputables
  // (operativa, fuerza mayor), por lo que ese hecho SÍ se modela aquí.
  cargo_aplica_cliente: boolean;
  requiere_reagendamiento: boolean;
  // PRD §4.2 — único descuento numérico que el PRD define explícitamente:
  // "vehículo no enciende o no puede circular por falla imputable al
  // cliente" → segundo intento con 50% de descuento. No aplica a las demás causas.
  porcentaje_descuento_segundo_intento?: number;
  mensaje: string;
}

interface ReglaCausa {
  cargo_aplica_cliente: boolean;
  requiere_reagendamiento: boolean;
  porcentaje_descuento_segundo_intento?: number;
  mensaje: string;
}

// PRD §4.11 — las 5 causas de traslado fallido. El monto/porcentaje exacto
// del CARGO en sí (no el descuento de reintento) no está definido en el PRD
// para ninguna causa salvo la nota de §4.2; queda como decisión de
// Producto/Admin, igual que las reglas de seguro en §4.9. Por eso esta tabla
// solo codifica los hechos que el PRD sí establece (atribución de
// responsabilidad y si bloquea/requiere reagendar), no un porcentaje inventado.
const REGLAS_TRASLADO_FALLIDO: Record<CausaFallido, ReglaCausa> = {
  imputable_cliente: {
    cargo_aplica_cliente: true,
    requiere_reagendamiento: true,
    porcentaje_descuento_segundo_intento: 50,
    mensaje:
      "Traslado fallido por causa imputable al cliente. Aplica cargo; segundo intento con 50% de descuento (PRD §4.2)."
  },
  operativo: {
    cargo_aplica_cliente: false,
    requiere_reagendamiento: true,
    mensaje:
      "Traslado fallido por falla operativa interna, sin causa atribuible a cliente o conductor. Sin cargo al cliente."
  },
  fuerza_mayor: {
    cargo_aplica_cliente: false,
    requiere_reagendamiento: true,
    mensaje: "Traslado fallido por fuerza mayor (fuera del control de cualquier parte). Sin cargo al cliente."
  },
  documentacion: {
    cargo_aplica_cliente: true,
    requiere_reagendamiento: true,
    mensaje:
      "Traslado fallido por documentación incompleta o inválida no corregida dentro del flujo. Cargo pendiente de definición por Producto/Admin."
  },
  vehiculo_no_circulable: {
    cargo_aplica_cliente: true,
    requiere_reagendamiento: false,
    mensaje:
      "Traslado fallido: el vehículo no cumple la condición de circular rodando al momento de la recolección. Cargo pendiente de definición por Producto/Admin."
  }
};

export function clasificarTrasladoFallido(causa: CausaFallido): ResultadoTrasladoFallido {
  const regla = REGLAS_TRASLADO_FALLIDO[causa];
  return { causa, ...regla };
}
