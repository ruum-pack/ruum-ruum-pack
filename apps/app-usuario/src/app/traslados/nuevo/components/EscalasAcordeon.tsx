"use client";
import { useState } from "react";
import { Field } from "@ruum/ui";
import type { ParadaForm, TipoParadaForm, TipoTareaForm } from "../types";

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

export function EscalasAcordeon({
  paradas,
  onChange,
  erroresParadas
}: {
  paradas: ParadaForm[];
  onChange: (next: ParadaForm[]) => void;
  erroresParadas?: Array<Partial<Record<keyof ParadaForm, string>>>;
}) {
  const [abiertoId, setAbiertoId] = useState<string | null>(paradas[0]?.id ?? null);
  const [menuAbierto, setMenuAbierto] = useState(false);

  function agregar(tipo: TipoParadaForm) {
    if (paradas.length >= 8) return;
    const nuevo: ParadaForm = {
      id: crypto.randomUUID(),
      tipo,
      calle: "",
      numero: "",
      colonia: "",
      codigoPostal: "",
      estado: "",
      ciudad: "",
      referencias: "",
      tipoTarea: tipo === "tarea" ? "entrega_parcial" : undefined,
      contactoNombre: "",
      contactoTelefono: "",
      instrucciones: "",
      requiereEvidencia: false,
      tiempoEsperaMin: ""
    };
    const next = [...paradas, nuevo];
    onChange(next);
    setAbiertoId(nuevo.id);
    setMenuAbierto(false);
  }

  function actualizar(id: string, patch: Partial<ParadaForm>) {
    onChange(paradas.map((p) => (p.id === id ? { ...p, ...patch } : p)));
  }

  function eliminar(id: string) {
    onChange(paradas.filter((p) => p.id !== id));
    if (abiertoId === id) setAbiertoId(null);
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
      <p className="font-body text-xs leading-4 text-ink/55">Se recorren en orden entre origen y destino. Escala = parada breve sin contacto. Tarea = gestión con contacto y tiempo de espera.</p>

      {/* Timeline mini visual */}
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

      {/* Lista acordeón */}
      <div className="grid gap-2">
        {paradas.map((p, idx) => {
          const abierto = abiertoId === p.id;
          const err = erroresParadas?.[idx];
          const resumen = [p.calle, p.numero].filter(Boolean).join(" ") || p.colonia || p.ciudad || "Nueva parada";
          const hasError = err && Object.keys(err).length > 0;
          return (
            <div key={p.id} className={["rounded-xl border bg-mist overflow-hidden", hasError ? "border-danger/40" : "border-ink/10"].join(" ")}>
              <button
                type="button"
                onClick={() => setAbiertoId(abierto ? null : p.id)}
                aria-expanded={abierto}
                className="flex w-full items-center gap-2 px-3 py-3 text-left hover:bg-ink/[0.03]"
              >
                <span className={["inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-body text-[11px] font-bold", p.tipo === "tarea" ? "bg-amber-100 text-amber-900 border border-amber-200" : "bg-sky-100 text-sky-900 border border-sky-200"].join(" ")}>
                  {p.tipo === "tarea" ? "✅ Tarea" : "📍 Escala"} #{idx + 1}
                </span>
                <span className="min-w-0 flex-1 truncate font-body text-sm font-medium text-ink">{resumen}</span>
                {hasError && <span className="size-2 rounded-full bg-danger" aria-label="con errores" />}
                <span className="font-body text-xs text-ink/40">{abierto ? "▲" : "▼"}</span>
              </button>
              {abierto && (
                <div className="grid gap-3 border-t border-ink/10 bg-white px-3 py-3">
                  {/* Tipo switch */}
                  <div className="grid grid-cols-2 gap-1 rounded-lg border border-ink/10 bg-mist p-1">
                    <button type="button" onClick={() => actualizar(p.id, { tipo: "escala" as TipoParadaForm })} className={["rounded-md px-2 py-1.5 font-body text-xs font-bold", p.tipo === "escala" ? "bg-signal text-ink shadow-sm" : "text-ink/60 hover:bg-white"].join(" ")}>📍 Escala</button>
                    <button type="button" onClick={() => actualizar(p.id, { tipo: "tarea" as TipoParadaForm, tipoTarea: p.tipoTarea ?? "entrega_parcial" })} className={["rounded-md px-2 py-1.5 font-body text-xs font-bold", p.tipo === "tarea" ? "bg-signal text-ink shadow-sm" : "text-ink/60 hover:bg-white"].join(" ")}>✅ Tarea</button>
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

                  <div className="grid gap-3 sm:grid-cols-2">
                    <Field etiqueta="Calle" value={p.calle} onChange={(e) => actualizar(p.id, { calle: e.target.value })} error={err?.calle} />
                    <Field etiqueta="Número" value={p.numero} onChange={(e) => actualizar(p.id, { numero: e.target.value })} error={err?.numero} />
                    <Field etiqueta="Colonia" value={p.colonia} onChange={(e) => actualizar(p.id, { colonia: e.target.value })} error={err?.colonia} />
                    <Field etiqueta="Código Postal" value={p.codigoPostal} onChange={(e) => actualizar(p.id, { codigoPostal: soloDigitos(e.target.value, 5) })} inputMode="numeric" maxLength={5} error={err?.codigoPostal} />
                    <Field etiqueta="Ciudad" value={p.ciudad} onChange={(e) => actualizar(p.id, { ciudad: e.target.value })} error={err?.ciudad} />
                    <Field etiqueta="Estado" value={p.estado} onChange={(e) => actualizar(p.id, { estado: e.target.value })} error={err?.estado} />
                  </div>
                  <Field etiqueta="Referencias" value={p.referencias} onChange={(e) => actualizar(p.id, { referencias: e.target.value })} placeholder="Entre calles, fachada, acceso..." error={err?.referencias} />

                  {p.tipo === "tarea" && (
                    <>
                      <div className="grid gap-3 sm:grid-cols-2">
                        <Field etiqueta="Contacto (nombre)" value={p.contactoNombre ?? ""} onChange={(e) => actualizar(p.id, { contactoNombre: e.target.value })} error={err?.contactoNombre} />
                        <div className="flex flex-col gap-1.5">
                          <label className="font-body text-sm font-medium">Teléfono contacto</label>
                          <div className="flex overflow-hidden rounded-lg border border-ink/30 bg-mist">
                            <span className="flex items-center border-r border-ink/10 px-3 font-body text-sm font-semibold text-ink/60">+52</span>
                            <input value={p.contactoTelefono ?? ""} onChange={(e) => actualizar(p.id, { contactoTelefono: soloDigitos(e.target.value, 10) })} inputMode="numeric" maxLength={10} placeholder="10 dígitos" className="min-w-0 flex-1 bg-transparent px-3 py-2.5 font-body text-sm focus:outline-none" />
                          </div>
                          {err?.contactoTelefono && <span className="font-body text-xs text-danger">{err.contactoTelefono}</span>}
                        </div>
                      </div>
                      <label className="flex flex-col gap-1.5">
                        <span className="font-body text-sm font-medium">Instrucciones tarea</span>
                        <textarea value={p.instrucciones ?? ""} onChange={(e) => actualizar(p.id, { instrucciones: e.target.value })} maxLength={500} rows={2} placeholder="Qué hacer en esta tarea..." className="rounded-lg border border-ink/30 bg-mist px-3 py-2.5 font-body text-sm" />
                        {err?.instrucciones && <span className="font-body text-xs text-danger">{err.instrucciones}</span>}
                      </label>
                      <div className="grid gap-3 sm:grid-cols-2">
                        <Field etiqueta="Tiempo espera (min)" value={p.tiempoEsperaMin ?? ""} onChange={(e) => actualizar(p.id, { tiempoEsperaMin: soloDigitos(e.target.value, 3) })} inputMode="numeric" placeholder="Ej. 15" error={err?.tiempoEsperaMin} />
                        <label className="flex items-center gap-2 font-body text-sm">
                          <input type="checkbox" checked={Boolean(p.requiereEvidencia)} onChange={(e) => actualizar(p.id, { requiereEvidencia: e.target.checked })} className="size-4" />
                          Requiere foto/evidencia
                        </label>
                      </div>
                    </>
                  )}

                  {p.tipo === "escala" && (
                    <Field etiqueta="Tiempo espera (min) opcional" value={p.tiempoEsperaMin ?? ""} onChange={(e) => actualizar(p.id, { tiempoEsperaMin: soloDigitos(e.target.value, 3) })} inputMode="numeric" placeholder="Ej. 10" error={err?.tiempoEsperaMin} />
                  )}

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

      {/* Menú agregar */}
      <div className="relative">
        <button
          type="button"
          onClick={() => setMenuAbierto((v) => !v)}
          disabled={paradas.length >= 8}
          aria-expanded={menuAbierto}
          aria-haspopup="menu"
          className="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-ink/20 bg-mist px-4 py-3 font-body text-sm font-semibold text-ink hover:border-signal/40 hover:bg-signal/10 disabled:opacity-40"
        >
          <span className="text-lg">＋</span> Agregar escala o tarea
          <span className="rounded-full bg-ink/10 px-2 py-0.5 font-mono-ruum text-[11px]">{paradas.length}/8</span>
        </button>
        {menuAbierto && paradas.length < 8 && (
          <div role="menu" className="absolute left-0 right-0 z-10 mt-2 grid grid-cols-2 gap-2 rounded-xl border border-ink/10 bg-white p-2 shadow-xl">
            <button type="button" role="menuitem" onClick={() => agregar("escala")} className="rounded-xl border border-sky-200 bg-sky-50 px-3 py-4 text-left hover:bg-sky-100">
              <span className="block font-body text-sm font-bold text-sky-900">📍 Escala</span>
              <span className="mt-1 block font-body text-xs leading-4 text-sky-700">Parada breve sin contacto. Solo dirección y espera opcional.</span>
            </button>
            <button type="button" role="menuitem" onClick={() => agregar("tarea")} className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-4 text-left hover:bg-amber-100">
              <span className="block font-body text-sm font-bold text-amber-900">✅ Tarea</span>
              <span className="mt-1 block font-body text-xs leading-4 text-amber-800">Gestión con contacto, instrucciones y evidencia.</span>
            </button>
          </div>
        )}
        {paradas.length >= 8 && <p className="mt-1 font-body text-xs text-danger">Máximo 8 escalas/tareas alcanzado.</p>}
      </div>
    </div>
  );
}
