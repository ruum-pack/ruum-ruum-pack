"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Button, Aviso, PassportCard } from "@ruum/ui";
import { GLOSARIO_OPERATIVO, MENSAJE_EVIDENCIA_SINCRONIZANDO, MENSAJES_CLAVE_UX, TEXTOS_CARGANDO } from "@ruum/shared/constants";
import { evidenciaCompleta } from "@ruum/shared/rules";
import type { AnguloEvidencia, FotoEvidencia, TipoEvidencia } from "@ruum/shared/types";
import type { Database } from "@ruum/shared/types";
import { crearClienteNavegador, tieneSupabaseConfigurado } from "../../../../lib/supabase-browser";
import { esNativo } from "../../../../lib/capacitor";
import { capturarFoto, seleccionarFotoGaleria } from "../../../../lib/camara";
import { obtenerUbicacionActual } from "../../../../lib/ubicacion";
import {
  contarColaEvidencia,
  encolarEvidencia,
  leerColaEvidenciaDeTraslado,
  sincronizarColaEvidencia
} from "../../../../lib/cola-offline";
import {
  obtenerPasaporteDigital,
  obtenerEvidenciaDeTraslado,
  confirmarEvidenciaCompleta
} from "@ruum/api/services";
import { RegistroViajeActivo } from "../../../ViajeActivoContext";

type EstadoTraslado = Database["public"]["Enums"]["estado_traslado"];
type PasaporteRow = Database["public"]["Views"]["pasaporte_digital"]["Row"];

type EvidenceRequirement = {
  angulo: AnguloEvidencia;
  titulo: string;
  instruccion: string;
  guia: string;
  obligatorio: boolean;
  permiteNoAplica: boolean;
};

interface InspeccionEvidencia {
  combustible: string;
  kilometraje: string;
  llavesRecibidas: string;
  hologramaVerificacion: "" | "si" | "no";
  talonVerificacion: string;
  tarjetaCirculacion: string;
  placaDelantera: string;
  placaTrasera: string;
  notas: string;
}

const INSPECCION_INICIAL: InspeccionEvidencia = {
  combustible: "",
  kilometraje: "",
  llavesRecibidas: "",
  hologramaVerificacion: "",
  talonVerificacion: "",
  tarjetaCirculacion: "",
  placaDelantera: "",
  placaTrasera: "",
  notas: ""
};

const OPCIONES_COMBUSTIBLE = ["R", "1/8", "1/4", "3/8", "1/2", "3/4", "1/1"];
const OPCIONES_LLAVES = ["1", "2", "3"];
const OPCIONES_SI_NO = [
  { valor: "si", etiqueta: "Sí" },
  { valor: "no", etiqueta: "No" }
];

const ETIQUETA_ANGULO: Record<AnguloEvidencia, string> = {
  frente: "Frente",
  lado_piloto: "Lado piloto",
  lado_copiloto: "Lado copiloto",
  trasera: "Trasera",
  tablero: "Tablero",
  dano_previo: "Daño previo",
  adicional: "Adicional"
};

function listaEvidenciaObligatoria(tipo: TipoEvidencia): EvidenceRequirement[] {
  const prefijo = tipo === "inicial" ? "antes de moverlo" : "antes de entregar";
  return [
    {
      angulo: "frente",
      titulo: "Frente",
      instruccion: `Toma el vehículo completo de frente ${prefijo}. Incluye placas y defensa.`,
      guia: "Alinea la defensa dentro del marco.",
      obligatorio: true,
      permiteNoAplica: false
    },
    {
      angulo: "lado_piloto",
      titulo: "Lado piloto",
      instruccion: "Captura todo el costado del conductor, de espejo a defensa trasera.",
      guia: "Coloca el vehículo horizontal dentro de la silueta.",
      obligatorio: true,
      permiteNoAplica: false
    },
    {
      angulo: "lado_copiloto",
      titulo: "Lado copiloto",
      instruccion: "Captura todo el costado del copiloto, sin cortar defensas ni llantas.",
      guia: "Deja aire alrededor de las cuatro llantas.",
      obligatorio: true,
      permiteNoAplica: false
    },
    {
      angulo: "trasera",
      titulo: "Trasera",
      instruccion: "Toma la parte trasera completa. Incluye placas, cajuela y defensa.",
      guia: "Centra la placa y la defensa.",
      obligatorio: true,
      permiteNoAplica: false
    },
    {
      angulo: "tablero",
      titulo: "Tablero",
      instruccion: "Captura el tablero con kilometraje visible y sin reflejos fuertes.",
      guia: "El odómetro debe quedar legible.",
      obligatorio: true,
      permiteNoAplica: false
    },
    {
      angulo: "dano_previo",
      titulo: tipo === "inicial" ? "Daños preexistentes" : "Daños visibles",
      instruccion:
        tipo === "inicial"
          ? "Registra golpes, rayones o piezas dañadas antes de iniciar el traslado."
          : "Registra cualquier cambio visible detectado al llegar al destino.",
      guia: "Acércate al daño y toma una foto clara.",
      obligatorio: false,
      permiteNoAplica: true
    }
  ];
}

function fotoSrc(foto?: FotoEvidencia) {
  return foto?.local_path || foto?.url || null;
}

// PRD §4.4 — tipo de evidencia según en qué punto del flujo está el viaje.
function tipoEvidenciaPorEstado(estado: EstadoTraslado): TipoEvidencia | null {
  if (estado === "verificacion_vehiculo_en_proceso" || estado === "evidencia_inicial_en_proceso") return "inicial";
  if (estado === "llegada_a_destino" || estado === "evidencia_final_en_proceso") return "final";
  return null;
}

function IconoCheck() {
  return (
    <svg viewBox="0 0 20 20" className="size-4 shrink-0" aria-hidden>
      <circle cx="10" cy="10" r="9" fill="currentColor" />
      <path d="M6 10.2 8.6 13 14.2 7" fill="none" stroke="white" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
    </svg>
  );
}

function IconoReloj() {
  return (
    <svg viewBox="0 0 20 20" className="size-4 shrink-0" aria-hidden>
      <circle cx="10" cy="10" r="8" fill="none" stroke="currentColor" strokeWidth="2" />
      <path d="M10 5.8v4.6l3 1.8" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
    </svg>
  );
}

function BadgeSincronizacion({ sincronizada }: { sincronizada: boolean }) {
  return (
    <span
      className={[
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1",
        "font-body text-xs font-semibold",
        sincronizada ? "border-success bg-control-soft text-success" : "border-warning bg-warn-soft text-warning"
      ].join(" ")}
    >
      {sincronizada ? <IconoCheck /> : <IconoReloj />}
      {sincronizada ? "Sincronizada" : "Pendiente de subir"}
    </span>
  );
}

function EvidenceChecklist({
  items,
  activeIndex,
  statusFor,
  onSelect
}: {
  items: EvidenceRequirement[];
  activeIndex: number;
  statusFor: (item: EvidenceRequirement) => "listo" | "pendiente" | "omitido";
  onSelect: (index: number) => void;
}) {
  return (
    <nav aria-label="Checklist de evidencia" className="mt-5 grid grid-cols-3 gap-2 sm:grid-cols-6">
      {items.map((item, index) => {
        const status = statusFor(item);
        const active = activeIndex === index;
        return (
          <button
            key={item.angulo}
            type="button"
            onClick={() => onSelect(index)}
            className={[
              "min-h-14 rounded-xl border px-2 py-2 text-left transition",
              active ? "border-route-action bg-route-soft" : "border-border bg-surface",
              status === "listo" ? "text-success" : status === "omitido" ? "text-text-tertiary" : "text-text-primary"
            ].join(" ")}
          >
            <span className="block font-body text-xs font-semibold">{index + 1}</span>
            <span className="mt-1 block truncate font-body text-xs font-semibold">{item.titulo}</span>
          </button>
        );
      })}
    </nav>
  );
}

function VehicleSilhouette({ label }: { label: string }) {
  return (
    <div className="relative flex h-44 items-center justify-center overflow-hidden rounded-2xl border border-dashed border-route-action bg-route-soft">
      <div className="absolute inset-x-8 top-1/2 h-16 -translate-y-1/2 rounded-[40px] border-2 border-route-action/70" />
      <div className="absolute left-[25%] top-[calc(50%+22px)] size-8 rounded-full border-2 border-route-action/70 bg-surface" />
      <div className="absolute right-[25%] top-[calc(50%+22px)] size-8 rounded-full border-2 border-route-action/70 bg-surface" />
      <p className="relative max-w-[220px] text-center font-body text-sm font-semibold text-route-action">{label}</p>
    </div>
  );
}

function EvidencePreview({
  foto,
  onRepeat,
  disabled
}: {
  foto?: FotoEvidencia;
  onRepeat: () => void;
  disabled?: boolean;
}) {
  const src = fotoSrc(foto);
  if (!foto || !src) return null;

  return (
    <div className="mt-4 overflow-hidden rounded-2xl border border-border bg-surface">
      {/* eslint-disable-next-line @next/next/no-img-element -- la foto puede estar en dataUrl local offline. */}
      <img src={src} alt="Vista previa de la evidencia capturada" className="h-52 w-full object-cover" />
      <div className="flex items-center justify-between gap-3 px-3 py-3">
        <BadgeSincronizacion sincronizada={Boolean(foto.sincronizada)} />
        <Button variant="secondary" onClick={onRepeat} disabled={disabled}>
          Repetir
        </Button>
      </div>
    </div>
  );
}

function EvidenceCaptureStep({
  item,
  step,
  total,
  foto,
  noAplica,
  busy,
  onCapture,
  onGallery,
  onNoAplica
}: {
  item: EvidenceRequirement;
  step: number;
  total: number;
  foto?: FotoEvidencia;
  noAplica: boolean;
  busy: boolean;
  onCapture: () => void;
  onGallery: () => void;
  onNoAplica: (checked: boolean) => void;
}) {
  return (
    <PassportCard className="mt-5">
      <p className="font-body text-sm font-semibold text-route-action">
        {step} de {total}
      </p>
      <h2 className="mt-2 font-display text-2xl font-semibold">{item.titulo}</h2>
      <p className="mt-2 font-body text-base leading-7 text-text-secondary">{item.instruccion}</p>
      <div className="mt-4">
        <VehicleSilhouette label={item.guia} />
      </div>
      <EvidencePreview foto={foto} onRepeat={onCapture} disabled={busy} />
      {item.permiteNoAplica && (
        <label className="mt-4 flex min-h-11 items-center gap-3 rounded-xl border border-border bg-surface-elevated px-3 py-2 font-body text-sm font-semibold">
          <input type="checkbox" checked={noAplica} onChange={(event) => onNoAplica(event.target.checked)} className="size-4 accent-route" />
          No aplica
        </label>
      )}
      <div className="mt-4 grid gap-2 sm:grid-cols-2">
        <Button onClick={onCapture} loading={busy}>
          {foto ? "Repetir foto" : "Tomar foto"}
        </Button>
        <Button variant="secondary" onClick={onGallery} loading={busy}>
          Elegir de galería
        </Button>
      </div>
    </PassportCard>
  );
}

function EvidenceSyncStatus({
  pendientesSubida,
  sincronizando,
  missing,
  complete
}: {
  pendientesSubida: number;
  sincronizando: boolean;
  missing: string[];
  complete: boolean;
}) {
  if (pendientesSubida > 0) {
    return (
      <Aviso tono="atencion">
        {pendientesSubida} foto{pendientesSubida === 1 ? "" : "s"} pendiente{pendientesSubida === 1 ? "" : "s"} de subir.
        {sincronizando ? ` ${MENSAJE_EVIDENCIA_SINCRONIZANDO}.` : " Puedes completar el flujo offline; el envío se habilita al sincronizar."}
      </Aviso>
    );
  }

  if (!complete) {
    return <Aviso tono="atencion">Falta: {missing.join(", ")}.</Aviso>;
  }

  return <Aviso tono="info">Registro completo y sincronizado. Revisa antes de enviar.</Aviso>;
}

function EvidenceReview({
  items,
  fotos,
  noAplica,
  resultado,
  pendientesSubida,
  sincronizando,
  inspeccion,
  enviando,
  onBackToMissing,
  onConfirm
}: {
  items: EvidenceRequirement[];
  fotos: FotoEvidencia[];
  noAplica: Set<AnguloEvidencia>;
  resultado: ReturnType<typeof evidenciaCompleta>;
  pendientesSubida: number;
  sincronizando: boolean;
  inspeccion: InspeccionEvidencia;
  enviando: boolean;
  onBackToMissing: () => void;
  onConfirm: () => void;
}) {
  const missingLabels = resultado.angulosFaltantes.map((angulo) => ETIQUETA_ANGULO[angulo as AnguloEvidencia] ?? angulo);
  const blocked = !resultado.completa || pendientesSubida > 0;

  return (
    <PassportCard className="mt-5">
      <p className="font-body text-sm font-semibold text-route-action">Revisión final</p>
      <h2 className="mt-2 font-display text-2xl font-semibold">Confirma el registro completo</h2>
      <div className="mt-4">
        <EvidenceSyncStatus pendientesSubida={pendientesSubida} sincronizando={sincronizando} missing={missingLabels} complete={resultado.completa} />
      </div>
      <div className="mt-5 grid gap-3">
        {items.map((item) => {
          const foto = fotos.find((candidate) => candidate.angulo === item.angulo);
          const omitted = noAplica.has(item.angulo);
          return (
            <div key={item.angulo} className="flex items-center justify-between gap-3 rounded-xl border border-border bg-surface-elevated px-3 py-3">
              <div>
                <p className="font-body text-sm font-semibold">{item.titulo}</p>
                <p className="font-body text-xs text-text-tertiary">{item.obligatorio ? "Obligatoria" : "Opcional"}</p>
              </div>
              {foto ? <BadgeSincronizacion sincronizada={Boolean(foto.sincronizada)} /> : <span className="font-body text-xs text-text-tertiary">{omitted ? "No aplica" : "Falta"}</span>}
            </div>
          );
        })}
      </div>
      <details className="mt-5 rounded-xl border border-border bg-surface">
        <summary className="cursor-pointer px-4 py-3 font-body text-sm font-semibold">Datos de inspección</summary>
        <dl className="grid gap-2 border-t border-border px-4 py-3 font-body text-sm sm:grid-cols-2">
          <div><dt className="text-text-tertiary">Combustible</dt><dd>{inspeccion.combustible || "Sin capturar"}</dd></div>
          <div><dt className="text-text-tertiary">Kilometraje</dt><dd>{inspeccion.kilometraje || "Sin capturar"}</dd></div>
          <div><dt className="text-text-tertiary">Llaves</dt><dd>{inspeccion.llavesRecibidas || "Sin capturar"}</dd></div>
          <div><dt className="text-text-tertiary">Notas</dt><dd>{inspeccion.notas || "Sin notas"}</dd></div>
        </dl>
      </details>
      <div className="mt-5 grid gap-2 sm:grid-cols-2">
        <Button variant="secondary" onClick={onBackToMissing}>
          Revisar faltantes
        </Button>
        <Button onClick={onConfirm} disabled={blocked} loading={enviando}>
          {enviando ? TEXTOS_CARGANDO.confirmando : "Enviar registro"}
        </Button>
      </div>
    </PassportCard>
  );
}

function archivoADataUrl(archivo: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("No pudimos leer la imagen seleccionada."));
    reader.readAsDataURL(archivo);
  });
}

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

export default function PaginaEvidencia() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const inputArchivoRef = useRef<HTMLInputElement | null>(null);
  const anguloArchivoRef = useRef<AnguloEvidencia | null>(null);

  const [estadoActual, setEstadoActual] = useState<EstadoTraslado | null>(null);
  const [pasaporteActual, setPasaporteActual] = useState<PasaporteRow | null>(null);
  const [tipo, setTipo] = useState<TipoEvidencia | null>(null);
  const [fotos, setFotos] = useState<FotoEvidencia[]>([]);
  const [inspeccion, setInspeccion] = useState<InspeccionEvidencia>(INSPECCION_INICIAL);
  const [cargando, setCargando] = useState(true);
  const [mostrarSkeleton, setMostrarSkeleton] = useState(true);
  const [enviando, setEnviando] = useState<AnguloEvidencia | "confirmar" | "inspeccion" | null>(null);
  const [sincronizando, setSincronizando] = useState(false);
  const [pendientesSubida, setPendientesSubida] = useState(0);
  const [aviso, setAviso] = useState<string | null>(null);
  const [pasoActivo, setPasoActivo] = useState(0);
  const [noAplica, setNoAplica] = useState<Set<AnguloEvidencia>>(new Set());

  useEffect(() => {
    const timeout = window.setTimeout(() => setMostrarSkeleton(false), 300);
    return () => window.clearTimeout(timeout);
  }, []);

  const cargarPendientesLocales = useCallback(async () => {
    const pendientes = await leerColaEvidenciaDeTraslado(id);
    setPendientesSubida(pendientes.length);
    return pendientes.map(
      (item): FotoEvidencia => ({
        id: item.localId,
        traslado_id: item.trasladoId,
        tipo: item.tipo,
        angulo: item.angulo as AnguloEvidencia,
        local_path: item.dataUrl,
        timestamp: item.capturadaEn,
        ...(item.lat !== undefined ? { lat: item.lat } : {}),
        ...(item.lng !== undefined ? { lng: item.lng } : {}),
        sincronizada: false
      })
    );
  }, [id]);

  const refrescarEvidencia = useCallback(async () => {
    if (!tipo) return;
    const cliente = crearClienteNavegador();
    const [remotas, locales] = await Promise.all([
      obtenerEvidenciaDeTraslado(cliente, id, tipo),
      cargarPendientesLocales()
    ]);
    setFotos([...remotas, ...locales.filter((local) => !remotas.some((remota) => remota.id === local.id))]);
  }, [cargarPendientesLocales, id, tipo]);

  const drenarCola = useCallback(async () => {
    if (!tipo || !tieneSupabaseConfigurado() || (typeof navigator !== "undefined" && !navigator.onLine)) return;
    const pendientes = await contarColaEvidencia(id);
    setPendientesSubida(pendientes);
    if (pendientes === 0) return;

    setSincronizando(true);
    setAviso(null);
    try {
      const cliente = crearClienteNavegador();
      const subidas = await sincronizarColaEvidencia(cliente, {
        trasladoId: id,
        onItemSincronizado: async () => {
          setPendientesSubida(await contarColaEvidencia(id));
        }
      });
      await refrescarEvidencia();
      if (subidas > 0) {
        setAviso(`${subidas} foto${subidas === 1 ? "" : "s"} sincronizada${subidas === 1 ? "" : "s"}.`);
      }
    } catch (err) {
      setAviso(err instanceof Error ? err.message : "No pudimos sincronizar el registro pendiente del vehículo.");
    } finally {
      setSincronizando(false);
    }
  }, [id, refrescarEvidencia, tipo]);

  const cargarInspeccion = useCallback(async (tipoEvidencia: TipoEvidencia) => {
    const cliente = crearClienteNavegador();
    const { data, error } = await (cliente as any)
      .from("evidencia_inspecciones")
      .select("*")
      .eq("traslado_id", id)
      .eq("tipo", tipoEvidencia)
      .maybeSingle();

    if (error) throw error;
    if (!data) {
      setInspeccion(INSPECCION_INICIAL);
      return;
    }

    setInspeccion({
      combustible: data.combustible ?? "",
      kilometraje: data.kilometraje !== null && data.kilometraje !== undefined ? String(data.kilometraje) : "",
      llavesRecibidas: data.llaves_recibidas ?? "",
      hologramaVerificacion:
        data.holograma_verificacion === null || data.holograma_verificacion === undefined
          ? ""
          : data.holograma_verificacion
            ? "si"
            : "no",
      talonVerificacion: data.talon_verificacion ?? "",
      tarjetaCirculacion: data.tarjeta_circulacion ?? "",
      placaDelantera: data.placa_delantera ?? "",
      placaTrasera: data.placa_trasera ?? "",
      notas: data.notas ?? ""
    });
  }, [id]);

  async function guardarInspeccion(mostrarAviso = true): Promise<boolean> {
    if (!tipo) return true;
    setEnviando("inspeccion");
    setAviso(null);
    try {
      const cliente = crearClienteNavegador();
      const kilometraje = inspeccion.kilometraje.trim() ? Number(inspeccion.kilometraje) : null;
      if (kilometraje !== null && (!Number.isFinite(kilometraje) || kilometraje < 0)) {
        throw new Error("El kilometraje debe ser un número válido.");
      }

      const { error } = await (cliente as any).from("evidencia_inspecciones").upsert(
        {
          traslado_id: id,
          tipo,
          combustible: inspeccion.combustible.trim() || null,
          kilometraje,
          llaves_recibidas: inspeccion.llavesRecibidas.trim() || null,
          holograma_verificacion:
            inspeccion.hologramaVerificacion === "" ? null : inspeccion.hologramaVerificacion === "si",
          talon_verificacion: inspeccion.talonVerificacion.trim() || null,
          tarjeta_circulacion: inspeccion.tarjetaCirculacion.trim() || null,
          placa_delantera: inspeccion.placaDelantera.trim() || null,
          placa_trasera: inspeccion.placaTrasera.trim() || null,
          notas: inspeccion.notas.trim() || null
        },
        { onConflict: "traslado_id,tipo" }
      );

      if (error) throw error;
      if (mostrarAviso) setAviso("Datos de inspección guardados.");
      return true;
    } catch (err) {
      setAviso(err instanceof Error ? err.message : "No pudimos guardar los datos de inspección.");
      return false;
    } finally {
      setEnviando(null);
    }
  }

  useEffect(() => {
    async function cargar() {
      if (!tieneSupabaseConfigurado()) {
        setAviso("Supabase no está configurado. No se puede cargar el registro del vehículo.");
        setCargando(false);
        return;
      }

      try {
        const cliente = crearClienteNavegador();
        const pasaporte = await obtenerPasaporteDigital(cliente, id);
        if (!pasaporte) {
          setCargando(false);
          return;
        }
        const tipoDetectado = tipoEvidenciaPorEstado(pasaporte.estado);
        setEstadoActual(pasaporte.estado);
        setPasaporteActual(pasaporte);
        setTipo(tipoDetectado);
        if (tipoDetectado) {
          const [remotas] = await Promise.all([
            obtenerEvidenciaDeTraslado(cliente, id, tipoDetectado),
            cargarInspeccion(tipoDetectado)
          ]);
          const locales = await cargarPendientesLocales();
          setFotos([...remotas, ...locales.filter((local) => local.tipo === tipoDetectado && !remotas.some((remota) => remota.id === local.id))]);
        }
      } catch (err) {
        setAviso(err instanceof Error ? err.message : "No pudimos cargar el registro del vehículo.");
      } finally {
        setCargando(false);
      }
    }
    cargar();
  }, [cargarInspeccion, cargarPendientesLocales, id]);

 useEffect(() => {
  if (!tipo) return;
  const timer = setTimeout(() => { void drenarCola(); }, 0);
  // ... resto de listeners
  return () => {
    clearTimeout(timer);
    // ... removeEventListeners
  };
}, [tipo, drenarCola]);


  if (cargando || mostrarSkeleton) {
    return (
      <div aria-label="Cargando registro del vehículo" aria-busy="true" className="mx-auto max-w-xl px-6 py-12">
        <h1 className="font-display text-2xl font-semibold">{GLOSARIO_OPERATIVO.evidencia}</h1>
        <p className="mt-2 font-body text-sm text-text-secondary">Preparando checklist de ángulos obligatorios.</p>

        <PassportCard className="mt-6">
          <div className="grid gap-4">
            {Array.from({ length: 6 }).map((_, index) => (
              <div key={index} className="h-10 animate-pulse rounded-lg bg-surface-elevated" />
            ))}
          </div>
        </PassportCard>

        <div className="mt-6 flex items-center justify-between gap-4">
          <p className="font-body text-sm font-semibold text-text-tertiary">
            0 / 6 pasos
          </p>
          <Button disabled={true}>Confirmar registro</Button>
        </div>
      </div>
    );
  }

  if (!tipo) {
    return (
      <div className="mx-auto max-w-xl px-6 py-20 text-center">
        <h1 className="font-display text-xl font-semibold">Este viaje no está en fase de registro del vehículo</h1>
        <p className="mt-3 font-body text-sm text-text-secondary">Vuelve al detalle del viaje para ver el paso actual.</p>
        {aviso && (
          <div className="mt-4 text-left">
            <Aviso tono="danger">{aviso}</Aviso>
          </div>
        )}
      </div>
    );
  }

  const resultado = evidenciaCompleta(fotos, tipo);
  const requisitos = listaEvidenciaObligatoria(tipo);
  const pasoEsRevision = pasoActivo >= requisitos.length;
  const requisitoActivo = requisitos[Math.min(pasoActivo, requisitos.length - 1)];
  const fotoPorAngulo = (angulo: AnguloEvidencia) =>
    fotos
      .filter((foto) => foto.angulo === angulo && foto.tipo === tipo)
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())[0];
  const requisitosCompletados = requisitos.filter((item) => {
    const foto = fotoPorAngulo(item.angulo);
    if (item.obligatorio) return Boolean(foto);
    return Boolean(foto) || noAplica.has(item.angulo);
  }).length;
  const etiquetasFaltantes = resultado.angulosFaltantes.map((angulo) => ETIQUETA_ANGULO[angulo as AnguloEvidencia] ?? angulo);

  function statusRequisito(item: EvidenceRequirement) {
    const foto = fotoPorAngulo(item.angulo);
    if (foto) return "listo" as const;
    if (!item.obligatorio && noAplica.has(item.angulo)) return "omitido" as const;
    return "pendiente" as const;
  }

  function irASiguientePendiente() {
    const pendiente = requisitos.findIndex((item) => statusRequisito(item) === "pendiente");
    setPasoActivo(pendiente >= 0 ? pendiente : requisitos.length);
  }

  async function registrarFotoLocal(angulo: AnguloEvidencia, dataUrl: string) {
    if (!tipo) return;
    const coords = await obtenerUbicacionActual();
    const localId = crypto.randomUUID();
    await encolarEvidencia({
      localId,
      trasladoId: id,
      tipo,
      angulo,
      dataUrl,
      ...(coords ? { lat: coords.lat, lng: coords.lng } : {}),
      capturadaEn: new Date().toISOString()
    });
    const locales = await cargarPendientesLocales();
    setFotos((prev) => [...prev.filter((foto) => foto.id !== localId), ...locales.filter((local) => local.tipo === tipo)]);
    setNoAplica((actual) => {
      const siguiente = new Set(actual);
      siguiente.delete(angulo);
      return siguiente;
    });
    setAviso("Foto guardada en este dispositivo. Se subirá automáticamente al recuperar señal.");
    void drenarCola();
    const indiceActual = requisitos.findIndex((item) => item.angulo === angulo);
    const siguientePendiente = requisitos.findIndex((item, index) => index > indiceActual && statusRequisito(item) === "pendiente");
    setPasoActivo(siguientePendiente >= 0 ? siguientePendiente : requisitos.length);
  }

  async function capturar(angulo: AnguloEvidencia) {
    if (!tipo) return;
    setEnviando(angulo);
    setAviso(null);

    if (esNativo()) {
      try {
        const foto = await capturarFoto();
        if (!foto) {
          setAviso("No pudimos abrir la cámara. Intenta de nuevo.");
          setEnviando(null);
          return;
        }
        await registrarFotoLocal(angulo, foto.dataUrl);
        setEnviando(null);
        return;
      } catch (err) {
        setAviso(err instanceof Error ? err.message : "No pudimos capturar la foto.");
        setEnviando(null);
        return;
      }
    }

    abrirSelectorArchivo(angulo);
    setEnviando(null);
  }

  async function seleccionarGaleria(angulo: AnguloEvidencia) {
    if (!tipo) return;
    setEnviando(angulo);
    setAviso(null);

    if (!esNativo()) {
      abrirSelectorArchivo(angulo);
      setEnviando(null);
      return;
    }

    try {
      const foto = await seleccionarFotoGaleria();
      if (!foto) {
        setAviso("No pudimos abrir la galería. Intenta de nuevo.");
        return;
      }
      await registrarFotoLocal(angulo, foto.dataUrl);
    } catch (err) {
      setAviso(err instanceof Error ? err.message : "No pudimos seleccionar la foto.");
    } finally {
      setEnviando(null);
    }
  }

  function abrirSelectorArchivo(angulo: AnguloEvidencia) {
    anguloArchivoRef.current = angulo;
    inputArchivoRef.current?.click();
  }

  async function procesarArchivoSeleccionado(archivo: File | undefined) {
    const angulo = anguloArchivoRef.current;
    if (!archivo || !angulo) return;
    setEnviando(angulo);
    setAviso(null);
    try {
      if (!archivo.type.startsWith("image/")) {
        throw new Error("Selecciona una imagen válida.");
      }
      const dataUrl = await archivoADataUrl(archivo);
      await registrarFotoLocal(angulo, dataUrl);
    } catch (err) {
      setAviso(err instanceof Error ? err.message : "No pudimos cargar la imagen seleccionada.");
    } finally {
      setEnviando(null);
      anguloArchivoRef.current = null;
      if (inputArchivoRef.current) inputArchivoRef.current.value = "";
    }
  }

  async function confirmar() {
    if (!tipo) return;
    setEnviando("confirmar");
    setAviso(null);

    if (!estadoActual) {
      setAviso("No pudimos confirmar el registro del vehículo porque no se cargó el estado actual del viaje.");
      setEnviando(null);
      return;
    }

    try {
      const inspeccionGuardada = await guardarInspeccion(false);
      if (!inspeccionGuardada) return;
      setEnviando("confirmar");
      const cliente = crearClienteNavegador();
      await confirmarEvidenciaCompleta(cliente, id, estadoActual, tipo);
      router.push(`/viajes/${id}`);
    } catch (err) {
      setAviso(err instanceof Error ? err.message : "No pudimos confirmar el registro del vehículo.");
    } finally {
      setEnviando(null);
    }
  }

  return (
    <div className="mx-auto max-w-xl px-6 py-12">
      <RegistroViajeActivo
        viaje={
          estadoActual
            ? {
                trasladoId: id,
                estado: estadoActual,
                origenDireccion: pasaporteActual?.origen_direccion,
                origenCiudad: pasaporteActual?.origen_ciudad,
                destinoDireccion: pasaporteActual?.destino_direccion,
                destinoCiudad: pasaporteActual?.destino_ciudad
              }
            : null
        }
      />
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="font-body text-sm font-semibold text-route-action">
            {requisitosCompletados} de {requisitos.length}
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

      <EvidenceChecklist items={requisitos} activeIndex={pasoActivo} statusFor={statusRequisito} onSelect={setPasoActivo} />

      {aviso && (
        <div className="mt-4">
          <Aviso tono={resultado.completa ? "info" : "atencion"}>{aviso}</Aviso>
        </div>
      )}

      <div className="mt-4">
        <EvidenceSyncStatus pendientesSubida={pendientesSubida} sincronizando={sincronizando} missing={etiquetasFaltantes} complete={resultado.completa} />
      </div>

      <input
        ref={inputArchivoRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(event) => void procesarArchivoSeleccionado(event.target.files?.[0])}
      />

      {pasoEsRevision ? (
        <EvidenceReview
          items={requisitos}
          fotos={fotos}
          noAplica={noAplica}
          resultado={resultado}
          pendientesSubida={pendientesSubida}
          sincronizando={sincronizando}
          inspeccion={inspeccion}
          enviando={enviando === "confirmar"}
          onBackToMissing={irASiguientePendiente}
          onConfirm={() => void confirmar()}
        />
      ) : (
        <EvidenceCaptureStep
          item={requisitoActivo}
          step={pasoActivo + 1}
          total={requisitos.length}
          foto={fotoPorAngulo(requisitoActivo.angulo)}
          noAplica={noAplica.has(requisitoActivo.angulo)}
          busy={enviando === requisitoActivo.angulo}
          onCapture={() => void capturar(requisitoActivo.angulo)}
          onGallery={() => void seleccionarGaleria(requisitoActivo.angulo)}
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
      )}

      <details className="mt-6 rounded-xl border border-border bg-surface">
        <summary className="cursor-pointer px-4 py-3 font-body text-sm font-semibold">Datos de inspección</summary>
        <div className="grid gap-3 border-t border-border px-4 py-4 sm:grid-cols-2">
          <CampoSelect
            etiqueta="Combustible"
            valor={inspeccion.combustible}
            opciones={OPCIONES_COMBUSTIBLE}
            onChange={(valor) => setInspeccion((actual) => ({ ...actual, combustible: valor }))}
          />
          <CampoTexto
            etiqueta="Kilometraje"
            tipo="number"
            valor={inspeccion.kilometraje}
            onChange={(valor) => setInspeccion((actual) => ({ ...actual, kilometraje: valor }))}
          />
          <CampoSelect
            etiqueta="Llaves recibidas"
            valor={inspeccion.llavesRecibidas}
            opciones={OPCIONES_LLAVES}
            onChange={(valor) => setInspeccion((actual) => ({ ...actual, llavesRecibidas: valor }))}
          />
          <CampoSiNo
            etiqueta="Holograma de verificación"
            valor={inspeccion.hologramaVerificacion}
            onChange={(valor) => setInspeccion((actual) => ({ ...actual, hologramaVerificacion: valor }))}
          />
          <CampoSelect etiqueta="Talón de verificación" valor={inspeccion.talonVerificacion} opciones={OPCIONES_SI_NO} onChange={(valor) => setInspeccion((actual) => ({ ...actual, talonVerificacion: valor }))} />
          <CampoSelect etiqueta="Tarjeta de circulación" valor={inspeccion.tarjetaCirculacion} opciones={OPCIONES_SI_NO} onChange={(valor) => setInspeccion((actual) => ({ ...actual, tarjetaCirculacion: valor }))} />
          <CampoSelect etiqueta="Placa delantera" valor={inspeccion.placaDelantera} opciones={OPCIONES_SI_NO} onChange={(valor) => setInspeccion((actual) => ({ ...actual, placaDelantera: valor }))} />
          <CampoSelect etiqueta="Placa trasera" valor={inspeccion.placaTrasera} opciones={OPCIONES_SI_NO} onChange={(valor) => setInspeccion((actual) => ({ ...actual, placaTrasera: valor }))} />
          <label className="grid gap-1 sm:col-span-2">
            <span className="font-body text-sm font-semibold text-text-tertiary">Notas o comentarios</span>
            <textarea
              value={inspeccion.notas}
              onChange={(event) => setInspeccion((actual) => ({ ...actual, notas: event.target.value }))}
              rows={3}
              className="rounded-lg border border-border bg-surface px-3 py-2 font-body text-base text-text-primary outline-none focus:border-signal"
            />
          </label>
          <Button variant="secondary" onClick={() => void guardarInspeccion()} loading={enviando === "inspeccion"}>
            Guardar inspección
          </Button>
        </div>
      </details>
    </div>
  );
}
