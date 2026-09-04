export type RealtimeStatusCallback = (status: "SUBSCRIBED" | "TIMED_OUT" | "CLOSED" | "CHANNEL_ERROR", err?: Error) => void;

export interface OpcionesSuscripcionSegura {
  timeoutMs?: number;
  onError?: (error: Error) => void;
  onStatusChange?: RealtimeStatusCallback;
}

export interface CanalSuscribible {
  subscribe(callback?: (status: string, err?: Error) => void, timeout?: number): unknown;
}

export interface ClienteConRemoveChannel {
  removeChannel(channel: any): Promise<any>;
}

/**
 * Suscribe un canal Supabase Realtime con manejo de errores, timeout y limpieza segura.
 * Devuelve una función cleanup idempotente que garantiza desuscripción (removeChannel)
 * sin memory leaks ni errores no controlados.
 */
export function suscribirCanalSeguro<C extends CanalSuscribible = CanalSuscribible>(
  cliente: ClienteConRemoveChannel,
  canal: C,
  opciones: OpcionesSuscripcionSegura = {}
): () => Promise<void> {
  const { timeoutMs, onError, onStatusChange } = opciones;
  let cerrado = false;

  canal.subscribe((status, err) => {
    onStatusChange?.(status as "SUBSCRIBED" | "TIMED_OUT" | "CLOSED" | "CHANNEL_ERROR", err);

    if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
      const errorReal = err ?? new Error(`Error en suscripción realtime: ${status}`);
      onError?.(errorReal);
      void limpiar();
    }
  }, timeoutMs);

  async function limpiar(): Promise<void> {
    if (cerrado) return;
    cerrado = true;
    try {
      await cliente.removeChannel(canal);
    } catch {
      // Ignorar rechazos si el socket ya estaba cerrado o el canal ya fue desmontado
    }
  }

  return () => {
    void limpiar();
    return Promise.resolve();
  };
}

/**
 * Limpia de manera segura una lista de canales o recursos de suscripción,
 * capturando cualquier error o excepción que ocurra al desmontar.
 */
export async function limpiarCanalesSeguros(
  cliente: ClienteConRemoveChannel,
  canales: Array<any>
): Promise<void> {
  const validos = canales.filter((c) => c != null);
  if (validos.length === 0) return;

  await Promise.allSettled(
    validos.map(async (canal) => {
      try {
        await cliente.removeChannel(canal);
      } catch {
        // Ignorar errores en cleanup
      }
    })
  );
}
