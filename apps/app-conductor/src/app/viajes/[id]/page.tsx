import type { Metadata } from "next";
import { obtenerPasaporteDigital } from "@ruum/api/services";
import { crearClienteServidor } from "../../../lib/supabase-server";
import { EstadoError } from "../../EstadoError";
import { TripOpportunityDetails } from "./TripOpportunityDetails";
import { LocalizarVehiculoDetails } from "./LocalizarVehiculoDetails";

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

function rutaVolverViajes(valor: string | undefined) {
  if (!valor) return "/viajes";
  try {
    const decodificada = decodeURIComponent(valor);
    return decodificada.startsWith("/viajes") && !decodificada.startsWith("/viajes/") ? decodificada : "/viajes";
  } catch {
    return "/viajes";
  }
}

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

export default async function PaginaDetalleViaje({
  params,
  searchParams
}: {
  params: Promise<{ id: string }>;
  searchParams?: Promise<{ volver?: string }>;
}) {
  const { id } = await params;
  const volver = rutaVolverViajes((await searchParams)?.volver);
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

  if (!pasaporte.estado || !pasaporte.traslado_id) {
    return (
      <EstadoError
        titulo="No pudimos cargar el viaje completo"
        descripcion="Vuelve a intentarlo o contacta a soporte si el problema continúa."
        acciones={[
          { etiqueta: "Ver mis viajes", href: "/viajes", variant: "primary" },
          { etiqueta: "Volver al panel", href: "/", variant: "quiet" }
        ]}
      />
    );
  }

  if (pasaporte.estado === "conductor_en_punto_de_recoleccion") {
    return (
      <LocalizarVehiculoDetails pasaporte={pasaporte} volver={volver} />
    );
  }

  return (
    <TripOpportunityDetails pasaporte={pasaporte} volver={volver} />
  );
}
