import type { ButtonHTMLAttributes, ReactNode } from "react";
import { Button, type ButtonProps } from "./Button";

/**
 * Botones del sistema V1.0 (cap. 19).
 * - ButtonPrimary: h 52 (56 calle), radio 14-16, degradado CTA teal-deep→azul, blanco Semibold 16. Uno por pantalla.
 * - ButtonSecondary: borde 1.5px + texto azul acción sobre blanco, sin degradado.
 * - ButtonText: azul acción Semibold, chevrón si navega.
 * Todos usan tokens, foco visible, áreas ≥44px (calle ≥56px vía .ruum-street).
 */

interface SystemButtonProps extends Omit<ButtonProps, "variant"> {
  children: ReactNode;
  street?: boolean;
}

function base(street: boolean | undefined, extra: string) {
  return [
    "min-h-[var(--ruum-button-height)]",
    street ? "min-h-[var(--ruum-button-height-street)] text-[17px]" : "",
    extra,
  ]
    .filter(Boolean)
    .join(" ");
}

export function ButtonPrimary({ children, street, className = "", ...props }: SystemButtonProps) {
  return (
    <Button
      variant="primary"
      data-variant="primary"
      className={base(street, `rounded-[14px] text-base font-semibold ${className}`)}
      {...(props as ButtonProps)}
    >
      {children}
    </Button>
  );
}

export function ButtonSecondary({ children, street, className = "", ...props }: SystemButtonProps) {
  return (
    <Button
      variant="secondary"
      data-variant="secondary"
      className={base(
        street,
        `rounded-[14px] border-[1.5px] border-[var(--ruum-action)] bg-white text-[var(--ruum-action)] text-base font-semibold ${className}`,
      )}
      {...(props as ButtonProps)}
    >
      {children}
    </Button>
  );
}

export function ButtonText({
  children,
  conChevron = false,
  className = "",
  ...props
}: SystemButtonProps & { conChevron?: boolean }) {
  return (
    <Button
      variant="quiet"
      data-variant="text"
      icon={conChevron ? "arrow" : "none"}
      className={`min-h-[var(--ruum-touch)] rounded-[12px] px-3 py-2 text-base font-semibold text-[var(--ruum-action)] ${className}`}
      {...(props as ButtonProps)}
    >
      {children}
    </Button>
  );
}

export type { ButtonHTMLAttributes };
