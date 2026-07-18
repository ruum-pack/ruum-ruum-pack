"use client";
import { useEffect, useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { Aviso, Button, PassportCard } from "@ruum/ui";
import { estaDentroDeCobertura } from "@ruum/shared/rules";
import type { Database } from "@ruum/shared/types";
import { crearClienteNavegador, puedeUsarDatosDemo, tieneSupabaseConfigurado } from "../../lib/supabase-browser";
import { actualizarReclamoSeguroAdmin, listarReclamosSeguroAdmin, listarViajesAdmin } from "@ruum/api/services";

type Reclamo = Database["public"]["Tables"]["reclamos_seguro"]["Row"];
type Pasaporte = Database["public"]["Views"]["pasaporte_digital"]["Row"];
type EstadoReclamo = Database["public"]["Enums"]["estado_reclamo_seguro"];
type ResponsablePago = "aplicacion" | "conductor";

const RECLAMOS_DEMO: Reclamo[] = [
  {
    id: "demo-reclamo-001",
    traslado_id: "demo-admin-003",
    estado: "en_revision",
    abierto_en: new Date(Date.now() - 1000 * 60 * 60 * 30).toISOString(),
    resuelto_en: null,
    responsable_pago: null,
    notas_admin: "Aseguradora revisa evidencia final y reporte de incidencia."
  }
];

function etiquetaCobertura(pasaporte: Pasaporte | undefined) {
  if (!pasaporte) return "Sin pasaporte";
  if (!pasaporte.estado) return "Sin estado operativo";
  return estaDentroDeCobertura(pasaporte.estado, false) ? "Dentro de cobertura" : "Fuera de ventana";
}

function claseCobertura(etiqueta: string) {
  if (etiqueta === "Dentro de cobertura") return "border-control/30 bg-control-soft text-control";
  if (etiqueta === "Fuera de ventana") return "border-warn/40 bg-warn-soft text-warn";
  return "border-ink/15 bg-ink/[0.04] text-ink/55";
}

function AccionReclamo({ reclamo, onActualizado }: { reclamo: Reclamo; onActualizado: () => void }) {
  const [estado, setEstado] = useState<EstadoReclamo>(reclamo.estado);
  const [responsable, setResponsable] = useState<ResponsablePago | "">((reclamo.responsable_pago as ResponsablePago | null) ?? "");
  const [notas, setNotas] = useState(reclamo.notas_admin ?? "");
  const [mensaje, setMensaje] = useState<string | null>(null);
  const [pendiente, startTransition] = useTransition();

  function guardar() {
    setMensaje(null);
    startTransition(async () => {
      try {
        if (!tieneSupabaseConfigurado()) {
          setMensaje("Actualización simulada en demo.");
          return;
        }
        const cliente = crearClienteNavegador();
        await actualizarReclamoSeguroAdmin(
          cliente,
          reclamo.id,
          estado,
          responsable === "" ? null : responsable,
          notas
        );
        setMensaje("Reclamo actualizado.");
        onActualizado();
      } catch (error) {
        setMensaje(error instanceof Error ? error.message : "No se pudo actualizar el reclamo.");
      }
    });
  }

  return (
    <div className="mt-5 grid gap-3 border-t border-ink/10 pt-4 md:grid-cols-[1fr_1fr_1.5fr_auto]">
      <select value={estado} onChange={(evento) => setEstado(evento.target.value as EstadoReclamo)} className="rounded-lg border border-ink/50 bg-mist px-3 py-2 font-body text-sm">
        {["abierto", "en_revision", "resuelto"].map((valor) => (
          <option key={valor} value={valor}>{valor.replaceAll("_", " ")}</option>
        ))}
      </select>
      <select value={responsable} onChange={(evento) => setResponsable(evento.target.value as ResponsablePago | "")} className="rounded-lg border border-ink/50 bg-mist px-3 py-2 font-body text-sm">
        <option value="">Responsable pendiente</option>
        <option value="aplicacion">Aplicación</option>
        <option value="conductor">Conductor</option>
      </select>
      <input value={notas} onChange={(evento) => setNotas(evento.target.value)} className="rounded-lg border border-ink/50 bg-mist px-3 py-2 font-body text-sm" placeholder="Notas internas" />
      <Button onClick={guardar} disabled={pendiente}>{pendiente ? "Guardando..." : "Guardar"}</Button>
      {mensaje && <p className="md:col-span-4 font-body text-sm text-ink/60">{mensaje}</p>}
    </div>
  );
}

function pasaporteConTrasladoId(pasaporte: Pasaporte): pasaporte is Pasaporte & { traslado_id: string } {
  return Boolean(pasaporte.traslado_id);
}

export default function PaginaReclamosSeguroAdmin() {
  const [reclamos, setReclamos] = useState<Reclamo[]>([]);
  const [pasaportes, setPasaportes] = useState<Pasaporte[]>([]);
  const [esDemo, setEsDemo] = useState(true);
  const [cargando, setCargando] = useState(true);

  async function cargar() {
    if (!tieneSupabaseConfigurado()) {
      setReclamos(RECLAMOS_DEMO);
      setPasaportes([]);
      setEsDemo(true);
      setCargando(false);
      return;
    }
    try {
      const cliente = crearClienteNavegador();
      const [r, p] = await Promise.all([listarReclamosSeguroAdmin(cliente), listarViajesAdmin(cliente, "todos")]);
      setReclamos(r);
      setPasaportes(p);
      setEsDemo(false);
    } catch {
      if (puedeUsarDatosDemo()) {
        setReclamos(RECLAMOS_DEMO);
        setPasaportes([]);
        setEsDemo(true);
      } else {
        setReclamos([]);
        setPasaportes([]);
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

  const pasaportePorId = useMemo(() => new Map(pasaportes.filter(pasaporteConTrasladoId).map((p) => [p.traslado_id, p])), [pasaportes]);

  return (
    <main className="mx-auto max-w-6xl px-6 py-8 sm:px-8 sm:py-10">
      <h1 className="font-display text-2xl font-semibold">Reclamos de seguro</h1>
      <p className="mt-1 font-body text-sm text-ink/55">Seguimiento administrativo de reclamos, responsable de pago y resolución.</p>
      {esDemo && <div className="mt-4"><Aviso tono="info">Vista con datos de ejemplo.</Aviso></div>}
      {cargando ? <p className="mt-8 font-body text-sm text-ink/50">Cargando...</p> : (
        <section className="mt-6 grid gap-4">
          {reclamos.map((reclamo) => {
            const pasaporte = pasaportePorId.get(reclamo.traslado_id);
            const cobertura = etiquetaCobertura(pasaporte);
            return (
              <PassportCard key={reclamo.id}>
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div>
                    <p className="font-mono-ruum text-xs uppercase tracking-wide text-ink/45">{reclamo.id}</p>
                    <h2 className="mt-1 font-display text-xl font-semibold">Reclamo {reclamo.estado.replaceAll("_", " ")}</h2>
                    <p className="mt-2 font-body text-sm text-ink/65">{reclamo.notas_admin ?? "Sin notas internas registradas."}</p>
                  </div>
                  <span className={`rounded-full border px-3 py-1.5 font-body text-xs font-semibold ${claseCobertura(cobertura)}`}>{cobertura}</span>
                </div>
                <dl className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                  <div><dt className="font-body text-xs uppercase tracking-wide text-ink/45">Traslado</dt><dd className="mt-1 font-body text-sm font-medium"><Link href={`/viajes/${reclamo.traslado_id}`} className="text-route-dark">{reclamo.traslado_id.slice(0, 8).toUpperCase()}</Link></dd></div>
                  <div><dt className="font-body text-xs uppercase tracking-wide text-ink/45">Estado</dt><dd className="mt-1 font-body text-sm font-medium">{reclamo.estado.replaceAll("_", " ")}</dd></div>
                  <div><dt className="font-body text-xs uppercase tracking-wide text-ink/45">Abierto</dt><dd className="mt-1 font-body text-sm font-medium">{new Date(reclamo.abierto_en).toLocaleString("es-MX")}</dd></div>
                  <div><dt className="font-body text-xs uppercase tracking-wide text-ink/45">Responsable</dt><dd className="mt-1 font-body text-sm font-medium">{reclamo.responsable_pago ?? "Pendiente"}</dd></div>
                  <div className="sm:col-span-2"><dt className="font-body text-xs uppercase tracking-wide text-ink/45">Vehículo</dt><dd className="mt-1 font-body text-sm font-medium">{pasaporte ? `${pasaporte.vehiculo_marca ?? ""} ${pasaporte.vehiculo_modelo ?? ""}`.trim() : "Sin pasaporte cargado"}</dd></div>
                  <div className="sm:col-span-2"><dt className="font-body text-xs uppercase tracking-wide text-ink/45">Estatus de cobertura</dt><dd className="mt-1 font-body text-sm font-medium">{cobertura}</dd></div>
                </dl>
                <AccionReclamo reclamo={reclamo} onActualizado={cargar} />
              </PassportCard>
            );
          })}
        </section>
      )}
    </main>
  );
}
