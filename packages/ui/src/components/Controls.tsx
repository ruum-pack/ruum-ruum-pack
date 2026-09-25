import type { ReactNode } from "react";

/** Controles de formulario V1.0: h 48, borde 7A8DAE, radio 12, foco azul + anillo, error C23648 + ícono. */
const INPUT =
  "min-h-[var(--ruum-input-height)] w-full rounded-[12px] border border-[var(--ruum-border-input)] bg-white px-3.5 py-2.5 font-body text-base text-[var(--ruum-navy)] transition-[border-color,box-shadow] duration-[var(--ruum-motion-micro)] placeholder:text-[var(--ruum-muted)] hover:border-[var(--ruum-navy)] focus:border-[var(--ruum-action)] focus:outline-none focus:ring-2 focus:ring-[var(--ruum-action)] focus:ring-offset-2 disabled:cursor-not-allowed disabled:border-[var(--ruum-border)] disabled:bg-[var(--ruum-neutral-bg)] disabled:text-[var(--ruum-muted)]";

function ErrorLine({ id, texto }: { id: string; texto: string }) {
  return (
    <p id={id} role="alert" className="flex items-center gap-1.5 font-body text-sm font-medium text-[var(--ruum-error-text)]">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden className="shrink-0">
        <path d="M12 8v5M12 16.5h.01M10.3 3.6 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.6a2 2 0 0 0-3.4 0Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      {texto}
    </p>
  );
}

export function Input({
  etiqueta,
  error,
  ayuda,
  id,
  className = "",
  ...props
}: React.InputHTMLAttributes<HTMLInputElement> & { etiqueta: string; error?: string; ayuda?: ReactNode }) {
  const inputId = id ?? props.name ?? "input";
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={inputId} className="font-body text-[13px] font-semibold text-[var(--ruum-navy)]">
        {etiqueta}
      </label>
      <input id={inputId} className={`${INPUT} ${error ? "border-[var(--ruum-error)]" : ""} ${className}`} aria-invalid={Boolean(error)} aria-describedby={error ? `${inputId}-error` : undefined} {...props} />
      {ayuda ? <p className="font-body text-sm text-[var(--ruum-muted)]">{ayuda}</p> : null}
      {error ? <ErrorLine id={`${inputId}-error`} texto={error} /> : null}
    </div>
  );
}

export function Select({
  etiqueta,
  error,
  children,
  id,
  className = "",
  ...props
}: React.SelectHTMLAttributes<HTMLSelectElement> & { etiqueta: string; error?: string; children: ReactNode }) {
  const inputId = id ?? props.name ?? "select";
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={inputId} className="font-body text-[13px] font-semibold text-[var(--ruum-navy)]">
        {etiqueta}
      </label>
      <select id={inputId} className={`${INPUT} ${error ? "border-[var(--ruum-error)]" : ""} ${className}`} aria-invalid={Boolean(error)} {...props}>
        {children}
      </select>
      {error ? <ErrorLine id={`${inputId}-error`} texto={error} /> : null}
    </div>
  );
}

export function Textarea({
  etiqueta,
  error,
  id,
  className = "",
  ...props
}: React.TextareaHTMLAttributes<HTMLTextAreaElement> & { etiqueta: string; error?: string }) {
  const inputId = id ?? props.name ?? "textarea";
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={inputId} className="font-body text-[13px] font-semibold text-[var(--ruum-navy)]">
        {etiqueta}
      </label>
      <textarea id={inputId} rows={4} className={`${INPUT} min-h-[112px] ${error ? "border-[var(--ruum-error)]" : ""} ${className}`} aria-invalid={Boolean(error)} {...props} />
      {error ? <ErrorLine id={`${inputId}-error`} texto={error} /> : null}
    </div>
  );
}

export function Checkbox({ etiqueta, className = "", ...props }: React.InputHTMLAttributes<HTMLInputElement> & { etiqueta: ReactNode }) {
  return (
    <label className={`flex min-h-[var(--ruum-touch)] cursor-pointer items-center gap-2.5 font-body text-base text-[var(--ruum-navy)] ${className}`}>
      <input type="checkbox" className="size-5 shrink-0 accent-[#0066FF] focus-visible:outline focus-visible:outline-[3px] focus-visible:outline-[var(--ruum-focus)] disabled:cursor-not-allowed" {...props} />
      <span>{etiqueta}</span>
    </label>
  );
}

export function Radio({ etiqueta, className = "", ...props }: React.InputHTMLAttributes<HTMLInputElement> & { etiqueta: ReactNode }) {
  return (
    <label className={`flex min-h-[var(--ruum-touch)] cursor-pointer items-center gap-2.5 font-body text-base text-[var(--ruum-navy)] ${className}`}>
      <input type="radio" className="size-5 shrink-0 accent-[#0066FF] focus-visible:outline focus-visible:outline-[3px] focus-visible:outline-[var(--ruum-focus)] disabled:cursor-not-allowed" {...props} />
      <span>{etiqueta}</span>
    </label>
  );
}

export function Toggle({
  etiqueta,
  checked,
  onCheckedChange,
  disabled,
  className = "",
}: {
  etiqueta: string;
  checked: boolean;
  onCheckedChange?: (v: boolean) => void;
  disabled?: boolean;
  className?: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={etiqueta}
      disabled={disabled}
      onClick={() => onCheckedChange?.(!checked)}
      className={`flex min-h-[var(--ruum-touch)] items-center gap-3 disabled:cursor-not-allowed disabled:opacity-50 ${className}`}
    >
      <span
        aria-hidden
        className={`relative h-7 w-12 shrink-0 rounded-full transition-colors ${checked ? "bg-[var(--ruum-teal-deep)]" : "bg-[var(--ruum-border-input)]"}`}
      >
        <span className={`absolute top-0.5 size-6 rounded-full bg-white shadow transition-all ${checked ? "left-[22px]" : "left-0.5"}`} />
      </span>
      <span className="font-body text-base text-[var(--ruum-navy)]">{etiqueta}</span>
    </button>
  );
}
