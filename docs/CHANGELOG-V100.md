# v100 — Precio de oferta web con fecha de inicio y fin

**Fecha:** 29-09-2026
**Migraciones:** `sql/71-precio-oferta-web.sql` (POS) y `supabase/37-precio-oferta.sql` (tienda), las dos
aplicadas con la CLI el 29-09-2026 y verificadas (columnas + CHECK). No crean tablas.
**Pedido del dueño:** preparar la tienda para el Cyber del lunes 05-10-2026. La tienda no sabía mostrar
ofertas: cada producto tenía un solo precio, y la etiqueta "OFERTA" (sql/28) es solo un letrero.

---

## 1. Cómo se usa (POS → Producto → Tienda web)

"🏷️ Oferta web": **precio de oferta**, **Desde** y **Hasta** (hora de Chile). Debajo, un resumen en vivo
(`✅ $5.990 en vez de $7.000 (−14%) · desde lun 5 oct 00:00 hasta lun 5 oct 23:59`) o el error antes de
guardar. Vacío = sin oferta.

- **Empieza y termina sola** a esas horas. No hay que acordarse de apagarla.
- **Solo en sevelin.cl.** En el local se cobra el precio normal.
- El "antes" que ve el cliente es el precio web normal (`precio_web`, o el precio del POS si no hay uno
  web): el que se cobra hoy. Nunca uno inventado.

## 2. Reglas (servidor: `validarOfertaWeb`)

Menor que el precio normal web · con inicio y fin · fin después del inicio · que no haya terminado ya ·
no en productos "precio a consultar". Sin precio de oferta se borran las fechas (el CHECK de la base
exige los tres o ninguno). Al editar, lo que no viene en el body se completa con lo guardado, y si no se
tocó la oferta no se valida.

## 3. La tienda (ver su `docs/SNAPSHOT.md`, 29-09-2026)

- La oferta se aplica al LEER el producto (`lib/oferta.ts`), en todas las lecturas: cobra el checkout,
  correos, cotización y carrito sin tocarlos uno por uno.
- El carrito guardado en el navegador se pone al día contra el servidor, y el checkout se **detiene**
  (409) si el precio cambió respecto de lo que el cliente vio. Nunca se cobra otro monto.
- Tachado, −%, badge OFERTA automático y "Oferta válida hasta el…".

## 4. Feed de Google y Meta

`sale_price` + `sale_price_effective_date` (ISO "inicio/fin"). Las plataformas aplican la oferta solo
dentro del rango: una oferta cargada con anticipación aparece y desaparece a su hora aunque el feed se
lea una vez al día. `price` sigue siendo el normal (el tachado). Sin oferta o ya terminada, vacíos.

## 5. Orden de despliegue (importa)

Migración de la tienda → código de la tienda → migración del POS → código del POS. El feed del POS lee
las columnas nuevas de la tienda: sin la migración 37 el feed fallaría.

## 6. Cómo se probó

- **POS (doble de Supabase):** 11 casos de validación (crear y editar) y 6 del feed (vigente, futura,
  terminada, sin oferta).
- **Tienda:** 10 casos de la lógica (bordes de inicio y fin, oferta más cara, precio a consultar); en
  local con una oferta forzada solo en la prueba (parche quitado antes del commit): ficha, tarjeta en
  celular, carrito que se corrigió solo, y el checkout devolviendo 409 sin crear pedido.
- **Maqueta del POS:** el resumen en vivo, errores y la conversión de hora (23:59 de Chile = 02:59 UTC).
- **Producción:** con cero ofertas cargadas, la tienda sigue igual ($7.000 sin tachado).
- **No probado de punta a punta en producción:** cargar una oferta real en el POS y verla en la tienda.
  Se hace con la primera oferta real.
