"use client";

import React, { memo, useEffect, useRef, useState } from "react";
import { Field } from "@ruum/ui";
import { sugerirDireccionesAutocomplete, type SugerenciaDireccion } from "../../../../lib/mapbox";
import type { ParadaForm, TipoTareaForm } from "../types";

const TIPOS_TAREA: Array<{ valor: TipoTareaForm; etiqueta: string }> = [
  { valor: "entrega_parcial", etiqueta: "Entrega parcial" },
  { valor: "recoleccion", etiqueta: "Recolección" },
  { valor: "tramite", etiqueta: "Trámite / gestión" },
  { valor: "inspeccion", etiqueta: "Inspección" },
  { valor: "carga_descarga", etiqueta: "Carga / descarga" },
  { valor: "otro", etiqueta: "Otro" }
];

function soloDigitos(v: string, max?: number) {
  const d = v.replace(/\D/g, "");
  return max ? d.slice(0, max) : d;
}

export const EscalasAcordeon = memo(function EscalasAcordeon({
  paradas,
  onChange,
  erroresParadas
}: {
  paradas: ParadaForm[];
  onChange: (next: ParadaForm[]) => void;
  erroresParadas?: Array<Partial<Record<keyof ParadaForm, string>>>;
}) {
  const [abiertoId, setAbiertoId] = useState<string | null>(paradas[0]?.id ?? null);
  const [busquedas, setBusquedas] = useState<Record<string, string>>(() => (
    Object.fromEntries(paradas.map((p) => [p.id, ""]))
  ));
  const [sugerencias, setSugerencias] = useState<Record<string, SugerenciaDireccion[]>>({});
  const [buscandoId, setBuscandoId] = useState<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const busquedaSeqRef = useRef(0);

  useEffect(() => () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    busquedaSeqRef.current += 1;
  }, []);

  function agregar() {
    if (paradas.length >= 8) return;
    const nuevo: ParadaForm = {
      id: crypto.randomUUID(),
      tipo: "escala",
      calle: "",
      numero: "",
      colonia: "",
      codigoPostal: "",
      estado: "",
      ciudad: "",
      referencias: ""
    };
    onChange([...paradas, nuevo]);
    setAbiertoId(nuevo.id);
    setBusquedas((prev) => ({ ...prev, [nuevo.id]: "" }));
  }

  function actualizar(id: string, patch: Partial<ParadaForm>) {
    onChange(paradas.map((p) => (p.id === id ? { ...p, ...patch } : p)));
  }

  function cambiarBusqueda(id: string, valor: string) {
    setBusquedas((prev) => ({ ...prev, [id]: valor }));
    setSugerencias((prev) => ({ ...prev, [id]: [] }));
    busquedaSeqRef.current += 1;
    const seq = busquedaSeqRef.current;
    if (timerRef.current) clearTimeout(timerRef.current);

    if (valor.trim().length < 3) {
      setBuscandoId(null);
      return;
    }

    setBuscandoId(id);
    timerRef.current = setTimeout(async () => {
      try {
        const res = await sugerirDireccionesAutocomplete(valor);
        if (seq === busquedaSeqRef.current) setSugerencias((prev) => ({ ...prev, [id]: res }));
      } catch {
        if (seq === busquedaSeqRef.current) setSugerencias((prev) => ({ ...prev, [id]: [] }));
      } finally {
        if (seq === busquedaSeqRef.current) setBuscandoId(null);
      }
    }, 350);
  }

  function aplicarSugerencia(id: string, sugerencia: SugerenciaDireccion) {
    const calleExtraida = sugerencia.direccion || sugerencia.textoCompleto.split(",")[0] || "";
    actualizar(id, {
      calle: calleExtraida,
      colonia: sugerencia.colonia || "",
      codigoPostal: sugerencia.codigoPostal || "",
      ciudad: sugerencia.ciudad || "",
      estado: sugerencia.estado || "",
      ...(sugerencia.lat !== undefined && sugerencia.lng !== undefined
        ? { lat: sugerencia.lat, lng: sugerencia.lng }
        : {})
    });
    setBusquedas((prev) => ({ ...prev, [id]: sugerencia.textoCompleto }));
    setSugerencias((prev) => ({ ...prev, [id]: [] }));
    setBuscandoId(null);
  }

  function eliminar(id: string) {
    onChange(paradas.filter((p) => p.id !== id));
    if (abiertoId === id) setAbiertoId(null);
    setBusquedas((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
    setSugerencias((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
  }

  function mover(id: string, dir: -1 | 1) {
    const idx = paradas.findIndex((p) => p.id === id);
    const nxt = idx + dir;
    if (nxt < 0 || nxt >= paradas.length) return;
    const copia = [...paradas];
    const [item] = copia.splice(idx, 1);
    copia.splice(nxt, 0, item!);
    onChange(copia);
  }

  return (
    <div className="grid gap-3">
      <div className="flex items-center justify-between">
        <p className="font-body text-sm font-semibold">Escalas y tareas intermedias</p>
        <span className="rounded-full border border-ink/10 bg-mist px-2.5 py-1 font-mono-ruum text-xs font-bold text-ink/60">{paradas.length}/8</span>
      </div>
      <p className="font-body text-xs leading-4 text-ink/55">Agrega una parada y elige si es escala o tarea. La búsqueda prellena código postal, estado, ciudad, colonia y calle; el número queda editable.</p>

      {paradas.length > 0 && (
        <div className="flex items-center gap-1 overflow-x-auto py-1" aria-hidden>
          <span className="size-2 shrink-0 rounded-full bg-emerald-500" title="Origen" />
          <span className="h-px w-4 shrink-0 bg-ink/15" />
          {paradas.map((p) => (
            <span key={p.id} className={["size-2.5 shrink-0 rounded-full border-2", p.tipo === "tarea" ? "border-amber-500 bg-amber-100" : "border-sky-500 bg-sky-100"].join(" ")} title={p.tipo} />
          ))}
          <span className="h-px w-4 shrink-0 bg-ink/15" />
          <span className="size-2 shrink-0 rounded-full bg-red-500" title="Destino" />
        </div>
      )}

      <div className="grid gap-2">
        {paradas.map((p, idx) => {
          const abierto = abiertoId === p.id;
          const err = erroresParadas?.[idx];
          const resumen = [p.calle, p.numero].filter(Boolean).join(" ") || p.colonia || p.ciudad || "Nueva parada";
          const hasError = err && Object.keys(err).length > 0;
          const sugerenciasParada = sugerencias[p.id] ?? [];
          return (
            <div key={p.id} className={["rounded-xl border bg-mist overflow-hidden", hasError ? "border-danger/40" : "border-ink/10"].join(" ")}>
              <button type="button" onClick={() => setAbiertoId(abierto ? null : p.id)} aria-expanded={abierto} className="flex w-full items-center gap-2 px-3 py-3 text-left hover:bg-ink/[0.03]">
                <span className={["inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-body text-[11px] font-bold", p.tipo === "tarea" ? "bg-amber-100 text-amber-900 border border-amber-200" : "bg-sky-100 text-sky-900 border border-sky-200"].join(" ")}>
                  {p.tipo === "tarea" ? "✅ Tarea" : "📍 Escala"} #{idx + 1}
                </span>
                <span className="min-w-0 flex-1 truncate font-body text-sm font-medium text-ink">{resumen}</span>
                {hasError && <span className="size-2 rounded-full bg-danger" aria-label="con errores" />}
                <span className="font-body text-xs text-ink/40">{abierto ? "▲" : "▼"}</span>
              </button>
              {abierto && (
                <div className="grid gap-3 border-t border-ink/10 bg-white px-3 py-3">
                  <div className="grid grid-cols-2 gap-1 rounded-lg border border-ink/10 bg-mist p-1" role="radiogroup" aria-label={`Tipo de parada ${idx + 1}`}>
                    <button type="button" role="radio" aria-checked={p.tipo === "escala"} aria-label="Escala" onClick={() => actualizar(p.id, { tipo: "escala" })} className={["rounded-md px-2 py-1.5 font-body text-xs font-bold", p.tipo === "escala" ? "bg-signal text-ink shadow-sm" : "text-ink/60 hover:bg-white"].join(" ")}>📍 Escala</button>
                    <button type="button" role="radio" aria-checked={p.tipo === "tarea"} aria-label="Tarea" onClick={() => actualizar(p.id, { tipo: "tarea", tipoTarea: p.tipoTarea ?? "entrega_parcial" })} className={["rounded-md px-2 py-1.5 font-body text-xs font-bold", p.tipo === "tarea" ? "bg-signal text-ink shadow-sm" : "text-ink/60 hover:bg-white"].join(" ")}>✅ Tarea</button>
                  </div>

                  {p.tipo === "tarea" && (
                    <label className="flex flex-col gap-1.5">
                      <span className="font-body text-xs font-semibold text-ink/70">Tipo de tarea</span>
                      <select value={p.tipoTarea ?? "entrega_parcial"} onChange={(e) => actualizar(p.id, { tipoTarea: e.target.value as TipoTareaForm })} className="rounded-lg border border-ink/20 bg-mist px-3 py-2.5 font-body text-sm">
                        {TIPOS_TAREA.map((o) => <option key={o.valor} value={o.valor}>{o.etiqueta}</option>)}
                      </select>
                      {err?.tipoTarea && <span className="font-body text-xs text-danger">{err.tipoTarea}</span>}
                    </label>
                  )}

                  <div>
                    <label htmlFor={`parada-${p.id}-busqueda`} className="font-body text-xs font-semibold text-ink">Busca tu dirección</label>
                    <div className="relative mt-1.5">
                      <input
                        id={`parada-${p.id}-busqueda`}
                        value={busquedas[p.id] ?? ""}
                        onChange={(e) => cambiarBusqueda(p.id, e.target.value)}
                        placeholder="Ej. Av. Patriotismo 12, CDMX"
                        className="w-full rounded-xl border border-ink/20 bg-mist px-3.5 py-2.5 pr-10 font-body text-sm text-ink placeholder:text-ink/45 focus:border-signal focus:outline-none focus:ring-2 focus:ring-signal/20"
                        role="combobox"
                        aria-label={`Buscar dirección de parada ${idx + 1}`}
                        aria-autocomplete="list"
                        aria-controls={`parada-${p.id}-sugerencias`}
                        aria-expanded={sugerenciasParada.length > 0}
                        autoComplete="off"
                      />
                      <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-ink/40">{buscandoId === p.id ? "…" : "🔍"}</span>
                      {sugerenciasParada.length > 0 && (
                        <ul id={`parada-${p.id}-sugerencias`} role="listbox" aria-label={`Sugerencias de parada ${idx + 1}`} className="absolute z-20 mt-1 max-h-48 w-full overflow-auto rounded-xl border border-ink/10 bg-mist shadow-2">
                          {sugerenciasParada.map((s, i) => (
                            <li key={`${s.textoCompleto}-${i}`} role="option" aria-selected={false}>
                              <button type="button" onClick={() => aplicarSugerencia(p.id, s)} className="w-full px-3 py-2 text-left font-body text-xs leading-5 hover:bg-signal/10">
                                <span className="font-semibold text-ink">{s.textoCompleto}</span>
                              </button>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                    <p className="mt-1 font-body text-[11px] leading-4 text-ink/55">Prellenamos los datos hasta calle; captura o corrige el número abajo.</p>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2">
                    <Field etiqueta="Calle" value={p.calle} onChange={(e) => actualizar(p.id, { calle: e.target.value })} error={err?.calle} />
                    <Field etiqueta="Número" value={p.numero} onChange={(e) => actualizar(p.id, { numero: e.target.value })} error={err?.numero} />
                    <Field etiqueta="Colonia" value={p.colonia} onChange={(e) => actualizar(p.id, { colonia: e.target.value })} error={err?.colonia} />
                    <Field etiqueta="Código Postal" value={p.codigoPostal} onChange={(e) => actualizar(p.id, { codigoPostal: soloDigitos(e.target.value, 5) })} inputMode="numeric" maxLength={5} error={err?.codigoPostal} />
                    <Field etiqueta="Ciudad" value={p.ciudad} onChange={(e) => actualizar(p.id, { ciudad: e.target.value })} error={err?.ciudad} />
                    <Field etiqueta="Estado" value={p.estado} onChange={(e) => actualizar(p.id, { estado: e.target.value })} error={err?.estado} />
                  </div>
                  <Field etiqueta="Referencias" value={p.referencias} onChange={(e) => actualizar(p.id, { referencias: e.target.value })} placeholder="Entre calles, fachada, acceso..." error={err?.referencias} />

                  <div className="flex flex-wrap gap-2">
                    <button type="button" onClick={() => mover(p.id, -1)} disabled={idx === 0} className="rounded-lg border border-ink/15 bg-mist px-3 py-1.5 font-body text-xs font-semibold disabled:opacity-40">↑ Subir</button>
                    <button type="button" onClick={() => mover(p.id, 1)} disabled={idx === paradas.length - 1} className="rounded-lg border border-ink/15 bg-mist px-3 py-1.5 font-body text-xs font-semibold disabled:opacity-40">↓ Bajar</button>
                    <button type="button" onClick={() => eliminar(p.id)} className="ml-auto rounded-lg bg-danger px-3 py-1.5 font-body text-xs font-bold text-white">Eliminar</button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div>
        <button type="button" onClick={agregar} disabled={paradas.length >= 8} aria-label="Agregar escala o tarea" className="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-ink/20 bg-mist px-4 py-3 font-body text-sm font-semibold text-ink hover:border-signal/40 hover:bg-signal/10 disabled:opacity-40">
          <span className="text-lg">＋</span> Agregar escala/tarea
          <span className="rounded-full bg-ink/10 px-2 py-0.5 font-mono-ruum text-[11px]">{paradas.length}/8</span>
        </button>
        {paradas.length >= 8 && <p className="mt-1 font-body text-xs text-danger">Máximo 8 escalas/tareas alcanzado.</p>}
      </div>
    </div>
  );
});
