import type { MouseEventHandler, ReactNode } from "react";
import { Aviso } from "./Aviso";
import { Button } from "./Button";
import type { ButtonVariant } from "./Button";

export type OperationalActionCta = {
  label: string;
  href?: string;
  onClick?: MouseEventHandler<HTMLButtonElement>;
  disabled?: boolean;
  external?: boolean;
  variant?: ButtonVariant;
};

export interface NextOperationalActionProps {
  title: string;
  instruction: string;
  context?: ReactNode;
  eta?: string | null;
  primaryCta: OperationalActionCta;
  secondaryCta?: OperationalActionCta;
  loading?: boolean;
  error?: ReactNode;
  nextStep?: string;
  stageLabel?: string;
  className?: string;
}

function CtaLink({ cta, primary = false }: { cta: OperationalActionCta; primary?: boolean }) {
  const variant = cta.variant ?? (primary ? "primary" : "secondary");
  const classes = [
    "inline-flex min-h-12 min-w-12 w-full items-center justify-center gap-2 rounded-xl px-5 py-3",
    "font-display text-sm font-bold leading-5 transition-[background-color,border-color,box-shadow,transform] duration-150",
    "focus-visible:outline focus-visible:outline-[3px] focus-visible:outline-offset-2",
    variant === "primary"
      ? "border border-action-primary bg-action-primary text-[#14213D] shadow-sm hover:-translate-y-0.5 hover:bg-[#FFB940] hover:shadow-md active:translate-y-0 active:bg-action-primary-active focus-visible:outline-route-action"
      : variant === "danger" || variant === "emergency"
        ? "border border-danger-action bg-danger-action text-white shadow-sm hover:-translate-y-0.5 hover:bg-danger-action-hover hover:shadow-md active:translate-y-0 active:bg-danger-action-active focus-visible:outline-danger-action"
      : "border border-border-strong bg-surface text-text-primary shadow-sm hover:-translate-y-0.5 hover:border-route-action hover:bg-surface-elevated hover:shadow-md active:translate-y-0 active:bg-surface-elevated focus-visible:outline-route-action"
  ].join(" ");

  return (
    <a
      href={cta.href}
      target={cta.external ? "_blank" : undefined}
      rel={cta.external ? "noreferrer" : undefined}
      aria-disabled={cta.disabled || undefined}
      className={cta.disabled ? `${classes} pointer-events-none border-border bg-surface-elevated text-disabled` : classes}
    >
      {cta.label}
    </a>
  );
}

function ActionButton({
  cta,
  loading = false,
  primary = false
}: {
  cta: OperationalActionCta;
  loading?: boolean;
  primary?: boolean;
}) {
  if (cta.href) return <CtaLink cta={cta} primary={primary} />;

  return (
    <Button
      className="w-full"
      variant={cta.variant ?? (primary ? "primary" : "secondary")}
      onClick={cta.onClick}
      disabled={cta.disabled}
      loading={loading}
    >
      {cta.label}
    </Button>
  );
}

export function NextOperationalAction({
  title,
  instruction,
  context,
  eta,
  primaryCta,
  secondaryCta,
  loading = false,
  error,
  nextStep,
  stageLabel,
  className = ""
}: NextOperationalActionProps) {
  return (
    <section
      className={[
        "rounded-2xl border border-border-strong bg-surface-elevated p-4 text-text-primary shadow-2 sm:p-5",
        "mx-auto w-full max-w-full overflow-hidden",
        className
      ].join(" ")}
      aria-labelledby="next-operational-action-title"
    >
      <div className="min-w-0">
        {stageLabel && (
          <p className="font-body text-sm font-semibold text-route-action">
            {stageLabel}
          </p>
        )}
        <h2 id="next-operational-action-title" className="mt-1 break-words font-display text-2xl font-semibold leading-7 text-text-primary">
          {title}
        </h2>
        <p className="mt-2 break-words font-body text-base leading-7 text-text-secondary">{instruction}</p>
      </div>

      {(context || eta) && (
        <div className="mt-4 min-w-0 rounded-xl border border-border bg-surface px-3 py-3 font-body text-base text-text-secondary">
          {context && <div className="break-words font-medium text-text-primary">{context}</div>}
          {eta && <p className="mt-1 break-words text-sm text-text-secondary">{eta}</p>}
        </div>
      )}

      {error && (
        <div className="mt-4">
          <Aviso tono="danger">{error}</Aviso>
        </div>
      )}

      <div className="mt-4 grid w-full gap-2 sm:grid-cols-[minmax(0,1fr)_auto]">
        <ActionButton cta={primaryCta} loading={loading} primary />
        {secondaryCta && <ActionButton cta={secondaryCta} />}
      </div>

      {nextStep && (
        <p className="mt-3 break-words rounded-xl border border-warning bg-warn-soft px-3 py-2 font-body text-sm text-text-primary">
          Después: {nextStep}
        </p>
      )}
    </section>
  );
}
