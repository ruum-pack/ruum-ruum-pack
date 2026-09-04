import type { ButtonHTMLAttributes, ReactNode } from "react";

export type ConductorButtonVariant = "primary" | "secondary" | "ghost" | "danger";
export type ConductorStatus = "assigned" | "pending" | "active" | "success" | "error" | "neutral";

const BUTTON_VARIANTS: Record<ConductorButtonVariant, string> = {
  primary: "conductor-button-primary",
  secondary: "conductor-button-secondary",
  ghost: "conductor-button-ghost",
  danger: "conductor-button-danger"
};

const STATUS_VARIANTS: Record<ConductorStatus, { icon: string; className: string }> = {
  assigned: { icon: "•", className: "conductor-status-badge-pending" },
  pending: { icon: "•", className: "conductor-status-badge-pending" },
  active: { icon: "↗", className: "conductor-status-badge-active" },
  success: { icon: "✓", className: "conductor-status-badge-success" },
  error: { icon: "!", className: "conductor-status-badge-error" },
  neutral: { icon: "i", className: "conductor-status-badge-neutral" }
};

export function conductorButtonClasses({
  variant = "primary",
  className = ""
}: {
  variant?: ConductorButtonVariant;
  className?: string;
} = {}) {
  return ["conductor-button", BUTTON_VARIANTS[variant], className].filter(Boolean).join(" ");
}

export function ConductorButton({
  variant = "primary",
  loading = false,
  disabled,
  className = "",
  children,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ConductorButtonVariant;
  loading?: boolean;
}) {
  return (
    <button
      {...props}
      className={conductorButtonClasses({ variant, className })}
      aria-busy={loading || undefined}
      disabled={disabled || loading}
    >
      {loading && <span className="conductor-button-spinner" aria-hidden />}
      {children}
    </button>
  );
}

export function ConductorStatusBadge({
  status,
  label,
  className = ""
}: {
  status: ConductorStatus;
  label: string;
  className?: string;
}) {
  const variant = STATUS_VARIANTS[status];

  return (
    <span className={["conductor-status-badge", variant.className, className].filter(Boolean).join(" ")}>
      <span aria-hidden className="conductor-status-badge-icon">{variant.icon}</span>
      {label}
    </span>
  );
}

export function ConductorOperationalCard({
  children,
  className = "",
  as: Element = "article"
}: {
  children: ReactNode;
  className?: string;
  as?: "article" | "section" | "div";
}) {
  return <Element className={["conductor-operational-card", className].filter(Boolean).join(" ")}>{children}</Element>;
}

export function ConductorFeedback({
  tone = "info",
  children,
  className = ""
}: {
  tone?: "info" | "warning" | "error" | "success";
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      role={tone === "error" ? "alert" : "status"}
      aria-live={tone === "error" ? "assertive" : "polite"}
      className={["conductor-feedback", `conductor-feedback-${tone}`, className].filter(Boolean).join(" ")}
    >
      {children}
    </div>
  );
}

