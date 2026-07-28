"use client";

import { useEffect } from "react";

const TIPOS_EXCLUIDOS = new Set([
  "button",
  "checkbox",
  "color",
  "date",
  "datetime-local",
  "email",
  "file",
  "hidden",
  "month",
  "number",
  "password",
  "radio",
  "range",
  "reset",
  "search",
  "submit",
  "tel",
  "time",
  "url",
  "week"
]);

const PATRONES_EXCLUIDOS = [
  "correo",
  "email",
  "mail",
  "password",
  "contrasena",
  "contraseña",
  "buscar",
  "busqueda",
  "búsqueda",
  "search",
  "filtro",
  "folio",
  "uuid",
  "id",
  "rfc",
  "curp",
  "placa",
  "placas",
  "codigo",
  "código",
  "postal",
  "telefono",
  "teléfono",
  "phone",
  "hash",
  "token",
  "trace",
  "url",
  "referencia"
];

const PATRONES_ALFANUMERICOS_MAYUSCULAS = ["vin", "licencia", "license"];

export function TextInputUppercaseBridge() {
  useEffect(() => {
    function onInput(event: Event) {
      if (event instanceof InputEvent && event.isComposing) return;
      const objetivo = event.target;
      if (!(objetivo instanceof HTMLInputElement || objetivo instanceof HTMLTextAreaElement)) return;
      if (!debeNormalizarMayusculas(objetivo)) return;
      normalizarValor(objetivo);
    }

    document.addEventListener("input", onInput, true);
    return () => document.removeEventListener("input", onInput, true);
  }, []);

  return null;
}

function debeNormalizarMayusculas(elemento: HTMLInputElement | HTMLTextAreaElement) {
  if (elemento.readOnly || elemento.disabled) return false;
  const preferencia = elemento.dataset.ruumUppercase;
  if (preferencia === "off") return false;
  if (preferencia === "on") return true;

  if (elemento instanceof HTMLInputElement) {
    const tipo = (elemento.type || "text").toLowerCase();
    if (TIPOS_EXCLUIDOS.has(tipo)) return false;
  }

  const descriptor = descriptorCampo(elemento);
  if (PATRONES_ALFANUMERICOS_MAYUSCULAS.some((patron) => descriptor.includes(patron))) return true;
  if (PATRONES_EXCLUIDOS.some((patron) => descriptor.includes(patron))) return false;
  if (elemento.inputMode && elemento.inputMode !== "text") return false;
  if (elemento.pattern && /\\d|\[0-9\]|[0-9]/.test(elemento.pattern)) return false;

  return true;
}

function normalizarValor(elemento: HTMLInputElement | HTMLTextAreaElement) {
  const siguiente = elemento.value.toLocaleUpperCase("es-MX");
  if (siguiente === elemento.value) return;

  const inicio = elemento.selectionStart;
  const fin = elemento.selectionEnd;
  elemento.value = siguiente;
  if (document.activeElement === elemento && inicio !== null && fin !== null) {
    try {
      elemento.setSelectionRange(inicio, fin);
    } catch {
      // Algunos tipos de input no soportan selección; ya fueron excluidos arriba.
    }
  }
}

function descriptorCampo(elemento: HTMLInputElement | HTMLTextAreaElement) {
  const partes = [
    elemento.name,
    elemento.id,
    elemento.autocomplete,
    elemento.placeholder,
    elemento.getAttribute("aria-label"),
    elemento.dataset.ruumLabel
  ];
  return partes
    .filter((parte): parte is string => Boolean(parte))
    .join(" ")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}
