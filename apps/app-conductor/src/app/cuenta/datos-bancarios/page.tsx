"use client";

import { useEffect, useState } from "react";
import { Aviso, Button, Field, FinancialCard } from "@ruum/ui";
import { guardarDatosBancariosConductor, obtenerGananciasConductor } from "@ruum/api/services";
import { traducirErrorOperativo } from "@ruum/shared/utils";
import type { Database } from "@ruum/shared/types";
import { crearClienteNavegador } from "../../../lib/supabase-browser";
import { CuentaHeader } from "../CuentaHeader";
import { cargarConductorCuenta } from "../cuenta-utils";
import { DatosSensiblesInfo, enmascararUltimos } from "../datos-sensibles";

type DatosBancarios = Database["public"]["Tables"]["datos_bancarios_conductor"]["Row"];

const ETIQUETA_DATOS_BANCARIOS: Record<Database["public"]["Enums"]["estado_datos_bancarios_conductor"], string> = {
  en_revision: "Datos en revisión",
  verificada: "Datos verificados",
  rechazada: "Datos rechazados"
};

export default function PaginaDatosBancarios() {
  const [datosBancarios, setDatosBancarios] = useState<DatosBancarios | null>(null);
  const [formulario, setFormulario] = useState({ titularCuenta: "", banco: "", clabe: "", numeroTarjeta: "" });
  const [edicionAutorizada, setEdicionAutorizada] = useState(false);
  const [password, setPassword] = useState("");
  const [mensaje, setMensaje] = useState<string | null>(null);
  const [confirmandoSesion, setConfirmandoSesion] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    async function cargar() {
      const conductor = await cargarConductorCuenta();
      if (!conductor) {
        setCargando(false);
        return;
      }
      const cliente = crearClienteNavegador();
      const ganancias = await obtenerGananciasConductor(cliente, conductor.id);
      const datos = ganancias.datosBancarios;
      setDatosBancarios(datos);
      if (datos) {
        setFormulario({
          titularCuenta: datos.titular_cuenta,
          banco: datos.banco,
          clabe: datos.clabe,
          numeroTarjeta: datos.numero_tarjeta
        });
      }
      setCargando(false);
    }
    void cargar();
  }, []);

  function actualizar(campo: keyof typeof formulario, valor: string) {
    setFormulario((actual) => ({ ...actual, [campo]: campo === "clabe" || campo === "numeroTarjeta" ? valor.replace(/\D/g, "") : valor }));
  }

  async function confirmarSesion() {
    setConfirmandoSesion(true);
    setMensaje(null);
    try {
      const cliente = crearClienteNavegador();
      const { data: sesion } = await cliente.auth.getUser();
      const email = sesion.user?.email;
      if (!email) throw new Error("Inicia sesión de nuevo para editar tus datos bancarios.");
      const { error } = await cliente.auth.signInWithPassword({ email, password });
      if (error) throw error;
      setEdicionAutorizada(true);
      setPassword("");
      setMensaje("Sesión confirmada. Puedes editar tus datos bancarios.");
    } catch (error) {
      setMensaje(traducirErrorOperativo(error, "No pudimos confirmar tu sesión."));
    } finally {
      setConfirmandoSesion(false);
    }
  }

  async function guardar() {
    if (!edicionAutorizada) {
      setMensaje("Confirma tu sesión antes de editar datos bancarios.");
      return;
    }
    const confirmado = window.confirm("Tus datos bancarios volverán a revisión antes de usarse para depósitos. ¿Quieres guardar el cambio?");
    if (!confirmado) return;
    setGuardando(true);
    setMensaje(null);
    try {
      const cliente = crearClienteNavegador();
      const guardado = await guardarDatosBancariosConductor(cliente, formulario);
      setDatosBancarios(guardado);
      setEdicionAutorizada(false);
      setMensaje("Datos bancarios guardados. Operación revisará la cuenta antes de programar depósitos.");
    } catch (error) {
      setMensaje(traducirErrorOperativo(error, "No pudimos guardar tus datos bancarios."));
    } finally {
      setGuardando(false);
    }
  }

  return (
    <div className="mx-auto max-w-3xl px-6 py-10 sm:py-14">
      <CuentaHeader titulo="Datos bancarios" descripcion="Protegemos esta sección porque afecta tus depósitos." />
      {mensaje && <div className="mt-5"><Aviso tono="info">{mensaje}</Aviso></div>}
      <FinancialCard className="mt-6">
        {cargando ? <p className="font-body text-sm text-text-secondary">Cargando datos bancarios...</p> : (
          <div className="grid gap-5">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <p className="font-body text-xs uppercase tracking-wide text-text-tertiary">Cuenta para pagos</p>
                <h2 className="mt-1 font-display text-xl font-semibold">Información sensible</h2>
                <p className="mt-1 font-body text-sm text-text-secondary">Cualquier cambio vuelve a revisión operativa.</p>
              </div>
              {datosBancarios && <span className="rounded-full border border-success bg-control-soft px-3 py-1 font-body text-xs font-semibold text-success">{ETIQUETA_DATOS_BANCARIOS[datosBancarios.estado]}</span>}
            </div>
            <DatosSensiblesInfo tipo="cuenta_bancaria" />
            {datosBancarios?.motivo_rechazo && <Aviso tono="atencion">{datosBancarios.motivo_rechazo}</Aviso>}
            {!edicionAutorizada ? (
              <div className="grid gap-4 rounded-lg border border-border bg-surface px-4 py-4">
                <dl className="grid gap-3 font-body text-sm sm:grid-cols-2">
                  <div><dt className="text-xs uppercase tracking-wide text-text-tertiary">Titular</dt><dd className="mt-1 font-semibold">{datosBancarios ? "Registrado" : "Pendiente"}</dd></div>
                  <div><dt className="text-xs uppercase tracking-wide text-text-tertiary">Banco</dt><dd className="mt-1 font-semibold">{formulario.banco || "Pendiente"}</dd></div>
                  <div><dt className="text-xs uppercase tracking-wide text-text-tertiary">CLABE</dt><dd className="mt-1 font-semibold">{formulario.clabe ? enmascararUltimos(formulario.clabe) : "Pendiente"}</dd></div>
                  <div><dt className="text-xs uppercase tracking-wide text-text-tertiary">Tarjeta</dt><dd className="mt-1 font-semibold">{formulario.numeroTarjeta ? enmascararUltimos(formulario.numeroTarjeta) : "Pendiente"}</dd></div>
                </dl>
                <Field etiqueta="Confirma tu contraseña" type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" />
                <Button onClick={confirmarSesion} disabled={confirmandoSesion || password.length < 8}>
                  {confirmandoSesion ? "Confirmando..." : "Confirmar sesión y editar"}
                </Button>
              </div>
            ) : (
              <>
                <Aviso tono="atencion">Estás editando datos sensibles. Confirma que pertenecen al titular registrado antes de guardar.</Aviso>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field etiqueta="Titular de la cuenta" value={formulario.titularCuenta} onChange={(e) => actualizar("titularCuenta", e.target.value)} />
                  <Field etiqueta="Banco" value={formulario.banco} onChange={(e) => actualizar("banco", e.target.value)} />
                  <Field etiqueta="CLABE" value={formulario.clabe} onChange={(e) => actualizar("clabe", e.target.value)} inputMode="numeric" maxLength={18} />
                  <Field etiqueta="Número de tarjeta" value={formulario.numeroTarjeta} onChange={(e) => actualizar("numeroTarjeta", e.target.value)} inputMode="numeric" maxLength={19} />
                </div>
                <Button
                  onClick={guardar}
                  disabled={guardando || formulario.titularCuenta.trim().length < 3 || formulario.banco.trim().length < 2 || formulario.clabe.length !== 18 || formulario.numeroTarjeta.length < 16}
                >
                  {guardando ? "Guardando..." : "Guardar datos bancarios"}
                </Button>
              </>
            )}
          </div>
        )}
      </FinancialCard>
    </div>
  );
}
