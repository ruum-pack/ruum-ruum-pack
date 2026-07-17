"use client";

import Link from "next/link";

export type TipoDatoSensible = "curp" | "licencia" | "cuenta_bancaria" | "contacto_emergencia" | "documentos";

const TEXTOS: Record<TipoDatoSensible, { titulo: string; finalidad: string; acceso: string; proteccion: string }> = {
  curp: {
    titulo: "CURP",
    finalidad: "La usamos para validar tu identidad y evitar registros duplicados.",
    acceso: "Solo operación y administradores autorizados durante la revisión de tu expediente.",
    proteccion: "Se guarda en Supabase con permisos por sesión y no se conserva en el borrador local."
  },
  licencia: {
    titulo: "Licencia",
    finalidad: "Confirma que puedes operar traslados y que tu licencia sigue vigente.",
    acceso: "La revisa operación y, cuando aplica, el equipo de cumplimiento.",
    proteccion: "Los archivos se guardan en un bucket privado y el frontend solo muestra estado y datos enmascarados."
  },
  cuenta_bancaria: {
    titulo: "Cuenta bancaria",
    finalidad: "Permite programar depósitos por tus viajes confirmados.",
    acceso: "Solo operación financiera y sistemas de pago autorizados.",
    proteccion: "Los cambios requieren confirmar tu sesión y vuelven a revisión antes de usarse."
  },
  contacto_emergencia: {
    titulo: "Contacto de emergencia",
    finalidad: "Lo usamos únicamente si ocurre una eventualidad durante un traslado.",
    acceso: "Solo soporte y operación cuando existe una incidencia o emergencia.",
    proteccion: "Se muestra enmascarado fuera de edición y se protege con las reglas de acceso de tu cuenta."
  },
  documentos: {
    titulo: "Documentos",
    finalidad: "Ayudan a validar tu identidad, licencia y requisitos operativos.",
    acceso: "Solo operación y revisores autorizados.",
    proteccion: "Se almacenan de forma privada; la app no expone nombres completos ni rutas de archivo."
  }
};

export function enmascararUltimos(valor: string | null | undefined, visibles = 4) {
  const limpio = valor?.trim() ?? "";
  if (!limpio) return "";
  if (limpio.length <= visibles) return "••••";
  return `${"•".repeat(Math.min(8, limpio.length - visibles))}${limpio.slice(-visibles)}`;
}

export function enmascararNombreArchivo(nombre: string | null | undefined) {
  const limpio = nombre?.trim() ?? "";
  if (!limpio) return "";
  const extension = limpio.includes(".") ? `.${limpio.split(".").pop()}` : "";
  return `Documento protegido${extension}`;
}

export function DatosSensiblesInfo({ tipo, compacto = false }: { tipo: TipoDatoSensible; compacto?: boolean }) {
  const texto = TEXTOS[tipo];
  return (
    <div className={`rounded-lg border border-route-action/15 bg-route-soft ${compacto ? "px-3 py-3" : "px-4 py-4"}`}>
      <p className="font-body text-sm font-semibold text-text-primary">{texto.titulo}</p>
      <dl className="mt-2 grid gap-2 font-body text-xs leading-5 text-text-secondary">
        <div><dt className="font-semibold text-text-secondary">¿Por qué lo pedimos?</dt><dd>{texto.finalidad}</dd></div>
        <div><dt className="font-semibold text-text-secondary">¿Quién puede verlo?</dt><dd>{texto.acceso}</dd></div>
        <div><dt className="font-semibold text-text-secondary">¿Cómo se protege?</dt><dd>{texto.proteccion}</dd></div>
      </dl>
      <Link href="/legal/privacidad" target="_blank" className="mt-2 inline-block font-body text-xs font-semibold text-route-action underline-offset-4 hover:underline">
        Ver aviso de privacidad
      </Link>
    </div>
  );
}
