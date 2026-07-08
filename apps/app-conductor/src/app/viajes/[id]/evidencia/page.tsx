"use client";

"use client";
import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Button, Aviso, PassportCard } from "@ruum/ui";
import { MENSAJE_EVIDENCIA_SINCRONIZANDO, MENSAJES_CLAVE_UX, TEXTOS_CARGANDO } from "@ruum/shared/constants";
import { evidenciaCompleta } from "@ruum/shared/rules";
import { ANGULOS_OBLIGATORIOS } from "@ruum/shared/types";
import type { AnguloEvidencia, FotoEvidencia, TipoEvidencia } from "@ruum/shared/types";
import type { Database } from "@ruum/shared/types";
import { crearClienteNavegador, tieneSupabaseConfigurado } from "../../../../lib/supabase-browser";
import { esNativo } from "../../../../lib/capacitor";
import { capturarFoto } from "../../../../lib/camara";
import { obtenerUbicacionActual } from "../../../../lib/ubicacion";
import {
  contarColaEvidencia,
  encolarEvidencia,
  leerColaEvidenciaDeTraslado,
  sincronizarColaEvidencia
} from "../../../../lib/cola-offline";
import {
  obtenerPasaporteDigital,
  obtenerEvidenciaDeTraslado,
  registrarAnguloCapturado,
  confirmarEvidenciaCompleta
} from "@ruum/api/services";
import { RegistroViajeActivo } from "../../../ViajeActivoContext";

type EstadoTraslado = Database["public"]["Enums"]["estado_traslado"];

const ETIQUETA_ANGULO: Record<AnguloEvidencia, string> = {
  frente: "Frente",
  lado_piloto: "Lado piloto",
  lado_copiloto: "Lado copiloto",
  trasera: "Trasera",
  tablero: "Tablero",
  dano_previo: "Daño previo",
  adicional: "Adicional"
};

// PRD §4.4 — tipo de evidencia según en qué punto del flujo está el viaje.
function tipoEvidenciaPorEstado(estado: EstadoTraslado): TipoEvidencia | null {
  if (estado === "verificacion_vehiculo_en_proceso" || estado === "evidencia_inicial_en_proceso") return "inicial";
  if (estado === "llegada_a_destino" || estado === "evidencia_final_en_proceso") return "final";
  return null;
}

function IconoCheck() {
  return (
    <svg viewBox="0 0 20 20" className="size-4 shrink-0" aria-hidden>
      <circle cx="10" cy="10" r="9" fill="currentColor" />
      <path d="M6 10.2 8.6 13 14.2 7" fill="none" stroke="white" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
    </svg>
  );
}

function IconoReloj() {
  return (
    <svg viewBox="0 0 20 20" className="size-4 shrink-0" aria-hidden>
      <circle cx="10" cy="10" r="8" fill="none" stroke="currentColor" strokeWidth="2" />
      <path d="M10 5.8v4.6l3 1.8" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
    </svg>
  );
}

function BadgeSincronizacion({ sincronizada }: { sincronizada: boolean }) {
  return (
    <span
      className={[
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1",
        "font-body text-xs font-semibold",
        sincronizada ? "border-control/30 bg-control-soft text-control" : "border-warn/40 bg-warn-soft text-warn"
      ].join(" ")}
    >
      {sincronizada ? <IconoCheck /> : <IconoReloj />}
      {sincronizada ? "Sincronizada" : "Pendiente de subir"}
    </span>
  );
}

export default function PaginaEvidencia() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();

  const [estadoActual, setEstadoActual] = useState<EstadoTraslado | null>(null);
  const [tipo, setTipo] = useState<TipoEvidencia | null>(null);
  const [fotos, setFotos] = useState<FotoEvidencia[]>([]);
  const [cargando, setCargando] = useState(true);
  const [mostrarSkeleton, setMostrarSkeleton] = useState(true);
  const [enviando, setEnviando] = useState<AnguloEvidencia | "confirmar" | null>(null);
  const [sincronizando, setSincronizando] = useState(false);
  const [pendientesSubida, setPendientesSubida] = useState(0);
  const [aviso, setAviso] = useState<string | null>(null);

  useEffect(() => {
    const timeout = window.setTimeout(() => setMostrarSkeleton(false), 300);
    return () => window.clearTimeout(timeout);
  }, []);

  const cargarPendientesLocales = useCallback(async () => {
    const pendientes = await leerColaEvidenciaDeTraslado(id);
    setPendientesSubida(pendientes.length);
    return pendientes.map(
      (item): FotoEvidencia => ({
        id: item.localId,
        traslado_id: item.trasladoId,
        tipo: item.tipo,
        angulo: item.angulo as AnguloEvidencia,
        local_path: item.dataUrl,
        timestamp: item.capturadaEn,
        ...(item.lat !== undefined ? { lat: item.lat } : {}),
        ...(item.lng !== undefined ? { lng: item.lng } : {}),
        sincronizada: false
      })
    );
  }, [id]);

  const refrescarEvidencia = useCallback(async () => {
    if (!tipo) return;
    const cliente = crearClienteNavegador();
    const [remotas, locales] = await Promise.all([
      obtenerEvidenciaDeTraslado(cliente, id, tipo),
      cargarPendientesLocales()
    ]);
    setFotos([...remotas, ...locales.filter((local) => !remotas.some((remota) => remota.id === local.id))]);
  }, [cargarPendientesLocales, id, tipo]);

  const drenarCola = useCallback(async () => {
    if (!tipo || !tieneSupabaseConfigurado() || (typeof navigator !== "undefined" && !navigator.onLine)) return;
    const pendientes = await contarColaEvidencia(id);
    setPendientesSubida(pendientes);
    if (pendientes === 0) return;

    setSincronizando(true);
    setAviso(null);
    try {
      const cliente = crearClienteNavegador();
      const subidas = await sincronizarColaEvidencia(cliente, {
        trasladoId: id,
        onItemSincronizado: async () => {
          setPendientesSubida(await contarColaEvidencia(id));
        }
      });
      await refrescarEvidencia();
      if (subidas > 0) {
        setAviso(`${subidas} foto${subidas === 1 ? "" : "s"} sincronizada${subidas === 1 ? "" : "s"}.`);
      }
    } catch (err) {
      setAviso(err instanceof Error ? err.message : "No pudimos sincronizar la evidencia pendiente.");
    } finally {
      setSincronizando(false);
    }
  }, [id, refrescarEvidencia, tipo]);

  useEffect(() => {
    async function cargar() {
      if (!tieneSupabaseConfigurado()) {
        setAviso("Supabase no está configurado. No se puede cargar evidencia real.");
        setCargando(false);
        return;
      }

      try {
        const cliente = crearClienteNavegador();
        const pasaporte = await obtenerPasaporteDigital(cliente, id);
        if (!pasaporte) {
          setCargando(false);
          return;
        }
        const tipoDetectado = tipoEvidenciaPorEstado(pasaporte.estado);
        setEstadoActual(pasaporte.estado);
        setTipo(tipoDetectado);
        if (tipoDetectado) {
          const remotas = await obtenerEvidenciaDeTraslado(cliente, id, tipoDetectado);
          const locales = await cargarPendientesLocales();
          setFotos([...remotas, ...locales.filter((local) => local.tipo === tipoDetectado && !remotas.some((remota) => remota.id === local.id))]);
        }
      } catch (err) {
        setAviso(err instanceof Error ? err.message : "No pudimos cargar la evidencia.");
      } finally {
        setCargando(false);
      }
    }
    cargar();
  }, [cargarPendientesLocales, id]);

 useEffect(() => {
  if (!tipo) return;
  const timer = setTimeout(() => { void drenarCola(); }, 0);
  // ... resto de listeners
  return () => {
    clearTimeout(timer);
    // ... removeEventListeners
  };
}, [tipo]);


  if (cargando || mostrarSkeleton) {
    return (
      <div aria-label="Cargando evidencia" aria-busy="true" className="mx-auto max-w-xl px-6 py-12">
        <h1 className="font-display text-2xl font-semibold">Evidencia</h1>
        <p className="mt-2 font-body text-sm text-ink/60">Preparando checklist de ángulos obligatorios.</p>

        <PassportCard className="mt-6">
          <div className="grid gap-4">
            {ANGULOS_OBLIGATORIOS.map((angulo) => (
              <div key={angulo} className="h-10 animate-pulse rounded-lg bg-ink/8" />
            ))}
          </div>
        </PassportCard>

        <div className="mt-6 flex items-center justify-between gap-4">
          <p className="font-mono-ruum text-xs uppercase tracking-wide text-ink/50">
            0 / {ANGULOS_OBLIGATORIOS.length} ángulos
          </p>
          <Button disabled={true}>Confirmar evidencia</Button>
        </div>
      </div>
    );
  }

  if (!tipo) {
    return (
      <div className="mx-auto max-w-xl px-6 py-20 text-center">
        <h1 className="font-display text-xl font-semibold">Este viaje no está en fase de evidencia</h1>
        <p className="mt-3 font-body text-sm text-ink/60">Vuelve al detalle del viaje para ver el paso actual.</p>
        {aviso && (
          <div className="mt-4 text-left">
            <Aviso tono="peligro">{aviso}</Aviso>
          </div>
        )}
      </div>
    );
  }

  const resultado = evidenciaCompleta(fotos, tipo);
  const capturados = new Set(fotos.map((f) => f.angulo));

  async function capturar(angulo: AnguloEvidencia) {
    if (!tipo) return;
    setEnviando(angulo);
    setAviso(null);

    // Dentro del shell nativo: cámara y GPS reales, encolados localmente
    // (ver lib/cola-offline.ts) porque Supabase Storage todavía no está
    // conectado — no hay a dónde subir los bytes de la foto todavía, pero
    // la captura misma ya no es un botón sin efecto.
    if (esNativo()) {
      try {
        const foto = await capturarFoto();
        if (!foto) {
          setAviso("No pudimos abrir la cámara. Intenta de nuevo.");
          setEnviando(null);
          return;
        }
        const coords = await obtenerUbicacionActual();
        const localId = crypto.randomUUID();
        await encolarEvidencia({
          localId,
          trasladoId: id,
          tipo,
          angulo,
          dataUrl: foto.dataUrl,
          ...(coords ? { lat: coords.lat, lng: coords.lng } : {}),
          capturadaEn: new Date().toISOString()
        });
        const locales = await cargarPendientesLocales();
        setFotos((prev) => [...prev.filter((foto) => foto.id !== localId), ...locales.filter((local) => local.tipo === tipo)]);
        setAviso("Foto guardada en este dispositivo. Se subirá automáticamente al recuperar señal.");
        setEnviando(null);
        void drenarCola();
        return;
      } catch (err) {
        setAviso(err instanceof Error ? err.message : "No pudimos capturar la foto.");
        setEnviando(null);
        return;
      }
    }

    try {
      const cliente = crearClienteNavegador();
      await registrarAnguloCapturado(cliente, id, tipo, angulo);
      setFotos(await obtenerEvidenciaDeTraslado(cliente, id, tipo));
    } catch (err) {
      setAviso(err instanceof Error ? err.message : "No pudimos registrar la foto.");
    } finally {
      setEnviando(null);
    }
  }

  async function confirmar() {
    if (!tipo) return;
    setEnviando("confirmar");
    setAviso(null);

    if (!estadoActual) {
      setAviso("No pudimos confirmar la evidencia porque no se cargó el estado actual del viaje.");
      setEnviando(null);
      return;
    }

    try {
      const cliente = crearClienteNavegador();
      await confirmarEvidenciaCompleta(cliente, id, estadoActual, tipo);
      router.push(`/viajes/${id}`);
    } catch (err) {
      setAviso(err instanceof Error ? err.message : "No pudimos confirmar la evidencia.");
    } finally {
      setEnviando(null);
    }
  }

  return (
    <div className="mx-auto max-w-xl px-6 py-12">
      <RegistroViajeActivo
        viaje={
          estadoActual
            ? {
                trasladoId: id,
                estado: estadoActual
              }
            : null
        }
      />
      <h1 className="font-display text-2xl font-semibold">
        Evidencia {tipo === "inicial" ? "inicial" : "final"}
      </h1>
      <p className="mt-2 font-body text-sm text-ink/60">
        {tipo === "inicial"
          ? `${MENSAJES_CLAVE_UX.evidencia_inicial} Los 5 ángulos son obligatorios.`
          : "Documenta el estado del vehículo al llegar, para comparar contra la evidencia inicial."}
      </p>

      {aviso && (
        <div className="mt-4">
          <Aviso tono={resultado.completa ? "info" : "atencion"}>{aviso}</Aviso>
        </div>
      )}

      {pendientesSubida > 0 && (
        <div className="mt-4">
          <Aviso tono="atencion">
            {pendientesSubida} foto{pendientesSubida === 1 ? "" : "s"} pendiente{pendientesSubida === 1 ? "" : "s"} de subir.
            {sincronizando ? ` ${MENSAJE_EVIDENCIA_SINCRONIZANDO}.` : " Se sincronizarán automáticamente al recuperar conexión."}
          </Aviso>
        </div>
      )}

      <PassportCard className="mt-6">
        <div className="space-y-3">
          {ANGULOS_OBLIGATORIOS.map((angulo) => {
            const foto = fotos.find((item) => item.angulo === angulo);
            const yaCapturado = capturados.has(angulo);
            return (
              <div key={angulo} className="flex items-center justify-between gap-4 border-b border-ink/10 pb-3 last:border-0 last:pb-0">
                <span className="font-body text-sm">{ETIQUETA_ANGULO[angulo]}</span>
                {yaCapturado ? (
                  <BadgeSincronizacion sincronizada={Boolean(foto?.sincronizada)} />
                ) : (
                  <Button variant="secundario" onClick={() => capturar(angulo)} loading={enviando === angulo}>
                    {enviando === angulo ? "Guardando…" : esNativo() ? "Tomar foto" : "Marcar capturado"}
                  </Button>
                )}
              </div>
            );
          })}
        </div>
      </PassportCard>

      <div className="mt-6 flex items-center justify-between">
        <p className="font-mono-ruum text-xs uppercase tracking-wide text-ink/50">
          {ANGULOS_OBLIGATORIOS.length - resultado.angulosFaltantes.length} / {ANGULOS_OBLIGATORIOS.length} ángulos
        </p>
        <Button onClick={confirmar} disabled={!resultado.completa} loading={enviando === "confirmar"}>
          {enviando === "confirmar" ? TEXTOS_CARGANDO.confirmando : "Confirmar evidencia completa"}
        </Button>
      </div>
    </div>
  );
}
