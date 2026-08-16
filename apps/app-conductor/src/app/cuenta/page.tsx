import Link from "next/link";
import { Card } from "@ruum/ui";
import { CuentaHeader } from "./CuentaHeader";

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
  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-6 sm:py-12">
      {/* 3. Limpieza de Cabecera */}
      <CuentaHeader
        titulo="Cuenta del Conductor"
        descripcion="Centro de configuración, expediente operativo y soporte del servicio Ruum Ruum."
      />

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
    </div>
  );
}
