"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Aviso, Button, Field } from "@ruum/ui";
import { MENSAJES_CLAVE_UX } from "@ruum/shared/constants";
import { calcularCargoCancelacion } from "@ruum/shared/rules";
import type { Database } from "@ruum/shared/types";
import { cancelarTraslado } from "@ruum/api/services";
import { crearClienteNavegador, tieneSupabaseConfigurado } from "../../../lib/supabase-browser";

type EstadoTraslado = Database["public"]["Enums"]["estado_traslado"];

function horasRestantes(fechaIso: string | null) {
  if (!fechaIso) return Number.POSITIVE_INFINITY;
  return Math.max(0, (new Date(fechaIso).getTime() - Date.now()) / (1000 * 60 * 60));
}

export function CancelarTraslado({
  trasladoId,
  estado,
  precio,
  fechaProgramada,
  conductorAsignado,
}: {
  trasladoId: string;
  estado: EstadoTraslado;
  precio: number;
  fechaProgramada: string | null;
  conductorAsignado: boolean;
}) {
  const router = useRouter();
  const [motivo, setMotivo] = useState("");
  const [procesando, setProcesando] = useState(false);
  const [mensaje, setMensaje] = useState<{ tono: "info" | "peligro"; texto: string } | null>(null);
  /* FIX: reemplaza window.confirm() por modal de confirmación inline */
  const [confirmando, setConfirmando] = useState(false);

  const terminal = ["servicio_cerrado", "servicio_cancelado", "traslado_fallido"].includes(estado);
  const cargo = calcularCargoCancelacion(
    precio,
    horasRestantes(fechaProgramada),
    conductorAsignado,
    ["conductor_en_punto_de_recoleccion", "verificacion_vehiculo_en_proceso", "evidencia_inicial_en_proceso"].includes(estado)
  );

  async function cancelar() {
    setProcesando(true);
    setMensaje(null);
    setConfirmando(false);
    try {
      if (!tieneSupabaseConfigurado()) {
        setMensaje({ tono: "peligro", texto: "Supabase no está configurado. No se puede cancelar el traslado." });
        return;
      }
      const cliente = crearClienteNavegador();
      const resultado = await cancelarTraslado(cliente, trasladoId, motivo);
      setMensaje({
        tono: "info",
        texto: `Traslado cancelado. Cargo registrado: $${resultado.monto_cargo.toLocaleString("es-MX")} MXN.`,
      });
      router.refresh();
    } catch (err) {
      setMensaje({ tono: "peligro", texto: err instanceof Error ? err.message : "No pudimos cancelar el traslado." });
    } finally {
      setProcesando(false);
    }
  }

  if (terminal) return null;

  return (
    <div className="mt-5 rounded-lg border border-danger/25 bg-danger-soft px-4 py-4">
      <p className="font-body text-sm font-semibold text-danger">Cancelar viaje</p>
      <p className="mt-1 font-body text-sm text-ink/65">
        {MENSAJES_CLAVE_UX.cancelacion} {cargo.mensaje}
      </p>

      {mensaje && (
        <div className="mt-3" aria-live="polite" aria-atomic="true">
          <Aviso tono={mensaje.tono}>{mensaje.texto}</Aviso>
        </div>
      )}

      {/* Modal de confirmación inline — reemplaza window.confirm() */}
      {confirmando ? (
        <div className="mt-4 rounded-lg border border-danger/30 bg-danger-soft/60 p-4">
          <p className="font-body text-sm font-semibold text-danger">
            ¿Confirmar cancelación?
          </p>
          <p className="mt-1 font-body text-sm leading-5 text-ink/70">
            {cargo.mensaje} Esta acción no se puede deshacer.
          </p>
          {motivo.trim() && (
            <p className="mt-1 font-body text-xs text-ink/50">
              Motivo registrado: &quot;{motivo.trim()}&quot;
            </p>
          )}
          <div className="mt-4 flex gap-2">
            <Button
              variant="peligro"
              onClick={cancelar}
              disabled={procesando}
            >
              {procesando ? "Cancelando…" : "Sí, cancelar el viaje"}
            </Button>
            <Button
              variant="secundario"
              onClick={() => setConfirmando(false)}
              disabled={procesando}
            >
              No, mantener
            </Button>
          </div>
        </div>
      ) : (
        <div className="mt-4 grid gap-3">
          <Field
            etiqueta="Motivo"
            value={motivo}
            onChange={(e) => setMotivo(e.target.value)}
            placeholder="Cuéntanos por qué necesitas cancelar"
          />
          <Button
            variant="peligro"
            onClick={() => setConfirmando(true)}
            disabled={procesando}
          >
            Cancelar viaje
          </Button>
        </div>
      )}
    </div>
  );
}
