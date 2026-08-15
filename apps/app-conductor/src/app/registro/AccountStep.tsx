import { Field } from "@ruum/ui";
import type { fortalezaPassword } from "@ruum/shared/utils";
import { formatoTelefonoNacional, soloDigitos, calcularCursorTelefono } from "./registration-validation";
import { useRef } from "react";

type FortalezaPassword = ReturnType<typeof fortalezaPassword>;

export function AccountStep({
  telefono,
  setTelefono,
  email,
  setEmail,
  password,
  setPassword,
  confirmacionPassword,
  setConfirmacionPassword,
  fuerzaPassword,
  sesionAutenticada,
  erroresCampos,
  limpiarErrorCampo,
  validarTelefono,
  validarCampo,
  validarPassword,
  validarConfirmacion
}: {
  telefono: string;
  setTelefono: (valor: string) => void;
  email: string;
  setEmail: (valor: string) => void;
  password: string;
  setPassword: (valor: string) => void;
  confirmacionPassword: string;
  setConfirmacionPassword: (valor: string) => void;
  fuerzaPassword: FortalezaPassword;
  sesionAutenticada: boolean;
  erroresCampos: Record<string, string>;
  limpiarErrorCampo: (campo: string) => void;
  validarTelefono: (campo: "telefono" | "contactoEmergenciaTelefono", valor: string, setter: (valor: string) => void) => boolean;
  validarCampo: (campo: "email", valor: string) => boolean;
  validarPassword: () => boolean;
  validarConfirmacion: (valor?: string, base?: string) => boolean;
}) {
  const requisitosPassword = [
    { label: "Mínimo 8 caracteres", cumplido: password.length >= 8 },
    { label: "Al menos un número (0-9)", cumplido: /[0-9]/.test(password) },
    { label: "Al menos una letra mayúscula (A-Z)", cumplido: /[A-Z]/.test(password) }
  ];

  const telefonoInputRef = useRef<HTMLInputElement>(null);
  const valorAnteriorRef = useRef("");

  // Manejar input del teléfono con máscara fluida y cursor inteligente
  const manejarCambioTelefono = (e: React.ChangeEvent<HTMLInputElement>) => {
    const input = e.target;
    const valorNuevo = input.value;
    const cursorPos = input.selectionStart ?? 0;
    
    // Calcular nueva posición del cursor
    const nuevaPosicion = calcularCursorTelefono(valorAnteriorRef.current, valorNuevo, cursorPos);
    
    // Actualizar valor solo con dígitos
    const soloNumeros = soloDigitos(valorNuevo);
    setTelefono(soloNumeros);
    limpiarErrorCampo("telefono");
    
    // Guardar valor para próxima comparación
    valorAnteriorRef.current = valorNuevo;
    
    // Aplicar formato y restaurar cursor
    requestAnimationFrame(() => {
      if (telefonoInputRef.current) {
        telefonoInputRef.current.value = formatoTelefonoNacional(soloNumeros);
        telefonoInputRef.current.setSelectionRange(nuevaPosicion, nuevaPosicion);
      }
    });
  };

  return (
    <fieldset className="grid gap-4">
      <Field
        etiqueta="Teléfono móvil"
        ayuda={
          <span className="font-body text-xs text-text-tertiary/80 dark:text-gray-400/80">
            Formato estándar 10 dígitos (ej. (55) 1234-5678).
          </span>
        }
        type="tel"
        inputMode="numeric"
        placeholder="(55) 1234-5678"
        value={formatoTelefonoNacional(telefono)}
        onChange={manejarCambioTelefono}
        onBlur={() => validarTelefono("telefono", telefono, setTelefono)}
        error={erroresCampos.telefono || undefined}
        required
        autoComplete="tel-national"
        ref={telefonoInputRef}
      />

      <Field
        etiqueta="Correo electrónico"
        type="email"
        placeholder="conductor@ejemplo.com"
        value={email}
        onChange={(e) => {
          setEmail(e.target.value);
          limpiarErrorCampo("email");
        }}
        onBlur={() => validarCampo("email", email)}
        error={erroresCampos.email || undefined}
        required
        autoComplete="email"
        readOnly={sesionAutenticada}
      />

      {!sesionAutenticada && (
        <div className="grid gap-4">
          <div className="flex flex-col gap-2">
            <Field
              etiqueta="Crea tu contraseña"
              type="password"
              placeholder="Ingresa tu contraseña"
              value={password}
              onChange={(e) => {
                const valor = e.target.value;
                setPassword(valor);
                limpiarErrorCampo("password");
                if (confirmacionPassword) validarConfirmacion(confirmacionPassword, valor);
              }}
              onBlur={() => validarPassword()}
              error={erroresCampos.password || undefined}
              required
              minLength={8}
              autoComplete="new-password"
            />

            {/* Requisitos dinámicos interactivos con cambio de color verde al cumplirse */}
            <ul className="flex flex-col gap-1.5 rounded-xl border border-border bg-surface-elevated/70 p-3 text-xs font-body" aria-label="Requisitos de contraseña">
              {requisitosPassword.map((req, idx) => (
                <li
                  key={idx}
                  className={`flex items-center gap-2 transition-all duration-150 ${
                    req.cumplido ? "font-semibold text-emerald-600 dark:text-emerald-400" : "text-text-secondary"
                  }`}
                >
                  <span
                    className={`flex size-4 shrink-0 items-center justify-center rounded-full text-[10px] font-bold transition-all ${
                      req.cumplido
                        ? "bg-emerald-600 text-white dark:bg-emerald-500 shadow-xs"
                        : "bg-surface-elevated border border-border text-text-tertiary"
                    }`}
                    aria-hidden
                  >
                    {req.cumplido ? "✓" : "○"}
                  </span>
                  <span>{req.label}</span>
                </li>
              ))}
            </ul>

            {password.length > 0 && (
              <div className="flex flex-col gap-1" aria-live="polite">
                <div className="flex gap-1" aria-hidden>
                  {[1, 2, 3].map((n) => (
                    <div
                      key={n}
                      className={[
                        "h-1 flex-1 rounded-full transition-all",
                        n <= fuerzaPassword.nivel
                          ? fuerzaPassword.nivel === 1
                            ? "bg-danger-action"
                            : fuerzaPassword.nivel === 2
                              ? "bg-signal"
                              : "bg-emerald-500"
                          : "bg-surface-elevated"
                      ].join(" ")}
                    />
                  ))}
                </div>
                {fuerzaPassword.etiqueta && (
                  <span className="font-body text-xs leading-4 text-text-secondary">
                    Fuerza de la contraseña: <strong className="text-text-primary">{fuerzaPassword.etiqueta}</strong>
                  </span>
                )}
              </div>
            )}
          </div>

          <Field
            etiqueta="Confirma tu contraseña"
            type="password"
            placeholder="Repite tu contraseña"
            value={confirmacionPassword}
            onChange={(e) => {
              setConfirmacionPassword(e.target.value);
              validarConfirmacion(e.target.value, password);
            }}
            error={erroresCampos.confirmacionPassword || undefined}
            required
            minLength={8}
            autoComplete="new-password"
          />
        </div>
      )}

      {!sesionAutenticada && (
        <p className="mt-1 flex items-center gap-1.5 font-body text-xs text-text-tertiary/80 dark:text-gray-400/80">
          <span>🔒</span>
          <span>Tus datos personales y contraseña se transmiten y almacenan con cifrado de grado bancario (SSL/TLS).</span>
        </p>
      )}
    </fieldset>
  );
}
