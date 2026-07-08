import type { ButtonHTMLAttributes, ReactNode } from "react";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primario" | "secundario" | "fantasma" | "ruta" | "peligro";
  loading?: boolean;
  children: ReactNode;
}

/**
 * Botón operativo compartido.
 * - Primario: acción de alta intención (CTA dorado).
 * - Secundario: acción de apoyo y navegación, con superficie clara.
 * - Fantasma: acciones terciarias en contextos densos.
 * - Ruta: acciones relacionadas con localización o seguimiento.
 * - Peligro: acciones irreversibles.
 */
const ESTILOS: Record<NonNullable<ButtonProps["variant"]>, string> = {
  primario:
    "border border-signal bg-signal text-ink shadow-sm hover:-translate-y-0.5 hover:bg-[#d88f16] hover:shadow-md active:translate-y-0 active:bg-[#c77f0a] focus-visible:outline-route-dark",
  secundario:
    "border border-ink/25 bg-mist text-ink shadow-sm hover:-translate-y-0.5 hover:border-route-dark hover:bg-mist-dim hover:shadow-md active:translate-y-0 active:bg-[#e9ecf0] focus-visible:outline-route-dark",
  fantasma:
    "border border-transparent bg-transparent text-route-dark hover:bg-route-soft hover:text-route-dark active:bg-[#c7e2ff] focus-visible:outline-route-dark",
  ruta:
    "border border-route-dark bg-route-dark text-mist shadow-sm hover:-translate-y-0.5 hover:bg-[#0a4b8c] hover:shadow-md active:translate-y-0 active:bg-[#083c70] focus-visible:outline-route-dark",
  peligro:
    "border border-danger bg-danger text-mist shadow-sm hover:-translate-y-0.5 hover:bg-[#8f1d1d] hover:shadow-md active:translate-y-0 active:bg-[#751616] focus-visible:outline-danger"
};

export function Button({ variant = "primario", loading = false, disabled, className = "", children, ...props }: ButtonProps) {
  return (
    <button
      className={[
        "inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-5 py-3",
        "font-display text-sm font-bold leading-5 transition-[background-color,border-color,box-shadow,transform] duration-150",
        "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2",
        "disabled:cursor-not-allowed disabled:transform-none disabled:opacity-45 disabled:shadow-none",
        ESTILOS[variant],
        className
      ].join(" ")}
      {...props}
      aria-busy={loading || undefined}
      disabled={disabled || loading}
    >
      {loading && <span className="size-4 animate-spin rounded-full border-2 border-current border-t-transparent" aria-hidden />}
      {children}
    </button>
  );
}
