"use client";
import { Aviso, Button } from "@ruum/ui";
import { MENSAJES_CLAVE_UX } from "@ruum/shared/constants";
import { RegistroViajeActivo } from "../../../ViajeActivoContext";
import { EvidenceCaptureStep } from "./EvidenceCaptureStep";
import { EvidenceChecklist } from "./EvidenceChecklist";
import { EvidenceReview } from "./EvidenceReview";
import { EvidenceSyncStatus } from "./EvidenceSyncStatus";
import { useEvidenceWizard } from "./EvidenceContext";
import {
  CAMPOS_INSPECCION_OBLIGATORIOS,
  OPCIONES_COMBUSTIBLE,
  OPCIONES_LLAVES,
  OPCIONES_SI_NO
} from "./evidence-requirements";

function CampoTexto({
  etiqueta,
  valor,
  onChange,
  tipo = "text"
}: {
  etiqueta: string;
  valor: string;
  onChange: (valor: string) => void;
  tipo?: "text" | "number";
}) {
  return (
    <label className="grid gap-1">
      <span className="font-body text-sm font-semibold text-text-tertiary">{etiqueta}</span>
      <input
        type={tipo}
        value={valor}
        onChange={(event) => onChange(event.target.value)}
        className="min-h-11 rounded-lg border border-border bg-surface px-3 font-body text-base text-text-primary outline-none focus:border-signal"
      />
    </label>
  );
}

function CampoSiNo({
  etiqueta,
  valor,
  onChange
}: {
  etiqueta: string;
  valor: "" | "si" | "no";
  onChange: (valor: "" | "si" | "no") => void;
}) {
  return (
    <label className="grid gap-1">
      <span className="font-body text-sm font-semibold text-text-tertiary">{etiqueta}</span>
      <select
        value={valor}
        onChange={(event) => onChange(event.target.value as "" | "si" | "no")}
        className="min-h-11 rounded-lg border border-border bg-surface px-3 font-body text-base text-text-primary outline-none focus:border-signal"
      >
        <option value="">Selecciona</option>
        <option value="si">Sí</option>
        <option value="no">No</option>
      </select>
    </label>
  );
}

function CampoSelect({
  etiqueta,
  valor,
  opciones,
  onChange
}: {
  etiqueta: string;
  valor: string;
  opciones: Array<string | { valor: string; etiqueta: string }>;
  onChange: (valor: string) => void;
}) {
  return (
    <label className="grid gap-1">
      <span className="font-body text-sm font-semibold text-text-tertiary">{etiqueta}</span>
      <select
        value={valor}
        onChange={(event) => onChange(event.target.value)}
        className="min-h-11 rounded-lg border border-border bg-surface px-3 font-body text-base text-text-primary outline-none focus:border-signal"
      >
        <option value="">Selecciona</option>
        {opciones.map((opcion) => {
          const valorOpcion = typeof opcion === "string" ? opcion : opcion.valor;
          const etiquetaOpcion = typeof opcion === "string" ? opcion : opcion.etiqueta;
          return (
            <option key={valorOpcion} value={valorOpcion}>
              {etiquetaOpcion}
            </option>
          );
        })}
      </select>
    </label>
  );
}

export function EvidenciaStepper() {
  const {
    progresoTotal,
    requisitosTotales,
    tipo,
    pasoActivo,
    requisitos,
    setPasoActivo
  } = useEvidenceWizard();

  return (
    <div className="flex items-start justify-between gap-4">
      <div>
        <p className="font-body text-sm font-semibold text-route-action">
          {progresoTotal} de {requisitosTotales}
        </p>
        <h1 className="mt-1 font-display text-2xl font-semibold">
          Registro {tipo === "inicial" ? "inicial" : "final"} del vehículo
        </h1>
        <p className="mt-2 font-body text-sm text-text-secondary">
          {tipo === "inicial"
            ? `${MENSAJES_CLAVE_UX.evidencia_inicial} Sigue una foto a la vez.`
            : "Registra el estado del vehículo en el punto de entrega, una foto a la vez."}
        </p>
      </div>
      <Button variant="secondary" onClick={() => setPasoActivo(requisitos.length)}>
        Revisar
      </Button>
    </div>
  );
}

export function EvidenciaInspeccion() {
  const { inspeccion, camposInspeccionPendientes, inspeccionCompletada, enviando, setInspeccion, onSaveInspection } = useEvidenceWizard();

  return (
    <section className="mt-6 rounded-xl border border-border bg-surface p-4" aria-labelledby="datos-inspeccion-titulo">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 id="datos-inspeccion-titulo" className="font-body text-sm font-semibold text-text-primary">Datos de inspección</h2>
          <p className="mt-1 font-body text-xs text-text-secondary">
            {inspeccionCompletada} de {CAMPOS_INSPECCION_OBLIGATORIOS.length} obligatorios
            {camposInspeccionPendientes.length > 0 ? ` · faltan ${camposInspeccionPendientes.length}` : " · completos"}
          </p>
        </div>
        <span className={[
          "rounded-full border px-2.5 py-1 font-body text-xs font-semibold",
          camposInspeccionPendientes.length > 0
            ? "border-warning bg-warn-soft text-warning"
            : "border-success bg-control-soft text-success"
        ].join(" ")}>
          {camposInspeccionPendientes.length > 0 ? "Pendiente" : "Listo"}
        </span>
      </div>

      <div className="mt-4 grid gap-3 border-t border-border pt-4 sm:grid-cols-2">
        <CampoSelect
          etiqueta="Combustible *"
          valor={inspeccion.combustible}
          opciones={OPCIONES_COMBUSTIBLE}
          onChange={(valor) => setInspeccion((actual) => ({ ...actual, combustible: valor }))}
        />
        <CampoTexto
          etiqueta="Kilometraje *"
          tipo="number"
          valor={inspeccion.kilometraje}
          onChange={(valor) => setInspeccion((actual) => ({ ...actual, kilometraje: valor }))}
        />
        <CampoSelect
          etiqueta="Llaves recibidas *"
          valor={inspeccion.llavesRecibidas}
          opciones={OPCIONES_LLAVES}
          onChange={(valor) => setInspeccion((actual) => ({ ...actual, llavesRecibidas: valor }))}
        />
        <CampoSiNo
          etiqueta="Holograma de verificación *"
          valor={inspeccion.hologramaVerificacion}
          onChange={(valor) => setInspeccion((actual) => ({ ...actual, hologramaVerificacion: valor }))}
        />
        <CampoSelect etiqueta="Talón de verificación *" valor={inspeccion.talonVerificacion} opciones={OPCIONES_SI_NO} onChange={(valor) => setInspeccion((actual) => ({ ...actual, talonVerificacion: valor }))} />
        <CampoSelect etiqueta="Tarjeta de circulación *" valor={inspeccion.tarjetaCirculacion} opciones={OPCIONES_SI_NO} onChange={(valor) => setInspeccion((actual) => ({ ...actual, tarjetaCirculacion: valor }))} />
        <CampoSelect etiqueta="Placa delantera *" valor={inspeccion.placaDelantera} opciones={OPCIONES_SI_NO} onChange={(valor) => setInspeccion((actual) => ({ ...actual, placaDelantera: valor }))} />
        <CampoSelect etiqueta="Placa trasera *" valor={inspeccion.placaTrasera} opciones={OPCIONES_SI_NO} onChange={(valor) => setInspeccion((actual) => ({ ...actual, placaTrasera: valor }))} />
        <label className="grid gap-1 sm:col-span-2">
          <span className="font-body text-sm font-semibold text-text-tertiary">Notas o comentarios <span className="font-normal">(opcional)</span></span>
          <textarea
            value={inspeccion.notas}
            onChange={(event) => setInspeccion((actual) => ({ ...actual, notas: event.target.value }))}
            rows={3}
            className="rounded-lg border border-border bg-surface px-3 py-2 font-body text-base text-text-primary outline-none focus:border-signal"
          />
        </label>
        <Button variant="secondary" onClick={onSaveInspection} loading={enviando === "inspeccion"}>
          Guardar inspección
        </Button>
      </div>
    </section>
  );
}

export function EvidenceWizard() {
  const {
    trasladoId,
    estadoActual,
    pasaporteActual,
    tipo,
    aviso,
    resultado,
    inputArchivoRef,
    onArchivoSeleccionado
  } = useEvidenceWizard();

  return (
    <div className="mx-auto w-full max-w-2xl px-6 py-12">
      <RegistroViajeActivo
        viaje={
          estadoActual
            ? {
                trasladoId,
                estado: estadoActual,
                origenDireccion: pasaporteActual?.origen_direccion,
                origenCiudad: pasaporteActual?.origen_ciudad,
                destinoDireccion: pasaporteActual?.destino_direccion,
                destinoCiudad: pasaporteActual?.destino_ciudad
              }
            : null
        }
      />
      <EvidenciaStepper />
      <EvidenceChecklist />
      {aviso && (
        <div className="mt-4">
          <Aviso tono={resultado.completa ? "info" : "atencion"}>{aviso}</Aviso>
        </div>
      )}
      <div className="mt-4">
        <EvidenceSyncStatus />
      </div>
      <input
        ref={inputArchivoRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(event) => onArchivoSeleccionado(event.target.files?.[0])}
      />
      <EvidenciaCaptureORReview />
      <EvidenciaInspeccion />
    </div>
  );
}

function EvidenciaCaptureORReview() {
  const {
    pasoEsRevision,
    requisitoActivo,
    pasoActivo,
    requisitos,
    fotoPorAngulo,
    noAplica,
    enviando,
    onCapture,
    onGallery,
    setNoAplica,
    setPasoActivo
  } = useEvidenceWizard();

  if (pasoEsRevision) {
    return <EvidenceReview />;
  }

  return (
    <EvidenceCaptureStep
      item={requisitoActivo}
      step={pasoActivo + 1}
      total={requisitos.length}
      foto={fotoPorAngulo(requisitoActivo.angulo)}
      noAplica={noAplica.has(requisitoActivo.angulo)}
      busy={enviando === requisitoActivo.angulo}
      onCapture={() => onCapture(requisitoActivo.angulo)}
      onGallery={() => onGallery(requisitoActivo.angulo)}
      onNoAplica={(checked) => {
        if (!requisitoActivo.permiteNoAplica) return;
        setNoAplica((actual) => {
          const siguiente = new Set(actual);
          if (checked) siguiente.add(requisitoActivo.angulo);
          else siguiente.delete(requisitoActivo.angulo);
          return siguiente;
        });
      }}
    />
  );
}
