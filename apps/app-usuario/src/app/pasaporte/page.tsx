import { redirect } from "next/navigation";
import { crearClienteServidor } from "../../lib/supabase-server";
import { listarTrasladosDeUsuario, obtenerUsuarioActual } from "@ruum/api/services";

export default async function PaginaPasaporteRedirect() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  let destino = "/mis-viajes";

  if (url && anonKey) {
    try {
      const cliente = await crearClienteServidor();
      const usuario = await obtenerUsuarioActual(cliente);
      if (usuario) {
        const traslados = await listarTrasladosDeUsuario(cliente, usuario.id);
        const activo = traslados.find(
          (t) =>
            t.traslado_id &&
            t.estado &&
            !["servicio_cerrado", "servicio_cancelado", "traslado_fallido"].includes(t.estado)
        );
        if (activo?.traslado_id) {
          destino = `/traslados/${activo.traslado_id}`;
        }
      }
    } catch {
      // Si falla o no hay sesión, va a mis viajes
    }
  }

  redirect(destino);
}
