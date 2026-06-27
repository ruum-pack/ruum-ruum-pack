"use client";

import { useState } from "react";
import { Button, Field, Aviso } from "@ruum/ui";
import { HORAS_HABILES_VERIFICACION_CUENTA_NUEVA } from "@ruum/shared/rules";

export default function PaginaRegistro() {
  const [tipoCuenta, setTipoCuenta] = useState<"personal" | "empresa">("personal");
  const [nombre, setNombre] = useState("");
  const [enviado, setEnviado] = useState(false);

  if (enviado) {
    return (
      <main className="mx-auto max-w-md px-6 py-20 text-center">
        <h1 className="font-display text-2xl font-semibold">Cuenta en revisión</h1>
        <p className="mt-3 font-body text-sm text-ink/60">
          Verificamos cuentas nuevas en menos de {HORAS_HABILES_VERIFICACION_CUENTA_NUEVA} horas hábiles. Te
          avisaremos en cuanto esté lista.
        </p>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-md px-6 py-12">
      <h1 className="font-display text-2xl font-semibold">Crear cuenta</h1>
      <p className="mt-2 font-body text-sm text-ink/60">
        Una cuenta verificada te permite solicitar traslados y, con historial, pagar al cierre en vez de por
        adelantado.
      </p>

      <form
        className="mt-8 grid gap-4"
        onSubmit={(e) => {
          e.preventDefault();
          setEnviado(true);
        }}
      >
        <fieldset className="flex gap-4 font-body text-sm">
          <label className="flex items-center gap-2">
            <input
              type="radio"
              name="tipo_cuenta"
              checked={tipoCuenta === "personal"}
              onChange={() => setTipoCuenta("personal")}
            />
            Personal
          </label>
          <label className="flex items-center gap-2">
            <input
              type="radio"
              name="tipo_cuenta"
              checked={tipoCuenta === "empresa"}
              onChange={() => setTipoCuenta("empresa")}
            />
            Empresa
          </label>
        </fieldset>

        <Field etiqueta="Nombre completo" value={nombre} onChange={(e) => setNombre(e.target.value)} required />

        <Aviso tono="info">
          Después de crear tu cuenta te pediremos un documento de identidad para verificarla.
        </Aviso>

        <Button type="submit" className="mt-2">
          Crear cuenta
        </Button>
      </form>
    </main>
  );
}
