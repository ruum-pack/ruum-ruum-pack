"use client";

import { useState } from "react";
import Link from "next/link";
import { Card } from "@ruum/ui";
import { CuentaHeader } from "../CuentaHeader";

type DocumentoLegalId = "terminos" | "privacidad";

const DOCUMENTOS_LEGALES = [
  {
    id: "terminos" as DocumentoLegalId,
    titulo: "Términos y Condiciones de Uso",
    descripcion: "Normativa de servicio, obligaciones del conductor y políticas de asignación y cancelación.",
    icono: "📄",
    actualizacion: "3 de julio de 2026",
    version: "v1.0",
    href: "/legal/terminos"
  },
  {
    id: "privacidad" as DocumentoLegalId,
    titulo: "Aviso de Privacidad de Datos",
    descripcion: "Protección de datos personales, finalidades del tratamiento operativo y derechos ARCO.",
    icono: "🛡️",
    actualizacion: "3 de julio de 2026",
    version: "v1.0",
    href: "/legal/privacidad"
  }
];

export default function PaginaLegalCuenta() {
  const [docAbierto, setDocAbierto] = useState<DocumentoLegalId | null>(null);

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-8 sm:px-6 sm:py-12">
      <CuentaHeader
        titulo="Marco Legal y Privacidad"
        descripcion="Consulta los términos operativos vigentes y el aviso de privacidad de tus datos personales."
      />

      <div className="mt-6 grid gap-6">
        <Card>
          <p className="font-body text-xs font-bold uppercase tracking-wider text-text-tertiary mb-1">
            Documentación Operativa Oficial
          </p>
          <h2 className="font-display text-lg font-bold text-text-primary mb-4">
            Contratos y Políticas de la Plataforma
          </h2>

          {/* 1. Tarjetas de Lista (List Tiles) estilizadas con Affordance clara e Iconos */}
          <div className="grid gap-4">
            {DOCUMENTOS_LEGALES.map((doc) => (
              <div
                key={doc.id}
                className="group relative flex flex-col justify-between gap-4 rounded-2xl border border-border/80 bg-surface-elevated/40 p-4 transition-all duration-150 hover:border-signal hover:bg-surface-elevated hover:shadow-md sm:flex-row sm:items-center"
              >
                <div className="flex items-start gap-3.5 min-w-0">
                  <div className="flex size-11 shrink-0 items-center justify-center rounded-xl border border-border bg-surface font-display text-xl shadow-2xs">
                    {doc.icono}
                  </div>

                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-display text-base font-bold text-text-primary">
                        {doc.titulo}
                      </h3>
                      {/* 2. Control de Versiones e Indicadores de Transparencia */}
                      <span className="rounded-md border border-emerald-500/40 bg-emerald-500/10 px-2 py-0.5 font-body text-[10px] font-extrabold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">
                        {doc.version} • Vigente
                      </span>
                    </div>

                    <p className="mt-1 font-body text-xs text-text-tertiary leading-5">
                      {doc.descripcion}
                    </p>

                    {/* 2. Fecha de última actualización explícita */}
                    <p className="mt-1.5 font-body text-[11px] font-semibold text-text-tertiary/70">
                      Última actualización: {doc.actualizacion}
                    </p>
                  </div>
                </div>

                {/* 3. Lectura In-App Nativa + Navegación */}
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => setDocAbierto(doc.id)}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-surface px-3.5 py-2 font-display text-xs font-bold text-route-action transition hover:border-route-action hover:bg-route-action/10 active:scale-95"
                  >
                    Lectura In-App 🔍
                  </button>

                  <Link
                    href={doc.href}
                    className="inline-flex items-center gap-1.5 rounded-xl bg-signal hover:bg-signal/85 text-slate-950 px-3.5 py-2 font-display text-xs font-black transition active:scale-95 shadow-xs"
                  >
                    Ver completo →
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* 3. Visualizador Modal In-App Nativo */}
      {docAbierto && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
          <div className="relative flex max-h-[85vh] w-full max-w-2xl flex-col rounded-2xl border border-border bg-surface p-5 sm:p-6 shadow-2xl overflow-hidden">
            <header className="flex items-center justify-between border-b border-border/60 pb-4">
              <div>
                <span className="font-body text-xs font-bold uppercase tracking-wider text-route-action">
                  Visualizador In-App Ruum Ruum
                </span>
                <h3 className="font-display text-lg font-bold text-text-primary">
                  {docAbierto === "terminos" ? "Términos y Condiciones de Uso" : "Aviso de Privacidad de Datos"}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setDocAbierto(null)}
                className="flex size-9 items-center justify-center rounded-full border border-border bg-surface-elevated font-body text-sm font-bold text-text-primary hover:bg-surface-elevated/80"
                aria-label="Cerrar visualizador in-app"
              >
                ✕
              </button>
            </header>

            <div className="mt-4 flex-1 overflow-y-auto pr-2 font-body text-xs leading-6 text-text-secondary space-y-4">
              {docAbierto === "terminos" ? (
                <>
                  <p className="font-bold text-text-primary">
                    Versión 1.0 • Vigente desde el 3 de julio de 2026
                  </p>
                  <p>
                    Moviliax S.A. de C.V. (&quot;Ruum Ruum&quot;) presta el servicio de traslado vehicular con conductor certificado a través de su plataforma digital.
                  </p>
                  <h4 className="font-bold text-text-primary text-sm mt-3">1. Registro y Certificación CONCER</h4>
                  <p>Para operar como Conductor, la persona debe completar el registro con datos verídicos, cargar documentación válida y aprobar la revisión documental y de antecedentes operacionales.</p>
                  <h4 className="font-bold text-text-primary text-sm mt-3">2. Obligaciones del Conductor</h4>
                  <p>El Conductor se compromete a mantener vigente su licencia de conducir, operar con los estándares de seguridad exigidos e informar de inmediato cualquier eventualidad.</p>
                  <h4 className="font-bold text-text-primary text-sm mt-3">3. Pagos y Cobros Digitales</h4>
                  <p>Todos los traslados se liquidan exclusivamente mediante métodos de pago digitales autorizados. Ruum Ruum no procesa pagos en efectivo en esta modalidad.</p>
                </>
              ) : (
                <>
                  <p className="font-bold text-text-primary">
                    Versión 1.0 • Vigente desde el 3 de julio de 2026
                  </p>
                  <p>
                    En cumplimiento con la LFPDPPP, Moviliax S.A. de C.V. informa que es la entidad responsable del tratamiento de sus datos personales.
                  </p>
                  <h4 className="font-bold text-text-primary text-sm mt-3">1. Datos Personales Recabados</h4>
                  <p>Recabamos nombre, CURP, licencia de conducir, identificación oficial, teléfono y datos de contacto de emergencia únicamente para fines de validación operativa.</p>
                  <h4 className="font-bold text-text-primary text-sm mt-3">2. Finalidad del Tratamiento</h4>
                  <p>Verificación de identidad, certificación CONCER, gestión de traslados asignados, depósitos bancarios y protección de seguridad durante el servicio.</p>
                  <h4 className="font-bold text-text-primary text-sm mt-3">3. Derechos ARCO</h4>
                  <p>Puede ejercitar sus derechos de Acceso, Rectificación, Cancelación u Oposición a través del Centro de Soporte oficial dentro de la plataforma.</p>
                </>
              )}
            </div>

            <footer className="mt-4 flex items-center justify-between border-t border-border/60 pt-3">
              <span className="font-body text-[11px] text-text-tertiary">
                Última actualización: 3 de julio de 2026
              </span>
              <button
                type="button"
                onClick={() => setDocAbierto(null)}
                className="rounded-xl bg-signal px-4 py-2 font-display text-xs font-bold text-slate-950"
              >
                Cerrar lectura rápida
              </button>
            </footer>
          </div>
        </div>
      )}
    </div>
  );
}
