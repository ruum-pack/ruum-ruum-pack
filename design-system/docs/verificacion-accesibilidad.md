# Verificación de accesibilidad — checklist de aprobación

| Prueba | Cómo | Pasa si |
|---|---|---|
| Contraste color | WebAIM Contrast Checker sobre tokens + screenshots | Texto 4.5:1; UI 3:1. Teal 00D1D1 nunca con blanco (2.23:1) — usar navy encima (6.17:1) |
| Teclado | Tab/Shift+Tab/Enter/Espacio en panel y formularios | Todo operable, foco visible anillo 3px azul, sin trampas |
| Lector pantalla | VoiceOver / TalkBack / NVDA en flujos críticos | Íconos/botones etiquetados, orden lógico, errores anunciados |
| Escala 200% | Zoom navegador + tamaño texto sistema | Sin pérdida de función ni solape |
| Modo calle | Dispositivo real bajo sol, una mano | Botones ≥56px, texto ≥17px, seguridad ≤1 toque |
| Regresión visual | Chromatic / Percy | Sin diffs fuera de tokens |

Combinaciones verificadas (cap. 13): neutro 566889/EEF2F8 5.00:1 · acción 1461E0/E8F0FE 4.80:1 · pendiente 7A4F00/FFF4D6 6.51:1 · éxito 0F6B48/E6F6EE 5.84:1 · error C23648/FDECEF 4.71:1 · incidente B3261E/FDECEF 5.73:1.
