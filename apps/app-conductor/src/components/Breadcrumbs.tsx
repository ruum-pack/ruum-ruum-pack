"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

/**
 * Componente de Breadcrumbs para navegación jerárquica
 * Recomendación AI-003
 */

interface BreadcrumbItem {
  label: string;
  href?: string;
}

const PATH_MAP: Record<string, string> = {
  "": "Inicio",
  panel: "Panel",
  viajes: "Traslados",
  ganancias: "Ganancias",
  notificaciones: "Notificaciones",
  cuenta: "Cuenta",
  perfil: "Perfil",
  documentos: "Documentos",
  "datos-bancarios": "Datos Bancarios",
  preferencias: "Preferencias",
  seguridad: "Seguridad",
  soporte: "Soporte",
  legal: "Marco Legal",
  privacidad: "Privacidad",
  terminos: "Términos",
  onboarding: "Bienvenida",
  login: "Iniciar Sesión",
  registro: "Registro",
  "nueva-password": "Nueva Contraseña",
  "recuperar-password": "Recuperar Contraseña",
  configuracion: "Configuración",
  "actualizacion-requerida": "Actualización Requerida",
};

// Paths que deben ocultar breadcrumbs
const HIDE_BREADCRUMBS = [
  "/login",
  "/registro",
  "/onboarding",
  "/actualizacion-requerida",
];

export function Breadcrumbs() {
  const pathname = usePathname();
  
  // No mostrar en rutas de acceso
  if (HIDE_BREADCRUMBS.includes(pathname) || pathname === "/") {
    return null;
  }
  
  // Dividir el pathname en segmentos
  const segments = pathname.split("/").filter(Boolean);
  
  // Si solo hay un segmento y es una ruta principal, no mostrar breadcrumbs
  if (segments.length === 1 && ["panel", "viajes", "ganancias", "notificaciones"].includes(segments[0])) {
    return null;
  }
  
  // Construir los items del breadcrumb
  const items: BreadcrumbItem[] = [
    { label: "Inicio", href: "/panel" },
    ...segments.map((segment, index) => {
      const path = `/${segments.slice(0, index + 1).join("/")}`;
      const label = PATH_MAP[segment] || segment.replace(/-/g, " ").replace(/\b\w/g, l => l.toUpperCase());
      
      // El último item no tiene link
      const href = index < segments.length - 1 ? path : undefined;
      
      return { label, href };
    }),
  ];
  
  return (
    <nav aria-label="Breadcrumbs" className="flex items-center gap-2 px-4 py-3">
      <div className="flex items-center gap-2 text-sm">
        {items.map((item, index) => (
          <div key={index} className="flex items-center gap-2">
            {index > 0 && (
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={2}
                className="text-text-tertiary"
                aria-hidden="true"
              >
                <path d="M9 18l6-6-6-6" />
              </svg>
            )}
            {item.href ? (
              <Link
                href={item.href}
                className="font-body text-sm font-medium text-route-action hover:underline focus-visible:outline focus-visible:outline-[3px] focus-visible:outline-offset-2 focus-visible:outline-route-action"
              >
                {item.label}
              </Link>
            ) : (
              <span className="font-body text-sm font-semibold text-text-primary">
                {item.label}
              </span>
            )}
          </div>
        ))}
      </div>
    </nav>
  );
}
