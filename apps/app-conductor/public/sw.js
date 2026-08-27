/**
 * Service Worker para Ruum Conductor - PWA
 * Recomendación PERF-004: Implementar Service Worker para caching
 * 
 * Este Service Worker proporciona:
 * - Caching de recursos estáticos (Cache-first)
 * - Estrategia de cache para API (Stale-while-revalidate)
 * - Soporte offline básico
 */

const CACHE_NAME = "ruum-conductor-v1";
const ASSETS_CACHE_NAME = "ruum-conductor-assets-v1";

// Recursos estáticos para cachear
const STATIC_RESOURCES = [
  "/",
  "/manifest.json",
  "/favicon.ico",
  "/imagenes/onboarding-paso1.webp",
  "/imagenes/onboarding-paso2.webp",
  "/imagenes/onboarding-paso3.webp",
  // CSS y JS de Tailwind/Next
  "/_next/static/css/*.css",
  "/_next/static/*.js",
  // Fuente
  "/fonts/*"
];

// Rutas de API que pueden ser cacheadas
const API_ROUTES = [
  "/api/health",
  "/api/csp-report"
];

// Instalación: Cachear recursos estáticos
self.addEventListener("install", (event) => {
  console.log("[SW] Installing...");
  
  event.waitUntil(
    caches.open(STATIC_RESOURCES_CACHE_NAME).then((cache) => {
      console.log("[SW] Caching static resources...");
      return cache.addAll(STATIC_RESOURCES);
    })
  );
  
  // Forzar activación inmediata
  self.skipWaiting();
});

// Activación: Limpiar caches viejos
self.addEventListener("activate", (event) => {
  console.log("[SW] Activating...");
  
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME && cacheName !== ASSETS_CACHE_NAME) {
            console.log(`[SW] Deleting old cache: ${cacheName}`);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  
  // Tomar control de todas las pestañas
  self.clients.claim();
});

// Fetch: Estrategias de caching
self.addEventListener("fetch", (event) => {
  const request = event.request;
  const url = new URL(request.url);
  
  // Ignorar solicitudes a otros dominios
  if (!url.origin.includes("ruum") && !url.origin.includes("localhost") && !url.origin.includes("127.0.0.1")) {
    return;
  }
  
  // API routes - Stale-while-revalidate
  if (API_ROUTES.some(route => url.pathname.startsWith(route))) {
    event.respondWith(
      caches.match(request).then((cachedResponse) => {
        // Si hay cache, devolverlo y actualizar en segundo plano
        if (cachedResponse) {
          event.waitUntil(
            fetch(request).then((response) => {
              if (response.ok) {
                caches.open(CACHE_NAME).then((cache) => {
                  cache.put(request, response);
                });
              }
              return response;
            })
          );
          return cachedResponse;
        }
        
        // Si no hay cache, hacer fetch normal
        return fetch(request).then((response) => {
          if (response.ok) {
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(request, response.clone());
            });
          }
          return response;
        });
      })
    );
  }
  
  // Static resources - Cache-first
  if (STATIC_RESOURCES.some(resource => 
    url.pathname === resource || 
    (resource.includes("*") && url.pathname.includes(resource.replace("*", "")))
  )) {
    event.respondWith(
      caches.match(request).then((cachedResponse) => {
        if (cachedResponse) {
          return cachedResponse;
        }
        
        return fetch(request).then((response) => {
          if (response.ok) {
            caches.open(STATIC_RESOURCES_CACHE_NAME).then((cache) => {
              cache.put(request, response.clone());
            });
          }
          return response;
        });
      })
    );
  }
});

// Mensajes del cliente (para actualizaciones)
self.addEventListener("message", (event) => {
  if (event.data.action === "skipWaiting") {
    self.skipWaiting();
  }
  
  if (event.data.action === "updateCache") {
    event.waitUntil(
      caches.open(STATIC_RESOURCES_CACHE_NAME).then((cache) => {
        return cache.addAll(STATIC_RESOURCES);
      })
    );
  }
});

// Escuchar eventos de conexión
self.addEventListener("online", () => {
  console.log("[SW] Online - Sync pending requests");
  // Aquí se podría implementar sincronización de datos offline
});

console.log("[SW] Ruum Conductor Service Worker loaded");
