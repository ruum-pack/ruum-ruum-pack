import type { Database } from "@ruum/shared/types";
import { MENSAJES_CLAVE_UX } from "@ruum/shared/constants";
import { HORAS_HABILES_VERIFICACION_CUENTA_NUEVA } from "@ruum/shared/rules";

type PasaporteRow = Database["public"]["Views"]["pasaporte_digital"]["Row"];
type UsuarioRow = Database["public"]["Tables"]["usuarios"]["Row"];
type EstadoTraslado = Database["public"]["Enums"]["estado_traslado"];

/**
 * Estados en los que un traslado ya no necesita seguimiento en el Inicio.
 * El PRD no define un concepto de "viaje activo" para esta pantalla — es la
 * misma clase de decisión de UX que ya toma `packages/ui/src/lib/etapas.ts`
 * (ESTADOS_RAMIFICADOS) o `services/traslados.ts` (listarViajesAceptados) en
 * sus propios contextos: un traslado deja de ser "lo que está pasando ahora"
 * cuando se cierra, se cancela, falla, o su disputa/reclamo posterior al
 * cierre ya se resolvió. `cierre_operativo_con_incidencia_abierta` también
 * cuenta como cerrado: la parte operativa (mover el vehículo) ya terminó —
 * lo que sigue es un proceso de reclamo, no algo que se siga en el stepper.
 */
const ESTADOS_TRASLADO_FINALIZADOS: EstadoTraslado[] = [
  "servicio_cerrado",
  "servicio_cancelado",
  "traslado_fallido",
  "reclamo_resuelto",
  "disputa_resuelta",
  "cierre_operativo_con_incidencia_abierta"
];

export function esTrasladoActivo(estado: EstadoTraslado): boolean {
  return !ESTADOS_TRASLADO_FINALIZADOS.includes(estado);
}

/**
 * El traslado activo más reciente para mostrar como protagonista del
 * Inicio, o null si no hay ninguno. No asume que `traslados` venga
 * ordenado — ordena por su cuenta para no depender del caller.
 */
export function obtenerViajeActivo(traslados: PasaporteRow[]): PasaporteRow | null {
  const activos = [...traslados]
    .filter((t) => esTrasladoActivo(t.estado))
    .sort((a, b) => new Date(b.creado_en).getTime() - new Date(a.creado_en).getTime());

  return activos[0] ?? null;
}

/** Traslados ya finalizados, más recientes primero — para "Últimos viajes". */
export function obtenerHistorial(traslados: PasaporteRow[]): PasaporteRow[] {
  return [...traslados].sort((a, b) => new Date(b.creado_en).getTime() - new Date(a.creado_en).getTime());
}

export interface NotificacionInicio {
  id: string;
  tono: "info" | "atencion" | "peligro";
  mensaje: string;
  href?: string;
}

function folioCorto(trasladoId: string): string {
  return trasladoId.slice(0, 8).toUpperCase();
}

/**
 * No existe una tabla de notificaciones en el esquema (ver supabase/migrations).
 * Todo lo que el usuario necesita saber "ahora" ya está representado en el
 * estado de sus traslados y en su propio registro de usuario — esta función
 * deriva avisos a partir de esos datos reales en vez de inventar una fuente
 * nueva. Los de mayor urgencia (tono "atencion"/"peligro") van primero.
 */
export function construirNotificaciones(usuario: UsuarioRow | null, traslados: PasaporteRow[]): NotificacionInicio[] {
  const notificaciones: NotificacionInicio[] = [];

  if (usuario?.estado_verificacion === "rechazado") {
    notificaciones.push({
      id: "verificacion-rechazada",
      tono: "peligro",
      mensaje: "No pudimos verificar tu cuenta. Contáctanos para revisar qué falta."
    });
  } else if (usuario?.estado_verificacion === "pendiente" || usuario?.estado_verificacion === "en_revision") {
    notificaciones.push({
      id: "verificacion-en-curso",
      tono: "info",
      mensaje: `Tu cuenta está en proceso de verificación — puede tardar hasta ${HORAS_HABILES_VERIFICACION_CUENTA_NUEVA} horas hábiles.`
    });
  }

  for (const traslado of traslados) {
    const folio = folioCorto(traslado.traslado_id);
    const href = `/traslados/${traslado.traslado_id}`;

    if (traslado.tiene_incidencia_abierta) {
      notificaciones.push({
        id: `incidencia-${traslado.traslado_id}`,
        tono: "atencion",
        mensaje: `Tu traslado ${folio} tiene una incidencia abierta. Te mantenemos informado.`,
        href
      });
    }

    if (traslado.estado === "pago_pendiente") {
      notificaciones.push({
        id: `pago-${traslado.traslado_id}`,
        tono: "atencion",
        mensaje: `Tienes un pago pendiente en tu traslado ${folio}. Págalo desde aquí.`,
        href
      });
    }

    if (traslado.estado === "reclamo_abierto" || traslado.estado === "disputa_abierta") {
      notificaciones.push({
        id: `disputa-${traslado.traslado_id}`,
        tono: "atencion",
        mensaje: `${MENSAJES_CLAVE_UX.disputa} (traslado ${folio})`,
        href
      });
    }

    if (traslado.estado === "dano_no_reportado_en_revision") {
      notificaciones.push({
        id: `dano-${traslado.traslado_id}`,
        tono: "atencion",
        mensaje: `Se reportó un posible daño no documentado en tu traslado ${folio}. Está en revisión.`,
        href
      });
    }
  }

  return notificaciones;
}
