"use client";

"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Button, Aviso, PassportCard } from "@ruum/ui";
import { MENSAJE_EVIDENCIA_SINCRONIZANDO, MENSAJES_CLAVE_UX, TEXTOS_CARGANDO } from "@ruum/shared/constants";
import { evidenciaCompleta } from "@ruum/shared/rules";
import { ANGULOS_OBLIGATORIOS } from "@ruum/shared/types";
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

interface InspeccionEvidencia {
  combustible: string;
  kilometraje: string;
  llavesRecibidas: string;
  hologramaVerificacion: "" | "si" | "no";
  talonVerificacion: string;
  tarjetaCirculacion: string;
  placaDelantera: string;
  placaTrasera: string;
}

const INSPECCION_INICIAL: InspeccionEvidencia = {
  combustible: "",
  kilometraje: "",
  llavesRecibidas: "",
  hologramaVerificacion: "",
  talonVerificacion: "",
  tarjetaCirculacion: "",
  placaDelantera: "",
  placaTrasera: ""
};

const ETIQUETA_ANGULO: Record<AnguloEvidencia, string> = {
  frente: "Frente",
  lado_piloto: "Lado piloto",
  lado_copiloto: "Lado copiloto",
  trasera: "Trasera",
  tablero: "Tablero",
  dano_previo: "Daño previo",
  adicional: "Adicional"
};

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
        sincronizada ? "border-control/30 bg-control-soft text-control" : "border-warn/40 bg-warn-soft text-warn"
      ].join(" ")}
    >
      {sincronizada ? <IconoCheck /> : <IconoReloj />}
      {sincronizada ? "Sincronizada" : "Pendiente de subir"}
    </span>
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
      <span className="font-mono-ruum text-[10px] uppercase tracking-widest text-ink/45">{etiqueta}</span>
      <input
        type={tipo}
        value={valor}
        onChange={(event) => onChange(event.target.value)}
        className="min-h-10 rounded-lg border border-ink/15 bg-mist px-3 font-body text-sm text-ink outline-none focus:border-signal"
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
      <span className="font-mono-ruum text-[10px] uppercase tracking-widest text-ink/45">{etiqueta}</span>
      <select
        value={valor}
        onChange={(event) => onChange(event.target.value as "" | "si" | "no")}
        className="min-h-10 rounded-lg border border-ink/15 bg-mist px-3 font-body text-sm text-ink outline-none focus:border-signal"
      >
        <option value="">Selecciona</option>
        <option value="si">Sí</option>
        <option value="no">No</option>
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
  const [tipo, setTipo] = useState<TipoEvidencia | null>(null);
  const [fotos, setFotos] = useState<FotoEvidencia[]>([]);
  const [inspeccion, setInspeccion] = useState<InspeccionEvidencia>(INSPECCION_INICIAL);
  const [cargando, setCargando] = useState(true);
  const [mostrarSkeleton, setMostrarSkeleton] = useState(true);
  const [enviando, setEnviando] = useState<AnguloEvidencia | "confirmar" | "inspeccion" | null>(null);
  const [sincronizando, setSincronizando] = useState(false);
  const [pendientesSubida, setPendientesSubida] = useState(0);
  const [aviso, setAviso] = useState<string | null>(null);

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
      setAviso(err instanceof Error ? err.message : "No pudimos sincronizar la evidencia pendiente.");
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
      placaTrasera: data.placa_trasera ?? ""
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
          placa_trasera: inspeccion.placaTrasera.trim() || null
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
        setAviso("Supabase no está configurado. No se puede cargar evidencia real.");
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
        setAviso(err instanceof Error ? err.message : "No pudimos cargar la evidencia.");
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
      <div aria-label="Cargando evidencia" aria-busy="true" className="mx-auto max-w-xl px-6 py-12">
        <h1 className="font-display text-2xl font-semibold">Evidencia</h1>
        <p className="mt-2 font-body text-sm text-ink/60">Preparando checklist de ángulos obligatorios.</p>

        <PassportCard className="mt-6">
          <div className="grid gap-4">
            {ANGULOS_OBLIGATORIOS.map((angulo) => (
              <div key={angulo} className="h-10 animate-pulse rounded-lg bg-ink/8" />
            ))}
          </div>
        </PassportCard>

        <div className="mt-6 flex items-center justify-between gap-4">
          <p className="font-mono-ruum text-xs uppercase tracking-wide text-ink/50">
            0 / {ANGULOS_OBLIGATORIOS.length} ángulos
          </p>
          <Button disabled={true}>Confirmar evidencia</Button>
        </div>
      </div>
    );
  }

  if (!tipo) {
    return (
      <div className="mx-auto max-w-xl px-6 py-20 text-center">
        <h1 className="font-display text-xl font-semibold">Este viaje no está en fase de evidencia</h1>
        <p className="mt-3 font-body text-sm text-ink/60">Vuelve al detalle del viaje para ver el paso actual.</p>
        {aviso && (
          <div className="mt-4 text-left">
            <Aviso tono="peligro">{aviso}</Aviso>
          </div>
        )}
      </div>
    );
  }

  const resultado = evidenciaCompleta(fotos, tipo);
  const capturados = new Set(fotos.map((f) => f.angulo));

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
    setAviso("Foto guardada en este dispositivo. Se subirá automáticamente al recuperar señal.");
    void drenarCola();
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
      setAviso("No pudimos confirmar la evidencia porque no se cargó el estado actual del viaje.");
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
      setAviso(err instanceof Error ? err.message : "No pudimos confirmar la evidencia.");
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
                estado: estadoActual
              }
            : null
        }
      />
      <h1 className="font-display text-2xl font-semibold">
        Evidencia {tipo === "inicial" ? "inicial" : "final"}
      </h1>
      <p className="mt-2 font-body text-sm text-ink/60">
        {tipo === "inicial"
          ? `${MENSAJES_CLAVE_UX.evidencia_inicial} Los 5 ángulos son obligatorios.`
          : "Documenta el estado del vehículo al llegar, para comparar contra la evidencia inicial."}
      </p>

      {aviso && (
        <div className="mt-4">
          <Aviso tono={resultado.completa ? "info" : "atencion"}>{aviso}</Aviso>
        </div>
      )}

      {pendientesSubida > 0 && (
        <div className="mt-4">
          <Aviso tono="atencion">
            {pendientesSubida} foto{pendientesSubida === 1 ? "" : "s"} pendiente{pendientesSubida === 1 ? "" : "s"} de subir.
            {sincronizando ? ` ${MENSAJE_EVIDENCIA_SINCRONIZANDO}.` : " Se sincronizarán automáticamente al recuperar conexión."}
          </Aviso>
        </div>
      )}

      <PassportCard className="mt-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="font-body text-xs uppercase tracking-wide text-ink/45">Inspección operativa</p>
            <h2 className="mt-1 font-display text-lg font-semibold">Datos del vehículo</h2>
          </div>
          <Button variant="secundario" onClick={() => void guardarInspeccion()} loading={enviando === "inspeccion"}>
            Guardar
          </Button>
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <CampoTexto
            etiqueta="Combustible"
            valor={inspeccion.combustible}
            onChange={(valor) => setInspeccion((actual) => ({ ...actual, combustible: valor }))}
          />
          <CampoTexto
            etiqueta="Kilometraje"
            tipo="number"
            valor={inspeccion.kilometraje}
            onChange={(valor) => setInspeccion((actual) => ({ ...actual, kilometraje: valor }))}
          />
          <CampoTexto
            etiqueta="Llaves recibidas"
            valor={inspeccion.llavesRecibidas}
            onChange={(valor) => setInspeccion((actual) => ({ ...actual, llavesRecibidas: valor }))}
          />
          <CampoSiNo
            etiqueta="Holograma de verificación"
            valor={inspeccion.hologramaVerificacion}
            onChange={(valor) => setInspeccion((actual) => ({ ...actual, hologramaVerificacion: valor }))}
          />
          <CampoTexto
            etiqueta="Talón de verificación"
            valor={inspeccion.talonVerificacion}
            onChange={(valor) => setInspeccion((actual) => ({ ...actual, talonVerificacion: valor }))}
          />
          <CampoTexto
            etiqueta="Tarjeta de circulación"
            valor={inspeccion.tarjetaCirculacion}
            onChange={(valor) => setInspeccion((actual) => ({ ...actual, tarjetaCirculacion: valor }))}
          />
          <CampoTexto
            etiqueta="Placa delantera"
            valor={inspeccion.placaDelantera}
            onChange={(valor) => setInspeccion((actual) => ({ ...actual, placaDelantera: valor }))}
          />
          <CampoTexto
            etiqueta="Placa trasera"
            valor={inspeccion.placaTrasera}
            onChange={(valor) => setInspeccion((actual) => ({ ...actual, placaTrasera: valor }))}
          />
        </div>
      </PassportCard>

      <PassportCard className="mt-6">
        <input
          ref={inputArchivoRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(event) => void procesarArchivoSeleccionado(event.target.files?.[0])}
        />
        <div className="space-y-3">
          {ANGULOS_OBLIGATORIOS.map((angulo) => {
            const foto = fotos.find((item) => item.angulo === angulo);
            const yaCapturado = capturados.has(angulo);
            return (
              <div key={angulo} className="flex items-center justify-between gap-4 border-b border-ink/10 pb-3 last:border-0 last:pb-0">
                <span className="font-body text-sm">{ETIQUETA_ANGULO[angulo]}</span>
                {yaCapturado ? (
                  <BadgeSincronizacion sincronizada={Boolean(foto?.sincronizada)} />
                ) : (
                  <div className="flex flex-wrap justify-end gap-2">
                    <Button variant="secundario" onClick={() => capturar(angulo)} loading={enviando === angulo}>
                      {enviando === angulo ? "Guardando…" : "Cámara"}
                    </Button>
                    <Button variant="secundario" onClick={() => seleccionarGaleria(angulo)} loading={enviando === angulo}>
                      Galería
                    </Button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </PassportCard>

      <div className="mt-6 flex items-center justify-between">
        <p className="font-mono-ruum text-xs uppercase tracking-wide text-ink/50">
          {ANGULOS_OBLIGATORIOS.length - resultado.angulosFaltantes.length} / {ANGULOS_OBLIGATORIOS.length} ángulos
        </p>
        <Button onClick={confirmar} disabled={!resultado.completa} loading={enviando === "confirmar"}>
          {enviando === "confirmar" ? TEXTOS_CARGANDO.confirmando : "Confirmar evidencia completa"}
        </Button>
      </div>
    </div>
  );
}
