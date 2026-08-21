"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Card } from "@ruum/ui";
import { crearClienteNavegador } from "../../lib/supabase-browser";

type Notificacion = {
  id: string;
  tipo: string;
  titulo: string;
  cuerpo: string;
  destino: string;
  entidad_tipo: string | null;
  entidad_id: string | null;
  leida_en: string | null;
  estado: string;
  creado_en: string;
};

type FiltroTab = "todas" | "no_leidas" | "leidas";

function obtenerEstiloCategoria(tipo: string): { icono: string; etiqueta: string; clase: string } {
  const t = tipo.toLowerCase();
  if (t.includes("seguridad") || t.includes("emergencia") || t.includes("alerta")) {
    return { icono: "🛡️", etiqueta: "Seguridad", clase: "border-red-500/40 bg-red-500/5" };
  }
  if (t.includes("pago") || t.includes("ganancia") || t.includes("deposito")) {
    return { icono: "💵", etiqueta: "Ganancias", clase: "border-emerald-500/40 bg-emerald-500/5" };
  }
  if (t.includes("viaje") || t.includes("traslado") || t.includes("asignaci")) {
    return { icono: "🚘", etiqueta: "Operativo", clase: "border-signal/40 bg-signal/5" };
  }
  if (t.includes("docu") || t.includes("expediente") || t.includes("licencia")) {
    return { icono: "📄", etiqueta: "Documentos", clase: "border-amber-500/40 bg-amber-500/5" };
  }
  return { icono: "🔔", etiqueta: "Aviso", clase: "border-border bg-surface" };
}

export default function CentroNotificaciones() {
  const [items, setItems] = useState<Notificacion[]>([]);
  const [cargando, setCargando] = useState(true);
  const [filtro, setFiltro] = useState<FiltroTab>("todas");
  const [procesandoBulk, setProcesandoBulk] = useState(false);
  const router = useRouter();

  const cargar = useCallback(async () => {
    const cliente = crearClienteNavegador();
    const { data, error } = await (cliente as any)
      .from("notificaciones_conductor")
      .select("id,tipo,titulo,cuerpo,destino,entidad_tipo,entidad_id,leida_en,estado,creado_en")
      .order("creado_en", { ascending: false })
      .limit(100);
    if (!error) setItems((data ?? []) as Notificacion[]);
    setCargando(false);
  }, []);

  useEffect(() => {
    void cargar();
    const actualizar = () => void cargar();
    window.addEventListener("ruum:notificaciones-actualizar", actualizar);
    return () => window.removeEventListener("ruum:notificaciones-actualizar", actualizar);
  }, [cargar]);

  async function abrir(item: Notificacion) {
    const cliente = crearClienteNavegador();
    await (cliente as any).rpc("marcar_notificacion_leida", { p_notificacion_id: item.id });
    setItems((actuales) =>
      actuales.map((n) => (n.id === item.id ? { ...n, leida_en: n.leida_en ?? new Date().toISOString() } : n))
    );
    router.push(item.destino);
  }

  async function marcarTodasComoLeidas() {
    const sinLeer = items.filter((item) => !item.leida_en);
    if (sinLeer.length === 0) return;
    setProcesandoBulk(true);
    try {
      const cliente = crearClienteNavegador();
      for (const item of sinLeer) {
        await (cliente as any).rpc("marcar_notificacion_leida", { p_notificacion_id: item.id });
      }
      const ahora = new Date().toISOString();
      setItems((actuales) => actuales.map((n) => ({ ...n, leida_en: n.leida_en ?? ahora })));
    } catch {
      /* ignorar fallos transitorios */
    } finally {
      setProcesandoBulk(false);
    }
  }

  const noLeidas = items.filter((item) => !item.leida_en);
  const leidas = items.filter((item) => Boolean(item.leida_en));

  const itemsFiltrados = items.filter((item) => {
    if (filtro === "no_leidas") return !item.leida_en;
    if (filtro === "leidas") return Boolean(item.leida_en);
    return true;
  });

  return (
    <div className="mx-auto grid w-full max-w-3xl gap-6 px-4 py-8 sm:px-6 sm:py-12">
      {/* Encabezado — Brand Book p.22: título Montserrat Bold, subtítulo Inter, línea ruta */}
      <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="font-body text-[11px] font-bold uppercase tracking-widest text-text-tertiary">
            Ruum Ruum · Seguridad · Evidencia · Trazabilidad
          </p>
          <h1 className="mt-1 font-display text-2xl font-bold tracking-tight text-text-primary sm:text-3xl">
            Notificaciones y Avisos
          </h1>
          <p className="mt-1 font-body text-sm text-text-secondary">
            Tus avisos y alertas operativas permanecen guardados en este centro.
          </p>
          <div className="conductor-ruta-divider mt-3 max-w-[280px]" aria-hidden />
        </div>

        {/* 3. Acciones Globales en Bloque */}
        {noLeidas.length > 0 && (
          <button
            type="button"
            onClick={() => void marcarTodasComoLeidas()}
            disabled={procesandoBulk}
            className="inline-flex shrink-0 items-center justify-center gap-1.5 rounded-xl border border-border bg-surface px-4 py-2.5 font-display text-xs font-bold text-text-primary shadow-xs transition hover:border-signal hover:bg-surface-elevated active:scale-95 disabled:opacity-50"
          >
            ✓ {procesandoBulk ? "Actualizando..." : "Marcar todas como leídas"}
          </button>
        )}
      </header>

      {/* 2. Pestañas de Filtro (Tabs) y Contadores Dinámicos */}
      <div className="border-b border-border/40">
        <nav className="-mb-px flex space-x-2 sm:space-x-6" aria-label="Filtro de notificaciones">
          {[
            { id: "todas" as FiltroTab, etiqueta: "Todas", contador: items.length },
            { id: "no_leidas" as FiltroTab, etiqueta: "Sin leer", contador: noLeidas.length, destacada: noLeidas.length > 0 },
            { id: "leidas" as FiltroTab, etiqueta: "Leídas", contador: leidas.length }
          ].map((tab) => {
            const activa = filtro === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setFiltro(tab.id)}
                className={[
                  "inline-flex items-center gap-2 border-b-2 px-3 py-3 font-display text-sm font-bold transition-all",
                  activa
                    ? "border-signal text-signal"
                    : "border-transparent text-text-tertiary hover:border-border hover:text-text-primary"
                ].join(" ")}
              >
                {tab.etiqueta}
                <span
                  className={[
                    "inline-flex items-center justify-center rounded-full px-2 py-0.5 font-mono text-xs font-bold transition-colors",
                    tab.destacada
                      ? "bg-signal text-slate-950 shadow-xs animate-pulse"
                      : activa
                      ? "bg-surface-elevated text-text-primary border border-border"
                      : "bg-surface-elevated/50 text-text-tertiary"
                  ].join(" ")}
                >
                  {tab.contador}
                </span>
              </button>
            );
          })}
        </nav>
      </div>

      {/* Contenido Principal */}
      {cargando ? (
        <div className="py-12 text-center font-body text-sm text-text-tertiary">
          Cargando tus notificaciones...
        </div>
      ) : itemsFiltrados.length === 0 ? (
        /* 1. Estado Vacío Cálido y Visual (Empty State) */
        <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
          <div className="flex size-20 items-center justify-center rounded-full border border-border/60 bg-surface-elevated font-display text-4xl shadow-sm mb-4">
            ✨
          </div>
          <h2 className="font-display text-xl font-bold text-text-primary">
            ¡Todo al día!
          </h2>
          <p className="mt-2 max-w-sm font-body text-sm leading-6 text-text-tertiary">
            {filtro === "no_leidas"
              ? "No tienes avisos pendientes por leer. Puedes consultar tu historial en la pestaña 'Leídas'."
              : "Aquí aparecerán tus próximos avisos de servicio, ganancias y alertas operativas."}
          </p>
        </div>
      ) : (
        /* Lista de Tarjetas con Categorización Visual Anticipada */
        <section className="grid gap-3.5" aria-label="Lista de notificaciones">
          {itemsFiltrados.map((item) => {
            const estiloCat = obtenerEstiloCategoria(item.tipo);
            const esNoLeida = !item.leida_en;

            return (
              <Card
                key={item.id}
                className={[
                  "transition-all duration-150 hover:border-signal/80",
                  esNoLeida ? `${estiloCat.clase} shadow-sm` : "border-border/60 bg-surface/80"
                ].join(" ")}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-3.5 min-w-0">
                    {/* 3. Ícono de Categoría Visual */}
                    <div className="flex size-10 shrink-0 items-center justify-center rounded-xl border border-border bg-surface font-display text-lg shadow-2xs">
                      {estiloCat.icono}
                    </div>

                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-body text-xs font-bold uppercase tracking-wider text-text-tertiary">
                          {estiloCat.etiqueta} • {new Date(item.creado_en).toLocaleString("es-MX", { dateStyle: "short", timeStyle: "short" })}
                        </span>
                        {esNoLeida && (
                          <span className="rounded-full bg-signal px-2 py-0.5 font-body text-[10px] font-extrabold text-slate-950 uppercase tracking-wider">
                            Nueva
                          </span>
                        )}
                      </div>

                      <h3 className="mt-1 font-display text-base font-bold text-text-primary">
                        {item.titulo}
                      </h3>
                      <p className="mt-1.5 font-body text-sm leading-6 text-text-secondary">
                        {item.cuerpo}
                      </p>

                      {item.entidad_tipo && (
                        <p className="mt-2 font-mono text-xs text-text-tertiary">
                          {item.entidad_tipo}
                          {item.entidad_id ? ` · ${item.entidad_id.slice(0, 8)}` : ""}
                        </p>
                      )}
                    </div>
                  </div>

                  {esNoLeida && (
                    <span className="mt-1 h-3 w-3 shrink-0 rounded-full bg-signal shadow-xs animate-pulse" aria-label="No leída" />
                  )}
                </div>

                <div className="mt-4 flex justify-end">
                  <Button variant="secondary" onClick={() => void abrir(item)}>
                    Abrir aviso →
                  </Button>
                </div>
              </Card>
            );
          })}
        </section>
      )}
    </div>
  );
}
