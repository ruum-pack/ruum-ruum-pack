"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Aviso } from "@ruum/ui";
import { crearClienteNavegador, tieneSupabaseConfigurado } from "../../lib/supabase-browser";

export function AccionesCuenta() {
  const router = useRouter();
  const [textoEliminar, setTextoEliminar] = useState("");
  const [mensaje, setMensaje] = useState<string | null>(null);

  async function cerrarSesion() {
    setMensaje(null);
    if (!tieneSupabaseConfigurado()) {
      setMensaje("Supabase no está configurado; no hay una sesión real que cerrar.");
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
      {mensaje && (
      <div role="status" aria-live="polite" aria-atomic="true">
        <Aviso tono="info">{mensaje}</Aviso>
      </div>
    )}

      <div className="rounded-lg border border-ink/10 px-4 py-4">
        <p className="font-body text-sm font-semibold">Cerrar sesión en este dispositivo</p>
        <p className="mt-1 font-body text-sm text-ink/55">
          Tus viajes, pagos y evidencia no se eliminan. Puedes volver a iniciar sesión cuando quieras.
        </p>
        <div className="mt-4">
          <Button variant="secondary" onClick={cerrarSesion}>
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
            className="rounded-lg border border-danger/30 bg-mist px-3.5 py-2.5 font-body text-sm"
          />
        </label>
        <div className="mt-4">
          <Button variant="danger" disabled={!puedeEliminar} onClick={solicitarEliminacion}>
            Solicitar eliminación
          </Button>
        </div>
      </div>
    </div>
  );
}
