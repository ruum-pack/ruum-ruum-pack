"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { Aviso, Button, PassportCard } from "@ruum/ui";
import { ETIQUETA_TIPO_DISPUTA } from "@ruum/shared/constants";
import { slaResolucionDisputa, slaRevisionAdmin } from "@ruum/shared/rules";
import type { Database } from "@ruum/shared/types";
import { crearClienteNavegador, puedeUsarDatosDemo, tieneSupabaseConfigurado } from "../../lib/supabase-browser";
import { listarDisputasAdmin, listarViajesAdmin, resolverDisputaAdmin } from "@ruum/api/services";
import { AdminPageHeader, AdminFiltroActivo, limpiarParamsFiltroUrl } from "../admin-ui";
import { AdminLoadingState, AdminEmptyState, AdminErrorState, AdminBadge } from "../admin-components";

type Disputa = Database["public"]["Tables"]["disputas"]["Row"];
type Pasaporte = Database["public"]["Views"]["pasaporte_digital"]["Row"];
type EstadoDisputa = Database["public"]["Enums"]["estado_disputa"];
type ResolucionDisputa = Database["public"]["Enums"]["resolucion_disputa"];

const DISPUTAS_DEMO: Disputa[] = [
  {
    id: "demo-disputa-001",
    traslado_id: "demo-admin-003",
    abierta_por: "usuario",
    tipo: "dano_no_reconocido",
    estado: "abierta",
    resolucion: null,
    descripcion: "El usuario no reconoce un daño registrado en evidencia final.",
    resolucion_detalle: null,
    abierta_en: new Date(Date.now() - 1000 * 60 * 60 * 18).toISOString(),
    resuelta_en: null,
    escalada_en: null
  }
];

function horasDesde(fecha: string) {
  return Math.max(0, (Date.now() - new Date(fecha).getTime()) / (1000 * 60 * 60));
}

function diasDesde(fecha: string) {
  return Math.floor(horasDesde(fecha) / 24);
}

function badgeSla(disputa: Disputa) {
  if (disputa.estado === "resuelta" || disputa.estado === "resuelta_senior") return "Resuelta";
  const revision = slaRevisionAdmin(horasDesde(disputa.abierta_en));
  const resolucion = slaResolucionDisputa(diasDesde(disputa.abierta_en), disputa.estado === "escalada");
  if (!revision.dentro_de_sla || !resolucion.dentro_de_sla) return "SLA vencido";
  if (revision.requiere_alerta || resolucion.requiere_alerta) return "Por vencer";
  return "En tiempo";
}

function claseSla(etiqueta: string) {
  if (etiqueta === "SLA vencido") return "border-status-error/25 bg-status-error-soft text-status-error";
  if (etiqueta === "Por vencer") return "border-status-warning/40 bg-status-warning-soft text-status-warning";
  if (etiqueta === "Resuelta") return "border-status-success/30 bg-status-success-soft text-status-success";
  return "border-status-info/30 bg-status-info-soft text-status-info";
}

function AccionDisputa({ disputa, onActualizada }: { disputa: Disputa; onActualizada: () => void }) {
  const [estado, setEstado] = useState<EstadoDisputa>(disputa.estado);
  const [resolucion, setResolucion] = useState<ResolucionDisputa>("favor_reclamante");
  const [detalle, setDetalle] = useState(disputa.resolucion_detalle ?? "");
  const [mensaje, setMensaje] = useState<string | null>(null);
  const [pendiente, startTransition] = useTransition();

  function guardar() {
    setMensaje(null);
    startTransition(async () => {
      try {
        if (!tieneSupabaseConfigurado()) {
          setMensaje("Resolución simulada en demo.");
          return;
        }
        const cliente = crearClienteNavegador();
        await resolverDisputaAdmin(cliente, disputa.id, estado, estado === "resuelta" || estado === "resuelta_senior" ? resolucion : null, detalle);
        setMensaje("Disputa actualizada.");
        onActualizada();
      } catch (error) {
        setMensaje(error instanceof Error ? error.message : "No se pudo actualizar la disputa.");
      }
    });
  }

  return (
    <div className="mt-5 grid gap-3 border-t border-ink/10 pt-4 md:grid-cols-[1fr_1fr_1.5fr_auto]">
      <select value={estado} onChange={(evento) => setEstado(evento.target.value as EstadoDisputa)} className="rounded-lg border border-ink/50 bg-surface-primary px-3 py-2 font-body text-sm">
        {["abierta", "en_revision", "resuelta", "escalada", "resuelta_senior"].map((valor) => (
          <option key={valor} value={valor}>{valor.replaceAll("_", " ")}</option>
        ))}
      </select>
      <select value={resolucion} onChange={(evento) => setResolucion(evento.target.value as ResolucionDisputa)} className="rounded-lg border border-ink/50 bg-surface-primary px-3 py-2 font-body text-sm">
        {["favor_reclamante", "en_contra", "solucion_parcial"].map((valor) => (
          <option key={valor} value={valor}>{valor.replaceAll("_", " ")}</option>
        ))}
      </select>
      <input value={detalle} onChange={(evento) => setDetalle(evento.target.value)} className="rounded-lg border border-ink/50 bg-surface-primary px-3 py-2 font-body text-sm" placeholder="Detalle de resolución" />
      <Button onClick={guardar} disabled={pendiente}>{pendiente ? "Guardando..." : "Guardar"}</Button>
      {mensaje && <p className="md:col-span-4 font-body text-sm text-text-secondary">{mensaje}</p>}
    </div>
  );
}

export default function PaginaDisputasAdmin() {
  const [filtroPendientes, setFiltroPendientes] = useState(false);
  const [disputas, setDisputas] = useState<Disputa[]>([]);
  const [pasaportes, setPasaportes] = useState<Pasaporte[]>([]);
  const [esDemo, setEsDemo] = useState(true);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function cargar() {
    setError(null);
    if (!tieneSupabaseConfigurado()) {
      setDisputas(DISPUTAS_DEMO);
      setPasaportes([]);
      setEsDemo(true);
      setCargando(false);
      return;
    }
    try {
      const cliente = crearClienteNavegador();
      const [d, p] = await Promise.all([listarDisputasAdmin(cliente), listarViajesAdmin(cliente, "todos")]);
      setDisputas(d);
      setPasaportes(p);
      setEsDemo(false);
    } catch {
      if (puedeUsarDatosDemo()) {
        setDisputas(DISPUTAS_DEMO);
        setPasaportes([]);
        setEsDemo(true);
      } else {
        setDisputas([]);
        setPasaportes([]);
        setError("No pudimos cargar las disputas.");
        setEsDemo(false);
      }
    } finally {
      setCargando(false);
    }
  }

  useEffect(() => {
  const timer = setTimeout(() => {
    void cargar();
  }, 0);
  return () => clearTimeout(timer);
}, []);

  useEffect(() => {
    setFiltroPendientes(new URLSearchParams(window.location.search).get("filtro") === "pendientes");
  }, []);

  const pasaportePorId = useMemo(() => new Map(pasaportes.map((p) => [p.traslado_id, p])), [pasaportes]);
  const disputasVisibles = useMemo(
    () => filtroPendientes ? disputas.filter((disputa) => disputa.estado !== "resuelta" && disputa.estado !== "resuelta_senior") : disputas,
    [disputas, filtroPendientes]
  );

  if (cargando) {
    return (
      <main className="admin-page-shell">
        <AdminLoadingState label="Cargando disputas" />
      </main>
    );
  }

  if (error && !esDemo && disputas.length === 0) {
    return (
      <main className="admin-page-shell">
        <AdminErrorState
          title={error}
          action={<Button onClick={cargar}>Reintentar</Button>}
        />
      </main>
    );
  }

  return (
    <main className="admin-page-shell">
      <AdminPageHeader
        etiqueta="Casos"
        titulo="Disputas"
        descripcion="Revisión, SLA y resolución de inconformidades post-cierre."
        estadoConexion={esDemo ? "demo" : "datos_en_vivo"}
        contadorResultados={disputasVisibles.length}
      />

      {filtroPendientes && (
        <AdminFiltroActivo
          etiqueta="Disputas pendientes"
          onLimpiar={() => { setFiltroPendientes(false); limpiarParamsFiltroUrl(["filtro"]); }}
        />
      )}

      {esDemo && <div className="mt-4"><Aviso tono="info">Vista con datos de ejemplo.</Aviso></div>}

      {disputasVisibles.length === 0 ? (
        <div className="mt-6">
          <AdminEmptyState title="Sin disputas" description="No hay disputas abiertas o pendientes de resolución." />
        </div>
      ) : (
        <section className="mt-6 grid gap-4">
          {disputasVisibles.map((disputa) => {
            const pasaporte = pasaportePorId.get(disputa.traslado_id);
            const sla = badgeSla(disputa);
            return (
              <PassportCard key={disputa.id}>
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div>
                    <p className="font-mono-ruum text-xs uppercase tracking-wide text-text-tertiary">{disputa.id}</p>
                    <h2 className="mt-1 font-display text-xl font-semibold">{ETIQUETA_TIPO_DISPUTA[disputa.tipo]}</h2>
                    <p className="mt-2 font-body text-sm text-text-secondary">{disputa.descripcion}</p>
                  </div>
                  <span className={`rounded-full border px-3 py-1.5 font-body text-xs font-semibold ${claseSla(sla)}`}>{sla}</span>
                </div>
                <dl className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                  <div><dt className="font-body text-xs uppercase tracking-wide text-text-tertiary">Traslado</dt><dd className="mt-1 font-body text-sm font-medium"><Link href={`/viajes/${disputa.traslado_id}`} className="text-status-info">{disputa.traslado_id.slice(0, 8).toUpperCase()}</Link></dd></div>
                  <div><dt className="font-body text-xs uppercase tracking-wide text-text-tertiary">Abierta por</dt><dd className="mt-1 font-body text-sm font-medium">{disputa.abierta_por}</dd></div>
                  <div><dt className="font-body text-xs uppercase tracking-wide text-text-tertiary">Estado</dt><dd className="mt-1 font-body text-sm font-medium">{disputa.estado.replaceAll("_", " ")}</dd></div>
                  <div><dt className="font-body text-xs uppercase tracking-wide text-text-tertiary">Apertura</dt><dd className="mt-1 font-body text-sm font-medium">{new Date(disputa.abierta_en).toLocaleString("es-MX")}</dd></div>
                  <div className="sm:col-span-2"><dt className="font-body text-xs uppercase tracking-wide text-text-tertiary">Vehículo</dt><dd className="mt-1 font-body text-sm font-medium">{pasaporte ? `${pasaporte.vehiculo_marca ?? ""} ${pasaporte.vehiculo_modelo ?? ""}`.trim() : "Sin pasaporte cargado"}</dd></div>
                  <div className="sm:col-span-2"><dt className="font-body text-xs uppercase tracking-wide text-text-tertiary">Resolución</dt><dd className="mt-1 font-body text-sm font-medium">{disputa.resolucion ? `${disputa.resolucion.replaceAll("_", " ")} · ${disputa.resolucion_detalle ?? ""}` : "Pendiente"}</dd></div>
                </dl>
                <AccionDisputa disputa={disputa} onActualizada={cargar} />
              </PassportCard>
            );
          })}
        </section>
      )}
    </main>
  );
}
