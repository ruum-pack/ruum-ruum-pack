import type { ButtonHTMLAttributes, ReactNode } from "react";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primario" | "secundario" | "fantasma" | "peligro";
  children: ReactNode;
}

const ESTILOS: Record<NonNullable<ButtonProps["variant"]>, string> = {
  primario: "bg-signal text-paper hover:bg-signal/90 focus-visible:outline-signal",
  secundario: "bg-ink text-paper hover:bg-ink/90 focus-visible:outline-ink",
  fantasma: "bg-transparent text-ink hover:bg-ink/5 focus-visible:outline-ink",
  peligro: "bg-danger text-paper hover:bg-danger/90 focus-visible:outline-danger"
};

export function Button({ variant = "primario", className = "", children, ...props }: ButtonProps) {
  return (
    <button
      className={[
        "inline-flex items-center justify-center gap-2 rounded-full px-5 py-2.5",
        "font-body text-sm font-medium transition-colors",
        "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2",
        "disabled:cursor-not-allowed disabled:opacity-40",
        ESTILOS[variant],
        className
      ].join(" ")}
      {...props}
    >
      {children}
    </button>
  );
}
