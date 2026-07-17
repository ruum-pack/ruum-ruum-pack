"use client";

import { ChangeEvent, useEffect, useState } from "react";
import { Aviso, Button, Card } from "@ruum/ui";
import { obtenerConfiguracionConductor, subirDocumentoConductor, type TipoDocumentoConductor } from "@ruum/api/services";
import { traducirErrorOperativo } from "@ruum/shared/utils";
import type { Database } from "@ruum/shared/types";
import { crearClienteNavegador } from "../../../lib/supabase-browser";
import { CuentaHeader } from "../CuentaHeader";
import { cargarConductorCuenta, type ConductorCuenta } from "../cuenta-utils";
import { DatosSensiblesInfo } from "../datos-sensibles";
import { DriverDocumentChecklist } from "./DriverDocumentChecklist";

type Documento = Database["public"]["Tables"]["documentos_conductor"]["Row"];

export default function PaginaDocumentosCuenta() {
  const [conductor, setConductor] = useState<ConductorCuenta | null>(null);
  const [documentos, setDocumentos] = useState<Documento[]>([]);
  const [mensaje, setMensaje] = useState<string | null>(null);
  const [subiendo, setSubiendo] = useState<TipoDocumentoConductor | null>(null);
  const [cargando, setCargando] = useState(true);

  async function cargar() {
    const actual = await cargarConductorCuenta();
    setConductor(actual);
    if (actual) {
      const cliente = crearClienteNavegador();
      const config = await obtenerConfiguracionConductor(cliente, actual.id);
      setDocumentos(config.documentos);
    }
    setCargando(false);
  }

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void cargar();
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  async function subirDocumento(tipoDocumento: TipoDocumentoConductor, evento: ChangeEvent<HTMLInputElement>) {
    const archivo = evento.target.files?.[0];
    if (!archivo || !conductor) return;
    setMensaje(null);
    setSubiendo(tipoDocumento);
    try {
      const cliente = crearClienteNavegador();
      await subirDocumentoConductor(cliente, conductor.id, tipoDocumento, archivo);
      setMensaje("Documento cargado y enviado a revisión.");
      await cargar();
    } catch (error) {
      setMensaje(traducirErrorOperativo(error, "No pudimos registrar el documento."));
    } finally {
      setSubiendo(null);
      evento.target.value = "";
    }
  }

  return (
    <div className="mx-auto max-w-4xl px-6 py-10 sm:py-14">
      <CuentaHeader titulo="Documentos" descripcion="Consulta y actualiza tu expediente operativo." />
      {mensaje && <div className="mt-5"><Aviso tono="info">{mensaje}</Aviso></div>}
      <Card className="mt-6">
        {cargando ? <p className="font-body text-sm text-text-secondary">Cargando documentos...</p> : (
          <div className="grid gap-5">
            <div>
              <p className="font-body text-xs uppercase tracking-wide text-text-tertiary">Checklist documental</p>
              <h2 className="mt-1 font-display text-xl font-semibold">Documentos que pueden bloquear tu cuenta</h2>
              <p className="mt-2 font-body text-sm leading-6 text-text-secondary">
                Los documentos bloqueantes aparecen primero. Los aprobados no vuelven a solicitarse.
              </p>
            </div>
            <DatosSensiblesInfo tipo="documentos" />
            <DriverDocumentChecklist conductor={conductor} documentos={documentos} subiendo={subiendo} onUpload={subirDocumento} />
          </div>
        )}
      </Card>
    </div>
  );
}
