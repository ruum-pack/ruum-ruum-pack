"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Aviso } from "@ruum/ui";
import { crearClienteNavegador, tieneSupabaseConfigurado } from "../../lib/supabase-browser";

export function AccionesCuenta({ esDemo }: { esDemo: boolean }) {
  const router = useRouter();
  const [confirmarCerrar, setConfirmarCerrar] = useState(false);
  const [textoEliminar, setTextoEliminar] = useState("");
  const [mensaje, setMensaje] = useState<string | null>(null);

  async function cerrarSesion() {
    setMensaje(null);
    if (esDemo || !tieneSupabaseConfigurado()) {
      router.push("/");
      return;
    }
    const cliente = crearClienteNavegador();
    await cliente.auth.signOut();
    router.push("/");
    router.refresh();
  }

  function solicitarEliminacion() {
    setMensaje(
      "Solicitud registrada para validación de identidad. En producción, soporte confirmará titularidad antes de eliminar datos o bloquear acceso."
    );
  }

  const puedeEliminar = textoEliminar.trim().toUpperCase() === "ELIMINAR CUENTA";

  return (
    <div className="grid gap-5">
      {mensaje && <Aviso tono="info">{mensaje}</Aviso>}

      <div className="rounded-lg border border-ink/10 px-4 py-4">
        <p className="font-body text-sm font-semibold">Cerrar sesión</p>
        <p className="mt-1 font-body text-sm text-ink/55">
          Cierra la sesión en este dispositivo. Tus viajes, pagos y evidencia no se eliminan.
        </p>
        <label className="mt-4 flex items-center gap-2.5 font-body text-sm">
          <input
            type="checkbox"
            checked={confirmarCerrar}
            onChange={(e) => setConfirmarCerrar(e.target.checked)}
            className="size-4 rounded border-ink/30 text-signal"
          />
          Confirmo que quiero cerrar sesión.
        </label>
        <div className="mt-4">
          <Button variant="secundario" disabled={!confirmarCerrar} onClick={cerrarSesion}>
            Cerrar sesión
          </Button>
        </div>
      </div>

      <div className="rounded-lg border border-danger/25 bg-danger-soft/40 px-4 py-4">
        <p className="font-body text-sm font-semibold text-danger">Eliminar cuenta</p>
        <p className="mt-1 font-body text-sm text-ink/65">
          Esta acción requiere validación de identidad. Puede afectar acceso a historial, facturación, pagos y soporte
          asociado. Los datos que deban conservarse por obligaciones legales no se borran de inmediato.
        </p>
        <label className="mt-4 flex flex-col gap-1.5">
          <span className="font-body text-sm font-medium">Escribe ELIMINAR CUENTA para solicitar revisión</span>
          <input
            value={textoEliminar}
            onChange={(e) => setTextoEliminar(e.target.value)}
            className="rounded-lg border border-danger/30 bg-paper px-3.5 py-2.5 font-body text-sm"
          />
        </label>
        <div className="mt-4">
          <Button variant="peligro" disabled={!puedeEliminar} onClick={solicitarEliminacion}>
            Solicitar eliminación
          </Button>
        </div>
      </div>
    </div>
  );
}
