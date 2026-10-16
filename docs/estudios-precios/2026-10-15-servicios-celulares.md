> **⚠️ 16-10-2026: los costos de este informe quedaron reemplazados** por los de la lista de Multiphone del 21-09, en
> `2026-10-16-servicios-celulares-multiphone.md`. El método, la mano de obra y los consejos siguen valiendo.

# Reparación de celulares: precios estimados y cómo cobrar (15-10-2026)

> **Propuesta. Nada está cargado ni publicado.** Hecha por Claude a pedido del dueño ("deja creados los cambios de
> pantalla y otros repuestos para iPhone, Samsung, Motorola y Vivo… un precio estimado + la mano de obra").
> Datos leídos el 15-10-2026. Los precios **son estimados**: el repuesto cambia de precio según la fecha.
> Archivos: este informe, `2026-10-15-servicios-celulares.csv` (las 282 filas, listas para cargar) y
> `2026-10-15-servicios-celulares-calculo.py` (cómo se calculó, para rehacerlo con otros costos).

## 1. Lo primero: el catálogo de Multiphone no trae repuestos

El PDF "CATÁLOGO DE HERRAMIENTAS MULTIPHONE 21.08.26" (57 páginas) es de **herramientas e insumos**: cargadores,
láminas de hidrogel, microscopios, estaciones de soldar, separadoras, destornilladores, pegamentos y cintas. **No tiene
ninguna pantalla, batería ni puerto de carga con precio.** En su web (multiphonechile.cl, 351 productos) pasa lo mismo:
pantallas y baterías (marca CVT-SRVI) se venden **solo por cotización** ("Cotizar Pantallas", "Cotizar Baterías").

Por eso los costos de esta propuesta salen de **LifeMax Store** (lifemaxstore.cl), una tienda chilena que publica
precio y stock de 1.307 repuestos de celular (535 pantallas, 281 baterías, 221 flex y pines de carga, 88 tapas, 37
vidrios de cámara), con IVA, leídos hoy. Cuando Multiphone te mande su lista de pantallas y baterías, se cambia el costo
y el precio se recalcula solo (ver sección 3).

## 2. La competencia

- **Arica: nadie publica precios.** Ni iBytesStore, ni InterCell, ni los locales de Mundo Chileno. Los precios de
  abajo comparan con Santiago, así que conviene una vuelta de "cliente incógnito": preguntar por WhatsApp a 3 locales
  de Arica cuánto cobran por la pantalla de un **iPhone 11** y de un **Samsung A05**. Con esos dos números se calibra todo.
- **Santiago, gama media:** My Phone Express (Providencia) publica precio por modelo, con repuesto incluido. Ejemplos:
  Samsung A05 $40.000, Moto G54 $50.000, Vivo Y21s $40.000, iPhone 11 incell $45.000, iPhone 13 OLED $120.000 y
  batería de iPhone 13 $71.990.
- **Santiago, gama alta:** ClinicCel (Providencia). Ejemplos: batería de iPhone 13 $75.000, pantalla OLED de iPhone 13
  $95.000, puerto de carga de iPhone 11 $45.000 y tapa trasera de iPhone 15 $90.000.
- **Servicio oficial Samsung:** pantalla del A05 a $58.990.
- **Tacna** le compite a cualquier técnico de Arica, pero no encontré precios publicados. No conviene pelear por precio
  con Tacna: conviene ganar con boleta, garantía escrita, local fijo y entrega en el día.

**Resultado con la fórmula de abajo** (comparado con el más barato de los dos de Santiago):
- **Android baratos (Samsung A, Moto G/E, Vivo Y):** lo normal es 20% más barato (va de 7% a 40%).
- **iPhone X al 11:** casi igual que Santiago (0% a 10% menos) en pantalla, y 20% a 44% menos en batería y puerto.
- **iPhone 12 en adelante:** entre 15% y 50% más barato. En baterías, casi la mitad.
- **Samsung S y Motorola Edge:** entre 13% y 60% más barato. Ojo: allá cotizan pantalla **original** y aquí es OLED
  compatible, así que no es la misma pantalla.
- **Quedan iguales o un poco más caros:** batería de iPhone 7 ($21.000 contra $20.000), pantalla de iPhone XR incell
  ($41.000 contra $40.000) y OLED del Samsung A20 ($59.000 contra $55.000; el incell sale $33.000).

Es un precio de Arica, no de Providencia, sin regalar la mano de obra.

## 3. Cómo se calcula el precio estimado

**Precio = (repuesto + 15%) + mano de obra, redondeado hacia arriba al millar.** Los servicios van en miles cerrados,
igual que hoy en el catálogo.

- **El 15% sobre el repuesto** cubre el flete hasta Arica y que el repuesto suba entre que cotizas y lo compras. Si el
  repuesto baja, la diferencia queda para ti.
- **La mano de obra va con IVA incluido**, fija por trabajo y por nivel de dificultad y riesgo:

| Trabajo | Nivel | Mano de obra |
|---|---|---:|
| Pantalla Android | Básica (LCD/Incell: Samsung A0x–A2x, Moto E/G, Vivo Y) | $20.000 |
| Pantalla Android | OLED (Samsung A, Moto G71/G84, Vivo V) | $25.000 |
| Pantalla Android | Alta (Samsung S/Note, Motorola Edge curva) | $35.000 |
| Pantalla iPhone | 7 al 11 (Incell o LCD) | $20.000 |
| Pantalla iPhone | X, XS, 11 Pro en OLED | $25.000 |
| Pantalla iPhone | 12 y 13 | $30.000 |
| Pantalla iPhone | 14 y 15 | $40.000 |
| Pantalla iPhone | 16 y 17 | $50.000 |
| Batería | Android, todos | $15.000 |
| Batería | iPhone 7, 8 y SE 2020 | $10.000 |
| Batería | iPhone X al 11 (y SE 2022) / 12–13 / 14–15 | $15.000 / $18.000 / $20.000 |
| Puerto de carga | Android (placa o flex de carga) | $15.000 |
| Puerto de carga | iPhone 7 al 11 / 12–13 | $20.000 / $25.000 |
| Tapa trasera | Android | $10.000 |
| Vidrio de cámara trasera | iPhone | $10.000 |

- **Columna "Queda (con IVA)":** precio menos repuesto. De ahí sale el IVA (ver consejo 6).
- **Repuesto con asterisco (\*):** LifeMax no tiene ese modelo. Uso el costo típico de la gama (batería Android $12.990,
  placa de carga $4.920). Hay que confirmarlo antes de dar el precio por firme.

## 4. Lo que NO conviene ofrecer todavía

- **Tapa trasera de vidrio de iPhone 8 al 13 y de iPhone 14 Pro y 14 Pro Max:** la tapa cuesta $3.000 a $9.000, pero
  sacarla sin máquina láser es arriesgado y lleva horas. **Sí se puede hacer en el iPhone 14, 14 Plus y en toda la
  serie 15 y 16**, porque Apple dejó la tapa removible con calor. Falta el costo de esa tapa: se cotiza.
- **Cambio solo del vidrio (glass) de pantallas OLED:** requiere separadora, OCA, laminadora y horno UV, y práctica.
  Es lo que más deja en Samsung S y iPhone OLED, pero es una fase 2.
- **Desbloqueo de cuenta Google o iCloud:** solo con boleta o caja del equipo a nombre del cliente. Sin prueba de que
  es suyo, es la puerta de entrada a recibir celulares robados.

## 5. Otros servicios que hay que tener en la lista (sin costo de repuesto publicado: se cotiza el repuesto)

| Servicio | Mano de obra propuesta | Nota |
|---|---:|---|
| Diagnóstico de celular | Gratis si se repara, $5.000 si no | Cubre el tiempo de desarmar |
| Cambio de parlante / auricular / micrófono | $15.000 + repuesto | Ya cargaron un ejemplo: Samsung A07 parlante $15.000 |
| Cambio de botón o flex de encendido / volumen | $20.000 + repuesto | |
| Cambio de cámara trasera o frontal | $20.000 + repuesto | En iPhone 13+ la cámara cambiada puede avisar "pieza desconocida" |
| Cambio de bandeja SIM | $5.000 + repuesto | |
| Limpieza por humedad (equipo mojado) | $20.000, **sin garantía** | Igual que la regla de notebooks |
| Instalación de mica de vidrio | Mica incluida | Multiphone: mica 550 micrones a $1.590 (mínimo 10) |
| Traspaso de datos y configuración de celular nuevo | $10.000 | |

## 6. Consejos para ganar plata con esto

1. **No tengas pantallas en stock.** Todo por encargo, con el repuesto pagado por adelantado (regla de encargos que ya
   tienes). Una pantalla que no se usa no se devuelve. Lo único que conviene tener: baterías y placas de carga de los
   5 Samsung A más comunes (cuestan $3.700 a $13.000) y la pantalla incell de iPhone 11. Después de un mes, se mira
   qué modelos preguntaron de verdad y se ajusta el stock.
2. **Ofrece siempre dos calidades.** Por ejemplo, iPhone 13: incell **$55.000** o OLED **$91.000**. Casi todos eligen la
   buena cuando ven las dos, y te quedan unos $5.000 más. Explica la diferencia sin vender humo: el incell es más
   grueso, gasta más batería y en Samsung con huella en la pantalla (A50, A51, A70, A71…) **la huella deja de funcionar**.
3. **Prueba y anota todo al recibir.** Táctil, Face ID o huella, cámaras, carga, audio, señal y botones, más una foto
   del equipo. Así nadie te puede culpar después de una falla que ya tenía.
4. **Avisa lo que pasa en iPhone antes de cobrar:** en iPhone 11 y posteriores aparece el aviso de "pieza desconocida"
   en Ajustes (funciona igual) y se pierde el True Tone, salvo que se traspase con un programador (JC V1SE, $334.000 en
   Multiphone; se compra cuando haya volumen). Las baterías "sin aviso" de LifeMax del 12 en adelante dicen evitar el
   mensaje: es lo que dice el proveedor y hay que probarlo con la primera.
5. **Garantía escrita de 3 meses en el repuesto,** que es lo que dan los demás en Chile (3 a 6 meses). No cubre golpes,
   humedad ni pantalla trizada.
6. **Compra los repuestos con factura.** En una pantalla OLED de iPhone 13 ($91.000 con repuesto de $52.500), con
   factura te quedan unos **$32.000**. Sin factura te quedan unos **$24.000**, porque pagas el IVA completo. Son $8.000
   por trabajo.
7. **Precios "desde" para atraer clientes,** en Google, Marketplace y estados de WhatsApp. Por ejemplo: "Pantalla Samsung,
   Motorola y Vivo desde $32.000", "Pantalla iPhone 11 $41.000", "Batería iPhone desde $21.000" y "Puerto de carga
   desde $20.000". Agrega **"en el día si hay repuesto"**: con eso le ganas al que manda a Santiago.
8. **Revisa el costo cada 45 días** o cuando llegue la lista de Multiphone. El sistema propuesto avisa solo cuando un
   precio está viejo.
9. **Pídele a Multiphone su lista de pantallas y baterías CVT-SRVI** (Antofagasta, +56 9 4447 8760). Están más cerca
   de Arica que Santiago, así que pueden ser más baratos o llegar más rápido. Con su lista se cambia el costo en un clic.
10. **Un negocio que sí sale del catálogo de Multiphone: las láminas de hidrogel.** La máquina NYBELPRO cuesta $352.000
    (oferta) y las láminas salen a $600 cada una (50 por $29.990). Si las vendes a $6.000 instaladas, la máquina se
    paga con unas 65 láminas. Conviene si la ofreces en cada venta y en cada reparación. Si no, no la compres.

## 7. Qué se construye cuando des el OK

1. **Base de datos (`sql/100`):** se amplía la tabla "Cotizaciones aproximadas", que hoy está vacía y fue hecha para
   esto. Se le agrega marca, calidad, mano de obra, de dónde salió el costo y su fecha, más una tablita con las tarifas
   de mano de obra. **Cambias un número de mano de obra y se recalculan todos los precios de ese trabajo.**
2. **Carga:** las 282 filas del CSV.
3. **POS → Servicio Técnico → Cotizaciones aproximadas:** filtros por marca y trabajo, las dos calidades lado a lado,
   la fecha del precio (en amarillo si tiene más de 45 días), el costo y la ganancia solo para el admin, y un botón
   **"Copiar para WhatsApp"** con el texto *"Cambio de pantalla iPhone 13 (OLED): $91.000 aprox. El repuesto puede
   variar de precio; te lo confirmo al encargarlo."*
4. **App del taller:** una pestaña **"Cotizar"**. Escribes el modelo y salen los trabajos con su precio y el botón de
   WhatsApp. Los técnicos no ven el costo.
5. **Tienda (solo si dices que sí):** la ficha publicada "Cambio de Pantalla para Celulares (Todas las Marcas)" hoy dice
   **$25.000 con repuesto incluido**, pero ningún modelo sale a ese precio (el más barato da $32.000). También el "Cambio
   de Puerto de Carga" a $10.000 queda bajo el costo si incluye la placa.

## 8. Fuentes (leídas el 15-10-2026)

- Catálogo de Multiphone (PDF del 21-08-2026) y https://www.multiphonechile.cl/products.json
- Costos: https://www.lifemaxstore.cl/products.json
- Santiago: https://myphonexpress.cl/collections/reparacion-samsung y https://cliniccel.cl/products.json
- Samsung oficial: https://www.samsung.com/cl/support/outofwarrantyservice/
- Tapa removible de iPhone 14/15: https://support.apple.com/en-ie/120014
- Arica sin precios publicados: https://ibytesstore.com/ y https://www.mundochileno.com/arica-y-parinacota/servicio+tecnico+de+celulares

## 9. Tablas completas

### iPhone · Cambio de pantalla

| Equipo | Calidad | Repuesto | Mano de obra | **Precio estimado** | Queda (con IVA) | Santiago |
|---|---|---:|---:|---:|---:|---|
| iPhone 7 | LCD | $11.250 | $20.000 | **$33.000** | $21.750 | — |
| iPhone 8 / SE 2020 / SE 2022 | LCD | $10.000 | $20.000 | **$32.000** | $22.000 | — |
| iPhone 8 Plus | LCD | $12.500 | $20.000 | **$35.000** | $22.500 | — |
| iPhone X | Incell | $18.750 | $20.000 | **$42.000** | $23.250 | MPX $45.000 |
| iPhone X | OLED | $32.500 | $25.000 | **$63.000** | $30.500 | MPX $65.000 · CC $65.000 |
| iPhone XR | Incell | $17.500 | $20.000 | **$41.000** | $23.500 | MPX $40.000 |
| iPhone XR | LCD calidad original | $20.000 | $20.000 | **$43.000** | $23.000 | MPX $50.000 · CC $45.000 |
| iPhone XS | Incell | $17.500 | $20.000 | **$41.000** | $23.500 | MPX $45.000 |
| iPhone XS | OLED | $36.250 | $25.000 | **$67.000** | $30.750 | MPX $65.000 · CC $75.000 |
| iPhone XS Max | Incell | $21.250 | $20.000 | **$45.000** | $23.750 | MPX $65.000 |
| iPhone XS Max | OLED | $42.500 | $25.000 | **$74.000** | $31.500 | MPX $90.000 · CC $85.000 |
| iPhone 11 | Incell | $17.500 | $20.000 | **$41.000** | $23.500 | MPX $45.000 |
| iPhone 11 | LCD calidad original | $20.000 | $20.000 | **$43.000** | $23.000 | MPX $50.000 · CC $55.000 |
| iPhone 11 Pro | Incell | $21.250 | $20.000 | **$45.000** | $23.750 | MPX $75.000 |
| iPhone 11 Pro | OLED | $36.250 | $25.000 | **$67.000** | $30.750 | MPX $95.000 · CC $85.000 |
| iPhone 11 Pro Max | Incell | $22.500 | $20.000 | **$46.000** | $23.500 | MPX $75.000 |
| iPhone 11 Pro Max | OLED | $47.500 | $25.000 | **$80.000** | $32.500 | MPX $95.000 · CC $85.000 |
| iPhone 12 / 12 Pro | Incell | $18.750 | $30.000 | **$52.000** | $33.250 | MPX $80.000 |
| iPhone 12 / 12 Pro | OLED | $43.750 | $30.000 | **$81.000** | $37.250 | MPX $95.000 · CC $95.000 |
| iPhone 12 mini | Incell | $23.750 | $30.000 | **$58.000** | $34.250 | MPX $85.000 |
| iPhone 12 mini | OLED | $67.500 | $30.000 | **$108.000** | $40.500 | MPX $110.000 · CC $110.000 |
| iPhone 12 Pro Max | Incell | $25.000 | $30.000 | **$59.000** | $34.000 | — |
| iPhone 12 Pro Max | OLED | $58.750 | $30.000 | **$98.000** | $39.250 | CC $150.000 |
| iPhone 13 | Incell | $21.250 | $30.000 | **$55.000** | $33.750 | MPX $85.000 |
| iPhone 13 | OLED | $52.500 | $30.000 | **$91.000** | $38.500 | MPX $120.000 · CC $95.000 |
| iPhone 13 mini | Incell | $22.500 | $30.000 | **$56.000** | $33.500 | MPX $95.000 |
| iPhone 13 mini | OLED | $71.250 | $30.000 | **$112.000** | $40.750 | MPX $130.000 |
| iPhone 13 Pro | Incell | $30.000 | $30.000 | **$65.000** | $35.000 | — |
| iPhone 13 Pro | OLED | $56.250 | $30.000 | **$95.000** | $38.750 | MPX $130.000 · CC $115.000 |
| iPhone 13 Pro Max | Incell | $27.500 | $30.000 | **$62.000** | $34.500 | — |
| iPhone 13 Pro Max | OLED | $61.250 | $30.000 | **$101.000** | $39.750 | MPX $150.000 · CC $145.000 |
| iPhone 14 | Incell | $28.750 | $40.000 | **$74.000** | $45.250 | — |
| iPhone 14 | OLED | $50.000 | $40.000 | **$98.000** | $48.000 | MPX $130.000 · CC $125.000 |
| iPhone 14 Plus | Incell | $30.000 | $40.000 | **$75.000** | $45.000 | — |
| iPhone 14 Plus | OLED | $72.500 | $40.000 | **$124.000** | $51.500 | CC $125.000 |
| iPhone 14 Pro | Incell | $33.750 | $40.000 | **$79.000** | $45.250 | — |
| iPhone 14 Pro | OLED | $68.750 | $40.000 | **$120.000** | $51.250 | MPX $240.000 · CC $140.000 |
| iPhone 14 Pro Max | Incell | $33.750 | $40.000 | **$79.000** | $45.250 | — |
| iPhone 14 Pro Max | OLED | $62.500 | $40.000 | **$112.000** | $49.500 | MPX $250.000 · CC $140.000 |
| iPhone 15 | Incell | $25.000 | $40.000 | **$69.000** | $44.000 | — |
| iPhone 15 | OLED | $58.750 | $40.000 | **$108.000** | $49.250 | MPX $200.000 · CC $165.000 |
| iPhone 15 Plus | Incell | $26.250 | $40.000 | **$71.000** | $44.750 | — |
| iPhone 15 Plus | OLED | $60.000 | $40.000 | **$109.000** | $49.000 | CC $170.000 |
| iPhone 15 Pro | Incell | $36.250 | $40.000 | **$82.000** | $45.750 | — |
| iPhone 15 Pro | OLED | $60.000 | $40.000 | **$109.000** | $49.000 | MPX $250.000 · CC $170.000 |
| iPhone 15 Pro Max | Incell | $27.500 | $40.000 | **$72.000** | $44.500 | — |
| iPhone 15 Pro Max | OLED | $65.000 | $40.000 | **$115.000** | $50.000 | MPX $260.000 · CC $170.000 |
| iPhone 16e | OLED | $55.000 | $50.000 | **$114.000** | $59.000 | — |
| iPhone 16 | OLED | $61.250 | $50.000 | **$121.000** | $59.750 | CC $170.000 |
| iPhone 16 Plus | OLED | $61.250 | $50.000 | **$121.000** | $59.750 | CC $190.000 |
| iPhone 16 Pro | OLED | $77.500 | $50.000 | **$140.000** | $62.500 | CC $190.000 |
| iPhone 16 Pro Max | OLED | $80.000 | $50.000 | **$142.000** | $62.000 | CC $190.000 |
| iPhone 17 Pro | OLED | $112.500 | $50.000 | **$180.000** | $67.500 | CC $260.000 |
| iPhone 17 Pro Max | OLED | $103.750 | $50.000 | **$170.000** | $66.250 | CC $260.000 |

### iPhone · Cambio de batería

| Equipo | Calidad | Repuesto | Mano de obra | **Precio estimado** | Queda (con IVA) | Santiago |
|---|---|---:|---:|---:|---:|---|
| iPhone 7 | Compatible | $8.750 | $10.000 | **$21.000** | $12.250 | CC $20.000 |
| iPhone 8 / SE 2020 | Compatible | $8.750 | $10.000 | **$21.000** | $12.250 | CC $25.000 |
| iPhone 8 Plus | Compatible | $10.000 | $10.000 | **$22.000** | $12.000 | CC $25.000 |
| iPhone SE 2022 | Alta duración | $14.990 | $15.000 | **$33.000** | $18.010 | CC $45.000 |
| iPhone X | Alta duración | $14.990 | $15.000 | **$33.000** | $18.010 | MPX $39.990 · CC $35.000 |
| iPhone XR | Alta duración | $13.990 | $15.000 | **$32.000** | $18.010 | MPX $39.990 · CC $45.000 |
| iPhone XS | Alta duración | $14.990 | $15.000 | **$33.000** | $18.010 | MPX $39.990 · CC $45.000 |
| iPhone XS Max | Alta duración | $14.990 | $15.000 | **$33.000** | $18.010 | CC $45.000 |
| iPhone 11 | Alta duración | $14.990 | $15.000 | **$33.000** | $18.010 | MPX $45.000 · CC $55.000 |
| iPhone 11 Pro | Alta duración | $16.990 | $15.000 | **$35.000** | $18.010 | MPX $45.000 · CC $55.000 |
| iPhone 11 Pro Max | Alta duración | $17.990 | $15.000 | **$36.000** | $18.010 | MPX $45.000 · CC $55.000 |
| iPhone 12 / 12 Pro | Sin aviso de batería | $17.500 | $18.000 | **$39.000** | $21.500 | MPX $67.990 · CC $68.000 |
| iPhone 12 mini | Sin aviso de batería | $21.250 | $18.000 | **$43.000** | $21.750 | CC $68.000 |
| iPhone 12 Pro Max | Sin aviso de batería | $22.500 | $18.000 | **$44.000** | $21.500 | MPX $74.990 · CC $70.000 |
| iPhone 13 | Sin aviso de batería | $16.250 | $18.000 | **$37.000** | $20.750 | MPX $71.990 · CC $75.000 |
| iPhone 13 mini | Sin aviso de batería | $17.500 | $18.000 | **$39.000** | $21.500 | CC $75.000 |
| iPhone 13 Pro | Sin aviso de batería | $21.250 | $18.000 | **$43.000** | $21.750 | MPX $72.990 · CC $80.000 |
| iPhone 13 Pro Max | Sin aviso de batería | $23.750 | $18.000 | **$46.000** | $22.250 | MPX $89.900 · CC $80.000 |
| iPhone 14 | Sin aviso de batería | $21.250 | $20.000 | **$45.000** | $23.750 | MPX $89.990 · CC $75.000 |
| iPhone 14 Plus | Sin aviso de batería | $22.500 | $20.000 | **$46.000** | $23.500 | MPX $89.990 · CC $75.000 |
| iPhone 14 Pro | Sin aviso de batería | $23.750 | $20.000 | **$48.000** | $24.250 | MPX $89.990 · CC $80.000 |
| iPhone 14 Pro Max | Sin aviso de batería | $26.250 | $20.000 | **$51.000** | $24.750 | CC $80.000 |
| iPhone 15 | Sin aviso de batería | $23.750 | $20.000 | **$48.000** | $24.250 | CC $95.000 |
| iPhone 15 Plus | Sin aviso de batería | $25.000 | $20.000 | **$49.000** | $24.000 | CC $95.000 |
| iPhone 15 Pro | Sin aviso de batería | $27.500 | $20.000 | **$52.000** | $24.500 | CC $95.000 |
| iPhone 15 Pro Max | Sin aviso de batería | $30.000 | $20.000 | **$55.000** | $25.000 | CC $95.000 |

### iPhone · Cambio de puerto de carga

| Equipo | Calidad | Repuesto | Mano de obra | **Precio estimado** | Queda (con IVA) | Santiago |
|---|---|---:|---:|---:|---:|---|
| iPhone 7 | Flex compatible | $3.690 | $20.000 | **$25.000** | $21.310 | — |
| iPhone 8 | Flex compatible | $3.750 | $20.000 | **$25.000** | $21.250 | — |
| iPhone 8 Plus | Flex compatible | $3.690 | $20.000 | **$25.000** | $21.310 | — |
| iPhone SE 2020 | Flex compatible | $3.750 | $20.000 | **$25.000** | $21.250 | CC $35.000 |
| iPhone X | Flex compatible | $3.690 | $20.000 | **$25.000** | $21.310 | CC $35.000 |
| iPhone XR | Flex compatible | $3.750 | $20.000 | **$25.000** | $21.250 | CC $35.000 |
| iPhone XS | Flex compatible | $6.150 | $20.000 | **$28.000** | $21.850 | CC $35.000 |
| iPhone XS Max | Flex compatible | $6.150 | $20.000 | **$28.000** | $21.850 | CC $45.000 |
| iPhone 11 | Flex compatible | $3.750 | $20.000 | **$25.000** | $21.250 | CC $45.000 |
| iPhone 11 Pro Max | Flex compatible | $24.600 | $20.000 | **$49.000** | $24.400 | CC $55.000 |
| iPhone 12 | Flex compatible | $5.000 | $25.000 | **$31.000** | $26.000 | CC $55.000 |
| iPhone 12 Pro / 12 Pro Max | Flex compatible | $24.600 | $25.000 | **$54.000** | $29.400 | CC $65.000 |
| iPhone 13 / 13 Pro | Flex compatible | $6.250 | $25.000 | **$33.000** | $26.750 | CC $65.000 |

### iPhone · Cambio de vidrio de cámara trasera

| Equipo | Calidad | Repuesto | Mano de obra | **Precio estimado** | Queda (con IVA) | Santiago |
|---|---|---:|---:|---:|---:|---|
| iPhone X a 15 Pro Max (todos) | Con adhesivo | $2.500 | $10.000 | **$13.000** | $10.500 | — |

### Samsung · Cambio de pantalla

| Equipo | Calidad | Repuesto | Mano de obra | **Precio estimado** | Queda (con IVA) | Santiago |
|---|---|---:|---:|---:|---:|---|
| Galaxy A02 / A02s / A03 / A03s | LCD | $10.000 | $20.000 | **$32.000** | $22.000 | MPX $40.000 |
| Galaxy A04 / A04s | LCD | $11.250 | $20.000 | **$33.000** | $21.750 | MPX $40.000 |
| Galaxy A04e | LCD | $13.990 | $20.000 | **$37.000** | $23.010 | MPX $40.000 |
| Galaxy A05 | LCD | $10.000 | $20.000 | **$32.000** | $22.000 | MPX $40.000 |
| Galaxy A06 | LCD | $12.500 | $20.000 | **$35.000** | $22.500 | MPX $45.000 |
| Galaxy A07 | LCD | $11.250 | $20.000 | **$33.000** | $21.750 | MPX $45.000 |
| Galaxy A10 | LCD | $11.250 | $20.000 | **$33.000** | $21.750 | — |
| Galaxy A11 | LCD | $13.990 | $20.000 | **$37.000** | $23.010 | — |
| Galaxy A12 | LCD | $11.250 | $20.000 | **$33.000** | $21.750 | MPX $45.000 |
| Galaxy A13 4G | LCD | $11.250 | $20.000 | **$33.000** | $21.750 | MPX $45.000 |
| Galaxy A13 5G | LCD | $13.750 | $20.000 | **$36.000** | $22.250 | MPX $45.000 |
| Galaxy A14 4G | LCD | $13.750 | $20.000 | **$36.000** | $22.250 | — |
| Galaxy A14 5G | LCD | $14.990 | $20.000 | **$38.000** | $23.010 | — |
| Galaxy A20s | LCD | $11.250 | $20.000 | **$33.000** | $21.750 | MPX $45.000 |
| Galaxy A21s | LCD | $11.250 | $20.000 | **$33.000** | $21.750 | MPX $45.000 |
| Galaxy A22 5G | LCD | $15.000 | $20.000 | **$38.000** | $23.000 | MPX $45.000 |
| Galaxy A23 | LCD | $11.250 | $20.000 | **$33.000** | $21.750 | — |
| Galaxy A32 5G | LCD | $16.990 | $20.000 | **$40.000** | $23.010 | — |
| Galaxy M12 | LCD | $16.990 | $20.000 | **$40.000** | $23.010 | — |
| Galaxy A20 | Incell | $11.250 | $20.000 | **$33.000** | $21.750 | — |
| Galaxy A20 | OLED | $28.750 | $25.000 | **$59.000** | $30.250 | MPX $55.000 |
| Galaxy A30 | Incell | $12.500 | $20.000 | **$35.000** | $22.500 | — |
| Galaxy A30 | OLED | $35.000 | $25.000 | **$66.000** | $31.000 | — |
| Galaxy A30s | Incell | $15.000 | $20.000 | **$38.000** | $23.000 | — |
| Galaxy A30s | OLED | $33.750 | $25.000 | **$64.000** | $30.250 | — |
| Galaxy A50 | Incell | $15.000 | $20.000 | **$38.000** | $23.000 | — |
| Galaxy A50 | OLED | $32.500 | $25.000 | **$63.000** | $30.500 | — |
| Galaxy A51 | Incell | $13.750 | $20.000 | **$36.000** | $22.250 | — |
| Galaxy A51 | OLED | $37.500 | $25.000 | **$69.000** | $31.500 | — |
| Galaxy A70 | Incell | $12.500 | $20.000 | **$35.000** | $22.500 | — |
| Galaxy A70 | OLED | $37.500 | $25.000 | **$69.000** | $31.500 | — |
| Galaxy A71 | Incell | $17.990 | $20.000 | **$41.000** | $23.010 | — |
| Galaxy A71 | OLED | $40.000 | $25.000 | **$71.000** | $31.000 | — |
| Galaxy A15 | OLED | $42.500 | $25.000 | **$74.000** | $31.500 | — |
| Galaxy A22 4G | OLED | $35.000 | $25.000 | **$66.000** | $31.000 | MPX $75.000 |
| Galaxy A24 | OLED | $34.990 | $25.000 | **$66.000** | $31.010 | — |
| Galaxy A25 | OLED | $36.990 | $25.000 | **$68.000** | $31.010 | — |
| Galaxy A31 | OLED | $33.750 | $25.000 | **$64.000** | $30.250 | — |
| Galaxy A32 4G | OLED | $33.750 | $25.000 | **$64.000** | $30.250 | — |
| Galaxy A33 | OLED | $40.000 | $25.000 | **$71.000** | $31.000 | — |
| Galaxy A34 | OLED | $47.500 | $25.000 | **$80.000** | $32.500 | — |
| Galaxy A35 | OLED | $46.250 | $25.000 | **$79.000** | $32.750 | — |
| Galaxy A52 | OLED | $36.990 | $25.000 | **$68.000** | $31.010 | — |
| Galaxy A52s | OLED | $40.000 | $25.000 | **$71.000** | $31.000 | — |
| Galaxy A53 | OLED | $49.990 | $25.000 | **$83.000** | $33.010 | — |
| Galaxy A54 | OLED | $39.990 | $25.000 | **$71.000** | $31.010 | — |
| Galaxy A55 | OLED | $37.500 | $25.000 | **$69.000** | $31.500 | — |
| Galaxy A56 | Incell | $46.250 | $25.000 | **$79.000** | $32.750 | — |
| Galaxy A72 | OLED | $42.990 | $25.000 | **$75.000** | $32.010 | — |
| Galaxy A73 | OLED | $43.750 | $25.000 | **$76.000** | $32.250 | — |
| Galaxy S20 FE | OLED | $38.750 | $35.000 | **$80.000** | $41.250 | MPX $175.000 |
| Galaxy S21 FE | OLED | $47.500 | $35.000 | **$90.000** | $42.500 | MPX $230.000 |
| Galaxy S21 Plus | OLED | $86.250 | $35.000 | **$135.000** | $48.750 | MPX $250.000 |
| Galaxy S21 Ultra | OLED | $103.750 | $35.000 | **$155.000** | $51.250 | MPX $320.000 |
| Galaxy S22 Ultra | OLED | $102.500 | $35.000 | **$153.000** | $50.500 | MPX $380.000 |
| Galaxy S23 FE | OLED | $41.990 | $35.000 | **$84.000** | $42.010 | MPX $190.000 |
| Galaxy S23 Ultra | OLED | $108.750 | $35.000 | **$161.000** | $52.250 | MPX $390.000 |
| Galaxy Note 20 | OLED | $81.250 | $35.000 | **$129.000** | $47.750 | — |
| Galaxy Note 20 Ultra | OLED | $97.500 | $35.000 | **$148.000** | $50.500 | — |

### Samsung · Cambio de batería

| Equipo | Calidad | Repuesto | Mano de obra | **Precio estimado** | Queda (con IVA) | Santiago |
|---|---|---:|---:|---:|---:|---|
| Galaxy A01 | Alta duración | $11.990 | $15.000 | **$29.000** | $17.010 | — |
| Galaxy A02 / A04s / A21s / A22 4G | Alta duración | $12.990 | $15.000 | **$30.000** | $17.010 | — |
| Galaxy A10 | Alta duración | $7.990 | $15.000 | **$25.000** | $17.010 | — |
| Galaxy A10s / A20s | Alta duración | $12.990 | $15.000 | **$30.000** | $17.010 | — |
| Galaxy A11 | Alta duración | $12.990 | $15.000 | **$30.000** | $17.010 | — |
| Galaxy A12 / A13 4G | Alta duración | $10.000 | $15.000 | **$27.000** | $17.000 | — |
| Galaxy A13 5G | Alta duración | $12.990 | $15.000 | **$30.000** | $17.010 | — |
| Galaxy A14 4G / 5G | Alta duración | $12.990 | $15.000 | **$30.000** | $17.010 | — |
| Galaxy A20 / A30 | Alta duración | $10.990 | $15.000 | **$28.000** | $17.010 | — |
| Galaxy A22 5G | Alta duración | $13.990 | $15.000 | **$32.000** | $18.010 | — |
| Galaxy A23 5G / A73 | Alta duración | $10.000 | $15.000 | **$27.000** | $17.000 | — |
| Galaxy A32 / A42 / A72 | Alta duración | $12.990 | $15.000 | **$30.000** | $17.010 | — |
| Galaxy A33 / A53 | Alta duración | $13.990 | $15.000 | **$32.000** | $18.010 | — |
| Galaxy A34 / A54 | Alta duración | $12.990 | $15.000 | **$30.000** | $17.010 | — |
| Galaxy A51 | Alta duración | $11.990 | $15.000 | **$29.000** | $17.010 | — |
| Galaxy A52 / S20 FE | Alta duración | $16.990 | $15.000 | **$35.000** | $18.010 | — |
| Galaxy S21 FE | Alta duración | $10.000 | $15.000 | **$27.000** | $17.000 | — |
| Galaxy S21 Ultra | Alta duración | $10.000 | $15.000 | **$27.000** | $17.000 | — |
| Galaxy S23 Ultra | Alta duración | $11.250 | $15.000 | **$28.000** | $16.750 | — |
| Galaxy S24 Ultra | Alta duración | $13.990 | $15.000 | **$32.000** | $18.010 | — |
| Galaxy Note 20 Ultra | Alta duración | $13.990 | $15.000 | **$32.000** | $18.010 | — |
| Galaxy A05 / A05s / A06 | Alta duración | $12.990 * | $15.000 | **$30.000** | $17.010 | — |
| Galaxy A15 / A25 | Alta duración | $12.990 * | $15.000 | **$30.000** | $17.010 | — |
| Galaxy A35 / A55 | Alta duración | $12.990 * | $15.000 | **$30.000** | $17.010 | — |
| Galaxy A24 | Alta duración | $12.990 * | $15.000 | **$30.000** | $17.010 | — |

### Samsung · Cambio de puerto de carga

| Equipo | Calidad | Repuesto | Mano de obra | **Precio estimado** | Queda (con IVA) | Santiago |
|---|---|---:|---:|---:|---:|---|
| Galaxy A01 | Placa de carga | $6.150 | $15.000 | **$23.000** | $16.850 | — |
| Galaxy A02 / A02s / A03 | Placa de carga | $3.690 | $15.000 | **$20.000** | $16.310 | — |
| Galaxy A03s | Placa de carga | $4.920 | $15.000 | **$21.000** | $16.080 | — |
| Galaxy A04 / A04s | Placa de carga | $3.750 | $15.000 | **$20.000** | $16.250 | — |
| Galaxy A10 | Placa de carga | $4.920 | $15.000 | **$21.000** | $16.080 | — |
| Galaxy A10s | Placa de carga | $3.750 | $15.000 | **$20.000** | $16.250 | — |
| Galaxy A11 / A12 / A13 4G | Placa de carga | $3.690 | $15.000 | **$20.000** | $16.310 | — |
| Galaxy A13 5G | Placa de carga | $7.380 | $15.000 | **$24.000** | $16.620 | — |
| Galaxy A20 / A20s / A21s | Placa de carga | $3.690 | $15.000 | **$20.000** | $16.310 | — |
| Galaxy A22 4G / 5G | Placa de carga | $3.750 | $15.000 | **$20.000** | $16.250 | — |
| Galaxy A23 | Placa de carga | $3.690 | $15.000 | **$20.000** | $16.310 | — |
| Galaxy A30 | Placa de carga | $6.150 | $15.000 | **$23.000** | $16.850 | — |
| Galaxy A30s / A50 | Placa de carga | $3.690 | $15.000 | **$20.000** | $16.310 | — |
| Galaxy A31 / A51 | Placa de carga | $3.750 | $15.000 | **$20.000** | $16.250 | — |
| Galaxy A32 4G | Placa de carga | $3.690 | $15.000 | **$20.000** | $16.310 | — |
| Galaxy A32 5G | Placa de carga | $7.380 | $15.000 | **$24.000** | $16.620 | — |
| Galaxy A33 | Placa de carga | $3.750 | $15.000 | **$20.000** | $16.250 | — |
| Galaxy A50s / A71 | Placa de carga | $6.150 | $15.000 | **$23.000** | $16.850 | — |
| Galaxy A52 / A72 | Placa de carga | $11.070 | $15.000 | **$28.000** | $16.930 | — |
| Galaxy A52s / A73 | Placa de carga | $8.750 | $15.000 | **$26.000** | $17.250 | — |
| Galaxy A70 | Placa de carga | $3.750 | $15.000 | **$20.000** | $16.250 | — |
| Galaxy S20 FE | Placa de carga | $5.000 | $15.000 | **$21.000** | $16.000 | — |
| Galaxy S21 FE | Placa de carga | $8.610 | $15.000 | **$25.000** | $16.390 | — |
| Galaxy S21 / S22 | Placa de carga | $8.750 | $15.000 | **$26.000** | $17.250 | — |
| Galaxy S22 Ultra | Placa de carga | $20.910 | $15.000 | **$40.000** | $19.090 | — |
| Galaxy A05 / A05s / A06 | Placa de carga | $4.920 * | $15.000 | **$21.000** | $16.080 | — |
| Galaxy A14 / A15 / A25 | Placa de carga | $4.920 * | $15.000 | **$21.000** | $16.080 | — |
| Galaxy A34 / A35 / A54 / A55 | Placa de carga | $4.920 * | $15.000 | **$21.000** | $16.080 | — |

### Samsung · Cambio de tapa trasera

| Equipo | Calidad | Repuesto | Mano de obra | **Precio estimado** | Queda (con IVA) | Santiago |
|---|---|---:|---:|---:|---:|---|
| Galaxy A10 | Compatible | $2.460 | $10.000 | **$13.000** | $10.540 | — |
| Galaxy A20 | Compatible | $4.920 | $10.000 | **$16.000** | $11.080 | — |
| Galaxy A20s / A30s / A31 / A50 / A51 / A70 | Compatible | $3.690 | $10.000 | **$15.000** | $11.310 | — |

### Motorola · Cambio de pantalla

| Equipo | Calidad | Repuesto | Mano de obra | **Precio estimado** | Queda (con IVA) | Santiago |
|---|---|---:|---:|---:|---:|---|
| Moto E6 Play | LCD | $10.000 | $20.000 | **$32.000** | $22.000 | — |
| Moto E7 / E7 Power | LCD | $13.990 | $20.000 | **$37.000** | $23.010 | — |
| Moto E7i Power | LCD | $11.250 | $20.000 | **$33.000** | $21.750 | — |
| Moto E13 | LCD | $13.990 | $20.000 | **$37.000** | $23.010 | — |
| Moto E20 | LCD | $13.990 | $20.000 | **$37.000** | $23.010 | MPX $40.000 |
| Moto E22 / E22i | LCD | $11.250 | $20.000 | **$33.000** | $21.750 | — |
| Moto E30 / E40 | LCD | $15.990 | $20.000 | **$39.000** | $23.010 | — |
| Moto G04 | LCD | $13.990 | $20.000 | **$37.000** | $23.010 | — |
| Moto G13 / G23 | LCD | $11.250 | $20.000 | **$33.000** | $21.750 | MPX $55.000 |
| Moto G14 / G54 | LCD | $13.750 | $20.000 | **$36.000** | $22.250 | MPX $50.000 |
| Moto G20 | LCD | $11.250 | $20.000 | **$33.000** | $21.750 | MPX $40.000 |
| Moto G24 / G24 Power | LCD | $11.250 | $20.000 | **$33.000** | $21.750 | MPX $50.000 |
| Moto G30 | LCD | $11.250 | $20.000 | **$33.000** | $21.750 | MPX $40.000 |
| Moto G32 | LCD | $18.750 | $20.000 | **$42.000** | $23.250 | — |
| Moto G34 | LCD | $11.250 | $20.000 | **$33.000** | $21.750 | MPX $45.000 |
| Moto G35 | LCD | $12.500 | $20.000 | **$35.000** | $22.500 | MPX $45.000 |
| Moto G50 5G | LCD | $11.250 | $20.000 | **$33.000** | $21.750 | MPX $45.000 |
| Moto G51 | LCD | $16.990 | $20.000 | **$40.000** | $23.010 | MPX $45.000 |
| Moto G53 | LCD | $15.990 | $20.000 | **$39.000** | $23.010 | — |
| Moto G60 / G40 | LCD | $13.750 | $20.000 | **$36.000** | $22.250 | MPX $50.000 |
| Moto G60s | LCD | $13.750 | $20.000 | **$36.000** | $22.250 | MPX $50.000 |
| Moto G8 Play | LCD | $11.250 | $20.000 | **$33.000** | $21.750 | — |
| Moto G8 Power | LCD | $16.990 | $20.000 | **$40.000** | $23.010 | — |
| Moto G9 Play | LCD | $11.250 | $20.000 | **$33.000** | $21.750 | — |
| Moto G9 Plus | LCD | $14.990 | $20.000 | **$38.000** | $23.010 | — |
| Moto G9 Power | LCD | $15.990 | $20.000 | **$39.000** | $23.010 | — |
| Moto G100 | LCD | $17.990 | $20.000 | **$41.000** | $23.010 | MPX $45.000 |
| Moto G200 | LCD | $18.750 | $20.000 | **$42.000** | $23.250 | MPX $50.000 |
| Moto One Fusion | LCD | $11.250 | $20.000 | **$33.000** | $21.750 | — |
| Moto G50 4G | LCD | $25.000 | $20.000 | **$49.000** | $24.000 | MPX $70.000 |
| Moto G71 / G41 / G31 | OLED | $37.500 | $25.000 | **$69.000** | $31.500 | — |
| Moto G82 | OLED | $55.000 | $25.000 | **$89.000** | $34.000 | — |
| Moto G84 | OLED | $42.990 | $25.000 | **$75.000** | $32.010 | — |
| Motorola Edge 20 Lite | OLED | $57.500 | $35.000 | **$102.000** | $44.500 | — |
| Motorola Edge 30 Pro | Incell | $19.363 | $35.000 | **$58.000** | $38.637 | — |
| Motorola Edge 30 Pro | OLED | $53.750 | $35.000 | **$97.000** | $43.250 | MPX $117.000 |
| Motorola Edge 30 Fusion | OLED | $75.000 | $35.000 | **$122.000** | $47.000 | MPX $140.000 |
| Motorola Edge 30 Neo | OLED | $95.000 | $35.000 | **$145.000** | $50.000 | MPX $175.000 |
| Motorola Edge 40 | OLED | $45.000 | $35.000 | **$87.000** | $42.000 | MPX $117.000 |
| Motorola Edge 40 Neo | OLED | $45.000 | $35.000 | **$87.000** | $42.000 | MPX $130.000 |
| Motorola Edge 50 Fusion | OLED | $40.000 | $35.000 | **$81.000** | $41.000 | MPX $117.000 |
| Motorola Edge 60 Fusion | OLED | $41.250 | $35.000 | **$83.000** | $41.750 | MPX $150.000 |

### Motorola · Cambio de batería

| Equipo | Calidad | Repuesto | Mano de obra | **Precio estimado** | Queda (con IVA) | Santiago |
|---|---|---:|---:|---:|---:|---|
| Moto G50 | Alta duración | $12.990 | $15.000 | **$30.000** | $17.010 | — |
| Moto One Vision | Alta duración | $12.990 | $15.000 | **$30.000** | $17.010 | — |
| Moto G7 | Alta duración | $7.490 | $15.000 | **$24.000** | $16.510 | — |
| Moto G7 Play | Alta duración | $6.990 | $15.000 | **$24.000** | $17.010 | — |
| Moto G04 / G24 / G34 / G54 (y otros recientes) | Alta duración | $12.990 * | $15.000 | **$30.000** | $17.010 | — |

### Motorola · Cambio de puerto de carga

| Equipo | Calidad | Repuesto | Mano de obra | **Precio estimado** | Queda (con IVA) | Santiago |
|---|---|---:|---:|---:|---:|---|
| Moto E7 / G9 Power / G100 / One | Placa de carga | $3.690 | $15.000 | **$20.000** | $16.310 | — |
| Moto E7 Power / E7i / E20 / E30 | Placa de carga | $4.920 | $15.000 | **$21.000** | $16.080 | — |
| Moto G30 / G50 5G / G8 Power / G9 Plus / One Fusion | Placa de carga | $4.920 | $15.000 | **$21.000** | $16.080 | — |
| Moto G71 | Placa de carga | $3.750 | $15.000 | **$20.000** | $16.250 | — |
| Moto G04 / G24 / G34 / G54 (y otros recientes) | Placa de carga | $4.920 * | $15.000 | **$21.000** | $16.080 | — |

### Motorola · Cambio de tapa trasera

| Equipo | Calidad | Repuesto | Mano de obra | **Precio estimado** | Queda (con IVA) | Santiago |
|---|---|---:|---:|---:|---:|---|
| Moto E7i / G9 Plus | Compatible | $2.460 | $10.000 | **$13.000** | $10.540 | — |
| Moto E6s / G30 / G9 Power | Compatible | $4.920 | $10.000 | **$16.000** | $11.080 | — |

### Vivo · Cambio de pantalla

| Equipo | Calidad | Repuesto | Mano de obra | **Precio estimado** | Queda (con IVA) | Santiago |
|---|---|---:|---:|---:|---:|---|
| Vivo Y01 | LCD | $13.990 | $20.000 | **$37.000** | $23.010 | MPX $40.000 |
| Vivo Y02s | LCD | $11.250 | $20.000 | **$33.000** | $21.750 | MPX $40.000 |
| Vivo Y11s | LCD | $11.250 | $20.000 | **$33.000** | $21.750 | MPX $40.000 |
| Vivo Y15s | LCD | $10.000 | $20.000 | **$32.000** | $22.000 | MPX $40.000 |
| Vivo Y20 / Y20s / Y20i | LCD | $11.250 | $20.000 | **$33.000** | $21.750 | MPX $40.000 |
| Vivo Y21s | LCD | $10.000 | $20.000 | **$32.000** | $22.000 | MPX $40.000 |
| Vivo Y27 5G | LCD | $12.500 | $20.000 | **$35.000** | $22.500 | MPX $40.000 |
| Vivo Y30 | LCD | $17.500 | $20.000 | **$41.000** | $23.500 | MPX $50.000 |
| Vivo Y36 5G | LCD | $12.500 | $20.000 | **$35.000** | $22.500 | MPX $40.000 |
| Vivo Y55 | LCD | $11.250 | $20.000 | **$33.000** | $21.750 | MPX $40.000 |
| Vivo Y33s / Y51 / Y53s / Y76 | LCD | $13.990 | $20.000 | **$37.000** | $23.010 | MPX $45.000 |
| Vivo V20 | Incell | $12.500 | $20.000 | **$35.000** | $22.500 | — |
| Vivo V20 | OLED | $31.250 | $25.000 | **$61.000** | $29.750 | — |
| Vivo V21 | Incell | $15.990 | $20.000 | **$39.000** | $23.010 | — |
| Vivo V21 | OLED | $36.250 | $25.000 | **$67.000** | $30.750 | — |
| Vivo V25 | Compatible | $15.990 | $20.000 | **$39.000** | $23.010 | — |

### Vivo · Cambio de batería

| Equipo | Calidad | Repuesto | Mano de obra | **Precio estimado** | Queda (con IVA) | Santiago |
|---|---|---:|---:|---:|---:|---|
| Vivo (cualquier Y) | Alta duración | $12.990 * | $15.000 | **$30.000** | $17.010 | — |

### Vivo · Cambio de puerto de carga

| Equipo | Calidad | Repuesto | Mano de obra | **Precio estimado** | Queda (con IVA) | Santiago |
|---|---|---:|---:|---:|---:|---|
| Vivo Y20 / Y20s / Y20i | Placa de carga | $4.920 | $15.000 | **$21.000** | $16.080 | — |
| Vivo (otros Y) | Placa de carga | $4.920 * | $15.000 | **$21.000** | $16.080 | — |
