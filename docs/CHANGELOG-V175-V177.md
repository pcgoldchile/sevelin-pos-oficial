# v175–v177 — Cobro por pasos, servicios por equipo, caja en el celular y permisos del taller (22-10-2026)

Pedido del dueño (22-10-2026): servicios que abarquen muchas marcas y modelos con costo variable; punto de venta en la
app del taller solo para administradores y un módulo en el POS para decidir qué puede hacer cada usuario; "que no haya
que deslizar las cosas… primero de dónde vino el cliente, luego otro pop up, puntos Sevelin, luego otro…".

## v175 — El cobro de una venta nueva va por pasos (`js/pago-pasos.js`, `91c738b`)

- La ventana de pago mostraba todo apilado (origen, Puntos, máquina, medios) y había que bajar con la rueda. Ahora:
  **1. ¿De dónde vino el cliente?** (tocar una opción avanza sola; "Saltar") → **2. ⭐ ¿Suma Puntos Sevelin?**
  ("Seguir sin puntos") → **3. ¿Cómo paga?** (medios en dos columnas) → siguen los pasos que ya existían (efectivo, boleta,
  entrega). Barra con "Paso N de 3", puntos de avance y "←" para volver.
- Solo en una venta nueva (`configPago.pedirOrigen`); el cobro de una OT o un abono queda igual.
- Se ocultan "Tipo de entrega" y "Origen del pago" de esa ventana: ningún código los leía (la entrega se elige en su
  propia ventana al final).
- Medido en la maqueta a 1280×760: los tres pasos caben sin barra de desplazamiento.

## v176 — Servicios y productos "por equipo" (sql/111, `50b528a`)

- Ficha → "📱 Va por equipo". Al agregarlo a la venta, la caja pregunta **marca** (botones, primero las más vendidas;
  listas para celular, computador y consola; "Otra"), **modelo** (sugerencias de lo ya vendido), **precio y costo de esa
  venta** (nunca bajo el costo). La línea queda "Cambio de Pantalla · Samsung A15" y guarda `venta_items.equipo_marca` /
  `equipo_modelo`. Ruta `GET /api/ventas/equipos-frecuentes`.
- Marcados: #275 Pantalla, #274 Puerto de carga, #112 Limpieza de puerto, #290 FRP, #351 Formateo de celular, #372 Virus
  Android, #309 Batería notebook, #276 Bisagras, #310 Derrame.
- #527 "Desbloqueo cuenta google g06" (producto por modelo, nunca vendido) queda para que el dueño decida archivarlo.

## v177 — Caja en el celular y permisos de la app del taller (`a81afb2`, pendiente #98 en parte)

- **Permisos** (`usuarios.permisos.taller`): POS → Usuarios → "📱 Qué puede hacer en la app del taller": registrar
  trabajos, cobrar trabajos, cotizar, bodega, cuentas y **💳 caja del celular**. Un administrador puede todo. Un
  trabajador parte como antes (todo menos cuentas y caja). El freno está en el servidor (`exigirPermisoTaller` en las 20
  rutas del taller; anular sigue solo para administradores). La lista muestra "Todo" o "5 de 6 · caja".
- **Caja en el celular** (pestaña "💳 Caja", primero para quien puede cobrar): buscar o 📷 escanear (lee el código y, si
  hay uno exacto, lo agrega), carrito con cantidad, precio ✏️ y "¿va al pozo de C. Patricio?" en sus servicios, y cobro de
  a una pregunta: ¿de dónde vino? → ¿cómo paga? (y máquina) → ¿con cuánto paga? (vuelto) → ¿boleta? → registrar. La
  venta va por la MISMA ruta del POS (`POST /api/ventas`) con la cabecera `X-Sevelin-App: taller`, que exige el permiso
  "caja"; manda la fecha de Chile. Avisa si no hay caja abierta en el POS.
- Los Puntos Sevelin todavía no están en la caja del celular (se suman desde el POS).

## Probado

- Maqueta del POS: cobro por pasos completo hasta "Venta registrada"; "¿Para qué equipo?" (Samsung A15, $35.000, costo
  $18.000); Usuarios con las casillas (admin bloqueado en "todo", trabajador 4 de 6 → 5 de 6 · caja).
- Maqueta del taller (servidor real + base en memoria, 375 px): login admin → Caja → buscar → pantalla por equipo →
  carrito → 4 pasos → venta guardada con marca, modelo, costo, origen y vuelto. Trabajador: sin permiso 403 en caja y
  venta; con permiso 200; bodega apagada 403.
- Servidor real con el doble: sugerencias de marcas y modelos ordenadas por ventas.
- Sin probar: la cámara en un teléfono real (igual que la Bodega) y el cobro real en producción.
