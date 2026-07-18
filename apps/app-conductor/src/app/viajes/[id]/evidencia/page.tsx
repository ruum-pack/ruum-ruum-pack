"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Button, Aviso, Card } from "@ruum/ui";
import { GLOSARIO_OPERATIVO } from "@ruum/shared/constants";
import { evidenciaCompleta } from "@ruum/shared/rules";
import type { AnguloEvidencia, FotoEvidencia, TipoEvidencia } from "@ruum/shared/types";
import { traducirErrorOperativo } from "@ruum/shared/utils";
import { crearClienteNavegador, tieneSupabaseConfigurado } from "../../../../lib/supabase-browser";
import { esNativo } from "../../../../lib/capacitor";
import { capturarFoto, seleccionarFotoGaleria } from "../../../../lib/camara";
import {
  obtenerPasaporteDigital,
  obtenerEvidenciaDeTraslado,
  confirmarEvidenciaCompleta,
  firmarUrlsEvidencia
} from "@ruum/api/services";
import { EvidenceWizard } from "./EvidenceWizard";
import { useEvidenceQueue } from "./useEvidenceQueue";
import type { EstadoTraslado, EvidenceRequirement, InspeccionEvidencia, PasaporteRow } from "./evidence-requirements";
import { INSPECCION_INICIAL, ETIQUETA_ANGULO, listaEvidenciaObligatoria, tipoEvidenciaPorEstado } from "./evidence-requirements";

function archivoADataUrl(archivo: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("No pudimos leer la imagen seleccionada."));
    reader.readAsDataURL(archivo);
  });
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
  const [aviso, setAviso] = useState<string | null>(null);
  const [pasoActivo, setPasoActivo] = useState(0);
  const [noAplica, setNoAplica] = useState<Set<AnguloEvidencia>>(new Set());
  const {
    pendientesSubida,
    sincronizando,
    cargarPendientesLocales,
    drenarColaPendiente,
    registrarFotoEnCola
  } = useEvidenceQueue({ trasladoId: id, tipo });

  useEffect(() => {
    const timeout = window.setTimeout(() => setMostrarSkeleton(false), 300);
    return () => window.clearTimeout(timeout);
  }, []);

  const refrescarEvidencia = useCallback(async () => {
    if (!tipo) return;
    const cliente = crearClienteNavegador();
    const [remotas, locales] = await Promise.all([
      obtenerEvidenciaDeTraslado(cliente, id, tipo),
      cargarPendientesLocales()
    ]);
    const remotasFirmadas = await firmarUrlsEvidencia(cliente, remotas);
    setFotos([
      ...remotasFirmadas,
      ...locales.filter((local) => !remotasFirmadas.some((remota) => remota.id === local.id))
    ]);
  }, [cargarPendientesLocales, id, tipo]);

  const drenarCola = useCallback(async () => {
    setAviso(null);
    try {
      const subidas = await drenarColaPendiente();
      if (!subidas) return;
      await refrescarEvidencia();
      setAviso(`${subidas} foto${subidas === 1 ? "" : "s"} sincronizada${subidas === 1 ? "" : "s"}.`);
    } catch (err) {
      setAviso(traducirErrorOperativo(err, "No pudimos sincronizar el registro pendiente del vehículo."));
    }
  }, [drenarColaPendiente, refrescarEvidencia]);

  const cargarInspeccion = useCallback(async (tipoEvidencia: TipoEvidencia) => {
    const cliente = crearClienteNavegador();
    const { data, error } = await cliente
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

      const { error } = await cliente.from("evidencia_inspecciones").upsert(
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
      setAviso(traducirErrorOperativo(err, "No pudimos guardar los datos de inspección."));
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
        if (!pasaporte.estado) {
          setAviso("No pudimos determinar el estado del viaje para abrir el registro del vehículo.");
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
          const remotasFirmadas = await firmarUrlsEvidencia(cliente, remotas);
          setFotos([
            ...remotasFirmadas,
            ...locales.filter(
              (local) => local.tipo === tipoDetectado && !remotasFirmadas.some((remota) => remota.id === local.id)
            )
          ]);
        }
      } catch (err) {
        setAviso(traducirErrorOperativo(err, "No pudimos cargar el registro del vehículo."));
      } finally {
        setCargando(false);
      }
    }
    cargar();
  }, [cargarInspeccion, cargarPendientesLocales, id]);

  useEffect(() => {
    if (!tipo) return;
    const timer = setTimeout(() => {
      void drenarCola();
    }, 0);
    return () => {
      clearTimeout(timer);
    };
  }, [tipo, drenarCola]);


  if (cargando || mostrarSkeleton) {
    return (
      <div aria-label="Cargando registro del vehículo" aria-busy="true" className="mx-auto max-w-xl px-6 py-12">
        <h1 className="font-display text-2xl font-semibold">{GLOSARIO_OPERATIVO.evidencia}</h1>
        <p className="mt-2 font-body text-sm text-text-secondary">Preparando checklist de ángulos obligatorios.</p>

        <Card className="mt-6">
          <div className="grid gap-4">
            {Array.from({ length: 6 }).map((_, index) => (
              <div key={index} className="h-10 animate-pulse rounded-lg bg-surface-elevated" />
            ))}
          </div>
        </Card>

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
    const locales = await registrarFotoEnCola({ angulo, dataUrl });
    setFotos((prev) => [
      ...prev.filter((foto) => !locales.some((local) => local.id === foto.id)),
      ...locales.filter((local) => local.tipo === tipo)
    ]);
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
        setAviso(traducirErrorOperativo(err, "No pudimos capturar la foto."));
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
      setAviso(traducirErrorOperativo(err, "No pudimos seleccionar la foto."));
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
      setAviso(traducirErrorOperativo(err, "No pudimos cargar la imagen seleccionada."));
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
      setAviso(traducirErrorOperativo(err, "No pudimos confirmar el registro del vehículo."));
    } finally {
      setEnviando(null);
    }
  }

  return (
    <EvidenceWizard
      trasladoId={id}
      estadoActual={estadoActual}
      pasaporteActual={pasaporteActual}
      tipo={tipo}
      requisitos={requisitos}
      requisitosCompletados={requisitosCompletados}
      pasoActivo={pasoActivo}
      pasoEsRevision={pasoEsRevision}
      requisitoActivo={requisitoActivo}
      aviso={aviso}
      resultado={resultado}
      etiquetasFaltantes={etiquetasFaltantes}
      pendientesSubida={pendientesSubida}
      sincronizando={sincronizando}
      inputArchivoRef={inputArchivoRef}
      fotos={fotos}
      noAplica={noAplica}
      inspeccion={inspeccion}
      enviando={enviando}
      statusFor={statusRequisito}
      fotoPorAngulo={fotoPorAngulo}
      setPasoActivo={setPasoActivo}
      setNoAplica={setNoAplica}
      setInspeccion={setInspeccion}
      onArchivoSeleccionado={(archivo) => void procesarArchivoSeleccionado(archivo)}
      onBackToMissing={irASiguientePendiente}
      onConfirm={() => void confirmar()}
      onCapture={(angulo) => void capturar(angulo)}
      onGallery={(angulo) => void seleccionarGaleria(angulo)}
      onSaveInspection={() => void guardarInspeccion()}
    />
  );
}
