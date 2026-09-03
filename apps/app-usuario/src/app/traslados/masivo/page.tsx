import type { Metadata } from "next";
import { NavegacionUsuario } from "../../NavegacionUsuario";
import { CargaMasivaForm } from "./CargaMasivaForm";

export const metadata: Metadata = {
  title: "Carga Masiva de Traslados | Ruum Ruum Usuario",
  description: "Solicita múltiples traslados de vehículos mediante archivo CSV de forma rápida y segura."
};

export default function PaginaCargaMasiva() {
  return (
    <main id="contenido-principal" className="user-v2-scope user-v2-page user-v2-secondary-screen">
      <NavegacionUsuario variante="claro" />
      <div className="user-v2-content user-v2-content--wide">
        <CargaMasivaForm />
      </div>
    </main>
  );
}
