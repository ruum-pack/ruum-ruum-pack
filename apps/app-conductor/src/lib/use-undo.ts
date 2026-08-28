"use client";

import { useCallback, useRef, useState } from "react";

/**
 * Hook para implementar funcionalidad de undo/redo en formularios
 * (Recomendación US-001)
 */
export function useUndo<T>(initialValue: T, maxHistory = 10): {
  value: T;
  setValue: (newValue: T) => void;
  undo: () => void;
  redo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  history: T[];
  clearHistory: () => void;
} {
  const [value, setValueInternal] = useState<T>(initialValue);
  const [history, setHistory] = useState<T[]>([initialValue]);
  const [currentIndex, setCurrentIndex] = useState<number>(0);
  const ignoreNext = useRef(false);

  const setValue = useCallback(
    (newValue: T) => {
      if (ignoreNext.current) {
        ignoreNext.current = false;
        setValueInternal(newValue);
        return;
      }

      const newHistory = history.slice(0, currentIndex + 1);
      newHistory.push(newValue);

      // Limitar tamaño del historial
      if (newHistory.length > maxHistory) {
        newHistory.shift();
        setCurrentIndex(currentIndex - 1);
      } else {
        setCurrentIndex(newHistory.length - 1);
      }

      setHistory(newHistory);
      setValueInternal(newValue);
    },
    [history, currentIndex, maxHistory]
  );

  const undo = useCallback(() => {
    if (currentIndex <= 0) return;

    const newIndex = currentIndex - 1;
    ignoreNext.current = true;
    setCurrentIndex(newIndex);
    setValueInternal(history[newIndex]);
  }, [currentIndex, history]);

  const redo = useCallback(() => {
    if (currentIndex >= history.length - 1) return;

    const newIndex = currentIndex + 1;
    ignoreNext.current = true;
    setCurrentIndex(newIndex);
    setValueInternal(history[newIndex]);
  }, [currentIndex, history]);

  const clearHistory = useCallback(() => {
    setHistory([value]);
    setCurrentIndex(0);
  }, [value]);

  return {
    value,
    setValue,
    undo,
    redo,
    canUndo: currentIndex > 0,
    canRedo: currentIndex < history.length - 1,
    history,
    clearHistory
  };
}

/**
 * Versión simplificada para campos individuales
 */
export function useFieldUndo<T>(initialValue: T, delay = 2000): {
  value: T;
  setValue: (newValue: T) => void;
  undo: () => void;
  canUndo: boolean;
} {
  const [value, setValue] = useState<T>(initialValue);
  const [previousValue, setPreviousValue] = useState<T | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const setValueWithUndo = useCallback(
    (newValue: T) => {
      // Guardar valor anterior
      if (previousValue === null) {
        setPreviousValue(value);
      }

      // Limpiar timeout anterior
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }

      setValue(newValue);

      // Después del delay, limpiar el historial de undo
      timeoutRef.current = setTimeout(() => {
        setPreviousValue(null);
      }, delay);
    },
    [value, previousValue, delay]
  );

  const undo = useCallback(() => {
    if (previousValue !== null) {
      setValue(previousValue);
      setPreviousValue(null);
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    }
  }, [previousValue]);

  return {
    value,
    setValue: setValueWithUndo,
    undo,
    canUndo: previousValue !== null
  };
}
