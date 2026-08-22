import type { FormEvent } from "react";
import { Aviso, Button, Field } from "@ruum/ui";
import { soloDigitos } from "./registration-validation";

export function OtpVerification({
  email,
  codigoOtp,
  setCodigoOtp,
  errorOtp,
  clearErrorOtp,
  verificandoOtp,
  reenviandoOtp,
  esperaReenvioOtp,
  codigoLongitud,
  intentosFallidos = 0,
  maxIntentos = 5,
  onSubmit,
  onResend,
  onAlreadyConfirmed
}: {
  email: string;
  codigoOtp: string;
  setCodigoOtp: (valor: string) => void;
  errorOtp: string | null;
  clearErrorOtp: () => void;
  verificandoOtp: boolean;
  reenviandoOtp: boolean;
  esperaReenvioOtp: number;
  codigoLongitud: number;
  intentosFallidos?: number;
  maxIntentos?: number;
  onSubmit: (event: FormEvent) => void;
  onResend: () => void;
  onAlreadyConfirmed: () => void;
}) {
  const bloqueado = intentosFallidos >= maxIntentos;
  const restantes = Math.max(0, maxIntentos - intentosFallidos);
  return (
    <div className="py-4">
      <h1 id="titulo-registro-conductor" className="mt-4 font-display text-2xl font-bold text-text-primary">
        Confirma tu correo
      </h1>
      <p className="mt-3 font-body text-sm leading-6 text-text-secondary">
        Enviamos un código de {codigoLongitud} dígitos a{" "}
        <span className="font-semibold text-text-primary">{email.trim().toLowerCase()}</span>. Escríbelo aquí para
        activar tu cuenta y subir tus documentos sin salir de la app.
      </p>

      <form className="mt-6 grid gap-4" onSubmit={onSubmit}>
        <Field
          etiqueta="Código de verificación"
          inputMode="numeric"
          pattern="[0-9]*"
          autoComplete="one-time-code"
          maxLength={codigoLongitud}
          value={codigoOtp}
          onChange={(e) => {
            setCodigoOtp(soloDigitos(e.target.value, codigoLongitud));
            if (errorOtp) clearErrorOtp();
          }}
          ayuda={bloqueado ? `Has agotado los ${maxIntentos} intentos. Solicita un nuevo código.` : `Revisa también tu carpeta de spam o promociones. ${intentosFallidos > 0 ? `Te quedan ${restantes} intentos.` : ""}`}
          required
          disabled={bloqueado}
        />

        {errorOtp && <Aviso tono="danger">{errorOtp}</Aviso>}
        {bloqueado && (
          <Aviso tono="atencion">
            Por seguridad bloqueamos los intentos. Espera 60 s y pulsa “Reenviar código” para obtener uno nuevo.
          </Aviso>
        )}

        <Button type="submit" loading={verificandoOtp} disabled={verificandoOtp || codigoOtp.length !== codigoLongitud || bloqueado}>
          {verificandoOtp ? "Verificando…" : bloqueado ? "Bloqueado — reenvía el código" : "Confirmar y activar"}
        </Button>

        <div className="flex flex-wrap items-center justify-between gap-2">
          <button
            type="button"
            onClick={onResend}
            disabled={esperaReenvioOtp > 0 || reenviandoOtp}
            className="inline-flex min-h-11 items-center font-body text-sm font-semibold text-route-action hover:underline disabled:cursor-not-allowed disabled:text-text-disabled disabled:no-underline"
          >
            {reenviandoOtp
              ? "Reenviando…"
              : esperaReenvioOtp > 0
                ? `Reenviar código (${esperaReenvioOtp}s)`
                : "Reenviar código"}
          </button>
          <button
            type="button"
            onClick={onAlreadyConfirmed}
            className="inline-flex min-h-11 items-center font-body text-sm text-text-secondary hover:text-text-primary hover:underline"
          >
            Ya confirmé desde el enlace del correo
          </button>
        </div>
      </form>
    </div>
  );
}
