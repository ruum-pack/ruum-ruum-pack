"use client";

import { useRef, useState } from "react";
import { Button, Aviso, LogoMarca } from "@ruum/ui";
import type { Database } from "@ruum/shared/types";
import { traducirErrorOperativo } from "@ruum/shared/utils";
import { crearClienteNavegador } from "../../lib/supabase-browser";
import { subirDocumentoConductor, subirDocumentoSolicitudConductor, type TipoDocumentoConductor } from "@ruum/api/services";
import { enmascararNombreArchivo } from "../cuenta/datos-sensibles";

type DocumentoConductorRow = Database["public"]["Tables"]["documentos_conductor"]["Row"];

const ESTADO_DOCUMENTO: Record<string, { texto: string; clase: string }> = {
  pendiente: { texto: "Pendiente de carga", clase: "border-border bg-surface-elevated text-text-secondary" },
  en_revision: { texto: "En revisión", clase: "border-route-action bg-route-soft text-route-action" },
  aprobado: { texto: "Aprobado", clase: "border-success bg-control-soft text-success" },
  rechazado: { texto: "Rechazado", clase: "border-danger-action bg-danger-soft text-danger-action" },
  reemplazado: { texto: "Reemplazado", clase: "border-border bg-surface-elevated text-text-secondary" },
  vencido: { texto: "Vencido", clase: "border-danger-action bg-danger-soft text-danger-action" },
};

const TIPOS_DOCUMENTO: { valor: TipoDocumentoConductor; etiqueta: string }[] = [
  { valor: "licencia_frente", etiqueta: "Licencia - frente" },
  { valor: "licencia_reverso", etiqueta: "Licencia - reverso" },
  { valor: "identificacion_oficial", etiqueta: "Identificación oficial" }
];

const DOCUMENTO_FISCAL: { valor: TipoDocumentoConductor; etiqueta: string } = {
  valor: "documento_operativo",
  etiqueta: "Documento fiscal"
};

const ETIQUETA_EXPEDIENTE:Record<Database["public"]["Enums"]["estado_expediente_conductor"],string>={
  borrador:"Borrador",correo_pendiente:"Correo pendiente",datos_incompletos:"Datos incompletos",
  documentos_pendientes:"Documentos pendientes",listo_para_enviar:"Listo para enviar",en_revision:"En revisión",
  requiere_correccion:"Requiere corrección",aprobado:"Aprobado",rechazado:"Rechazado",suspendido:"Suspendido"
};

interface Props {
  conductorId?: string;
  solicitudId?: string;
  nombre: string;
  documentosIniciales: DocumentoConductorRow[];
  estadoExpediente:Database["public"]["Enums"]["estado_expediente_conductor"];
  enviadoEn?:string|null;
  onSalir: () => void;
}

/**
 * Fase 2 — reemplaza el callejón sin salida de "Solicitud en revisión → volver al acceso".
 * Muestra el estado real de cada documento (incluida la nota del admin si fue rechazado o
 * requiere corrección) y permite reemplazar solo ese documento específico, sin reiniciar
 * el resto del expediente.
 */
export function EstadoRevisionConductor({ conductorId, solicitudId, nombre, documentosIniciales,estadoExpediente,enviadoEn,onSalir }: Props) {
  const [documentos, setDocumentos] = useState(documentosIniciales);
  const [estadoActual,setEstadoActual]=useState(estadoExpediente);
  const [subiendo, setSubiendo] = useState<TipoDocumentoConductor | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [mensaje, setMensaje] = useState<string | null>(null);
  const inputsRef = useRef<Record<string, HTMLInputElement | null>>({});

  function documentoDe(tipo: TipoDocumentoConductor) {
    // El más reciente de ese tipo, por si hubo reemplazo previo.
    return documentos
      .filter((d) => d.tipo === tipo && d.es_actual)
      .sort((a, b) => new Date(b.creado_en).getTime() - new Date(a.creado_en).getTime())[0];
  }

  async function reemplazar(tipo: TipoDocumentoConductor, archivo: File) {
    setSubiendo(tipo);
    setError(null);
    setMensaje(null);
    try {
      const cliente = crearClienteNavegador();
      const documentoAnteriorId = documentoDe(tipo)?.id;
      if (solicitudId) await subirDocumentoSolicitudConductor(cliente, solicitudId, tipo, archivo, documentoAnteriorId);
      else if (conductorId) await subirDocumentoConductor(cliente, conductorId, tipo, archivo, documentoAnteriorId);
      else throw new Error("No encontramos el expediente asociado.");
      if(estadoActual==="requiere_correccion") setEstadoActual("documentos_pendientes");
      // El nuevo documento entra como "en_revision"; lo reflejamos localmente sin recargar todo.
      setDocumentos((prev) => [
        {
          id: `temp-${Date.now()}`,
          conductor_id: conductorId ?? null,
          solicitud_id: solicitudId ?? null,
          tipo,
          nombre_archivo: archivo.name,
          url: "",
          estado: "en_revision",
          notas_admin: null,
          version: (documentoDe(tipo)?.version ?? 0) + 1,
          documento_anterior_id: documentoAnteriorId ?? null,
          es_actual: true,
          reemplazado_en: null,
          revisado_por: null,
          revisado_en: null,
          motivo_rechazo: null,
          creado_en: new Date().toISOString(),
          actualizado_en: new Date().toISOString()
        },
        ...prev.map((documento)=>documento.id===documentoAnteriorId?{
          ...documento,estado:"reemplazado",es_actual:false,reemplazado_en:new Date().toISOString(),actualizado_en:new Date().toISOString()
        }:documento)
      ]);
      setMensaje("Documento actualizado. Volvió a revisión y te avisaremos cuando cambie el estado.");
    } catch (err) {
      setError(traducirErrorOperativo(err,"No pudimos registrar el documento corregido. Intenta nuevamente."));
    } finally {
      setSubiendo(null);
    }
  }

  const todosAprobados = TIPOS_DOCUMENTO.every((t) => documentoDe(t.valor)?.estado === "aprobado");
  const documentoFiscal = documentoDe(DOCUMENTO_FISCAL.valor);
  const documentosRequeridos = documentoFiscal ? [...TIPOS_DOCUMENTO, DOCUMENTO_FISCAL] : TIPOS_DOCUMENTO;
  const actuales=TIPOS_DOCUMENTO.map((tipo)=>documentoDe(tipo.valor)).filter(Boolean);
  const documentosActuales=[...actuales, documentoFiscal].filter(Boolean);
  const rechazados=documentosActuales.filter((documento)=>documento?.estado==="rechazado"||documento?.estado==="vencido").length;
  const pendientes=TIPOS_DOCUMENTO.filter((tipo)=>!documentoDe(tipo.valor)).length;
  const cuentaAprobada = !["borrador", "correo_pendiente"].includes(estadoActual);
  const documentosAprobados = documentosRequeridos.filter((tipo)=>documentoDe(tipo.valor)?.estado==="aprobado").length;
  const totalRequisitos = documentosRequeridos.length + 1;
  const requisitosListos = documentosAprobados + (cuentaAprobada ? 1 : 0);
  const gruposDocumentales = [
    {
      titulo: "Licencia",
      descripcion: "Frente y reverso de tu licencia de conducir.",
      documentos: TIPOS_DOCUMENTO.filter((tipo)=>tipo.valor==="licencia_frente"||tipo.valor==="licencia_reverso")
    },
    {
      titulo: "Identidad",
      descripcion: "Documento oficial para validar tu identidad.",
      documentos: TIPOS_DOCUMENTO.filter((tipo)=>tipo.valor==="identificacion_oficial")
    },
    ...(documentoFiscal ? [{
      titulo: "Documento fiscal",
      descripcion: "Documento requerido para completar tu expediente operativo.",
      documentos: [DOCUMENTO_FISCAL]
    }] : [])
  ];
  const porcentaje = Math.round((requisitosListos / totalRequisitos) * 100);
  const motivoBloqueo = rechazados > 0
    ? `Hay ${rechazados} documento${rechazados === 1 ? "" : "s"} que requieren actualización.`
    : pendientes > 0
      ? `Faltan ${pendientes} documento${pendientes === 1 ? "" : "s"} obligatorio${pendientes === 1 ? "" : "s"} por cargar.`
      : todosAprobados
        ? "Tus documentos están aprobados; falta la activación final de operación."
        : "Operación está revisando la información enviada.";

  return (
    <div className="conductor-auth-shell flex items-center justify-center px-4 py-10 sm:px-6">
      <section className="conductor-auth-card p-6 sm:p-8" aria-labelledby="titulo-estado-revision">
        <div className="flex items-center gap-3">
          <LogoMarca tamano={34} color="signal" />
          <div>
            <p className="font-display text-lg font-extrabold tracking-tight text-text-primary">
              ruum<span className="text-signal">ruum</span>
            </p>
            <p className="font-body text-xs font-semibold text-text-tertiary">ruum by Movilia</p>
          </div>
        </div>

        <p className="mt-8 font-body text-sm text-text-secondary">Hola, {nombre}</p>
        <h1 id="titulo-estado-revision" className="mt-1 font-display text-2xl font-bold text-text-primary">
          Tu solicitud está en revisión
        </h1>
        <p className="mt-2 font-body text-sm leading-6 text-text-secondary">
          No puedes recibir viajes porque tus documentos están siendo revisados.
        </p>
        <div className="mt-5 rounded-xl border border-border bg-surface p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="font-body text-xs text-text-tertiary">Progreso de revisión</p>
              <p className="mt-1 font-body text-sm font-semibold text-text-primary">{requisitosListos} de {totalRequisitos} requisitos listos</p>
            </div>
            <div className="text-left sm:text-right">
              <p className="font-body text-xs text-text-tertiary">Tiempo estimado</p>
              <p className="mt-1 font-body text-sm font-semibold text-text-primary">{rechazados > 0 ? "Se actualiza al corregir" : "24 a 48 horas hábiles"}</p>
            </div>
          </div>
          <div className="mt-3 h-2 overflow-hidden rounded-full bg-surface-elevated" aria-hidden>
            <div className="h-full rounded-full bg-signal" style={{ width: `${porcentaje}%` }} />
          </div>
          <div className="mt-3 grid gap-2 font-body text-xs text-text-secondary sm:grid-cols-2">
            <p>Estado actual: <span className="font-semibold text-text-primary">{ETIQUETA_EXPEDIENTE[estadoActual]}</span></p>
            <p>Enviado: <span className="font-semibold text-text-primary">{enviadoEn?new Date(enviadoEn).toLocaleString("es-MX"):"Aún no disponible"}</span></p>
          </div>
        </div>
        <div className="mt-4"><Aviso tono={rechazados > 0 ? "atencion" : "info"}>{motivoBloqueo}</Aviso></div>

        {error && (
          <output className="mt-4" aria-live="polite" aria-atomic="true">
            <Aviso tono="danger">{error}</Aviso>
          </output>
        )}
        {mensaje && (
          <output className="mt-4" aria-live="polite" aria-atomic="true">
            <Aviso tono="info">{mensaje}</Aviso>
          </output>
        )}

        <div className="mt-6 space-y-3" aria-label="Estado documental">
          <div className="rounded-xl border border-border p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="font-body text-sm font-semibold text-text-primary">Cuenta</p>
              <span className={`rounded-full border px-2.5 py-1 font-body text-xs font-medium ${cuentaAprobada ? ESTADO_DOCUMENTO.aprobado.clase : ESTADO_DOCUMENTO.pendiente.clase}`}>
                {cuentaAprobada ? "Correo confirmado" : "Pendiente"}
              </span>
            </div>
            <p className="mt-1 font-body text-xs leading-5 text-text-secondary">
              {cuentaAprobada ? "Correo confirmado y solicitud recibida." : "Confirma tu correo para continuar."}
            </p>
          </div>

          {gruposDocumentales.map((grupo) => (
            <div key={grupo.titulo} className="rounded-xl border border-border p-4">
              <div>
                <p className="font-body text-sm font-semibold text-text-primary">{grupo.titulo}</p>
                <p className="mt-1 font-body text-xs leading-5 text-text-secondary">{grupo.descripcion}</p>
              </div>
              <div className="mt-3 grid gap-3">
                {grupo.documentos.map((t) => {
                  const doc = documentoDe(t.valor);
                  const estadoInfo = ESTADO_DOCUMENTO[doc?.estado ?? "pendiente"];
                  const requiereAccion = doc?.estado === "rechazado" || doc?.estado === "vencido";

                  return (
                    <div key={t.valor} className="rounded-lg border border-border bg-surface-elevated p-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="font-body text-sm font-semibold text-text-primary">{t.etiqueta}</p>
                        <span className={`rounded-full border px-2.5 py-1 font-body text-xs font-medium ${estadoInfo.clase}`}>
                          {estadoInfo.texto}
                        </span>
                      </div>
                      {doc?.nombre_archivo && <p className="mt-1 font-body text-xs text-text-tertiary">{enmascararNombreArchivo(doc.nombre_archivo)}</p>}

                      {(doc?.motivo_rechazo||doc?.notas_admin) && (
                        <p className="mt-2 rounded-lg bg-warn-soft px-3 py-2 font-body text-sm text-warning">
                          Motivo: {doc.motivo_rechazo??doc.notas_admin}
                        </p>
                      )}

                      {requiereAccion && (
                        <div className="mt-3">
                          <input
                            ref={(el) => { inputsRef.current[t.valor] = el; }}
                            type="file"
                            accept="image/*,.pdf"
                            capture="environment"
                            className="hidden"
                            onChange={(e) => {
                              const archivo = e.target.files?.[0];
                              if (archivo) void reemplazar(t.valor, archivo);
                              e.target.value = "";
                            }}
                          />
                          <Button
                            variant="secondary"
                            onClick={() => inputsRef.current[t.valor]?.click()}
                            disabled={subiendo === t.valor}
                          >
                            {subiendo === t.valor ? "Subiendo…" : "Actualizar documento"}
                          </Button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        <div className="mt-6 rounded-xl border border-route-action bg-route-soft p-4">
          <p className="font-body text-sm font-semibold text-text-primary">Te avisaremos cuando cambie el estado</p>
          <p className="mt-1 font-body text-xs leading-5 text-text-secondary">
            Si actualizas un documento, volverá a aparecer como &quot;En revisión&quot;.
          </p>
        </div>

        <Button variant="quiet" className="mt-7" onClick={onSalir}>
          Cerrar sesión
        </Button>
      </section>
    </div>
  );
}
