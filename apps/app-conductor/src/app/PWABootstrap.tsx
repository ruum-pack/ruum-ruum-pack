"use client";

import { useEffect } from "react";

/**
 * Componente para registrar el Service Worker y manejar actualizaciones PWA
 * Recomendación PERF-004
 */
export function PWABootstrap() {
  useEffect(() => {
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
    <div style="
      position: fixed;
      bottom: 20px;
      right: 20px;
      z-index: 9999;
      padding: 16px 20px;
      background: #1E88E5;
      color: white;
      border-radius: 12px;
      box-shadow: 0 4px 20px rgba(0,0,0,0.3);
      display: flex;
      align-items: center;
      gap: 12px;
      font-family: var(--font-body);
      font-size: 14px;
    ">
      <span>📦 Nueva versión disponible</span>
      <button onclick="window.location.reload()" style="
        background: white;
        color: #1E88E5;
        border: none;
        border-radius: 8px;
        padding: 8px 16px;
        font-weight: 600;
        cursor: pointer;
        font-family: var(--font-body);
      ">Actualizar</button>
      <button onclick="document.getElementById('ruum-pwa-update-banner').remove(); localStorage.setItem('ruum_pwa_update_prompted', 'true');" style="
        background: transparent;
        color: white;
        border: none;
        cursor: pointer;
        font-size: 20px;
        line-height: 1;
      ">×</button>
    </div>
  `;
  document.body.appendChild(updateBanner);
  
  // Auto-ocultar después de 10 segundos
  setTimeout(() => {
    const banner = document.getElementById("ruum-pwa-update-banner");
    if (banner) {
      banner.remove();
    }
  }, 10000);
}
