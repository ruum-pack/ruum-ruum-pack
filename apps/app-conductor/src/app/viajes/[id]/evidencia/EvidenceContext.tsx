"use client";
import { createContext, useCallback, useContext, useMemo, useRef, useState } from "react";
import type { Dispatch, RefObject, SetStateAction } from "react";
import { evidenciaCompleta } from "@ruum/shared/rules";
import type { AnguloEvidencia, FotoEvidencia, TipoEvidencia } from "@ruum/shared/types";
import type {
  EstadoTraslado,
  EvidenceRequirement,
  InspeccionEvidencia,
  PasaporteRow
} from "./evidence-requirements";
import {
  CAMPOS_INSPECCION_OBLIGATORIOS,
  ETIQUETA_ANGULO,
  camposInspeccionFaltantes,
  listaEvidenciaObligatoria,
  totalCamposInspeccionCompletados
} from "./evidence-requirements";

type EvidenceApi = {
  trasladoId: string;
  estadoActual: EstadoTraslado | null;
  pasaporteActual: PasaporteRow | null;
  tipo: TipoEvidencia;
  requisitos: EvidenceRequirement[];
  requisitosCompletados: number;
  progresoTotal: number;
  requisitosTotales: number;
  pasoActivo: number;
  pasoEsRevision: boolean;
  requisitoActivo: EvidenceRequirement;
  aviso: string | null;
  resultado: ReturnType<typeof evidenciaCompleta>;
  registroCompleto: boolean;
  etiquetasFaltantes: string[];
  pendientesSubida: number;
  sincronizando: boolean;
  inputArchivoRef: RefObject<HTMLInputElement | null>;
  fotos: FotoEvidencia[];
  noAplica: Set<AnguloEvidencia>;
  inspeccion: InspeccionEvidencia;
  camposInspeccionPendientes: Array<{ etiqueta: string }>;
  inspeccionCompletada: number;
  enviando: AnguloEvidencia | "confirmar" | "inspeccion" | null;
  statusFor: (item: EvidenceRequirement) => "listo" | "pendiente" | "omitido";
  fotoPorAngulo: (angulo: AnguloEvidencia) => FotoEvidencia | undefined;
  setPasoActivo: Dispatch<SetStateAction<number>>;
  setNoAplica: Dispatch<SetStateAction<Set<AnguloEvidencia>>>;
  setInspeccion: Dispatch<SetStateAction<InspeccionEvidencia>>;
  onArchivoSeleccionado: (archivo: File | undefined) => void;
  onBackToMissing: () => void;
  onConfirm: () => void;
  onCapture: (angulo: AnguloEvidencia) => void;
  onGallery: (angulo: AnguloEvidencia) => void;
  onSaveInspection: () => void;
};

const EvidenceCtx = createContext<EvidenceApi | null>(null);

export function useEvidenceWizard() {
  const ctx = useContext(EvidenceCtx);
  if (!ctx) throw new Error("useEvidenceWizard debe usarse dentro de EvidenceWizardProvider");
  return ctx;
}

export function EvidenceWizardProvider({
  children,
  trasladoId,
  estadoActual,
  pasaporteActual,
  tipo,
  fotos,
  inspeccion,
  noAplica,
  pasoActivo,
  aviso,
  pendientesSubida,
  sincronizando,
  enviando,
  inputArchivoRef,
  setPasoActivo,
  setNoAplica,
  setInspeccion,
  onArchivoSeleccionado,
  onConfirm,
  onCapture,
  onGallery,
  onSaveInspection
}: {
  children: React.ReactNode;
  trasladoId: string;
  estadoActual: EstadoTraslado | null;
  pasaporteActual: PasaporteRow | null;
  tipo: TipoEvidencia;
  fotos: FotoEvidencia[];
  inspeccion: InspeccionEvidencia;
  noAplica: Set<AnguloEvidencia>;
  pasoActivo: number;
  aviso: string | null;
  pendientesSubida: number;
  sincronizando: boolean;
  enviando: AnguloEvidencia | "confirmar" | "inspeccion" | null;
  inputArchivoRef: RefObject<HTMLInputElement | null>;
  setPasoActivo: Dispatch<SetStateAction<number>>;
  setNoAplica: Dispatch<SetStateAction<Set<AnguloEvidencia>>>;
  setInspeccion: Dispatch<SetStateAction<InspeccionEvidencia>>;
  onArchivoSeleccionado: (archivo: File | undefined) => void;
  onConfirm: () => void;
  onCapture: (angulo: AnguloEvidencia) => void;
  onGallery: (angulo: AnguloEvidencia) => void;
  onSaveInspection: () => void;
}) {
  const resultado = useMemo(() => evidenciaCompleta(fotos, tipo), [fotos, tipo]);
  const requisitos = useMemo(() => listaEvidenciaObligatoria(tipo), [tipo]);

  const pasoEsRevision = pasoActivo >= requisitos.length;
  const requisitoActivo = requisitos[Math.min(pasoActivo, requisitos.length - 1)];

  const fotoPorAngulo = useCallback(
    (angulo: AnguloEvidencia) =>
      fotos
        .filter((foto) => foto.angulo === angulo && foto.tipo === tipo)
        .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())[0],
    [fotos, tipo]
  );

  const requisitosCompletados = useMemo(
    () =>
      requisitos.filter((item) => {
        const foto = fotoPorAngulo(item.angulo);
        if (item.obligatorio) return Boolean(foto);
        return Boolean(foto) || noAplica.has(item.angulo);
      }).length,
    [requisitos, fotoPorAngulo, noAplica]
  );

  const camposInspeccionPendientes = useMemo(() => camposInspeccionFaltantes(inspeccion), [inspeccion]);
  const inspeccionCompletada = useMemo(() => totalCamposInspeccionCompletados(inspeccion), [inspeccion]);
  const requisitosTotales = requisitos.length + CAMPOS_INSPECCION_OBLIGATORIOS.length;
  const progresoTotal = requisitosCompletados + inspeccionCompletada;

  const etiquetasFaltantes = useMemo(
    () => [
      ...resultado.angulosFaltantes.map((angulo) => ETIQUETA_ANGULO[angulo as AnguloEvidencia] ?? angulo),
      ...camposInspeccionPendientes.map((campo) => campo.etiqueta)
    ],
    [resultado.angulosFaltantes, camposInspeccionPendientes]
  );
  const registroCompleto = resultado.completa && camposInspeccionPendientes.length === 0;

  const statusFor = useCallback(
    (item: EvidenceRequirement) => {
      const foto = fotoPorAngulo(item.angulo);
      if (foto) return "listo" as const;
      if (!item.obligatorio && noAplica.has(item.angulo)) return "omitido" as const;
      return "pendiente" as const;
    },
    [fotoPorAngulo, noAplica]
  );

  const onBackToMissing = useCallback(() => {
    const pendiente = requisitos.findIndex((item) => statusFor(item) === "pendiente");
    setPasoActivo(pendiente >= 0 ? pendiente : requisitos.length);
  }, [requisitos, statusFor, setPasoActivo]);

  const value = useMemo<EvidenceApi>(
    () => ({
      trasladoId,
      estadoActual,
      pasaporteActual,
      tipo,
      requisitos,
      requisitosCompletados,
      progresoTotal,
      requisitosTotales,
      pasoActivo,
      pasoEsRevision,
      requisitoActivo,
      aviso,
      resultado,
      registroCompleto,
      etiquetasFaltantes,
      pendientesSubida,
      sincronizando,
      inputArchivoRef,
      fotos,
      noAplica,
      inspeccion,
      camposInspeccionPendientes,
      inspeccionCompletada,
      enviando,
      statusFor,
      fotoPorAngulo,
      setPasoActivo,
      setNoAplica,
      setInspeccion,
      onArchivoSeleccionado,
      onBackToMissing,
      onConfirm,
      onCapture,
      onGallery,
      onSaveInspection
    }),
    [
      trasladoId, estadoActual, pasaporteActual, tipo, requisitos,
      requisitosCompletados, progresoTotal, requisitosTotales, pasoActivo,
      pasoEsRevision, requisitoActivo, aviso, resultado, registroCompleto,
      etiquetasFaltantes, pendientesSubida, sincronizando, inputArchivoRef,
      fotos, noAplica, inspeccion, camposInspeccionPendientes,
      inspeccionCompletada, enviando, statusFor, fotoPorAngulo,
      setPasoActivo, setNoAplica, setInspeccion, onArchivoSeleccionado,
      onBackToMissing, onConfirm, onCapture, onGallery, onSaveInspection
    ]
  );

  return <EvidenceCtx.Provider value={value}>{children}</EvidenceCtx.Provider>;
}
