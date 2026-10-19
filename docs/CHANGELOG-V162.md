# v162 — "🔥 Reponer": lo que se mueve en la tienda y tiene poco stock (19-10-2026)

Pedido del dueño: *"el opcional del POS, si algo en tendencia le está quedando poco stock, para reponer a tiempo"*.

- Botón **"🔥 Reponer N"** en el encabezado (solo admin), que aparece solo cuando hay algo; abre la lista con stock,
  vistas de 7 días, vendidos de 30 días y por qué está; "Abrir" lleva a la ficha. Se revisa cada 30 minutos
  (`js/reponer-tendencia.js`).
- `GET /api/pos/reponer-tendencia`: "se mueve" = entre los 10 mejores puntajes de Destacados, o entre los 10 más
  vistos de la semana en sevelin.cl, o 2+ vendidos en 30 días; "poco stock" = 3 o menos o bajo su mínimo. Lo que ya
  está por llegar se lista atenuado y no cuenta para el número.
- Calibrado con los datos del 18-10-2026: casi todo el catálogo recibe 13-24 vistas por semana, así que un corte fijo
  ("15 vistas") prendía 36 productos; con este criterio quedan 15, todos con razón (ej. el escurridor: 0 en stock, 3
  vendidos y 4 búsquedas; el Caixun 24": lo más visto, queda 1).
- Probado en la maqueta (`pos-maqueta` simula la ruta): botón, lista y "Abrir". Chequeos de funciones e ids vacíos.
  **No probado** contra la base real en el navegador; el cálculo se corrió aparte con los datos reales (15 productos).
