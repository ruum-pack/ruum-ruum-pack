"use client";

import { Capacitor } from "@capacitor/core";
import { Device } from "@capacitor/device";
import { PushNotifications, type ActionPerformed, type PushNotificationSchema, type Token } from "@capacitor/push-notifications";
import { crearClienteNavegador } from "./supabase-browser";

const DEVICE_KEY = "ruum_push_device_id";

function uuidLocal(): string {
  const existente = localStorage.getItem(DEVICE_KEY);
  if (existente) return existente;
  const nuevo = crypto.randomUUID();
  localStorage.setItem(DEVICE_KEY, nuevo);
  return nuevo;
}

export function obtenerDeviceIdPush(): string | null {
  return typeof window === "undefined" ? null : localStorage.getItem(DEVICE_KEY);
}

async function registrarToken(token: Token) {
  const cliente = crearClienteNavegador();
  const [{ data: sesion }, info] = await Promise.all([cliente.auth.getSession(), Device.getInfo()]);
  if (!sesion.session) return;
  const { error } = await (cliente as any).rpc("registrar_dispositivo_push", {
    p_device_id: uuidLocal(), p_token_push: token.value, p_plataforma: "android",
    p_modelo: info.model ?? null, p_version_app: process.env.NEXT_PUBLIC_APP_VERSION ?? "1.0.0", p_version_so: info.osVersion ?? null
  });
  if (error) throw error;
}

function destinoDesdePush(notification: PushNotificationSchema | ActionPerformed["notification"]): string {
  const destino = notification.data?.destino;
  return typeof destino === "string" && destino.startsWith("/") ? destino : "/notificaciones";
}

export async function inicializarPush(onNavigate: (destino: string) => void) {
  if (!Capacitor.isNativePlatform()) return () => undefined;
  const clienteSesion = crearClienteNavegador();

  async function asegurarRegistro() {
    const { data } = await clienteSesion.auth.getSession();
    if (!data.session) return;
    const estado = await PushNotifications.checkPermissions();
    const permiso = estado.receive === "prompt" ? await PushNotifications.requestPermissions() : estado;
    if (permiso.receive === "granted") await PushNotifications.register();
  }

  await Promise.all([
    PushNotifications.createChannel({ id: "ruum_operativa", name: "Operación urgente", importance: 5, visibility: 1, vibration: true }),
    PushNotifications.createChannel({ id: "ruum_general", name: "Avisos generales", importance: 3, visibility: 1 })
  ]);

  const handles = await Promise.all([
    PushNotifications.addListener("registration", registrarToken),
    PushNotifications.addListener("registrationError", (error) => console.error("FCM registration", error)),
    PushNotifications.addListener("pushNotificationReceived", () => window.dispatchEvent(new Event("ruum:notificaciones-actualizar"))),
    PushNotifications.addListener("pushNotificationActionPerformed", async ({ notification }) => {
      const cliente = crearClienteNavegador();
      const notificacionId = notification.data?.notificacion_id;
      if (typeof notificacionId === "string") {
        await (cliente as any).rpc("registrar_apertura_push", { p_notificacion_id: notificacionId, p_device_id: uuidLocal() });
      }
      onNavigate(destinoDesdePush(notification));
    })
  ]);
  const { data: authListener } = clienteSesion.auth.onAuthStateChange((event) => {
    if (event === "SIGNED_IN" || event === "TOKEN_REFRESHED") void asegurarRegistro();
  });
  await asegurarRegistro();
  return () => {
    authListener.subscription.unsubscribe();
    handles.forEach((handle) => void handle.remove());
  };
}

export async function desactivarPushDelDispositivo() {
  if (!Capacitor.isNativePlatform()) return;
  const deviceId = obtenerDeviceIdPush();
  if (!deviceId) return;
  const cliente = crearClienteNavegador();
  await (cliente as any).rpc("desactivar_dispositivo_push", { p_device_id: deviceId });
  await PushNotifications.removeAllDeliveredNotifications();
}
