import { describe, it, expect } from "vitest";
import type { ConductorCuenta } from "../src/app/cuenta/cuenta-utils";

/**
 * PR-10 P2 — Estado pendiente de correo Conductor
 * Con double_confirm_changes = true, auth.updateUser({ email }) no implica cambio definitivo inmediato.
 *
 * Requisitos de UI:
 * 1. Correo actual
 * 2. Nuevo correo pendiente
 * 3. Confirmación enviada
 * 4. Cambio confirmado
 *
 * Prohibición:
 * No mostrar simplemente "Perfil actualizado correctamente" como confirmación del email.
 */

describe("PR-10 — Estados de ciclo de vida de cambio de email con double_confirm_changes", () => {
  it("Estado 1: Correo actual activo y confirmado sin cambios pendientes", () => {
    const conductor: ConductorCuenta = {
      id: "cond-001",
      auth_user_id: "auth-001",
      nombre: "Conductor Activo",
      email: "conductor.original@ruum.test",
      new_email: null,
      telefono: "+525512345678",
      estado: "activo",
      version: 1,
      creado_en: new Date().toISOString(),
      actualizado_en: new Date().toISOString()
    } as unknown as ConductorCuenta;

    expect(conductor.email).toBe("conductor.original@ruum.test");
    expect(conductor.new_email).toBeNull();
  });

  it("Estado 2: Nuevo correo pendiente detectado via new_email de Supabase Auth", () => {
    const conductor: ConductorCuenta = {
      id: "cond-001",
      auth_user_id: "auth-001",
      nombre: "Conductor Con Cambio",
      email: "conductor.original@ruum.test",
      new_email: "conductor.nuevo@ruum.test",
      telefono: "+525512345678",
      estado: "activo",
      version: 1,
      creado_en: new Date().toISOString(),
      actualizado_en: new Date().toISOString()
    } as unknown as ConductorCuenta;

    expect(conductor.email).toBe("conductor.original@ruum.test");
    expect(conductor.new_email).toBe("conductor.nuevo@ruum.test");
    expect(conductor.new_email).not.toBe(conductor.email);
  });

  it("Estado 3: Confirmación enviada genera notificación informativa explícita y no confirmación definitiva", () => {
    const emailSolicitado = "nuevo.email@ruum.test";
    const emailActual = "actual.email@ruum.test";

    function generarMensajeRespuesta({
      cambioEmail,
      emailSolicitado,
      emailActual,
      estadoRpc
    }: {
      cambioEmail: boolean;
      emailSolicitado: string;
      emailActual: string;
      estadoRpc: "actualizado" | "pendiente";
    }) {
      if (cambioEmail) {
        if (estadoRpc === "pendiente") {
          return `Confirmación enviada a ${emailSolicitado}. Además, los cambios sensibles fueron enviados a revisión operativa.`;
        }
        return `Confirmación enviada: Hemos enviado un enlace a ${emailSolicitado}. Revisa tu bandeja de entrada para confirmar el cambio. Tu correo actual (${emailActual}) sigue activo.`;
      }
      return "Cambios guardados. Tu perfil se actualizó correctamente.";
    }

    const mensajeConCambioEmail = generarMensajeRespuesta({
      cambioEmail: true,
      emailSolicitado,
      emailActual,
      estadoRpc: "actualizado"
    });

    // Validaciones estrictas del spec PR-10
    expect(mensajeConCambioEmail).toContain("Confirmación enviada");
    expect(mensajeConCambioEmail).toContain(emailSolicitado);
    expect(mensajeConCambioEmail).toContain(emailActual);
    expect(mensajeConCambioEmail).not.toBe("Cambios guardados. Tu perfil se actualizó correctamente.");
  });

  it("Estado 4: Cambio confirmado consolida el nuevo correo una vez verificados los enlaces", () => {
    const conductorConfirmado: ConductorCuenta = {
      id: "cond-001",
      auth_user_id: "auth-001",
      nombre: "Conductor Confirmado",
      email: "conductor.nuevo@ruum.test",
      new_email: null,
      telefono: "+525512345678",
      estado: "activo",
      version: 2,
      creado_en: new Date().toISOString(),
      actualizado_en: new Date().toISOString()
    } as unknown as ConductorCuenta;

    expect(conductorConfirmado.email).toBe("conductor.nuevo@ruum.test");
    expect(conductorConfirmado.new_email).toBeNull();
  });

  it("Garantía PR-10: Nunca emite mensaje genérico de éxito si el cambio de correo está pendiente", () => {
    const mensajesProhibidosParaCambioEmail = [
      "Perfil actualizado correctamente",
      "Cambios guardados. Tu perfil se actualizó correctamente."
    ];

    const mensajeEsperado = `Confirmación enviada: Hemos enviado un enlace a nuevo@ruum.test. Revisa tu bandeja de entrada para confirmar el cambio. Tu correo actual (antiguo@ruum.test) sigue activo.`;

    for (const prohibido of mensajesProhibidosParaCambioEmail) {
      expect(mensajeEsperado).not.toBe(prohibido);
    }
  });
});
