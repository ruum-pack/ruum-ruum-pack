"use client";

import { useState } from "react";
import Link from "next/link";
import { Aviso, Button, PassportCard } from "@ruum/ui";

type EstatusIncidencia = "Nueva" | "En revisión" | "Requiere información" | "En seguimiento" | "Resuelta" | "Cerrada" | "Escalada";

const TIPOS = [
  "Daño reportado",
  "Retraso",
  "Falta de evidencia",
  "Contacto no disponible",
  "Problema con documentación",
  "Problema con pago",
  "Cancelación",
  "Diferencia en kilometraje o combustible",
  "Problema con conductor o usuario",
  "Otro"
];

const ESTILO: Record<EstatusIncidencia, string> = {
  Nueva: "border-status-error/25 bg-status-error-soft text-status-error",
  "En revisión": "border-status-info/30 bg-status-info-soft text-status-info",
  "Requiere información": "border-status-warning/40 bg-status-warning-soft text-status-warning",
  "En seguimiento": "border-signal/30 bg-signal-soft text-ink",
  Resuelta: "border-status-success/30 bg-status-success-soft text-status-success",
  Cerrada: "border-ink/15 bg-ink/[0.04] text-text-secondary",
  Escalada: "border-status-error/25 bg-status-error-soft text-status-error"
};

const INCIDENCIAS = [
  {
    id: "INC-2026-0048",
    viaje: "RR-TR-10291",
    trasladoId: "demo-admin-002",
    usuario: "Daniela Fuentes",
    conductor: "Conductor Demo",
    tipo: "Diferencia en kilometraje o combustible",
    fechaHora: "2026-06-29 14:42",
    descripcion: "El kilometraje final no coincide con el registro inicial y falta foto clara del tablero.",
    evidencia: "3 fotos, bitácora GPS, comentario del conductor",
    responsable: "Mariana Ops",
    estatus: "En revisión" as EstatusIncidencia,
    resolucion: "Pendiente de validar evidencia final."
  },
  {
    id: "INC-2026-0049",
    viaje: "RR-TR-10302",
    trasladoId: "demo-admin-001",
    usuario: "Agencia Norte",
    conductor: "Pendiente de asignar",
    tipo: "Contacto no disponible",
    fechaHora: "2026-06-29 16:15",
    descripcion: "La persona de entrega no responde teléfono ni WhatsApp autorizado.",
    evidencia: "Registro de llamadas y nota operativa",
    responsable: "Torre 2",
    estatus: "Requiere información" as EstatusIncidencia,
    resolucion: "Solicitar contacto alterno al usuario."
  },
  {
    id: "INC-2026-0050",
    viaje: "RR-TR-10309",
    trasladoId: "demo-admin-003",
    usuario: "Ricardo Cervantes",
    conductor: "Conductora Demo 2",
    tipo: "Problema con pago",
    fechaHora: "2026-06-30 09:10",
    descripcion: "Pago retenido por diferencia entre tarifa final y gasto autorizado.",
    evidencia: "Comprobante de peaje y ajuste financiero",
    responsable: "Finanzas",
    estatus: "Escalada" as EstatusIncidencia,
    resolucion: "Finanzas revisa aprobación del gasto."
  }
];

const ACCIONES = [
  "Asignar responsable",
  "Agregar notas",
  "Solicitar evidencia adicional",
  "Cambiar estatus",
  "Asociar documentos",
  "Registrar resolución",
  "Notificar al usuario",
  "Notificar al conductor"
];

function Badge({ estatus }: { estatus: EstatusIncidencia }) {
  return <span className={`rounded-full border px-3 py-1.5 font-body text-xs font-semibold ${ESTILO[estatus]}`}>{estatus}</span>;
}

export default function PaginaIncidenciasAdmin() {
  const [tipo, setTipo] = useState("Todos");

  const visibles = tipo === "Todos" ? INCIDENCIAS : INCIDENCIAS.filter((incidencia) => incidencia.tipo === tipo);

  return (
    <main className="mx-auto max-w-6xl px-6 py-8 sm:px-8 sm:py-10">
      <h1 className="font-display text-2xl font-semibold">Incidencias</h1>
      <p className="mt-1 font-body text-sm text-text-secondary">
        Seguimiento operativo de reportes, evidencia, responsables internos y resolución.
      </p>

      <div className="mt-4">
        <Aviso tono="info">Vista MVP con datos de ejemplo para operación administrativa.</Aviso>
      </div>

      <section className="mt-6">
        <PassportCard>
          <p className="font-body text-xs uppercase tracking-wide text-text-tertiary">Tipos de incidencia</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {["Todos", ...TIPOS].map((item) => (
              <button
                key={item}
                onClick={() => setTipo(item)}
                className={[
                  "rounded-full border px-3 py-1.5 font-body text-xs font-semibold",
                  tipo === item ? "border-signal bg-signal-soft text-ink" : "border-ink/10 text-text-secondary hover:border-ink/25"
                ].join(" ")}
              >
                {item}
              </button>
            ))}
          </div>
        </PassportCard>
      </section>

      <section className="mt-6 grid gap-4">
        {visibles.map((incidencia) => (
          <PassportCard key={incidencia.id}>
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <p className="font-mono-ruum text-xs uppercase tracking-wide text-text-tertiary">ID interno {incidencia.id}</p>
                <h2 className="mt-1 font-display text-xl font-semibold">{incidencia.tipo}</h2>
                <p className="mt-2 font-body text-sm text-text-secondary">{incidencia.descripcion}</p>
              </div>
              <Badge estatus={incidencia.estatus} />
            </div>

            <dl className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <div>
                <dt className="font-body text-xs uppercase tracking-wide text-text-tertiary">Traslado relacionado</dt>
                <dd className="mt-1 font-body text-sm font-medium">
                  <Link href={`/viajes/${incidencia.trasladoId}`} className="text-status-info">
                    {incidencia.viaje}
                  </Link>
                </dd>
              </div>
              <div>
                <dt className="font-body text-xs uppercase tracking-wide text-text-tertiary">Usuario</dt>
                <dd className="mt-1 font-body text-sm font-medium">{incidencia.usuario}</dd>
              </div>
              <div>
                <dt className="font-body text-xs uppercase tracking-wide text-text-tertiary">Conductor</dt>
                <dd className="mt-1 font-body text-sm font-medium">{incidencia.conductor}</dd>
              </div>
              <div>
                <dt className="font-body text-xs uppercase tracking-wide text-text-tertiary">Fecha y hora</dt>
                <dd className="mt-1 font-body text-sm font-medium">{incidencia.fechaHora}</dd>
              </div>
              <div>
                <dt className="font-body text-xs uppercase tracking-wide text-text-tertiary">Evidencia asociada</dt>
                <dd className="mt-1 font-body text-sm font-medium">{incidencia.evidencia}</dd>
              </div>
              <div>
                <dt className="font-body text-xs uppercase tracking-wide text-text-tertiary">Responsable interno</dt>
                <dd className="mt-1 font-body text-sm font-medium">{incidencia.responsable}</dd>
              </div>
              <div className="sm:col-span-2">
                <dt className="font-body text-xs uppercase tracking-wide text-text-tertiary">Resolución</dt>
                <dd className="mt-1 font-body text-sm font-medium">{incidencia.resolucion}</dd>
              </div>
            </dl>

            <div className="mt-5 flex flex-wrap gap-2">
              {ACCIONES.map((accion) => (
                <Button key={accion} variant="quiet">
                  {accion}
                </Button>
              ))}
            </div>
          </PassportCard>
        ))}
      </section>
    </main>
  );
}
