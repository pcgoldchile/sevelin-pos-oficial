# v93 — POS sobrio (el estilo de la tienda) y un carrito que se maneja con + / −

**Fecha:** 27-09-2026
**Migración:** ninguna. Solo frontend (`index.html`, `css/`, `js/pos.js`, `js/atajos.js`, `js/config.js`).
**Pedido del dueño:** *"que hayan atajos para + o - para cada producto que vaya agregando (los productos
que tenga S/N, que me pida el S/N, opcional igualmente). Y que al escribir un producto o escanearlo, que
salga la imagen y pueda expandirla. [...] que el diseño de POS sea más sobrio y estético, parecido al de
la página web [...] siga siendo oscuro e inspirado en la tienda web."*

---

## 1. La pantalla de venta

- **+ / − en cada línea del carrito.** El − se apaga en 1: para quitar está el basurero (o Alt+Supr).
  Alt + / Alt − (última línea) usan la misma función, `cambiarCantidadCarrito()`.
- **S/N opcional.** Un producto con `requiere_sn` ya no se detiene en el formulario: abre una ventana
  para escanear o escribir la serie, con **"Agregar sin S/N"**. Cada unidad con serie va en su propia
  línea; sin serie suma a la línea sin S/N de ese producto. Una serie repetida en el carrito se
  rechaza. En Modo edición el campo sigue en el formulario, ahora opcional (antes era obligatorio).
- **Fotos al escribir y al escanear.** Las sugerencias traen la foto; clic en la foto = visor grande,
  sin agregar el producto (Esc cierra solo el visor, la lista queda). La tarjeta izquierda muestra
  una **vista previa** grande: la sugerencia marcada con ↑/↓ o el mouse, o lo último que entró.
- **Carrito rehecho.** Foto entera · nombre en 2 líneas · precio c/u y S/N debajo · cantidad · subtotal.
  Sin barra horizontal. **Por qué se veía la foto cortada:** Tailwind limita las `<img>` a
  `max-width:100%` y la columna de la foto medía 36 px, así que la imagen quedaba en 14 px de ancho.
  Además las reglas que alineaban el carrito iban por posición (`td:nth-child(3)`), escritas antes de
  que existiera la columna de foto: por eso el nombre salía alineado a la derecha.
- **El mismo producto suma a su línea** (sin S/N, mismo precio y costo) en vez de repetirse. Antes eso
  pasaba solo al escanear; al elegirlo de la lista salían filas repetidas.
- **Aviso de stock** (no bloquea): si llevas más unidades que el stock del catálogo. El servidor sigue
  siendo quien valida al cobrar.

## 2. Diseño sobrio en todo el POS

- **Paleta de sevelin-tienda:** fondo negro, tarjetas `#0d0d10`, grises zinc y un solo azul
  (`#3b82f6` / `#2563eb`). Sin halos de neón, sin rejilla hexagonal, sin degradados en botones.
- **`--gold` vuelve a ser ámbar.** Era magenta desde la pasada "gamer", pero casi todos sus usos eran
  advertencias con fondo ámbar (pago mixto mal cuadrado, F29 por vencer, primer lugar del ranking).
- **82 colores neón escritos a mano pasaron a tokens** (`--blue-rgb`, `--gold-rgb`), y 107 grises
  azulados (slate) a zinc. En Tailwind, `slate` quedó con los valores de zinc: todas las pantallas
  cambian a la vez sin tocar clase por clase.
- **Tipografía IBM Plex Sans**, la misma de la tienda.
- **Menú lateral con íconos de línea** en vez de emojis. **Chips del encabezado neutros**: el color vive
  en un punto; el texto se tiñe solo cuando el aviso es urgente (ej. fichas críticas).
- Botones planos; el ícono de editar pasó a neutro; "Valorización de Inventario" con borde ámbar.
- El tema claro también se neutralizó (sus fondos eran azulados).

## Pruebas

- **Maqueta local nueva: `scripts/maqueta-pos.js`** (config `pos-maqueta` en `.claude/launch.json`).
  Sirve el frontend real y simula la API con 10 productos reales (3 con S/N), sin tocar Supabase ni
  producción. Cualquier PIN entra como admin.
- Probado en el navegador con la maqueta: sugerencias con foto; ↑/↓ mueve la vista previa; clic en la
  foto abre el visor sin agregar; cerrar el visor deja la lista; Esc cierra solo el visor; producto con
  S/N → ventana → serie + Enter; "+" en esa línea → "Agregar sin S/N" crea línea aparte; serie repetida
  rechazada; Esc cancela sin tocar el carrito; − de 3 a 2 y apagado en 1; escanear un producto con S/N
  por código de barras abre la ventana y sin serie suma a su línea; total y conteo cuadran; aviso de
  stock; Modo edición agrega sin serie; ventana de pago, Productos, Balance, Taller, Garantías, Página
  Web y tema claro revisados.
- Chequeos: funciones y ids duplicados vacíos, `node --check`, Tailwind recompilado.
- **No se probó:** la cámara real dentro de la ventana del S/N (llama a `abrirEscaner('snPromptInput')`;
  la cámara ahora va encima con `z-index: 260`), la pistola USB real (simulada tecleando + Enter), y
  pantallas de celular o tablet.

## Queda para iterar

- Siguen emojis dentro de botones de otros módulos (medios de pago, Finanzas, OT). En el menú, los chips
  y el POS ya no hay.
- `CLAUDE.md` dice que no hay navegador para probar: en la app de escritorio sí lo hay, con la maqueta.
