"use client";

import { useState } from "react";
import { Aviso, Button, Field } from "@ruum/ui";
import type { Database } from "@ruum/shared/types";
import { actualizarFacturacionUsuario } from "@ruum/api/services";
import { crearClienteNavegador, tieneSupabaseConfigurado } from "../../lib/supabase-browser";

type Usuario = Database["public"]["Tables"]["usuarios"]["Row"];
type Empresa = Database["public"]["Tables"]["empresas"]["Row"];
type CampoFiscal = "rfc" | "razon_social" | "regimen_fiscal" | "codigo_postal_fiscal" | "uso_cfdi";

function limpiar(valor: string) {
  return valor.trim() || null;
}

function soloAlfanumericoFiscal(valor: string, maximo: number) {
  return valor.replace(/[^a-zA-Z0-9]/g, "").toUpperCase().slice(0, maximo);
}

function soloDigitos(valor: string, maximo: number) {
  return valor.replace(/\D/g, "").slice(0, maximo);
}

function datoFiscal(usuario: Usuario, empresa: Empresa | null, campo: CampoFiscal) {
  return empresa?.[campo] ?? usuario?.[campo] ?? "";
}

export function FacturacionCuentaForm({ usuario, empresa }: { usuario: Usuario; empresa: Empresa | null }) {
  const [rfc, setRfc] = useState(datoFiscal(usuario, empresa, "rfc"));
  const [razonSocial, setRazonSocial] = useState(datoFiscal(usuario, empresa, "razon_social") || empresa?.nombre || "");
  const [regimenFiscal, setRegimenFiscal] = useState(datoFiscal(usuario, empresa, "regimen_fiscal"));
  const [codigoPostalFiscal, setCodigoPostalFiscal] = useState(datoFiscal(usuario, empresa, "codigo_postal_fiscal"));
  const [usoCfdi, setUsoCfdi] = useState(datoFiscal(usuario, empresa, "uso_cfdi"));
  const [correoFacturacion, setCorreoFacturacion] = useState(empresa?.correo_facturacion ?? usuario.correo_facturacion ?? "");
  const [guardando, setGuardando] = useState(false);
  const [mensaje, setMensaje] = useState<{ tono: "info" | "danger"; texto: string } | null>(null);

  async function guardar(e: React.FormEvent) {
    e.preventDefault();
    setMensaje(null);

    if (!rfc || rfc.length < 12 || !razonSocial.trim() || !regimenFiscal.trim() || codigoPostalFiscal.length !== 5 || !usoCfdi.trim()) {
      setMensaje({ tono: "danger", texto: "Completa RFC, razón social, régimen fiscal, CP fiscal y uso de CFDI." });
      return;
    }

    if (!tieneSupabaseConfigurado()) {
      setMensaje({ tono: "danger", texto: "Supabase no está configurado. No se pueden guardar cambios." });
      return;
    }

    setGuardando(true);
    try {
      await actualizarFacturacionUsuario(crearClienteNavegador(), {
        rfc,
        razon_social: limpiar(razonSocial),
        regimen_fiscal: limpiar(regimenFiscal),
        codigo_postal_fiscal: codigoPostalFiscal,
        uso_cfdi: limpiar(usoCfdi),
        correo_facturacion: limpiar(correoFacturacion)
      });
      setMensaje({ tono: "info", texto: "Datos de facturación actualizados." });
    } catch (err) {
      setMensaje({ tono: "danger", texto: err instanceof Error ? err.message : "No pudimos guardar los datos fiscales." });
    } finally {
      setGuardando(false);
    }
  }

  return (
    <form className="grid gap-4" onSubmit={guardar}>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field etiqueta="RFC" value={rfc} onChange={(e) => setRfc(soloAlfanumericoFiscal(e.target.value, 13))} minLength={12} maxLength={13} required />
        <Field etiqueta="Razón social" value={razonSocial} onChange={(e) => setRazonSocial(e.target.value)} required />
        <Field etiqueta="Régimen fiscal" value={regimenFiscal} onChange={(e) => setRegimenFiscal(e.target.value)} required />
        <Field etiqueta="Código postal fiscal" value={codigoPostalFiscal} onChange={(e) => setCodigoPostalFiscal(soloDigitos(e.target.value, 5))} inputMode="numeric" maxLength={5} required />
        <Field etiqueta="Uso de CFDI" value={usoCfdi} onChange={(e) => setUsoCfdi(e.target.value.toUpperCase())} required />
        <Field etiqueta="Correo para facturación" type="email" value={correoFacturacion} onChange={(e) => setCorreoFacturacion(e.target.value)} />
      </div>

      {mensaje && (
        <div role="status" aria-live="polite" aria-atomic="true">
          <Aviso tono={mensaje.tono}>{mensaje.texto}</Aviso>
        </div>
      )}

      <div>
        <Button type="submit" disabled={guardando}>
          {guardando ? "Guardando..." : "Guardar datos fiscales"}
        </Button>
      </div>
    </form>
  );
}
