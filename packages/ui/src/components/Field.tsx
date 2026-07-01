"use client";

import { useState } from "react";
import type { InputHTMLAttributes, ReactNode } from "react";

export interface FieldProps extends InputHTMLAttributes<HTMLInputElement> {
  etiqueta: string;
  error?: string | undefined;
  ayuda?: ReactNode;
}

export function Field({ etiqueta, error, ayuda, id, className = "", type, ...props }: FieldProps) {
  const inputId = id ?? props.name;
  const [passwordVisible, setPasswordVisible] = useState(false);
  const esPassword = type === "password";
  const inputType = esPassword && passwordVisible ? "text" : type;
  const inputClassName = [
    "w-full rounded-lg border bg-mist px-3.5 py-2.5 font-body text-sm text-ink",
    esPassword ? "pr-11" : "",
    "placeholder:text-ink/65",
    "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-route",
    error ? "border-danger" : "border-ink/50",
    className
  ].join(" ");

  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={inputId} className="font-body text-sm font-medium text-ink">
        {etiqueta}
      </label>
      {esPassword ? (
        <div className="relative">
          <input
            id={inputId}
            type={inputType}
            className={inputClassName}
            aria-invalid={Boolean(error)}
            aria-describedby={error ? `${inputId}-error` : undefined}
            {...props}
          />
          <button
            type="button"
            onClick={() => setPasswordVisible((visible) => !visible)}
            className="absolute right-2 top-1/2 flex size-8 -translate-y-1/2 items-center justify-center rounded-md text-ink/65 transition-colors hover:bg-ink/5 hover:text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-route disabled:cursor-not-allowed disabled:opacity-40"
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
          aria-describedby={error ? `${inputId}-error` : undefined}
          {...props}
        />
      )}
      {error ? (
        <p id={`${inputId}-error`} className="font-body text-xs text-danger">
          {error}
        </p>
      ) : ayuda ? (
        <p className="font-body text-xs text-ink/65">{ayuda}</p>
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
