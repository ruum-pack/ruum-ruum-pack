import { crearConfiguracionContactosSoporte } from "@ruum/shared/constants";

export const CONTACTOS_SOPORTE_CONDUCTOR = crearConfiguracionContactosSoporte({
  ambiente: process.env.NEXT_PUBLIC_RUUM_AMBIENTE ?? process.env.NEXT_PUBLIC_VERCEL_ENV ?? process.env.NODE_ENV,
  telefonoSoporte: process.env.NEXT_PUBLIC_RUUM_SOPORTE_TELEFONO,
  correoSoporte: process.env.NEXT_PUBLIC_RUUM_SOPORTE_CORREO,
  telefonoEmergencia: process.env.NEXT_PUBLIC_RUUM_EMERGENCIA_TELEFONO
});
