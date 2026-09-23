# v85 — El buscador del Historial estaba en la pantalla equivocada

**Fecha:** 22-09-2026
**Migración:** ninguna
**Pedido por:** el dueño: *"acá en el historial de ventas aparte de buscar por fecha, falta buscar por
nombre del producto, o SN, o por medio de pago usado, etc."*

---

## El buscador existía y funcionaba. Estaba en otra pantalla.

Lo primero que hice fue buscar si había que construirlo. No había que construirlo: `GET /api/ventas?producto=`
ya buscaba por nombre, SKU, número de serie y código de barras, y `js/historial.js` tenía todo el
manejo del campo, las sugerencias en vivo, el resumen de "cuántas unidades y cuánta plata" y los chips
por fila.

El bloque HTML del buscador estaba **dentro de Servicio Técnico → Abonos y Encargos**
(`data-panel-taller="encargos"`), no dentro de Finanzas → Historial de Ventas.

Comprobado en el navegador, no leyendo la indentación:

```
buscador vive en : view-taller / panel "encargos"
campos de texto en el panel de Historial de Ventas: []
```

Invisible donde hace falta, inútil donde estaba. El arreglo fue mover el bloque a su panel —
el código JavaScript no se tocó, porque siempre estuvo bien.

---

## Lo que sí había que agregar: el medio de pago

Va como **desplegable y no como texto**, al lado del filtro de envíos que ya existía. El motivo es
práctico: son cinco valores cerrados, y escribir "tarjeta" nunca acertaría entre *Tarjeta Débito* y
*Tarjeta Crédito*. Filtra sobre lo ya cargado, sin volver a pedir nada al servidor.

Dos detalles que se ven poco y cambian el resultado:

- **Mira `metodo_pago_final` primero.** Una venta que nació "Por Pagar" y después se cobró en
  efectivo tiene el medio real ahí; filtrar solo por `metodo_pago` la dejaría fuera de "Efectivo" y
  la metería en "Por Pagar", que es justo al revés de lo que pasó.
- **Las mixtas tienen su propia opción.** No son "un" medio, así que no aparecen bajo ninguno de los
  cuatro: solo bajo *Pago mixto*.

Y cuando un medio no tiene ventas en el período, el mensaje lo dice ("No hay ventas con ese medio de
pago") en vez del genérico "No hay ventas en este período", que hacía dudar del filtro.

---

## Probado

- **21 comprobaciones en jsdom**: que el buscador esté en Finanzas y ya no en Servicio Técnico, que
  el selector traiga los medios reales del negocio, cada filtro por separado, que la venta cobrada
  después aparezca en "Efectivo", que la mixta no se cuele en los medios simples, que "Por Pagar"
  traiga la impaga y no la ya cobrada, el mensaje de vacío, y que se combine con el filtro de envíos
  sin pisarse.
- **Navegador real**: el campo quedó bajo el rango de fechas y el selector junto al de envíos.
- Chequeos del proyecto: `node --check`, funciones globales duplicadas, `const/let` globales
  duplicados e `id` duplicados — los cuatro vacíos.

### La trampa que se repitió

Probándolo a mano el filtro "no funcionaba": el navegador tenía `js/historial.js` **cacheado**. El
servidor entregaba la versión nueva y la página usaba la vieja. Ya había pasado con `balance.js` en
la v83. Por eso la prueba definitiva se hizo en **jsdom, que lee del disco** — y por eso conviene un
Ctrl+F5 al abrir el POS después de una actualización.
