"use client";

import { useState, useCallback, useEffect, useRef } from "react";

/**
 * Hook para autoguardado con debounce
 * Recomendación US-002: Autoguardado en preferencias
 * 
 * @param saveFunction Función para guardar los datos
 * @param delay Milisegundos de espera antes de guardar (default: 2000ms)
 * @returns { save: Function, saving: boolean, lastSaved: Date | null }
 */
export function useAutosave<T = unknown>(
  saveFunction: (data: T) => Promise<void> | void,
  delay = 2000
): {
  save: (data: T) => void;
  saving: boolean;
  lastSaved: Date | null;
  cancel: () => void;
} {
  const [saving, setSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingDataRef = useRef<T | null>(null);

  const save = useCallback(
    (data: T) => {
      // Cancelar timeout anterior
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }

      // Guardar referencia a los datos pendientes
      pendingDataRef.current = data;

      // Iniciar nuevo timeout
      timeoutRef.current = setTimeout(async () => {
        const dataToSave = pendingDataRef.current;
        if (dataToSave !== null) {
          setSaving(true);
          try {
            await saveFunction(dataToSave);
            setLastSaved(new Date());
          } catch (error) {
            console.error("Error al autoguardar:", error);
          } finally {
            setSaving(false);
            pendingDataRef.current = null;
          }
        }
      }, delay);
    },
    [saveFunction, delay]
  );

  const cancel = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    pendingDataRef.current = null;
  }, []);

  // Limpiar timeout al desmontar
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  return { save, saving, lastSaved, cancel };
}

/**
 * Hook simplificado para autoguardado de formularios
 * Guardar automáticamente cuando los valores cambian
 */
export function useFormAutosave<T extends Record<string, unknown>>(
  initialValues: T,
  onSave: (values: T) => Promise<void> | void,
  delay = 2000
): [T, (name: string, value: unknown) => void, boolean, Date | null] {
  const [values, setValues] = useState<T>(initialValues);
  const { save, saving, lastSaved } = useAutosave<T>(onSave, delay);

  const handleChange = useCallback(
    (name: string, value: unknown) => {
      const newValues = { ...values, [name]: value };
      setValues(newValues);
      save(newValues);
    },
    [values, save]
  );

  return [values, handleChange, saving, lastSaved];
}
