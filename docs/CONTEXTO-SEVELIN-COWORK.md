# Contexto de Sevelin — para proyectos de Claude Cowork

> Súbelo como archivo en CADA proyecto de Cowork. Es lo que hace que un asistente nuevo entienda el
> negocio sin que se lo expliques de nuevo. Actualízalo cuando algo grande cambie (una vez al mes basta).
> Última actualización: 16-09-2026.

## El negocio

- **Sevelin** — tienda de electrónica y servicio técnico en **Arica, Chile**. En marcha y vendiendo.
- **Dueño:** Alejandro. Trabaja con **Carlos** (hermano). No es programador ni contador.
- **Canales de venta reales, por peso:** Facebook Marketplace + WhatsApp + venta presencial. La tienda
  online (sevelin.cl) vende poco todavía.
- **Contacto:** WhatsApp +56935750828 · Instagram @sevelin.cl · www.sevelin.cl ·
  sevelin.contacto@gmail.com · garantía 6 meses por falla de fábrica.
- **Régimen tributario:** Pro Pyme General (14 D N°3), contabilidad completa. PPM 0,125%.

## Los dos sistemas

| | Qué es | Dónde vive |
|---|---|---|
| **POS** (`sevelin-pos-oficial`) | Caja, stock, finanzas, servicio técnico, garantías | sevelin-pos-oficial.vercel.app |
| **Tienda** (`sevelin-tienda`) | sevelin.cl, catálogo y checkout | sevelin.cl |

Cada uno con su propia base de datos en Supabase. El POS manda el catálogo a la tienda; la tienda
manda los pedidos al POS.

## Las tablas que más se consultan (base del POS, solo lectura)

- `ventas` — `estado='PAGADA'` son las cobradas. `tipo_dte`: BOLETA / FACTURA / SIN DTE.
- `venta_items` — el detalle. `es_servicio = true` cuando la línea es mano de obra.
- `productos` — catálogo. `es_servicio`, `stock_ilimitado`, `por_llegar`, `publicado_web`.
- `compras` — los gastos. `afecta_saldo=false` = ya estaba descontado, no mueve el saldo.
- `gastos_fijos` — arriendo, sueldos y créditos, con su día de pago.
- `sii_rcv_resumen` / `sii_rcv_documentos` — el Registro de Compras y Ventas que trae el robot del
  SII cada mañana. `periodo` en formato AAAAMM.
- `iva_remanentes` — código 77 del F29 por mes (formato AAAA-MM).
- `f29_presentaciones` — qué meses del F29 ya se presentaron.
- `sii_sync` — cuándo corrió el robot del SII y si falló.
- `envios` — quién llevó cada pedido (InDrive / el padre / otro), costo, km y sector.

**Fórmula del IVA del mes:** crédito (IVA de compras en estado REGISTRO; las notas de crédito, tipo
61, restan) + remanente del mes anterior − débito (IVA de ventas REGISTRO).

## Cómo está la plata (revisar contra la base antes de afirmar nada)

- **Gastos fijos: $1.109.873 al mes.** Arriendo $400.000 y luz/internet el día 1; **sueldos el día 15**
  ($100.000 cada uno); crédito BancoEstado $293.584 el día 10; crédito BCI $179.289 el día 20.
- El negocio **está en el punto de equilibrio**, no sobra plata. Agosto 2026 dejó ~$433.000 sobre los
  gastos fijos; septiembre venía más flojo.
- **La caja es el cuello**, no las ventas. Cualquier recomendación que exija plata por adelantado
  (publicidad, suscripciones, stock nuevo) parte en contra.

## Reglas al trabajar para Sevelin

1. **Nunca inventes un número.** Si no está en los datos, dilo. Nada de estimaciones disfrazadas de
   dato real.
2. **Di siempre de cuándo son los datos** (período, y cuándo sincronizó el robot).
3. **Español simple.** El dueño no es técnico: nada de jerga sin explicar.
4. **Montos en pesos chilenos** con punto de miles: $1.234.567.
5. **No eres asesor tributario ni contador.** Para decisiones grandes, sugiere validar con un contador
   o con el Centro de Negocios Sercotec de Arica (gratis).
6. **Nada se publica ni se envía a un cliente sin que el dueño lo apruebe.**
7. **Solo lectura** en la base: si algo hay que cambiar, dilo y que se haga desde Claude Code.
8. **Los precios ya incluyen IVA.** El margen que importa es contra el costo real, no contra el precio.

## Pendientes conocidos (no proponerlos como si fueran nuevos)

- **F29 de agosto 2026**: presentarlo y marcarlo en el POS (botón 🧾 del encabezado).
- **19 productos con costo en $0** y stock dormido: sin costo real no hay decisión de precio.
- **Instagram con 0 publicaciones**; la Página de Facebook tiene pocos seguidores.
- **Ventas "SIN DTE"**: el dueño no puede emitir algunos documentos hasta acreditar actividades en el
  SII. Nunca construir planes que dependan de mantener ventas fuera del SII.
