"use client";

import { useState } from "react";
import Link from "next/link";
import { Aviso, Button } from "@ruum/ui";
import { crearClienteNavegador } from "../../../../lib/supabase-browser";
import { crearConductorAdmin, type ConductorCrearAdmin } from "@ruum/api/services";

type EstadoConductor = "activo" | "suspendido" | "baja";

export default function PaginaNuevoConductor() {
  const [procesando, setProcesando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [exito, setExito] = useState(false);

  const [datos, setDatos] = useState<ConductorCrearAdmin>({
    auth_user_id: "",
    nombre: "",
    telefono: "",
    curp: "",
    licencia_numero: "",
    licencia_tipo: "",
    licencia_vigencia: "",
    codigo_postal: "",
    estado_residencia: "",
    ciudad_municipio: "",
    colonia: "",
    calle: "",
    numero: "",
    referencias: "",
    contacto_emergencia_nombre: "",
    contacto_emergencia_telefono: ""
  });

  async function crear() {
    if (!datos.auth_user_id.trim() || !datos.nombre.trim() || !datos.telefono.trim() ||
        !datos.curp.trim() || !datos.licencia_numero.trim() || !datos.licencia_tipo.trim() ||
        !datos.licencia_vigencia.trim() || !datos.contacto_emergencia_nombre.trim() ||
        !datos.contacto_emergencia_telefono.trim()) {
      setError("Los campos marcados con * son obligatorios.");
      return;
    }
    setProcesando(true);
    setError(null);
    try {
      const cliente = crearClienteNavegador();
      const conductor = await crearConductorAdmin(cliente, {
        ...datos,
        curp: datos.curp.toUpperCase(),
        telefono: datos.telefono.startsWith("+") ? datos.telefono : `+${datos.telefono}`,
        contacto_emergencia_telefono: datos.contacto_emergencia_telefono.startsWith("+")
          ? datos.contacto_emergencia_telefono
          : `+${datos.contacto_emergencia_telefono}`
      });
      setExito(true);
      setTimeout(() => window.location.href = `/conductores/activos/${conductor.id}`, 1500);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo crear el conductor.");
    } finally {
      setProcesando(false);
    }
  }

  function cambio<K extends keyof ConductorCrearAdmin>(campo: K, valor: string) {
    setDatos((prev) => ({ ...prev, [campo]: valor }));
    setError(null);
  }

  if (exito) return <main className="mx-auto max-w-2xl px-6 py-8"><p className="font-body text-status-success">Conductor creado. Redirigiendo…</p></main>;

  return (
    <main className="mx-auto max-w-2xl px-6 py-8 sm:px-8 sm:py-10">
      <Link href="/conductores/activos" className="font-body text-sm text-text-tertiary hover:text-ink">&larr; Volver a conductores</Link>

      <h1 className="mt-6 font-display text-2xl font-semibold">Nuevo conductor</h1>
      <p className="mt-1 font-body text-sm text-text-secondary">Crea una cuenta de conductor activa. Requiere auth_user_id (UUID de Supabase Auth).</p>

      {error && <div className="mt-4"><Aviso tono="danger">{error}</Aviso></div>}

      <form onSubmit={(e) => { e.preventDefault(); void crear(); }} className="mt-6 space-y-6">
        <fieldset>
          <legend className="font-display text-lg font-semibold">Datos de autenticación</legend>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <CampoObligatorio label="auth_user_id (UUID)" value={datos.auth_user_id} onChange={(v) => cambio("auth_user_id", v)} placeholder="00000000-0000-0000-0000-000000000000" />
            <CampoObligatorio label="Nombre completo *" value={datos.nombre} onChange={(v) => cambio("nombre", v)} placeholder="Juan Pérez López" />
          </div>
        </fieldset>

        <fieldset>
          <legend className="font-display text-lg font-semibold">Datos personales</legend>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <CampoObligatorio label="CURP *" value={datos.curp} onChange={(v) => cambio("curp", v.toUpperCase())} placeholder="PELJ800101HDFLRN09" maxLength={18} />
            <CampoObligatorio label="Teléfono *" value={datos.telefono} onChange={(v) => cambio("telefono", v)} placeholder="+52 55 1234 5678" />
            <CampoObligatorio label="Licencia número *" value={datos.licencia_numero} onChange={(v) => cambio("licencia_numero", v)} placeholder="LIC12345678" />
            <CampoObligatorio label="Tipo licencia *" value={datos.licencia_tipo} onChange={(v) => cambio("licencia_tipo", v)} placeholder="A, B, C, etc." />
            <CampoObligatorio label="Vigencia licencia *" value={datos.licencia_vigencia} onChange={(v) => cambio("licencia_vigencia", v)} placeholder="YYYY-MM-DD" type="date" />
            <CampoOpcional label="Código postal" value={datos.codigo_postal} onChange={(v) => cambio("codigo_postal", v)} placeholder="01000" />
          </div>
        </fieldset>

        <fieldset>
          <legend className="font-display text-lg font-semibold">Domicilio</legend>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <CampoOpcional label="Estado" value={datos.estado_residencia} onChange={(v) => cambio("estado_residencia", v)} placeholder="Ciudad de México" />
            <CampoOpcional label="Ciudad / Municipio" value={datos.ciudad_municipio} onChange={(v) => cambio("ciudad_municipio", v)} placeholder="Álvaro Obregón" />
            <CampoOpcional label="Colonia" value={datos.colonia} onChange={(v) => cambio("colonia", v)} placeholder="San Ángel" />
            <CampoOpcional label="Calle" value={datos.calle} onChange={(v) => cambio("calle", v)} placeholder="Av. Revolución" />
            <CampoOpcional label="Número" value={datos.numero} onChange={(v) => cambio("numero", v)} placeholder="123" />
            <CampoOpcional label="Referencias" value={datos.referencias} onChange={(v) => cambio("referencias", v)} placeholder="Frente a plaza comercial" />
          </div>
        </fieldset>

        <fieldset>
          <legend className="font-display text-lg font-semibold">Contacto de emergencia</legend>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <CampoObligatorio label="Nombre *" value={datos.contacto_emergencia_nombre} onChange={(v) => cambio("contacto_emergencia_nombre", v)} placeholder="María González" />
            <CampoObligatorio label="Teléfono *" value={datos.contacto_emergencia_telefono} onChange={(v) => cambio("contacto_emergencia_telefono", v)} placeholder="+52 55 9876 5432" />
          </div>
        </fieldset>

        <div className="flex gap-2 justify-end">
          <Link href="/conductores/activos" className="rounded-lg border border-ink/20 px-4 py-2 font-body text-sm font-medium hover:bg-ink/5">Cancelar</Link>
          <Button type="submit" disabled={procesando} className="rounded-lg bg-ink px-4 py-2 font-body text-sm font-semibold text-surface-primary hover:bg-ink/90 disabled:opacity-50">
            {procesando ? "Creando…" : "Crear conductor"}
          </Button>
        </div>
      </form>
    </main>
  );
}

function CampoObligatorio({ label, value, onChange, placeholder, type = "text", maxLength }: { label: string; value: string | null | undefined; onChange: (v: string) => void; placeholder?: string; type?: string; maxLength?: number }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="font-body text-xs font-medium text-text-secondary">{label} <span className="text-status-error">*</span></span>
      <input
        type={type}
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        maxLength={maxLength}
        className="rounded-lg border border-ink/20 bg-surface-primary px-3 py-2 font-body text-sm focus:border-focus-default focus:outline-none focus:ring-2 focus:ring-focus-default/20"
      />
    </label>
  );
}

function CampoOpcional({ label, value, onChange, placeholder, type = "text" }: { label: string; value: string | null | undefined; onChange: (v: string) => void; placeholder?: string; type?: string }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="font-body text-xs font-medium text-text-secondary">{label}</span>
      <input
        type={type}
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="rounded-lg border border-ink/20 bg-surface-primary px-3 py-2 font-body text-sm focus:border-focus-default focus:outline-none focus:ring-2 focus:ring-focus-default/20"
      />
    </label>
  );
}