import { useId } from "react";

export function SelectField({
  etiqueta,
  value,
  onChange,
  opciones,
  placeholder,
  error,
  required,
  disabled
}: {
  etiqueta: string;
  value: string;
  onChange: (valor: string) => void;
  opciones: string[];
  placeholder: string;
  error?: string;
  required?: boolean;
  disabled?: boolean;
}) {
  const id = useId();

  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="font-body text-sm font-semibold text-text-primary">
        {etiqueta}
        {required ? <span className="ml-1 text-danger-action" aria-hidden> *</span> : null}
      </label>
      <select
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        required={required}
        aria-invalid={Boolean(error)}
        className={[
          "w-full min-h-12 rounded-[10px] border bg-surface px-3.5 py-2.5 font-body text-base text-text-primary shadow-[inset_0_1px_0_rgba(26,31,46,0.02)]",
          "transition-[border-color,box-shadow,background-color] duration-150 hover:border-border-strong focus:border-route-action focus:outline-none focus:ring-[3px] focus:ring-route-action/20",
          error ? "border-danger-action bg-danger-soft/20 focus:border-danger-action focus:ring-danger/15" : "border-border-strong",
          "disabled:cursor-not-allowed disabled:border-border disabled:bg-surface-elevated disabled:text-text-tertiary"
        ].join(" ")}
      >
        <option value="">{placeholder}</option>
        {opciones.map((opcion) => (
          <option key={opcion} value={opcion}>{opcion}</option>
        ))}
      </select>
      {error ? <p role="alert" className="font-body text-sm font-medium leading-5 text-danger-action">{error}</p> : null}
    </div>
  );
}
