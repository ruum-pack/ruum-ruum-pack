import { Field } from "@ruum/ui";
import type { fortalezaPassword } from "@ruum/shared/utils";
import { formatoTelefonoNacional, soloDigitos } from "./registration-validation";

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
  return (
    <fieldset className="grid gap-4">
      <legend className="font-display text-xl font-bold text-text-primary">Cuenta</legend>
      <p className="font-body text-sm leading-6 text-text-secondary">
        Usaremos este acceso para guardar tu avance y permitirte continuar después. Los documentos se pedirán cuando la cuenta esté verificada.
      </p>
      <Field etiqueta="Teléfono" ayuda="10 dígitos, sin lada internacional." type="tel" inputMode="numeric" value={formatoTelefonoNacional(telefono)} onChange={(e) => { setTelefono(soloDigitos(e.target.value)); limpiarErrorCampo("telefono"); }} onBlur={() => validarTelefono("telefono", telefono, setTelefono)} error={erroresCampos.telefono || undefined} required autoComplete="tel-national" />
      <Field etiqueta="Correo electrónico" type="email" value={email} onChange={(e) => { setEmail(e.target.value); limpiarErrorCampo("email"); }} onBlur={() => validarCampo("email", email)} error={erroresCampos.email || undefined} required autoComplete="email" readOnly={sesionAutenticada} />
      {!sesionAutenticada && <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-2">
          <Field etiqueta="Crea tu contraseña" type="password" value={password} ayuda="Mínimo 8 caracteres, con al menos un número o una mayúscula." onChange={(e) => { const valor = e.target.value; setPassword(valor); limpiarErrorCampo("password"); if (confirmacionPassword) validarConfirmacion(confirmacionPassword, valor); }} onBlur={() => validarPassword()} error={erroresCampos.password || undefined} required minLength={8} autoComplete="new-password" />
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
                          ? "bg-danger"
                          : fuerzaPassword.nivel === 2
                            ? "bg-signal"
                            : "bg-control"
                        : "bg-surface-elevated"
                    ].join(" ")}
                  />
                ))}
              </div>
              {fuerzaPassword.etiqueta && (
                <span className="font-body text-xs leading-4 text-text-secondary">{fuerzaPassword.etiqueta}</span>
              )}
            </div>
          )}
        </div>
        <Field etiqueta="Confirma tu contraseña" type="password" value={confirmacionPassword} onChange={(e) => { setConfirmacionPassword(e.target.value); validarConfirmacion(e.target.value, password); }} error={erroresCampos.confirmacionPassword || undefined} required minLength={8} autoComplete="new-password" />
      </div>}
    </fieldset>
  );
}
