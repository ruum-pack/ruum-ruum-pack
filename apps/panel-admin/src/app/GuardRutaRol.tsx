"use client";

import { useEffect, useState, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import { obtenerAdminActual } from "@ruum/api/services";
import { crearClienteNavegador, tieneSupabaseConfigurado } from "../lib/supabase-browser";
import { normalizarRolAdmin, puedeVerRuta } from "../lib/roles-admin";

/**
 * Guard de navegación por rol operativo.
 * Solo aplica con sesión admin real (Supabase configurado + fila en admins).
 * En modo demo (sin Supabase) no restringe — los smokes y la exploración local
 * siguen pudiendo abrir todas las rutas.
 * La autoridad de datos sigue en `es_admin()` / RLS; esto es coherencia UX.
 */
export function GuardRutaRol({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [listo, setListo] = useState(() => !tieneSupabaseConfigurado() || pathname === "/login");

  useEffect(() => {
    let activo = true;

    async function resolver() {
      if (!tieneSupabaseConfigurado() || pathname === "/login") {
        if (activo) setListo(true);
        return;
      }

      setListo(false);
      try {
        const cliente = crearClienteNavegador();
        const admin = await obtenerAdminActual(cliente);
        if (!activo) return;
        if (!admin) {
          setListo(true);
          return;
        }
        const rolActual = normalizarRolAdmin(admin.rol_operativo);
        if (!puedeVerRuta(rolActual, pathname)) {
          router.replace("/?error=rol_sin_acceso");
          return;
        }
        setListo(true);
      } catch {
        if (activo) setListo(true);
      }
    }

    void resolver();
    return () => {
      activo = false;
    };
  }, [pathname, router]);

  if (!listo) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center px-6" role="status" aria-live="polite">
        <p className="font-body text-sm text-text-secondary">Verificando acceso…</p>
      </div>
    );
  }

  return <>{children}</>;
}
