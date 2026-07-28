"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { useParams } from "next/navigation";
import { Aviso } from "@ruum/ui";
import { listarEmpresasAdmin, type DatosEmpresasAdmin } from "@ruum/api/services";
import type { Database } from "@ruum/shared/types";
import { crearClienteNavegador, tieneSupabaseConfigurado } from "../../../lib/supabase-browser";
import { AdminPageHeader, AdminPanel } from "../../admin-ui";
import { AdminBadge, AdminButton, AdminEmptyState, AdminErrorState, AdminLoadingState, AdminTabs } from "../../admin-components";

type Empresa = Database["public"]["Tables"]["empresas"]["Row"];
type Usuario = Database["public"]["Tables"]["usuarios"]["Row"];
type Vehiculo = Database["public"]["Tables"]["vehiculos"]["Row"];
type Conductor = Database["public"]["Tables"]["conductores"]["Row"];
type Traslado = Database["public"]["Tables"]["traslados"]["Row"];
type Documento = Database["public"]["Tables"]["empresas_documentos"]["Row"];
type VersionFiscal = Database["public"]["Tables"]["empresas_datos_fiscales_versiones"]["Row"];
type VersionCondiciones = Database["public"]["Tables"]["empresas_condiciones_comerciales_versiones"]["Row"];
type CambioSensible = Database["public"]["Tables"]["empresas_cambios_sensibles"]["Row"];
type TabPasaporte = "control" | "flota" | "rutas" | "traslados" | "expediente";
type TonoBadge = "neutral" | "info" | "success" | "warning" | "danger";

const DATOS_VACIOS: DatosEmpresasAdmin = {
  empresas: [],
  usuarios: [],
  traslados: [],
  vehiculos: [],
  conductores: [],
  documentos: [],
  versionesFiscales: [],
  versionesCondiciones: [],
  cambiosSensibles: []
};

const TABS: Array<{ value: TabPasaporte; label: string }> = [
  { value: "control", label: "Control" },
  { value: "flota", label: "Flota y conductores" },
  { value: "rutas", label: "Origen y destino" },
  { value: "traslados", label: "Traslados" },
  { value: "expediente", label: "Expediente" }
];

const ESTADOS_TERMINALES = new Set<string>(["servicio_cerrado", "servicio_cancelado", "traslado_fallido"]);

export default function PaginaPasaporteEmpresarial() {
  const { id } = useParams<{ id: string }>();
  const [datos, setDatos] = useState<DatosEmpresasAdmin>(DATOS_VACIOS);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actualizadoEn, setActualizadoEn] = useState<Date | null>(null);
  const [tab, setTab] = useState<TabPasaporte>("control");

  const cargar = useCallback(async () => {
    if (!tieneSupabaseConfigurado()) {
      setCargando(false);
      setError("El Pasaporte Empresarial requiere conexión real a Supabase.");
      return;
    }
    setCargando(true);
    setError(null);
    try {
      const respuesta = await listarEmpresasAdmin(crearClienteNavegador());
      setDatos(respuesta);
      setActualizadoEn(new Date());
    } catch (err) {
      setError(err instanceof Error ? err.message : "No pudimos cargar el Pasaporte Empresarial.");
      setDatos(DATOS_VACIOS);
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => { void cargar(); }, [cargar]);

  const pasaporte = useMemo(() => prepararPasaporte(datos, id), [datos, id]);

  if (cargando) {
    return (
      <main className="space-y-6">
        <AdminPageHeader
          etiqueta="Pasaporte Empresarial"
          titulo="Cargando empresa"
          descripcion="Consolidando empresa, flota, conductores, rutas, traslados y expediente documental."
          breadcrumb={[{ label: "Empresas", href: "/empresas" }, { label: "Pasaporte" }]}
          estadoConexion="actualizando"
          tipoDatos="administrativos"
        />
        <AdminLoadingState label="Cargando Pasaporte Empresarial" />
      </main>
    );
  }

  if (error) {
    return (
      <main className="space-y-6">
        <AdminPageHeader
          etiqueta="Pasaporte Empresarial"
          titulo="No disponible"
          descripcion="La vista necesita datos administrativos reales para construir el control empresarial."
          breadcrumb={[{ label: "Empresas", href: "/empresas" }, { label: "Pasaporte" }]}
          estadoConexion="sin_conexion"
          tipoDatos="administrativos"
        />
        <AdminErrorState description={error} action={<AdminButton onClick={() => void cargar()}>Reintentar</AdminButton>} />
      </main>
    );
  }

  if (!pasaporte) {
    return (
      <main className="space-y-6">
        <AdminPageHeader
          etiqueta="Pasaporte Empresarial"
          titulo="Empresa no encontrada"
          descripcion="No encontramos una empresa con ese identificador en la fuente administrativa."
          breadcrumb={[{ label: "Empresas", href: "/empresas" }, { label: "Pasaporte" }]}
          estadoConexion="datos_en_vivo"
          tipoDatos="administrativos"
        />
        <AdminEmptyState title="Sin expediente" description="Regresa a Empresas para seleccionar una cuenta corporativa vigente." action={<Link href="/empresas"><AdminButton>Ver empresas</AdminButton></Link>} />
      </main>
    );
  }

  const { empresa, usuarios, vehiculos, conductores, traslados, documentos, versionesFiscales, versionesCondiciones, cambiosSensibles, origenes, destinos, alertas, trasladosActivos } = pasaporte;
  const titular = usuarios.find((usuario) => usuario.rol === "titular_empresa");
  const creditoUsado = Math.max(0, Number(empresa.limite_credito_mxn ?? 0) - Number(empresa.credito_disponible_mxn ?? 0));

  return (
    <main className="space-y-6">
      <AdminPageHeader
        etiqueta="Pasaporte Empresarial"
        titulo={empresa.nombre}
        descripcion="Expediente operativo para controlar la relación corporativa: flota, conductores, lugares, traslados, documentos y autorizaciones."
        breadcrumb={[{ label: "Empresas", href: "/empresas" }, { label: empresa.nombre }]}
        estadoConexion="datos_en_vivo"
        ultimaActualizacion={actualizadoEn}
        tipoDatos="administrativos"
        contadorResultados={traslados.length}
        accion={<AdminButton onClick={() => void cargar()} variant="secondary">Actualizar</AdminButton>}
        accionesSecundarias={<Link href="/empresas"><AdminButton variant="quiet">Volver</AdminButton></Link>}
      />

      {alertas.length > 0 && (
        <Aviso tono="atencion">
          {alertas.slice(0, 3).join(" ")}{alertas.length > 3 ? ` ${alertas.length - 3} alerta(s) adicional(es).` : ""}
        </Aviso>
      )}

      <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <Kpi etiqueta="Traslados activos" valor={trasladosActivos.length} detalle={`${traslados.filter((t) => t.tiene_incidencia_abierta).length} con incidencia abierta`} tono={trasladosActivos.length > 0 ? "info" : "neutral"} />
        <Kpi etiqueta="Flota vinculada" valor={vehiculos.length} detalle={`${vehiculos.filter((v) => v.puede_circular_rodando).length} pueden circular rodando`} tono={vehiculos.length ? "success" : "warning"} />
        <Kpi etiqueta="Conductores" valor={conductores.length} detalle={`${conductores.filter((c) => c.documentos_vigentes).length} con documentos vigentes`} tono={conductores.length ? "success" : "warning"} />
        <Kpi etiqueta="Crédito usado" valor={moneda(creditoUsado)} detalle={`Disponible ${moneda(empresa.credito_disponible_mxn)}`} tono={creditoUsado > 0 ? "info" : "neutral"} />
      </section>

      <AdminPanel>
        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_360px]">
          <section>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="font-display text-xl font-semibold text-ink">Identidad corporativa</h2>
                <p className="mt-1 font-body text-sm text-text-secondary">{empresa.razon_social ?? "Razón social pendiente"}</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <AdminBadge tone={tonoEstadoEmpresa(empresa.estado_operativo)}>{etiqueta(empresa.estado_operativo)}</AdminBadge>
                <AdminBadge tone={tonoVerificacion(empresa.estado_verificacion)}>{etiqueta(empresa.estado_verificacion)}</AdminBadge>
              </div>
            </div>
            <dl className="mt-5 grid gap-x-6 gap-y-4 sm:grid-cols-2 xl:grid-cols-3">
              <Dato etiqueta="RFC" valor={empresa.rfc} mono />
              <Dato etiqueta="Regimen fiscal" valor={empresa.regimen_fiscal} />
              <Dato etiqueta="CP fiscal" valor={empresa.codigo_postal_fiscal} mono />
              <Dato etiqueta="Uso CFDI" valor={empresa.uso_cfdi} />
              <Dato etiqueta="Correo facturacion" valor={empresa.correo_facturacion} />
              <Dato etiqueta="Condiciones de pago" valor={empresa.condiciones_pago} />
              <Dato etiqueta="Dias de credito" valor={`${empresa.dias_credito ?? 0}`} mono />
              <Dato etiqueta="Orden de compra" valor={empresa.requiere_orden_compra ? "Requerida" : "No requerida"} />
              <Dato etiqueta="Titular" valor={titular?.nombre ?? "Sin titular"} />
            </dl>
          </section>
          <section className="border-t border-border-default pt-5 lg:border-l lg:border-t-0 lg:pl-5 lg:pt-0">
            <h3 className="font-display text-lg font-semibold text-ink">Semaforo de control</h3>
            <ul className="mt-4 space-y-3">
              {resumenControl(pasaporte).map((item) => (
                <li key={item.etiqueta} className="flex items-start justify-between gap-3 border-b border-ink/10 pb-3 last:border-b-0">
                  <span className="font-body text-sm font-medium text-ink">{item.etiqueta}</span>
                  <AdminBadge tone={item.tono}>{item.valor}</AdminBadge>
                </li>
              ))}
            </ul>
          </section>
        </div>
      </AdminPanel>

      <AdminPanel>
        <AdminTabs items={TABS} value={tab} onValueChange={setTab} label="Secciones del Pasaporte Empresarial" />
        <div className="pt-5">
          {tab === "control" && <VistaControl empresa={empresa} usuarios={usuarios} alertas={alertas} cambios={cambiosSensibles} versionesCondiciones={versionesCondiciones} />}
          {tab === "flota" && <VistaFlota vehiculos={vehiculos} conductores={conductores} />}
          {tab === "rutas" && <VistaRutas origenes={origenes} destinos={destinos} />}
          {tab === "traslados" && <VistaTraslados traslados={traslados} />}
          {tab === "expediente" && <VistaExpediente documentos={documentos} versionesFiscales={versionesFiscales} versionesCondiciones={versionesCondiciones} cambios={cambiosSensibles} />}
        </div>
      </AdminPanel>
    </main>
  );
}

function prepararPasaporte(datos: DatosEmpresasAdmin, empresaId: string) {
  const empresa = datos.empresas.find((item) => item.id === empresaId);
  if (!empresa) return null;
  const usuarios = datos.usuarios.filter((usuario) => usuario.empresa_id === empresa.id);
  const vehiculos = datos.vehiculos.filter((vehiculo) => vehiculo.empresa_id === empresa.id);
  const conductores = datos.conductores.filter((conductor) => conductor.empresa_id === empresa.id);
  const documentos = datos.documentos.filter((documento) => documento.empresa_id === empresa.id);
  const versionesFiscales = datos.versionesFiscales.filter((version) => version.empresa_id === empresa.id);
  const versionesCondiciones = datos.versionesCondiciones.filter((version) => version.empresa_id === empresa.id);
  const cambiosSensibles = datos.cambiosSensibles.filter((cambio) => cambio.empresa_id === empresa.id);
  const usuarioIds = new Set(usuarios.map((usuario) => usuario.id));
  const vehiculoIds = new Set(vehiculos.map((vehiculo) => vehiculo.id));
  const conductorIds = new Set(conductores.map((conductor) => conductor.id));
  const traslados = datos.traslados
    .filter((traslado) => usuarioIds.has(traslado.usuario_id) || vehiculoIds.has(traslado.vehiculo_id) || Boolean(traslado.conductor_id && conductorIds.has(traslado.conductor_id)))
    .sort((a, b) => Date.parse(b.creado_en) - Date.parse(a.creado_en));
  const trasladosActivos = traslados.filter((traslado) => !ESTADOS_TERMINALES.has(traslado.estado));
  const alertas = construirAlertas(empresa, usuarios, vehiculos, conductores, traslados, documentos, cambiosSensibles);
  return {
    empresa,
    usuarios,
    vehiculos,
    conductores,
    documentos,
    versionesFiscales,
    versionesCondiciones,
    cambiosSensibles,
    traslados,
    trasladosActivos,
    origenes: agruparLugares(traslados, "origen"),
    destinos: agruparLugares(traslados, "destino"),
    alertas
  };
}

function construirAlertas(empresa: Empresa, usuarios: Usuario[], vehiculos: Vehiculo[], conductores: Conductor[], traslados: Traslado[], documentos: Documento[], cambios: CambioSensible[]) {
  const alertas: string[] = [];
  if (empresa.estado_operativo === "suspendida") alertas.push("Empresa suspendida: revisar motivo y autorizacion antes de operar nuevos traslados.");
  if (!empresa.rfc) alertas.push("RFC pendiente: el expediente fiscal no esta completo.");
  if (usuarios.length === 0) alertas.push("No hay usuarios corporativos vinculados.");
  if (vehiculos.length === 0) alertas.push("No hay vehiculos corporativos vinculados.");
  if (conductores.length === 0) alertas.push("No hay conductores corporativos vinculados.");
  if (documentos.length === 0) alertas.push("No hay documentos empresariales cargados.");
  if (Number(empresa.credito_disponible_mxn ?? 0) <= 0 && Number(empresa.limite_credito_mxn ?? 0) > 0) alertas.push("Credito disponible agotado.");
  if (traslados.some((traslado) => traslado.tiene_incidencia_abierta)) alertas.push("Existen traslados con incidencia abierta.");
  if (cambios.some((cambio) => cambio.estado === "pendiente")) alertas.push("Hay cambios sensibles pendientes de autorizacion.");
  return alertas;
}

function agruparLugares(traslados: Traslado[], tipo: "origen" | "destino") {
  const mapa = new Map<string, {
    ciudad: string;
    direccion: string;
    referencias: string | null;
    contacto: string;
    telefono: string;
    lat: number | null;
    lng: number | null;
    total: number;
    ultimo: string;
  }>();
  for (const traslado of traslados) {
    const ciudad = tipo === "origen" ? traslado.origen_ciudad : traslado.destino_ciudad;
    const direccion = tipo === "origen" ? traslado.origen_direccion : traslado.destino_direccion;
    const referencias = tipo === "origen" ? traslado.origen_referencias : traslado.destino_referencias;
    const contacto = tipo === "origen" ? traslado.contacto_entrega_nombre : traslado.contacto_recepcion_nombre;
    const telefono = tipo === "origen" ? traslado.contacto_entrega_telefono : traslado.contacto_recepcion_telefono;
    const lat = tipo === "origen" ? traslado.origen_lat : traslado.destino_lat;
    const lng = tipo === "origen" ? traslado.origen_lng : traslado.destino_lng;
    const key = `${normalizar(ciudad)}|${normalizar(direccion)}|${normalizar(referencias ?? "")}`;
    const previo = mapa.get(key);
    if (previo) {
      previo.total += 1;
      if (Date.parse(traslado.creado_en) > Date.parse(previo.ultimo)) previo.ultimo = traslado.creado_en;
    } else {
      mapa.set(key, { ciudad, direccion, referencias, contacto, telefono, lat, lng, total: 1, ultimo: traslado.creado_en });
    }
  }
  return Array.from(mapa.values()).sort((a, b) => b.total - a.total || Date.parse(b.ultimo) - Date.parse(a.ultimo));
}

function VistaControl({ empresa, usuarios, alertas, cambios, versionesCondiciones }: {
  empresa: Empresa;
  usuarios: Usuario[];
  alertas: string[];
  cambios: CambioSensible[];
  versionesCondiciones: VersionCondiciones[];
}) {
  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_380px]">
      <section>
        <h2 className="font-display text-lg font-semibold text-ink">Autorizacion corporativa</h2>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[720px] font-body text-sm">
            <thead>
              <tr className="border-b border-ink/10 text-left text-xs uppercase tracking-wide text-text-tertiary">
                <th className="py-3 pr-4">Usuario</th>
                <th className="px-4 py-3">Rol</th>
                <th className="px-4 py-3">Verificacion</th>
                <th className="px-4 py-3">Metodo pago</th>
                <th className="py-3 pl-4">Contacto</th>
              </tr>
            </thead>
            <tbody>
              {usuarios.map((usuario) => (
                <tr key={usuario.id} className="border-b border-ink/5">
                  <td className="py-3 pr-4 font-medium text-ink">{usuario.nombre}</td>
                  <td className="px-4 py-3">{etiqueta(usuario.rol)}</td>
                  <td className="px-4 py-3"><AdminBadge tone={tonoVerificacion(usuario.estado_verificacion)}>{etiqueta(usuario.estado_verificacion)}</AdminBadge></td>
                  <td className="px-4 py-3">{usuario.metodo_pago_registrado ? "Registrado" : "Pendiente"}</td>
                  <td className="py-3 pl-4 text-text-secondary">{usuario.correo_facturacion ?? usuario.telefono ?? "Sin contacto"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
      <section className="border-t border-border-default pt-5 lg:border-l lg:border-t-0 lg:pl-5 lg:pt-0">
        <h2 className="font-display text-lg font-semibold text-ink">Riesgos y pendientes</h2>
        {alertas.length === 0 ? (
          <p className="mt-3 font-body text-sm text-text-secondary">Sin alertas operativas con los datos actuales.</p>
        ) : (
          <ul className="mt-3 space-y-2">
            {alertas.map((alerta) => <li key={alerta} className="rounded-lg border border-status-warning/30 bg-status-warning-soft px-3 py-2 font-body text-sm text-status-warning">{alerta}</li>)}
          </ul>
        )}
        <dl className="mt-5 grid gap-3">
          <Dato etiqueta="Limite de credito" valor={moneda(empresa.limite_credito_mxn)} mono />
          <Dato etiqueta="Credito disponible" valor={moneda(empresa.credito_disponible_mxn)} mono />
          <Dato etiqueta="Version comercial vigente" valor={versionesCondiciones[0]?.version ? `v${versionesCondiciones[0].version}` : "Sin version"} />
          <Dato etiqueta="Cambios pendientes" valor={`${cambios.filter((cambio) => cambio.estado === "pendiente").length}`} mono />
        </dl>
      </section>
    </div>
  );
}

function VistaFlota({ vehiculos, conductores }: { vehiculos: Vehiculo[]; conductores: Conductor[] }) {
  const conductorPorId = new Map(conductores.map((conductor) => [conductor.id, conductor]));
  return (
    <div className="grid gap-6 xl:grid-cols-2">
      <section>
        <h2 className="font-display text-lg font-semibold text-ink">Vehiculos</h2>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[760px] font-body text-sm">
            <thead>
              <tr className="border-b border-ink/10 text-left text-xs uppercase tracking-wide text-text-tertiary">
                <th className="py-3 pr-4">Unidad</th>
                <th className="px-4 py-3">Placas / VIN</th>
                <th className="px-4 py-3">Condicion</th>
                <th className="px-4 py-3">Documentos</th>
                <th className="py-3 pl-4">Conductor</th>
              </tr>
            </thead>
            <tbody>
              {vehiculos.map((vehiculo) => {
                const conductor = vehiculo.conductor_id ? conductorPorId.get(vehiculo.conductor_id) : null;
                return (
                  <tr key={vehiculo.id} className="border-b border-ink/5 align-top">
                    <td className="py-3 pr-4">
                      <p className="font-medium text-ink">{vehiculo.marca} {vehiculo.modelo} {vehiculo.anio}</p>
                      <p className="text-xs text-text-secondary">{etiqueta(vehiculo.tipo)} · {vehiculo.gama ? etiqueta(vehiculo.gama) : "Sin gama"}</p>
                    </td>
                    <td className="px-4 py-3 font-mono-ruum text-xs">{vehiculo.placas ?? "Sin placas"}<br />{vehiculo.vin ?? "Sin VIN"}</td>
                    <td className="px-4 py-3">{vehiculo.condicion ? etiqueta(vehiculo.condicion) : vehiculo.estado_general_declarado ?? "Sin declaracion"}</td>
                    <td className="px-4 py-3">
                      <Checklist items={[["Placas", vehiculo.tiene_placas], ["Tarjeta", vehiculo.tiene_tarjeta_circulacion], ["Verificacion", vehiculo.tiene_verificacion]]} />
                    </td>
                    <td className="py-3 pl-4">
                      {conductor ? <Link href={`/conductores/activos/${conductor.id}`} className="font-semibold text-focus-default hover:underline">{conductor.nombre}</Link> : "Sin asignar"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
      <section>
        <h2 className="font-display text-lg font-semibold text-ink">Conductores</h2>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[700px] font-body text-sm">
            <thead>
              <tr className="border-b border-ink/10 text-left text-xs uppercase tracking-wide text-text-tertiary">
                <th className="py-3 pr-4">Conductor</th>
                <th className="px-4 py-3">Estado</th>
                <th className="px-4 py-3">Licencia</th>
                <th className="py-3 pl-4">Indicadores</th>
              </tr>
            </thead>
            <tbody>
              {conductores.map((conductor) => (
                <tr key={conductor.id} className="border-b border-ink/5 align-top">
                  <td className="py-3 pr-4">
                    <Link href={`/conductores/activos/${conductor.id}`} className="font-semibold text-focus-default hover:underline">{conductor.nombre}</Link>
                    <p className="mt-1 text-xs text-text-secondary">{conductor.telefono ?? "Sin telefono"}</p>
                  </td>
                  <td className="px-4 py-3">
                    <AdminBadge tone={conductor.estado === "activo" ? "success" : "warning"}>{etiqueta(conductor.estado)}</AdminBadge>
                    <p className="mt-1 text-xs text-text-secondary">{etiqueta(conductor.estado_expediente)}</p>
                  </td>
                  <td className="px-4 py-3">
                    <p>{conductor.licencia_tipo ?? "Sin tipo"}</p>
                    <p className="text-xs text-text-secondary">{conductor.licencia_vigencia ? fecha(conductor.licencia_vigencia) : "Sin vigencia"}</p>
                  </td>
                  <td className="py-3 pl-4">
                    <Checklist items={[["Docs", conductor.documentos_vigentes], ["Antecedentes", conductor.autoriza_verificacion_antecedentes], ["Sin susp.", conductor.declara_sin_suspensiones]]} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function VistaRutas({ origenes, destinos }: { origenes: ReturnType<typeof agruparLugares>; destinos: ReturnType<typeof agruparLugares> }) {
  return (
    <div className="grid gap-6 xl:grid-cols-2">
      <TablaLugares titulo="Origenes frecuentes" lugares={origenes} />
      <TablaLugares titulo="Destinos frecuentes" lugares={destinos} />
    </div>
  );
}

function VistaTraslados({ traslados }: { traslados: Traslado[] }) {
  return (
    <section>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-display text-lg font-semibold text-ink">Historial operativo</h2>
        <span className="font-body text-sm text-text-secondary">{traslados.length.toLocaleString("es-MX")} traslados vinculados</span>
      </div>
      <div className="mt-4 overflow-x-auto">
        <table className="w-full min-w-[960px] font-body text-sm">
          <thead>
            <tr className="border-b border-ink/10 text-left text-xs uppercase tracking-wide text-text-tertiary">
              <th className="py-3 pr-4">Traslado</th>
              <th className="px-4 py-3">Ruta</th>
              <th className="px-4 py-3">Estado</th>
              <th className="px-4 py-3">Programado</th>
              <th className="px-4 py-3 text-right">Monto</th>
              <th className="py-3 pl-4">Incidencia</th>
            </tr>
          </thead>
          <tbody>
            {traslados.slice(0, 60).map((traslado) => (
              <tr key={traslado.id} className="border-b border-ink/5 align-top">
                <td className="py-3 pr-4">
                  <Link href={`/viajes/${traslado.id}`} className="font-mono-ruum text-xs font-semibold text-focus-default hover:underline">{traslado.id.slice(0, 8).toUpperCase()}</Link>
                  <p className="mt-1 text-xs text-text-secondary">{fecha(traslado.creado_en)}</p>
                </td>
                <td className="px-4 py-3">
                  <p className="font-medium text-ink">{traslado.origen_ciudad} {"->"} {traslado.destino_ciudad}</p>
                  <p className="mt-1 text-xs text-text-secondary">{traslado.origen_direccion} / {traslado.destino_direccion}</p>
                </td>
                <td className="px-4 py-3"><AdminBadge tone={ESTADOS_TERMINALES.has(traslado.estado) ? "neutral" : "info"}>{etiqueta(traslado.estado)}</AdminBadge></td>
                <td className="px-4 py-3">{traslado.fecha_hora_programada ? fecha(traslado.fecha_hora_programada) : "Sin programar"}</td>
                <td className="px-4 py-3 text-right font-mono-ruum">{moneda(traslado.precio_final ?? traslado.precio_cotizado ?? traslado.presupuesto_usuario)}</td>
                <td className="py-3 pl-4">{traslado.tiene_incidencia_abierta ? <AdminBadge tone="danger">Abierta</AdminBadge> : <AdminBadge>Sin incidencia</AdminBadge>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function VistaExpediente({ documentos, versionesFiscales, versionesCondiciones, cambios }: {
  documentos: Documento[];
  versionesFiscales: VersionFiscal[];
  versionesCondiciones: VersionCondiciones[];
  cambios: CambioSensible[];
}) {
  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_420px]">
      <section>
        <h2 className="font-display text-lg font-semibold text-ink">Documentos empresariales</h2>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[760px] font-body text-sm">
            <thead>
              <tr className="border-b border-ink/10 text-left text-xs uppercase tracking-wide text-text-tertiary">
                <th className="py-3 pr-4">Documento</th>
                <th className="px-4 py-3">Estado</th>
                <th className="px-4 py-3">Vigencia</th>
                <th className="py-3 pl-4">Evidencia</th>
              </tr>
            </thead>
            <tbody>
              {documentos.map((documento) => (
                <tr key={documento.id} className="border-b border-ink/5">
                  <td className="py-3 pr-4">
                    <p className="font-medium text-ink">{documento.nombre}</p>
                    <p className="text-xs text-text-secondary">{etiqueta(documento.tipo)} · {documento.folio ?? "Sin folio"}</p>
                  </td>
                  <td className="px-4 py-3"><AdminBadge tone={tonoDocumento(documento.estado)}>{etiqueta(documento.estado)}</AdminBadge></td>
                  <td className="px-4 py-3">{periodo(documento.vigente_desde, documento.vigente_hasta)}</td>
                  <td className="py-3 pl-4">{documento.url ? <a href={documento.url} target="_blank" rel="noreferrer" className="font-semibold text-focus-default hover:underline">Abrir archivo</a> : "Sin archivo"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
      <section className="space-y-6">
        <ListaVersiones titulo="Datos fiscales" versiones={versionesFiscales.map((version) => ({ id: version.id, version: version.version, vigenteHasta: version.vigente_hasta, fecha: version.creado_en, detalle: version.rfc ?? version.razon_social ?? "Sin RFC" }))} />
        <ListaVersiones titulo="Condiciones comerciales" versiones={versionesCondiciones.map((version) => ({ id: version.id, version: version.version, vigenteHasta: version.vigente_hasta, fecha: version.creado_en, detalle: `${moneda(version.limite_credito_mxn)} · ${version.dias_credito ?? 0} dias` }))} />
        <section>
          <h3 className="font-display text-base font-semibold text-ink">Cambios sensibles</h3>
          <ul className="mt-3 space-y-2">
            {cambios.slice(0, 8).map((cambio) => (
              <li key={cambio.id} className="border-b border-ink/10 pb-2 last:border-b-0">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-body text-sm font-medium text-ink">{etiqueta(cambio.tipo)}</span>
                  <AdminBadge tone={cambio.estado === "pendiente" ? "warning" : "neutral"}>{etiqueta(cambio.estado)}</AdminBadge>
                </div>
                <p className="mt-1 font-body text-xs text-text-secondary">{fecha(cambio.solicitado_en)} · {cambio.motivo ?? "Sin motivo"}</p>
              </li>
            ))}
            {cambios.length === 0 && <li className="font-body text-sm text-text-secondary">Sin cambios sensibles registrados.</li>}
          </ul>
        </section>
      </section>
    </div>
  );
}

function TablaLugares({ titulo, lugares }: { titulo: string; lugares: ReturnType<typeof agruparLugares> }) {
  return (
    <section>
      <h2 className="font-display text-lg font-semibold text-ink">{titulo}</h2>
      <div className="mt-4 overflow-x-auto">
        <table className="w-full min-w-[720px] font-body text-sm">
          <thead>
            <tr className="border-b border-ink/10 text-left text-xs uppercase tracking-wide text-text-tertiary">
              <th className="py-3 pr-4">Lugar</th>
              <th className="px-4 py-3">Contacto</th>
              <th className="px-4 py-3 text-right">Traslados</th>
              <th className="px-4 py-3">Ultimo</th>
              <th className="py-3 pl-4">Coordenadas</th>
            </tr>
          </thead>
          <tbody>
            {lugares.map((lugar) => (
              <tr key={`${lugar.ciudad}-${lugar.direccion}-${lugar.referencias ?? ""}`} className="border-b border-ink/5 align-top">
                <td className="py-3 pr-4">
                  <p className="font-medium text-ink">{lugar.ciudad}</p>
                  <p className="mt-1 text-xs text-text-secondary">{lugar.direccion}</p>
                  {lugar.referencias && <p className="mt-1 text-xs text-text-tertiary">{lugar.referencias}</p>}
                </td>
                <td className="px-4 py-3">{lugar.contacto}<br /><span className="text-xs text-text-secondary">{lugar.telefono}</span></td>
                <td className="px-4 py-3 text-right font-mono-ruum">{lugar.total}</td>
                <td className="px-4 py-3">{fecha(lugar.ultimo)}</td>
                <td className="py-3 pl-4 font-mono-ruum text-xs">{lugar.lat !== null && lugar.lng !== null ? `${lugar.lat.toFixed(5)}, ${lugar.lng.toFixed(5)}` : "Sin coordenadas"}</td>
              </tr>
            ))}
            {lugares.length === 0 && (
              <tr><td colSpan={5} className="py-6 text-center text-text-secondary">Sin lugares registrados en traslados de esta empresa.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function Kpi({ etiqueta, valor, detalle, tono }: { etiqueta: string; valor: ReactNode; detalle: string; tono: TonoBadge }) {
  return (
    <section className="rounded-lg border border-border-default bg-surface-primary p-4">
      <div className="flex items-start justify-between gap-3">
        <p className="font-body text-sm font-medium text-text-secondary">{etiqueta}</p>
        <AdminBadge tone={tono}>Hoy</AdminBadge>
      </div>
      <p className="mt-3 font-display text-2xl font-semibold text-ink">{valor}</p>
      <p className="mt-1 font-body text-xs text-text-tertiary">{detalle}</p>
    </section>
  );
}

function Dato({ etiqueta, valor, mono = false }: { etiqueta: string; valor?: ReactNode | null; mono?: boolean }) {
  return (
    <div>
      <dt className="font-body text-xs font-semibold uppercase tracking-wide text-text-tertiary">{etiqueta}</dt>
      <dd className={`mt-1 text-sm text-ink ${mono ? "font-mono-ruum" : "font-body"}`}>{valor ?? "Pendiente"}</dd>
    </div>
  );
}

function Checklist({ items }: { items: Array<[string, boolean]> }) {
  return (
    <ul className="flex flex-wrap gap-1.5">
      {items.map(([label, ok]) => (
        <li key={label}><AdminBadge tone={ok ? "success" : "warning"}>{label}</AdminBadge></li>
      ))}
    </ul>
  );
}

function ListaVersiones({ titulo, versiones }: { titulo: string; versiones: Array<{ id: string; version: number; vigenteHasta: string | null; fecha: string; detalle: string }> }) {
  return (
    <section>
      <h3 className="font-display text-base font-semibold text-ink">{titulo}</h3>
      <ul className="mt-3 space-y-2">
        {versiones.slice(0, 5).map((version) => (
          <li key={version.id} className="border-b border-ink/10 pb-2 last:border-b-0">
            <div className="flex items-center justify-between gap-2">
              <span className="font-body text-sm font-medium text-ink">Version {version.version}</span>
              <AdminBadge tone={version.vigenteHasta ? "neutral" : "success"}>{version.vigenteHasta ? "Historica" : "Vigente"}</AdminBadge>
            </div>
            <p className="mt-1 font-body text-xs text-text-secondary">{version.detalle} · {fecha(version.fecha)}</p>
          </li>
        ))}
        {versiones.length === 0 && <li className="font-body text-sm text-text-secondary">Sin versiones registradas.</li>}
      </ul>
    </section>
  );
}

function resumenControl(pasaporte: NonNullable<ReturnType<typeof prepararPasaporte>>) {
  return [
    { etiqueta: "Usuarios autorizados", valor: `${pasaporte.usuarios.length}`, tono: pasaporte.usuarios.length > 0 ? "success" : "warning" },
    { etiqueta: "Documentos empresariales", valor: `${pasaporte.documentos.length}`, tono: pasaporte.documentos.length > 0 ? "success" : "warning" },
    { etiqueta: "Cambios pendientes", valor: `${pasaporte.cambiosSensibles.filter((cambio) => cambio.estado === "pendiente").length}`, tono: pasaporte.cambiosSensibles.some((cambio) => cambio.estado === "pendiente") ? "warning" : "success" },
    { etiqueta: "Incidencias abiertas", valor: `${pasaporte.traslados.filter((traslado) => traslado.tiene_incidencia_abierta).length}`, tono: pasaporte.traslados.some((traslado) => traslado.tiene_incidencia_abierta) ? "danger" : "success" }
  ] satisfies Array<{ etiqueta: string; valor: string; tono: TonoBadge }>;
}

function normalizar(valor: string) {
  return valor.trim().toUpperCase().replace(/\s+/g, " ");
}

function etiqueta(valor?: string | null) {
  if (!valor) return "Pendiente";
  return valor.replace(/_/g, " ").replace(/\b\w/g, (letra) => letra.toUpperCase());
}

function moneda(valor?: number | null) {
  return new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN", maximumFractionDigits: 0 }).format(Number(valor ?? 0));
}

function fecha(valor?: string | null) {
  if (!valor) return "Sin fecha";
  const fechaDato = new Date(valor);
  if (Number.isNaN(fechaDato.getTime())) return "Sin fecha valida";
  return new Intl.DateTimeFormat("es-MX", { dateStyle: "medium", timeStyle: "short" }).format(fechaDato);
}

function periodo(inicio?: string | null, fin?: string | null) {
  if (!inicio && !fin) return "Sin vigencia";
  return `${inicio ? fecha(inicio) : "Sin inicio"} - ${fin ? fecha(fin) : "Sin fin"}`;
}

function tonoVerificacion(estado?: string | null): TonoBadge {
  if (estado === "verificado" || estado === "aprobado") return "success";
  if (estado === "rechazado" || estado === "suspendido") return "danger";
  if (estado === "en_revision" || estado === "pendiente") return "warning";
  return "neutral";
}

function tonoEstadoEmpresa(estado?: string | null): TonoBadge {
  if (estado === "activa") return "success";
  if (estado === "suspendida") return "danger";
  if (estado === "en_revision" || estado === "pendiente") return "warning";
  return "neutral";
}

function tonoDocumento(estado?: string | null): TonoBadge {
  if (estado === "validado" || estado === "aprobado" || estado === "vigente") return "success";
  if (estado === "rechazado" || estado === "vencido") return "danger";
  if (estado === "pendiente" || estado === "en_revision") return "warning";
  return "neutral";
}
