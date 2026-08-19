# CHANGELOG V14 — 18 de agosto de 2026

> Depende de `docs/README.md` (documento maestro). Aquí va **solo** lo que cambió en la v14.

Completa los **puntos 3 y 5 del INSTRUCCIONES.md**. Con esto, **todo el INSTRUCCIONES.md queda
terminado** (puntos 1-5).

---

## 1. Bug corregido: colisión de `confirmarEntrega` (punto 3)

El flujo de despacho/entrega ya estaba implementado en `js/pago.js`, pero **no funcionaba**: la
función `confirmarEntrega()` de la entrega de ventas colisionaba con otra `confirmarEntrega()` de
`js/ot.js` (entrega de órdenes de trabajo). Como `ot.js` carga después, su versión pisaba a la de
pago, y la promesa del modal de entrega nunca resolvía — el cobro se colgaba tras elegir el DTE.

**Solución:** las funciones de entrega de venta se renombraron a `confirmarEntregaVenta` y
`cancelarEntregaVenta`. La entrega de OT queda intacta.

> Este bug se coló porque el chequeo anti-colisión anterior (`^(async )?function`) no capturaba las
> funciones con indentación. Se adoptó un patrón más robusto: `^\s*(async\s+)?function\s+`. **Úsalo de
> ahora en adelante** (ver README maestro).

## 2. Despacho / entrega en la venta (punto 3, ya verificado)

Tras elegir el DTE, el cobro pide el tipo de entrega:

- **Retiro en tienda** (por defecto) o **Envío / Despacho**.
- Con despacho: campos de **dirección** y **notas** (ej. "dejar en conserjería").
- **Origen del pago:** presencial, transferencia o **pago web**. Con pago web aparece el campo de
  **comisión de pasarela**, con cálculo automático de 2.9% + IVA sobre el total.
- El backend normaliza: retiro → `estado_envio` 'entregado'; despacho → 'pendiente'.

## 3. Orden, filtro y gestión de envíos en el Historial (punto 5)

- **Orden por fecha:** selector "más reciente / más antigua primero" (ASC/DESC).
- **Filtro por estado de envío:** todos / pendiente / preparación / enviado / entregado.
- **Columna Envío** en la tabla: retiro muestra 🏪; despacho muestra un badge del estado, clickeable,
  que abre un modal para **cambiar el estado** y registrar el **número de seguimiento** (Starken /
  Chilexpress). Usa el endpoint `PUT /api/ventas/:id/envio` (backend de la v12).

## 4. Pruebas

- Punto 3: 16 comprobaciones (retiro, despacho con dirección/notas, comisión de pasarela automática,
  cancelar, y que la entrega de OT sigue existiendo aparte).
- Punto 5: 11 comprobaciones (orden ASC/DESC, filtro de envío, celda de envío, edición de estado y
  seguimiento).
- Sin colisiones de funciones (chequeo mejorado). Sin ids duplicados nuevos. Tailwind recompilado.

## 5. Estado del INSTRUCCIONES.md — COMPLETO

| Punto | Estado |
|---|---|
| 1 · Ventas Por Pagar | ✅ (ya existía) |
| 2 · Escáner captura manual + foto | ✅ v12 |
| 3 · Despacho / entrega | ✅ v14 (bug de colisión corregido) |
| 4 · Apertura / caja chica / arqueo | ✅ v13 |
| 5 · Orden, filtro y envíos en historial | ✅ v14 |

## 6. Despliegue

Requiere `sql/17` corrida (v12). Frontend: `index.html`, `js/pago.js`, `js/historial.js`,
`css/styles.css` (Tailwind recompilado).

Prueba: cobra una venta y elige "Envío" con dirección; en el Historial, filtra por "Pendiente",
ordena por más antigua, y cambia el estado de un envío a "Enviado" con un número de seguimiento.
