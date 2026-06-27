"use client";

import { useState } from "react";
import Link from "next/link";
import { Button, Aviso, PassportCard } from "@ruum/ui";
import { CONDUCTOR_DEMO, RESUMEN_SEMANAL_DEMO } from "../lib/datos-demo";

type Disponibilidad = "disponible" | "no_disponible" | "en_viaje" | "pausado";

const ETIQUETA_DISPONIBILIDAD: Record<Disponibilidad, string> = {
  disponible: "Disponible",
  no_disponible: "No disponible",
  en_viaje: "En viaje",
  pausado: "Pausado"
};

export default function PaginaPanel() {
  // PRD §16.2 — "Botón principal, altamente visible, para activar/desactivar
  // disponibilidad." No existe todavía una columna de disponibilidad en
  // tiempo real en conductores (es un concepto distinto de
  // conductores.estado, que es sobre certificación/suspensión, no sobre si
  // el conductor está trabajando en este momento). Mientras esa columna no
  // exista, este botón es solo visual — no se persiste al recargar.
  const [disponibilidad, setDisponibilidad] = useState<Disponibilidad>("disponible");

  function alternarDisponibilidad() {
    setDisponibilidad((prev) => (prev === "disponible" ? "no_disponible" : "disponible"));
  }

  return (
    <main className="mx-auto max-w-2xl px-6 py-12">
      <header className="flex items-center justify-between">
        <div>
          <span className="font-display text-lg font-semibold tracking-tight">Ruum Ruum Conductor</span>
          <p className="mt-0.5 font-body text-sm text-ink/55">Hola, {CONDUCTOR_DEMO.nombre}</p>
        </div>
      </header>

      <div className="mt-8">
        <PassportCard>
          <div className="flex items-center justify-between">
            <div>
              <p className="font-body text-xs uppercase tracking-wide text-ink/45">Disponibilidad</p>
              <p className="mt-1 font-display text-lg font-semibold">{ETIQUETA_DISPONIBILIDAD[disponibilidad]}</p>
            </div>
            <Button variant={disponibilidad === "disponible" ? "primario" : "secundario"} onClick={alternarDisponibilidad}>
              {disponibilidad === "disponible" ? "Pasar a no disponible" : "Activar disponibilidad"}
            </Button>
          </div>
        </PassportCard>
      </div>

      <div className="mt-4">
        <Aviso tono="info">
          Este botón todavía no se guarda entre sesiones — falta la columna de disponibilidad en tiempo real.
        </Aviso>
      </div>

      <section className="mt-8 grid grid-cols-2 gap-4">
        <PassportCard>
          <p className="font-body text-xs uppercase tracking-wide text-ink/45">Vehículos trasladados</p>
          <p className="mt-2 font-display text-2xl font-semibold">{CONDUCTOR_DEMO.traslados_completados}</p>
          <p className="font-body text-xs text-ink/45">esta semana (demo)</p>
        </PassportCard>
        <PassportCard>
          <p className="font-body text-xs uppercase tracking-wide text-ink/45">Calificación</p>
          <p className="mt-2 font-display text-2xl font-semibold">{CONDUCTOR_DEMO.calificacion_promedio} / 5</p>
          <p className="font-body text-xs text-ink/45">promedio últimos 6 meses</p>
        </PassportCard>
      </section>

      <section className="mt-4">
        <PassportCard>
          <p className="font-body text-xs uppercase tracking-wide text-ink/45">Próximo depósito (demo)</p>
          <p className="mt-2 font-display text-2xl font-semibold">
            ${RESUMEN_SEMANAL_DEMO.deposito_final.toLocaleString("es-MX")}
          </p>
          <p className="font-body text-xs text-ink/45">
            {RESUMEN_SEMANAL_DEMO.fecha_pago} · {RESUMEN_SEMANAL_DEMO.metodo}
          </p>
        </PassportCard>
      </section>

      <nav className="mt-8 flex gap-4">
        <Link href="/viajes">
          <Button>Ver viajes</Button>
        </Link>
        <Link href="/ganancias" className="font-body text-sm font-medium text-ink/70 hover:text-ink">
          Mis ganancias →
        </Link>
      </nav>
    </main>
  );
}
