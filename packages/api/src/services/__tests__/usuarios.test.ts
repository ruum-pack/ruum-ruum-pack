import { describe, it, expect, vi, beforeEach } from "vitest";
import { crearClienteFake } from "./supabase-fake";
import {
  iniciarVerificacionDiditUsuario,
  obtenerEstadoVerificacionDiditUsuario
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
