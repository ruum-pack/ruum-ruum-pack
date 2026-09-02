import { describe, it, expect, vi, beforeEach } from "vitest";

const mockRpc = vi.fn(async () => ({ data: null, error: null }));

vi.mock("../src/lib/supabase-browser", () => ({
  crearClienteNavegador: vi.fn(() => ({
    rpc: mockRpc
  }))
}));

import {
  recordOperationalEvent,
  sanitizeDetails,
  type UsuarioOperationalEvent
} from "../src/lib/observability";
import { onRequestError } from "../instrumentation";

/**
 * PR-13 P1 — Observabilidad Sentry y Telemetría Segura en app-usuario
 *
 * Flujos prioritarios a verificar:
 * - login
 * - callback Auth
 * - recuperación
 * - cotización
 * - geocodificación
 * - Stripe (Elements / Payment Intents)
 * - creación de traslado
 * - errores Supabase
 *
 * Regla de seguridad P1: NUNCA enviar passwords, tokens, JWT, service roles,
 * documentos, números de tarjeta ni PII innecesaria.
 */

describe("PR-13 — Observabilidad App Usuario (observability.ts)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("1. Sanitización estricta anti-PII y anti-secretos", () => {
    it("elimina claves prohibidas (passwords, tokens, JWT, service_role, cvv, tarjetas, documentos)", () => {
      const payloadSensible = {
        evento: "login_intent",
        password: "super-secret-password-123",
        token: "session_token_xyz",
        jwt: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.dummy",
        service_role_key: "secret-service-role",
        cvv: "123",
        numero_tarjeta: "4111222233334444",
        clabe: "123456789012345678",
        curp: "ABCD123456HDFR01",
        documento_url: "https://bucket.com/doc.pdf",
        foto_identidad: "https://bucket.com/id.jpg",
        url_firmada: "https://bucket.com/firmada?key=123",
        // Datos seguros que sí deben preservarse
        status_code: 401,
        ruta_origen: "/login",
        motivo_error: "invalid_credentials"
      };

      const resultado = sanitizeDetails(payloadSensible);

      // Verificación de eliminación de claves sensibles
      expect(resultado).not.toHaveProperty("password");
      expect(resultado).not.toHaveProperty("token");
      expect(resultado).not.toHaveProperty("jwt");
      expect(resultado).not.toHaveProperty("service_role_key");
      expect(resultado).not.toHaveProperty("cvv");
      expect(resultado).not.toHaveProperty("numero_tarjeta");
      expect(resultado).not.toHaveProperty("clabe");
      expect(resultado).not.toHaveProperty("curp");
      expect(resultado).not.toHaveProperty("documento_url");
      expect(resultado).not.toHaveProperty("foto_identidad");
      expect(resultado).not.toHaveProperty("url_firmada");

      // Verificación de datos operacionales seguros
      expect(resultado.status_code).toBe(401);
      expect(resultado.ruta_origen).toBe("/login");
      expect(resultado.motivo_error).toBe("invalid_credentials");
    });

    it("redacta valores que contienen patrones de JWT o Bearer tokens", () => {
      const payloadConValoresOcultos = {
        mensaje: "Error al validar token eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0",
        authHeader: "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.xxx"
      };

      const resultado = sanitizeDetails(payloadConValoresOcultos);
      // Las llaves que contienen 'authHeader' o valores de token son redactadas/excluidas
      expect(resultado.mensaje).toBe("[REDACTED_SECRET]");
    });

    it("sanitiza recursivamente objetos anidados y trunca cadenas excesivas", () => {
      const cadenaLarga = "a".repeat(500);
      const payloadAnidado = {
        contexto: {
          descripcion: cadenaLarga,
          clave_secreta: "no-debe-aparecer"
        }
      };

      const resultado = sanitizeDetails(payloadAnidado);
      const contexto = resultado.contexto as Record<string, unknown>;
      expect(contexto).toBeDefined();
      expect(contexto.descripcion).toHaveLength(240);
    });
  });

  describe("2. Registro de eventos en flujos prioritarios", () => {
    const eventosPrioritarios: { tipo: UsuarioOperationalEvent; severidad: "info" | "warning" | "error"; detalle: Record<string, unknown> }[] = [
      { tipo: "login_failure", severidad: "warning", detalle: { reason: "credenciales_invalidas", intentos: 3 } },
      { tipo: "login_success", severidad: "info", detalle: { metodo: "password" } },
      { tipo: "auth_callback_error", severidad: "error", detalle: { errorCode: "otp_expired", stage: "exchange_code" } },
      { tipo: "recovery_failure", severidad: "warning", detalle: { step: "request_email", rateLimited: true } },
      { tipo: "quote_calculation_failure", severidad: "error", detalle: { motivo: "distancia_fuera_rango", distanciaKm: 1500 } },
      { tipo: "geocoding_failure", severidad: "warning", detalle: { status: 429, scope: "geocoding_api" } },
      { tipo: "stripe_payment_failure", severidad: "error", detalle: { decline_code: "insufficient_funds", intent_id: "pi_123" } },
      { tipo: "trip_creation_failure", severidad: "error", detalle: { validacion: "vehiculo_invalido", step: "submit" } },
      { tipo: "supabase_error", severidad: "error", detalle: { code: "PGRST301", message: "JWT expired" } }
    ];

    it.each(eventosPrioritarios)("registra correctamente evento prioritario: %s", async ({ tipo, severidad, detalle }) => {
      await recordOperationalEvent(tipo, detalle, severidad);

      expect(mockRpc).toHaveBeenCalledWith(
        "registrar_evento_operativo_app",
        expect.objectContaining({
          p_tipo: tipo,
          p_detalle: expect.objectContaining({
            severity: severidad,
            ...sanitizeDetails(detalle)
          })
        })
      );
    });

    it("hace mirror a window.Sentry.captureMessage cuando está disponible en cliente", async () => {
      const mockCaptureMessage = vi.fn();
      const originalWindow = (globalThis as unknown as { window?: unknown }).window;
      (globalThis as unknown as { window: { Sentry: { captureMessage: typeof mockCaptureMessage }; location?: { pathname: string } } }).window = {
        Sentry: { captureMessage: mockCaptureMessage },
        location: { pathname: "/traslados/nuevo" }
      };

      try {
        await recordOperationalEvent("stripe_payment_failure", { motivo: "card_declined" }, "error");

        expect(mockCaptureMessage).toHaveBeenCalledWith(
          "[usuario:stripe_payment_failure]",
          expect.objectContaining({
            level: "error",
            extra: expect.objectContaining({
              motivo: "card_declined"
            })
          })
        );
      } finally {
        if (originalWindow !== undefined) {
          (globalThis as unknown as { window: unknown }).window = originalWindow;
        } else {
          delete (globalThis as unknown as { window?: unknown }).window;
        }
      }
    });

    it("nunca lanza excepción ni interrumpe la ejecución si Supabase o Sentry fallan", async () => {
      mockRpc.mockRejectedValueOnce(new Error("Supabase network failure"));

      await expect(
        recordOperationalEvent("login_failure", { error: "timeout" }, "error")
      ).resolves.toBeUndefined();
    });
  });

  describe("3. Instrumentation onRequestError", () => {
    it("captura errores de peticiones en servidor con log estructurado", () => {
      const spyConsoleError = vi.spyOn(console, "error").mockImplementation(() => {});

      onRequestError(
        new Error("Error de base de datos"),
        { path: "/api/traslados", method: "POST", headers: {} },
        { routerKind: "App Router", routePath: "/api/traslados", routeType: "route" }
      );

      expect(spyConsoleError).toHaveBeenCalledWith(
        "[usuario:onRequestError]",
        expect.objectContaining({
          path: "/api/traslados",
          method: "POST"
        })
      );

      spyConsoleError.mockRestore();
    });
  });
});
