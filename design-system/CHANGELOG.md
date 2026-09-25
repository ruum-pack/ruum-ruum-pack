# CHANGELOG — Design System Ruum Ruum

## [v1.0] — 2026-09-25 — Actualización de identidad visual V2.1
- Autor: Design System / Opencode
- Motivo: Implementar Libro de Marca V2.1 (Parte II+III): nueva proporción 60/30/8/2, símbolo RR entrelazado, tokens cap. 26, componentes cap. 19, estados cap. 20, accesibilidad cap. 21.
- Cambios:
  - `tokens/tokens.json`: valores canónicos navy 0A2342, teal 00D1D1, teal-deep 008B8B, action 0066FF, surface E8EEF4, muted 566889, border-input 7A8DAE, warning/success/error/emergency + fondos de chip, gradientes CTA/route, font/space/radius/elevation/size/motion.
  - `tokens/tokens.css`, `tokens.ts`, `Tokens.swift`, `Tokens.kt`: generados desde JSON.
  - `assets/ruum-logo-v2.png`: copiado desde Libro de marca.
  - `@ruum/ui`: ButtonPrimary/Secondary/Text (52px, CTA, estados), StatusChip (12 estados), Card/Input/Select/Checkbox/Radio/Toggle/Alert/Toast/Modal/EmptyState/Skeleton/BottomNav/Tabs/Sidebar/Avatar alineados a tokens; modo calle (56px, ≥17px, botón seguridad); documentos (reporte, acta, credencial, estado de pago).
  - Superficies: app-usuario (paleta/tipografía/botones/chips), app-conductor (modo calle + seguridad persistente), panel-admin (tablas/chips/sidebar/indicadores sin hardcodeo).
  - `whatsapp/`: perfil, saludo, respuestas rápidas, catálogo Fase 0.
  - Verificación: contraste 4.5:1, áreas táctiles, foco visible, reduced-motion, sin hardcodeo en rutas críticas.
