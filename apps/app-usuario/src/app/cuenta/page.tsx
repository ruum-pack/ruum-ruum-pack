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
    <main className="min-h-screen bg-[#070D18] text-[#F8F8F5]">
      <NavegacionUsuario />
      <div className="w-full max-w-md mx-auto px-4 py-2">
        <CuentaCliente usuario={usuario} />
      </div>
    </main>
  );
}

