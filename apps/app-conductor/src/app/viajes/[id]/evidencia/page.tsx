"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Button, Aviso, PassportCard } from "@ruum/ui";
import { evidenciaCompleta } from "@ruum/shared/rules";
import { ANGULOS_OBLIGATORIOS } from "@ruum/shared/types";
import type { AnguloEvidencia, FotoEvidencia, TipoEvidencia } from "@ruum/shared/types";
import type { Database } from "@ruum/shared/types";
import { crearClienteNavegador, tieneSupabaseConfigurado } from "../../../../lib/supabase-browser";
import { esNativo } from "../../../../lib/capacitor";
import { capturarFoto } from "../../../../lib/camara";
import { obtenerUbicacionActual } from "../../../../lib/ubicacion";
import { encolarEvidencia } from "../../../../lib/cola-offline";
import {
  obtenerPasaporteDigital,
  obtenerEvidenciaDeTraslado,
  registrarAnguloCapturado,
  confirmarEvidenciaCompleta
} from "@ruum/api/services";

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

export default function PaginaEvidencia() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();

  const [estadoActual, setEstadoActual] = useState<EstadoTraslado | null>(null);
  const [tipo, setTipo] = useState<TipoEvidencia | null>(null);
  const [fotos, setFotos] = useState<FotoEvidencia[]>([]);
  const [esDemo, setEsDemo] = useState(true);
  const [cargando, setCargando] = useState(true);
  const [enviando, setEnviando] = useState<AnguloEvidencia | "confirmar" | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);

  useEffect(() => {
    async function cargar() {
      if (!tieneSupabaseConfigurado()) {
        // Modo demo: el viaje de ejemplo aceptado está en traslado_en_curso,
        // que ya pasó la fase de evidencia inicial — aquí se simula que
        // todavía está en verificacion_vehiculo_en_proceso para poder
        // mostrar el checklist sin necesidad de Supabase.
        setEstadoActual("verificacion_vehiculo_en_proceso");
        setTipo("inicial");
        setFotos([]);
        setEsDemo(true);
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
          setFotos(await obtenerEvidenciaDeTraslado(cliente, id, tipoDetectado));
        }
        setEsDemo(false);
      } catch {
        setEstadoActual("verificacion_vehiculo_en_proceso");
        setTipo("inicial");
        setFotos([]);
        setEsDemo(true);
      } finally {
        setCargando(false);
      }
    }
    cargar();
  }, [id]);

  if (cargando) {
    return (
      <main className="mx-auto max-w-xl px-6 py-20">
        <p className="font-body text-sm text-ink/50">Cargando…</p>
      </main>
    );
  }

  if (!tipo) {
    return (
      <main className="mx-auto max-w-xl px-6 py-20 text-center">
        <h1 className="font-display text-xl font-semibold">Este viaje no está en fase de evidencia</h1>
        <p className="mt-3 font-body text-sm text-ink/60">Vuelve al detalle del viaje para ver el paso actual.</p>
      </main>
    );
  }

  const resultado = evidenciaCompleta(fotos, tipo);
  const capturados = new Set(fotos.map((f) => f.angulo));

  async function capturar(angulo: AnguloEvidencia) {
    if (!tipo) return;
    setEnviando(angulo);
    setAviso(null);

    if (esDemo) {
      await new Promise((r) => setTimeout(r, 300));
      setFotos((prev) => [
        ...prev,
        { id: `demo-${angulo}`, traslado_id: id, tipo: tipo!, angulo, timestamp: new Date().toISOString(), sincronizada: true }
      ]);
      setEnviando(null);
      return;
    }

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
        await encolarEvidencia({
          localId: crypto.randomUUID(),
          trasladoId: id,
          tipo,
          angulo,
          dataUrl: foto.dataUrl,
          ...(coords ? { lat: coords.lat, lng: coords.lng } : {}),
          capturadaEn: new Date().toISOString()
        });
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

    if (esDemo || !estadoActual) {
      await new Promise((r) => setTimeout(r, 400));
      setAviso("Evidencia confirmada en modo demo. Conecta Supabase para que se guarde de verdad.");
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
    <main className="mx-auto max-w-xl px-6 py-12">
      <h1 className="font-display text-2xl font-semibold">
        Evidencia {tipo === "inicial" ? "inicial" : "final"}
      </h1>
      <p className="mt-2 font-body text-sm text-ink/60">
        {tipo === "inicial"
          ? "Documenta el estado del vehículo antes de salir. Los 5 ángulos son obligatorios."
          : "Documenta el estado del vehículo al llegar, para comparar contra la evidencia inicial."}
      </p>

      {esDemo && (
        <div className="mt-4">
          <Aviso tono="info">Estás en modo demo: las fotos no se suben a ningún lado todavía.</Aviso>
        </div>
      )}

      {aviso && (
        <div className="mt-4">
          <Aviso tono={resultado.completa ? "info" : "atencion"}>{aviso}</Aviso>
        </div>
      )}

      <PassportCard className="mt-6">
        <div className="space-y-3">
          {ANGULOS_OBLIGATORIOS.map((angulo) => {
            const yaCapturado = capturados.has(angulo);
            return (
              <div key={angulo} className="flex items-center justify-between gap-4 border-b border-ink/10 pb-3 last:border-0 last:pb-0">
                <span className="font-body text-sm">{ETIQUETA_ANGULO[angulo]}</span>
                {yaCapturado ? (
                  <span className="font-body text-xs font-medium text-control">Capturado</span>
                ) : (
                  <Button variant="secundario" onClick={() => capturar(angulo)} disabled={enviando === angulo}>
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
        <Button onClick={confirmar} disabled={!resultado.completa || enviando === "confirmar"}>
          {enviando === "confirmar" ? "Confirmando…" : "Confirmar evidencia completa"}
        </Button>
      </div>
    </main>
  );
}
