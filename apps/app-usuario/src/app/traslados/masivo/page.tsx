import type { Metadata } from "next";
import { CargaMasivaForm } from "./CargaMasivaForm";

export const metadata: Metadata = {
  title: "Carga Masiva de Traslados | Ruum Ruum Usuario",
  description: "Solicita múltiples traslados de vehículos mediante archivo CSV de forma rápida y segura."
};

export default function PaginaCargaMasiva() {
  return (
    <main id="contenido-principal" className="min-h-screen py-8 px-4 sm:px-6">
      <CargaMasivaForm />
    </main>
  );
}
