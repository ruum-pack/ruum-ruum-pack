"use client";

/**
 * PRD §4.1 — Alertas de SLA de verificación.
 * Admin recibe alertas cuando un usuario o conductor supera el 80% del SLA
 * sin resolución. Muestra todos los pendientes ordenados por urgencia:
 * primero vencidos, luego por porcentaje de consumo descendente.
 *
 * SLAs (horas hábiles L-V 09:00-18:00):
 *   - Verificación cuenta nueva usuario        → 2 h
 *   - Revisión documentos usuario              → 4 h
 *   - Verificación conductor (primera vez)     → 24 h
 *   - Revisión documentos conductor            → 24 h
 *
 * Alerta visual: ≥80% (naranja) · >100% (rojo/vencido)
 */

import { useEffect, useState } from "react";
import Link from "next/link";
import { Aviso } from "@ruum/ui";
import {
  listarAlertasSLA,
  validarDocumentoUsuario,
  validarDocumentoConductor,
  type AlertaSLA
} from "@ruum/api/services";
import { crearClienteNavegador, tieneSupabaseConfigurado } from "../../lib/supabase-browser";

// ── Demo data ──────────────────────────────────────────────────────────────
const ALERTAS_DEMO: AlertaSLA[] = [
  {
    id: "demo-usuario-sla-001",
    tipo: "cuenta_nueva_usuario",
    nombre: "María Fernanda López",
    creado_en: new Date(Date.now() - 1000 * 60 * 60 * 2.5).toISOString(),
    horas_transcurridas: 2.5,
    horas_limite: 2,
    porcentaje_consumido: 125,
    requiere_alerta: false,
    vencido: true
  },
  {
    id: "demo-conductor-sla-001",
    tipo: "conductor_primera_vez",
    nombre: "Carlos Eduardo Ramírez",
    creado_en: new Date(Date.now() - 1000 * 60 * 60 * 22).toISOString(),
    horas_transcurridas: 22,
    horas_limite: 24,
    porcentaje_consumido: 92,
    requiere_alerta: true,
    vencido: false
  },
  {
    id: "demo-usuario-sla-002",
    tipo: "documentos_usuario",
    nombre: "Jorge Alejandro Méndez",
    creado_en: new Date(Date.now() - 1000 * 60 * 60 * 3.5).toISOString(),
    horas_transcurridas: 3.5,
    horas_limite: 4,
    porcentaje_consumido: 88,
    requiere_alerta: true,
    vencido: false
  },
  {
    id: "demo-conductor-sla-002",
    tipo: "documentos_conductor",
    nombre: "Ana Patricia Guerrero",
    creado_en: new Date(Date.now() - 1000 * 60 * 60 * 18).toISOString(),
    horas_transcurridas: 18,
    horas_limite: 24,
    porcentaje_consumido: 75,
    requiere_alerta: false,
    vencido: false
  },
  {
    id: "demo-usuario-sla-003",
    tipo: "cuenta_nueva_usuario",
    nombre: "Roberto Sánchez Torres",
    creado_en: new Date(Date.now() - 1000 * 60 * 60 * 0.5).toISOString(),
    horas_transcurridas: 0.5,
    horas_limite: 2,
    porcentaje_consumido: 25,
    requiere_alerta: false,
    vencido: false
  }
];

const ETIQUETA_TIPO: Record<AlertaSLA["tipo"], string> = {
  cuenta_nueva_usuario: "Cuenta nueva · usuario",
  documentos_usuario: "Documentos · usuario",
  conductor_primera_vez: "Verificación · conductor",
  documentos_conductor: "Documentos · conductor"
};

const LIMITE_ETIQUETA: Record<AlertaSLA["tipo"], string> = {
  cuenta_nueva_usuario: "2 h hábiles",
  documentos_usuario: "4 h hábiles",
  conductor_primera_vez: "24 h hábiles",
  documentos_conductor: "24 h hábiles"
};

const RUTA_DESTINO: Record<AlertaSLA["tipo"], string> = {
  cuenta_nueva_usuario: "/usuarios",
  documentos_usuario: "/usuarios",
  conductor_primera_vez: "/conductores",
  documentos_conductor: "/conductores"
};

function BarraSLA({ porcentaje, vencido }: { porcentaje: number; vencido: boolean }) {
  const ancho = Math.min(porcentaje, 100);
  const color = vencido
    ? "bg-danger"
    : porcentaje >= 80
    ? "bg-warn"
    : "bg-control";

  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-mist-dim">
      <div
        className={`h-full rounded-full transition-all ${color}`}
        style={{ width: `${ancho}%` }}
      />
    </div>
  );
}

function TarjetaSLA({
  alerta,
  onResolver
}: {
  alerta: AlertaSLA;
  onResolver: (id: string, tipo: AlertaSLA["tipo"]) => void;
}) {
  const esUsuario = alerta.tipo === "cuenta_nueva_usuario" || alerta.tipo === "documentos_usuario";

  return (
    <div
      className={`rounded-2xl border p-4 transition-colors ${
        alerta.vencido
          ? "border-danger/30 bg-danger-soft"
          : alerta.requiere_alerta
          ? "border-warn/40 bg-warn-soft"
          : "border-mist-dim bg-mist"
      }`}
    >
      <div className="mb-3 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="mb-1 flex flex-wrap items-center gap-2">
            {alerta.vencido && (
              <span className="rounded-full bg-danger px-2 py-0.5 font-mono-ruum text-[10px] text-white">
                VENCIDO
              </span>
            )}
            {!alerta.vencido && alerta.requiere_alerta && (
              <span className="rounded-full bg-warn px-2 py-0.5 font-mono-ruum text-[10px] text-white">
                URGENTE
              </span>
            )}
            <span className="font-mono-ruum text-[10px] uppercase tracking-wide text-ink/40">
              {ETIQUETA_TIPO[alerta.tipo]}
            </span>
          </div>
          <p className="font-display text-sm font-semibold leading-tight">{alerta.nombre}</p>
          <p className="font-mono-ruum text-[10px] text-ink/40">
            {alerta.id.startsWith("demo-") ? "ID demo" : alerta.id.slice(0, 8).toUpperCase()}
          </p>
        </div>
        <div className="flex-shrink-0 text-right">
          <p
            className={`font-display text-xl font-semibold ${
              alerta.vencido ? "text-danger" : alerta.requiere_alerta ? "text-warn" : "text-ink"
            }`}
          >
            {alerta.porcentaje_consumido}%
          </p>
          <p className="font-mono-ruum text-[10px] text-ink/40">del SLA</p>
        </div>
      </div>

      <BarraSLA porcentaje={alerta.porcentaje_consumido} vencido={alerta.vencido} />

      <div className="mt-2 flex items-center justify-between">
        <p className="font-mono-ruum text-[10px] text-ink/45">
          {alerta.horas_transcurridas.toFixed(1)} h transcurridas · límite {LIMITE_ETIQUETA[alerta.tipo]}
        </p>
        <p
          className={`font-mono-ruum text-[10px] ${
            alerta.vencido ? "text-danger" : "text-ink/35"
          }`}
        >
          {alerta.vencido
            ? `+${(alerta.horas_transcurridas - alerta.horas_limite).toFixed(1)} h fuera`
            : `${(alerta.horas_limite - alerta.horas_transcurridas).toFixed(1)} h restantes`}
        </p>
      </div>

      <div className="mt-3 flex items-center gap-2">
        <Link
          href={RUTA_DESTINO[alerta.tipo]}
          className="flex-1 rounded-lg border border-ink/50 bg-mist py-2 text-center font-body text-xs text-ink/65 hover:bg-mist-dim transition-colors"
        >
          {esUsuario ? "Ver usuario" : "Ver conductor"} →
        </Link>
        <button
          onClick={() => onResolver(alerta.id, alerta.tipo)}
          className="flex-1 rounded-lg border border-control/30 bg-control-soft py-2 font-body text-xs text-control hover:bg-control hover:text-white transition-colors"
        >
          Marcar en revisión
        </button>
      </div>
    </div>
  );
}

export default function PaginaAlertasSLA() {
  const [alertas, setAlertas] = useState<AlertaSLA[]>([]);
  const [esDemo, setEsDemo] = useState(true);
  const [cargando, setCargando] = useState(true);
  const [aviso, setAviso] = useState<{ tono: "info" | "peligro"; texto: string } | null>(null);

  async function cargar() {
    setCargando(true);
    if (!tieneSupabaseConfigurado()) {
      setAlertas(ALERTAS_DEMO);
      setEsDemo(true);
      setCargando(false);
      return;
    }
    try {
      const cliente = crearClienteNavegador();
      setAlertas(await listarAlertasSLA(cliente));
      setEsDemo(false);
    } catch {
      setAlertas(ALERTAS_DEMO);
      setEsDemo(true);
    } finally {
      setCargando(false);
    }
  }

  useEffect(() => { void cargar(); }, []);

  async function handleResolver(id: string, tipo: AlertaSLA["tipo"]) {
    if (esDemo) {
      setAviso({ tono: "info", texto: "En modo demo: la acción no persiste." });
      return;
    }
    try {
      const cliente = crearClienteNavegador();
      const esUsuario = tipo === "cuenta_nueva_usuario" || tipo === "documentos_usuario";
      if (esUsuario) {
        await validarDocumentoUsuario(cliente, id, "en_revision");
      } else {
        await validarDocumentoConductor(cliente, id, false);
      }
      setAviso({ tono: "info", texto: "Estado actualizado a En revisión." });
      await cargar();
    } catch (err) {
      setAviso({
        tono: "peligro",
        texto: err instanceof Error ? err.message : "No se pudo actualizar el estado."
      });
    }
  }

  const vencidos = alertas.filter((a) => a.vencido);
  const urgentes = alertas.filter((a) => !a.vencido && a.requiere_alerta);
  const normales = alertas.filter((a) => !a.vencido && !a.requiere_alerta);
  const total = alertas.length;

  return (
    <div className="min-h-screen">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-mist-dim px-6 py-4">
        <div>
          <h1 className="font-display text-xl font-semibold">Alertas de SLA</h1>
          <p className="font-mono-ruum text-xs text-ink/45">
            Verificaciones pendientes · {total} en espera
          </p>
        </div>
        <div className="flex items-center gap-3">
          {esDemo && (
            <span className="rounded-lg bg-warn-soft px-3 py-1 font-mono-ruum text-xs text-warn">
              Modo demo
            </span>
          )}
          <button
            onClick={() => void cargar()}
            className="rounded-lg border border-mist-dim bg-mist px-3 py-1.5 font-body text-sm text-ink/65 hover:bg-mist-dim transition-colors"
          >
            Actualizar
          </button>
        </div>
      </div>

      <div className="px-6 py-6">
        {/* Resumen */}
        <div className="mb-6 grid grid-cols-4 gap-3">
          <div className="rounded-xl bg-mist-dim px-4 py-3">
            <p className="font-mono-ruum text-xs text-ink/45">Total pendientes</p>
            <p className="font-display text-2xl font-semibold">{total}</p>
          </div>
          <div className="rounded-xl bg-danger-soft px-4 py-3">
            <p className="font-mono-ruum text-xs text-danger/70">Vencidos</p>
            <p className="font-display text-2xl font-semibold text-danger">{vencidos.length}</p>
          </div>
          <div className="rounded-xl bg-warn-soft px-4 py-3">
            <p className="font-mono-ruum text-xs text-warn/70">Urgentes (≥80%)</p>
            <p className="font-display text-2xl font-semibold text-warn">{urgentes.length}</p>
          </div>
          <div className="rounded-xl bg-control-soft px-4 py-3">
            <p className="font-mono-ruum text-xs text-control/70">En plazo</p>
            <p className="font-display text-2xl font-semibold text-control">{normales.length}</p>
          </div>
        </div>

        {aviso && (
          <div className="mb-4">
            <Aviso tono={aviso.tono === "peligro" ? "peligro" : "info"}>{aviso.texto}</Aviso>
          </div>
        )}

        {cargando ? (
          <div className="flex items-center justify-center py-20">
            <p className="font-mono-ruum text-sm text-ink/35">Cargando alertas…</p>
          </div>
        ) : total === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-control-soft">
              <span className="text-2xl">✓</span>
            </div>
            <p className="font-display text-lg text-ink/50">Sin verificaciones pendientes</p>
            <p className="font-body text-sm text-ink/35">
              Todos los usuarios y conductores están al día.
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-6">
            {vencidos.length > 0 && (
              <section>
                <p className="mb-3 font-mono-ruum text-xs uppercase tracking-widest text-danger/70">
                  ⚠ Vencidos — {vencidos.length}
                </p>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {vencidos.map((a) => (
                    <TarjetaSLA key={a.id} alerta={a} onResolver={handleResolver} />
                  ))}
                </div>
              </section>
            )}

            {urgentes.length > 0 && (
              <section>
                <p className="mb-3 font-mono-ruum text-xs uppercase tracking-widest text-warn/70">
                  Urgentes ≥ 80% · {urgentes.length}
                </p>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {urgentes.map((a) => (
                    <TarjetaSLA key={a.id} alerta={a} onResolver={handleResolver} />
                  ))}
                </div>
              </section>
            )}

            {normales.length > 0 && (
              <section>
                <p className="mb-3 font-mono-ruum text-xs uppercase tracking-widest text-ink/35">
                  En plazo · {normales.length}
                </p>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {normales.map((a) => (
                    <TarjetaSLA key={a.id} alerta={a} onResolver={handleResolver} />
                  ))}
                </div>
              </section>
            )}
          </div>
        )}

        {/* Referencia de SLAs */}
        <div className="mt-8 rounded-2xl border border-mist-dim bg-mist p-4">
          <p className="mb-3 font-mono-ruum text-xs uppercase tracking-widest text-ink/40">
            Referencia — SLAs del PRD §4.1 (horas hábiles L-V 09:00–18:00)
          </p>
          <div className="grid grid-cols-2 gap-x-8 gap-y-2">
            {[
              ["Verificación cuenta nueva · usuario", "2 h"],
              ["Revisión de documentos · usuario", "4 h"],
              ["Verificación conductor (primera vez)", "24 h"],
              ["Revisión de documentos · conductor", "24 h"]
            ].map(([etiqueta, limite]) => (
              <div key={etiqueta} className="flex items-center justify-between">
                <p className="font-body text-xs text-ink/55">{etiqueta}</p>
                <p className="font-mono-ruum text-xs text-ink/70">{limite}</p>
              </div>
            ))}
          </div>
          <p className="mt-3 font-body text-xs text-ink/35">
            Alerta visual activada al alcanzar el 80% del tiempo límite sin resolución.
          </p>
        </div>
      </div>
    </div>
  );
}
