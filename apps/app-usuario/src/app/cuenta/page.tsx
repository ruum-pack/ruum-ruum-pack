import type { Metadata } from "next";
import { NavegacionUsuario } from "../NavegacionUsuario";
import { CuentaCliente } from "./CuentaCliente";
import { obtenerCuenta } from "./cuenta-ui";

export const metadata: Metadata = {
  title: "Mi cuenta — Ruum Ruum",
  robots: { index: false, follow: false },
};

export default async function PaginaCuenta() {
  const cuenta = await obtenerCuenta();
  const usuario = cuenta?.usuario ?? null;

  return (
    <main className="user-v2-scope user-v2-page user-v2-secondary-screen">
      <NavegacionUsuario variante="claro" />
      <div className="user-v2-content">
        <CuentaCliente usuario={usuario} />
      </div>
    </main>
  );
}
