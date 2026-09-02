import { describe, it, expect, vi, beforeEach } from "vitest";
import { crearClienteFake } from "./supabase-fake";
import {
  iniciarVerificacionDiditUsuario,
  obtenerEstadoVerificacionDiditUsuario,
  solicitarRestablecimientoPasswordUsuario,
  actualizarFacturacionUsuario
} from "../usuarios";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@ruum/shared/types";

describe("usuarios — Verificación de identidad con Didit", () => {
  beforeEach(() => vi.clearAllMocks());

  it("iniciarVerificacionDiditUsuario: falla si no hay sesión", async () => {
    const cliente = crearClienteFake({ userId: null });
    await expect(
      iniciarVerificacionDiditUsuario(cliente as unknown as SupabaseClient<Database>)
    ).rejects.toThrow("Inicia sesión para continuar con la verificación.");
  });

  it("iniciarVerificacionDiditUsuario: invoca la edge function con tipo usuario y devuelve la url", async () => {
    const cliente = crearClienteFake({
      userId: "user-123",
      functionsResult: {
        data: {
          session_id: "didit-session-1",
          url: "https://verify.didit.me/session/didit-session-1"
        }
      }
    });

    const res = await iniciarVerificacionDiditUsuario(
      cliente as unknown as SupabaseClient<Database>
    );

    expect(res.url).toBe("https://verify.didit.me/session/didit-session-1");
    expect(res.sessionId).toBe("didit-session-1");
    expect(cliente.functions.invoke).toHaveBeenCalledWith("iniciar-verificacion-didit", {
      body: { tipo: "usuario" }
    });
  });

  it("iniciarVerificacionDiditUsuario: falla si la URL no comienza con https://", async () => {
    const cliente = crearClienteFake({
      userId: "user-123",
      functionsResult: {
        data: {
          session_id: "didit-session-1",
          url: "http://inseguro.didit.me"
        }
      }
    });

    await expect(
      iniciarVerificacionDiditUsuario(cliente as unknown as SupabaseClient<Database>)
    ).rejects.toThrow("No se recibió una URL válida del servicio de verificación de identidad.");
  });

  it("obtenerEstadoVerificacionDiditUsuario: consulta la tabla verificaciones_identidad_didit", async () => {
    const cliente = crearClienteFake({
      userId: "auth-user-1",
      tablas: {
        usuarios: {
          data: { id: "usuario-uuid-1" }
        },
        verificaciones_identidad_didit: {
          data: {
            id: "verif-1",
            session_id: "sess-1",
            estado: "aprobado",
            workflow_id: "wf-1"
          }
        }
      }
    });

    const estado = await obtenerEstadoVerificacionDiditUsuario(
      cliente as unknown as SupabaseClient<Database>
    );

    expect(estado).toEqual({
      id: "verif-1",
      session_id: "sess-1",
      estado: "aprobado",
      workflow_id: "wf-1"
    });
  });
});

describe("usuarios — PR-05 Separar Auth de facturación", () => {
  beforeEach(() => vi.clearAllMocks());

  it("Auth email = facturación → funciona y envía al email de Auth", async () => {
    const authEmail = "usuario@ruumruum.test";
    const cliente = crearClienteFake({
      userId: "user-123",
      userEmail: authEmail,
      tablas: {
        usuarios: {
          data: {
            id: "user-123",
            correo_facturacion: authEmail
          }
        }
      }
    });

    const res = await solicitarRestablecimientoPasswordUsuario(
      cliente as unknown as SupabaseClient<Database>,
      "http://localhost:3000/auth/callback?type=recovery"
    );

    expect(res.email).toBe(authEmail);
    const resetCall = cliente.llamadas.find(
      (l) => l.table === "auth" && l.action === "resetPasswordForEmail"
    );
    expect(resetCall).toBeDefined();
    expect(resetCall?.args[0]).toBe(authEmail);
  });

  it("Auth email != facturación → recovery va estrictamente al Auth email y no al de facturación", async () => {
    const authEmail = "login-usuario@ruumruum.test";
    const correoFacturacion = "facturas-empresa@fiscal.test";

    const cliente = crearClienteFake({
      userId: "user-456",
      userEmail: authEmail,
      tablas: {
        usuarios: {
          data: {
            id: "user-456",
            correo_facturacion: correoFacturacion
          }
        }
      }
    });

    const res = await solicitarRestablecimientoPasswordUsuario(
      cliente as unknown as SupabaseClient<Database>
    );

    expect(res.email).toBe(authEmail);
    expect(res.email).not.toBe(correoFacturacion);

    const resetCall = cliente.llamadas.find(
      (l) => l.table === "auth" && l.action === "resetPasswordForEmail"
    );
    expect(resetCall).toBeDefined();
    expect(resetCall?.args[0]).toBe(authEmail);
    expect(resetCall?.args[0]).not.toBe(correoFacturacion);
  });

  it("facturación vacía → recovery sigue funcionando al Auth email", async () => {
    const authEmail = "sin-facturacion@ruumruum.test";

    const cliente = crearClienteFake({
      userId: "user-789",
      userEmail: authEmail,
      tablas: {
        usuarios: {
          data: {
            id: "user-789",
            correo_facturacion: null
          }
        }
      }
    });

    const res = await solicitarRestablecimientoPasswordUsuario(
      cliente as unknown as SupabaseClient<Database>
    );

    expect(res.email).toBe(authEmail);
    const resetCall = cliente.llamadas.find(
      (l) => l.table === "auth" && l.action === "resetPasswordForEmail"
    );
    expect(resetCall).toBeDefined();
    expect(resetCall?.args[0]).toBe(authEmail);
  });

  it("Auth email ausente / sin sesión → error controlado", async () => {
    // Caso 1: Sin sesión
    const clienteSinSesion = crearClienteFake({ userId: null });
    await expect(
      solicitarRestablecimientoPasswordUsuario(
        clienteSinSesion as unknown as SupabaseClient<Database>
      )
    ).rejects.toThrow("No se encontró un correo de autenticación válido para esta cuenta.");

    // Caso 2: Sesión sin email en user
    const clienteSinEmail = crearClienteFake({ userId: "user-sin-email", userEmail: null });
    await expect(
      solicitarRestablecimientoPasswordUsuario(
        clienteSinEmail as unknown as SupabaseClient<Database>
      )
    ).rejects.toThrow("No se encontró un correo de autenticación válido para esta cuenta.");
  });
});

describe("usuarios — PR-08 Facturación atómica", () => {
  beforeEach(() => vi.clearAllMocks());

  it("actualizarFacturacionUsuario: invoca la RPC transaccional actualizar_datos_facturacion con los parámetros correctos", async () => {
    const cliente = crearClienteFake({
      userId: "user-123",
      rpcs: {
        actualizar_datos_facturacion: {
          data: { ok: true, usuario_id: "user-123", empresa_actualizada: true }
        }
      }
    });

    await actualizarFacturacionUsuario(
      cliente as unknown as SupabaseClient<Database>,
      {
        rfc: "RFC123456789",
        razon_social: "Empresa Test SA",
        regimen_fiscal: "601",
        codigo_postal_fiscal: "03100",
        uso_cfdi: "G03",
        correo_facturacion: "facturas@test.com"
      }
    );

    const rpcCall = cliente.llamadas.find(
      (l) => l.table === "rpc" && l.action === "actualizar_datos_facturacion"
    );
    expect(rpcCall).toBeDefined();
    expect(rpcCall?.args[0]).toEqual({
      p_rfc: "RFC123456789",
      p_razon_social: "Empresa Test SA",
      p_regimen_fiscal: "601",
      p_codigo_postal_fiscal: "03100",
      p_uso_cfdi: "G03",
      p_correo_facturacion: "facturas@test.com"
    });
  });

  it("actualizarFacturacionUsuario: falla si no hay sesión activa", async () => {
    const cliente = crearClienteFake({ userId: null });
    await expect(
      actualizarFacturacionUsuario(
        cliente as unknown as SupabaseClient<Database>,
        {
          rfc: "RFC123456789",
          razon_social: "Empresa Test SA",
          regimen_fiscal: "601",
          codigo_postal_fiscal: "03100",
          uso_cfdi: "G03",
          correo_facturacion: "facturas@test.com"
        }
      )
    ).rejects.toThrow("Sin sesión activa.");
  });

  it("actualizarFacturacionUsuario: propaga error de la RPC si ocurre un fallo", async () => {
    const cliente = crearClienteFake({
      userId: "user-123",
      rpcs: {
        actualizar_datos_facturacion: {
          error: new Error("Error en base de datos al actualizar facturación")
        }
      }
    });

    await expect(
      actualizarFacturacionUsuario(
        cliente as unknown as SupabaseClient<Database>,
        {
          rfc: "RFC123456789",
          razon_social: "Empresa Test SA",
          regimen_fiscal: "601",
          codigo_postal_fiscal: "03100",
          uso_cfdi: "G03",
          correo_facturacion: "facturas@test.com"
        }
      )
    ).rejects.toThrow("Error en base de datos al actualizar facturación");
  });
});


