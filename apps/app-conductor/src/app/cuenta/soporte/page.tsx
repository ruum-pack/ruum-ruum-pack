"use client";

import Link from "next/link";
import { Card } from "@ruum/ui";
import { CONTACTOS_SOPORTE_CONDUCTOR } from "../../../lib/contactos-soporte";
import { CuentaHeader } from "../CuentaHeader";

export default function PaginaSoporteCuenta() {
  const whatsapp = CONTACTOS_SOPORTE_CONDUCTOR.soporte.whatsapp;
  const telefono = CONTACTOS_SOPORTE_CONDUCTOR.soporte.telefono;
  const correo = CONTACTOS_SOPORTE_CONDUCTOR.soporte.correo;
  const bajaCuenta = CONTACTOS_SOPORTE_CONDUCTOR.soporte.bajaCuenta;

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-8 sm:px-6 sm:py-12">
      <CuentaHeader
        titulo="Centro de Soporte"
        descripcion="Canales oficiales de asistencia operativa, ayuda en ruta y gestión de tu cuenta."
      />

      <div className="mt-6 grid gap-6">
        {/* 3. Banner Destacado Superior: Contexto de Ayuda en Viaje Actual */}
        <div className="relative overflow-hidden rounded-2xl border border-signal/40 bg-surface-elevated/90 p-5 shadow-sm">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3.5">
              <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-surface border border-border/80 font-display text-xl font-bold text-text-primary shadow-2xs">
                🚨
              </div>
              <div>
                <h2 className="font-display text-base font-bold text-text-primary">
                  ¿Tienes un viaje en curso o alguna eventualidad?
                </h2>
                <p className="mt-0.5 font-body text-xs leading-5 text-text-tertiary">
                  Accede al reporte prioritario para incidentes en ruta, ajuste de tarifa o contacto con el usuario.
                </p>
              </div>
            </div>

            <Link
              href="/viajes"
              className="inline-flex w-full shrink-0 items-center justify-center gap-2 rounded-xl bg-signal px-5 py-3 font-display text-xs font-black text-slate-950 shadow-xs transition hover:bg-signal/90 active:scale-95 sm:w-auto"
            >
              Ayuda con mi viaje actual →
            </Link>
          </div>
        </div>

        {/* 1. Sección: Ayuda Inmediata (WhatsApp & Teléfono) */}
        <Card>
          <p className="font-body text-xs font-bold uppercase tracking-wider text-text-tertiary mb-1">
            Respuesta Rápida
          </p>
          <h2 className="font-display text-lg font-bold text-text-primary mb-4">
            Ayuda Inmediata
          </h2>

          <div className="grid gap-3 sm:grid-cols-2">
            {/* WhatsApp */}
            <a
              href={whatsapp.href}
              target="_blank"
              rel="noopener noreferrer"
              className="group flex w-full items-center justify-between gap-3 rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-4 transition hover:border-emerald-500/60 hover:bg-emerald-500/10 active:scale-[0.99]"
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-emerald-500/20 font-display text-lg text-emerald-500">
                  💬
                </div>
                <div className="min-w-0">
                  <span className="block font-display text-sm font-bold text-text-primary truncate">
                    {whatsapp.etiqueta}
                  </span>
                  {/* 3. Microcopy SLA */}
                  <span className="block font-body text-xs text-emerald-600 dark:text-emerald-400 font-semibold">
                    ⚡ Respuesta habitual &lt; 5 min
                  </span>
                </div>
              </div>
              <span className="text-text-tertiary transition group-hover:translate-x-1">→</span>
            </a>

            {/* Teléfono */}
            <a
              href={telefono.href}
              className="group flex w-full items-center justify-between gap-3 rounded-xl border border-sky-500/30 bg-sky-500/5 p-4 transition hover:border-sky-500/60 hover:bg-sky-500/10 active:scale-[0.99]"
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-sky-500/20 font-display text-lg text-sky-500">
                  📞
                </div>
                <div className="min-w-0">
                  <span className="block font-display text-sm font-bold text-text-primary truncate">
                    {telefono.etiqueta}
                  </span>
                  {/* 3. Microcopy SLA */}
                  <span className="block font-body text-xs text-sky-600 dark:text-sky-400 font-semibold">
                    📞 Atención telefónica 24/7
                  </span>
                </div>
              </div>
              <span className="text-text-tertiary transition group-hover:translate-x-1">→</span>
            </a>
          </div>
        </Card>

        {/* 1. Sección: Ayuda Operativa y Consultas */}
        <Card>
          <p className="font-body text-xs font-bold uppercase tracking-wider text-text-tertiary mb-1">
            Asistencia en Servicio
          </p>
          <h2 className="font-display text-lg font-bold text-text-primary mb-4">
            Ayuda Operativa y Correo
          </h2>

          <div className="grid gap-3">
            {/* Reportar problema en viaje (Ancho completo corregido) */}
            <Link
              href="/viajes"
              className="group flex w-full items-center justify-between gap-3 rounded-xl border border-border/80 bg-surface-elevated/50 p-4 transition hover:border-signal hover:bg-surface-elevated active:scale-[0.99]"
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-amber-500/20 font-display text-lg text-amber-500">
                  ⚠️
                </div>
                <div className="min-w-0">
                  <span className="block font-display text-sm font-bold text-text-primary">
                    Reportar problema en un viaje
                  </span>
                  <span className="block font-body text-xs text-text-tertiary">
                    Ajuste de tarifas, objetos olvidados o aclaraciones de ruta • Prioridad operativa
                  </span>
                </div>
              </div>
              <span className="text-text-tertiary transition group-hover:translate-x-1">→</span>
            </Link>

            {/* Correo Electrónico */}
            <a
              href={correo.href}
              className="group flex w-full items-center justify-between gap-3 rounded-xl border border-border/80 bg-surface-elevated/50 p-4 transition hover:border-route-action hover:bg-surface-elevated active:scale-[0.99]"
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-purple-500/20 font-display text-lg text-purple-400">
                  ✉️
                </div>
                <div className="min-w-0">
                  <span className="block font-display text-sm font-bold text-text-primary">
                    {correo.etiqueta}
                  </span>
                  {/* 3. Microcopy SLA */}
                  <span className="block font-body text-xs text-text-tertiary">
                    Consultas formales y aclaraciones de cuenta • Respuesta en 24 a 48h
                  </span>
                </div>
              </div>
              <span className="text-text-tertiary transition group-hover:translate-x-1">→</span>
            </a>
          </div>
        </Card>

        {/* 1. Sección: Gestión de Cuenta y Acción Destructiva Separada */}
        <Card className="border-red-500/20 bg-red-500/5">
          <p className="font-body text-xs font-bold uppercase tracking-wider text-red-500 mb-1">
            Gestión Avanzada de Cuenta
          </p>
          <h2 className="font-display text-lg font-bold text-text-primary mb-2">
            Desactivación de Cuenta
          </h2>
          <p className="font-body text-xs text-text-tertiary mb-4 leading-5">
            Si deseas darte de baja del servicio o suspender temporalmente tu perfil, puedes iniciar el proceso con soporte.
          </p>

          {/* Botón Destructivo Separado con Tratamiento de Peligro */}
          <a
            href={bajaCuenta.href}
            className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-red-500/40 bg-surface px-4 py-3 font-display text-xs font-bold text-red-500 shadow-2xs transition hover:border-red-500 hover:bg-red-500/10 active:scale-95"
          >
            ⚠️ {bajaCuenta.etiqueta}
          </a>
        </Card>
      </div>
    </div>
  );
}
