import { obtenerPasaporteDigital } from "@ruum/api/services";
import { Aviso, EstadoBadge, EstadoStepper, PassportCard } from "@ruum/ui";
import { ETIQUETA_TIPO_VEHICULO } from "@ruum/shared/constants";
import { VIAJES_DISPONIBLES_DEMO, VIAJES_ACEPTADOS_DEMO } from "../../../lib/datos-demo";
import { crearClienteServidor } from "../../../lib/supabase-server";
import { AccionesViaje } from "./AccionesViaje";
import { ChatViaje } from "./ChatViaje";
import { ReportarIncidencia } from "./ReportarIncidencia";
import { Emergencia911 } from "./Emergencia911";

const TODOS_LOS_DEMO = [...VIAJES_DISPONIBLES_DEMO, ...VIAJES_ACEPTADOS_DEMO];

async function obtenerDatos(id: string) {
  const demo = TODOS_LOS_DEMO.find((v) => v.traslado_id === id);
  if (demo) {
    return { pasaporte: demo, esDemo: true };
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) {
    return { pasaporte: null, esDemo: false };
  }

  // Bug real encontrado en producción (2026-06-29): un cliente anónimo (sin
  // cookies, sin sesión) sí podía ver viajes disponibles sin asignar
  // (política RLS abierta por estado), pero en cuanto el conductor acepta
  // uno, solo aplica "conductor_ve_sus_traslados_asignados" — que exige
  // auth.uid() real. Sin sesión, esa consulta nunca encontraba la fila, y
  // la pantalla mostraba "No encontramos ese viaje" justo después de
  // aceptar. Se usa el cliente de servidor con cookies (sesión real) en su
  // lugar, mismo patrón que ya usan las acciones de aceptar/evidencia.
  const cliente = await crearClienteServidor();
  const pasaporte = await obtenerPasaporteDigital(cliente, id);
  return { pasaporte, esDemo: false };
}

export default async function PaginaDetalleViaje({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { pasaporte, esDemo } = await obtenerDatos(id);

  if (!pasaporte) {
    return (
      <main className="mx-auto max-w-2xl px-6 py-20 text-center">
        <h1 className="font-display text-2xl font-semibold">No encontramos ese viaje</h1>
        <p className="mt-3 font-body text-sm text-ink/60">Revisa el enlace o vuelve a la lista de viajes.</p>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-2xl px-6 py-12">
      {esDemo && (
        <div className="mb-6">
          <Aviso tono="info">Estás viendo datos de ejemplo, no un viaje real.</Aviso>
        </div>
      )}

      <Emergencia911 trasladoId={pasaporte.traslado_id} esDemo={esDemo} />

      <PassportCard folio={pasaporte.traslado_id.slice(0, 8).toUpperCase()}>
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="font-body text-xs uppercase tracking-wide text-ink/45">Detalle del viaje</p>
            <h1 className="mt-1 font-display text-xl font-semibold">
              {pasaporte.vehiculo_marca} {pasaporte.vehiculo_modelo} {pasaporte.vehiculo_anio}
              {pasaporte.vehiculo_tipo && (
                <span className="ml-2 font-body text-sm font-normal text-ink/50">
                  · {ETIQUETA_TIPO_VEHICULO[pasaporte.vehiculo_tipo]}
                </span>
              )}
            </h1>
          </div>
          <EstadoBadge estado={pasaporte.estado} />
        </div>

        <div className="mt-8">
          <EstadoStepper estado={pasaporte.estado} />
        </div>

        {pasaporte.tiene_incidencia_abierta && (
          <div className="mt-6">
            <Aviso tono="atencion">Este viaje tiene una incidencia abierta.</Aviso>
          </div>
        )}

        <dl className="mt-8 grid grid-cols-2 gap-4 border-t border-ink/10 pt-6 font-body text-sm">
          <div>
            <dt className="text-ink/45">Monto estimado</dt>
            <dd className="mt-0.5 font-mono-ruum">${pasaporte.precio_cotizado?.toLocaleString("es-MX") ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-ink/45">Momento de pago</dt>
            <dd className="mt-0.5 font-medium capitalize">{pasaporte.tipo_pago?.replace("_", " ") ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-ink/45">Evidencia inicial</dt>
            <dd className="mt-0.5 font-mono-ruum">{pasaporte.evidencia_inicial_fotos_sincronizadas} / 5 fotos</dd>
          </div>
          <div>
            <dt className="text-ink/45">Evidencia final</dt>
            <dd className="mt-0.5 font-mono-ruum">{pasaporte.evidencia_final_fotos_sincronizadas} / 5 fotos</dd>
          </div>
        </dl>

        <AccionesViaje trasladoId={pasaporte.traslado_id} estado={pasaporte.estado} esDemo={esDemo} />
        <ReportarIncidencia trasladoId={pasaporte.traslado_id} esDemo={esDemo} />
      </PassportCard>

      <ChatViaje trasladoId={pasaporte.traslado_id} estado={pasaporte.estado} />
    </main>
  );
}
