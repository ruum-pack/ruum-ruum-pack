export type RequisitoPasswordClave = "longitud" | "minuscula" | "mayuscula" | "numero";

export type RequisitoPassword = {
  clave: RequisitoPasswordClave;
  cumplido: boolean;
};

export const requisitosPassword = (password: string): RequisitoPassword[] => [
  { clave: "longitud", cumplido: password.length >= 8 },
  { clave: "minuscula", cumplido: /[a-z]/.test(password) },
  { clave: "mayuscula", cumplido: /[A-Z]/.test(password) },
  { clave: "numero", cumplido: /\d/.test(password) },
];

export const passwordCumpleRequisitos = (password: string): boolean =>
  requisitosPassword(password).every((requisito) => requisito.cumplido);