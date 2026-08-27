"use client";

import { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";

/**
 * Componente para Guided Tour (Recorrido guiado)
 * Recomendación US-004
 * 
 * Este componente proporciona un recorrido guiado para nuevos usuarios
 * sin depender de librerías externas.
 */

interface TourStep {
  id: string;
  target: () => HTMLElement | null;
  title: string;
  description: string;
  position?: "top" | "bottom" | "left" | "right";
  showArrow?: boolean;
}

interface GuidedTourProps {
  steps: TourStep[];
  isOpen: boolean;
  onClose: () => void;
  currentStep: number;
  onNext: () => void;
  onPrev: () => void;
}

// Estilos CSS-in-JS para el tooltip
const tooltipStyles = {
  base: "fixed z-50 max-w-xs p-5 rounded-2xl border border-border/40 bg-surface-elevated shadow-2xl",
  title: "font-display text-sm font-bold text-text-primary mb-2",
  description: "font-body text-xs text-text-secondary leading-relaxed",
  arrow: "absolute w-4 h-4 bg-surface-elevated border border-border/40",
  button: "inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border border-border bg-surface px-4 py-2 font-display text-xs font-bold text-text-primary hover:bg-surface-elevated transition-colors",
  buttonPrimary: "inline-flex min-h-10 items-center justify-center gap-2 rounded-xl bg-signal px-4 py-2 font-display text-xs font-bold text-slate-950 hover:bg-signal/90 transition-colors",
} as const;

const arrowPositions = {
  top: {
    tooltip: "bottom-full mb-2",
    arrow: "top-full -translate-y-1/2 rotate-45",
  },
  bottom: {
    tooltip: "top-full mt-2",
    arrow: "bottom-full translate-y-1/2 -rotate-45",
  },
  left: {
    tooltip: "right-full mr-2",
    arrow: "left-full -translate-x-1/2 rotate-45",
  },
  right: {
    tooltip: "left-full ml-2",
    arrow: "right-full translate-x-1/2 -rotate-45",
  },
} as const;

/** Overlay oscuro que resalta el elemento objetivo */
function SpotlightOverlay({ targetElement }: { targetElement: HTMLElement | null }) {
  const [rect, setRect] = useState<DOMRect | null>(null);

  useEffect(() => {
    if (targetElement) {
      const rect = targetElement.getBoundingClientRect();
      setRect(rect);
    }
  }, [targetElement]);

  if (!rect || !targetElement) return null;

  const style: React.CSSProperties = {
    position: "fixed",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 40,
    pointerEvents: "none",
    backgroundColor: "rgba(0, 0, 0, 0.7)",
    clipPath: `path('M0,0 L${window.innerWidth},0 L${window.innerWidth},${window.innerHeight} L0,${window.innerHeight} L0,0 Z M${rect.left + window.scrollX},${rect.top + window.scrollY} L${rect.left + rect.width + window.scrollX},${rect.top + window.scrollY} L${rect.left + rect.width + window.scrollX},${rect.top + rect.height + window.scrollY} L${rect.left + window.scrollX},${rect.top + rect.height + window.scrollY} Z')`,
  };

  return <div style={style} />;
}

/** Tooltip del tour */
function TourTooltip({
  title,
  description,
  position = "bottom",
  onNext,
  onPrev,
  onClose,
  isFirst,
  isLast,
}: {
  title: string;
  description: string;
  position: "top" | "bottom" | "left" | "right";
  onNext: () => void;
  onPrev: () => void;
  onClose: () => void;
  isFirst: boolean;
  isLast: boolean;
}) {
  const pos = arrowPositions[position];

  return (
    <div className={`absolute ${pos.tooltip}`} role="tooltip">
      <div className={tooltipStyles.base}>
        <h3 className={tooltipStyles.title}>{title}</h3>
        <p className={tooltipStyles.description}>{description}</p>
        <div className="mt-4 flex gap-2 justify-end">
          {!isFirst && (
            <button
              type="button"
              onClick={onPrev}
              className={tooltipStyles.button}
            >
              ← Anterior
            </button>
          )}
          {isLast ? (
            <button
              type="button"
              onClick={onClose}
              className={tooltipStyles.buttonPrimary}
            >
              Terminar
            </button>
          ) : (
            <button
              type="button"
              onClick={onNext}
              className={tooltipStyles.buttonPrimary}
            >
              Siguiente →
            </button>
          )}
        </div>
      </div>
      {/* Flecha del tooltip */}
      {pos.arrow && (
        <div
          className={`absolute ${pos.arrow}`}
          style={{ transformOrigin: "center" }}
        />
      )}
    </div>
  );
}

export function GuidedTour({
  steps,
  isOpen,
  onClose,
  currentStep,
  onNext,
  onPrev,
}: GuidedTourProps) {
  const [mounted, setMounted] = useState(false);
  const [targetElement, setTargetElement] = useState<HTMLElement | null>(null);
  const [tooltipPosition, setTooltipPosition] = useState<"top" | "bottom" | "left" | "right">(
    steps[currentStep]?.position || "bottom"
  );

  useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
  }, []);

  useEffect(() => {
    if (isOpen && steps[currentStep]) {
      const target = steps[currentStep].target();
      setTargetElement(target);
      setTooltipPosition(steps[currentStep].position || "bottom");
    }
  }, [isOpen, currentStep, steps]);

  // Calcular posición del tooltip basado en el elemento objetivo
  const calculateTooltipPosition = useCallback(() => {
    if (!targetElement) return "bottom";

    const rect = targetElement.getBoundingClientRect();
    const viewportHeight = window.innerHeight;
    const viewportWidth = window.innerWidth;

    // Si el elemento está en la parte inferior
    if (rect.bottom > viewportHeight * 0.7) {
      return "top";
    }
    // Si el elemento está en la parte superior
    if (rect.top < viewportHeight * 0.3) {
      return "bottom";
    }
    // Si el elemento está muy a la izquierda
    if (rect.left < viewportWidth * 0.2) {
      return "right";
    }
    // Si el elemento está muy a la derecha
    if (rect.right > viewportWidth * 0.8) {
      return "left";
    }

    return "bottom";
  }, [targetElement]);

  // Recalcular posición cuando cambie el elemento
  useEffect(() => {
    if (targetElement) {
      setTooltipPosition(calculateTooltipPosition());
    }
  }, [targetElement, calculateTooltipPosition]);

  // Cerrar con Escape
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen || !mounted || !targetElement) return null;

  const current = steps[currentStep];
  if (!current) return null;

  // Calcular posición para el tooltip
  const getTooltipContainerStyle = () => {
    const rect = targetElement.getBoundingClientRect();
    const pos = arrowPositions[tooltipPosition];

    return {
      position: "fixed",
      top: 
        tooltipPosition === "top"
          ? `${rect.top + window.scrollY - 10}px`
          : tooltipPosition === "bottom"
          ? `${rect.bottom + window.scrollY + 10}px`
          : "auto",
      left:
        tooltipPosition === "left"
          ? `${rect.left + window.scrollX - 200 - 10}px`
          : tooltipPosition === "right"
          ? `${rect.right + window.scrollX + 10}px`
          : `${rect.left + window.scrollX + rect.width / 2 - 100}px`,
      transform:
        tooltipPosition === "top" || tooltipPosition === "bottom"
          ? "translateX(-50%)"
          : "none",
      zIndex: 50,
    } as React.CSSProperties;
  };

  return createPortal(
    <>
      <SpotlightOverlay targetElement={targetElement} />
      <div
        style={getTooltipContainerStyle()}
        role="dialog"
        aria-modal="true"
        aria-label={`Paso ${currentStep + 1} de ${steps.length}: ${current.title}`}
      >
        <TourTooltip
          title={current.title}
          description={current.description}
          position={tooltipPosition}
          onNext={onNext}
          onPrev={onPrev}
          onClose={onClose}
          isFirst={currentStep === 0}
          isLast={currentStep === steps.length - 1}
        />
      </div>
    </>,
    document.body
  );
}

/**
 * Hook para gestionar el estado del guided tour
 */
export function useGuidedTour(totalSteps: number) {
  const [isOpen, setIsOpen] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);

  const onNext = useCallback(() => {
    setCurrentStep((prev) => Math.min(prev + 1, totalSteps - 1));
  }, [totalSteps]);

  const onPrev = useCallback(() => {
    setCurrentStep((prev) => Math.max(prev - 1, 0));
  }, []);

  const onClose = useCallback(() => {
    setIsOpen(false);
    setCurrentStep(0);
  }, []);

  const onOpen = useCallback(() => {
    setIsOpen(true);
    setCurrentStep(0);
  }, []);

  return {
    isOpen,
    currentStep,
    onNext,
    onPrev,
    onClose,
    onOpen,
    canGoNext: currentStep < totalSteps - 1,
    canGoPrev: currentStep > 0,
  };
}

/**
 * Tour predefinido para el onboarding del conductor
 */
export const ONBOARDING_TOUR_STEPS: TourStep[] = [
  {
    id: "welcome",
    target: () => document.querySelector("[aria-label='Saltar al contenido principal']") as HTMLElement,
    title: "Bienvenido a Ruum Conductor",
    description: "Esta es tu aplicación para gestionar traslados. Te mostraremos las funciones principales.",
    position: "bottom",
  },
  {
    id: "header",
    target: () => document.querySelector("header[role='banner']") as HTMLElement,
    title: "Encabezado",
    description: "Aquí verás el logo de Ruum y la navegación principal en desktop.",
    position: "bottom",
  },
  {
    id: "nav-mobile",
    target: () => document.querySelector("nav[aria-label*='móvil']") as HTMLElement,
    title: "Navegación Móvil",
    description: "En móvil, la navegación está al final de la pantalla para fácil acceso con el pulgar.",
    position: "top",
  },
  {
    id: "availability",
    target: () => document.querySelector("[role='switch']") as HTMLElement,
    title: "Disponibilidad",
    description: "Activa o desactiva tu disponibilidad para recibir traslados. Vibrará al cambiar.",
    position: "top",
  },
  {
    id: "active-trip",
    target: () => document.querySelector(".conductor-mobile-active-trip-card") as HTMLElement,
    title: "Viaje Activo",
    description: "Cuando tengas un viaje asignado, aparecerá aquí para acceso rápido.",
    position: "top",
  },
  {
    id: "metrics",
    target: () => document.querySelector("[aria-labelledby='titulo-estado-conductor']") as HTMLElement,
    title: "Estado del Conductor",
    description: "Aquí verás tu estado actual y métricas de reglado.",
    position: "bottom",
  },
];

/**
 * Tour predefinido para el panel
 */
export const PANEL_TOUR_STEPS: TourStep[] = [
  {
    id: "status",
    target: () => document.querySelector("section[aria-labelledby='titulo-estado-conductor']") as HTMLElement,
    title: "Estado del Conductor",
    description: "Aquí controlas tu disponibilidad. El switch te permite activarte o pausar los traslados.",
    position: "bottom",
  },
  {
    id: "trip-card",
    target: () => document.querySelector("[class*='PanelActiveTripCard']") as HTMLElement,
    title: "Tarjeta de Viaje Activo",
    description: "Cuando tengas un viaje asignado, aquí verás toda la información importante y podrás continuar con el traslado.",
    position: "top",
  },
  {
    id: "metrics",
    target: () => document.querySelector("[class*='PanelMetrics']") as HTMLElement,
    title: "Métricas Diarias",
    description: "Aquí verás tus ganancias y traslados del día. El bono se desbloquea después de 3 traslados.",
    position: "top",
  },
  {
    id: "health",
    target: () => document.querySelector("[class*='PanelOperationalHealth']") as HTMLElement,
    title: "Salud Operacional",
    description: "Monitorea el estado de tus documentos, GPS y conexión. Todo debe estar en verde para operar.",
    position: "top",
  },
];
