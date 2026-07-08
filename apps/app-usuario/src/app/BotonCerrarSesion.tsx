"use client";

import { useRouter } from "next/navigation";
import { crearClienteNavegador } from "../lib/supabase-browser";

export function BotonCerrarSesion() {
  const router = useRouter();

  async function cerrarSesion() {
    const cliente = crearClienteNavegador();
    await cliente.auth.signOut();
    router.push("/");
    router.refresh();
  }

  return (
    <button onClick={cerrarSesion} className="font-body text-sm text-ink/60 hover:text-ink">
      Cerrar sesión
    </button>
  );
}
