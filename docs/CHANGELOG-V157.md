# v157 · Cotizador de reparaciones de celulares en el POS y en la app del taller (16-10-2026)

Migración `sql/102-reparaciones-precios.sql` (aplicada con la CLI el 16-10-2026, RLS activo) y 1.875 precios cargados.
Cambia `api/index.js`, `js/api.js`, `js/cotizador-celulares.js` (nuevo), `index.html`, `css/styles.css`, `taller/app.js`,
`scripts/maqueta-pos.js`, `scripts/maqueta-taller.js` y `scripts/cargar-precios-reparacion.py` (nuevo).
También cambió el precio "Desde" de dos fichas publicadas.

## Qué pidió el dueño
"Que tanto en el POS y la app del taller podamos cotizar y tener un precio estimado […] para tener una idea de cuánto
cobrar + la mano de obra." El 16-10: "sí, arma el cotizador tanto en el POS y la app del taller (nosotros hacemos
pantallas y puerto de carga; queremos integrar la parte de iPhone poco a poco)". Sobre la mano de obra: "siempre varía,
a veces mi papá cobra más barato según el cliente: déjamelo como mejor me recomiendes". Las fichas de la tienda, "como
mejor recomiendes al negocio". La lista de Multiphone es **con IVA incluido** (confirmado).

## Qué quedó
- **Tabla `reparaciones_precios`:** 1.875 precios de iPhone, Samsung, Motorola y Vivo, en 15 trabajos. Cada fila tiene
  equipo, trabajo, calidad, costo del repuesto (Multiphone, lista del 21-09-2026), mano de obra y precio estimado. El
  precio es repuesto + 15% + mano de obra, redondeado al millar. Sale de
  `docs/estudios-precios/2026-10-16-servicios-celulares-multiphone.csv`. Cuando llegue otra lista, se rehace el CSV con
  el `…-calculo.py` y se carga con `scripts/cargar-precios-reparacion.py`, que reemplaza las filas de Multiphone.
- **POS → Servicio Técnico → "📱 Cotizador celulares"** (sub-pestaña nueva):
  - buscador por modelo ("a05", "iphone 13", "g24") y filtro por marca;
  - filtro por trabajo, que arranca en **"Pantalla y puerto de carga"** y también ofrece "Todos los trabajos" o uno
    solo;
  - resultados agrupados por equipo, con las calidades lado a lado (incell, OLED, original);
  - el admin ve el repuesto y la mano de obra, y en iPhone sale el aviso **"🍏 iPhone: de a poco"**;
  - **"📋 Copiar para WhatsApp"** copia el texto listo para el cliente, con "aprox." y la advertencia de que el
    repuesto puede cambiar de precio.
- **App del taller → pestaña "Cotizar"** (entre Cobrados y Bodega): el mismo buscador, los botones "Pantalla y puerto" y
  "Todos los trabajos", y por equipo **"📋 Copiar"** y **"💬 WhatsApp"**, que abre WhatsApp con el texto. Nunca muestra
  el costo, ni siquiera al admin.
- **Servidor:** `GET /api/reparaciones/precios` (POS: el costo solo para el admin) y `GET /api/taller/cotizador` (sin
  costo). Busca por todas las palabras del modelo y muestra primero el modelo más corto ("iPhone 13" antes que
  "iPhone 13 Pro Max"). Ignora los comodines y trae como máximo 400 filas.

## Fichas publicadas (decisión delegada por el dueño)
| Ficha | Antes | Ahora | Por qué |
|---|---:|---:|---|
| Cambio de Pantalla para Celulares (Todas las Marcas), #275 | Desde $25.000 | **Desde $30.000** | El 90% de las pantallas de Samsung, Motorola y Vivo sale en $31.000 o más |
| Cambio de Puerto de Carga USB-C / Micro USB, #274 | Desde $10.000 | **Desde $18.000** | Lo normal es $19.000 a $20.000 con el repuesto |

El párrafo "Importante" de cada ficha ahora dice desde cuánto parte cada marca (iPhone 11 desde $35.000 en pantalla, y
iPhone desde $25.000 en puerto). La meta descripción también dice "Desde". Las dos siguen como "precio a consultar", sin
botón de agregar. Se verificó que `productos_web` de la tienda quedó con $30.000 y $18.000 y con el texto nuevo.

## Probado
- **Servidor real con el doble de Supabase:** 14 de 14.
  - Por defecto trae pantalla y puerto, y por orden: primero el modelo más corto y la más barata.
  - El admin ve el costo y el trabajador no. En el taller no lo ve nadie.
  - Varias palabras se cumplen todas, las inactivas no salen y sirve buscar solo por marca.
  - Sin modelo pide el modelo, los comodines se ignoran y sin sesión da 401.
- **Maqueta del POS** (con el CSV real): "a05" muestra A05 y A05s con la pantalla a $31.000 ($9.000 + $20.000).
  "iphone 13" muestra 4 equipos con el aviso de iPhone. El texto copiado nombra la calidad cuando hay varias.
- **Maqueta del taller** (servidor real): con C. Patricio (trabajador), la pestaña Cotizar funciona y "＋ Nuevo trabajo"
  se oculta ahí. Probados "g24", "Todos los trabajos" y Copiar. No hay costo en pantalla ni errores.
- **No probado:** el botón WhatsApp en un teléfono real.
- Hechos `node --check` en todo lo tocado, los chequeos de funciones, ids y variables globales. Sin Tailwind.
