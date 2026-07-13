# RT-12 — Modelo de tarifas (traslado de vehículos)

Servicio de traslado de vehículos rodando con conductores certificados, coordinado por Torre de Control.

## Alcance de la fórmula

La tarifa que se cobra al usuario cubre **el servicio** (conexión con conductor + operación de Torre de Control + kilometraje + tiempo). **No incluye**: combustible, casetas, fallas mecánicas o de llantas, ni viáticos — esos son gastos separados, a cargo del usuario.

## Fórmula general

```
Base_categoría = BaseVehículo(rango de distancia) × F_gama
Subtotal       = Base_categoría + (Distancia_km × $/km_vehículo) + (Tiempo_horas × $21.50)
Factor_variable = MIN( F_condición × F_horario × F_día , 2.0 )
Tarifa final    = Subtotal × Factor_variable
```

**Por qué esta estructura:**
- La base y el $/km dependen del **tipo de vehículo**, no de un multiplicador aplicado sobre una base compartida. Un vehículo ligero tiene un costo casi lineal con la distancia; un camión o vehículo premium sí acarrea complejidad extra real en trayectos largos (logística, más horas de operador, mayor riesgo). Tratarlos igual generaba tarifas absurdas en trayectos largos con vehículos ligeros.
- La **certificación del chofer se retiró del cobro al usuario** — no debe pagar más porque el conductor esté mejor certificado. Esa variable se mueve al lado del pago al conductor (`pago_conductor_porcentaje`), como protección/incentivo para el chofer, no como sobreprecio oculto.
- El **cap de 2.0x** sobre condición/horario/día evita que la acumulación de recargos dispare la tarifa a niveles poco creíbles. En la práctica casi nunca se activa: el máximo real de ese producto es 1.58x (1.25 × 1.15 × 1.10).

## Rangos de distancia

| Rango | Distancia |
|---|---|
| 1 — Micro-traslados | Hasta 15 km |
| 2 — Conectividad corta | 16 a 45 km |
| 3 — Corredor estándar | 46 a 75 km |
| 4 — Cobertura extendida | Más de 75 km |

## Base y $/km por tipo de vehículo

| Vehículo | Base R1 | Base R2 | Base R3 | Base R4 | $/km |
|---|---|---|---|---|---|
| Ligero A | $650 | $700 | $720 | $750 | $7.00 |
| Ligero B | $700 | $750 | $780 | $820 | $7.50 |
| Medianos | $1,100 | $1,800 | $2,600 | $3,800 | $11.00 |
| Camiones | $1,800 | $3,200 | $4,800 | $7,200 | $16.00 |

**Tarifa por hora (todos los vehículos):** $21.50/hora — protege al conductor en tramos lentos (tráfico, terracería), sin necesidad de escalar el $/km.

## Factor de gama (se aplica sobre la base del vehículo)

| Gama | Factor |
|---|---|
| Entrada | 1.00 |
| Media | 1.15 |
| Alta | 1.40 |
| Premium | 1.80 |

## Factores variables (condición, horario, día) — con tope combinado 2.0x

**Condición del vehículo**

| Condición | Factor |
|---|---|
| Nueva | 1.10 |
| Seminueva | 1.00 |
| Rescate mecánico | 1.25 |

**Horario**

| Horario | Factor |
|---|---|
| Diurno | 1.00 |
| Nocturno | 1.15 |

**Día**

| Día | Factor |
|---|---|
| Entre semana | 1.00 |
| Fin de semana | 1.10 |

Máximo real de estos tres combinados: 1.25 × 1.15 × 1.10 = **1.58x** (el cap de 2.0x queda como red de seguridad, no se activa en operación normal).

## Certificación del chofer — fuera del precio al usuario, va al pago del conductor

| Certificación | Recomendación de `pago_conductor_porcentaje` |
|---|---|
| Estándar | 40% |
| Tipo B | 45% |
| Federal | 48% |
| Premium | 52% |

**Esquema de pago al conductor (México):** nómina semanal, corte sábado 23:59, pago viernes ~15:00 hrs por transferencia. (Pendiente de definir junto con reglas de pago mínimo garantizado en traslados cortos.)

## Ejemplo de validación: Toluca–Querétaro (196 km, ~2.33 h) — Rango 4

| Vehículo | Gama | Factor variable | Tarifa final |
|---|---|---|---|
| Ligero A, Entrada | 1.00 | 1.00x | $3,432 |
| Ligero A, Entrada | 1.00 | 1.58x (peor caso) | $3,432 |
| Ligero B, Entrada | 1.00 | 1.58x (peor caso) | $3,697 |
| Ligero B, Premium | 1.80 | 1.58x (peor caso) | $6,655 |
| Medianos, Media | 1.15 | 1.58x (peor caso) | $13,152 |
| Camión, Premium | 1.80 | 1.58x (peor caso) | $29,538 |

Validado contra referencia real de mercado (Draiver, dos años de experiencia como conductor): traslados en Ligero A/B no deben superar $5,000 en el peor caso — la tabla cumple con margen.

## Costos fuera de la fórmula (a cargo del usuario, no de Ruum Ruum)

- Combustible y aditivos
- Casetas
- Fallas mecánicas o de llantas
- Viáticos del operador

## Historial de decisiones

1. Modelo inicial: base fija $699 + $14/km + $21.5/hora × 6 factores multiplicativos — descartado por generar tarifas fuera de rango en trayectos largos.
2. Se agregó base escalonada por rango de distancia — mejora parcial, pero seguía compartiendo $/km entre todos los tipos de vehículo.
3. Se detectó que el stacking de 6 factores podía multiplicar hasta 6.4x el subtotal — se propuso un cap.
4. Se retiró la certificación del chofer del cobro al usuario (pasa a `pago_conductor_porcentaje`) — reduce el factor máximo de 6 a 5 variables.
5. Se ajustó el cap de 3.0x a 2.0x, lo que expuso que `vehículo × gama` por sí solos ya rebasaban el tope — decisión: separar la base por tipo de vehículo en vez de mantenerlo como multiplicador.
6. Versión final: base y $/km específicos por vehículo, gama aplicada sobre esa base, cap 2.0x solo sobre condición/horario/día (rara vez se activa). Validado contra referencia real de Draiver (Ligero A/B a Querétaro ≤ $5,000).
