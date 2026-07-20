import Link from "next/link";
import { AlertCard, Button, Card, OperationalCard } from "@ruum/ui";
import { GLOSARIO_OPERATIVO } from "@ruum/shared/constants";
import { getTripPresentation } from "../../lib/trip-presentation";
import { MapaRutaOrigen } from "../viajes/[id]/MapaRutaOrigen";
import { ContactActionBar } from "../viajes/[id]/ContactActionBar";
import { ESTADOS_QUE_REQUIEREN_EVIDENCIA } from "../viajes/[id]/AccionesViaje";
import {
  contactoRelevante,
  destinoOperativo,
  esViajePorCerrar,
  folioViaje,
  nombreVehiculo,
  puntoActual,
  type PasaporteRow
} from "./panel-utils";

export function PanelActiveTrip({ viaje }: { viaje: PasaporteRow }) {
  if (!viaje.estado || !viaje.traslado_id) return null;

  const presentation = getTripPresentation(viaje.estado);
  const punto = puntoActual(viaje, presentation.primaryAction.action);
  const contacto = contactoRelevante(viaje, presentation.primaryAction.action);
  const requiereEvidencia = ESTADOS_QUE_REQUIEREN_EVIDENCIA.includes(viaje.estado);
  const requiereCierre = esViajePorCerrar(viaje);
  const requiereDecisionOperativa = presentation.requiresControlTowerDecision;

  return (
    <section className="mt-8 grid gap-5" aria-label="Traslado activo">
      <OperationalCard>
        <div className="grid gap-5 lg:grid-cols-[1fr_0.7fr] lg:items-center">
          <div>
            <p className="font-body text-sm font-semibold text-route-action">
              Traslado activo · Folio {folioViaje(viaje)}
            </p>
            <h2 className="mt-2 font-display text-3xl font-semibold leading-tight text-text-primary">{presentation.title}</h2>
            <p className="mt-3 max-w-2xl font-body text-base leading-6 text-text-secondary">{presentation.instruction}</p>
            <div className="mt-4 rounded-xl border border-route-action/35 bg-surface px-4 py-3">
              <p className="font-body text-xs uppercase tracking-wide text-text-tertiary">Destino actual</p>
              <p className="mt-1 break-words font-body text-base font-semibold text-text-primary">{destinoOperativo(viaje)}</p>
            </div>
          </div>
          <div className="grid gap-3">
            <Link href={`/viajes/${viaje.traslado_id}`}>
              <Button variant="primary" className="min-h-14 w-full text-base">
                {presentation.primaryAction.label}
              </Button>
            </Link>
            <p className="font-body text-sm text-text-secondary">{nombreVehiculo(viaje)}</p>
          </div>
        </div>
      </OperationalCard>

      <Card>
        <p className="mb-3 font-body text-xs uppercase tracking-wide text-text-tertiary">Mapa</p>
        {punto.lat !== null && punto.lng !== null ? (
          <MapaRutaOrigen destino={{ lat: punto.lat, lng: punto.lng }} />
        ) : (
          <div className="flex h-40 items-center justify-center rounded-xl border border-dashed border-border bg-surface-elevated px-4 text-center font-body text-sm text-tertiary">
            {requiereDecisionOperativa
              ? "Mapa pausado hasta recibir indicaciones de Torre de Control."
              : `Mapa no disponible. Usa la dirección del ${punto.etiqueta.toLowerCase()}.`}
          </div>
        )}
      </Card>

      <Card>
        <p className="font-body text-xs uppercase tracking-wide text-text-tertiary">Contacto</p>
        <ContactActionBar trasladoId={viaje.traslado_id} role={contacto.role} name={contacto.name} phone={contacto.phone} />
      </Card>

      <section className="rounded-xl border border-warning/30 bg-warning/10 p-4 text-text-primary shadow-1">
        <p className="font-body text-sm font-semibold text-warning">Próximo requisito pendiente</p>
        <h2 className="mt-1 font-display text-xl font-semibold text-text-primary">
          {requiereDecisionOperativa
            ? "Esperando Torre de Control"
            : requiereEvidencia
              ? GLOSARIO_OPERATIVO.evidencia
              : requiereCierre
                ? "Cierre pendiente"
                : "Sin requisito bloqueante"}
        </h2>
        <p className="mt-2 font-body text-sm text-text-primary">
          {requiereDecisionOperativa
            ? "Espera indicaciones antes de mover el vehículo o avanzar el traslado."
            : requiereEvidencia
              ? "Completa el registro del vehículo antes de continuar."
              : requiereCierre
                ? "Confirma entrega o cierre operativo para terminar el traslado."
                : "Continúa con la acción principal del traslado activo."}
        </p>
        {(requiereEvidencia || requiereCierre || requiereDecisionOperativa) && (
          <Link href={requiereEvidencia ? `/viajes/${viaje.traslado_id}/evidencia` : `/viajes/${viaje.traslado_id}`}>
            <Button variant="secondary" className="mt-4 w-full sm:w-auto">
              {requiereEvidencia ? "Abrir registro" : "Abrir traslado"}
            </Button>
          </Link>
        )}
      </section>

      <AlertCard>
        <p className="font-body text-xs uppercase tracking-wide text-text-tertiary">Soporte</p>
        <div className="mt-3 grid gap-2 sm:grid-cols-3">
          <Link href={`/viajes/${viaje.traslado_id}#contacto`}>
            <Button variant="secondary" className="w-full">Contacto</Button>
          </Link>
          <Link href={`/viajes/${viaje.traslado_id}#reportar-problema`}>
            <Button variant="secondary" className="w-full">Reportar problema</Button>
          </Link>
          <Link href={`/viajes/${viaje.traslado_id}#emergencia`}>
            <Button variant="emergency" className="w-full">Emergencia</Button>
          </Link>
        </div>
      </AlertCard>
    </section>
  );
}
