import type { Metadata } from "next";
import Link from "next/link";
import { Button, PassportCard } from "@ruum/ui";
import type { Database } from "@ruum/shared/types";
import { NavegacionUsuario } from "../NavegacionUsuario";
import { MisViajesCliente } from "./MisViajesCliente";

export const metadata: Metadata = {
  title: "Mis viajes — Ruum Ruum",
  robots: { index: false, follow: false },
};
type Pasaporte = Database["public"]["Views"]["pasaporte_digital"]["Row"];
type Traslado = Pick<
  Database["public"]["Tables"]["traslados"]["Row"],
  "id" | "origen_direccion" | "origen_ciudad" | "destino_direccion" | "destino_ciudad" | "fecha_hora_programada"
>;

type PestañaViajes = "activos" | "programados" | "finalizados" | "cancelados";

interface ViajeLista {
  pasaporte: Pasaporte;
  traslado: Traslado | null;
}

const PESTANAS: { id: PestañaViajes; etiqueta: string }[] = [
  { id: "activos", etiqueta: "Activos" },
  { id: "programados", etiqueta: "Programados" },
  { id: "finalizados", etiqueta: "Finalizados" },
  { id: "cancelados", etiqueta: "Cancelados" }
];

async function obtenerViajes(): Promise<ViajeLista[]> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) return [];

  try {
    const { crearClienteServidor } = await import("../../lib/supabase-server");
    const { obtenerUsuarioActual, listarTrasladosDeUsuario } = await import("@ruum/api/services");
    const cliente = await crearClienteServidor();
    const usuario = await obtenerUsuarioActual(cliente);

    if (!usuario) return [];

    const pasaportes = await listarTrasladosDeUsuario(cliente, usuario.id);
    const ids = pasaportes.map((pasaporte) => pasaporte.traslado_id).filter((id): id is string => Boolean(id));
    const trasladosRes =
      ids.length > 0
        ? await cliente
            .from("traslados")
            .select("id, origen_direccion, origen_ciudad, destino_direccion, destino_ciudad, fecha_hora_programada")
            .in("id", ids)
        : { data: [], error: null };

    if (trasladosRes.error) throw trasladosRes.error;

    const trasladosPorId = new Map((trasladosRes.data ?? []).map((traslado) => [traslado.id, traslado]));
    return pasaportes.map((pasaporte) => ({
      pasaporte,
      traslado: pasaporte.traslado_id ? trasladosPorId.get(pasaporte.traslado_id) ?? null : null
    }));
  } catch (err) {
    console.error("[app-usuario:obtenerViajes] supabase_error", {
      message: err instanceof Error ? err.message : String(err),
    });
    return [];
  }
}

export default async function PaginaMisViajes({
  searchParams
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const { tab } = await searchParams;
  const pestañaActiva = PESTANAS.some((pestaña) => pestaña.id === tab) ? (tab as PestañaViajes) : "activos";
  const viajes = await obtenerViajes();

  return (
    <main className="user-v2-scope user-v2-page">
      <NavegacionUsuario variante="claro" />
      <div className="user-v2-content">
        <MisViajesCliente viajes={viajes} pestanaInicial={pestañaActiva} />
      </div>
    </main>
  );
}
