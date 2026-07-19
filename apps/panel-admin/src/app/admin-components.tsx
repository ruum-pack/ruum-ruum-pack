"use client";

import {
  Children,
  cloneElement,
  isValidElement,
  useEffect,
  useId,
  useRef,
  useState,
  type ButtonHTMLAttributes,
  type ComponentPropsWithoutRef,
  type KeyboardEvent,
  type ReactElement,
  type ReactNode,
  type RefObject
} from "react";

function unir(...clases: Array<string | false | null | undefined>) {
  return clases.filter(Boolean).join(" ");
}

type TonoAdmin = "neutral" | "info" | "success" | "warning" | "danger";

const tonoBadge: Record<TonoAdmin, string> = {
  neutral: "border-ink/15 bg-ink/[0.04] text-text-secondary",
  info: "border-status-info/30 bg-status-info-soft text-status-info",
  success: "border-status-success/30 bg-status-success-soft text-status-success",
  warning: "border-status-warning/35 bg-status-warning-soft text-status-warning",
  danger: "border-status-error/30 bg-status-error-soft text-status-error"
};

const botonVariante = {
  primary: "border-signal bg-signal text-ink hover:bg-signal/90",
  secondary: "border-border-default bg-surface-primary text-ink hover:bg-surface-secondary",
  quiet: "border-transparent bg-transparent text-text-secondary hover:bg-surface-secondary hover:text-ink",
  danger: "border-status-error/30 bg-status-error-soft text-status-error hover:bg-status-error hover:text-background-main"
} as const;

type AdminButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: keyof typeof botonVariante;
  loading?: boolean;
};

export function AdminButton({ variant = "primary", loading = false, disabled, className, children, ...props }: AdminButtonProps) {
  return (
    <button
      {...props}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={unir(
        "inline-flex min-h-10 min-w-10 items-center justify-center gap-2 rounded-lg border px-4 py-2 font-body text-admin-boton font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-60",
        botonVariante[variant],
        className
      )}
    >
      {loading ? "Procesando..." : children}
    </button>
  );
}

type AdminIconButtonProps = Omit<AdminButtonProps, "children"> & {
  "aria-label": string;
  icon: ReactNode;
};

export function AdminIconButton({ icon, className, variant = "quiet", ...props }: AdminIconButtonProps) {
  return (
    <AdminButton {...props} variant={variant} className={unir("size-10 px-0 py-0", className)}>
      <span aria-hidden="true" className="flex items-center justify-center">
        {icon}
      </span>
    </AdminButton>
  );
}

type CampoBaseProps = {
  label: string;
  description?: string;
  error?: string;
  className?: string;
  controlClassName?: string;
};

function useCampoIds(idProp?: string) {
  const generado = useId();
  const id = idProp ?? generado;
  return {
    id,
    descripcionId: `${id}-descripcion`,
    errorId: `${id}-error`
  };
}

function CampoMarco({ label, htmlFor, description, error, descriptionId, errorId, children, className }: CampoBaseProps & {
  htmlFor: string;
  descriptionId: string;
  errorId: string;
  children: ReactNode;
}) {
  return (
    <label className={unir("block font-body text-sm font-medium text-ink", className)} htmlFor={htmlFor}>
      <span className="block">{label}</span>
      {description && <span id={descriptionId} className="mt-1 block text-admin-secundario text-text-tertiary">{description}</span>}
      <span className="mt-1.5 block">{children}</span>
      {error && <span id={errorId} className="mt-1 block text-admin-secundario text-status-error">{error}</span>}
    </label>
  );
}

const campoClase = "w-full rounded-lg border border-ink/20 bg-surface-primary px-3.5 py-2.5 font-body text-sm text-ink placeholder:text-text-tertiary focus:border-focus-default focus:outline-none focus:ring-2 focus:ring-focus-default/20 disabled:cursor-not-allowed disabled:opacity-60";

export function AdminInput({ label, description, error, className, controlClassName, id: idProp, ...props }: CampoBaseProps & ComponentPropsWithoutRef<"input">) {
  const { id, descripcionId, errorId } = useCampoIds(idProp);
  const describedBy = [description && descripcionId, error && errorId].filter(Boolean).join(" ") || undefined;
  return (
    <CampoMarco label={label} htmlFor={id} description={description} error={error} descriptionId={descripcionId} errorId={errorId} className={className}>
      <input {...props} id={id} aria-invalid={Boolean(error) || undefined} aria-describedby={describedBy} className={unir(campoClase, controlClassName)} />
    </CampoMarco>
  );
}

export function AdminSelect({ label, description, error, className, controlClassName, id: idProp, children, ...props }: CampoBaseProps & ComponentPropsWithoutRef<"select">) {
  const { id, descripcionId, errorId } = useCampoIds(idProp);
  const describedBy = [description && descripcionId, error && errorId].filter(Boolean).join(" ") || undefined;
  return (
    <CampoMarco label={label} htmlFor={id} description={description} error={error} descriptionId={descripcionId} errorId={errorId} className={className}>
      <select {...props} id={id} aria-invalid={Boolean(error) || undefined} aria-describedby={describedBy} className={unir(campoClase, controlClassName)}>
        {children}
      </select>
    </CampoMarco>
  );
}

export function AdminTextarea({ label, description, error, className, controlClassName, id: idProp, ...props }: CampoBaseProps & ComponentPropsWithoutRef<"textarea">) {
  const { id, descripcionId, errorId } = useCampoIds(idProp);
  const describedBy = [description && descripcionId, error && errorId].filter(Boolean).join(" ") || undefined;
  return (
    <CampoMarco label={label} htmlFor={id} description={description} error={error} descriptionId={descripcionId} errorId={errorId} className={className}>
      <textarea {...props} id={id} aria-invalid={Boolean(error) || undefined} aria-describedby={describedBy} className={unir(campoClase, "min-h-28 resize-y", controlClassName)} />
    </CampoMarco>
  );
}

function obtenerControles(contenedor: HTMLElement | null) {
  return Array.from(contenedor?.querySelectorAll<HTMLElement>("button, [href], input, select, textarea, [tabindex]:not([tabindex='-1'])") ?? [])
    .filter((elemento) => !elemento.hasAttribute("disabled") && elemento.getAttribute("aria-hidden") !== "true");
}

function useCapaModal(abierto: boolean, onClose: () => void, ref: RefObject<HTMLElement | null>, finalFocusRef?: RefObject<HTMLElement | null>) {
  const focoPrevio = useRef<HTMLElement | null>(null);
  useEffect(() => {
    if (!abierto) return;
    focoPrevio.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const focoFinal = finalFocusRef?.current;
    const controles = obtenerControles(ref.current);
    window.requestAnimationFrame(() => controles[0]?.focus());

    function keydown(evento: globalThis.KeyboardEvent) {
      if (evento.key === "Escape") onClose();
      if (evento.key !== "Tab") return;
      const actuales = obtenerControles(ref.current);
      if (actuales.length === 0) return;
      const primero = actuales[0]!;
      const ultimo = actuales[actuales.length - 1]!;
      if (evento.shiftKey && document.activeElement === primero) {
        evento.preventDefault();
        ultimo.focus();
      } else if (!evento.shiftKey && document.activeElement === ultimo) {
        evento.preventDefault();
        primero.focus();
      }
    }

    document.addEventListener("keydown", keydown);
    return () => {
      document.removeEventListener("keydown", keydown);
      window.requestAnimationFrame(() => (focoFinal ?? focoPrevio.current)?.focus());
    };
  }, [abierto, finalFocusRef, onClose, ref]);
}

type AdminDialogProps = {
  open: boolean;
  title: string;
  description?: string;
  onOpenChange: (open: boolean) => void;
  children: ReactNode;
  footer?: ReactNode;
  finalFocusRef?: RefObject<HTMLElement | null>;
};

export function AdminDialog({ open, title, description, onOpenChange, children, footer, finalFocusRef }: AdminDialogProps) {
  const titleId = useId();
  const descriptionId = useId();
  const dialogRef = useRef<HTMLDivElement | null>(null);
  useCapaModal(open, () => onOpenChange(false), dialogRef, finalFocusRef);
  if (!open) return null;
  return (
    <div className="admin-modal-backdrop fixed inset-0 z-50 flex items-center justify-center px-4 backdrop-blur-sm" role="presentation">
      <section ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby={titleId} aria-describedby={description ? descriptionId : undefined} className="w-full max-w-lg overflow-hidden rounded-2xl border border-ink/20 bg-surface-primary shadow-[var(--ruum-shadow-4)]">
        <header className="border-b border-border-default px-6 py-5">
          <h2 id={titleId} className="font-display text-xl font-semibold text-ink">{title}</h2>
          {description && <p id={descriptionId} className="mt-1 font-body text-sm text-text-secondary">{description}</p>}
        </header>
        <div className="px-6 py-5">{children}</div>
        {footer && <footer className="flex flex-wrap justify-end gap-3 border-t border-border-default px-6 py-4">{footer}</footer>}
      </section>
    </div>
  );
}

export function AdminDrawer({ open, title, description, onOpenChange, children, footer, finalFocusRef }: AdminDialogProps) {
  const titleId = useId();
  const descriptionId = useId();
  const drawerRef = useRef<HTMLElement | null>(null);
  useCapaModal(open, () => onOpenChange(false), drawerRef, finalFocusRef);
  if (!open) return null;
  return (
    <div className="admin-modal-backdrop fixed inset-0 z-50 flex justify-end backdrop-blur-sm" role="presentation">
      <aside ref={drawerRef} role="dialog" aria-modal="true" aria-labelledby={titleId} aria-describedby={description ? descriptionId : undefined} className="flex h-full w-full max-w-md flex-col border-l border-border-default bg-surface-primary shadow-[var(--ruum-shadow-4)]">
        <header className="border-b border-border-default px-6 py-5">
          <h2 id={titleId} className="font-display text-xl font-semibold text-ink">{title}</h2>
          {description && <p id={descriptionId} className="mt-1 font-body text-sm text-text-secondary">{description}</p>}
        </header>
        <div className="flex-1 overflow-y-auto px-6 py-5">{children}</div>
        {footer && <footer className="flex flex-wrap justify-end gap-3 border-t border-border-default px-6 py-4">{footer}</footer>}
      </aside>
    </div>
  );
}

type AdminTabsProps<T extends string> = {
  items: Array<{ value: T; label: string; disabled?: boolean }>;
  value: T;
  onValueChange: (value: T) => void;
  label: string;
};

export function AdminTabs<T extends string>({ items, value, onValueChange, label }: AdminTabsProps<T>) {
  function mover(actual: T, direccion: 1 | -1) {
    const disponibles = items.filter((item) => !item.disabled);
    const indice = disponibles.findIndex((item) => item.value === actual);
    const siguiente = disponibles[(indice + direccion + disponibles.length) % disponibles.length];
    if (siguiente) onValueChange(siguiente.value);
  }
  return (
    <div role="tablist" aria-label={label} className="flex gap-1 border-b border-ink/10">
      {items.map((item) => (
        <button
          key={item.value}
          type="button"
          role="tab"
          aria-selected={item.value === value}
          disabled={item.disabled}
          tabIndex={item.value === value ? 0 : -1}
          onClick={() => onValueChange(item.value)}
          onKeyDown={(evento: KeyboardEvent<HTMLButtonElement>) => {
            if (evento.key === "ArrowRight") { evento.preventDefault(); mover(item.value, 1); }
            if (evento.key === "ArrowLeft") { evento.preventDefault(); mover(item.value, -1); }
          }}
          className={unir("px-4 py-2.5 font-body text-admin-boton font-semibold transition-colors", item.value === value ? "border-b-2 border-signal text-ink" : "text-text-secondary hover:text-ink")}
        >
          {item.label}
        </button>
      ))}
    </div>
  );
}

export function AdminBadge({ children, tone = "neutral", className }: { children: ReactNode; tone?: TonoAdmin; className?: string }) {
  return <span className={unir("inline-flex min-h-7 items-center rounded-full border px-3 py-1 font-body text-admin-secundario font-semibold", tonoBadge[tone], className)}>{children}</span>;
}

export function AdminTooltip({ label, children }: { label: string; children: ReactElement }) {
  const id = useId();
  const [abierto, setAbierto] = useState(false);
  const child = isValidElement(children)
    ? cloneElement(Children.only(children), {
        "aria-describedby": abierto ? id : undefined,
        onFocus: () => setAbierto(true),
        onBlur: () => setAbierto(false),
        onMouseEnter: () => setAbierto(true),
        onMouseLeave: () => setAbierto(false)
      } as Partial<unknown>)
    : children;
  return (
    <span className="relative inline-flex">
      {child}
      {abierto && <span id={id} role="tooltip" className="absolute bottom-full left-1/2 z-50 mb-2 -translate-x-1/2 whitespace-nowrap rounded-md bg-surface-strong px-2.5 py-1.5 font-body text-admin-secundario text-text-main shadow-[var(--ruum-shadow-3)]">{label}</span>}
    </span>
  );
}

export function AdminEmptyState({ title, description, action }: { title: string; description?: string; action?: ReactNode }) {
  return (
    <section className="rounded-card border border-dashed border-border-default px-6 py-10 text-center" aria-live="polite">
      <h2 className="font-display text-lg font-semibold text-ink">{title}</h2>
      {description && <p className="mx-auto mt-2 max-w-md font-body text-sm text-text-secondary">{description}</p>}
      {action && <div className="mt-5 flex justify-center">{action}</div>}
    </section>
  );
}

export function AdminErrorState({ title = "No pudimos cargar esta información", description, action }: { title?: string; description?: string; action?: ReactNode }) {
  return (
    <section className="rounded-card border border-status-error/30 bg-status-error-soft px-6 py-6" role="alert">
      <h2 className="font-display text-lg font-semibold text-status-error">{title}</h2>
      {description && <p className="mt-2 font-body text-sm text-text-secondary">{description}</p>}
      {action && <div className="mt-5">{action}</div>}
    </section>
  );
}

export function AdminLoadingState({ label = "Cargando información" }: { label?: string }) {
  return (
    <div className="rounded-card border border-border-default p-5" aria-label={label} aria-busy="true">
      <div className="h-4 w-40 animate-pulse rounded bg-ink/8" />
      <div className="mt-4 grid gap-3">
        <div className="h-10 animate-pulse rounded bg-ink/6" />
        <div className="h-10 animate-pulse rounded bg-ink/6" />
      </div>
    </div>
  );
}

export function AdminLastUpdated({ value, label = "Última actualización" }: { value?: string | Date | null; label?: string }) {
  if (!value) return <span className="font-body text-admin-secundario text-text-tertiary">{label}: sin fecha</span>;
  const fecha = value instanceof Date ? value : new Date(value);
  return (
    <time dateTime={fecha.toISOString()} className="font-body text-admin-secundario text-text-tertiary">
      {label}: {new Intl.DateTimeFormat("es-MX", { dateStyle: "medium", timeStyle: "short" }).format(fecha)}
    </time>
  );
}
