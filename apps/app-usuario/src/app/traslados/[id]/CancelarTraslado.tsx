"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Aviso, Button, Field } from "@ruum/ui";
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
  esDemo
}: {
  trasladoId: string;
  estado: EstadoTraslado;
  precio: number;
  fechaProgramada: string | null;
  conductorAsignado: boolean;
  esDemo: boolean;
}) {
  const router = useRouter();
  const [motivo, setMotivo] = useState("");
  const [procesando, setProcesando] = useState(false);
  const [mensaje, setMensaje] = useState<{ tono: "info" | "peligro"; texto: string } | null>(null);

  const terminal = ["servicio_cerrado", "servicio_cancelado", "traslado_fallido"].includes(estado);
  const cargo = calcularCargoCancelacion(
    precio,
    horasRestantes(fechaProgramada),
    conductorAsignado,
    ["conductor_en_punto_de_recoleccion", "verificacion_vehiculo_en_proceso", "evidencia_inicial_en_proceso"].includes(estado)
  );

  async function cancelar() {
    if (!window.confirm(cargo.mensaje)) return;
    setProcesando(true);
    setMensaje(null);
    try {
      if (esDemo || !tieneSupabaseConfigurado()) {
        await new Promise((resolve) => setTimeout(resolve, 300));
        setMensaje({ tono: "info", texto: "Traslado cancelado en modo demo." });
        return;
      }
      const cliente = crearClienteNavegador();
      const resultado = await cancelarTraslado(cliente, trasladoId, motivo);
      setMensaje({ tono: "info", texto: `Traslado cancelado. Cargo registrado: $${resultado.monto_cargo.toLocaleString("es-MX")}.` });
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
      <p className="mt-1 font-body text-sm text-ink/65">{cargo.mensaje}</p>
      {mensaje && (
        <div className="mt-3">
          <Aviso tono={mensaje.tono}>{mensaje.texto}</Aviso>
        </div>
      )}
      <div className="mt-4 grid gap-3">
        <Field etiqueta="Motivo" value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder="Cuéntanos por qué necesitas cancelar" />
        <Button onClick={cancelar} disabled={procesando}>
          {procesando ? "Cancelando..." : "Cancelar viaje"}
        </Button>
      </div>
    </div>
  );
}
