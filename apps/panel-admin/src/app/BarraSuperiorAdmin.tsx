"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TITULOS_RUTA: Array<[string, string]> = [
  ["/alertas-sla", "Alertas y SLA"],
  ["/aprobaciones", "Aprobaciones duales"],
  ["/auditoria", "Auditoría"],
  ["/capacidades", "Capacidades"],
  ["/configuracion", "Configuración"],
  ["/conductores", "Conductores"],
  ["/disputas", "Disputas"],
  ["/documentos", "Validación documental"],
  ["/empresas", "Empresas"],
  ["/incidencias", "Incidencias"],
  ["/mapa", "Mapa operativo"],
  ["/masivos", "Traslados masivos"],
  ["/metricas-registro", "Métricas de conductores"],
  ["/pagos", "Pagos"],
  ["/reclamos-seguro", "Seguros"],
  ["/reportes", "Reportes operativos"],
  ["/tarifas", "Tarifas"],
  ["/usuarios", "Usuarios"],
  ["/vehiculos", "Vehículos"],
  ["/viajes", "Traslados"]
];

function tituloDeRuta(pathname: string) {
  if (pathname === "/") return "Dashboard operativo";
  return TITULOS_RUTA.find(([ruta]) => pathname === ruta || pathname.startsWith(`${ruta}/`))?.[1] ?? "Panel administrativo";
}

export function BarraSuperiorAdmin() {
  const pathname = usePathname();
  if (pathname === "/login") return null;

  return (
    <header className="admin-topbar" aria-label="Contexto de la Torre de Control">
      <div className="admin-topbar__context">
        <span className="admin-topbar__brand">Torre de Control</span>
        <span className="admin-topbar__separator" aria-hidden="true">/</span>
        <span className="admin-topbar__module" aria-current="page">{tituloDeRuta(pathname)}</span>
      </div>
      <nav className="admin-topbar__actions" aria-label="Acciones globales">
        <Link href="/alertas-sla?filtro=vencidas" className="admin-topbar__link">Alertas</Link>
        <Link href="/configuracion" className="admin-topbar__link">Configuración</Link>
      </nav>
    </header>
  );
}
