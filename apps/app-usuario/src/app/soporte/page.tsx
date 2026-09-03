import type { Metadata } from "next";
import type { Database } from "@ruum/shared/types";
import { NavegacionUsuario } from "../NavegacionUsuario";
import { SoporteCliente } from "./SoporteCliente";

export const metadata: Metadata = {
  title: "Ayuda y soporte — Ruum Ruum",
  robots: { index: false, follow: false },
};

type Usuario = Database["public"]["Tables"]["usuarios"]["Row"];
type Pasaporte = Database["public"]["Views"]["pasaporte_digital"]["Row"];

async function obtenerContexto() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    return { usuario: null as Usuario | null, traslados: [] as Pasaporte[] };
  }

  try {
    const { crearClienteServidor } = await import("../../lib/supabase-server");
    const { obtenerUsuarioActual, listarTrasladosDeUsuario } = await import("@ruum/api/services");
    const cliente = await crearClienteServidor();
    const usuario = await obtenerUsuarioActual(cliente);
    if (!usuario) return { usuario: null as Usuario | null, traslados: [] as Pasaporte[] };
    const traslados = await listarTrasladosDeUsuario(cliente, usuario.id);
    return { usuario, traslados };
  } catch (err) {
    console.error("[app-usuario:obtenerContextoSoporte] supabase_error", {
      message: err instanceof Error ? err.message : String(err),
    });
    return { usuario: null as Usuario | null, traslados: [] as Pasaporte[] };
  }
}

export default async function PaginaSoporte({
  searchParams,
}: {
  searchParams: Promise<{ viaje?: string }>;
}) {
  const { viaje } = await searchParams;
  const { usuario, traslados } = await obtenerContexto();

  return (
    <main className="user-v2-scope user-v2-page user-v2-secondary-screen">
      <NavegacionUsuario variante="claro" />
      <div className="user-v2-content">
        <SoporteCliente
          usuario={usuario}
          traslados={traslados}
          viajePreseleccionado={viaje}
        />
      </div>
    </main>
  );
}

