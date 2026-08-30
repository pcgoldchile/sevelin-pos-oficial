# CHANGELOG v40 — Submódulo Utilidades, IVA crédito fiscal y proyección de caja

**Fecha:** 29-08-2026 · **Migración SQL:** `sql/27-utilidades-iva-credito.sql` (**ya aplicada** en la
base real vía `npx supabase db query --file sql/27-utilidades-iva-credito.sql --linked`).

---

## 1. Qué se construyó y por qué

El Balance responde *"cómo está la caja"*. Faltaba responder *"cuánto gané de verdad"*, que es una
pregunta distinta: en la primera el IVA y las comisiones son dinero que pasó por la caja, en la
segunda son plata que **no es del negocio**. Mezclarlas era lo que hacía imposible entregarle algo
legible a un contador.

Por eso Utilidades es una sub-pestaña aparte y no un KPI más dentro de Balance: **`utilidadNeta` de
`/api/balance` no cambió de significado**, para no romper los KPI que ya existían.

## 2. Decisiones contables (tomadas con el usuario, no asumidas)

### 2.1 IVA neto, no solo débito
Se descuenta el **IVA a pagar real = débito − crédito fiscal**, no el 19% de las ventas a secas.
Para eso `compras` ganó dos columnas (`tiene_factura`, `iva_credito`), porque antes no había forma
de saber qué gasto daba derecho a crédito.

Detalle que importa: **los precios del sistema son BRUTOS**. El IVA contenido es
`total − total/1,19`, **no** `total × 0,19` (eso da de más). El botón "Calcular 19%" del modal de
gastos usa la fórmula correcta.

El IVA crédito se guarda **en pesos y no se deriva del monto**: no toda factura trae 19% exacto
(exentos, notas de crédito, montos ya netos). Un `CHECK` en la base impide que supere al costo total.

### 2.2 Remanente de crédito fiscal
Cuando el crédito supera al débito no hay devolución: queda **remanente** que rebaja el IVA de los
meses siguientes. `calcularRemanenteIva()` lo reconstruye mes a mes al estilo F29:

```
disponible = remanente anterior + crédito del mes + ajustes del mes
si débito > disponible → se paga la diferencia y el remanente queda en 0
si no                  → remanente = disponible − débito
```

**No se guarda ningún saldo**: se recalcula siempre desde el histórico, así que no puede quedar
desincronizado (mismo criterio que los saldos por canal). La tabla `iva_ajustes` guarda **deltas con
motivo obligatorio**, nunca saldos absolutos — sirve para cargar el remanente que venía de antes del
sistema y para cuadrar contra el F29 real.

### 2.3 Ventas sin DTE: su IVA es utilidad
Decisión explícita del dueño: el IVA contenido en las ventas sin documento **se registra como
utilidad**. Se expone siempre como cifra aparte (`ivaRetenidoSinDte`), tanto en pantalla como en el
Excel y el PDF, con esta advertencia en los tres lugares:

> Es una vista de **gestión**, no una declaración de impuestos: ante el SII una venta sin documento
> igualmente genera débito fiscal.

También se agregó `iva` (informativo) a la respuesta de `/api/balance`, a pedido del usuario.

### 2.4 Gastos fijos: una sola casilla, con desglose
**Un gasto fijo pagado ya se guarda como una compra normal** (con `gasto_fijo_id`). Una casilla
aparte de "descontar gastos fijos" los habría restado **dos veces**. La solución elegida: una sola
casilla "Gastos" que descuenta el total operativo una vez, y un desglose fijos/variables que
**reparte** ese mismo total en dos partidas excluyentes, sin sumarlo.

### 2.5 La compra de mercadería NO se descuenta
El grupo `INVENTARIO` se informa aparte pero no resta: ya está descontado como costo de lo vendido
vía FIFO. Restarlo otra vez mostraría pérdidas cada vez que se repone stock. (Misma regla que ya
aplicaba `/api/balance`.)

## 3. Backend (`api/index.js`)

| Endpoint | Qué hace |
|---|---|
| `GET /api/finanzas/utilidades` | El informe por capas + detalle línea por línea para exportar |
| `GET /api/finanzas/iva-remanente` | Remanente recalculado mes a mes + historial de ajustes |
| `POST /api/finanzas/iva-ajuste` | Ajuste manual del remanente (delta + motivo ≥5 caracteres) |
| `DELETE /api/finanzas/iva-ajuste/:id` | Borra un ajuste (`exigirPinAdmin`) |
| `GET /api/finanzas/proyeccion` | Escenarios de flujo de caja por percentiles |
| `DELETE /api/finanzas/balance` | Borrado contable por período (`exigirPinAdmin`) |

**El informe manda todas las capas por separado** y el frontend arma la utilidad final según las
casillas: marcar/desmarcar no vuelve a consultar el servidor, pero los montos siguen viniendo solo
de ahí.

### 3.1 Proyección: por qué percentiles y no promedios
Se toma la serie **diaria** real (los días cerrados o sin ventas cuentan como **$0** — si no, se
proyecta "vendo $50.000 diarios" cuando en realidad es "los días que abro"). Un solo día
excepcional levanta el promedio y hace planificar con plata que normalmente no llega.

Cada escenario combina **dos percentiles opuestos**, no uno:

| Escenario | Ventas | Gastos |
|---|---|---|
| Conservador | p25 (bajas) | p75 (altos) |
| Probable | p50 | p50 |
| Excelente | p75 (altas) | p25 (bajos) |

Ser conservador es esperar poco ingreso **y** bastante gasto. Usar el p25 para los dos lados —como
estaba en el primer borrador— asumía que también gastas poco, justo lo contrario. Además así la
tarjeta cuadra: `neto = ingreso − gasto`, en vez de venir de una tercera distribución que no suma
con las dos líneas que se muestran.

Cada tarjeta cierra con **"podrías gastar hasta"** = saldo actual + proyección − resguardo mínimo.

### 3.2 Borrado por período
Destructivo y sin respaldo, así que acumula frenos: rol admin, **PIN verificado en el servidor**,
rango de fechas **obligatorio** (no existe un "borrar todo" sin fechas), lista explícita de qué
borrar, y en la interfaz hay que **escribir "BORRAR"** (un "¿estás seguro?" se acepta por reflejo).

Las ventas se borran con `revertirEfectosDeVentas()`, que **repone el stock** igual que el borrado
individual — si no, el inventario quedaría descuadrado para siempre.

## 4. Frontend

- **`js/utilidades.js`** (nuevo): panel, casillas, cascada, IVA, proyección, borrado y exportación.
- **`index.html`**: sub-pestaña 💎 Utilidades + atajo en el sidebar (queda protegido por el gate de
  PIN sin tocar nada: el interceptor delegado ya cubre cualquier `data-view="view-finanzas"`),
  modales `modalAjusteIva` y `modalBorrarPeriodo`, y los campos de factura/IVA en el modal de gastos.
- **`css/styles.css`**: bloque nuevo al final, con los tokens cian/magenta de la marca.
- **`js/compras.js`**: guarda y edita `tiene_factura` / `iva_credito`; el campo aparece solo si hay
  factura marcada.
- **`js/balance.js`**: `mostrarPanelFinanzas()` recarga Utilidades al entrar (igual que Balance).

### Exportación
- **Excel** (4 hojas): Resumen (estado de resultados legible, con las notas metodológicas), Ventas,
  Gastos, IVA mes a mes. Anchos de columna y formato de peso chileno aplicados
  (`"$"#,##0;[Red]-"$"#,##0`). *SheetJS community no permite colores ni bordes* — el "diseño" del
  Excel es estructura, anchos y formato numérico, no color.
- **PDF**: encabezado de marca, 3 tarjetas (vendido / bruta / del período), el estado de resultados
  como cascada con las filas de resultado resaltadas y las capas no descontadas atenuadas, desglose
  de IVA y de gastos, notas metodológicas y pie con numeración de páginas.

## 5. Cómo se probó

- **36 pruebas de backend** contra un doble en memoria de Supabase (arnés temporal, no versionado):
  IVA contenido vs. `× 0,19`, ventas sin DTE fuera del débito, crédito solo de compras con factura,
  IVA a pagar nunca negativo, remanente arrastrándose entre meses, fijos/variables sin doble conteo,
  inventario excluido, orden de los escenarios, y las 4 validaciones del borrado. **36 OK, 0 fallas.**
- **Verificación real en el navegador** contra un servidor de desarrollo con datos de prueba: el
  gate de PIN intercepta el atajo nuevo del sidebar; la cascada cuadra
  (1.012.928 − 9.756 − 59.379 − 629.000 = 314.793); desmarcar IVA sube la utilidad exactamente en el
  monto del IVA y tacha la fila; la proyección devuelve los 3 escenarios; el modal de borrado bloquea
  las 3 vías de error; el botón de IVA calcula $19.000 sobre $119.000 (contenido, no 22.610); Excel y
  PDF se generan (4 hojas / 2 páginas).
- **Los 3 chequeos obligatorios** del proyecto: sin colisiones de funciones globales, sin `id`
  duplicados, Tailwind recompilado.

**No verificado:** el diseño del PDF no se pudo revisar visualmente (no hay rasterizador de PDF en
el entorno); se validó su estructura de forma programática y se le entregaron los archivos al
usuario para que los revise.

## 6. Trampas nuevas descubiertas

- **`ajustes_saldo` no tiene columna `fecha`, solo `creado_en`** (ver `sql/16`). Filtrar por `fecha`
  ahí devuelve error, no cero filas. El borrado por período declara la columna correcta por tabla.
- **El resguardo de caja es `config_finanzas.resguardo_caja`**, no `resguardo_minimo`, y la fila de
  configuración es siempre `id = 1`.
