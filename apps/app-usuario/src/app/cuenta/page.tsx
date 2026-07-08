import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Mi cuenta — Ruum Ruum",
  robots: { index: false, follow: false },
};

import { NavegacionUsuario } from "../NavegacionUsuario";
import { AvisoSinSesion, HeaderCuenta, HeroCuenta, NavegacionCuenta, SeccionHistorialEmpresa, obtenerCuenta } from "./cuenta-ui";

export default async function PaginaCuenta() {
  const cuenta = await obtenerCuenta();

  if (!cuenta) return <AvisoSinSesion />;

  const { usuario, historialEmpresa } = cuenta;
  const esTitularEmpresa = usuario.rol === "titular_empresa" && Boolean(usuario.empresa_id);

  return (
    <main className="app-page">
      <NavegacionUsuario />
      <div className="app-container py-10 sm:py-14">
        <HeaderCuenta usuario={usuario} />
        <HeroCuenta usuario={usuario} />
        <NavegacionCuenta usuario={usuario} />
        {esTitularEmpresa && (
          <section className="mt-6">
            <SeccionHistorialEmpresa historialEmpresa={historialEmpresa} />
          </section>
        )}
      </div>
    </main>
  );
}
