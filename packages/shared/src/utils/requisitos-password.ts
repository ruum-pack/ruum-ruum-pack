export type RequisitoPassword = {
  clave: "longitud" | "mayuscula" | "numero";
  etiqueta: string;
  cumplido: boolean;
};

type ReglaPassword = {
  clave: RequisitoPassword["clave"];
  etiqueta: string;
  prueba: (password: string) => boolean;
};

const REGLAS_PASSWORD: ReglaPassword[] = [
  { clave: "longitud", etiqueta: "Mínimo 8 caracteres", prueba: (pwd) => pwd.length >= 8 },
  { clave: "mayuscula", etiqueta: "Al menos una letra mayúscula (A-Z)", prueba: (pwd) => /[A-Z]/.test(pwd) },
  { clave: "numero", etiqueta: "Al menos un número (0-9)", prueba: (pwd) => /[0-9]/.test(pwd) }
];

/**
 * Evalúa una contraseña contra cada requisito mínimo. Pensada para alimentar
 * un checklist visual (✓/○) y, con `passwordCumpleRequisitos`, la validación
 * de submit — así la UI nunca "promete" un requisito que el formulario no
 * exige de verdad.
 */
export function requisitosPassword(password: string): RequisitoPassword[] {
  return REGLAS_PASSWORD.map(({ clave, etiqueta, prueba }) => ({
    clave,
    etiqueta,
    cumplido: prueba(password)
  }));
}

export function passwordCumpleRequisitos(password: string): boolean {
  return requisitosPassword(password).every((requisito) => requisito.cumplido);
}
