"use client";

import { useEffect } from "react";

/**
 * Componente para registrar el Service Worker y manejar actualizaciones PWA
 * Recomendación PERF-004
 */
export function PWABootstrap() {
  useEffect(() => {
    // No registrar SW en desarrollo ni en entornos de testing/Playwright para evitar interferir con tests y requests
    if (process.env.NODE_ENV !== "production") return;
    if (typeof window !== "undefined" && (window.navigator.webdriver || window.location.hostname === "localhost")) return;

    // Verificar si el navegador soporta Service Workers
    if ("serviceWorker" in navigator) {
      const registerSW = async () => {
        try {
          // Registrar el Service Worker
          const registration = await navigator.serviceWorker.register("/sw.js", {
            scope: "/",
          });
          
          console.log("[PWA] Service Worker registrado:", registration.scope);
          
          // Manejar actualizaciones
          registration.onupdatefound = () => {
            const installingWorker = registration.installing;
            
            if (installingWorker) {
              installingWorker.onstatechange = () => {
                if (installingWorker.state === "installed") {
                  console.log("[PWA] Nueva versión disponible");
                  // Mostrar notificación al usuario
                  showUpdateNotification();
                }
              };
            }
          };
          
          // Verificar si hay una nueva versión periódicamente
          const checkForUpdates = setInterval(() => {
            registration.update();
          }, 24 * 60 * 60 * 1000); // Cada 24 horas
          
          // Limpiar al desmontar
          return () => clearInterval(checkForUpdates);
        } catch (error) {
          console.error("[PWA] Error registrando Service Worker:", error);
        }
      };
      
      registerSW();
    }
  }, []);
  
  return null;
}

function showUpdateNotification() {
  // Verificar si ya mostramos la notificación
  if (localStorage.getItem("ruum_pwa_update_prompted") === "true") {
    return;
  }
  
  // Crear notificación nativa
  if (Notification.permission === "granted") {
    new Notification("Ruum Conductor - Actualización disponible", {
      body: "Hay una nueva versión disponible. Recarga la página para actualizar.",
      icon: "/favicon.ico",
      data: { action: "reload" }
    });
  }
  
  // Mostrar banner en la UI
  const updateBanner = document.createElement("div");
  updateBanner.id = "ruum-pwa-update-banner";
  updateBanner.innerHTML = `
    <div class="conductor-pwa-update-card">
      <span>📦 Nueva versión disponible</span>
      <button type="button" class="conductor-pwa-update-action">Actualizar</button>
      <button type="button" class="conductor-pwa-dismiss-action" aria-label="Cerrar aviso de actualización">×</button>
    </div>
  `;
  document.body.appendChild(updateBanner);

  updateBanner.querySelector<HTMLButtonElement>(".conductor-pwa-update-action")?.addEventListener("click", () => {
    window.location.reload();
  });
  updateBanner.querySelector<HTMLButtonElement>(".conductor-pwa-dismiss-action")?.addEventListener("click", () => {
    updateBanner.remove();
    localStorage.setItem("ruum_pwa_update_prompted", "true");
  });
  
  // Auto-ocultar después de 10 segundos
  setTimeout(() => {
    const banner = document.getElementById("ruum-pwa-update-banner");
    if (banner) {
      banner.remove();
    }
  }, 10000);
}
