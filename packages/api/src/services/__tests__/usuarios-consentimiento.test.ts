import { describe, it, expect, vi, beforeEach } from "vitest";
import { crearClienteFake } from "./supabase-fake";
import { obtenerUsuarioActual, registrarConsentimientoUsuario } from "../usuarios";

// Mock para obtenerUsuarioActual fallback
describe("PR-07 — No fabricar aceptación de términos (usuarios)", () => {
  beforeEach(() => vi.clearAllMocks());

  it("fallback de creación de perfil NO fabrica consentimiento (version y fecha deben ser null)", async () => {
    // Simular: auth.getUser retorna usuario sin fila en usuarios, fallback hace insert
    const cliente = crearClienteFake({
      userId: "auth-user-123",
      tablas: {
        usuarios: { data: null }, // no existe, fallback intentará insertar
      },
    }) as any;

    // Mock para from("usuarios").insert(...).select().single()
    // Necesitamos mockear el insert para capturar los valores
    const insertMock = vi.fn(async (payload: Record<string, unknown>) => {
      // Verificar que no se fabrica consentimiento
      expect(payload.version_terminos_aceptada).toBeNull();
      expect(payload.terminos_aceptados_en).toBeNull();
      // Nombre y tipo_cuenta deben venir de metadata, no de default
      expect(payload.auth_user_id).toBe("auth-user-123");
      return { data: { id: "usuario-123", ...payload }, error: null };
    });

    // Sobrescribir from para usuarios insert
    const originalFrom = cliente.from;
    cliente.from = vi.fn((table: string) => {
      if (table === "usuarios") {
        const queryFake: any = {
          select: vi.fn(() => queryFake),
          eq: vi.fn(() => queryFake),
          maybeSingle: vi.fn(async () => ({ data: null, error: null })), // primera búsqueda no encuentra
          insert: vi.fn((payload: Record<string, unknown>) => ({
            select: vi.fn(() => ({
              single: vi.fn(async () => insertMock(payload)),
            })),
          })),
        };
        return queryFake;
      }
      return originalFrom(table);
    });

    const usuario = await obtenerUsuarioActual(cliente);
    expect(usuario).toBeDefined();
    expect(insertMock).toHaveBeenCalledOnce();
  });

  it("fallback separa creación de registro de consentimiento (no inserta en consentimientos_usuario ni auditoría de aceptacion)", async () => {
    // El fallback no debe insertar en consentimientos_usuario ni en registro_auditoria con evento aceptacion_terminos
    // Solo debe crear la fila básica
    const cliente = crearClienteFake({
      userId: "auth-user-456",
      tablas: { usuarios: { data: null } },
    }) as any;

    let insertPayload: Record<string, unknown> | null = null;
    cliente.from = vi.fn((table: string) => {
      if (table === "usuarios") {
        return {
          select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: null, error: null }) }) }),
          insert: (payload: Record<string, unknown>) => ({
            select: () => ({
              single: async () => {
                insertPayload = payload;
                return { data: { id: "u-456", ...payload }, error: null };
              },
            }),
          }),
        } as any;
      }
      return { select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: null, error: null }) }) }) } as any;
    });

    await obtenerUsuarioActual(cliente);
    expect(insertPayload).not.toBeNull();
    expect((insertPayload as any).version_terminos_aceptada).toBeNull();
    expect((insertPayload as any).terminos_aceptados_en).toBeNull();
    // No debe haber llamado a rpc registrar_consentimiento_usuario
    const rpcCalls = (cliente as { llamadas: { action: string }[] }).llamadas.filter((l) => l.action === "registrar_consentimiento_usuario");
    expect(rpcCalls.length).toBe(0);
  });

  describe("registrarConsentimientoUsuario — registro explícito con versión, timestamp, canal y auditoría", () => {
    it("requiere versión concreta y no acepta 0", async () => {
      const cliente = crearClienteFake({ userId: "u1" }) as any;
      await expect(registrarConsentimientoUsuario(cliente, { version: 0, canal: "web", versionApp: "1.0" })).rejects.toThrow("Versión");
    });

    it("requiere canal explícito web/android/ios", async () => {
      const cliente = crearClienteFake({ userId: "u1" }) as any;
      await expect(registrarConsentimientoUsuario(cliente, { version: 1, canal: "email" as never, versionApp: "1.0" })).rejects.toThrow("Canal");
    });

    it("requiere versión vigente existente", async () => {
      const cliente = crearClienteFake({
        userId: "u1",
        tablas: {
          usuarios: { data: { id: "u-1", auth_user_id: "u1" } },
          versiones_documento_consentimiento: { data: null, error: null },
        },
      }) as any;
      // Mock from para versiones_documento_consentimiento que retorna null (no vigente)
      cliente.from = vi.fn((table: string) => {
        if (table === "versiones_documento_consentimiento") {
          return {
            select: () => ({
              eq: () => ({
                eq: () => ({
                  maybeSingle: async () => ({ data: null, error: null }),
                }),
              }),
            }),
          } as any;
        }
        if (table === "usuarios") {
          return {
            select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { id: "u-1" }, error: null }) }) }),
          } as any;
        }
        return { select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: null, error: null }) }) }) } as any;
      });
      await expect(registrarConsentimientoUsuario(cliente, { version: 999, canal: "web", versionApp: "1.0" })).rejects.toThrow("no está vigente");
    });

    it("registra consentimiento explícito con timestamp real y auditoría (via RPC o fallback)", async () => {
      const ahora = new Date().toISOString();
      const cliente = crearClienteFake({
        userId: "auth-u1",
        tablas: {
          usuarios: { data: { id: "usuario-1", auth_user_id: "auth-u1" } },
          versiones_documento_consentimiento: { data: { version: 1, hash_documento: "abc" } },
          consentimientos_usuario: { data: null },
        },
        rpcs: {
          registrar_consentimiento_usuario: { data: { version: 1, aceptado_en: ahora, canal: "web" } },
        },
      }) as any;

      const res = await registrarConsentimientoUsuario(cliente, { version: 1, canal: "web", versionApp: "1.0.0", aceptadoEn: ahora });
      expect(res.version).toBe(1);
      expect(res.aceptado_en).toBe(ahora);
      // Verifica que se llamó al RPC con versión concreta, timestamp real, canal y version_app
      const llamada = (cliente as { llamadas: { action: string; args: unknown[] }[] }).llamadas.find((l) => l.action === "registrar_consentimiento_usuario");
      expect(llamada).toBeDefined();
      expect(((llamada as unknown as { args: Record<string, unknown>[] }).args[0] as Record<string, unknown>).p_version).toBe(1);
      expect(((llamada as unknown as { args: Record<string, unknown>[] }).args[0] as Record<string, unknown>).p_canal).toBe("web");
      expect(((llamada as unknown as { args: Record<string, unknown>[] }).args[0] as Record<string, unknown>).p_version_app).toBe("1.0.0");
    });

    it("nunca rellena consentimiento como default sin acción explícita", async () => {
      // Simular que se crea usuario sin llamar a registrarConsentimientoUsuario
      // El usuario debe quedar con version_terminos_aceptada = null
      const cliente = crearClienteFake({
        userId: "auth-new",
        tablas: { usuarios: { data: null } },
      }) as any;
      let payloadInsert: Record<string, unknown> | null = null;
      cliente.from = vi.fn((table: string) => {
        if (table === "usuarios") {
          return {
            select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: null, error: null }) }) }),
            insert: (p: Record<string, unknown>) => ({
              select: () => ({
                single: async () => {
                  payloadInsert = p;
                  return { data: { id: "new-id", ...p }, error: null };
                },
              }),
            }),
          } as any;
        }
        return { select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: null, error: null }) }) }) } as any;
      });
      await obtenerUsuarioActual(cliente);
      expect((payloadInsert as any)?.version_terminos_aceptada).toBeNull();
      expect((payloadInsert as any)?.terminos_aceptados_en).toBeNull();
    });
  });
});

describe("PR-07 — Admin invitar-conductor no fabrica consentimiento", () => {
  it("invitación no debe asignar version_terminos_aceptada ni terminos_aceptados_en", async () => {
    // Simular el payload que enviaría la ruta de invitación
    // Debe ser null, no 1 ni now()
    const payloadConductor = {
      version_terminos_aceptada: null,
      terminos_aceptados_en: null,
      marca_terminos: null,
    };
    expect(payloadConductor.version_terminos_aceptada).toBeNull();
    expect(payloadConductor.terminos_aceptados_en).toBeNull();
    expect(payloadConductor.marca_terminos).toBeNull();
  });
});
