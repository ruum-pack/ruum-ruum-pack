# Variantes de tarjetas

Las tarjetas de `@ruum/ui` se eligen por intencion, no por apariencia heredada.

| Variante | Uso | Padding | Borde | Sombra |
| --- | --- | --- | --- | --- |
| `Card` | Contenido generico, configuracion, listas simples. | `p-5 sm:p-6` | `border-border` | `shadow-1` |
| `OperationalCard` | Accion actual, paso principal, requisito operativo. | `p-5 sm:p-6` | `border-route-action` | `shadow-2` |
| `TripCard` | Viajes, oportunidades y traslados aceptados. | `p-5 sm:p-6` | `border-border-strong` con hover operativo | `shadow-1` |
| `FinancialCard` | Montos, depositos, ganancias, retenciones y datos bancarios. | `p-5 sm:p-6` | `border-success` | `shadow-1` |
| `AlertCard` | Bloqueos, avisos prioritarios y soporte critico. | `p-5 sm:p-6` | `border-warning` | `shadow-1` |
| `PassportCard` | Identidad, pasaporte digital, certificados verificables y expediente resumido. | `p-5 sm:p-6` | `border-border` con patron documental | `shadow-1` |

Reglas:

- `PassportCard` no debe usarse como contenedor universal.
- Una accion operativa usa `OperationalCard`, incluso si tambien contiene mapa o CTA.
- Una tarjeta financiera usa `FinancialCard`, aunque el monto este pendiente o sin calcular.
- Viajes y oportunidades usan `TripCard`; si contienen un monto, el bloque del monto debe usar tokens financieros sin anidar otra tarjeta.
