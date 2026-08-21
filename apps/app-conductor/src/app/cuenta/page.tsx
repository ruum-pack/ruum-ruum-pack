"use client";

import Link from "next/link";
import { Aviso, Card, SelloConductor } from "@ruum/ui";
import { CuentaHeader } from "./CuentaHeader";
import { useCerrarSesion } from "../../lib/use-cerrar-sesion";

type SeccionCuenta = {
  href: string;
  titulo: string;
  descripcion: string;
  icono: string;
};

type CategoriaCuenta = {
  titulo: string;
  secciones: SeccionCuenta[];
};

const CATEGORIAS_CUENTA: CategoriaCuenta[] = [
  {
    titulo: "Gestión Operativa",
    secciones: [
      {
        href: "/cuenta/perfil",
        titulo: "Perfil",
        descripcion: "Datos personales, dirección particular y contacto de emergencia.",
        icono: "👤"
      },
      {
        href: "/cuenta/documentos",
        titulo: "Documentos",
        descripcion: "Expediente digital, vigencia de licencia e identificación oficial.",
        icono: "📄"
      },
      {
        href: "/cuenta/datos-bancarios",
        titulo: "Datos bancarios",
        descripcion: "Cuenta CLABE y tarjeta registrada para depósitos de ganancias.",
        icono: "💳"
      }
    ]
  },
  {
    titulo: "Ajustes de Cuenta",
    secciones: [
      {
        href: "/cuenta/preferencias",
        titulo: "Preferencias",
        descripcion: "Canales de notificación y modalidades de viaje habilitadas.",
        icono: "⚙️"
      },
      {
        href: "/notificaciones",
        titulo: "Avisos y Alertas",
        descripcion: "Historial de notificaciones, comunicados y alertas operativas de Ruum Ruum.",
        icono: "🔔"
      },
      {
        href: "/cuenta/seguridad",
        titulo: "Seguridad",
        descripcion: "Credenciales de acceso, contraseña y control de sesión activa.",
        icono: "🛡️"
      }
    ]
  },
  {
    titulo: "Ayuda y Legal",
    secciones: [
      {
        href: "/cuenta/soporte",
        titulo: "Soporte",
        descripcion: "Asistencia directa en ruta, WhatsApp 24/7 y canales oficiales.",
        icono: "🎧"
      },
      {
        href: "/cuenta/legal",
        titulo: "Marco Legal",
        descripcion: "Términos del servicio, políticas operativas y aviso de privacidad.",
        icono: "📜"
      }
    ]
  }
];

export default function PaginaCuenta() {
  const { cerrarSesion, cerrandoSesion, errorCerrarSesion } = useCerrarSesion();

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-6 sm:py-12">
      {/* Cabecera con Sello Oficial de Conductor — Brand Book p.12 y Botón de Cierre Rápido */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-border/40 pb-6">
        <CuentaHeader
          titulo="Cuenta del Conductor"
          descripcion="Centro de configuración, expediente operativo y soporte del servicio Ruum Ruum by MoviliaX. Seguridad, evidencia y trazabilidad en cada viaje."
        />
        <div className="flex items-center gap-3 self-start sm:self-auto shrink-0">
          <SelloConductor compacto tema="dorado" />
          <button
            type="button"
            onClick={() => void cerrarSesion()}
            disabled={cerrandoSesion}
            className="inline-flex min-h-[40px] items-center gap-1.5 rounded-xl border border-red-500/30 bg-surface px-3.5 py-2 font-display text-xs font-bold text-red-500 shadow-2xs transition hover:border-red-500 hover:bg-red-500/10 active:scale-95 disabled:opacity-50 cursor-pointer"
            aria-label="Cerrar sesión activa"
          >
            {cerrandoSesion ? "Saliendo..." : "🚪 Cerrar sesión"}
          </button>
        </div>
      </div>
      <p className="mt-3 font-body text-xs font-medium tracking-wide text-text-tertiary">Traslado vehicular con conductores certificados · by MoviliaX</p>

      {errorCerrarSesion && (
        <div className="mt-4">
          <Aviso tono="danger">{errorCerrarSesion}</Aviso>
        </div>
      )}

      {/* 2. Agrupación Temática por Categorías */}
      <div className="mt-8 grid gap-8">
        {CATEGORIAS_CUENTA.map((categoria) => (
          <section key={categoria.titulo} className="grid gap-3.5">
            <h2 className="font-display text-xs font-bold uppercase tracking-wider text-text-tertiary">
              {categoria.titulo}
            </h2>

            {/* 3. Optimización de Layout (Grid de 3 columnas en desktop) */}
            <div className="grid grid-cols-1 gap-4.5 sm:grid-cols-2 lg:grid-cols-3">
              {categoria.secciones.map((seccion) => (
                <Link key={seccion.href} href={seccion.href} className="group block">
                  {/* 1. Indicadores de Affordance, Iconografía y Microinteracciones */}
                  <Card className="h-full border-border/80 bg-surface-elevated/40 p-5 transition-all duration-150 group-hover:border-signal group-hover:bg-surface-elevated group-hover:shadow-md group-hover:-translate-y-0.5 active:translate-y-0">
                    <div className="flex h-full flex-col justify-between gap-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex size-11 items-center justify-center rounded-xl border border-border bg-surface font-display text-xl shadow-2xs group-hover:border-signal/40">
                          {seccion.icono}
                        </div>

                        {/* Chevron / Flecha Direccional */}
                        <span className="font-display text-base font-bold text-text-tertiary transition-transform duration-150 group-hover:translate-x-1 group-hover:text-signal">
                          →
                        </span>
                      </div>

                      <div>
                        <h3 className="font-display text-base font-bold text-text-primary transition-colors group-hover:text-signal">
                          {seccion.titulo}
                        </h3>
                        <p className="mt-1 font-body text-xs leading-5 text-text-tertiary">
                          {seccion.descripcion}
                        </p>
                      </div>
                    </div>
                  </Card>
                </Link>
              ))}
            </div>
          </section>
        ))}
      </div>

      {/* 4. Sección de Cierre de Sesión Destacada */}
      <div className="mt-10">
        <Card className="border-red-500/20 bg-red-500/5 p-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3.5">
              <div className="flex size-11 shrink-0 items-center justify-center rounded-xl border border-red-500/30 bg-surface text-xl text-red-500">
                🚪
              </div>
              <div>
                <h2 className="font-display text-base font-bold text-text-primary">
                  Cerrar Sesión Activa
                </h2>
                <p className="mt-0.5 font-body text-xs text-text-secondary leading-5">
                  Saldrás de tu cuenta de conductor en este dispositivo. Para operar traslados nuevamente deberás iniciar sesión.
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => void cerrarSesion()}
              disabled={cerrandoSesion}
              className="inline-flex min-h-[44px] shrink-0 items-center justify-center gap-2 rounded-xl border border-red-500/40 bg-surface px-6 py-2.5 font-display text-xs font-bold text-red-500 shadow-xs transition hover:border-red-500 hover:bg-red-500/10 active:scale-95 disabled:opacity-50 cursor-pointer"
            >
              {cerrandoSesion ? "Cerrando sesión..." : "🚪 Cerrar sesión"}
            </button>
          </div>
        </Card>
      </div>
    </div>
  );
}
