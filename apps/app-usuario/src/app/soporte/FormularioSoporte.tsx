"use client";
import { useState } from "react";
import { Aviso, Button } from "@ruum/ui";
import { crearClienteNavegador, tieneSupabaseConfigurado } from "../../lib/supabase-browser";
import { registrarEventoUx } from "../../lib/analytics";

type Props = {
  traslados: { id: string; label: string }[];
  preseleccionado?: string;
  emailUsuario?: string | null;
};

const MOTIVOS = [
  "Reportar problema con un viaje",
  "Reportar daño o incidente",
  "Ayuda con pagos",
  "Ayuda con evidencia",
  "Cancelaciones",
  "Otro",
] as const;

export function FormularioSoporte({ traslados, preseleccionado, emailUsuario }: Props) {
  const [motivo, setMotivo] = useState<string>(MOTIVOS[0] ?? "Otro");
  const [viajeId, setViajeId] = useState(preseleccionado ?? "");
  const [descripcion, setDescripcion] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [resultado, setResultado] = useState<{ ok: boolean; msg: string } | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (descripcion.trim().length < 10) {
      setResultado({ ok: false, msg: "Describe con al menos 10 caracteres para que podamos ayudarte." });
      return;
    }
    setEnviando(true);
    setResultado(null);
    registrarEventoUx("soporte_enviado", { motivo, tiene_viaje: Boolean(viajeId) });

    try {
      // Intento 1: Supabase directo (tabla incidencias si hay viaje, si no fallback a mailto)
      if (tieneSupabaseConfigurado() && viajeId) {
        const cliente = crearClienteNavegador();
        // Mapear motivo a tipo incidencia válido; fallback a 'otro'
        const tipoMap: Record<string, string> = {
          "Reportar daño o incidente": "dano_visible",
          "Reportar problema con un viaje": "otro",
          "Ayuda con pagos": "otro",
          "Ayuda con evidencia": "otro",
          Cancelaciones: "otro",
        };
        const tipo = tipoMap[motivo] ?? "otro";
        const { error } = await cliente.from("incidencias").insert({
          traslado_id: viajeId,
          tipo,
          momento: "durante_traslado",
          descripcion: `[Soporte app-usuario] Motivo: ${motivo}\n${descripcion.trim()}`,
        } as never);
        if (!error) {
          setResultado({ ok: true, msg: `¡Recibido! Folio ${viajeId.slice(0, 8).toUpperCase()}-${Date.now().toString().slice(-4)}. Te respondemos en <30 min (8:00–22:00) o <2h fuera de horario. También te escribimos a ${emailUsuario ?? "tu correo registrado"}.` });
          setDescripcion("");
          return;
        }
        // Si falla RLS o tabla, caemos a mailto
        console.warn("[soporte] incidencias insert falló, fallback mailto", error);
      }

      // Fallback: mailto prellenado + aviso éxito
      const subject = encodeURIComponent(`[Ruum Ruum] ${motivo}${viajeId ? ` · ${viajeId.slice(0, 8).toUpperCase()}` : ""}`);
      const body = encodeURIComponent(
        `Motivo: ${motivo}\nViaje: ${viajeId || "—"}\n\nDescripción:\n${descripcion.trim()}\n\n---\nEnviado desde app-usuario`
      );
      window.location.href = `mailto:soporte@ruumruum.mx?subject=${subject}&body=${body}`;
      setResultado({ ok: true, msg: "Abrimos tu correo con el mensaje prellenado. Si no se abrió, escribe a soporte@ruumruum.mx — respondemos en <30 min." });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "No pudimos enviar tu mensaje.";
      setResultado({ ok: false, msg });
    } finally {
      setEnviando(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="grid gap-4 sm:grid-cols-2">
      <label className="flex flex-col gap-1.5">
        <span className="font-body text-xs font-semibold uppercase tracking-wider text-text-tertiary">Motivo</span>
        <select value={motivo} onChange={(e) => setMotivo(e.target.value)} className="w-full rounded-xl border border-border bg-surface px-3.5 py-2.5 font-body text-sm text-text-primary focus-visible:outline focus-visible:outline-[3px] focus-visible:outline-offset-1 focus-visible:outline-route-action">
          {MOTIVOS.map((m) => (
            <option key={m} value={m}>{m}</option>
          ))}
        </select>
      </label>

      <label className="flex flex-col gap-1.5">
        <span className="font-body text-xs font-semibold uppercase tracking-wider text-text-tertiary">Viaje relacionado (opcional)</span>
        <select value={viajeId} onChange={(e) => setViajeId(e.target.value)} className="w-full rounded-xl border border-border bg-surface px-3.5 py-2.5 font-body text-sm text-text-primary focus-visible:outline focus-visible:outline-[3px] focus-visible:outline-offset-1 focus-visible:outline-route-action">
          <option value="">Sin viaje / consulta general</option>
          {traslados.map((t) => (
            <option key={t.id} value={t.id}>{t.label}</option>
          ))}
        </select>
      </label>

      <label className="flex flex-col gap-1.5 sm:col-span-2">
        <span className="font-body text-xs font-semibold uppercase tracking-wider text-text-tertiary">Descripción</span>
        <textarea
          rows={4}
          value={descripcion}
          onChange={(e) => setDescripcion(e.target.value)}
          placeholder="Describe lo que pasó, incluye ubicación aproximada, hora y cualquier evidencia relevante."
          className="w-full rounded-xl border border-border bg-surface px-3.5 py-2.5 font-body text-sm text-text-primary placeholder:text-text-tertiary focus-visible:outline focus-visible:outline-[3px] focus-visible:outline-offset-1 focus-visible:outline-route-action"
          required
          minLength={10}
          maxLength={1000}
        />
        <span className="font-body text-xs text-text-tertiary">{descripcion.length}/1000</span>
      </label>

      <div className="sm:col-span-2 flex flex-col gap-3">
        <Button type="submit" disabled={enviando} className="w-full sm:w-auto">{enviando ? "Enviando…" : "Enviar a soporte"}</Button>
        <p className="font-body text-xs leading-5 text-text-secondary">SLA: <span className="font-semibold text-text-primary">Respondemos en &lt;30 min (8:00–22:00 MX)</span> y &lt;2 h fuera de horario. Si es emergencia con daño o seguridad, usa también el chat del Pasaporte Digital.</p>
        {resultado && <Aviso tono={resultado.ok ? "info" : "danger"}>{resultado.msg}</Aviso>}
      </div>
    </form>
  );
}
