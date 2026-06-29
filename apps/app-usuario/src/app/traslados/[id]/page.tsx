import { obtenerPasaporteDigital } from "@ruum/api/services";
import { Aviso, EstadoBadge, EstadoStepper, PassportCard } from "@ruum/ui";
import { ETIQUETA_TIPO_VEHICULO } from "@ruum/shared/constants";
import { PASAPORTE_DEMO } from "../../../lib/datos-demo";
import { crearClienteServidor } from "../../../lib/supabase-server";
import { ChatTraslado } from "./ChatTraslado";

async function obtenerDatos(id: string) {
  if (id === "demo-0001") {
    return { pasaporte: PASAPORTE_DEMO, esDemo: true };
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) {
    return { pasaporte: null, esDemo: false };
  }

  // Mismo bug que en app-conductor/viajes/[id] (ver su comentario): un
  // cliente anónimo no puede leer un traslado propio bajo RLS real
  // ("usuario_ve_sus_traslados" exige auth.uid() real). Se usa el cliente
  // de servidor con cookies en su lugar.
  const cliente = await crearClienteServidor();
  const pasaporte = await obtenerPasaporteDigital(cliente, id);
  return { pasaporte, esDemo: false };
}

export default async function PaginaTraslado({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { pasaporte, esDemo } = await obtenerDatos(id);

  if (!pasaporte) {
    return (
      <main className="mx-auto max-w-2xl px-6 py-20 text-center">
        <h1 className="font-display text-2xl font-semibold">No encontramos ese traslado</h1>
        <p className="mt-3 font-body text-sm text-ink/60">
          Revisa el enlace o el folio. Si recién lo creaste, puede tardar unos segundos en aparecer.
        </p>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-2xl px-6 py-12">
      {esDemo && (
        <div className="mb-6">
          <Aviso tono="info">Estás viendo datos de ejemplo, no un traslado real.</Aviso>
        </div>
      )}

      <PassportCard folio={pasaporte.traslado_id.slice(0, 8).toUpperCase()}>
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="font-body text-xs uppercase tracking-wide text-ink/45">Pasaporte Digital de Traslado</p>
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
            <Aviso tono="atencion">
              Este traslado tiene una incidencia abierta. Nuestro equipo te mantendrá informado.
            </Aviso>
          </div>
        )}

        <dl className="mt-8 grid grid-cols-2 gap-4 border-t border-ink/10 pt-6 font-body text-sm">
          <div>
            <dt className="text-ink/45">Conductor</dt>
            <dd className="mt-0.5 font-medium">{pasaporte.conductor_nombre ?? "Por asignar"}</dd>
          </div>
          <div>
            <dt className="text-ink/45">Calificación</dt>
            <dd className="mt-0.5 font-medium">
              {pasaporte.conductor_calificacion ? `${pasaporte.conductor_calificacion} / 5` : "—"}
            </dd>
          </div>
          <div>
            <dt className="text-ink/45">Evidencia inicial</dt>
            <dd className="mt-0.5 font-mono-ruum">{pasaporte.evidencia_inicial_fotos_sincronizadas} fotos</dd>
          </div>
          <div>
            <dt className="text-ink/45">Evidencia final</dt>
            <dd className="mt-0.5 font-mono-ruum">{pasaporte.evidencia_final_fotos_sincronizadas} fotos</dd>
          </div>
          <div>
            <dt className="text-ink/45">Monto pagado</dt>
            <dd className="mt-0.5 font-mono-ruum">${pasaporte.monto_pagado.toLocaleString("es-MX")}</dd>
          </div>
          <div>
            <dt className="text-ink/45">Incidencias abiertas</dt>
            <dd className="mt-0.5 font-mono-ruum">{pasaporte.incidencias_abiertas}</dd>
          </div>
        </dl>
      </PassportCard>

      <ChatTraslado trasladoId={pasaporte.traslado_id} estado={pasaporte.estado} />
    </main>
  );
}
