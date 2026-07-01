"use client";

import { useState } from "react";
import { Aviso, Button, Field } from "@ruum/ui";
import type { Database } from "@ruum/shared/types";
import { actualizarPerfilUsuario } from "@ruum/api/services";
import { crearClienteNavegador, tieneSupabaseConfigurado } from "../../lib/supabase-browser";

type Usuario = Database["public"]["Tables"]["usuarios"]["Row"];

type DatosCodigoPostal = {
  estado: string;
  ciudad: string;
  colonia: string;
};

function soloDigitos(valor: string, maximo?: number) {
  const limpio = valor.replace(/\D/g, "");
  return maximo ? limpio.slice(0, maximo) : limpio;
}

function telefonoLocalMx(valor: string | null) {
  const limpio = soloDigitos(valor ?? "");
  const sinCodigoPais = limpio.length > 10 && limpio.startsWith("52") ? limpio.slice(2) : limpio;
  return sinCodigoPais.slice(0, 10);
}

function telefonoMx(diezDigitos: string) {
  const telefono = soloDigitos(diezDigitos, 10);
  return telefono ? `+52${telefono}` : "";
}

function domicilioCompleto({
  calle,
  numero,
  colonia,
  codigoPostal,
  ciudad,
  estado,
  referencias
}: {
  calle: string;
  numero: string;
  colonia: string;
  codigoPostal: string;
  ciudad: string;
  estado: string;
  referencias: string;
}) {
  return [
    [calle.trim(), numero.trim()].filter(Boolean).join(" "),
    colonia.trim() ? `Col. ${colonia.trim()}` : "",
    codigoPostal.trim() ? `CP ${codigoPostal.trim()}` : "",
    ciudad.trim(),
    estado.trim(),
    referencias.trim() ? `Ref. ${referencias.trim()}` : ""
  ]
    .filter(Boolean)
    .join(", ");
}

async function consultarCpCopomex(cp: string): Promise<DatosCodigoPostal | null> {
  const respuesta = await fetch(`https://api.copomex.com/query/info_cp/${cp}?token=pruebas`);
  if (!respuesta.ok) return null;

  const data = (await respuesta.json()) as {
    response?: {
      estado?: string;
      ciudad?: string;
      municipio?: string;
      asentamiento?: string;
    };
  };

  if (!data.response?.estado) return null;

  return {
    estado: data.response.estado,
    ciudad: data.response.ciudad || data.response.municipio || "",
    colonia: data.response.asentamiento || ""
  };
}

async function consultarCpZippopotam(cp: string): Promise<DatosCodigoPostal | null> {
  const respuesta = await fetch(`https://api.zippopotam.us/mx/${cp}`);
  if (!respuesta.ok) return null;

  const data = (await respuesta.json()) as {
    places?: Array<{ "place name"?: string; state?: string }>;
  };
  const lugar = data.places?.[0];
  if (!lugar?.state) return null;

  return {
    estado: lugar.state,
    ciudad: "",
    colonia: lugar["place name"] ?? ""
  };
}

export function PerfilCuentaForm({ usuario }: { usuario: Usuario }) {
  const [nombre, setNombre] = useState(usuario.nombre ?? "");
  const [fotoUrl, setFotoUrl] = useState(usuario.foto_url ?? "");
  const [telefono, setTelefono] = useState(telefonoLocalMx(usuario.telefono));
  const [pais, setPais] = useState(usuario.pais ?? "México");
  const [estado, setEstado] = useState(usuario.estado ?? "");
  const [codigoPostal, setCodigoPostal] = useState(usuario.codigo_postal ?? "");
  const [ciudad, setCiudad] = useState(usuario.ciudad ?? "");
  const [colonia, setColonia] = useState(usuario.colonia ?? "");
  const [calle, setCalle] = useState(usuario.calle ?? "");
  const [numero, setNumero] = useState(usuario.numero ?? "");
  const [referencias, setReferencias] = useState(usuario.referencias ?? "");
  const [correoFacturacion, setCorreoFacturacion] = useState(usuario.correo_facturacion ?? "");
  const [guardando, setGuardando] = useState(false);
  const [mensaje, setMensaje] = useState<{ tono: "info" | "peligro"; texto: string } | null>(null);
  const [cpConsultando, setCpConsultando] = useState(false);
  const [cpAviso, setCpAviso] = useState<string | null>(null);

  async function consultarCodigoPostal(valor: string) {
    const cp = soloDigitos(valor, 5);
    setCodigoPostal(cp);

    if (cp.length !== 5) {
      setCpAviso(null);
      return;
    }

    setCpConsultando(true);
    setCpAviso(null);

    try {
      const datosCp = (await consultarCpCopomex(cp)) ?? (await consultarCpZippopotam(cp));
      if (!datosCp) throw new Error("CP no encontrado");

      setEstado(datosCp.estado);
      setCiudad(datosCp.ciudad);
      setColonia(datosCp.colonia);
      if (!datosCp.ciudad || !datosCp.colonia) {
        setCpAviso("Captura manualmente los campos que no se prellenaron con el CP.");
      }
    } catch {
      setCpAviso("No pudimos encontrar ese CP. Captura estado, ciudad y colonia manualmente.");
    } finally {
      setCpConsultando(false);
    }
  }

  async function guardar(e: React.FormEvent) {
    e.preventDefault();
    setMensaje(null);

    if (telefono.length !== 10) {
      setMensaje({ tono: "peligro", texto: "El teléfono debe tener 10 dígitos; el prefijo +52 ya está aplicado." });
      return;
    }

    if (!nombre.trim() || codigoPostal.length !== 5 || !estado.trim() || !ciudad.trim() || !colonia.trim() || !calle.trim() || !numero.trim()) {
      setMensaje({ tono: "peligro", texto: "Completa nombre, teléfono y domicilio antes de guardar." });
      return;
    }

    if (!tieneSupabaseConfigurado()) {
      setMensaje({ tono: "peligro", texto: "Supabase no está configurado. No se pueden guardar cambios." });
      return;
    }

    setGuardando(true);
    try {
      await actualizarPerfilUsuario(crearClienteNavegador(), {
        nombre: nombre.trim(),
        foto_url: fotoUrl.trim() || null,
        telefono: telefonoMx(telefono),
        pais: pais.trim() || "México",
        estado: estado.trim(),
        codigo_postal: codigoPostal,
        ciudad: ciudad.trim(),
        colonia: colonia.trim(),
        calle: calle.trim(),
        numero: numero.trim(),
        referencias: referencias.trim() || null,
        direccion_principal: domicilioCompleto({ calle, numero, colonia, codigoPostal, ciudad, estado, referencias }),
        correo_facturacion: correoFacturacion.trim() || null
      });
      setMensaje({ tono: "info", texto: "Datos de cuenta actualizados." });
    } catch (err) {
      setMensaje({ tono: "peligro", texto: err instanceof Error ? err.message : "No pudimos guardar los cambios." });
    } finally {
      setGuardando(false);
    }
  }

  return (
    <form className="grid gap-4" onSubmit={guardar}>
      <Field etiqueta="Nombre completo" value={nombre} onChange={(e) => setNombre(e.target.value)} required />
      <Field etiqueta="Fotografía" value={fotoUrl} onChange={(e) => setFotoUrl(e.target.value)} placeholder="URL de foto" />
      <label className="flex flex-col gap-1.5">
        <span className="font-body text-sm font-medium">Teléfono</span>
        <div className="flex overflow-hidden rounded-lg border border-ink/15 bg-mist">
          <span className="flex items-center border-r border-ink/10 px-3.5 font-body text-sm font-semibold text-ink/70">+52</span>
          <input
            type="tel"
            value={telefono}
            onChange={(e) => setTelefono(telefonoLocalMx(e.target.value))}
            inputMode="numeric"
            maxLength={10}
            required
            autoComplete="tel-national"
            className="min-w-0 flex-1 bg-transparent px-3.5 py-2.5 font-body text-sm text-ink placeholder:text-ink/35 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-route"
            placeholder="10 dígitos"
          />
        </div>
      </label>
      <div className="grid gap-4 rounded-lg border border-ink/10 p-4">
        <p className="font-body text-sm font-semibold">Domicilio</p>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field etiqueta="País" value={pais} onChange={(e) => setPais(e.target.value)} required />
          <Field
            etiqueta="Código Postal"
            value={codigoPostal}
            onChange={(e) => void consultarCodigoPostal(e.target.value)}
            onBlur={(e) => consultarCodigoPostal(e.target.value)}
            inputMode="numeric"
            maxLength={5}
            required
            ayuda={cpConsultando ? "Consultando CP..." : cpAviso}
          />
          <Field etiqueta="Estado" value={estado} onChange={(e) => setEstado(e.target.value)} required />
          <Field etiqueta="Ciudad" value={ciudad} onChange={(e) => setCiudad(e.target.value)} required />
          <Field etiqueta="Colonia" value={colonia} onChange={(e) => setColonia(e.target.value)} required />
          <Field etiqueta="Calle" value={calle} onChange={(e) => setCalle(e.target.value)} required />
          <Field etiqueta="Número" value={numero} onChange={(e) => setNumero(e.target.value)} required />
          <Field etiqueta="Correo para facturación" type="email" value={correoFacturacion} onChange={(e) => setCorreoFacturacion(e.target.value)} />
        </div>
        <Field
          etiqueta="Referencias"
          value={referencias}
          onChange={(e) => setReferencias(e.target.value)}
          placeholder="Entre calles, color de fachada, acceso, piso, etc."
        />
      </div>

      {mensaje && <Aviso tono={mensaje.tono}>{mensaje.texto}</Aviso>}

      <div>
        <Button type="submit" disabled={guardando}>
          {guardando ? "Guardando..." : "Guardar cambios"}
        </Button>
      </div>
    </form>
  );
}
