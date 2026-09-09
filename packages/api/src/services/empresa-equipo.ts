import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import type { Database } from "@ruum/shared/types";
import {
  ROLES_EMPRESA,
  type DatosNuevaSucursal,
  type MiembroEmpresaNuevo,
  type RolEmpresa,
  type RolEmpresaClave,
  type SucursalEmpresa
} from "@ruum/shared/types";
import { esquemaUuid, rpcValidado } from "./_rpc-validado";

// FASE 2 — Equipo empresa: roles, membresías y sucursales (Torre + Empresa).
// Escrituras de membresía vía RPC auditable; sucursales vía RLS location:manage.

type Cliente = SupabaseClient<Database>;

const TABLA_MIEMBROS = "empresa_miembros" as never;
const TABLA_ROLES = "empresa_roles" as never;
const TABLA_ROL_PERMISOS = "empresa_rol_permisos" as never;
const TABLA_SUCURSALES = "empresa_sucursales" as never;

const esquemaRol = z.enum(ROLES_EMPRESA, { message: "Rol de empresa inválido" });

const esquemaInvitar = z.object({
  p_empresa_id: esquemaUuid,
  p_usuario_id: esquemaUuid,
  p_rol: esquemaRol
});

const esquemaCambiarRol = z.object({
  p_miembro_id: esquemaUuid,
  p_rol: esquemaRol
});

const esquemaRemover = z.object({
  p_miembro_id: esquemaUuid
});

export async function listarRoles(cliente: Cliente): Promise<RolEmpresa[]> {
  const desde = (t: never) => (cliente as unknown as { from: (x: never) => never }).from(t) as unknown as {
    select: (c: string) => {
      order: (col: string, o: { ascending: boolean }) => Promise<{ data: Array<Record<string, unknown>> | null; error: unknown }>;
    };
  };

  const [{ data: roles, error: e1 }, { data: permisos, error: e2 }] = await Promise.all([
    desde(TABLA_ROLES).select("*").order("clave", { ascending: true }),
    desde(TABLA_ROL_PERMISOS).select("rol_clave,permiso").order("rol_clave", { ascending: true })
  ]);
  if (e1) throw e1;
  if (e2) throw e2;

  const porRol = new Map<string, string[]>();
  for (const p of permisos ?? []) {
    const lista = porRol.get(String(p["rol_clave"])) ?? [];
    lista.push(String(p["permiso"]));
    porRol.set(String(p["rol_clave"]), lista);
  }

  return (roles ?? []).map((r) => ({
    clave: String(r["clave"]) as RolEmpresaClave,
    nombre: String(r["nombre"] ?? r["clave"]),
    descripcion: (r["descripcion"] as string | null) ?? null,
    es_sistema: Boolean(r["es_sistema"] ?? true),
    permisos: (porRol.get(String(r["clave"])) ?? []) as RolEmpresa["permisos"]
  }));
}

export async function listarMiembros(
  cliente: Cliente,
  empresaId: string
): Promise<MiembroEmpresaNuevo[]> {
  const { data, error } = await (cliente as unknown as {
    from: (t: never) => {
      select: (c: string) => {
        eq: (col: string, v: string) => {
          order: (col: string, o: { ascending: boolean }) => Promise<{
            data: MiembroEmpresaNuevo[] | null;
            error: unknown;
          }>;
        };
      };
    };
  })
    .from(TABLA_MIEMBROS)
    .select("*, usuarios(nombre)")
    .eq("empresa_id", empresaId)
    .order("creado_en", { ascending: true });

  if (error) throw error;
  return (data ?? []).map((m) => {
    const fila = m as unknown as Record<string, unknown>;
    const usuario = fila["usuarios"] as { nombre?: string | null } | null;
    return { ...(m as object), usuario_nombre: usuario?.nombre ?? null } as MiembroEmpresaNuevo;
  });
}

export async function invitarMiembro(
  cliente: Cliente,
  empresaId: string,
  usuarioId: string,
  rol: RolEmpresaClave
): Promise<string> {
  const { data, error } = await rpcValidado(cliente, "empresa_invitar_miembro", esquemaInvitar, {
    p_empresa_id: empresaId,
    p_usuario_id: usuarioId,
    p_rol: rol
  });
  if (error) throw error;
  if (!data) throw new Error("No se pudo invitar al miembro.");
  return data as unknown as string;
}

export async function cambiarRolMiembro(
  cliente: Cliente,
  miembroId: string,
  rol: RolEmpresaClave
): Promise<void> {
  const { error } = await rpcValidado(cliente, "empresa_cambiar_rol_miembro", esquemaCambiarRol, {
    p_miembro_id: miembroId,
    p_rol: rol
  });
  if (error) throw error;
}

export async function removerMiembro(cliente: Cliente, miembroId: string): Promise<void> {
  const { error } = await rpcValidado(cliente, "empresa_remover_miembro", esquemaRemover, {
    p_miembro_id: miembroId
  });
  if (error) throw error;
}

export async function listarSucursales(
  cliente: Cliente,
  empresaId: string
): Promise<SucursalEmpresa[]> {
  const { data, error } = await (cliente as unknown as {
    from: (t: never) => {
      select: (c: string) => {
        eq: (col: string, v: string) => {
          order: (col: string, o: { ascending: boolean }) => Promise<{
            data: SucursalEmpresa[] | null;
            error: unknown;
          }>;
        };
      };
    };
  })
    .from(TABLA_SUCURSALES)
    .select("*")
    .eq("empresa_id", empresaId)
    .order("creado_en", { ascending: true });

  if (error) throw error;
  return data ?? [];
}

function exigirNombreSucursal(nombre: string): void {
  if (!nombre || nombre.trim() === "") {
    throw new Error("El nombre de la sucursal es obligatorio.");
  }
}

export async function crearSucursal(
  cliente: Cliente,
  empresaId: string,
  datos: DatosNuevaSucursal
): Promise<SucursalEmpresa> {
  exigirNombreSucursal(datos.nombre);
  const { data, error } = await (cliente as unknown as {
    from: (t: never) => {
      insert: (f: unknown) => {
        select: (c: string) => {
          single: () => Promise<{ data: SucursalEmpresa | null; error: unknown }>;
        };
      };
    };
  })
    .from(TABLA_SUCURSALES)
    .insert({ empresa_id: empresaId, ...datos, nombre: datos.nombre.trim() })
    .select("*")
    .single();

  if (error) throw error;
  if (!data) throw new Error("No se pudo crear la sucursal.");
  return data;
}

export async function actualizarSucursal(
  cliente: Cliente,
  sucursalId: string,
  cambios: Partial<DatosNuevaSucursal & { activo: boolean }>
): Promise<SucursalEmpresa> {
  if (cambios.nombre !== undefined) exigirNombreSucursal(cambios.nombre);
  const { data, error } = await (cliente as unknown as {
    from: (t: never) => {
      update: (f: unknown) => {
        eq: (col: string, v: string) => {
          select: (c: string) => {
            single: () => Promise<{ data: SucursalEmpresa | null; error: unknown }>;
          };
        };
      };
    };
  })
    .from(TABLA_SUCURSALES)
    .update(cambios)
    .eq("id", sucursalId)
    .select("*")
    .single();

  if (error) throw error;
  if (!data) throw new Error("No se pudo actualizar la sucursal.");
  return data;
}
