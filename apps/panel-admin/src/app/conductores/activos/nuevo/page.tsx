"use client";

import { useState } from "react";
import Link from "next/link";
import { Aviso, Button } from "@ruum/ui";
import { consultarCodigoPostalMx } from "@ruum/shared/utils";
import { validarRegistroConductor, type CampoRegistroConductor } from "@ruum/shared/validacion";
import { crearClienteNavegador } from "../../../../lib/supabase-browser";
import { crearConductorAdmin, type ConductorCrearAdmin } from "@ruum/api/services";

const TIPOS_LICENCIA = [
  "Tipo A - Automovilista",
  "Tipo B - Chofer",
  "Tipo C - Carga",
  "Tipo D - Motociclista",
  "Tipo E - Transporte especializado",
  "Licencia federal de conductor"
];

const FORM_INICIAL: ConductorCrearAdmin = {
  correo: "",
  nombre: "",
  apellidos: "",
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
  contacto_emergencia_telefono: "",
  autoriza_verificacion_antecedentes: false,
  declara_sin_suspensiones: false
};

type ErroresAltaConductor = Partial<Record<CampoRegistroConductor | "declaraciones", string>>;

function soloDigitos(valor: string, max = 10) {
  return valor.replace(/\D/g, "").slice(0, max);
}

function soloAlfanumericoMayusculas(valor: string, max = 12) {
  return valor.replace(/[^a-zA-Z0-9]/g, "").toLocaleUpperCase("es-MX").slice(0, max);
}

function telefonoE164Mx(valor: string) {
  const nacional = soloDigitos(valor);
  return nacional ? `+52${nacional}` : "";
}

function formatoTelefonoNacional(valor: string) {
  const digitos = soloDigitos(valor);
  if (digitos.length <= 2) return digitos;
  if (digitos.length <= 6) return `${digitos.slice(0, 2)} ${digitos.slice(2)}`;
  return `${digitos.slice(0, 2)} ${digitos.slice(2, 6)} ${digitos.slice(6)}`;
}

function formatoTelefonoMask(valor: string) {
  const digitos = soloDigitos(valor);
  if (digitos.length <= 3) return digitos;
  if (digitos.length <= 6) return `(${digitos.slice(0, 3)}) ${digitos.slice(3)}`;
  return `(${digitos.slice(0, 3)}) ${digitos.slice(3, 6)}-${digitos.slice(6, 10)}`;
}

function formatoLicenciaMask(valor: string) {
  const licencia = soloAlfanumericoMayusculas(valor);
  if (licencia.length <= 4) return licencia;
  if (licencia.length <= 8) return `${licencia.slice(0, 4)} ${licencia.slice(4)}`;
  return `${licencia.slice(0, 4)} ${licencia.slice(4, 8)} ${licencia.slice(8, 12)}`;
}

function formatoFechaIsoParcial(valor: string) {
  const digitos = valor.replace(/\D/g, "").slice(0, 8);
  if (digitos.length <= 4) return digitos;
  if (digitos.length <= 6) return `${digitos.slice(0, 4)}-${digitos.slice(4)}`;
  return `${digitos.slice(0, 4)}-${digitos.slice(4, 6)}-${digitos.slice(6)}`;
}

function limpiarTexto(valor: string) {
  return valor.trim().replace(/\s+/g, " ");
}

export default function PaginaNuevoConductor() {
  const [procesando, setProcesando] = useState(false);
  const [consultandoCp, setConsultandoCp] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [exito, setExito] = useState(false);
  const [ciudades, setCiudades] = useState<string[]>([]);
  const [colonias, setColonias] = useState<string[]>([]);
  const [erroresCampos, setErroresCampos] = useState<ErroresAltaConductor>({});
  const [datos, setDatos] = useState<ConductorCrearAdmin>(FORM_INICIAL);

  function cambio<K extends keyof ConductorCrearAdmin>(campo: K, valor: ConductorCrearAdmin[K]) {
    setDatos((prev) => ({ ...prev, [campo]: valor }));
    setErroresCampos((prev) => ({ ...prev, [campo as string]: "" }));
    setError(null);
  }

  async function buscarCodigoPostal(cp: string) {
    setConsultandoCp(true);
    try {
      const resultado = await consultarCodigoPostalMx(cp, { rutaBase: "/api/codigos-postales" });
      if (!resultado) throw new Error("CP no encontrado");
      setCiudades(resultado.ciudades);
      setColonias(resultado.colonias);
      setDatos((prev) => ({
        ...prev,
        estado_residencia: resultado.estado,
        ciudad_municipio: resultado.ciudades[0] ?? "",
        colonia: resultado.colonias[0] ?? ""
      }));
    } catch {
      setCiudades([]);
      setColonias([]);
      setDatos((prev) => ({ ...prev, estado_residencia: "", ciudad_municipio: "", colonia: "" }));
      setErroresCampos((prev) => ({ ...prev, codigoPostal: "No encontramos ese código postal. Verifica que tenga 5 dígitos." }));
    } finally {
      setConsultandoCp(false);
    }
  }

  async function crear() {
    const validacion: ErroresAltaConductor = validarRegistroConductor({
      nombre: datos.nombre,
      apellidos: datos.apellidos,
      curp: datos.curp,
      telefono: datos.telefono,
      email: datos.correo,
      password: "Temporal7",
      codigoPostal: datos.codigo_postal,
      estado: datos.estado_residencia,
      ciudad: datos.ciudad_municipio,
      colonia: datos.colonia,
      calle: datos.calle,
      numero: datos.numero,
      referencias: datos.referencias ?? "",
      numeroLicencia: datos.licencia_numero,
      tipoLicencia: datos.licencia_tipo,
      vigenciaLicencia: datos.licencia_vigencia,
      contactoEmergenciaNombre: datos.contacto_emergencia_nombre,
      contactoEmergenciaTelefono: datos.contacto_emergencia_telefono
    });
    if (!datos.autoriza_verificacion_antecedentes || !datos.declara_sin_suspensiones) {
      validacion.declaraciones = "Confirma las declaraciones obligatorias del conductor.";
    }
    if (Object.keys(validacion).length > 0) {
      setErroresCampos(validacion);
      setError("Revisa los campos marcados antes de crear la cuenta.");
      return;
    }

    setProcesando(true);
    setError(null);
    try {
      const cliente = crearClienteNavegador();
      await crearConductorAdmin(cliente, {
        ...datos,
        correo: datos.correo.trim().toLowerCase(),
        nombre: limpiarTexto(datos.nombre),
        apellidos: limpiarTexto(datos.apellidos),
        telefono: telefonoE164Mx(datos.telefono),
        curp: datos.curp.toLocaleUpperCase("es-MX"),
        licencia_numero: datos.licencia_numero.toLocaleUpperCase("es-MX"),
        contacto_emergencia_telefono: telefonoE164Mx(datos.contacto_emergencia_telefono)
      });
      setExito(true);
      window.setTimeout(() => { window.location.href = "/conductores/activos"; }, 1500);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo crear el conductor.");
    } finally {
      setProcesando(false);
    }
  }

  if (exito) {
    return (
      <main className="mx-auto max-w-2xl px-6 py-8">
        <Aviso tono="info">Cuenta creada. Enviamos la contraseña temporal por correo. Redirigiendo al monitoreo...</Aviso>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-4xl px-6 py-8 sm:px-8 sm:py-10">
      <Link href="/conductores/activos" className="font-body text-sm text-text-tertiary hover:text-ink">&larr; Volver a conductores</Link>

      <h1 className="mt-6 font-display text-2xl font-semibold">Nuevo conductor</h1>
      <p className="mt-1 font-body text-sm text-text-secondary">Crea la cuenta operativa y envía una contraseña temporal al correo del conductor.</p>

      {error && <div className="mt-4"><Aviso tono="danger">{error}</Aviso></div>}

      <form onSubmit={(e) => { e.preventDefault(); void crear(); }} className="mt-6 space-y-7">
        <fieldset className="rounded-lg border border-ink/10 bg-surface-primary p-5">
          <legend className="px-1 font-display text-lg font-semibold">Cuenta</legend>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <Campo label="Correo electrónico" value={datos.correo} onChange={(v) => cambio("correo", v)} error={erroresCampos.email} type="email" autoComplete="email" required />
            <Campo label="Teléfono" value={formatoTelefonoNacional(datos.telefono)} onChange={(v) => cambio("telefono", soloDigitos(v))} error={erroresCampos.telefono} inputMode="numeric" autoComplete="tel-national" required />
          </div>
        </fieldset>

        <fieldset className="rounded-lg border border-ink/10 bg-surface-primary p-5">
          <legend className="px-1 font-display text-lg font-semibold">Identidad y domicilio</legend>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <Campo label="Nombre (s)" value={datos.nombre} onChange={(v) => cambio("nombre", v)} error={erroresCampos.nombre} autoComplete="given-name" required />
            <Campo label="Apellido (s)" value={datos.apellidos} onChange={(v) => cambio("apellidos", v)} error={erroresCampos.apellidos} autoComplete="family-name" required />
            <Campo label="CURP" value={datos.curp} onChange={(v) => cambio("curp", v.toLocaleUpperCase("es-MX").slice(0, 18))} error={erroresCampos.curp} maxLength={18} autoComplete="off" required />
            <Campo
              label="Código Postal"
              value={datos.codigo_postal}
              onChange={(v) => {
                const cp = soloDigitos(v, 5);
                cambio("codigo_postal", cp);
                if (cp.length < 5) {
                  setCiudades([]);
                  setColonias([]);
                  setDatos((prev) => ({ ...prev, estado_residencia: "", ciudad_municipio: "", colonia: "" }));
                }
                if (cp.length === 5) void buscarCodigoPostal(cp);
              }}
              ayuda={consultandoCp ? "Buscando domicilio..." : "Al capturar 5 dígitos se completa el domicilio."}
              error={erroresCampos.codigoPostal}
              inputMode="numeric"
              autoComplete="postal-code"
              required
            />
            <Campo label="Estado" value={datos.estado_residencia} onChange={(v) => cambio("estado_residencia", v)} error={erroresCampos.estado} autoComplete="address-level1" disabled={datos.codigo_postal.length < 5} required />
            {ciudades.length > 0 ? (
              <SelectCampo label="Ciudad o Municipio" value={datos.ciudad_municipio} onChange={(v) => cambio("ciudad_municipio", v)} opciones={ciudades} error={erroresCampos.ciudad} disabled={datos.codigo_postal.length < 5} required />
            ) : (
              <Campo label="Ciudad o Municipio" value={datos.ciudad_municipio} onChange={(v) => cambio("ciudad_municipio", v)} error={erroresCampos.ciudad} disabled={datos.codigo_postal.length < 5} required />
            )}
            <SelectCampo label="Colonia" value={datos.colonia} onChange={(v) => cambio("colonia", v)} opciones={colonias} error={erroresCampos.colonia} disabled={datos.codigo_postal.length < 5 || colonias.length === 0} required />
            <Campo label="Calle" value={datos.calle} onChange={(v) => cambio("calle", v)} error={erroresCampos.calle} autoComplete="address-line1" required />
            <Campo label="Número" value={datos.numero} onChange={(v) => cambio("numero", v)} error={erroresCampos.numero} required />
            <Campo label="Referencias" value={datos.referencias ?? ""} onChange={(v) => cambio("referencias", v)} error={erroresCampos.referencias} required />
          </div>
        </fieldset>

        <fieldset className="rounded-lg border border-ink/10 bg-surface-primary p-5">
          <legend className="px-1 font-display text-lg font-semibold">Licencia y contacto</legend>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <Campo label="Número de licencia" value={formatoLicenciaMask(datos.licencia_numero)} onChange={(v) => cambio("licencia_numero", soloAlfanumericoMayusculas(v))} error={erroresCampos.numeroLicencia} required />
            <SelectCampo label="Tipo de licencia" value={datos.licencia_tipo} onChange={(v) => cambio("licencia_tipo", v)} opciones={TIPOS_LICENCIA} error={erroresCampos.tipoLicencia} required />
            <Campo label="Vigencia" value={datos.licencia_vigencia} onChange={(v) => cambio("licencia_vigencia", formatoFechaIsoParcial(v))} ayuda="Formato AAAA-MM-DD." error={erroresCampos.vigenciaLicencia} inputMode="numeric" placeholder="2027-07-15" pattern="\\d{4}-\\d{2}-\\d{2}" maxLength={10} required />
            <Campo label="Contacto de emergencia (nombre)" value={datos.contacto_emergencia_nombre} onChange={(v) => cambio("contacto_emergencia_nombre", v)} error={erroresCampos.contactoEmergenciaNombre} required />
            <Campo label="Teléfono del contacto" value={formatoTelefonoMask(datos.contacto_emergencia_telefono)} onChange={(v) => cambio("contacto_emergencia_telefono", soloDigitos(v))} error={erroresCampos.contactoEmergenciaTelefono} inputMode="numeric" autoComplete="tel-national" required />
          </div>
        </fieldset>

        <fieldset className="rounded-lg border border-ink/10 bg-surface-primary p-5">
          <legend className="px-1 font-display text-lg font-semibold">Declaraciones</legend>
          <div className="mt-4 grid gap-3">
            <CheckboxCampo checked={datos.autoriza_verificacion_antecedentes} onChange={(v) => cambio("autoriza_verificacion_antecedentes", v)} label="El conductor autorizó la verificación de antecedentes y de historial de manejo." />
            <CheckboxCampo checked={datos.declara_sin_suspensiones} onChange={(v) => cambio("declara_sin_suspensiones", v)} label="El conductor declara no tener suspensiones vigentes ni procesos legales activos relacionados con manejo." />
            {erroresCampos.declaraciones && <p className="font-body text-sm font-medium text-status-error">{erroresCampos.declaraciones}</p>}
          </div>
        </fieldset>

        <div className="flex flex-wrap justify-end gap-2">
          <Link href="/conductores/activos" className="rounded-lg border border-ink/20 px-4 py-2 font-body text-sm font-medium hover:bg-ink/5">Cancelar</Link>
          <Button type="submit" disabled={procesando} className="rounded-lg bg-ink px-4 py-2 font-body text-sm font-semibold text-surface-primary hover:bg-ink/90 disabled:opacity-50">
            {procesando ? "Creando..." : "Crear cuenta y enviar contraseña temporal"}
          </Button>
        </div>
      </form>
    </main>
  );
}

function Campo({
  label,
  value,
  onChange,
  error,
  ayuda,
  type = "text",
  required,
  disabled,
  placeholder,
  maxLength,
  pattern,
  inputMode,
  autoComplete
}: {
  label: string;
  value: string;
  onChange: (valor: string) => void;
  error?: string;
  ayuda?: string;
  type?: string;
  required?: boolean;
  disabled?: boolean;
  placeholder?: string;
  maxLength?: number;
  pattern?: string;
  inputMode?: "numeric" | "text";
  autoComplete?: string;
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="font-body text-xs font-medium text-text-secondary">{label}{required ? " *" : ""}</span>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        placeholder={placeholder}
        maxLength={maxLength}
        pattern={pattern}
        inputMode={inputMode}
        autoComplete={autoComplete}
        data-ruum-label={label}
        className="rounded-lg border border-ink/20 bg-surface-primary px-3 py-2 font-body text-sm focus:border-focus-default focus:outline-none focus:ring-2 focus:ring-focus-default/20 disabled:bg-ink/5 disabled:text-text-tertiary"
      />
      {ayuda && !error && <span className="font-body text-xs text-text-tertiary">{ayuda}</span>}
      {error && <span className="font-body text-xs font-medium text-status-error">{error}</span>}
    </label>
  );
}

function SelectCampo({ label, value, onChange, opciones, error, disabled, required }: { label: string; value: string; onChange: (valor: string) => void; opciones: string[]; error?: string; disabled?: boolean; required?: boolean }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="font-body text-xs font-medium text-text-secondary">{label}{required ? " *" : ""}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        data-ruum-label={label}
        className="rounded-lg border border-ink/20 bg-surface-primary px-3 py-2 font-body text-sm focus:border-focus-default focus:outline-none focus:ring-2 focus:ring-focus-default/20 disabled:bg-ink/5 disabled:text-text-tertiary"
      >
        <option value="">{disabled ? "Completa el dato previo" : "Selecciona una opción"}</option>
        {opciones.map((opcion) => <option key={opcion} value={opcion}>{opcion}</option>)}
      </select>
      {error && <span className="font-body text-xs font-medium text-status-error">{error}</span>}
    </label>
  );
}

function CheckboxCampo({ checked, onChange, label }: { checked: boolean; onChange: (valor: boolean) => void; label: string }) {
  return (
    <label className="flex gap-3 rounded-lg border border-ink/10 bg-ink/[0.02] p-4 font-body text-sm leading-6 text-text-secondary">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="mt-1 size-4 accent-ink" />
      <span>{label}</span>
    </label>
  );
}
