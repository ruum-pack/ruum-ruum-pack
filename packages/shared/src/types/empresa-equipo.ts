// FASE 2 — Nuevo modelo empresarial: equipo sin límite de 2 usuarios.
// Tablas: empresa_roles, empresa_rol_permisos, empresa_miembros,
// empresa_sucursales. La autoridad es la DB; esta matriz es el espejo
// legible (misma convención que estados/transiciones de traslado).

export type RolEmpresaClave =
  | "owner"
  | "admin"
  | "operations_manager"
  | "dispatcher"
  | "finance"
  | "viewer";

export type PermisoEmpresa =
  | "operation:create"
  | "operation:view"
  | "operation:update"
  | "transfer:create"
  | "transfer:view"
  | "transfer:cancel"
  | "driver:view"
  | "driver:assign"
  | "billing:view"
  | "billing:manage"
  | "reports:view"
  | "team:manage"
  | "location:view"
  | "location:manage";

export type EstadoMiembroEmpresa = "activo" | "invitado" | "suspendido";

export const ROLES_EMPRESA: [RolEmpresaClave, ...RolEmpresaClave[]] = [
  "owner",
  "admin",
  "operations_manager",
  "dispatcher",
  "finance",
  "viewer"
];

export const PERMISOS_EMPRESA: PermisoEmpresa[] = [
  "operation:create",
  "operation:view",
  "operation:update",
  "transfer:create",
  "transfer:view",
  "transfer:cancel",
  "driver:view",
  "driver:assign",
  "billing:view",
  "billing:manage",
  "reports:view",
  "team:manage",
  "location:view",
  "location:manage"
];

export const ROL_PERMISOS_EMPRESA: Record<RolEmpresaClave, PermisoEmpresa[]> = {
  owner: [...PERMISOS_EMPRESA],
  admin: [...PERMISOS_EMPRESA],
  operations_manager: [
    "operation:create",
    "operation:view",
    "operation:update",
    "transfer:create",
    "transfer:view",
    "transfer:cancel",
    "driver:view",
    "driver:assign",
    "reports:view",
    "location:view",
    "location:manage"
  ],
  dispatcher: [
    "operation:view",
    "transfer:create",
    "transfer:view",
    "driver:view",
    "driver:assign",
    "location:view"
  ],
  finance: ["operation:view", "transfer:view", "billing:view", "billing:manage", "reports:view"],
  viewer: [
    "operation:view",
    "transfer:view",
    "driver:view",
    "billing:view",
    "reports:view",
    "location:view"
  ]
};

export function tienePermisoEmpresa(rol: RolEmpresaClave, permiso: PermisoEmpresa): boolean {
  return ROL_PERMISOS_EMPRESA[rol]?.includes(permiso) ?? false;
}

export interface RolEmpresa {
  clave: RolEmpresaClave;
  nombre: string;
  descripcion?: string | null;
  es_sistema: boolean;
  permisos: PermisoEmpresa[];
}

export interface MiembroEmpresaNuevo {
  id: string;
  empresa_id: string;
  usuario_id: string;
  rol_clave: RolEmpresaClave;
  estado: EstadoMiembroEmpresa;
  invitado_por?: string | null;
  creado_en: string;
  actualizado_en: string;
  usuario_nombre?: string | null;
}

export interface SucursalEmpresa {
  id: string;
  empresa_id: string;
  nombre: string;
  es_principal: boolean;
  activo: boolean;
  calle?: string | null;
  numero?: string | null;
  colonia?: string | null;
  codigo_postal?: string | null;
  estado?: string | null;
  ciudad?: string | null;
  direccion?: string | null;
  referencias?: string | null;
  lat?: number | null;
  lng?: number | null;
  contacto_nombre?: string | null;
  contacto_telefono?: string | null;
  creado_en: string;
  actualizado_en: string;
}

export interface DatosNuevaSucursal {
  nombre: string;
  es_principal?: boolean;
  calle?: string | null;
  numero?: string | null;
  colonia?: string | null;
  codigo_postal?: string | null;
  estado?: string | null;
  ciudad?: string | null;
  direccion?: string | null;
  referencias?: string | null;
  lat?: number | null;
  lng?: number | null;
  contacto_nombre?: string | null;
  contacto_telefono?: string | null;
}
