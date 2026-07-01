import type { ButtonHTMLAttributes, ReactNode } from "react";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primario" | "secundario" | "fantasma" | "peligro";
  loading?: boolean;
  children: ReactNode;
}

const ESTILOS: Record<NonNullable<ButtonProps["variant"]>, string> = {
  primario: "bg-signal text-ink hover:bg-signal/90 focus-visible:outline-signal",
  secundario: "bg-ink text-mist hover:bg-ink/90 focus-visible:outline-ink",
  fantasma: "bg-transparent text-ink hover:bg-ink/5 focus-visible:outline-ink",
  peligro: "bg-danger text-mist hover:bg-danger/90 focus-visible:outline-danger"
};

export function Button({ variant = "primario", loading = false, disabled, className = "", children, ...props }: ButtonProps) {
  return (
    <button
      className={[
        "inline-flex items-center justify-center gap-2 rounded-full px-5 py-3",
        "font-body text-sm font-medium transition-colors",
        "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2",
        "disabled:cursor-not-allowed disabled:opacity-40",
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
