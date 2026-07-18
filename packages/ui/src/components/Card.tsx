import type { ReactNode } from "react";

type CardPadding = "none" | "sm" | "md" | "lg";

export interface CardProps {
  children: ReactNode;
  className?: string;
  padding?: CardPadding;
  elevated?: boolean;
}

type VariantCardProps = Omit<CardProps, "elevated">;

export interface TripCardProps extends VariantCardProps {
  folio?: string;
}

const PADDING: Record<CardPadding, string> = {
  none: "",
  sm: "p-4",
  md: "p-5 sm:p-6",
  lg: "p-6 sm:p-7"
};

function joinClasses(...classes: Array<string | false | undefined>) {
  return classes.filter(Boolean).join(" ");
}

export function Card({ children, className = "", padding = "md", elevated = false }: CardProps) {
  return (
    <section
      className={joinClasses(
        "rounded-card border border-border bg-surface",
        elevated ? "shadow-2" : "shadow-1",
        PADDING[padding],
        className
      )}
    >
      {children}
    </section>
  );
}

export function OperationalCard({ children, className = "", padding = "md" }: VariantCardProps) {
  return (
    <section
      className={joinClasses(
        "rounded-card border border-route-action bg-route-soft shadow-2",
        "ring-1 ring-route-action/10",
        PADDING[padding],
        className
      )}
    >
      {children}
    </section>
  );
}

export function TripCard({ children, className = "", padding = "md", folio }: TripCardProps) {
  return (
    <article
      className={joinClasses(
        "relative rounded-card border border-border-strong bg-surface shadow-1",
        "transition-[border-color,box-shadow,transform] duration-200 hover:border-route-action hover:shadow-2",
        PADDING[padding],
        className
      )}
    >
      {folio && (
        <span className="absolute right-3 top-3 rounded-full border border-route-action bg-route-soft px-2.5 py-1 font-body text-xs font-semibold text-route-action">
          Folio {folio}
        </span>
      )}
      {children}
    </article>
  );
}

export function FinancialCard({ children, className = "", padding = "md" }: VariantCardProps) {
  return (
    <section
      className={joinClasses(
        "rounded-2xl border border-[rgba(122,162,214,0.22)] bg-[#101A2C] text-[#E8EDF6] shadow-[0_10px_28px_rgba(0,0,0,0.30)]",
        PADDING[padding],
        className
      )}
    >
      {children}
    </section>
  );
}

export function AlertCard({ children, className = "", padding = "md" }: VariantCardProps) {
  return (
    <section
      className={joinClasses(
        "rounded-card border border-warning bg-warn-soft shadow-1",
        PADDING[padding],
        className
      )}
    >
      {children}
    </section>
  );
}
