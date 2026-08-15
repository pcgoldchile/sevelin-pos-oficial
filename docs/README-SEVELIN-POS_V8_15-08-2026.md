# Sevelin POS — Notas de la versión 8 (15 de agosto de 2026)

> Complemento de los README v5, v6 y v7. Cierra las prioridades de seguridad restantes de la
> auditoría (6, 7, 8) y documenta el estado del módulo de Finanzas por canales.

---

## Resumen honesto de esta entrega

Bruno pidió implementar un módulo financiero completo (canales de dinero, saldo en tiempo real,
traspasos, alertas de cobertura) y avanzar las prioridades de seguridad. Al revisar el código,
**la mayor parte de lo pedido ya estaba implementada** en el proyecto (migración 14, endpoints
`/finanzas/saldos`, `/finanzas/traspaso`, `/finanzas/config`, widget en `balance.js`, selector de
banco en compras e inyecciones). No se reimplementó nada de eso: reimplementar código que ya
funciona solo introduce bugs.

Lo que esta versión aporta de nuevo:

1. **Verificación con pruebas** de todo el módulo financiero que estaba sin probar.
2. **Prioridad 6 (CSP)** completada en el lado de la API.
3. **Prioridad 7 (auditoría de DTE)** completada con tabla de traza.
4. Confirmación de que **P8 y el resto de la Fase 2 ya estaban aplicados**.

---

## 1. Estado del módulo de Finanzas solicitado (ya implementado, ahora verificado)

Todo esto ya existía. Se verificó con una prueba integral (12 comprobaciones, todas en verde):

- **Reordenamiento de pestañas** — Historial de Ventas es la pestaña por defecto; orden
  Ventas → Balance → Gastos → Gastos Fijos. Ya estaba en el HTML y en `config.js`.
- **Canales de dinero** — el CANAL (Efectivo / Banco) se deriva del método de pago vía `esEfectivo()`.
  Compras e inyecciones guardan el nombre del banco (`banco TEXT`). Migración 14.
- **Widget de saldo en tiempo real** — `GET /api/finanzas/saldos` calcula efectivo, banco y total
  sobre toda la historia. Se refresca con el evento `pos:movimiento-dinero` tras cada venta/gasto.
  La aritmética se verificó al peso:
  - Efectivo = fondo arqueo + ventas efectivo + inyecciones efectivo + traspasos entrantes − gastos
    efectivo (sin mermas) − traspasos salientes.
  - Banco = ventas no-efectivo + inyecciones banco + traspasos entrantes − gastos banco − comisiones
    POS − traspasos salientes.
  - Las ventas PENDIENTE no cuentan; las mermas no descuentan dinero.
- **Traspaso interno** — `POST /api/finanzas/traspaso`, tabla `traspasos`. Validado: rechaza mismo
  origen/destino, monto ≤ 0 y canales inválidos. Un traspaso deja el total intacto y reparte entre
  canales (no es ingreso ni gasto).
- **Alerta de cobertura y resguardo** — `config_finanzas` guarda el resguardo mínimo y la ventana de
  días. El badge evalúa si el saldo cubre los próximos vencimientos de `gastos_fijos` y sugiere un
  traspaso si la plata está en el canal equivocado. Usa `escHtml` en los nombres (seguridad v7).

**Nada que hacer aquí salvo correr la migración 14 si no se ha corrido.**

---

## 2. Prioridad 6 · CSP en las respuestas de la API (NUEVO)

**El hueco.** La CSP de `vercel.json` cubre los archivos estáticos (el HTML del POS), pero las
respuestas de `/api/*` las genera Express, donde `helmet` iba con `contentSecurityPolicy: false`.
Esas respuestas salían sin ninguna política.

**El arreglo.** `helmet` ahora aplica una CSP estricta a la API: `default-src 'none'`,
`frame-ancestors 'none'`, `base-uri 'none'`, `form-action 'none'`. Es más cerrada que la del front a
propósito: una respuesta JSON de API nunca necesita cargar scripts, estilos ni fuentes.

Impacto bajo (la API devuelve JSON, no HTML ejecutable), pero cierra el hallazgo por defensa en
profundidad. Verificado: la API ahora envía la cabecera CSP y `X-Content-Type-Options: nosniff`.

---

## 3. Prioridad 7 · Auditoría del cambio de DTE (NUEVO)

**Estado previo.** El endpoint `/api/ventas/:id/dte` ya exigía admin (`auth(true)`) desde la v7,
pero un comentario reconocía que faltaba la traza de quién/cuándo/qué cambió.

**El arreglo.** Nueva tabla `auditoria_dte` (migración 15). El endpoint ahora lee el valor anterior
antes de actualizar y registra cada cambio (venta, tipo anterior, tipo nuevo, rol, timestamp). Es
solo-append. Si la tabla no existe (migración sin correr), el fallo no rompe el cambio de DTE: se
registra en consola y sigue.

Verificado: un trabajador recibe 403; el admin cambia el DTE (200) y la fila de auditoría queda con
`tipo_anterior` y `tipo_nuevo` correctos.

---

## 4. Prioridad 8 · CORS y PINs (ya estaba, confirmado)

Ya aplicado en una entrega previa, confirmado en esta:

- **CORS sin fallback a `*`** — si `CORS_ORIGINS` no está configurada, en producción se deniega por
  defecto. Un origen no permitido no se refleja (verificado con un Origin malicioso simulado).
- **PINs de fábrica rechazados** — el backend arranca con error si `ADMIN_PIN`/`WORKER_PIN` no están
  definidos o son los de ejemplo (`9067`/`0495`). Se vio en el arranque: *"FALTAN ADMIN_PIN o
  WORKER_PIN…"*.
- Cabeceras `X-Frame-Options: DENY` y `frame-ancestors 'none'` presentes (anti-clickjacking).

---

## 5. Estado del plan de auditoría tras esta entrega

| Prioridad | Estado |
|---|---|
| 1 · Rotar credenciales + RLS | ✅ Fase 1 (paneles) |
| 2 · RLS en todas las tablas | ✅ Fase 1 |
| 3 · Escapar XSS | ✅ v7 |
| 4 · Precio/stock negativo | ✅ v7 |
| 5 · Bucket privado + URLs firmadas | ✅ v7 (falta poner el bucket en privado, paso manual) |
| 6 · CSP | ✅ v8 (front en vercel.json + API en helmet) |
| 7 · DTE solo-admin + auditoría | ✅ v8 |
| 8 · CORS `*` y defaults de PIN | ✅ (entrega previa, confirmado) |
| — · BIZ-02 atómico (`FOR UPDATE`) | ⏳ pendiente, no bloqueante |
| — · Migrar a Supabase Auth | ⏳ backlog, proyecto grande |
| — · Unificar los 5 helpers de escape en `escHtml` | ⏳ limpieza |

La lista de prioridades de la auditoría está **cerrada**. Lo que queda son mejoras de robustez, no
hallazgos abiertos.

---

## 6. Orden de despliegue

1. **Corre las migraciones que falten, en orden:** `sql/13`, `sql/14`, `sql/15`. Todas idempotentes.
2. **Pon el bucket `compras-documentos` en privado** (paso manual pendiente de v7).
3. Despliega el backend (`api/index.js`), verifica `GET /api/health`.
4. Despliega el frontend (`css/tailwind.css` ya compilado).
5. Prueba en el equipo: entrar a Finanzas (debe abrir en Historial y mostrar el widget de saldos),
   hacer un traspaso, cambiar el tipo de DTE de una venta como admin (y confirmar que un trabajador
   no puede).

---

## 7. Pruebas de esta entrega

- Módulo financiero: 12 comprobaciones (saldos por canal, traspaso, config). Todas en verde.
- Seguridad P6/P7/P8: 8 comprobaciones (CSP en API, DTE admin + auditoría, CORS). Todas en verde.
- SQL 15 validado con el parser real de PostgreSQL (pglast).
- Chequeo anti-colisión de funciones globales: sin duplicados.
- Sin IDs huérfanos nuevos. Tailwind recompilado.
