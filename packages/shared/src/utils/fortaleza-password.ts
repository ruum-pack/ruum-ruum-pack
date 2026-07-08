export type FortalezaPassword = {
  nivel: 0 | 1 | 2 | 3;
  etiqueta: string;
};

export function fortalezaPassword(pwd: string): FortalezaPassword {
  if (pwd.length < 6) return { nivel: 0, etiqueta: "" };

  let score = 0;
  if (pwd.length >= 10) score++;
  if (/[A-Z]/.test(pwd)) score++;
  if (/[0-9]/.test(pwd)) score++;
  if (/[^A-Za-z0-9]/.test(pwd)) score++;

  if (score <= 1) return { nivel: 1, etiqueta: "Débil — agrega números o mayúsculas" };
  if (score === 2) return { nivel: 2, etiqueta: "Media — agrega un símbolo para reforzarla" };
  return { nivel: 3, etiqueta: "Fuerte" };
}

export const fortaleza = fortalezaPassword;
