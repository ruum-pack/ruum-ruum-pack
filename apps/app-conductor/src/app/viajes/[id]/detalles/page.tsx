import type { Metadata } from "next";
import { obtenerPasaporteDigital } from "@ruum/api/services";
import { crearClienteServidor } from "../../../../lib/supabase-server";
import { EstadoError } from "../../../EstadoError";
import { TripDetailsTabs } from "./TripDetailsTabs";

export const metadata: Metadata = {
  title: "Detalles del Traslado | Ruum Conductor",
  robots: { index: false, follow: false },
};

async function obtenerDatos(id: string) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) {
    return { pasaporte: null };
  }

  const cliente = await crearClienteServidor();
  const pasaporte = await obtenerPasaporteDigital(cliente, id);
  return { pasaporte };
}

export default async function DetallesTrasladoPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { pasaporte } = await obtenerDatos(id);

  if (!pasaporte) {
    return (
      <EstadoError
        titulo="No encontramos ese viaje"
        descripcion="Revisa el enlace o vuelve a tu lista de viajes para continuar."
        acciones={[
          { etiqueta: "Ver mis viajes", href: "/viajes", variant: "primary" },
          { etiqueta: "Volver al panel", href: "/", variant: "quiet" }
        ]}
      />
    );
  }

  return <TripDetailsTabs pasaporte={pasaporte} />;
}
