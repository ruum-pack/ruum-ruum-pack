"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Aviso, Button, Card } from "@ruum/ui";
import { tieneSupabaseConfigurado } from "../../../lib/supabase-browser";
import { CuentaHeader } from "../CuentaHeader";
import { limpiarSesionIntegral } from "../../../lib/session-cleanup";

export default function PaginaSeguridadCuenta() {
  const [cerrando, setCerrando] = useState(false);
  const router = useRouter();

  async function cerrarSesion() {
    if (!tieneSupabaseConfigurado()) return;
    setCerrando(true);
    try {
    await limpiarSesionIntegral();
      router.push("/onboarding");
      router.refresh();
    } catch {
      setCerrando(false);
    }
  }

  return (
    <div className="mx-auto max-w-3xl px-6 py-10 sm:py-14">
      <CuentaHeader titulo="Seguridad" descripcion="Cambios sensibles de acceso y sesión." />
      <Card className="mt-6">
        <div className="grid gap-4">
          <Aviso tono="atencion">Por seguridad, cualquier cambio de contraseña se realiza mediante verificación de correo.</Aviso>
          <Link href="/recuperar-password"><Button variant="primary">Cambiar contraseña</Button></Link>
          <Button variant="secondary" onClick={cerrarSesion} disabled={cerrando}>
            {cerrando ? "Cerrando sesión..." : "Cerrar sesión"}
          </Button>
        </div>
      </Card>
    </div>
  );
}
