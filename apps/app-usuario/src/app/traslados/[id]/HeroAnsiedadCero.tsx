import Link from "next/link";
import { Button, EstadoBadge, PassportCard } from "@ruum/ui";
import { ETIQUETA_ESTADO_TRASLADO } from "@ruum/shared/states";
import { ETIQUETA_TIPO_VEHICULO } from "@ruum/shared/constants";
import type { Database } from "@ruum/shared/types";

type Pasaporte = Database["public"]["Views"]["pasaporte_digital"]["Row"];
type Conductor = Pick<Database["public"]["Tables"]["conductores"]["Row"], "id" | "nombre" | "estado" | "nivel_operativo_vigente" | "calificacion_promedio" | "traslados_completados" | "telefono">;

const ORDEN_ESTADOS = [
  "solicitud_creada","servicio_confirmado","pendiente_de_conductor","conductor_asignado","conductor_en_camino_al_origen","conductor_en_punto_de_recoleccion","verificacion_vehiculo_en_proceso","evidencia_inicial_en_proceso","evidencia_inicial_completada","vehiculo_recibido","traslado_en_curso","llegada_a_destino","evidencia_final_en_proceso","evidencia_final_completada","entrega_confirmada","servicio_cerrado",
] as const;

function progreso(estado: string): number {
  const idx = (ORDEN_ESTADOS as readonly string[]).indexOf(estado);
  if (idx === -1) return 0;
  return Math.round(((idx + 1) / ORDEN_ESTADOS.length) * 100);
}

function proximaAccion(estado: string): string {
  const map: Record<string, string> = {
    solicitud_creada: "Estamos revisando tu solicitud. Te avisamos en minutos.",
    servicio_confirmado: "¡Solicitud aceptada! Buscando conductor cercano.",
    pendiente_de_conductor: "Buscando conductor — no necesitas hacer nada.",
    conductor_asignado: "Conductor asignado. Puedes chatear con él.",
    conductor_en_camino_al_origen: "Conductor en camino a recoger tu vehículo. Ten lista la documentación.",
    conductor_en_punto_de_recoleccion: "Conductor llegó. Verificará el vehículo contigo.",
    evidencia_inicial_en_proceso: "Capturando evidencia inicial — revisa que estés de acuerdo con las fotos.",
    vehiculo_recibido: "Vehículo recibido. En breve inicia el traslado.",
    traslado_en_curso: "Tu vehículo está en camino. Sigue la ubicación en tiempo real.",
    llegada_a_destino: "¡Llegando a destino! Prepara la entrega.",
    evidencia_final_en_proceso: "Capturando evidencia final.",
    entrega_confirmada: "¡Entregado! Revisa la evidencia final.",
    servicio_cerrado: "Viaje finalizado. ¡Gracias por confiar en Ruum Ruum!",
  };
  return map[estado] ?? "Seguimos tu traslado en tiempo real.";
}

function calcularEta(estado: string, fechaHoraProgramada: string | null | undefined): string | null {
  if (!fechaHoraProgramada) return null;
  
  const ahora = new Date();
  const fechaProgramada = new Date(fechaHoraProgramada);
  
  if (fechaProgramada <= ahora) return null;
  
  const diferenciaMs = fechaProgramada.getTime() - ahora.getTime();
  const horas = Math.floor(diferenciaMs / (1000 * 60 * 60));
  const minutos = Math.floor((diferenciaMs % (1000 * 60 * 60)) / (1000 * 60));
  
  if (horas > 0) {
    return `ETA: ~${horas}h ${minutos}m`;
  } else if (minutos > 0) {
    return `ETA: ~${minutos}m`;
  }
  return null;
}

function puedeLlamar(estado: string): boolean {
  const estadosConLlamada = [
    "conductor_asignado",
    "conductor_en_camino_al_origen",
    "conductor_en_punto_de_recoleccion",
    "traslado_en_curso",
    "llegada_a_destino",
    "evidencia_final_en_proceso",
  ];
  return estadosConLlamada.includes(estado);
}

function puedeChatear(estado: string): boolean {
  const estadosConChat = [
    "conductor_asignado",
    "conductor_en_camino_al_origen",
    "conductor_en_punto_de_recoleccion",
    "traslado_en_curso",
    "llegada_a_destino",
  ];
  return estadosConChat.includes(estado);
}

function iniciales(nombre: string | null | undefined) {
  if (!nombre) return "RR";
  return nombre.split(" ").filter(Boolean).slice(0,2).map(p=>p[0]?.toUpperCase()).join("");
}

export function HeroAnsiedadCero({ pasaporte, conductor, traslado, trasladoId }: { 
  pasaporte: Pasaporte; 
  conductor: Conductor | null; 
  traslado: { 
    origen_direccion: string | null; 
    origen_ciudad: string | null; 
    destino_direccion: string | null; 
    destino_ciudad: string | null;
    fecha_hora_programada: string | null;
  } | null; 
  trasladoId: string 
}) {
  const estado = pasaporte.estado ?? "solicitud_creada";
  const pct = progreso(estado);
  const accion = proximaAccion(estado);
  const vehiculoNombre = [pasaporte.vehiculo_marca, pasaporte.vehiculo_modelo, pasaporte.vehiculo_anio].filter(Boolean).join(" ");
  const eta = calcularEta(estado, traslado?.fecha_hora_programada ?? pasaporte.fecha_hora_programada);
  const puedeLlamarConductor = puedeLlamar(estado);
  const puedeChatearConductor = puedeChatear(estado);
  
  const telefonoConductor = conductor?.telefono ?? pasaporte.conductor_telefono;

  return (
    <PassportCard folio={`#RM-${trasladoId.slice(0,4).toUpperCase()}`} acento={pasaporte.tiene_incidencia_abierta ?? false} className="mt-4">
      <div className="flex flex-col gap-4">
        {/* Estado grande + progreso + ETA */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <p className="font-body text-xs font-semibold uppercase tracking-wide text-ink/55">Estado actual</p>
            <h2 className="mt-1 font-display text-xl font-black leading-tight text-ink sm:text-2xl">{ETIQUETA_ESTADO_TRASLADO[estado as keyof typeof ETIQUETA_ESTADO_TRASLADO] ?? estado}</h2>
            <p className="mt-2 font-body text-sm leading-5 text-ink/70">{accion}</p>
            
            {/* ETA - SIEMPRE VISIBLE */}
            {eta && (
              <p className="mt-2 font-display text-lg font-bold text-signal">
                {eta}
              </p>
            )}
            
            <div className="mt-3 h-2 w-full max-w-md overflow-hidden rounded-full bg-ink/10">
              <div className="h-full bg-signal transition-all" style={{ width: `${pct}%` }} aria-label={`Progreso ${pct}%`} />
            </div>
            <p className="mt-1 font-body text-xs text-ink/45">{pct}% completado · Actualizado {pasaporte.actualizado_en ? new Date(pasaporte.actualizado_en).toLocaleString("es-MX", { timeZone: "America/Mexico_City" }) : "ahora"}</p>
          </div>
          <div className="shrink-0 self-start">
            <EstadoBadge estado={estado as never} />
          </div>
        </div>

        {/* Conductor — SIEMPRE VISIBLE con acciones directas */}
        <div className="rounded-xl border border-ink/10 bg-mist p-4">
          <p className="font-body text-xs font-semibold uppercase tracking-wide text-ink/45">Tu conductor</p>
          {conductor || pasaporte.conductor_nombre ? (
            <div className="mt-3 flex items-center gap-3">
              <div className="flex size-12 shrink-0 items-center justify-center rounded-full bg-ink font-display text-sm font-bold text-mist">
                {iniciales(conductor?.nombre ?? pasaporte.conductor_nombre)}
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-body text-sm font-bold text-ink truncate">{conductor?.nombre ?? pasaporte.conductor_nombre}</p>
                <p className="font-body text-xs text-ink/55">
                  {conductor?.nivel_operativo_vigente ?? pasaporte.conductor_nivel ?? "Certificado"} · 
                  {pasaporte.conductor_calificacion ? `${pasaporte.conductor_calificacion.toFixed(1)}★` : "—"} · 
                  {conductor?.traslados_completados ?? pasaporte.conductor_traslados_completados ?? "—"} traslados
                </p>
              </div>
              <div className="flex shrink-0 gap-2">
                {puedeChatearConductor && (
                  <a 
                    href="#chat-conductor" 
                    className="inline-flex min-h-10 items-center justify-center rounded-xl bg-signal px-4 py-2 font-display text-xs font-bold text-ink shadow-sm hover:bg-signal/90 transition"
                  >
                    Chat
                  </a>
                )}
                {puedeLlamarConductor && telefonoConductor && (
                  <a 
                    href={`tel:${telefonoConductor}`}
                    className="inline-flex min-h-10 items-center justify-center rounded-xl border border-ink/15 bg-mist px-3 py-2 font-body text-xs font-semibold text-ink hover:border-ink/30 hover:bg-ink/[0.04] transition"
                  >
                    ✆ Llamar
                  </a>
                )}
                <Link 
                  href={`/soporte?viaje=${trasladoId}`} 
                  className="inline-flex min-h-10 items-center justify-center rounded-xl border border-ink/15 bg-mist px-3 py-2 font-body text-xs font-semibold text-ink hover:border-ink/30 transition"
                >
                  Ayuda
                </Link>
              </div>
            </div>
          ) : (
            <div className="mt-3 rounded-lg border border-dashed border-ink/15 bg-ink/[0.02] px-3 py-3">
              <p className="font-body text-sm font-semibold text-ink">Por asignar</p>
              <p className="font-body text-xs text-ink/55">Te avisamos en cuanto tengamos conductor. Tiempo promedio: &lt;15 min.</p>
            </div>
          )}
          <p className="mt-2 font-body text-xs leading-5 text-ink/55">
            Vehículo: <span className="font-semibold text-ink">{vehiculoNombre || "—"}</span> 
            {pasaporte.vehiculo_tipo ? `· ${ETIQUETA_TIPO_VEHICULO[pasaporte.vehiculo_tipo as never]}` : ""} · 
            Placas <span className="font-mono-ruum font-semibold">{pasaporte.vehiculo_placas ?? "—"}</span>
          </p>
        </div>

        {/* Ruta resumida abierta */}
        <div className="grid gap-3 rounded-xl border border-route/20 bg-route-soft/40 p-4 sm:grid-cols-2">
          <div>
            <p className="font-body text-xs font-semibold uppercase tracking-wide text-route-dark">Origen</p>
            <p className="mt-1 font-body text-sm font-semibold text-ink">{traslado?.origen_direccion ?? pasaporte.origen_ciudad ?? "Pendiente"}</p>
            <p className="font-body text-xs text-ink/55">{pasaporte.origen_ciudad ?? ""}</p>
          </div>
          <div>
            <p className="font-body text-xs font-semibold uppercase tracking-wide text-route-dark">Destino</p>
            <p className="mt-1 font-body text-sm font-semibold text-ink">{traslado?.destino_direccion ?? pasaporte.destino_ciudad ?? "Pendiente"}</p>
            <p className="font-body text-xs text-ink/55">{pasaporte.destino_ciudad ?? ""}</p>
          </div>
          <div className="sm:col-span-2 mt-1 flex items-center gap-2 font-body text-xs text-ink/55">
            <span className="inline-flex h-1.5 flex-1 rounded-full bg-gradient-to-r from-signal via-route to-control opacity-60" aria-hidden />
            <span>{pasaporte.origen_ciudad ?? "Origen"} → {pasaporte.destino_ciudad ?? "Destino"}</span>
          </div>
        </div>

        {pasaporte.tiene_incidencia_abierta && (
          <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3">
            <p className="font-body text-sm font-bold text-amber-900">⚠️ Incidencia abierta</p>
            <p className="font-body text-xs leading-5 text-amber-800/80">Nuestro equipo ya está revisando. Te mantendremos informado desde este Pasaporte.</p>
          </div>
        )}
      </div>
    </PassportCard>
  );
}
