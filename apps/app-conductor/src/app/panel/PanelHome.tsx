import Link from "next/link";
import type { Conductor } from "@ruum/shared/types";
import { AlertCard, Aviso, Button, DriverEarning, FinancialCard, OperationalCard, TripCard } from "@ruum/ui";
import { DriverAvailabilityControl } from "./DriverAvailabilityControl";
import type { Disponibilidad } from "./usePanelData";
import { fechaViaje, folioViaje, nombreVehiculo, type PasaporteRow } from "./panel-utils";

type AvisoPrioritario = {
  tono: "info" | "atencion" | "danger";
  titulo: string;
  cuerpo: string;
};

export function PanelHome({
  conductor,
  disponibilidad,
  persistiendoDisponibilidad,
  viajesDisponibles,
  proximoViaje,
  documentoBloqueante,
  avisoPrioritario,
  onSeleccionarDisponibilidad
}: {
  conductor: Conductor | null;
  disponibilidad: Disponibilidad;
  persistiendoDisponibilidad: boolean;
  viajesDisponibles: PasaporteRow[];
  proximoViaje: PasaporteRow | null;
  documentoBloqueante: boolean;
  avisoPrioritario: AvisoPrioritario;
  onSeleccionarDisponibilidad: (disponibilidad: Disponibilidad) => void;
}) {
  return (
    <section className="mt-8 grid gap-5" aria-label="Inicio operativo">
      <OperationalCard>
        <div className="grid gap-6 lg:grid-cols-[1fr_0.9fr] lg:items-center">
          <DriverAvailabilityControl
            value={disponibilidad}
            saving={persistiendoDisponibilidad}
            onChange={onSeleccionarDisponibilidad}
          />
          <Link href="/viajes?vista=disponibles">
            <Button variant="primary" className="min-h-14 w-full text-base">
              Ver oportunidades ({viajesDisponibles.length})
            </Button>
          </Link>
        </div>
      </OperationalCard>

      <TripCard>
        <p className="font-body text-xs uppercase tracking-wide text-text-tertiary">Próximo viaje</p>
        {proximoViaje ? (
          <div className="mt-2 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="font-display text-xl font-semibold">{nombreVehiculo(proximoViaje)}</h2>
              <p className="mt-1 font-body text-sm text-text-secondary">{fechaViaje(proximoViaje)} · Folio {folioViaje(proximoViaje)}</p>
            </div>
            <Link href={`/viajes/${proximoViaje.traslado_id}`}>
              <Button variant="secondary" className="w-full sm:w-auto">Ver viaje</Button>
            </Link>
          </div>
        ) : (
          <p className="mt-2 font-body text-sm text-text-secondary">Aún no tienes viajes aceptados próximos.</p>
        )}
      </TripCard>

      {documentoBloqueante ? (
        <AlertCard>
          <p className="font-body text-sm font-semibold text-text-tertiary">Documento bloqueante</p>
          <div className="mt-2">
            <h2 className="font-display text-xl font-semibold">Revisa tus documentos</h2>
            <p className="mt-2 font-body text-sm text-text-secondary">
              Este pendiente puede bloquear oportunidades. Atiéndelo antes de aceptar nuevos viajes.
            </p>
            <Link href="/cuenta/documentos">
              <Button variant="primary" className="mt-4 w-full sm:w-auto">Abrir documentos</Button>
            </Link>
          </div>
        </AlertCard>
      ) : (
        <TripCard>
          <p className="font-body text-xs uppercase tracking-wide text-text-tertiary">Oportunidades cercanas</p>
          <div className="mt-3 grid gap-3">
            {viajesDisponibles.slice(0, 2).map((viaje) => (
              <Link key={viaje.traslado_id} href="/viajes?vista=disponibles" className="rounded-xl border border-border px-4 py-3 hover:border-route-action hover:bg-route-soft">
                <p className="font-body text-sm font-semibold">{nombreVehiculo(viaje)}</p>
                <p className="mt-1 font-body text-xs text-text-tertiary">Folio {folioViaje(viaje)}</p>
              </Link>
            ))}
            {viajesDisponibles.length === 0 && <p className="font-body text-sm text-text-secondary">No hay oportunidades disponibles por ahora.</p>}
          </div>
        </TripCard>
      )}

      <FinancialCard>
        <p className="font-body text-xs uppercase tracking-wide text-text-tertiary">Ganancia semanal</p>
        <DriverEarning amount={null} status="sin_calcular" currency="MXN" className="mt-2" amountClassName="font-display text-2xl" />
        <Link href="/ganancias" className="mt-3 inline-flex font-body text-sm font-semibold text-route-action hover:underline">
          Abrir módulo de ganancias
        </Link>
      </FinancialCard>

      <AlertCard>
        <p className="font-body text-xs uppercase tracking-wide text-text-tertiary">Aviso prioritario</p>
        <div className="mt-2">
          <Aviso tono={avisoPrioritario.tono}>
            <strong>{avisoPrioritario.titulo}.</strong> {avisoPrioritario.cuerpo}
          </Aviso>
        </div>
      </AlertCard>
    </section>
  );
}
