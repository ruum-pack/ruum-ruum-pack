"use client";
import { useState } from "react";
import Link from "next/link";
import { Aviso, Button } from "@ruum/ui";
import { reportarIncidencia } from "@ruum/api/services";
import type { TipoIncidencia } from "@ruum/shared/types";
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
  "Ayuda con pagos o facturación",
  "Dudas con evidencia fotográfica",
  "Cancelaciones o reprogramación",
  "Consulta general u otro",
] as const;

const MOTIVO_A_TIPO_INCIDENCIA: Record<string, TipoIncidencia> = {
  "Reportar daño o incidente": "dano_previo_relevante",
  "Reportar problema con un viaje": "contacto_no_localizado",
  "Ayuda con pagos o facturación": "documentacion_incompleta",
  "Dudas con evidencia fotográfica": "dano_no_reportado",
  "Cancelaciones o reprogramación": "contacto_no_localizado",
  "Consulta general u otro": "perdida_conectividad",
};

const HORARIO_SOPORTE = {
  dias: "Lunes a Viernes",
  horas: "8:00–20:00 (hora CDMX)",
  sla: "<30 min",
  slaFueraHorario: "<2 horas",
};

const CORREO_SOPORTE = "soporte@ruumruum.mx";

export function FormularioSoporte({ traslados, preseleccionado, emailUsuario }: Props) {
  const [motivo, setMotivo] = useState<string>(MOTIVOS[0] ?? "Otro");
  const [viajeId, setViajeId] = useState(preseleccionado ?? "");
  const [descripcion, setDescripcion] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [resultado, setResultado] = useState<{ ok: boolean; msg: string; folio?: string } | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (descripcion.trim().length < 10) {
      setResultado({ 
        ok: false, 
        msg: "Describe con al menos 10 caracteres para que podamos ayudarte." 
      });
      return;
    }
    setEnviando(true);
    setResultado(null);
    registrarEventoUx("soporte_enviado", { 
      motivo, 
      tiene_viaje: Boolean(viajeId),
      viaEmail: !tieneSupabaseConfigurado()
    });

    try {
      // Intento 1: Registro formal de incidencia en Supabase si hay viaje seleccionado
      if (tieneSupabaseConfigurado() && viajeId) {
        const cliente = crearClienteNavegador();
        const tipo: TipoIncidencia = MOTIVO_A_TIPO_INCIDENCIA[motivo] ?? "dano_previo_relevante";
        
        const data = await reportarIncidencia(
          cliente,
          viajeId,
          tipo,
          "durante_traslado",
          `[Soporte app-usuario] Motivo: ${motivo}\n\n${descripcion.trim()}`
        );

        const folio = `INC-${data.id.slice(0, 8).toUpperCase()}`;
        setResultado({ 
          ok: true, 
          msg: `¡Ticket e incidencia registrados en Torre de Control! Folio: ${folio}. Nuestro equipo dará seguimiento directo desde tu expediente en ${HORARIO_SOPORTE.sla} (${HORARIO_SOPORTE.dias} ${HORARIO_SOPORTE.horas}) o ${HORARIO_SOPORTE.slaFueraHorario} fuera de horario.`,
          folio
        });
        setDescripcion("");
        setMotivo(MOTIVOS[0]);
        setViajeId(preseleccionado ?? "");
        return;
      }

      // Fallback: mailto prellenado si es consulta general sin viaje asociado
      const subject = encodeURIComponent(`[Ruum Ruum Soporte] ${motivo}${viajeId ? ` · Viaje: ${viajeId.slice(0, 8).toUpperCase()}` : ""}`);
      const body = encodeURIComponent(
        `Motivo: ${motivo}\n` +
        `Viaje: ${viajeId || "Sin viaje vinculado (consulta general)"}\n` +
        `Correo usuario: ${emailUsuario || "No proporcionado"}\n\n` +
        `Descripción:\n${descripcion.trim()}\n\n` +
        `---\n` +
        `Enviado desde app-usuario Ruum Ruum\n` +
        `Horario soporte: ${HORARIO_SOPORTE.dias} ${HORARIO_SOPORTE.horas}\n` +
        `SLA: ${HORARIO_SOPORTE.sla} en horario, ${HORARIO_SOPORTE.slaFueraHorario} fuera de horario`
      );
      
      const mailtoUrl = `mailto:${CORREO_SOPORTE}?subject=${subject}&body=${body}`;
      
      if (typeof window !== "undefined" && window.location) {
        window.location.href = mailtoUrl;
      }
      
      setResultado({ 
        ok: true, 
        msg: `Abrimos tu cliente de correo con el mensaje prellenado. Si no se abrió automáticamente, escribe a ${CORREO_SOPORTE}. Respondemos en ${HORARIO_SOPORTE.sla} (${HORARIO_SOPORTE.dias} ${HORARIO_SOPORTE.horas}).`
      });
    } catch (err) {
      console.warn("[soporte] Error al reportar incidencia, recurriendo a mailto:", err);
      // Fallback a mailto si la inserción en base de datos fallara (por ejemplo, falta de conectividad o permisos)
      const subject = encodeURIComponent(`[Ruum Ruum Soporte] ${motivo}${viajeId ? ` · Viaje: ${viajeId.slice(0, 8).toUpperCase()}` : ""}`);
      const body = encodeURIComponent(
        `Motivo: ${motivo}\n` +
        `Viaje: ${viajeId || "—"}\n` +
        `Correo usuario: ${emailUsuario || "No proporcionado"}\n\n` +
        `Descripción:\n${descripcion.trim()}`
      );
      if (typeof window !== "undefined" && window.location) {
        window.location.href = `mailto:${CORREO_SOPORTE}?subject=${subject}&body=${body}`;
      }
      setResultado({
        ok: true,
        msg: `Abrimos tu cliente de correo para enviar tu reporte a ${CORREO_SOPORTE}. Nos pondremos en contacto contigo a la brevedad.`
      });
    } finally {
      setEnviando(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="grid gap-4 sm:grid-cols-2">
      {/* SLA y horario - SIEMPRE VISIBLE */}
      <div className="sm:col-span-2 rounded-xl border border-route/20 bg-route-soft/20 p-4">
        <div className="flex items-start gap-3">
          <svg className="size-6 text-route-action flex-shrink-0 mt-0.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
            <path d="m9 12 2 2 4-4"/>
          </svg>
          <div>
            <p className="font-body text-xs font-semibold uppercase tracking-wider text-route-dark">Atención al cliente</p>
            <p className="mt-1 font-body text-sm text-text-primary">
              <span className="font-bold">Horario:</span> {HORARIO_SOPORTE.dias} {HORARIO_SOPORTE.horas}
            </p>
            <p className="mt-0.5 font-body text-sm text-text-primary">
              <span className="font-bold">Tiempo de respuesta:</span> {HORARIO_SOPORTE.sla} en horario, {HORARIO_SOPORTE.slaFueraHorario} fuera de horario
            </p>
            <p className="mt-0.5 font-body text-xs text-text-tertiary">
              Correo: <span className="font-semibold text-text-primary">{CORREO_SOPORTE}</span>
            </p>
          </div>
        </div>
      </div>

      <label className="flex flex-col gap-1.5">
        <span className="font-body text-xs font-semibold uppercase tracking-wider text-text-tertiary">
          Motivo <span className="text-route-action">*</span>
        </span>
        <select 
          value={motivo} 
          onChange={(e) => setMotivo(e.target.value)} 
          className="w-full rounded-xl border border-border bg-surface px-3.5 py-2.5 font-body text-sm text-text-primary focus-visible:outline focus-visible:outline-[3px] focus-visible:outline-offset-1 focus-visible:outline-route-action"
          required
        >
          {MOTIVOS.map((m) => (
            <option key={m} value={m}>{m}</option>
          ))}
        </select>
      </label>

      <label className="flex flex-col gap-1.5">
        <span className="font-body text-xs font-semibold uppercase tracking-wider text-text-tertiary">
          Viaje relacionado <span className="text-text-tertiary">(opcional)</span>
        </span>
        <select 
          value={viajeId} 
          onChange={(e) => setViajeId(e.target.value)} 
          className="w-full rounded-xl border border-border bg-surface px-3.5 py-2.5 font-body text-sm text-text-primary focus-visible:outline focus-visible:outline-[3px] focus-visible:outline-offset-1 focus-visible:outline-route-action"
        >
          <option value="">Sin viaje / consulta general</option>
          {traslados.map((t) => (
            <option key={t.id} value={t.id}>{t.label}</option>
          ))}
        </select>
      </label>

      <label className="flex flex-col gap-1.5 sm:col-span-2">
        <span className="font-body text-xs font-semibold uppercase tracking-wider text-text-tertiary">
          Descripción <span className="text-route-action">*</span>
        </span>
        <textarea
          rows={5}
          value={descripcion}
          onChange={(e) => setDescripcion(e.target.value)}
          placeholder="Describe lo que pasó con detalle. Incluye: fecha, hora aproximada, ubicación, y cualquier evidencia relevante (fotos, testigos). Mientras más información proporciones, más rápido podremos resolver tu caso."
          className="w-full rounded-xl border border-border bg-surface px-3.5 py-2.5 font-body text-sm text-text-primary placeholder:text-text-tertiary focus-visible:outline focus-visible:outline-[3px] focus-visible:outline-offset-1 focus-visible:outline-route-action resize-none"
          required
          minLength={10}
          maxLength={1000}
        />
        <div className="flex justify-between items-center">
          <span className="font-body text-xs text-text-tertiary">
            {descripcion.length}/1000 caracteres
          </span>
          {descripcion.length > 0 && descripcion.length < 10 && (
            <span className="font-body text-xs text-warning">Mínimo 10 caracteres</span>
          )}
        </div>
      </label>

      <div className="sm:col-span-2">
        <Button 
          type="submit" 
          disabled={enviando || descripcion.trim().length < 10}
          className="w-full sm:w-auto"
        >
          {enviando ? "Enviando…" : "Enviar a soporte"}
        </Button>
        
        {/* Mensaje de éxito con folio destacado */}
        {resultado && (
          <div className="mt-4">
            {resultado.folio ? (
              <Aviso tono="info">
                <p className="font-body text-sm">
                  <span className="font-bold">¡Mensaje recibido con éxito!</span>
                  <br />
                  Folio: <span className="font-mono-ruum font-bold text-signal">{resultado.folio}</span>
                  <br />
                  {resultado.msg}
                </p>
              </Aviso>
            ) : (
              <Aviso tono={resultado.ok ? "info" : "danger"}>
                {resultado.msg}
              </Aviso>
            )}
          </div>
        )}
        
        {/* Ayuda adicional */}
        {!resultado && (
          <p className="mt-4 font-body text-xs leading-5 text-text-secondary">
            <span className="font-semibold text-text-primary">¿Necesitas ayuda inmediata?</span> 
            Si es una emergencia con daño o seguridad durante el traslado, usa el 
            <Link href={viajeId ? `/traslados/${viajeId}#chat-conductor` : "/mis-viajes"} className="font-semibold text-route-action underline-offset-2 hover:underline">
              chat del Pasaporte Digital
            </Link>.
          </p>
        )}
      </div>
    </form>
  );
}
