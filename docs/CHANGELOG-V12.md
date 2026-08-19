# CHANGELOG V12 — 18 de agosto de 2026

> Depende de `docs/README.md` (documento maestro). Aquí va **solo** lo que cambió en la v12.

Esta versión cubre el **punto 2 del INSTRUCCIONES.md**: reingeniería del escáner de código de barras
para móviles. Además incorpora la base de backend para caja diaria y despacho (puntos 3-5), que
quedará conectada a su UI en versiones siguientes.

---

## 1. Escáner con captura manual y carga de foto (punto 2)

**El problema.** El escáner leía en vivo de forma automática (Html5Qrcode a 12 fps). En teléfonos,
disparaba capturas erróneas antes de que la cámara enfocara.

**El rediseño** (`js/escaner.js`, modal en `index.html`, estilos en `css/styles.css`):

- **Cámara como visor con captura por botón.** La cámara ya no lee sola: es solo un visor con un
  recuadro de enfoque. El código se decodifica al pulsar **"📸 Tomar Foto / Escanear"**, cuando el
  usuario ya encuadró. Internamente se toma el frame del `<video>`, se dibuja en un canvas y se
  decodifica con `scanFileV2`.
- **Cargar foto de galería.** Pestaña **"📁 Cargar Foto"**: se elige una imagen del teléfono y se
  decodifica **en memoria**. La imagen **no se sube** a ningún bucket ni base de datos, solo se lee el
  código y se descarta.
- **Linterna (torch)** si el dispositivo la soporta, y **cambio de cámara** frontal/trasera.
- **Respaldo manual** siempre visible bajo las pestañas.
- **CSS responsive vertical:** en móvil el modal va a pantalla completa, el visor toma proporción 3:4
  y el botón de captura crece para el pulgar.

Se preserva el CustomEvent `escaner:codigo` que escuchan el POS y los demás módulos, así que el flujo
"escanear → agregar al carrito" sigue igual. Funciona en POS, Inventario, Compras y Etiquetas (todos
los inputs con `data-scan`).

**Pruebas (jsdom):** abrir el escáner, captura por botón que decodifica y emite el evento, carga de
foto que entrega el código, respaldo manual, y cambio de pestañas. El POS consume el código y agrega
el producto correctamente.

---

## 2. Base de backend para caja y despacho (puntos 3-5, sin UI aún)

Ya disponible en el backend, a la espera de su interfaz:

- **Migración `sql/17-caja-diaria-y-despacho.sql`:** tablas `cajas_diarias` y `caja_movimientos`, y
  columnas de envío/comisión en `ventas` (`tipo_entrega`, `direccion_envio`, `notas_despacho`,
  `estado_envio`, `numero_seguimiento`, `origen_pago`, `comision_pasarela`, `caja_id`).
- **Endpoints:** `GET /api/caja/activa`, `POST /api/caja/abrir`, `POST /api/caja/movimiento`,
  `POST /api/caja/cerrar` (con arqueo calculado en el servidor), `PUT /api/ventas/:id/envio`.
- **`POST /api/ventas`** acepta los campos de despacho y comisión de pasarela.
- Métodos de API cliente para todo lo anterior.

Verificado con 16 pruebas de backend (apertura, movimientos, arqueo que cuadra, envío).

---

## 3. Qué falta del INSTRUCCIONES.md

- **Punto 3 (UI):** selector retiro/despacho en el modal de cobro.
- **Punto 4 (UI):** modales de apertura de caja, movimientos y cierre/arqueo en el POS.
- **Punto 5 (UI):** orden ASC/DESC y filtro de estado de envío en el Historial.

El backend de todo eso ya está probado; falta la capa visual.

---

## 4. Despliegue

1. Corre `sql/17-caja-diaria-y-despacho.sql` en Supabase (idempotente) — necesario para las columnas
   de envío aunque la UI de caja no esté aún.
2. Despliega backend y frontend (`css/tailwind.css` recompilado).
3. Prueba el escáner en un teléfono: abrir desde el buscador del POS, enfocar un código y pulsar
   "Tomar Foto"; probar también "Cargar Foto" desde la galería.
