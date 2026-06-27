// PRD §3 — cuentas personales y empresa, máximo dos usuarios internos por empresa
export type TipoCuenta = "personal" | "empresa";
export type RolUsuario = "personal" | "titular_empresa" | "usuario_autorizado";
export type EstadoVerificacion = "pendiente" | "en_revision" | "verificado" | "rechazado";

export interface Usuario {
  id: string;
  tipo_cuenta: TipoCuenta;
  rol: RolUsuario;
  empresa_id?: string;
  estado_verificacion: EstadoVerificacion;
  // PRD §4.6 — historial positivo habilita pago al cierre (umbral ajustable por Admin)
  traslados_completados_sin_incidencia: number;
  metodo_pago_registrado: boolean;
  creado_en: string;
}
