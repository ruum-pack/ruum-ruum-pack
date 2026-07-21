import type { Metadata } from "next";

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

import { Aviso, PassportCard } from "@ruum/ui";

const CONFIG = [
  "Roles y permisos",
  "Usuarios internos",
  "Zonas de operación",
  "Tipos de servicio y de vehículo",
  "Reglas de evidencia",
  "Estados de traslado",
  "Plantillas de notificación",
  "Métodos de pago",
  "Datos fiscales",
  "Seguridad",
  "Bitácora de cambios"
];

const ROLES = [
  ["Super administrador", "Acceso total a la plataforma.", "Gestionar roles, permisos, configuración, traslados, usuarios, conductores, pagos y auditoría."],
  ["Operador de Torre / Administrador operativo", "Monitorear traslados e incidencias.", "Ver traslados activos, cambiar estados operativos, contactar usuarios/conductores, registrar notas e incidencias."],
  ["Supervisor", "Autorizar cambios críticos.", "Cambiar conductor, aprobar cierres con incidencia, autorizar cancelaciones especiales y escalaciones."],
  ["Validador documental", "Revisar documentos.", "Aprobar, rechazar, solicitar actualización y marcar vencimientos."],
  ["Finanzas", "Gestionar pagos y ajustes.", "Ver pagos, gastos, depósitos, ajustes, estatus financiero y reportes básicos."],
  ["Coordinador CONCER", "Gestionar conductores certificados.", "Validar perfiles, revisar desempeño, suspender/reactivar, revisar disponibilidad e incidencias."],
  ["Comercial", "Gestionar cuentas empresariales.", "Gestión de empresas, usuarios corporativos y condiciones comerciales."]
];

const MOVIL = [
  "Ver dashboard básico",
  "Consultar traslados activos",
  "Revisar alertas e incidencias urgentes",
  "Contactar conductor o usuario",
  "Cambiar estatus de traslado",
  "Revisar información básica del traslado",
  "Consultar próximos traslados"
];

export default function PaginaConfiguracionAdmin() {
  return (
    <main className="mx-auto max-w-6xl px-6 py-8 sm:px-8 sm:py-10">
      <h1 className="font-display text-2xl font-semibold">Configuración</h1>
      <p className="mt-1 font-body text-sm text-text-secondary">Parámetros operativos, permisos internos, seguridad y bitácora.</p>

      <div className="mt-4">
        <Aviso tono="info">
          Las secciones de configuración se habilitarán de forma progresiva. Contacta al equipo de desarrollo para activar una sección específica.
        </Aviso>
      </div>

      <section className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {CONFIG.map((item) => (
          <PassportCard key={item}>
            <div className="flex items-center justify-between gap-4">
              <p className="font-body text-sm font-semibold">{item}</p>
              <span className="rounded-full border border-ink/15 bg-ink/[0.04] px-2.5 py-1 font-mono-ruum text-admin-secundario uppercase tracking-wide text-text-tertiary">
                Catálogo
              </span>
            </div>
          </PassportCard>
        ))}
      </section>

      <details className="mt-6 rounded-2xl border border-border-default [&_summary::-webkit-details-marker]:hidden">
        <summary className="flex cursor-pointer items-center justify-between px-6 py-5 font-display text-xl font-semibold text-ink hover:text-signal [&::marker]:hidden">
          Roles internos y permisos conceptuales
          <span className="font-mono-ruum text-admin-secundario text-text-tertiary">▼</span>
        </summary>
        <PassportCard className="border-0">
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[860px] font-body text-sm">
              <caption className="sr-only">Roles internos y permisos del panel</caption>
              <thead>
                <tr className="text-left text-xs uppercase tracking-wide text-text-tertiary">
                  {["Rol", "Responsabilidad", "Permisos principales"].map((h) => (
                    <th key={h} className="border-b border-ink/10 px-3 py-2">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {ROLES.map((rol) => (
                  <tr key={rol[0]} className="align-top">
                    {rol.map((celda) => (
                      <td key={celda} className="border-b border-ink/10 px-3 py-3 text-text-secondary">{celda}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </PassportCard>
      </details>

      <details className="mt-6 rounded-2xl border border-border-default [&_summary::-webkit-details-marker]:hidden">
        <summary className="flex cursor-pointer items-center justify-between px-6 py-5 font-display text-xl font-semibold text-ink hover:text-signal [&::marker]:hidden">
          Versión responsive y alcance por rol
          <span className="font-mono-ruum text-admin-secundario text-text-tertiary">▼</span>
        </summary>
        <div className="grid gap-6 p-6 pt-0 lg:grid-cols-[0.9fr_1.1fr]">
        <PassportCard>
          <h2 className="font-display text-xl font-semibold">Versión responsive móvil del Admin</h2>
          <p className="mt-2 font-body text-sm text-text-secondary">
            En móvil se enfoca en acciones rápidas; la operación completa se mantiene en escritorio.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            {MOVIL.map((item) => (
              <span key={item} className="rounded-full border border-signal/20 bg-signal-soft px-3 py-1.5 font-body text-xs font-semibold text-ink">
                {item}
              </span>
            ))}
          </div>
        </PassportCard>
        <Aviso tono="atencion">
          Seguridad y auditoría deben registrar cambios de roles, permisos, estados críticos, pagos, documentos y escalaciones.
        </Aviso>
      </div></details>
    </main>
  );
}
