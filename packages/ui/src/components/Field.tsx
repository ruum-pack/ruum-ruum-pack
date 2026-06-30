import type { InputHTMLAttributes, ReactNode } from "react";

export interface FieldProps extends InputHTMLAttributes<HTMLInputElement> {
  etiqueta: string;
  error?: string;
  ayuda?: ReactNode;
}

export function Field({ etiqueta, error, ayuda, id, className = "", ...props }: FieldProps) {
  const inputId = id ?? props.name;

  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={inputId} className="font-body text-sm font-medium text-ink">
        {etiqueta}
      </label>
      <input
        id={inputId}
        className={[
          "rounded-lg border bg-mist px-3.5 py-2.5 font-body text-sm text-ink",
          "placeholder:text-ink/35",
          "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-route",
          error ? "border-danger" : "border-ink/15",
          className
        ].join(" ")}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? `${inputId}-error` : undefined}
        {...props}
      />
      {error ? (
        <p id={`${inputId}-error`} className="font-body text-xs text-danger">
          {error}
        </p>
      ) : ayuda ? (
        <p className="font-body text-xs text-ink/50">{ayuda}</p>
      ) : null}
    </div>
  );
}
