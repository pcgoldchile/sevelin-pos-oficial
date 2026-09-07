# CHANGELOG v52 — Contacto del cliente en la venta (bloqueo B5)

**Fecha:** 07-09-2026 · **Rama:** `main` · **Plan:** `docs/PLAN-CRECIMIENTO-2026.md`, bloqueo B5.
**SQL:** `sql/37-contacto-cliente-venta.sql` (**aplicada** con la Supabase CLI, verificada).

---

## 1. El problema que resuelve

La auditoría de la Fase 1 (v51) encontró que **168 de 169 ventas no tienen cliente identificado**.
No es que el dato no exista: casi toda venta de Sevelin se coordina por WhatsApp antes de entregar,
así que el dueño **sí tiene el teléfono de cada cliente** — pero se queda en su celular y nunca entra
al sistema.

Sin ese dato son imposibles, no difíciles, sino imposibles:
- avisarle a alguien que su garantía está por vencer (el módulo Garantías sabe cuándo, pero no a quién);
- ofrecerle el accesorio que le falta a lo que ya compró;
- medir la recompra (hoy es incalculable);
- recuperar a quien no compra hace 90 días.

Es decir: **bloquea completos los objetivos 2 y 5 del plan de crecimiento.** Por eso se atacó primero,
antes que cualquier automatización de correo: no sirve de nada construir el envío si no hay a quién
enviarle.

---

## 2. Qué se agregó

### Base de datos — `sql/37-contacto-cliente-venta.sql`
- `ventas.cliente_telefono TEXT` y `ventas.cliente_correo TEXT`, ambos opcionales.
- Índice parcial sobre `cliente_telefono` (solo filas no nulas): "todas las compras de este cliente"
  es la consulta que habilita recompra, postventa y garantías.
- Se reutiliza el **mismo nombre de columna que ya usa `ordenes_trabajo`** (`cliente_telefono`) en vez
  de inventar una convención nueva.

### Backend
- `normalizarTelefonoChile()` — helper nuevo. Guarda el número como **solo dígitos con código de
  país** (`+56 9 8765 4321`, `987654321` y `56987654321` quedan los tres como `56987654321`).
  **Por qué normalizar y no guardar lo que se tecleó:** el objetivo del campo es *agrupar* las compras
  de una misma persona. Si el mismo cliente queda como `+569 8765 4321` en una venta y `987654321` en
  otra, para el sistema son dos clientes distintos y la métrica de recompra miente. Devuelve `null`
  ante algo que no puede ser un teléfono — mejor vacío que basura que después nadie limpia — y
  **nunca lanza ni bloquea**.
- `POST /api/ventas` acepta `cliente_telefono` y `cliente_correo`.
- `PUT /api/ventas/:id` también los acepta: **se pueden completar después de la venta a propósito**,
  porque el caso real es que el cliente da su WhatsApp al coordinar la entrega, cuando la venta ya
  quedó registrada.

### Frontend
- **POS → Carrito de venta**: campo nuevo "WhatsApp del cliente", a ancho completo bajo Cliente. El
  placeholder dice para qué sirve (`9 1234 5678 — para avisarle de su garantía`) en vez de ser un
  campo mudo. El de Cliente pasó de `Opcional / Particular` (que invita a saltárselo, y por algo 168
  de 169 ventas están vacías) a `Nombre de quien compra`.
- **Historial → Editar venta**: mismo campo, para rellenar ventas ya registradas.
- **Historial → Detalle de venta**: el teléfono aparece como **link directo a WhatsApp** (`wa.me`).
  Eso es lo que convierte el dato en algo útil: desde el historial se le puede escribir a quien
  compró. Como el número se guarda en puros dígitos, sirve tal cual en la URL.
- **Exportación del historial**: columna "WhatsApp".

### Panel Inteligencia (v51) — métricas nuevas
- Una venta cuenta como identificada si tiene **nombre o teléfono**.
- **La recompra se mide solo con el teléfono**, nunca con el nombre: el nombre es texto libre y
  "Juan" no se puede unir con "juan p.". El KPI muestra clientes únicos, cuántos volvieron y el % de
  recompra; mientras no haya teléfonos cargados dice qué falta en vez de mostrar un 0% engañoso.

---

## 3. Nada de esto bloquea una venta

Regla explícita, escrita en el SQL y en el código: **todos los campos son opcionales y el cobro
nunca se cae por ellos.** El POS atiende con el cliente esperando al otro lado del mostrador; un
teléfono mal escrito no puede impedir cobrar. Un número inválido se guarda como `null`, no como
error.

---

## 4. Cómo se probó

- **`normalizarTelefonoChile()`**: 12 casos, todos correctos — celular con y sin código de país, con
  espacios, guiones y paréntesis; fijo; entradas vacías, con letras, muy cortas y absurdamente
  largas.
- **De punta a punta contra producción**: `PUT /api/ventas/2` con `+56 9 8765 4321` → guardado como
  `56987654321`; el panel Inteligencia pasó a `conCliente 1 → 2`, `conTelefono 0 → 1`,
  `clientesUnicos 1`. **Revertido inmediatamente** (`cliente_telefono` de vuelta a `null`,
  confirmado), y verificado que el resto de la venta quedó intacto.
- **`enlaceWhatsappCliente()`**: sin teléfono devuelve string vacío; con celular arma el link y lo
  muestra formateado. **Prueba de inyección**: `"><script>alert(1)</script>` como teléfono queda en
  `wa.me/1` — el filtro de dígitos elimina cualquier marcado antes de que llegue al DOM.
- **Panel en jsdom** con el informe real: los 6 KPIs, 8 alertas, cambio de cajón, tablas completas,
  0 toasts de error y 0 `<script>` inyectados.
- `node --check` en los 4 archivos JS tocados; chequeos de colisión de funciones, de `const`/`let`
  globales y de `id` en `index.html`: **todos vacíos**.

---

## 5. Archivos tocados

| Archivo | Cambio |
|---|---|
| `sql/37-contacto-cliente-venta.sql` | **nuevo**, aplicado y verificado |
| `api/index.js` | `normalizarTelefonoChile()`; contacto en POST y PUT de ventas; métricas de recompra en `/api/pos/inteligencia` |
| `index.html` | campo en el POS, campo en el modal de editar venta, pie del KPI de clientes |
| `js/pos.js` | lee y envía el teléfono; lo limpia al terminar la venta |
| `js/historial.js` | `enlaceWhatsappCliente()`; campo en el modal de edición; columna en la exportación |
| `js/inteligencia.js` | pie del KPI de clientes con recompra real |

---

## 6. Lo que sigue

Esto habilita, pero no construye todavía, las automatizaciones de la Fase 4. El orden queda:

1. **Cargar teléfonos** — desde ahora en cada venta, y hacia atrás en las que el dueño recuerde.
   Sin datos, las automatizaciones no tienen a quién escribirle.
2. **Aviso de garantía por vencer** (mes 5 de 6) — es la automatización con más retorno y la que
   ningún competidor de Arica hace. Solo necesita teléfonos cargados; **no depende de Resend ni de
   Flow**, porque puede salir por WhatsApp manual desde una lista que arme el POS.
3. El resto de los correos, cuando el dominio de Resend esté verificado (bloqueo B2).
