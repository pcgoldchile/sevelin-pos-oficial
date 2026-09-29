# v99 — Avisos: facturas por aceptar en el SII y gastos fijos por pagar

**Fecha:** 28-09-2026
**Migración:** ninguna. Usa lo que ya existía: el robot del RCV (sql/51, v64) y el checklist de gastos
fijos del mes (`/api/finanzas/gastos-fijos-mes`).
**Pedido del dueño:** *"Notificación de aceptar gastos fijos, aceptar facturas pendientes en el SII."*

---

## 1. Qué había

- El robot del RCV ya traía cada día las compras que el SII tiene **"por aceptar"** (estado
  `PENDIENTE`), y Finanzas → Utilidades ya las mostraba. Pero había que entrar a mirar. **Al
  28-09-2026 había 3 (septiembre, IVA $124.297)**, con la última sincronización del robot ese mismo día.
- Finanzas → Gastos Fijos ya sabía cuáles del mes estaban pagados y cuáles no, pero tampoco avisaba.

## 2. Qué se agregó (dos chips en el encabezado, solo admin, ocultos si no hay nada)

- **"N por aceptar en el SII"** (ámbar). Abre la lista (proveedor, folio, fecha, total, IVA), cuánto
  IVA todavía no suma crédito, de cuándo son los datos del robot y un enlace al RCV del SII. Recuerda
  que el SII las acepta solas a los 8 días de recibidas, y que **reclamar una que no corresponde solo
  se puede dentro de ese plazo**.
  - **Siempre ámbar, nunca rojo:** el robot no trae la fecha de recepción en el SII, así que no se
    puede calcular cuántos días quedan. Un rojo inventado enseña a ignorar el aviso.
  - Las notas de crédito (61) restan, igual que en el resto del cálculo de IVA.
  - Se apaga cuando el robot, en su pasada diaria, ve la factura aceptada.
- **"N gasto(s) fijo(s) vencido(s) / por pagar"**: los gastos fijos activos del mes **sin pago
  registrado** que ya vencieron (**rojo**) o vencen en los próximos 3 días (ámbar). Un "día 31" vence
  el último día del mes. "Ir a Gastos Fijos" entra por el menú, **así pasa por la clave de Finanzas**
  como siempre. Se apaga al registrar el pago ahí (mismo criterio de "pagado" que el checklist).

Se consultan al iniciar sesión y cada 30 minutos. Endpoint nuevo: `GET /api/finanzas/sii/por-aceptar`
(solo admin). El de gastos fijos ya existía.

## 3. Cómo se probó

- **Backend (doble de Supabase):** trabajador → 403; solo cuenta las compras PENDIENTE (no las
  registradas ni las ventas); IVA con la nota de crédito restando; ordenadas por fecha; la última
  sincronización es la última OK, no una fallida.
- **Maqueta (admin), con datos inventados:** los dos chips aparecen, el de gastos fijos en rojo porque
  hay uno vencido, el pagado no sale, y las listas se ven.
- **Base real:** solo lectura, para confirmar que hoy hay 3 facturas por aceptar.
