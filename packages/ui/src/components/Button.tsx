import type { ButtonHTMLAttributes, ReactNode } from "react";

export type ButtonVariant = "primary" | "secondary" | "quiet" | "danger" | "emergency";
export type ButtonIcon = "arrow" | "check" | "warning" | "phone" | "send" | "none";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  icon?: ButtonIcon;
  loading?: boolean;
  children: ReactNode;
}

/**
 * Botón operativo compartido.
 * Variantes semánticas:
 * - primary: CTA principal único del bloque.
 * - secondary: apoyo o navegación.
 * - quiet: acción terciaria de baja prominencia.
 * - danger: acción destructiva o irreversible.
 * - emergency: acción crítica de seguridad; siempre incluye icono.
 */
const ESTILOS: Record<NonNullable<ButtonProps["variant"]>, string> = {
  primary:
    "border border-action-primary bg-action-primary text-text-primary shadow-sm hover:-translate-y-0.5 hover:bg-action-primary-hover hover:shadow-md active:translate-y-0 active:bg-action-primary-active focus-visible:outline-route-action",
  secondary:
    "border border-border-strong bg-surface text-text-primary shadow-sm hover:-translate-y-0.5 hover:border-route-action hover:bg-surface-elevated hover:shadow-md active:translate-y-0 active:bg-surface-elevated focus-visible:outline-route-action",
  quiet:
    "border border-transparent bg-transparent text-route-action hover:bg-route-soft hover:text-route-action active:bg-route-soft focus-visible:outline-route-action",
  danger:
    "border border-danger-action bg-danger-action text-surface shadow-sm hover:-translate-y-0.5 hover:bg-danger-action-hover hover:shadow-md active:translate-y-0 active:bg-danger-action-active focus-visible:outline-danger-action",
  emergency:
    "border-2 border-danger-action bg-danger-action text-surface shadow-md hover:-translate-y-0.5 hover:bg-danger-action-hover hover:shadow-lg active:translate-y-0 active:bg-danger-action-active focus-visible:outline-danger-action"
};

const ICONO_DEFAULT: Record<ButtonVariant, ButtonIcon> = {
  primary: "arrow",
  secondary: "none",
  quiet: "none",
  danger: "warning",
  emergency: "phone"
};

export function Button({ variant = "primary", icon, loading = false, disabled, className = "", children, ...props }: ButtonProps) {
  const icono = icon ?? ICONO_DEFAULT[variant];

  return (
    <button
      className={[
        "inline-flex min-h-12 min-w-12 items-center justify-center gap-2 rounded-xl px-5 py-3",
        "font-display text-sm font-bold leading-5 transition-[background-color,border-color,box-shadow,transform] duration-150",
        "focus-visible:outline focus-visible:outline-[3px] focus-visible:outline-offset-2",
        "disabled:cursor-not-allowed disabled:transform-none disabled:border-border disabled:bg-surface-elevated disabled:text-disabled disabled:shadow-none",
        ESTILOS[variant],
        className
      ].join(" ")}
      {...props}
      aria-busy={loading || undefined}
      disabled={disabled || loading}
    >
      {loading && <span className="size-4 animate-spin rounded-full border-2 border-current border-t-transparent" aria-hidden />}
      {!loading && icono !== "none" && <ButtonIcono name={icono} />}
      {children}
    </button>
  );
}

function ButtonIcono({ name }: { name: Exclude<ButtonIcon, "none"> }) {
  const common = {
    className: "size-4 shrink-0",
    "aria-hidden": true,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: "2",
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const
  };

  if (name === "warning") {
    return (
      <svg {...common}>
        <path d="M10.3 3.6 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.6a2 2 0 0 0-3.4 0Z" />
        <path d="M12 9v4" />
        <path d="M12 17h.01" />
      </svg>
    );
  }

  if (name === "phone") {
    return (
      <svg {...common}>
        <path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.4 19.4 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1 1 .4 1.9.7 2.8a2 2 0 0 1-.5 2.1L8.1 9.9a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.5c.9.3 1.8.6 2.8.7A2 2 0 0 1 22 16.9Z" />
      </svg>
    );
  }

  if (name === "check") {
    return (
      <svg {...common}>
        <path d="m20 6-11 11-5-5" />
      </svg>
    );
  }

  if (name === "send") {
    return (
      <svg {...common}>
        <path d="m22 2-7 20-4-9-9-4Z" />
        <path d="M22 2 11 13" />
      </svg>
    );
  }

  return (
    <svg {...common}>
      <path d="M5 12h14" />
      <path d="m13 6 6 6-6 6" />
    </svg>
  );
}
