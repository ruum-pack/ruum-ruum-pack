import * as React from "react";
import { StatusChip } from "./StatusChip";
import type { EstadoVisualTraslado } from "./status-mapping";

/**
 * Documentos operativos V1.0 (cap. 28).
 * Encabezado lockup horizontal + folio arriba derecha. Pie "Ruum Ruum by MoviliaX".
 * Navy títulos, teal-deep etiquetas, Inter (Arial/Calibri fallback), sin fondos oscuros grandes.
 */

function Encabezado({ folio, titulo }: { folio: string; titulo: string }) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-[var(--ruum-border)] pb-4">
      <div>
        <p className="font-body text-sm font-extrabold tracking-tight text-[var(--ruum-navy)]">Ruum Ruum</p>
        <p className="font-body text-xs font-medium uppercase tracking-wider text-[var(--ruum-teal-deep)]">Conductores certificados</p>
        <h1 className="mt-2 font-body text-xl font-bold text-[var(--ruum-navy)]">{titulo}</h1>
      </div>
      <p className="shrink-0 rounded-full border border-[var(--ruum-action)]/30 bg-[var(--ruum-action-bg)] px-3 py-1 font-body text-xs font-bold tabular-nums text-[var(--ruum-action-text)]">
        Folio {folio}
      </p>
    </div>
  );
}

function Pie() {
  return (
    <p className="mt-6 border-t border-[var(--ruum-border)] pt-3 text-center font-body text-xs text-[var(--ruum-muted)]">
      Ruum Ruum by MoviliaX · Seguridad, evidencia y trazabilidad en cada viaje.
    </p>
  );
}

function Dato({ etiqueta, valor }: { etiqueta: string; valor: string }) {
  return (
    <div>
      <dt className="font-body text-xs font-semibold uppercase tracking-wider text-[var(--ruum-teal-deep)]">{etiqueta}</dt>
      <dd className="mt-0.5 font-body text-sm text-[var(--ruum-navy)] tabular-nums">{valor}</dd>
    </div>
  );
}

export interface ReporteTrasladoProps {
  folio: string;
  cliente: string;
  servicio: string;
  vehiculo: string;
  ruta: string;
  conductor: string;
  nivel: string;
  estado: EstadoVisualTraslado;
  tiempos?: string;
  odometro?: string;
  combustible?: string;
}

export function ReporteTraslado(props: ReporteTrasladoProps) {
  return (
    <article className="rounded-[20px] border border-[var(--ruum-border)] bg-white p-5 font-body shadow-[var(--ruum-elevation-1)] print:shadow-none">
      <Encabezado folio={props.folio} titulo="Reporte de traslado" />
      <div className="mt-4">
        <StatusChip estado={props.estado} />
      </div>
      <dl className="mt-4 grid grid-cols-2 gap-4">
        <Dato etiqueta="Cliente" valor={props.cliente} />
        <Dato etiqueta="Servicio" valor={props.servicio} />
        <Dato etiqueta="Vehículo" valor={props.vehiculo} />
        <Dato etiqueta="Ruta" valor={props.ruta} />
        <Dato etiqueta="Conductor" valor={`${props.conductor} · ${props.nivel}`} />
        {props.tiempos ? <Dato etiqueta="Tiempos" valor={props.tiempos} /> : null}
        {props.odometro ? <Dato etiqueta="Odómetro" valor={props.odometro} /> : null}
        {props.combustible ? <Dato etiqueta="Combustible" valor={props.combustible} /> : null}
      </dl>
      <Pie />
    </article>
  );
}

export function ActaEntrega({ folio, vehiculo, origen, destino }: { folio: string; vehiculo: string; origen: string; destino: string }) {
  return (
    <article className="rounded-[20px] border border-[var(--ruum-border)] bg-white p-5 font-body shadow-[var(--ruum-elevation-1)] print:shadow-none">
      <Encabezado folio={folio} titulo="Acta de entrega-recepción" />
      <dl className="mt-4 grid grid-cols-2 gap-4">
        <Dato etiqueta="Vehículo" valor={vehiculo} />
        <Dato etiqueta="Origen" valor={origen} />
        <Dato etiqueta="Destino" valor={destino} />
        <Dato etiqueta="Estado" valor="Se registra con fotos, odómetro, combustible y firma al recoger y entregar." />
      </dl>
      <div className="mt-6 grid grid-cols-2 gap-4">
        <div className="rounded-[12px] border border-[var(--ruum-border)] p-4">
          <p className="text-xs font-semibold uppercase tracking-wider text-[var(--ruum-teal-deep)]">Quien entrega</p>
          <p className="mt-6 border-t border-[var(--ruum-border-input)] pt-2 text-sm text-[var(--ruum-muted)]">Nombre, identificación, hora y firma</p>
        </div>
        <div className="rounded-[12px] border border-[var(--ruum-border)] p-4">
          <p className="text-xs font-semibold uppercase tracking-wider text-[var(--ruum-teal-deep)]">Quien recibe</p>
          <p className="mt-6 border-t border-[var(--ruum-border-input)] pt-2 text-sm text-[var(--ruum-muted)]">Nombre, identificación, hora y firma</p>
        </div>
      </div>
      <Pie />
    </article>
  );
}

export function EstadoPagoConductor({
  folio,
  base,
  reembolsables,
  fechaEstimada,
  estatus,
  causa,
}: {
  folio: string;
  base: string;
  reembolsables: string;
  fechaEstimada: string;
  estatus: string;
  causa?: string;
}) {
  return (
    <article className="rounded-[20px] border border-[var(--ruum-border)] bg-white p-5 font-body shadow-[var(--ruum-elevation-1)] print:shadow-none">
      <Encabezado folio={folio} titulo="Estado de pago" />
      <dl className="mt-4 grid grid-cols-2 gap-4">
        <Dato etiqueta="Pago base" valor={base} />
        <Dato etiqueta="Gastos reembolsables" valor={reembolsables} />
        <Dato etiqueta="Fecha estimada" valor={fechaEstimada} />
        <Dato etiqueta="Estatus" valor={estatus} />
      </dl>
      {causa ? (
        <p role="status" className="mt-4 rounded-[12px] bg-[var(--ruum-warning-bg)] px-3 py-2 text-sm text-[var(--ruum-warning-text)]">
          {causa}
        </p>
      ) : null}
      <Pie />
    </article>
  );
}
