# v161 — Destacados automáticos de sevelin.cl (18-10-2026)

Pedido del dueño: *"en destacados me gustaría que aparezcan los productos más clickeados del mes, o los más tendencia,
tipo ahora que hace calor en Arica los ventiladores industriales, y los más vendidos… que vayan cambiando según qué
tanta importancia o clicks tengan, de forma automatizada. Si es necesario un botón en el POS, me avisas."*

## Lo que había

Destacados se ordenaba por `unidades_vendidas` (total histórico), y el POS solo la mandaba con
`scripts/sincronizar-mas-vendidos.js` corrido a mano. El máximo en la tienda era 18 unidades: un dato viejo que no
cambiaba nunca.

## En el POS

- **`GET /api/cron/mas-vendidos`** (cron de Vercel, 07:30 de Chile = `30 10 * * *` UTC, `vercel.json`): suma las
  ventas PAGADAS de cada producto (sin servicios ni ítems sin producto), el total de siempre y los últimos 30 días, y
  las manda a `sevelin.cl/api/sync/mas-vendidos` con `SYNC_SECRET`. Si falla, queda en el registro de errores (Salud).
  `TIENDA_MAS_VENDIDOS_URL` es opcional (por defecto `https://www.sevelin.cl/api/sync/mas-vendidos`). El script viejo
  sigue sirviendo, pero ya no hace falta correrlo.
- **No hizo falta un botón nuevo:** para empujar un producto a mano está la etiqueta que ya existe en la ficha,
  "Etiqueta destacada → 🔥 Tendencia" (suma mucho al puntaje). "🆕 Novedad" suma algo menos.

## En la tienda (ver su SNAPSHOT del 18-10-2026 noche)

Puntaje diario con ventas del mes, vistas del mes, tendencia de la semana, la etiqueta del POS, ofertas y el calor de
Arica (≥ 24 °C sube la subcategoría Ventiladores). Portada con el motivo de cada uno. Primer cálculo (18-10-2026,
24,5 °C): 1.º Ventilador Industrial 18" (☀️ Para el calor), 2.º Hub USB-C 8 en 1 (⭐ Más vendido), 3.º Mini Ventilador.
Las ventas de 30 días de ese primer cálculo se cargaron a mano con los mismos números que manda el cron.

## Cómo se probó

`node --check`; el cálculo de la tienda corrido una vez contra la base real (149 productos, clima 24,5 °C); `tsc`,
`eslint` (sin errores nuevos) y `next build` de la tienda. **No probado:** el cron del POS en Vercel (corre mañana a las
07:30; si falla aparece en Salud y el cron de la tienda de las 08:00 igual recalcula con lo que haya).
