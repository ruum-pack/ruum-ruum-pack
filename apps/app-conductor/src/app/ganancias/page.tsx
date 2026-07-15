"use client";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Aviso, Button, EstatusBadgeEconomico, Field, PassportCard } from "@ruum/ui";
import { TEXTOS_CARGANDO, type EstatusEconomico } from "@ruum/shared/constants";
import type { Database } from "@ruum/shared/types";
import { crearClienteNavegador, tieneSupabaseConfigurado } from "../../lib/supabase-browser";
import { guardarDatosBancariosConductor, obtenerConductorActual, obtenerGananciasConductor } from "@ruum/api/services";

type DatosBancariosConductor = Database["public"]["Tables"]["datos_bancarios_conductor"]["Row"];
type Payout = Database["public"]["Tables"]["payouts_conductor"]["Row"];

interface RegistroGanancia {
  fecha: string;
  ruta: string;
  monto: number;
  gastos: number;
  estatus: EstatusEconomico;
  liberacion: string;
}

const ETIQUETA_DATOS_BANCARIOS: Record<Database["public"]["Enums"]["estado_datos_bancarios_conductor"], string> = {
  en_revision: "Datos en revisión",
  verificada: "Datos verificados",
  rechazada: "Datos rechazados"
};

const FECHA_PAGO_INICIAL = "Pendiente";

function moneda(valor: number) {
  return `$${valor.toLocaleString("es-MX")}`;
}

function fecha(fechaIso: string) {
  if (!fechaIso.includes("-")) return fechaIso;
  return new Intl.DateTimeFormat("es-MX", {
    dateStyle: "medium",
    timeZone: "America/Mexico_City"
  }).format(new Date(`${fechaIso}T12:00:00-06:00`));
}

export default function PaginaGanancias() {
  const [datosBancarios, setDatosBancarios] = useState<DatosBancariosConductor | null>(null);
  const [formularioBanco, setFormularioBanco] = useState({
    titularCuenta: "",
    banco: "",
    clabe: "",
    numeroTarjeta: ""
  });
  const [registros, setRegistros] = useState<RegistroGanancia[]>([]);
  const [resumenSemanal, setResumenSemanal] = useState({
    ganancias_generadas: 0,
    gastos_autorizados: 0,
    ajustes: 0,
    deposito_final: 0,
    fecha_pago: FECHA_PAGO_INICIAL,
    metodo: "Sin payout programado"
  });
  const [guardandoBanco, setGuardandoBanco] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [avisoBanco, setAvisoBanco] = useState<string | null>(null);

  useEffect(() => {
    async function cargar() {
      if (!tieneSupabaseConfigurado()) {
        setError("Supabase no está configurado. No se pueden consultar ganancias reales.");
        return;
      }
      try {
        const cliente = crearClienteNavegador();
        const conductor = await obtenerConductorActual(cliente);
        if (!conductor) {
          return;
        }

        const datos = await obtenerGananciasConductor(cliente, conductor.id);
        setDatosBancarios(datos.datosBancarios);
        if (datos.datosBancarios) {
          setFormularioBanco({
            titularCuenta: datos.datosBancarios.titular_cuenta,
            banco: datos.datosBancarios.banco,
            clabe: datos.datosBancarios.clabe,
            numeroTarjeta: datos.datosBancarios.numero_tarjeta
          });
        }

        const reales = datos.payouts.map((payout: Payout) => ({
          fecha: payout.periodo_fin,
          ruta: `Periodo ${payout.periodo_inicio} -> ${payout.periodo_fin}`,
          monto: Number(payout.monto_bruto ?? 0),
          gastos: Math.max(0, Number(payout.monto_neto ?? 0) - Number(payout.monto_bruto ?? 0)),
          estatus: payout.estado === "procesado" ? "pagado" : payout.estado === "pendiente" ? "pendiente" : "revocado",
          liberacion: payout.procesado_en ? payout.procesado_en.slice(0, 10) : "Pendiente"
        })) as RegistroGanancia[];

        setRegistros(reales);
        const actual = datos.payouts[0];
        setResumenSemanal(
          actual
            ? {
                ganancias_generadas: Number(actual.monto_bruto ?? 0),
                gastos_autorizados: Math.max(0, Number(actual.monto_neto ?? 0) - Number(actual.monto_bruto ?? 0)),
                ajustes: Number(actual.ajustes ?? 0),
                deposito_final: Number(actual.monto_neto ?? 0),
                fecha_pago: actual.procesado_en ? actual.procesado_en.slice(0, 10) : actual.periodo_fin,
                metodo: actual.referencia_pago ? "Transferencia bancaria" : "Transferencia pendiente"
              }
            : {
                ganancias_generadas: 0,
                gastos_autorizados: 0,
                ajustes: 0,
                deposito_final: 0,
                fecha_pago: FECHA_PAGO_INICIAL,
                metodo: "Sin payout programado"
              }
        );
      } catch (err) {
        setError(err instanceof Error ? err.message : "No pudimos cargar tus ganancias.");
      }
    }
    cargar();
  }, []);

  function actualizarCampoBanco(campo: keyof typeof formularioBanco, valor: string) {
    setFormularioBanco((actual) => ({
      ...actual,
      [campo]: campo === "clabe" || campo === "numeroTarjeta" ? valor.replace(/\D/g, "") : valor
    }));
  }

  async function guardarBanco() {
    setGuardandoBanco(true);
    setError(null);
    setAvisoBanco(null);
    try {
      const cliente = crearClienteNavegador();
      const guardado = await guardarDatosBancariosConductor(cliente, formularioBanco);
      setDatosBancarios(guardado);
      setFormularioBanco({
        titularCuenta: guardado.titular_cuenta,
        banco: guardado.banco,
        clabe: guardado.clabe,
        numeroTarjeta: guardado.numero_tarjeta
      });
      setAvisoBanco("Datos bancarios guardados. Operación los revisará antes de procesar pagos.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "No pudimos guardar tus datos bancarios.");
    } finally {
      setGuardandoBanco(false);
    }
  }

  const resumen = useMemo(() => {
    const ganancias = registros.reduce((total, registro) => total + registro.monto, 0);
    const gastos = registros.reduce((total, registro) => total + registro.gastos, 0);
    const retenciones = registros.filter((registro) => registro.estatus === "revocado" || registro.estatus === "en_revision").reduce(
      (total, registro) => total + registro.monto,
      0
    );
    const ajustes = registros.filter((registro) => registro.estatus === "ajustado").reduce((total, registro) => total + registro.gastos, 0);
    return {
      ganancias,
      gastos,
      ajustes,
      retenciones,
      deposito: Math.max(0, ganancias + gastos - ajustes - retenciones),
      vehiculosTrasladados: registros.length
    };
  }, [registros]);

  return (
    <div className="mx-auto max-w-5xl px-6 py-10 sm:py-14">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <Link href="/panel" className="font-body text-sm text-ink/55 underline-offset-4 hover:underline">
            Panel
          </Link>
          <h1 className="mt-2 font-display text-3xl font-semibold">Mis ganancias</h1>
          <p className="mt-2 font-body text-sm text-ink/60">
            Entiende cuánto generaste, qué gastos se autorizaron y cuánto se depositará.
          </p>
        </div>
        <Link href="/viajes">
          <Button variant="secundario">Ver viajes</Button>
        </Link>
      </header>

      {error && (
        <div className="mt-6">
          <Aviso tono="peligro">{error}</Aviso>
        </div>
      )}

      {tieneSupabaseConfigurado() && (
        <section className="mt-6">
          <PassportCard>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <p className="font-body text-xs uppercase tracking-wide text-ink/45">Datos bancarios</p>
                <h2 className="mt-1 font-display text-xl font-semibold">Cuenta para pagos</h2>
                <p className="mt-1 font-body text-sm text-ink/60">
                  Captura tu banco, CLABE y tarjeta para que operación pueda programar tus depósitos.
                </p>
              </div>
              {datosBancarios && (
                <span className="rounded-full border border-control/30 bg-control-soft px-3 py-1 font-body text-xs font-semibold text-control">
                  {ETIQUETA_DATOS_BANCARIOS[datosBancarios.estado]}
                </span>
              )}
            </div>

            {avisoBanco && (
              <div className="mt-4">
                <Aviso tono="info">{avisoBanco}</Aviso>
              </div>
            )}

            {datosBancarios?.motivo_rechazo && (
              <div className="mt-4">
                <Aviso tono="atencion">{datosBancarios.motivo_rechazo}</Aviso>
              </div>
            )}

            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              <Field
                etiqueta="Titular de la cuenta"
                value={formularioBanco.titularCuenta}
                onChange={(evento) => actualizarCampoBanco("titularCuenta", evento.target.value)}
                placeholder="Nombre completo"
              />
              <Field
                etiqueta="Banco"
                value={formularioBanco.banco}
                onChange={(evento) => actualizarCampoBanco("banco", evento.target.value)}
                placeholder="BBVA, Banorte, Santander..."
              />
              <Field
                etiqueta="CLABE"
                value={formularioBanco.clabe}
                onChange={(evento) => actualizarCampoBanco("clabe", evento.target.value)}
                placeholder="18 digitos"
                inputMode="numeric"
                maxLength={18}
              />
              <Field
                etiqueta="Numero de tarjeta"
                value={formularioBanco.numeroTarjeta}
                onChange={(evento) => actualizarCampoBanco("numeroTarjeta", evento.target.value)}
                placeholder="16 a 19 digitos"
                inputMode="numeric"
                maxLength={19}
              />
            </div>
            <div className="mt-4 flex justify-end">
              <Button
                onClick={guardarBanco}
                disabled={
                  guardandoBanco ||
                  formularioBanco.titularCuenta.trim().length < 3 ||
                  formularioBanco.banco.trim().length < 2 ||
                  formularioBanco.clabe.length !== 18 ||
                  formularioBanco.numeroTarjeta.length < 16
                }
              >
                {guardandoBanco ? TEXTOS_CARGANDO.guardando : "Guardar datos bancarios"}
              </Button>
            </div>
          </PassportCard>
        </section>
      )}

      <section className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-6">
        <PassportCard>
          <p className="font-body text-xs uppercase tracking-wide text-ink/45">Vehículos trasladados</p>
          <p className="mt-2 font-display text-2xl font-semibold">{resumen.vehiculosTrasladados}</p>
        </PassportCard>
        <PassportCard>
          <p className="font-body text-xs uppercase tracking-wide text-ink/45">Ganancias</p>
          <p className="mt-2 font-display text-2xl font-semibold">{moneda(resumen.ganancias)}</p>
        </PassportCard>
        <PassportCard>
          <p className="font-body text-xs uppercase tracking-wide text-ink/45">Gastos autorizados</p>
          <p className="mt-2 font-display text-2xl font-semibold">{moneda(resumen.gastos)}</p>
        </PassportCard>
        <PassportCard>
          <p className="font-body text-xs uppercase tracking-wide text-ink/45">Ajustes</p>
          <p className="mt-2 font-display text-2xl font-semibold">{moneda(resumen.ajustes)}</p>
        </PassportCard>
        <PassportCard>
          <p className="font-body text-xs uppercase tracking-wide text-ink/45">Retenciones</p>
          <p className="mt-2 font-display text-2xl font-semibold">{moneda(resumen.retenciones)}</p>
        </PassportCard>
        <PassportCard>
          <p className="font-body text-xs uppercase tracking-wide text-ink/45">Depósito final</p>
          <p className="mt-2 font-display text-2xl font-semibold">{moneda(resumen.deposito)}</p>
        </PassportCard>
      </section>

      <section className="mt-6">
        <PassportCard>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="font-body text-xs uppercase tracking-wide text-ink/45">Pagos recibidos por semana</p>
              <h2 className="mt-1 font-display text-xl font-semibold">Resumen semanal</h2>
            </div>
            <p className="font-body text-sm text-ink/55">
              {fecha(resumenSemanal.fecha_pago)} · {resumenSemanal.metodo}
            </p>
          </div>
          <dl className="mt-5 grid gap-3 font-body text-sm sm:grid-cols-2">
            <div className="flex justify-between gap-4 border-t border-ink/10 pt-3">
              <dt className="text-ink/45">Ganancias generadas</dt>
              <dd className="font-mono-ruum">{moneda(resumenSemanal.ganancias_generadas)}</dd>
            </div>
            <div className="flex justify-between gap-4 border-t border-ink/10 pt-3">
              <dt className="text-ink/45">Gastos registrados y autorizados</dt>
              <dd className="font-mono-ruum">{moneda(resumenSemanal.gastos_autorizados)}</dd>
            </div>
            <div className="flex justify-between gap-4 border-t border-ink/10 pt-3">
              <dt className="text-ink/45">Ajustes o retenciones</dt>
              <dd className="font-mono-ruum">{moneda(resumenSemanal.ajustes)}</dd>
            </div>
            <div className="flex justify-between gap-4 border-t border-ink/10 pt-3">
              <dt className="font-semibold text-ink">Depósito final</dt>
              <dd className="font-mono-ruum font-semibold">{moneda(resumenSemanal.deposito_final)}</dd>
            </div>
          </dl>
        </PassportCard>
      </section>

      <section className="mt-6">
        <div className="mb-3 flex flex-col gap-1">
          <h2 className="font-display text-xl font-semibold">Estatus económico de viajes realizados</h2>
          <p className="font-body text-sm text-ink/55">Estados: Pagado, Pendiente, Revocado, En revisión y Ajustado.</p>
        </div>
        <div className="grid gap-3">
          {registros.length === 0 && (
            <PassportCard>
              <p className="font-body text-sm text-ink/55">No hay payouts registrados para tu cuenta todavía.</p>
            </PassportCard>
          )}
          {registros.map((registro) => (
            <PassportCard key={`${registro.fecha}-${registro.ruta}`}>
              <div className="grid gap-4 lg:grid-cols-[1fr_0.8fr_0.8fr_0.8fr_0.8fr] lg:items-center">
                <div>
                  <p className="font-body text-sm font-semibold">{registro.ruta}</p>
                  <p className="mt-1 font-body text-xs text-ink/45">Fecha del viaje: {fecha(registro.fecha)}</p>
                </div>
                <div>
                  <p className="font-body text-xs uppercase tracking-wide text-ink/45">Monto generado</p>
                  <p className="mt-1 font-mono-ruum text-sm">{moneda(registro.monto)}</p>
                </div>
                <div>
                  <p className="font-body text-xs uppercase tracking-wide text-ink/45">Gastos autorizados</p>
                  <p className="mt-1 font-mono-ruum text-sm">{moneda(registro.gastos)}</p>
                </div>
                <div>
                  <p className="font-body text-xs uppercase tracking-wide text-ink/45">Liberación estimada</p>
                  <p className="mt-1 font-body text-sm">{fecha(registro.liberacion)}</p>
                </div>
                <EstatusBadgeEconomico estatus={registro.estatus} />
              </div>
            </PassportCard>
          ))}
        </div>
      </section>
    </div>
  );
}
