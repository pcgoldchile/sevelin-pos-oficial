# v89 — La factura que el proveedor todavía no manda

**Fecha:** 24-09-2026
**Migración:** `sql/65-factura-pendiente.sql` (aplicada en producción el 24-09-2026)
**Pedido del dueño:** *"Poner una opción para que salga en alguna notificación si la factura aún no
está disponible o aún no llega, para estar alerta y meterle presión al proveedor."*

---

## La decisión de diseño que define todo

**No se usó "referencia vacía" como señal, y es a propósito.**

Las 8 entradas de mercadería registradas hasta hoy tienen el campo `N° de factura / guía` **vacío**.
Si "sin número" disparara el aviso solo, el POS estaría gritando por las 8 desde el primer día —
incluidas las compras donde ni siquiera pidió factura. Un aviso que suena siempre se aprende a
ignorar en una semana, y entonces no sirve para lo que se pidió.

La marca es él diciendo **"esta sí la estoy esperando"**. Mismo criterio que `devolucion_hasta` en
ese formulario: dejarla vacía significa "no aplica", que es distinto de "se venció".

**Se apaga sola.** Al escribir el N° de factura, la marca se desactiva — en pantalla y en el backend.
No se puede estar esperando un número que ya está escrito, y no hay que acordarse de desmarcar nada.

---

## Qué se construyó

### `sql/65` — dos columnas en `ingresos_mercaderia`

| Columna | Para qué |
|---|---|
| `factura_pendiente` | La marca explícita. Índice parcial solo sobre las pendientes. |
| `factura_esperada_para` | La fecha que el proveedor prometió, **opcional**. |

RLS: `ingresos_mercaderia` ya la tenía habilitada desde `sql/56`, no se tocó (verificado).

### En el formulario "📥 Compras de este producto"

Una casilla `🧾 La factura todavía no llega — avísame para perseguirla`, y al marcarla aparece la
fecha prometida. Escribir el N° de factura apaga la casilla en el acto.

### El aviso del header

Chip `🧾` al lado de los otros, solo para admin y solo si hay algo pendiente.

- **Ámbar** mientras se espera.
- **Rojo con pulso** solo cuando se pasó de la fecha que el proveedor **mismo prometió**. Esperar sin
  fecha comprometida no es un atraso, es esperar — la misma distinción que usa "mercadería en camino".

El modal lista producto, proveedor, monto, días esperando y el atraso, ordenado por **el que lleva más
tiempo esperando primero**: esa es la más difícil de cobrar.

### "Ya llegó" — el número es opcional a propósito

No toda factura prometida termina existiendo. Obligarlo a inventar un número para sacar la compra del
aviso haría que no la saque nunca, y el aviso dejaría de servir. Con número, se guarda; sin número,
igual sale.

### Endpoints (ambos solo admin)

`GET /api/productos/facturas-pendientes` · `PUT /api/ingresos/:id/factura`

---

## Por qué esto no es solo orden

La factura es **crédito fiscal IVA**. El dueño está en Pro Pyme 14D con remanente: una factura que
nunca llegó es plata que se paga de más en el F29, no un papel que falta.

**Con una advertencia importante que se verificó en el código:** este formulario **NO crea el gasto**
en `compras` — 0 de 8 entradas tienen `compra_id`. El gasto y su IVA se registran aparte en
**Finanzas → Gastos**. El aviso sirve para perseguir el documento; cargarlo al F29 sigue siendo un
paso manual. Está dicho en el modal para que no se confunda.

---

## Pruebas

**44 comprobaciones, 0 fallas** (24 de backend con doble de Supabase + 20 de interfaz en jsdom).

Las que importan:

- Una compra **sin marcar** no entra al aviso aunque no tenga N° de factura.
- Si el N° viene escrito, la marca se apaga sola.
- Sin fecha prometida no hay atraso (`dias_atraso === null`), y no cuenta como atrasada.
- Con fecha vencida, cuenta los días correctos contra esa fecha.
- Escribir el N° en el formulario apaga la casilla en pantalla.
- El nombre del producto se escapa (XSS).
- El trabajador no puede ver ni marcar facturas.

Además: `node --check` en los 4 archivos tocados, los dos chequeos de colisión vacíos, y Tailwind sin
cambios (el chip usa CSS propio en `css/styles.css`, no utilidades nuevas).

**No verificado:** nada en navegador real ni en producción. Sin commit ni deploy.

---

## Anotado, no hecho

- **Vincular la entrada de mercadería con su gasto en `compras`.** Hoy son dos mundos separados. Si
  algún día se unen, el aviso podría además decir "esta compra no tiene gasto registrado", que es el
  otro agujero por donde se pierde IVA crédito.
- **Plazo por proveedor.** `proveedores_plazos` (sql/60) ya existe para las devoluciones; podría
  sugerir también cuántos días suele demorar cada proveedor en mandar la factura.
