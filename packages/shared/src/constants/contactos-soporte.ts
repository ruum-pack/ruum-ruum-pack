export type AmbienteRuum = "production" | "staging" | "development" | "test";

export type CanalSoporte = {
  etiqueta: string;
  href: string;
  valor: string;
  ambiente: AmbienteRuum;
  esPrueba: boolean;
};

export type ConfiguracionContactosSoporte = {
  ambiente: AmbienteRuum;
  soporte: {
    telefono: CanalSoporte;
    whatsapp: CanalSoporte;
    correo: CanalSoporte;
    bajaCuenta: CanalSoporte;
  };
  emergencia: {
    telefono: CanalSoporte;
  };
};

export type EntradaContactosSoporte = {
  ambiente?: string;
  telefonoSoporte?: string;
  correoSoporte?: string;
  telefonoEmergencia?: string;
};

const CONTACTOS_PRODUCCION = {
  telefonoSoporte: "5669522178",
  correoSoporte: "ruum.ruum.mx@gmail.com",
  telefonoEmergencia: "911"
};

const CONTACTOS_PRUEBA = {
  telefonoSoporte: "5500000000",
  correoSoporte: "soporte-conductores-pruebas@example.test",
  telefonoEmergencia: "5500000911"
};

function ambienteRuum(valor: string | undefined): AmbienteRuum {
  if (valor === "production" || valor === "staging" || valor === "test") return valor;
  return "development";
}

function digitos(valor: string) {
  return valor.replace(/\D/g, "");
}

function telefonoNacional(valor: string) {
  const limpio = digitos(valor);
  if (limpio.length > 10 && limpio.startsWith("52")) return limpio.slice(2);
  return limpio;
}

function telefonoE164(valor: string) {
  const nacional = telefonoNacional(valor);
  if (nacional === "911") return "911";
  return nacional.length === 10 ? `+52${nacional}` : valor;
}

function telefonoWhatsApp(valor: string) {
  const nacional = telefonoNacional(valor);
  return nacional.length === 10 ? `52${nacional}` : digitos(valor);
}

function etiquetaPrueba(etiqueta: string, esPrueba: boolean) {
  return esPrueba ? `${etiqueta} (pruebas)` : etiqueta;
}

function canalTelefono(etiqueta: string, telefono: string, ambiente: AmbienteRuum, esPrueba: boolean): CanalSoporte {
  const valor = telefonoE164(telefono);
  return {
    etiqueta: etiquetaPrueba(etiqueta, esPrueba),
    href: `tel:${valor}`,
    valor,
    ambiente,
    esPrueba
  };
}

function canalWhatsApp(telefono: string, ambiente: AmbienteRuum, esPrueba: boolean): CanalSoporte {
  const texto = encodeURIComponent("Hola Ruum Ruum, necesito soporte como conductor.");
  const valor = telefonoWhatsApp(telefono);
  return {
    etiqueta: etiquetaPrueba("Contactar por WhatsApp", esPrueba),
    href: `https://wa.me/${valor}?text=${texto}`,
    valor,
    ambiente,
    esPrueba
  };
}

function canalCorreo(etiqueta: string, correo: string, asunto: string, ambiente: AmbienteRuum, esPrueba: boolean): CanalSoporte {
  return {
    etiqueta: etiquetaPrueba(etiqueta, esPrueba),
    href: `mailto:${correo}?subject=${encodeURIComponent(asunto)}`,
    valor: correo,
    ambiente,
    esPrueba
  };
}

export function crearConfiguracionContactosSoporte(entrada: EntradaContactosSoporte = {}): ConfiguracionContactosSoporte {
  const ambiente = ambienteRuum(entrada.ambiente);
  const defaults = ambiente === "production" ? CONTACTOS_PRODUCCION : CONTACTOS_PRUEBA;
  const esPrueba = ambiente !== "production";
  const telefonoSoporte = entrada.telefonoSoporte || defaults.telefonoSoporte;
  const correoSoporte = entrada.correoSoporte || defaults.correoSoporte;
  const telefonoEmergencia = entrada.telefonoEmergencia || defaults.telefonoEmergencia;

  return {
    ambiente,
    soporte: {
      telefono: canalTelefono("Llamar a soporte", telefonoSoporte, ambiente, esPrueba),
      whatsapp: canalWhatsApp(telefonoSoporte, ambiente, esPrueba),
      correo: canalCorreo("Enviar correo electrónico", correoSoporte, "Soporte conductor", ambiente, esPrueba),
      bajaCuenta: canalCorreo("Solicitar baja", correoSoporte, "Baja de cuenta", ambiente, esPrueba)
    },
    emergencia: {
      telefono: canalTelefono("Emergencia / 911", telefonoEmergencia, ambiente, esPrueba)
    }
  };
}
