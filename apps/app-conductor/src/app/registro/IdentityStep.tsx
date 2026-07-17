import { Field } from "@ruum/ui";
import { DatosSensiblesInfo } from "../cuenta/datos-sensibles";
import { formatoTelefonoNacional, soloDigitos } from "./registration-validation";
import { SelectField } from "./SelectField";

export function IdentityStep({
  nombre,
  setNombre,
  apellidos,
  setApellidos,
  curp,
  setCurp,
  codigoPostal,
  setCodigoPostal,
  estado,
  setEstado,
  ciudad,
  setCiudad,
  ciudades,
  setCiudades,
  colonia,
  setColonia,
  colonias,
  setColonias,
  calle,
  setCalle,
  numero,
  setNumero,
  referencias,
  setReferencias,
  contactoEmergenciaNombre,
  setContactoEmergenciaNombre,
  contactoEmergenciaTelefono,
  setContactoEmergenciaTelefono,
  consultandoCp,
  erroresCampos,
  limpiarErrorCampo,
  validarCampo,
  validarCurp,
  validarTelefono,
  buscarCodigoPostal
}: {
  nombre: string;
  setNombre: (valor: string) => void;
  apellidos: string;
  setApellidos: (valor: string) => void;
  curp: string;
  setCurp: (valor: string) => void;
  codigoPostal: string;
  setCodigoPostal: (valor: string) => void;
  estado: string;
  setEstado: (valor: string) => void;
  ciudad: string;
  setCiudad: (valor: string) => void;
  ciudades: string[];
  setCiudades: (valor: string[]) => void;
  colonia: string;
  setColonia: (valor: string) => void;
  colonias: string[];
  setColonias: (valor: string[]) => void;
  calle: string;
  setCalle: (valor: string) => void;
  numero: string;
  setNumero: (valor: string) => void;
  referencias: string;
  setReferencias: (valor: string) => void;
  contactoEmergenciaNombre: string;
  setContactoEmergenciaNombre: (valor: string) => void;
  contactoEmergenciaTelefono: string;
  setContactoEmergenciaTelefono: (valor: string) => void;
  consultandoCp: boolean;
  erroresCampos: Record<string, string>;
  limpiarErrorCampo: (campo: string) => void;
  validarCampo: (campo: string, valor: string) => boolean;
  validarCurp: () => boolean;
  validarTelefono: (campo: "telefono" | "contactoEmergenciaTelefono", valor: string, setter: (valor: string) => void) => boolean;
  buscarCodigoPostal: (cp: string) => void;
}) {
  return (
    <fieldset className="grid gap-4">
      <legend className="font-display text-xl font-bold text-text-primary">Identidad</legend>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field etiqueta="Nombre (s)" value={nombre} onChange={(e) => { setNombre(e.target.value); limpiarErrorCampo("nombre"); }} onBlur={() => validarCampo("nombre", nombre)} error={erroresCampos.nombre || undefined} required autoComplete="given-name" />
        <Field etiqueta="Apellido (s)" value={apellidos} onChange={(e) => { setApellidos(e.target.value); limpiarErrorCampo("apellidos"); }} onBlur={() => validarCampo("apellidos", apellidos)} error={erroresCampos.apellidos || undefined} required autoComplete="family-name" />
      </div>
      <Field etiqueta="CURP" value={curp} onChange={(e) => { setCurp(e.target.value.toUpperCase()); limpiarErrorCampo("curp"); }} onBlur={() => validarCurp()} error={erroresCampos.curp || undefined} required maxLength={18} autoComplete="off" />
      <DatosSensiblesInfo tipo="curp" compacto />
      <div className="grid gap-4 sm:grid-cols-2">
        <Field etiqueta="Código Postal" inputMode="numeric" value={codigoPostal} ayuda={consultandoCp ? "Buscando domicilio..." : "Al capturar 5 dígitos se completa el domicilio."} onChange={(e) => {
          const cp = soloDigitos(e.target.value, 5);
          setCodigoPostal(cp);
          limpiarErrorCampo("codigoPostal");
          if (cp.length < 5) {
            setEstado("");
            setCiudad("");
            setCiudades([]);
            setColonia("");
            setColonias([]);
          }
          if (cp.length === 5) buscarCodigoPostal(cp);
        }} error={erroresCampos.codigoPostal || undefined} required autoComplete="postal-code" />
        <Field etiqueta="Estado" value={estado} onChange={(e) => { setEstado(e.target.value); limpiarErrorCampo("estado"); }} error={erroresCampos.estado || undefined} required autoComplete="address-level1" readOnly={colonias.length > 0} />
      </div>
      {ciudades.length > 0 ? (
        <SelectField
          etiqueta="Ciudad o Municipio"
          value={ciudad}
          onChange={(valor) => { setCiudad(valor); limpiarErrorCampo("ciudad"); }}
          error={erroresCampos.ciudad || undefined}
          required
          placeholder="Selecciona tu ciudad o municipio"
          opciones={ciudades}
        />
      ) : (
        <Field etiqueta="Ciudad o Municipio" ayuda={colonias.length > 0 ? "Captura el municipio; este CP no lo devolvió automáticamente." : undefined} value={ciudad} onChange={(e) => { setCiudad(e.target.value); limpiarErrorCampo("ciudad"); }} error={erroresCampos.ciudad || undefined} required autoComplete="address-level2" />
      )}
      <SelectField
        etiqueta="Colonia"
        value={colonia}
        onChange={(valor) => { setColonia(valor); limpiarErrorCampo("colonia"); }}
        error={erroresCampos.colonia || undefined}
        required
        disabled={colonias.length === 0}
        placeholder={colonias.length === 0 ? "Captura primero un código postal válido" : "Selecciona tu colonia"}
        opciones={colonias}
      />
      <div className="grid gap-4 sm:grid-cols-[1fr_120px]">
        <Field etiqueta="Calle" value={calle} onChange={(e) => { setCalle(e.target.value); limpiarErrorCampo("calle"); }} error={erroresCampos.calle || undefined} required autoComplete="address-line1" />
        <Field etiqueta="Número" value={numero} onChange={(e) => { setNumero(e.target.value); limpiarErrorCampo("numero"); }} error={erroresCampos.numero || undefined} required />
      </div>
      <Field etiqueta="Referencias" value={referencias} onChange={(e) => { setReferencias(e.target.value); limpiarErrorCampo("referencias"); }} error={erroresCampos.referencias || undefined} required />
      <div className="grid gap-4 sm:grid-cols-2">
        <Field etiqueta="Contacto de emergencia (nombre)" value={contactoEmergenciaNombre} onChange={(e) => { setContactoEmergenciaNombre(e.target.value); limpiarErrorCampo("contactoEmergenciaNombre"); }} error={erroresCampos.contactoEmergenciaNombre || undefined} required />
        <Field etiqueta="Teléfono del contacto" type="tel" inputMode="numeric" value={formatoTelefonoNacional(contactoEmergenciaTelefono)} onChange={(e) => { setContactoEmergenciaTelefono(soloDigitos(e.target.value)); limpiarErrorCampo("contactoEmergenciaTelefono"); }} onBlur={() => validarTelefono("contactoEmergenciaTelefono", contactoEmergenciaTelefono, setContactoEmergenciaTelefono)} error={erroresCampos.contactoEmergenciaTelefono || undefined} required autoComplete="tel-national" />
      </div>
      <DatosSensiblesInfo tipo="contacto_emergencia" compacto />
    </fieldset>
  );
}
