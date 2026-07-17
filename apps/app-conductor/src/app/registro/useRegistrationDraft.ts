import { useCallback, useEffect, useState } from "react";
import {
  guardarBorradorRegistroLocal,
  leerBorradorRegistroLocal,
  limpiarBorradorRegistroLocal,
  type BorradorRegistroLocal
} from "../../lib/borrador-registro";
import { soloDigitos } from "./registration-validation";

const RETRASO_GUARDADO_LOCAL_MS = 600;

type DraftSnapshot = {
  paso: number;
  nombre: string;
  apellidos: string;
  telefono: string;
  email: string;
  codigoPostal: string;
  estado: string;
  ciudad: string;
  colonia: string;
  tipoLicencia: string;
  vigenciaLicencia: string;
};

export function useRegistrationDraft({
  enabled,
  snapshot,
  onRestore
}: {
  enabled: boolean;
  snapshot: DraftSnapshot;
  onRestore: (borrador: BorradorRegistroLocal) => void;
}) {
  const [borradorDisponible, setBorradorDisponible] = useState<BorradorRegistroLocal | null>(null);
  const [borradorLocalGuardado, setBorradorLocalGuardado] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setBorradorDisponible(leerBorradorRegistroLocal()), 0);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!enabled) return;
    const hayContenido = [snapshot.nombre, snapshot.apellidos, snapshot.telefono, snapshot.email, snapshot.codigoPostal]
      .some((valor) => valor.trim());
    if (!hayContenido) return;

    const timer = setTimeout(() => {
      guardarBorradorRegistroLocal(snapshot);
      setBorradorLocalGuardado(true);
    }, RETRASO_GUARDADO_LOCAL_MS);

    return () => clearTimeout(timer);
  }, [enabled, snapshot]);

  const restaurarBorrador = useCallback(() => {
    const borrador = borradorDisponible;
    if (!borrador) return;
    onRestore({
      ...borrador,
      telefono: soloDigitos(borrador.telefono ?? ""),
      codigoPostal: soloDigitos(borrador.codigoPostal ?? "", 5)
    });
    setBorradorDisponible(null);
  }, [borradorDisponible, onRestore]);

  const descartarBorrador = useCallback(() => {
    limpiarBorradorRegistroLocal();
    setBorradorDisponible(null);
  }, []);

  return {
    borradorDisponible,
    borradorLocalGuardado,
    restaurarBorrador,
    descartarBorrador
  };
}
