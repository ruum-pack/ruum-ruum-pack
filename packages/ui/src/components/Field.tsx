"use client";

import { useId, useState } from "react";
import type { InputHTMLAttributes, ReactNode } from "react";

export interface FieldProps extends InputHTMLAttributes<HTMLInputElement> {
  etiqueta: string;
  error?: string | undefined;
  ayuda?: ReactNode;
}

/** Campo con etiqueta visible, ayuda asociada y estado de error anunciado. */
export function Field({ etiqueta, error, ayuda, id, className = "", type, ...props }: FieldProps) {
  const reactId = useId();
  const inputId = id ?? props.name ?? `field-${reactId}`;
  const helpId = ayuda ? `${inputId}-help` : undefined;
  const errorId = error ? `${inputId}-error` : undefined;
  const describedBy = [helpId, errorId].filter(Boolean).join(" ") || undefined;
  const [passwordVisible, setPasswordVisible] = useState(false);
  const esPassword = type === "password";
  const inputType = esPassword && passwordVisible ? "text" : type;
  const inputClassName = [
    "w-full min-h-12 rounded-[10px] border bg-mist px-3.5 py-2.5 font-body text-sm text-ink shadow-[inset_0_1px_0_rgba(26,31,46,0.02)]",
    esPassword ? "pr-11" : "",
    "placeholder:text-ink/45 transition-[border-color,box-shadow,background-color] duration-150",
    "hover:border-ink/50 focus:border-route-dark focus:outline-none focus:ring-[3px] focus:ring-route-dark/20",
    error ? "border-danger bg-danger-soft/20 focus:border-danger focus:ring-danger/15" : "border-ink/30",
    "disabled:cursor-not-allowed disabled:border-ink/10 disabled:bg-mist-dim disabled:text-ink/50",
    className
  ].join(" ");

  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={inputId} className="font-body text-sm font-semibold text-ink">
        {etiqueta}
        {props.required ? <span className="ml-1 text-danger" aria-hidden> *</span> : null}
      </label>
      {esPassword ? (
        <div className="relative">
          <input
            id={inputId}
            type={inputType}
            className={inputClassName}
            aria-invalid={Boolean(error)}
            aria-describedby={describedBy}
            {...props}
          />
          <button
            type="button"
            onClick={() => setPasswordVisible((visible) => !visible)}
            className="absolute top-1/2 flex -translate-y-1/2 items-center justify-center rounded-lg text-ink/55 transition-colors hover:bg-ink/[0.05] hover:text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-route-dark disabled:cursor-not-allowed disabled:opacity-40"
            style={{ right: "0.5rem", width: "2.25rem", height: "2.25rem" }}
            aria-label={passwordVisible ? "Ocultar contraseña" : "Mostrar contraseña"}
            disabled={props.disabled}
          >
            {passwordVisible ? <IconoOjoCerrado /> : <IconoOjo />}
          </button>
        </div>
      ) : (
        <input
          id={inputId}
          type={inputType}
          className={inputClassName}
          aria-invalid={Boolean(error)}
          aria-describedby={describedBy}
          {...props}
        />
      )}
      {ayuda ? (
        <p id={helpId} className="font-body text-xs leading-5 text-ink/60">
          {ayuda}
        </p>
      ) : null}
      {error ? (
        <p id={errorId} role="alert" className="font-body text-xs font-medium leading-5 text-danger">
          {error}
        </p>
      ) : null}
    </div>
  );
}

function IconoOjo() {
  return (
    <svg viewBox="0 0 20 20" className="size-4" aria-hidden>
      <path
        d="M2.5 10s2.7-5 7.5-5 7.5 5 7.5 5-2.7 5-7.5 5-7.5-5-7.5-5Z"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.8"
      />
      <circle cx="10" cy="10" r="2.2" fill="none" stroke="currentColor" strokeWidth="1.8" />
    </svg>
  );
}

function IconoOjoCerrado() {
  return (
    <svg viewBox="0 0 20 20" className="size-4" aria-hidden>
      <path d="M3 3 17 17" fill="none" stroke="currentColor" strokeLinecap="round" strokeWidth="1.8" />
      <path
        d="M7.4 5.5A7.2 7.2 0 0 1 10 5c4.8 0 7.5 5 7.5 5a11.2 11.2 0 0 1-2.2 2.7M12.2 14.6A7.4 7.4 0 0 1 10 15c-4.8 0-7.5-5-7.5-5a11 11 0 0 1 2.4-2.9"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.8"
      />
    </svg>
  );
}
