"use client";

import Link from "next/link";
import { Aviso, Button, Card } from "@ruum/ui";
import { CuentaHeader } from "../CuentaHeader";
import { useCerrarSesion } from "../../../lib/use-cerrar-sesion";

export default function PaginaSeguridadCuenta() {
  const { cerrarSesion, cerrandoSesion, errorCerrarSesion } = useCerrarSesion();

  return (
    <div className="mx-auto max-w-3xl px-6 py-10 sm:py-14">
      <CuentaHeader titulo="Seguridad" descripcion="Cambios sensibles de acceso y sesión." />
      <Card className="mt-6">
        <div className="grid gap-4">
          <Aviso tono="atencion">Por seguridad, cualquier cambio de contraseña se realiza mediante verificación de correo.</Aviso>
          <Link href="/recuperar-password"><Button variant="primary">Cambiar contraseña</Button></Link>
          {errorCerrarSesion ? <Aviso tono="danger">{errorCerrarSesion}</Aviso> : null}
          <Button variant="secondary" onClick={() => void cerrarSesion()} disabled={cerrandoSesion}>
            {cerrandoSesion ? "Cerrando sesión..." : "Cerrar sesión"}
          </Button>
        </div>
      </Card>
    </div>
  );
}
