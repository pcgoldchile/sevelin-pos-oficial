# Reparación de celulares con los precios de Multiphone (16-10-2026)

> **Propuesta. Nada está cargado ni publicado.** Reemplaza los costos de `2026-10-15-servicios-celulares.md`, que salían
> de LifeMax porque el catálogo de Multiphone del 21-08 era solo de herramientas. El método, la mano de obra y los
> consejos de ese informe siguen valiendo.
> Archivos:
> - `2026-10-16-lista-multiphone-21-09.csv`: la lista completa, leída del PDF (4.281 precios en 47 páginas).
> - `2026-10-16-servicios-celulares-multiphone.csv`: los 1.875 precios estimados.
> - `…-calculo.py` y `2026-10-16-leer-lista-multiphone.py`: para rehacerlo cuando llegue otra lista.

## 1. De dónde salen los costos

La "LISTA DE PRECIOS MULTIPHONE CHILE 21.09" (47 páginas) trae pantallas, baterías, flex de carga, pines, tapas,
cámaras, vidrios de cámara, parlantes, auriculares, botones, huellas y bandejas SIM de más de 15 marcas. Usé las de
**iPhone, Samsung, Motorola y Vivo**.

- **Se leyó por posición en la página** (modelo, calidad y precio tienen cada uno su tamaño de letra). Así salieron los
  4.281 precios y ninguno quedó sin modelo. Se revisaron contra el PDF las páginas de pantallas de iPhone (5 y 6),
  baterías (16), flex de carga (20), cámaras (29) y tapas (34 y 35).
- **⚠️ La lista no dice si el precio incluye IVA.** El catálogo de herramientas del 21-08 decía "IVA INCL." en cada
  precio y su web dice "Impuestos incluidos", así que calculé **con IVA incluido**. Si fueran netos, cada repuesto sube
  19%. Por ejemplo, la pantalla del Samsung A05 pasaría de $31.000 a $33.000. Hay que preguntarle a Multiphone.
- **Cuando hay varias del mismo modelo y la misma calidad,** se toma la más barata. Si la de su marca propia (CVT-SRVI)
  cuesta hasta $1.000 más, se prefiere esa, porque es la que ellos garantizan.

## 2. Cómo se calcula (igual que antes)

**Precio = (repuesto + 15%) + mano de obra, redondeado hacia arriba al millar.** El 15% cubre el envío desde
Antofagasta y que el repuesto suba. La mano de obra de pantalla, batería, puerto y tapa es la del informe del 15-10.
Se agregaron los trabajos nuevos que trae la lista:

| Trabajo nuevo | Android | iPhone |
|---|---:|---:|
| Pin de carga soldado (micro-soldadura) | $20.000 | — |
| Cámara trasera o frontal | $15.000 | $20.000 |
| Parlante | $15.000 | $15.000 |
| Auricular (el de las llamadas) | $15.000 | $20.000 |
| Botón de encendido o de volumen | $15.000 | $25.000 |
| Lector de huella | $15.000 | — |
| Bandeja SIM | $3.000 | $3.000 |
| Carcasa completa (chasis), iPhone 7 al 13 | — | $40.000 |

## 3. Cuánto cambió respecto de la propuesta del 15-10

| Trabajo | Con LifeMax (15-10) | Con Multiphone (hoy) |
|---|---:|---:|
| Pantalla iPhone 11 incell | $41.000 | **$35.000** |
| Pantalla iPhone 13 incell / OLED | $55.000 / $91.000 | **$50.000 / $81.000** |
| Pantalla iPhone 15 OLED | $108.000 | **$130.000** ⬆ |
| Batería iPhone 13 | $37.000 | **$33.000** (o $41.000 "con diagnóstico") |
| Pantalla Samsung A05 | $32.000 | **$31.000** |
| Pantalla Samsung A54 OLED | $71.000 | **$55.000** |
| Pantalla Samsung A15 incell / OLED | — / $74.000 | **$34.000 / $65.000** |
| Pantalla Moto G24 | $33.000 | **$31.000** |
| Puerto de carga iPhone 11 | $25.000 | **$26.000** |

**Multiphone es más barato en casi todo,** y sobre todo en las OLED de Samsung y en los incell de iPhone. **La
excepción son las OLED de iPhone 15 en adelante:** la del iPhone 15 cuesta $78.000 en Multiphone y $58.750 en LifeMax.
En esos modelos conviene cotizar en los dos antes de encargar.

## 4. Lo que hay que saber de la lista

- **Baterías de iPhone, tres tipos:**
  1. **Normal:** la que uso en el precio estimado.
  2. **"Con diagnóstico":** del 12 en adelante, entre $1.000 y $7.000 más cara según el modelo.
  3. **"Sin flex":** más barata, pero hay que pasarle un flex de programación, que cuesta $10.000 a $15.000 aparte.
  Antes de ofrecer la "con diagnóstico", pregúntale a Multiphone qué muestra en Ajustes: si es la que evita el aviso de
  "batería no genuina", es la que conviene ofrecer como opción buena.
- **Tapas de iPhone:** el vidrio solo se ofrece en los que se abren por atrás (14, 14 Plus y todo el 15, 16 y 17). Del
  7 al 13, y en el 14 Pro y 14 Pro Max, la lista trae **carcasa completa (chasis)**: es pasar todo el teléfono a una
  carcasa nueva, con mano de obra de $40.000. Las 66 tapas de vidrio de esos modelos quedaron fuera, porque sin láser
  no conviene sacarlas.
- **Pantallas de iPhone, cuatro calidades:**
  - **Incell:** la económica.
  - **OLED:** la recomendada.
  - **Original:** en el iPhone 8, SE, XR y 11 es la LCD original, y cuesta poco más que la incell.
  - **Original 100%:** cara. Sirve solo para el cliente que la pide.
- **Samsung "small glass" y "big glass"** son dos versiones de la misma pantalla para el mismo teléfono (A15, A17, A24,
  A25 y A26). Hay que mirar cuál trae el teléfono antes de encargar.
- **Pantallas con diagnóstico JCID** (desde $72.000) y tablets, iPad y Apple Watch quedaron fuera de la tabla. Están en
  el CSV de la lista completa por si se piden.

## 5. Tablas (pantalla, batería y puerto de carga)

Los otros 12 trabajos (cámaras, parlantes, tapas, botones, bandejas…) están en el CSV de 1.875 filas.

### iPhone · Cambio de pantalla (104)

| Equipo | Calidad | Repuesto | Mano de obra | **Precio estimado** |
|---|---|---:|---:|---:|
| iPhone 5S / 5Se | LCD | $6.500 | $20.000 | **$28.000** |
| iPhone 6 | LCD | $7.000 | $20.000 | **$29.000** |
| iPhone 6 Plus | LCD | $8.500 | $20.000 | **$30.000** |
| iPhone 6S | LCD | $9.000 | $20.000 | **$31.000** |
| iPhone 6S Plus | LCD | $10.000 | $20.000 | **$32.000** |
| iPhone 7 | LCD | $9.000 | $20.000 | **$31.000** |
| iPhone 7 Plus | LCD | $10.000 | $20.000 | **$32.000** |
| iPhone 8 Plus | LCD | $10.000 | $20.000 | **$32.000** |
| iPhone 8 / SE 2020 | LCD | $9.500 | $20.000 | **$31.000** |
| iPhone 8 / SE 2020 / SE 2022 | Original 100% | $14.000 | $25.000 | **$42.000** |
| iPhone 11 | Incell | $13.000 | $20.000 | **$35.000** |
| iPhone 11 | Original | $17.000 | $20.000 | **$40.000** |
| iPhone 11 | Original 100% | $32.000 | $25.000 | **$62.000** |
| iPhone 11 Pro | Incell | $17.000 | $20.000 | **$40.000** |
| iPhone 11 Pro | OLED | $32.000 | $25.000 | **$62.000** |
| iPhone 11 Pro | Original | $58.000 | $20.000 | **$87.000** |
| iPhone 11 Pro Max | Incell | $19.000 | $20.000 | **$42.000** |
| iPhone 11 Pro Max | OLED | $40.000 | $25.000 | **$71.000** |
| iPhone 11 Pro Max | Original | $62.000 | $20.000 | **$92.000** |
| iPhone 12 Mini | Incell | $20.000 | $30.000 | **$53.000** |
| iPhone 12 Mini | OLED | $56.000 | $30.000 | **$95.000** |
| iPhone 12 Mini | Original | $59.000 | $30.000 | **$98.000** |
| iPhone 12 Pro Max | Incell | $19.000 | $30.000 | **$52.000** |
| iPhone 12 Pro Max | OLED | $54.000 | $30.000 | **$93.000** |
| iPhone 12 Pro Max | Original | $69.000 | $30.000 | **$110.000** |
| iPhone 12 Pro Max | Original 100% | $133.000 | $30.000 | **$183.000** |
| iPhone 12 / 12 Pro | Incell | $15.000 | $30.000 | **$48.000** |
| iPhone 12 / 12 Pro | OLED | $37.000 | $30.000 | **$73.000** |
| iPhone 12 / 12 Pro | Original | $60.000 | $30.000 | **$99.000** |
| iPhone 13 | Incell | $17.000 | $30.000 | **$50.000** |
| iPhone 13 | OLED | $44.000 | $30.000 | **$81.000** |
| iPhone 13 | Original | $69.000 | $30.000 | **$110.000** |
| iPhone 13 Mini | Incell | $20.000 | $30.000 | **$53.000** |
| iPhone 13 Mini | OLED | $59.000 | $30.000 | **$98.000** |
| iPhone 13 Mini | Original | $95.000 | $30.000 | **$140.000** |
| iPhone 13 Pro | Incell | $25.000 | $30.000 | **$59.000** |
| iPhone 13 Pro | OLED | $52.000 | $30.000 | **$90.000** |
| iPhone 13 Pro | Original 100% | $146.000 | $30.000 | **$198.000** |
| iPhone 13 Pro Max | Incell | $22.000 | $30.000 | **$56.000** |
| iPhone 13 Pro Max | OLED | $55.000 | $30.000 | **$94.000** |
| iPhone 13 Pro Max | Original | $142.000 | $30.000 | **$194.000** |
| iPhone 14 | Incell | $29.000 | $40.000 | **$74.000** |
| iPhone 14 | OLED | $43.000 | $40.000 | **$90.000** |
| iPhone 14 | Original | $69.000 | $40.000 | **$120.000** |
| iPhone 14 | Original 100% | $152.000 | $40.000 | **$215.000** |
| iPhone 14 Plus | Incell | $26.000 | $40.000 | **$70.000** |
| iPhone 14 Plus | OLED | $75.000 | $40.000 | **$127.000** |
| iPhone 14 Plus | Original | $87.000 | $40.000 | **$141.000** |
| iPhone 14 Plus | Original 100% | $125.000 | $40.000 | **$184.000** |
| iPhone 14 Pro | Incell | $29.000 | $40.000 | **$74.000** |
| iPhone 14 Pro | OLED | $62.000 | $40.000 | **$112.000** |
| iPhone 14 Pro | Original | $182.000 | $40.000 | **$250.000** |
| iPhone 14 Pro | Original 100% | $199.000 | $40.000 | **$269.000** |
| iPhone 14 Pro Max | Incell | $28.000 | $40.000 | **$73.000** |
| iPhone 14 Pro Max | OLED | $56.000 | $40.000 | **$105.000** |
| iPhone 14 Pro Max | Original | $135.000 | $40.000 | **$196.000** |
| iPhone 14 Pro Max | Original 100% | $276.000 | $40.000 | **$358.000** |
| iPhone 15 | Incell | $20.000 | $40.000 | **$63.000** |
| iPhone 15 | OLED | $78.000 | $40.000 | **$130.000** |
| iPhone 15 | Original | $169.000 | $40.000 | **$235.000** |
| iPhone 15 | Original 100% | $175.000 | $40.000 | **$242.000** |
| iPhone 15 Plus | Incell | $23.000 | $40.000 | **$67.000** |
| iPhone 15 Plus | OLED | $112.000 | $40.000 | **$169.000** |
| iPhone 15 Plus | Original | $154.000 | $40.000 | **$218.000** |
| iPhone 15 Plus | Original 100% | $175.000 | $40.000 | **$242.000** |
| iPhone 15 Pro | Incell | $30.000 | $40.000 | **$75.000** |
| iPhone 15 Pro | OLED | $69.000 | $40.000 | **$120.000** |
| iPhone 15 Pro | Original | $139.000 | $40.000 | **$200.000** |
| iPhone 15 Pro | Original 100% | $249.000 | $40.000 | **$327.000** |
| iPhone 15 Pro Max | Incell | $25.000 | $40.000 | **$69.000** |
| iPhone 15 Pro Max | OLED | $68.000 | $40.000 | **$119.000** |
| iPhone 15 Pro Max | Original | $189.000 | $40.000 | **$258.000** |
| iPhone 15 Pro Max | Original 100% | $210.000 | $40.000 | **$282.000** |
| iPhone 16 | Incell | $39.000 | $50.000 | **$95.000** |
| iPhone 16 | OLED | $145.000 | $50.000 | **$217.000** |
| iPhone 16 | Original | $205.000 | $50.000 | **$286.000** |
| iPhone 16 | Original 100% | $309.000 | $50.000 | **$406.000** |
| iPhone 16 Plus | Original | $235.000 | $50.000 | **$321.000** |
| iPhone 16 Plus | Original 100% | $249.000 | $50.000 | **$337.000** |
| iPhone 16 Pro | Incell | $75.000 | $50.000 | **$137.000** |
| iPhone 16 Pro | OLED | $155.000 | $50.000 | **$229.000** |
| iPhone 16 Pro | Original 100% | $310.000 | $50.000 | **$407.000** |
| iPhone 16 Pro Max | Incell | $79.000 | $50.000 | **$141.000** |
| iPhone 16 Pro Max | Original | $254.000 | $50.000 | **$343.000** |
| iPhone 16 Pro Max | Original 100% | $439.000 | $50.000 | **$555.000** |
| iPhone 16E | Incell | $35.000 | $50.000 | **$91.000** |
| iPhone 16E | Original | $125.000 | $50.000 | **$194.000** |
| iPhone 17 | Incell | $74.000 | $50.000 | **$136.000** |
| iPhone 17 | OLED | $85.000 | $50.000 | **$148.000** |
| iPhone 17 | Original | $215.000 | $50.000 | **$298.000** |
| iPhone 17 Air | Original | $155.000 | $50.000 | **$229.000** |
| iPhone 17 Pro | Incell | $42.000 | $50.000 | **$99.000** |
| iPhone 17 Pro | Original | $219.000 | $50.000 | **$302.000** |
| iPhone 17 Pro Max | Incell | $45.000 | $50.000 | **$102.000** |
| iPhone 17 Pro Max | Original | $285.000 | $50.000 | **$378.000** |
| iPhone SE 2022 | Original | $11.000 | $20.000 | **$33.000** |
| iPhone X | Incell | $13.000 | $20.000 | **$35.000** |
| iPhone X | OLED | $28.000 | $25.000 | **$58.000** |
| iPhone XR | Incell | $12.000 | $20.000 | **$34.000** |
| iPhone XR | Original | $17.000 | $20.000 | **$40.000** |
| iPhone XS | Incell | $14.000 | $20.000 | **$37.000** |
| iPhone XS | OLED | $30.000 | $25.000 | **$60.000** |
| iPhone XS Max | Incell | $19.000 | $20.000 | **$42.000** |
| iPhone XS Max | OLED | $36.000 | $25.000 | **$67.000** |

### iPhone · Cambio de batería (48)

| Equipo | Calidad | Repuesto | Mano de obra | **Precio estimado** |
|---|---|---:|---:|---:|
| iPhone 5Se | Normal | $6.500 | $10.000 | **$18.000** |
| iPhone 6 Plus | Normal | $6.500 | $10.000 | **$18.000** |
| iPhone 6G | Normal | $6.500 | $10.000 | **$18.000** |
| iPhone 6S | Normal | $6.500 | $10.000 | **$18.000** |
| iPhone 6S Plus | Normal | $7.500 | $10.000 | **$19.000** |
| iPhone 7 Plus | Normal | $8.000 | $10.000 | **$20.000** |
| iPhone 7G | Normal | $7.000 | $10.000 | **$19.000** |
| iPhone 8 Plus | Normal | $8.500 | $10.000 | **$20.000** |
| iPhone 8G | Normal | $8.000 | $10.000 | **$20.000** |
| iPhone 11 | Normal | $11.000 | $15.000 | **$28.000** |
| iPhone 11 Pro | Normal | $15.000 | $15.000 | **$33.000** |
| iPhone 11 Pro Max | Normal | $16.000 | $15.000 | **$34.000** |
| iPhone 12 Mini | Normal | $12.000 | $18.000 | **$32.000** |
| iPhone 12 Pro Max | Normal | $17.000 | $18.000 | **$38.000** |
| iPhone 12 / 12 Pro | Con diagnóstico | $18.000 | $18.000 | **$39.000** |
| iPhone 12 / 12 Pro | Normal | $12.000 | $18.000 | **$32.000** |
| iPhone 13 | Con diagnóstico | $20.000 | $18.000 | **$41.000** |
| iPhone 13 | Normal | $13.000 | $18.000 | **$33.000** |
| iPhone 13 Mini | Con diagnóstico | $15.000 | $18.000 | **$36.000** |
| iPhone 13 Mini | Normal | $13.000 | $18.000 | **$33.000** |
| iPhone 13 Pro | Con diagnóstico | $22.000 | $18.000 | **$44.000** |
| iPhone 13 Pro | Normal | $16.000 | $18.000 | **$37.000** |
| iPhone 13 Pro Max | Con diagnóstico | $24.000 | $18.000 | **$46.000** |
| iPhone 13 Pro Max | Normal | $18.000 | $18.000 | **$39.000** |
| iPhone 14 | Con diagnóstico | $18.000 | $20.000 | **$41.000** |
| iPhone 14 | Normal | $17.000 | $20.000 | **$40.000** |
| iPhone 14 Plus | Normal | $22.000 | $20.000 | **$46.000** |
| iPhone 14 Pro | Con diagnóstico | $24.000 | $20.000 | **$48.000** |
| iPhone 14 Pro | Normal | $17.000 | $20.000 | **$40.000** |
| iPhone 14 Pro Max | Con diagnóstico | $26.000 | $20.000 | **$50.000** |
| iPhone 14 Pro Max | Normal | $20.000 | $20.000 | **$43.000** |
| iPhone 15 | Con diagnóstico | $22.000 | $20.000 | **$46.000** |
| iPhone 15 | Normal | $18.000 | $20.000 | **$41.000** |
| iPhone 15 Plus | Normal | $22.000 | $20.000 | **$46.000** |
| iPhone 15 Pro | Con diagnóstico | $24.000 | $20.000 | **$48.000** |
| iPhone 15 Pro | Normal | $21.000 | $20.000 | **$45.000** |
| iPhone 15 Pro Max | Con diagnóstico | $28.000 | $20.000 | **$53.000** |
| iPhone 15 Pro Max | Normal | $23.000 | $20.000 | **$47.000** |
| iPhone 16 | Normal | $23.000 | $20.000 | **$47.000** |
| iPhone 16 Plus | Normal | $23.000 | $20.000 | **$47.000** |
| iPhone 16 Pro | Normal | $24.000 | $20.000 | **$48.000** |
| iPhone 16 Pro Max | Normal | $26.000 | $20.000 | **$50.000** |
| iPhone SE 2020 | Normal | $8.000 | $10.000 | **$20.000** |
| iPhone SE 2022 | Normal | $10.000 | $10.000 | **$22.000** |
| iPhone X | Normal | $11.000 | $15.000 | **$28.000** |
| iPhone XR | Normal | $10.000 | $15.000 | **$27.000** |
| iPhone XS | Normal | $12.000 | $15.000 | **$29.000** |
| iPhone XS Max | Normal | $13.000 | $15.000 | **$30.000** |

### iPhone · Cambio de puerto de carga (36)

| Equipo | Calidad | Repuesto | Mano de obra | **Precio estimado** |
|---|---|---:|---:|---:|
| iPhone 5S / 5Se | Original | $3.000 | $20.000 | **$24.000** |
| iPhone 6G | Original | $3.000 | $20.000 | **$24.000** |
| iPhone 6Plus | Original | $4.000 | $20.000 | **$25.000** |
| iPhone 6S | Original | $3.000 | $20.000 | **$24.000** |
| iPhone 6S Plus | Original | $3.000 | $20.000 | **$24.000** |
| iPhone 7 Plus | Original | $3.500 | $20.000 | **$25.000** |
| iPhone 7G | Original | $3.500 | $20.000 | **$25.000** |
| iPhone 8 Plus | Original | $4.000 | $20.000 | **$25.000** |
| iPhone 8G | Original | $3.500 | $20.000 | **$25.000** |
| iPhone 11 | Original | $5.000 | $20.000 | **$26.000** |
| iPhone 11 Pro | Original | $18.000 | $20.000 | **$41.000** |
| iPhone 11 Pro Max | Original | $20.000 | $20.000 | **$43.000** |
| iPhone 12 Mini | Original | $7.000 | $25.000 | **$34.000** |
| iPhone 12 Pro Max | Original | $7.000 | $25.000 | **$34.000** |
| iPhone 12 / 12 Pro | Original | $5.000 | $25.000 | **$31.000** |
| iPhone 13 | Original | $6.500 | $25.000 | **$33.000** |
| iPhone 13 Mini | Original | $7.000 | $25.000 | **$34.000** |
| iPhone 13 Pro | Original | $7.000 | $25.000 | **$34.000** |
| iPhone 13 Pro Max | Original | $8.000 | $25.000 | **$35.000** |
| iPhone 14 | Original | $7.000 | $25.000 | **$34.000** |
| iPhone 14 Plus | Original | $10.000 | $25.000 | **$37.000** |
| iPhone 14 Pro | Original | $8.000 | $25.000 | **$35.000** |
| iPhone 14 Pro Max | Original | $9.000 | $25.000 | **$36.000** |
| iPhone 15 | Original | $25.000 | $25.000 | **$54.000** |
| iPhone 15 Plus | Original | $17.000 | $25.000 | **$45.000** |
| iPhone 15 Pro | Original | $32.000 | $25.000 | **$62.000** |
| iPhone 15 Pro Max | Original | $35.000 | $25.000 | **$66.000** |
| iPhone 16 | Original | $20.000 | $25.000 | **$48.000** |
| iPhone 16 Pro | Original | $9.000 | $25.000 | **$36.000** |
| iPhone 16 Pro Max | Original | $9.000 | $25.000 | **$36.000** |
| iPhone SE 2020 | Original | $3.500 | $20.000 | **$25.000** |
| iPhone SE 2022 | Original | $3.500 | $20.000 | **$25.000** |
| iPhone X | Original | $4.000 | $20.000 | **$25.000** |
| iPhone XR | Original | $4.000 | $20.000 | **$25.000** |
| iPhone XS | Original | $5.000 | $20.000 | **$26.000** |
| iPhone XS Max | Original | $5.000 | $20.000 | **$26.000** |

### Samsung · Cambio de pantalla (234)

| Equipo | Calidad | Repuesto | Mano de obra | **Precio estimado** |
|---|---|---:|---:|---:|
| Samsung A01 Core | Original | $9.000 | $20.000 | **$31.000** |
| Samsung A01 F | Original | $8.000 | $20.000 | **$30.000** |
| Samsung A01 M | Original | $9.000 | $20.000 | **$31.000** |
| Samsung A02 | Original | $11.000 | $20.000 | **$33.000** |
| Samsung A02S | Original | $12.000 | $20.000 | **$34.000** |
| Samsung A02S / A03 / A03S / A04E | Original | $9.000 | $20.000 | **$31.000** |
| Samsung A03 Core | Original | $9.500 | $20.000 | **$31.000** |
| Samsung A03S | Original | $12.000 | $20.000 | **$34.000** |
| Samsung A04 | Original | $9.500 | $20.000 | **$31.000** |
| Samsung A04E | Original | $12.000 | $20.000 | **$34.000** |
| Samsung A04S | Original | $12.000 | $20.000 | **$34.000** |
| Samsung A04S / A04 Core | Original | $9.000 | $20.000 | **$31.000** |
| Samsung A05 | Original | $9.000 | $20.000 | **$31.000** |
| Samsung A05S | Original | $11.000 | $20.000 | **$33.000** |
| Samsung A06 4G | Original | $9.500 | $20.000 | **$31.000** |
| Samsung A06 5G | Original | $9.000 | $20.000 | **$31.000** |
| Samsung A07 | Original | $10.000 | $20.000 | **$32.000** |
| Samsung A7 2018 | Incell | $11.000 | $20.000 | **$33.000** |
| Samsung A7 2018 | OLED | $32.000 | $25.000 | **$62.000** |
| Samsung A8 Plus | OLED | $28.000 | $25.000 | **$58.000** |
| Samsung A8 2018 | OLED | $29.000 | $25.000 | **$59.000** |
| Samsung A9 2018 | OLED | $31.000 | $25.000 | **$61.000** |
| Samsung A10 | Original | $9.000 | $20.000 | **$31.000** |
| Samsung A10S | Original | $9.000 | $20.000 | **$31.000** |
| Samsung A11 | Original | $9.500 | $20.000 | **$31.000** |
| Samsung A12 | Original | $9.500 | $20.000 | **$31.000** |
| Samsung A13 4G | Original | $10.000 | $20.000 | **$32.000** |
| Samsung A13 5G | Original | $12.000 | $20.000 | **$34.000** |
| Samsung A14 5G | Original | $12.000 | $20.000 | **$34.000** |
| Samsung A14 A146P · 4G | Original | $10.000 | $20.000 | **$32.000** |
| Samsung A14 A146B · 5G | Original | $11.000 | $20.000 | **$33.000** |
| Samsung A15 | Incell | $12.000 | $20.000 | **$34.000** |
| Samsung A15 | OLED | $34.000 | $25.000 | **$65.000** |
| Samsung A15 | Original | $58.000 | $20.000 | **$87.000** |
| Samsung A15 4G / 5G · small glass | OLED | $29.000 | $25.000 | **$59.000** |
| Samsung A16 4G | Incell | $14.000 | $20.000 | **$37.000** |
| Samsung A16 4G | OLED | $45.000 | $25.000 | **$77.000** |
| Samsung A16 4G Nueva Versión | OLED | $39.000 | $25.000 | **$70.000** |
| Samsung A16 5G | Incell | $13.000 | $20.000 | **$35.000** |
| Samsung A16 5G | Original | $74.000 | $20.000 | **$106.000** |
| Samsung A16 A166B · 5G | OLED | $48.000 | $25.000 | **$81.000** |
| Samsung A17 5G | Original | $74.000 | $20.000 | **$106.000** |
| Samsung A17 5G · big glass | OLED | $44.000 | $25.000 | **$76.000** |
| Samsung A17 5G · small glass | Incell | $14.000 | $20.000 | **$37.000** |
| Samsung A20 | Incell | $11.000 | $20.000 | **$33.000** |
| Samsung A20 | OLED | $23.000 | $25.000 | **$52.000** |
| Samsung A20S | Original | $9.500 | $20.000 | **$31.000** |
| Samsung A21S | Original | $9.500 | $20.000 | **$31.000** |
| Samsung A22 4G | Incell | $12.000 | $20.000 | **$34.000** |
| Samsung A22 4G | OLED | $28.000 | $25.000 | **$58.000** |
| Samsung A22 4G | Original | $33.000 | $20.000 | **$58.000** |
| Samsung A22 5G | Original | $10.500 | $20.000 | **$33.000** |
| Samsung A23 4G | Original | $10.000 | $20.000 | **$32.000** |
| Samsung A23 5G | Original | $10.000 | $20.000 | **$32.000** |
| Samsung A24 | Incell | $13.000 | $20.000 | **$35.000** |
| Samsung A24 | OLED | $29.000 | $25.000 | **$59.000** |
| Samsung A24 | Original | $79.000 | $20.000 | **$111.000** |
| Samsung A25 | Incell | $13.000 | $20.000 | **$35.000** |
| Samsung A25 | Original | $85.000 | $20.000 | **$118.000** |
| Samsung A25 5G · big glass · A256 B / A256E / A256U | OLED | $32.000 | $25.000 | **$62.000** |
| Samsung A26 | Original | $70.000 | $20.000 | **$101.000** |
| Samsung A26 5G | Incell | $15.000 | $20.000 | **$38.000** |
| Samsung A26 5G · big glass | OLED | $45.000 | $25.000 | **$77.000** |
| Samsung A30S | Incell | $11.000 | $20.000 | **$33.000** |
| Samsung A30S | OLED | $23.000 | $25.000 | **$52.000** |
| Samsung A30S | Original | $59.000 | $20.000 | **$88.000** |
| Samsung A30 / A50 | Incell | $12.000 | $20.000 | **$34.000** |
| Samsung A30 / A50 | OLED | $25.000 | $25.000 | **$54.000** |
| Samsung A31 | Incell | $11.000 | $20.000 | **$33.000** |
| Samsung A31 | OLED | $27.000 | $25.000 | **$57.000** |
| Samsung A32 4G | Incell | $12.000 | $20.000 | **$34.000** |
| Samsung A32 4G | OLED | $27.000 | $25.000 | **$57.000** |
| Samsung A32 4G | Original | $68.000 | $20.000 | **$99.000** |
| Samsung A32 5G | Original | $11.000 | $20.000 | **$33.000** |
| Samsung A33 | Incell | $15.000 | $20.000 | **$38.000** |
| Samsung A33 | OLED | $33.000 | $25.000 | **$63.000** |
| Samsung A33 | Original | $82.000 | $20.000 | **$115.000** |
| Samsung A34 | Incell | $15.000 | $20.000 | **$38.000** |
| Samsung A34 | OLED | $33.000 | $25.000 | **$63.000** |
| Samsung A34 | Original | $98.000 | $20.000 | **$133.000** |
| Samsung A35 | Incell | $15.000 | $20.000 | **$38.000** |
| Samsung A35 | OLED | $36.000 | $25.000 | **$67.000** |
| Samsung A35 | Original | $86.000 | $20.000 | **$119.000** |
| Samsung A36 | Incell | $16.000 | $20.000 | **$39.000** |
| Samsung A36 | OLED | $35.000 | $25.000 | **$66.000** |
| Samsung A36 | Original | $92.000 | $20.000 | **$126.000** |
| Samsung A37 | OLED | $35.000 | $25.000 | **$66.000** |
| Samsung A40 | Original | $52.000 | $20.000 | **$80.000** |
| Samsung A42 | OLED | $22.500 | $25.000 | **$51.000** |
| Samsung A50 | Original | $45.000 | $20.000 | **$72.000** |
| Samsung A50S | OLED | $19.000 | $25.000 | **$47.000** |
| Samsung A51 | Incell | $12.000 | $20.000 | **$34.000** |
| Samsung A51 | OLED | $20.000 | $25.000 | **$48.000** |
| Samsung A51 | Original | $69.000 | $20.000 | **$100.000** |
| Samsung A52 / A52S | Incell | $15.000 | $20.000 | **$38.000** |
| Samsung A52 / A52S | OLED | $32.000 | $25.000 | **$62.000** |
| Samsung A52 / A52S | Original | $69.990 | $20.000 | **$101.000** |
| Samsung A53 | Incell | $15.000 | $20.000 | **$38.000** |
| Samsung A53 | OLED | $33.000 | $25.000 | **$63.000** |
| Samsung A53 | Original | $85.000 | $20.000 | **$118.000** |
| Samsung A54 | Incell | $15.000 | $20.000 | **$38.000** |
| Samsung A54 | OLED | $26.000 | $25.000 | **$55.000** |
| Samsung A54 | Original | $87.000 | $20.000 | **$121.000** |
| Samsung A55 | Incell | $18.000 | $20.000 | **$41.000** |
| Samsung A55 | OLED | $38.000 | $25.000 | **$69.000** |
| Samsung A55 | Original | $92.000 | $20.000 | **$126.000** |
| Samsung A56 | Incell | $23.000 | $20.000 | **$47.000** |
| Samsung A56 | OLED | $38.000 | $25.000 | **$69.000** |
| Samsung A56 | Original | $99.000 | $20.000 | **$134.000** |
| Samsung A57 5G | OLED | $44.000 | $25.000 | **$76.000** |
| Samsung A57 5G | Original | $125.000 | $20.000 | **$164.000** |
| Samsung A70 | Incell | $13.000 | $20.000 | **$35.000** |
| Samsung A70 | OLED | $27.000 | $25.000 | **$57.000** |
| Samsung A70 | Original | $64.000 | $20.000 | **$94.000** |
| Samsung A70S | Original | $76.000 | $20.000 | **$108.000** |
| Samsung A71 | Incell | $12.000 | $20.000 | **$34.000** |
| Samsung A71 | OLED | $25.000 | $25.000 | **$54.000** |
| Samsung A71 | Original | $84.000 | $20.000 | **$117.000** |
| Samsung A72 | Incell | $15.000 | $20.000 | **$38.000** |
| Samsung A72 | OLED | $36.000 | $25.000 | **$67.000** |
| Samsung A72 | Original | $88.000 | $20.000 | **$122.000** |
| Samsung A73 | Incell | $14.000 | $20.000 | **$37.000** |
| Samsung A73 | OLED | $37.000 | $25.000 | **$68.000** |
| Samsung A73 | Original | $60.000 | $20.000 | **$89.000** |
| Samsung A80 | OLED | $58.000 | $25.000 | **$92.000** |
| Samsung A80 | Original | $89.000 | $20.000 | **$123.000** |
| Samsung A90 | Original | $48.000 | $20.000 | **$76.000** |
| Samsung J1 / J1 Ace | Incell | $10.000 | $20.000 | **$32.000** |
| Samsung J1 / J1 Ace | OLED | $14.500 | $25.000 | **$42.000** |
| Samsung J2 Core | Original | $9.000 | $20.000 | **$31.000** |
| Samsung J2 Pro | OLED | $16.000 | $25.000 | **$44.000** |
| Samsung J3 | OLED | $16.000 | $25.000 | **$44.000** |
| Samsung J4 | OLED | $23.000 | $25.000 | **$52.000** |
| Samsung J4 Plus / J6 Plus / J4 Core | Original | $9.000 | $20.000 | **$31.000** |
| Samsung J5 | OLED | $16.000 | $25.000 | **$44.000** |
| Samsung J5 Prime | Original | $7.700 | $20.000 | **$29.000** |
| Samsung J5 Pro | OLED | $16.000 | $25.000 | **$44.000** |
| Samsung J5 2016 | OLED | $16.000 | $25.000 | **$44.000** |
| Samsung J6 | Incell | $10.000 | $20.000 | **$32.000** |
| Samsung J6 | OLED | $32.000 | $25.000 | **$62.000** |
| Samsung J7 | OLED | $16.000 | $25.000 | **$44.000** |
| Samsung J7 Neo | OLED | $16.000 | $25.000 | **$44.000** |
| Samsung J7 Pro | OLED | $21.000 | $25.000 | **$50.000** |
| Samsung J7 Prime / J7 Prime 2 | Original | $14.000 | $20.000 | **$37.000** |
| Samsung J7 2016 | OLED | $16.000 | $25.000 | **$44.000** |
| Samsung J8 | Incell | $10.000 | $20.000 | **$32.000** |
| Samsung J8 | OLED | $33.000 | $25.000 | **$63.000** |
| Samsung M20 | Original | $8.000 | $20.000 | **$30.000** |
| Samsung M31 | OLED | $19.000 | $25.000 | **$47.000** |
| Samsung M32 | OLED | $19.000 | $25.000 | **$47.000** |
| Samsung M33 | OLED | $15.000 | $25.000 | **$43.000** |
| Samsung M33 5G | Original | $12.000 | $20.000 | **$34.000** |
| Samsung M34 | OLED | $37.000 | $25.000 | **$68.000** |
| Samsung M51 | OLED | $24.000 | $25.000 | **$53.000** |
| Samsung Note 8 | Original | $145.000 | $35.000 | **$202.000** |
| Samsung Note 9 | Original | $140.000 | $35.000 | **$196.000** |
| Samsung Note 10 | Original | $129.000 | $35.000 | **$184.000** |
| Samsung Note 10 Lite | OLED | $65.000 | $35.000 | **$110.000** |
| Samsung Note 10 Lite | Original | $143.000 | $35.000 | **$200.000** |
| Samsung Note 10 Plus | OLED | $68.000 | $35.000 | **$114.000** |
| Samsung Note 10 Plus | Original | $179.000 | $35.000 | **$241.000** |
| Samsung Note 20 | OLED | $65.000 | $35.000 | **$110.000** |
| Samsung Note 20 | Original | $94.500 | $35.000 | **$144.000** |
| Samsung Note 20 Ultra | OLED | $85.000 | $35.000 | **$133.000** |
| Samsung Note 20 Ultra | Original | $224.000 | $35.000 | **$293.000** |
| Samsung S6 Edge | Original | $60.000 | $35.000 | **$104.000** |
| Samsung S7 | Original | $39.900 | $35.000 | **$81.000** |
| Samsung S7 Edge | Original | $85.000 | $35.000 | **$133.000** |
| Samsung S8 | OLED | $75.000 | $35.000 | **$122.000** |
| Samsung S8 | Original | $98.000 | $35.000 | **$148.000** |
| Samsung S8 Plus | OLED | $85.000 | $35.000 | **$133.000** |
| Samsung S8 Plus | Original | $120.000 | $35.000 | **$173.000** |
| Samsung S9 | Original | $102.000 | $35.000 | **$153.000** |
| Samsung S9 Plus | OLED | $95.000 | $35.000 | **$145.000** |
| Samsung S9 Plus | Original | $102.000 | $35.000 | **$153.000** |
| Samsung S10 | Original | $129.000 | $35.000 | **$184.000** |
| Samsung S10 Lite | Original | $99.000 | $35.000 | **$149.000** |
| Samsung S10 Plus | OLED | $139.000 | $35.000 | **$195.000** |
| Samsung S10 Plus | Original | $168.000 | $35.000 | **$229.000** |
| Samsung S10E | Original | $79.000 | $20.000 | **$111.000** |
| Samsung S20 | Incell | $28.000 | $35.000 | **$68.000** |
| Samsung S20 | OLED | $94.000 | $35.000 | **$144.000** |
| Samsung S20 | Original | $135.000 | $35.000 | **$191.000** |
| Samsung S20 Fe | Incell | $18.000 | $35.000 | **$56.000** |
| Samsung S20 Fe | OLED | $32.000 | $35.000 | **$72.000** |
| Samsung S20 Fe | Original | $77.000 | $35.000 | **$124.000** |
| Samsung S20 Plus | OLED | $64.000 | $35.000 | **$109.000** |
| Samsung S20 Plus | Original | $178.000 | $35.000 | **$240.000** |
| Samsung S20 Ultra | OLED | $91.000 | $35.000 | **$140.000** |
| Samsung S20 Ultra | Original | $189.000 | $35.000 | **$253.000** |
| Samsung S21 | OLED | $97.000 | $35.000 | **$147.000** |
| Samsung S21 | Original | $120.000 | $35.000 | **$173.000** |
| Samsung S21 Fe | Incell | $23.000 | $35.000 | **$62.000** |
| Samsung S21 Fe | OLED | $39.000 | $35.000 | **$80.000** |
| Samsung S21 Fe | Original | $123.000 | $35.000 | **$177.000** |
| Samsung S21 Plus | OLED | $70.000 | $35.000 | **$116.000** |
| Samsung S21 Plus | Original | $114.000 | $35.000 | **$167.000** |
| Samsung S21 Ultra | OLED | $86.000 | $35.000 | **$134.000** |
| Samsung S21 Ultra | Original | $207.000 | $35.000 | **$274.000** |
| Samsung S22 | OLED | $129.000 | $35.000 | **$184.000** |
| Samsung S22 | Original | $169.000 | $35.000 | **$230.000** |
| Samsung S22 Plus | Original | $145.000 | $35.000 | **$202.000** |
| Samsung S22 Ultra | OLED | $84.000 | $35.000 | **$132.000** |
| Samsung S22 Ultra | Original | $279.000 | $35.000 | **$356.000** |
| Samsung S23 | OLED | $145.000 | $35.000 | **$202.000** |
| Samsung S23 | Original | $179.000 | $35.000 | **$241.000** |
| Samsung S23 Fe | OLED | $60.000 | $35.000 | **$104.000** |
| Samsung S23 Fe | Original | $78.000 | $35.000 | **$125.000** |
| Samsung S23 Plus | OLED | $89.000 | $35.000 | **$138.000** |
| Samsung S23 Plus | Original | $139.000 | $35.000 | **$195.000** |
| Samsung S23 Ultra | OLED | $88.000 | $35.000 | **$137.000** |
| Samsung S23 Ultra | Original | $289.000 | $35.000 | **$368.000** |
| Samsung S24 | Original | $165.000 | $35.000 | **$225.000** |
| Samsung S24 Fe | OLED | $45.000 | $35.000 | **$87.000** |
| Samsung S24 Fe | Original | $95.000 | $35.000 | **$145.000** |
| Samsung S24 Plus | Original | $199.000 | $35.000 | **$264.000** |
| Samsung S24 Ultra | OLED | $158.000 | $35.000 | **$217.000** |
| Samsung S24 Ultra | Original 100% | $285.000 | $35.000 | **$363.000** |
| Samsung S25 | Original | $165.000 | $35.000 | **$225.000** |
| Samsung S25 Fe | OLED | $48.000 | $35.000 | **$91.000** |
| Samsung S25 Fe | Original | $129.000 | $35.000 | **$184.000** |
| Samsung S25 Plus | Original | $220.000 | $35.000 | **$288.000** |
| Samsung S25 Ultra | OLED | $108.000 | $35.000 | **$160.000** |
| Samsung S25 Ultra | Original | $267.000 | $35.000 | **$343.000** |
| Samsung S26 | Original | $240.000 | $35.000 | **$311.000** |
| Samsung S26 Ultra | Original | $326.000 | $35.000 | **$410.000** |
| Samsung Z Flip | Original | $238.000 | $35.000 | **$309.000** |
| Samsung Z Flip 3 | Original | $195.000 | $35.000 | **$260.000** |
| Samsung Z Flip 4 | Original | $345.000 | $35.000 | **$432.000** |
| Samsung Z Flip 5 | Original | $315.000 | $35.000 | **$398.000** |
| Samsung Z Flip 6 | Original | $339.000 | $35.000 | **$425.000** |
| Samsung Z Fold 3 | Original | $329.000 | $35.000 | **$414.000** |
| Samsung Z Fold 4 | Original | $395.000 | $35.000 | **$490.000** |
| Samsung Z Fold 5 | Original | $475.000 | $35.000 | **$582.000** |

### Samsung · Cambio de batería (59)

| Equipo | Calidad | Repuesto | Mano de obra | **Precio estimado** |
|---|---|---:|---:|---:|
| Samsung A01 | Normal | $7.000 | $15.000 | **$24.000** |
| Samsung A01 Core | Normal | $7.000 | $15.000 | **$24.000** |
| Samsung A02S / A03 / A03S | Normal | $8.000 | $15.000 | **$25.000** |
| Samsung A02 / A04S / A12 / A13 4G / A21S | Normal | $8.000 | $15.000 | **$25.000** |
| Samsung A04 | Normal | $9.000 | $15.000 | **$26.000** |
| Samsung A05 | Normal | $8.000 | $15.000 | **$25.000** |
| Samsung A05S | Normal | $9.000 | $15.000 | **$26.000** |
| Samsung A06 | Normal | $10.000 | $15.000 | **$27.000** |
| Samsung A7 2018 | Normal | $7.000 | $15.000 | **$24.000** |
| Samsung A10 | Normal | $4.000 | $15.000 | **$20.000** |
| Samsung A10S / A20S / A11 | Normal | $8.000 | $15.000 | **$25.000** |
| Samsung A15 | Normal | $9.000 | $15.000 | **$26.000** |
| Samsung A16 5G | Normal | $9.000 | $15.000 | **$26.000** |
| Samsung A20 / A30 / A30S / A50 | Normal | $7.000 | $15.000 | **$24.000** |
| Samsung A22 4G / A31 / A32 4G | Normal | $8.000 | $15.000 | **$25.000** |
| Samsung A22 5G | Normal | $8.000 | $15.000 | **$25.000** |
| Samsung A33 / A53 | Normal | $9.000 | $15.000 | **$26.000** |
| Samsung A51 | Normal | $8.000 | $15.000 | **$25.000** |
| Samsung A52 / A52S / S20 Fe | Normal | $8.000 | $15.000 | **$25.000** |
| Samsung A54 / A34 / A55 / A25 / A35 | Normal | $9.000 | $15.000 | **$26.000** |
| Samsung A70 | Normal | $8.000 | $15.000 | **$25.000** |
| Samsung A71 | Normal | $8.000 | $15.000 | **$25.000** |
| Samsung A73 | Normal | $8.000 | $15.000 | **$25.000** |
| Samsung I9080 Samsung J2 | Normal | $2.500 | $15.000 | **$18.000** |
| Samsung J2 / Core Prime | Normal | $2.000 | $15.000 | **$18.000** |
| Samsung J6 / J8 | Normal | $6.000 | $15.000 | **$22.000** |
| Samsung J7 Prime / J4 Plus / J6 Plus | Normal | $5.500 | $15.000 | **$22.000** |
| Samsung J7 / J7 Neo / J7 Duos / J4 | Normal | $3.900 | $15.000 | **$20.000** |
| Samsung J7 2016 | Normal | $5.500 | $15.000 | **$22.000** |
| Samsung Note 9 | Normal | $9.000 | $15.000 | **$26.000** |
| Samsung Note 10 Lite | Normal | $8.000 | $15.000 | **$25.000** |
| Samsung Note 10 Plus | Normal | $9.000 | $15.000 | **$26.000** |
| Samsung Note 20 | Normal | $8.000 | $15.000 | **$25.000** |
| Samsung Note 20 Ultra | Normal | $8.500 | $15.000 | **$25.000** |
| Samsung S7 | Normal | $5.900 | $15.000 | **$22.000** |
| Samsung S7 Edge | Normal | $6.500 | $15.000 | **$23.000** |
| Samsung S8 | Normal | $7.000 | $15.000 | **$24.000** |
| Samsung S8 Plus | Normal | $8.000 | $15.000 | **$25.000** |
| Samsung S9 | Normal | $7.500 | $15.000 | **$24.000** |
| Samsung S9 Plus | Normal | $8.000 | $15.000 | **$25.000** |
| Samsung S10 | Normal | $8.000 | $15.000 | **$25.000** |
| Samsung S10 Plus | Normal | $9.000 | $15.000 | **$26.000** |
| Samsung S20 | Normal | $8.000 | $15.000 | **$25.000** |
| Samsung S20 Plus | Normal | $9.000 | $15.000 | **$26.000** |
| Samsung S20 Ultra | Normal | $8.000 | $15.000 | **$25.000** |
| Samsung S21 | Normal | $8.000 | $15.000 | **$25.000** |
| Samsung S21 Fe | Normal | $9.000 | $15.000 | **$26.000** |
| Samsung S21 Plus | Normal | $8.000 | $15.000 | **$25.000** |
| Samsung S21 Ultra | Normal | $8.500 | $15.000 | **$25.000** |
| Samsung S22 | Normal | $8.500 | $15.000 | **$25.000** |
| Samsung S22 Plus | Normal | $9.000 | $15.000 | **$26.000** |
| Samsung S22 Ultra | Normal | $8.500 | $15.000 | **$25.000** |
| Samsung S23 | Normal | $8.500 | $15.000 | **$25.000** |
| Samsung S23 Fe | Normal | $9.500 | $15.000 | **$26.000** |
| Samsung S23 Ultra | Normal | $9.000 | $15.000 | **$26.000** |
| Samsung S24 | Normal | $9.500 | $15.000 | **$26.000** |
| Samsung S24 Fe | Normal | $9.000 | $15.000 | **$26.000** |
| Samsung S24 Plus | Normal | $9.500 | $15.000 | **$26.000** |
| Samsung S24 Ultra | Normal | $9.500 | $15.000 | **$26.000** |

### Samsung · Cambio de puerto de carga (119)

| Equipo | Calidad | Repuesto | Mano de obra | **Precio estimado** |
|---|---|---:|---:|---:|
| Samsung A01 | Original | $5.000 | $15.000 | **$21.000** |
| Samsung A01 Core | Original | $5.000 | $15.000 | **$21.000** |
| Samsung A02 | Original | $4.000 | $15.000 | **$20.000** |
| Samsung A02S / A03S | Original | $3.500 | $15.000 | **$20.000** |
| Samsung A03 | Original | $3.000 | $15.000 | **$19.000** |
| Samsung A03 Core | Original | $3.000 | $15.000 | **$19.000** |
| Samsung A04 | Original | $3.500 | $15.000 | **$20.000** |
| Samsung A04E | Original | $4.000 | $15.000 | **$20.000** |
| Samsung A04S | Original | $3.500 | $15.000 | **$20.000** |
| Samsung A05 | Original | $3.500 | $15.000 | **$20.000** |
| Samsung A05S | Original | $3.500 | $15.000 | **$20.000** |
| Samsung A06 4G | Original | $3.000 | $15.000 | **$19.000** |
| Samsung A06 5G | Original | $3.500 | $15.000 | **$20.000** |
| Samsung A07 | Original | $4.000 | $15.000 | **$20.000** |
| Samsung A7 2018 | Original | $3.500 | $15.000 | **$20.000** |
| Samsung A8 2018 | Original | $1.000 | $15.000 | **$17.000** |
| Samsung A9 2018 | Original | $7.000 | $15.000 | **$24.000** |
| Samsung A10 | Original | $3.500 | $15.000 | **$20.000** |
| Samsung A10S | Original | $3.000 | $15.000 | **$19.000** |
| Samsung A11 | Original | $3.000 | $15.000 | **$19.000** |
| Samsung A12 | Original | $3.500 | $15.000 | **$20.000** |
| Samsung A12 / Version A127_00 | Original | $3.500 | $15.000 | **$20.000** |
| Samsung A13 4G | Original | $3.500 | $15.000 | **$20.000** |
| Samsung A13 5G | Original | $3.500 | $15.000 | **$20.000** |
| Samsung A14 4G A146P | Original | $3.500 | $15.000 | **$20.000** |
| Samsung A14 5G A146B | Original | $3.500 | $15.000 | **$20.000** |
| Samsung A15 Version 4G-5G | Original | $3.500 | $15.000 | **$20.000** |
| Samsung A16 | Original | $4.000 | $15.000 | **$20.000** |
| Samsung A17 5G | Original | $4.000 | $15.000 | **$20.000** |
| Samsung A20 | Original | $3.500 | $15.000 | **$20.000** |
| Samsung A20S | Original | $3.000 | $15.000 | **$19.000** |
| Samsung A21 | Original | $3.000 | $15.000 | **$19.000** |
| Samsung A21S | Original | $3.000 | $15.000 | **$19.000** |
| Samsung A22 4G | Original | $3.500 | $15.000 | **$20.000** |
| Samsung A22 5G | Original | $3.500 | $15.000 | **$20.000** |
| Samsung A23 4G | Original | $5.000 | $15.000 | **$21.000** |
| Samsung A23 5G | Original | $6.000 | $15.000 | **$22.000** |
| Samsung A24 | Original | $3.500 | $15.000 | **$20.000** |
| Samsung A25 | Original | $4.000 | $15.000 | **$20.000** |
| Samsung A26 | Original | $3.500 | $15.000 | **$20.000** |
| Samsung A30 | Original | $3.500 | $15.000 | **$20.000** |
| Samsung A30S | Original | $3.500 | $15.000 | **$20.000** |
| Samsung A31 | Original | $3.500 | $15.000 | **$20.000** |
| Samsung A31S | Original | $3.500 | $15.000 | **$20.000** |
| Samsung A32 4G | Original | $3.500 | $15.000 | **$20.000** |
| Samsung A32 5G | Original | $6.000 | $15.000 | **$22.000** |
| Samsung A33 | Original | $3.500 | $15.000 | **$20.000** |
| Samsung A34 | Original | $4.000 | $15.000 | **$20.000** |
| Samsung A35 | Original | $4.000 | $15.000 | **$20.000** |
| Samsung A36 | Original | $9.000 | $15.000 | **$26.000** |
| Samsung A50 | Original | $3.500 | $15.000 | **$20.000** |
| Samsung A50S | Original | $3.000 | $15.000 | **$19.000** |
| Samsung A51 | Original | $3.500 | $15.000 | **$20.000** |
| Samsung A52S | Original | $8.000 | $15.000 | **$25.000** |
| Samsung A52 4G | Original | $9.000 | $15.000 | **$26.000** |
| Samsung A52 5G | Original | $9.000 | $15.000 | **$26.000** |
| Samsung A53 | Original | $4.000 | $15.000 | **$20.000** |
| Samsung A54 | Original | $4.000 | $15.000 | **$20.000** |
| Samsung A55 | Original | $4.500 | $15.000 | **$21.000** |
| Samsung A56 | Original | $6.000 | $15.000 | **$22.000** |
| Samsung A70 | Original | $4.500 | $15.000 | **$21.000** |
| Samsung A70S | Original | $3.500 | $15.000 | **$20.000** |
| Samsung A71 | Original | $5.000 | $15.000 | **$21.000** |
| Samsung A72 | Original | $9.000 | $15.000 | **$26.000** |
| Samsung A73 | Original | $7.000 | $15.000 | **$24.000** |
| Samsung A80 | Original | $9.000 | $15.000 | **$26.000** |
| Samsung M31 | Original | $5.000 | $15.000 | **$21.000** |
| Samsung M51 | Original | $6.000 | $15.000 | **$22.000** |
| Samsung Note 8 | Original | $5.000 | $15.000 | **$21.000** |
| Samsung Note 9 | Original | $5.000 | $15.000 | **$21.000** |
| Samsung Note 10 | Original | $10.000 | $15.000 | **$27.000** |
| Samsung Note 10 Lite | Original | $4.000 | $15.000 | **$20.000** |
| Samsung Note 10 Plus | Original | $6.000 | $15.000 | **$22.000** |
| Samsung Note 20 | Original | $4.500 | $15.000 | **$21.000** |
| Samsung Note 20 Plus | Original | $7.000 | $15.000 | **$24.000** |
| Samsung Note 20 Ultra | Original | $5.000 | $15.000 | **$21.000** |
| Samsung P5210 | Original | $5.000 | $15.000 | **$21.000** |
| Samsung S5 | Original | $6.000 | $15.000 | **$22.000** |
| Samsung S6 | Original | $4.000 | $15.000 | **$20.000** |
| Samsung S6 Edge | Original | $4.000 | $15.000 | **$20.000** |
| Samsung S7 | Original | $4.000 | $15.000 | **$20.000** |
| Samsung S7 Edge | Original | $3.000 | $15.000 | **$19.000** |
| Samsung S8 | Original | $4.000 | $15.000 | **$20.000** |
| Samsung S8 Plus | Original | $4.000 | $15.000 | **$20.000** |
| Samsung S9 Plus | Original | $5.000 | $15.000 | **$21.000** |
| Samsung S9 Version F | Original | $6.000 | $15.000 | **$22.000** |
| Samsung S9 G960U | Original | $5.000 | $15.000 | **$21.000** |
| Samsung S10 Lite | Original | $8.000 | $15.000 | **$25.000** |
| Samsung S20 | Original | $6.000 | $15.000 | **$22.000** |
| Samsung S20 Plus | Original | $7.000 | $15.000 | **$24.000** |
| Samsung S20 Ultra | Original | $9.000 | $15.000 | **$26.000** |
| Samsung S20 Fe 4G · (03D) | Original | $4.500 | $15.000 | **$21.000** |
| Samsung S20 Fe 5G · (03A) | Original | $6.000 | $15.000 | **$22.000** |
| Samsung S21 Fe | Original | $7.000 | $15.000 | **$24.000** |
| Samsung S21 Plus Version B | Original | $9.000 | $15.000 | **$26.000** |
| Samsung S21 Plus Version U | Original | $10.000 | $15.000 | **$27.000** |
| Samsung S21 Ultra | Original | $8.000 | $15.000 | **$25.000** |
| Samsung S21 Version B | Original | $7.000 | $15.000 | **$24.000** |
| Samsung S21 Version U | Original | $7.000 | $15.000 | **$24.000** |
| Samsung S22 | Original | $8.000 | $15.000 | **$25.000** |
| Samsung S22 Ultra Version B | Original | $8.000 | $15.000 | **$25.000** |
| Samsung S22 Plus (S906B) | Original | $10.000 | $15.000 | **$27.000** |
| Samsung S22 Plus (S906U) | Original | $10.000 | $15.000 | **$27.000** |
| Samsung S22 Ultra / Version Americana S908U | Original | $7.000 | $15.000 | **$24.000** |
| Samsung S23 | Original | $9.000 | $15.000 | **$26.000** |
| Samsung S23 Fe | Original | $6.000 | $15.000 | **$22.000** |
| Samsung S23 Plus | Original | $9.000 | $15.000 | **$26.000** |
| Samsung S23 Ultra | Original | $9.000 | $15.000 | **$26.000** |
| Samsung S24 | Original | $7.000 | $15.000 | **$24.000** |
| Samsung S24 Fe | Original | $6.000 | $15.000 | **$22.000** |
| Samsung S24 Ultra | Original | $9.000 | $15.000 | **$26.000** |
| Samsung S25 | Original | $9.000 | $15.000 | **$26.000** |
| Samsung S25 Ultra | Original | $10.000 | $15.000 | **$27.000** |
| Samsung Tab A9 X110 / X115 | Original | $4.000 | $15.000 | **$20.000** |
| Samsung X200 | Original | $4.000 | $15.000 | **$20.000** |
| Samsung X210 | Original | $5.000 | $15.000 | **$21.000** |
| Samsung Z3 Flip | Original | $5.000 | $15.000 | **$21.000** |
| Samsung Z4 Flip | Original | $5.000 | $15.000 | **$21.000** |
| Samsung Z Flip | Original | $5.000 | $15.000 | **$21.000** |

### Motorola · Cambio de pantalla (99)

| Equipo | Calidad | Repuesto | Mano de obra | **Precio estimado** |
|---|---|---:|---:|---:|
| Moto E4 Plus | Original | $16.000 | $20.000 | **$39.000** |
| Moto E5 Play | Original | $14.000 | $20.000 | **$37.000** |
| Moto E5 Plus | Original | $12.000 | $20.000 | **$34.000** |
| Moto E6 Play | Original | $10.000 | $20.000 | **$32.000** |
| Moto E6 Plus | Original | $10.000 | $20.000 | **$32.000** |
| Moto E6I | Original | $11.000 | $20.000 | **$33.000** |
| Moto E6S | Original | $10.000 | $20.000 | **$32.000** |
| Moto E7 | Original | $10.000 | $20.000 | **$32.000** |
| Moto E7I / E7I Power / E7 Power | Original | $9.500 | $20.000 | **$31.000** |
| Moto E13 | Original | $9.500 | $20.000 | **$31.000** |
| Moto E20 | Original | $10.000 | $20.000 | **$32.000** |
| Moto E22 / E22I | Original | $9.500 | $20.000 | **$31.000** |
| Moto E30 / E40 | Original | $10.000 | $20.000 | **$32.000** |
| Moto E32 | Original | $11.000 | $20.000 | **$33.000** |
| Moto Edge 20 Lite | Incell | $14.000 | $35.000 | **$52.000** |
| Moto Edge 20 Lite | Original | $43.000 | $35.000 | **$85.000** |
| Moto Edge 20 / Edge 20 Pro | Original | $45.000 | $35.000 | **$87.000** |
| Moto Edge 30 Fusion | Incell | $29.000 | $35.000 | **$69.000** |
| Moto Edge 30 Fusion | Original 100% | $59.000 | $35.000 | **$103.000** |
| Moto Edge 30 Neo / Edge 30 Lite | Incell | $25.000 | $35.000 | **$64.000** |
| Moto Edge 30 Neo / Edge 30 Lite | Original | $68.000 | $35.000 | **$114.000** |
| Moto Edge 30 Pro / Edge X30 | Original | $45.000 | $35.000 | **$87.000** |
| Moto Edge 30 / G52 / G71S / G72 / G82 | Original | $40.000 | $35.000 | **$81.000** |
| Moto Edge 40 Pro | Original | $40.000 | $35.000 | **$81.000** |
| Moto Edge 40 / 40 Neo | Original 100% | $38.000 | $35.000 | **$79.000** |
| Moto Edge 50 Fusion | Incell | $30.000 | $35.000 | **$70.000** |
| Moto Edge 50 Fusion | Original | $41.000 | $35.000 | **$83.000** |
| Moto Edge 50 Neo | Original | $74.000 | $35.000 | **$121.000** |
| Moto Edge 50 Pro | Original | $40.000 | $35.000 | **$81.000** |
| Moto Edge 50 Ultra | Original | $74.000 | $35.000 | **$121.000** |
| Moto Edge 50 5G | Original | $40.000 | $35.000 | **$81.000** |
| Moto Edge 50 Fusion / G85 | Original 100% | $34.000 | $35.000 | **$75.000** |
| Moto Edge 60 Fusion | Incell | $31.000 | $35.000 | **$71.000** |
| Moto Edge 60 Fusion | Original | $39.000 | $35.000 | **$80.000** |
| Moto Edge 60 Pro | Original | $42.000 | $35.000 | **$84.000** |
| Moto Edge 60 4G | Original | $55.000 | $35.000 | **$99.000** |
| Moto G04 | Original | $12.000 | $20.000 | **$34.000** |
| Moto G04 / G04S / G24 / G24 Power / E14 | Original | $9.500 | $20.000 | **$31.000** |
| Moto G05 | Original | $10.000 | $20.000 | **$32.000** |
| Moto G06 | Original | $11.000 | $20.000 | **$33.000** |
| Moto G6 | Original | $8.000 | $20.000 | **$30.000** |
| Moto G6 Plus | Original | $9.000 | $20.000 | **$31.000** |
| Moto G6 Play / E5 | Original | $10.000 | $20.000 | **$32.000** |
| Moto G7 | Original | $10.000 | $20.000 | **$32.000** |
| Moto G7 Play | Original | $12.000 | $20.000 | **$34.000** |
| Moto G7 Plus | Original | $8.000 | $20.000 | **$30.000** |
| Moto G7 Power | Original | $11.000 | $20.000 | **$33.000** |
| Moto G8 | Original | $7.700 | $20.000 | **$29.000** |
| Moto G8 Play / One Macro | Original | $10.000 | $20.000 | **$32.000** |
| Moto G8 Plus | Original | $13.000 | $20.000 | **$35.000** |
| Moto G8 Power | Original | $12.000 | $20.000 | **$34.000** |
| Moto G8 Power Lite | Original | $10.000 | $20.000 | **$32.000** |
| Moto G9 Play | Original | $12.000 | $20.000 | **$34.000** |
| Moto G9 Plus | Original | $11.000 | $20.000 | **$33.000** |
| Moto G9 Power | Original | $11.000 | $20.000 | **$33.000** |
| Moto G9 Play / E7 Plus | Original | $9.500 | $20.000 | **$31.000** |
| Moto G13 / G23 | Original | $9.500 | $20.000 | **$31.000** |
| Moto G14 / G54 | Original | $10.500 | $20.000 | **$33.000** |
| Moto G20 / G30 | Original | $9.500 | $20.000 | **$31.000** |
| Moto G22 | Original | $12.000 | $20.000 | **$34.000** |
| Moto G22 / E32 | Original | $9.500 | $20.000 | **$31.000** |
| Moto G32 | Original | $13.000 | $20.000 | **$35.000** |
| Moto G34 | Original | $10.000 | $20.000 | **$32.000** |
| Moto G35 5G | Original | $11.000 | $20.000 | **$33.000** |
| Moto G42 | OLED | $29.000 | $25.000 | **$59.000** |
| Moto G50 | Original | $11.000 | $20.000 | **$33.000** |
| Moto G50 5G | Original | $10.000 | $20.000 | **$32.000** |
| Moto G51 | Original | $13.000 | $20.000 | **$35.000** |
| Moto G51 / G60 / G60S | Original | $11.000 | $20.000 | **$33.000** |
| Moto G53 | Original | $10.000 | $20.000 | **$32.000** |
| Moto G54 | Original | $14.000 | $20.000 | **$37.000** |
| Moto G55 5G | Original | $11.000 | $20.000 | **$33.000** |
| Moto G56 | Original | $12.000 | $20.000 | **$34.000** |
| Moto G60 | Original | $13.000 | $20.000 | **$35.000** |
| Moto G62 | Original | $13.000 | $20.000 | **$35.000** |
| Moto G71 / G31 / G41 | Incell | $12.000 | $20.000 | **$34.000** |
| Moto G71 / G31 / G41 | OLED | $27.000 | $25.000 | **$57.000** |
| Moto G73 | Original | $13.000 | $20.000 | **$35.000** |
| Moto G84 | Original | $40.000 | $20.000 | **$66.000** |
| Moto G85 | Original | $40.000 | $20.000 | **$66.000** |
| Moto G86 / G86 Power | Original | $40.000 | $20.000 | **$66.000** |
| Moto G100 | Original | $13.000 | $20.000 | **$35.000** |
| Moto G200 | Original | $16.000 | $20.000 | **$39.000** |
| Moto G 5G | Original | $9.500 | $20.000 | **$31.000** |
| Moto G Pure | Original | $15.000 | $20.000 | **$38.000** |
| Moto One | Original | $10.000 | $20.000 | **$32.000** |
| Moto One Action / One Vision | OLED | $31.000 | $25.000 | **$61.000** |
| Moto One Fusion | Original | $10.000 | $20.000 | **$32.000** |
| Moto One Fusion Plus | Original | $7.500 | $20.000 | **$29.000** |
| Moto One Hyper | Original | $10.000 | $20.000 | **$32.000** |
| Moto Razr 40 Ultra | Original | $143.000 | $35.000 | **$200.000** |
| Moto Razr 50 | Original | $133.000 | $35.000 | **$188.000** |
| Moto Razr 50 Ultra | Original | $138.000 | $35.000 | **$194.000** |
| Moto Razr 60 Ultra | Original | $210.000 | $35.000 | **$277.000** |
| Moto X4 | Original | $10.000 | $20.000 | **$32.000** |
| Moto Z | OLED | $21.000 | $25.000 | **$50.000** |
| Moto Z2 Play | OLED | $17.000 | $25.000 | **$45.000** |
| Moto Z3 Play | Original | $26.000 | $20.000 | **$50.000** |
| Moto Zplay | OLED | $15.000 | $25.000 | **$43.000** |

### Motorola · Cambio de batería (26)

| Equipo | Calidad | Repuesto | Mano de obra | **Precio estimado** |
|---|---|---:|---:|---:|
| Moto E6 Plus | Normal | $4.500 | $15.000 | **$21.000** |
| Moto E6I / E6 Play / E6S | Normal | $6.500 | $15.000 | **$23.000** |
| Moto E13 / E32 / G22 / E32S / G13 / G23 / G53 | Normal | $9.000 | $15.000 | **$26.000** |
| Moto E20 Xt2155-1 / G Pure Nt40 | Normal | $9.000 | $15.000 | **$26.000** |
| Moto E22 | Normal | $9.000 | $15.000 | **$26.000** |
| Moto E22I | Normal | $9.000 | $15.000 | **$26.000** |
| Moto Edge 30 Neo | Normal | $11.000 | $15.000 | **$28.000** |
| Moto Edge 40 | Normal | $11.000 | $15.000 | **$28.000** |
| Moto Edge 50 Fusion | Normal | $10.000 | $15.000 | **$27.000** |
| Moto G4 | Normal | $2.000 | $15.000 | **$18.000** |
| Moto G4 Play / G5 (Gk40) | Normal | $2.000 | $15.000 | **$18.000** |
| Moto G04 / G24 / G34 (Modelo Qf50) | Normal | $9.000 | $15.000 | **$26.000** |
| Moto G5 Plus | Normal | $2.500 | $15.000 | **$18.000** |
| Moto G6 Play / E5 Moto G7 | Normal | $6.000 | $15.000 | **$22.000** |
| Moto G8 Play | Normal | $8.000 | $15.000 | **$25.000** |
| Moto G8 Power | Normal | $10.000 | $15.000 | **$27.000** |
| Moto G9 Power | Normal | $10.000 | $15.000 | **$27.000** |
| Moto G14 / G54 (Pc50) | Normal | $9.000 | $15.000 | **$26.000** |
| Moto G50 5G | Normal | $9.000 | $15.000 | **$26.000** |
| Moto G53 | Normal | $9.000 | $15.000 | **$26.000** |
| Moto G100 | Normal | $10.000 | $15.000 | **$27.000** |
| Moto G200 | Normal | $9.000 | $15.000 | **$26.000** |
| Moto One Action / One Vision | Normal | $7.000 | $15.000 | **$24.000** |
| Moto One Fusion | Normal | $9.000 | $15.000 | **$26.000** |
| Moto One Hyper | Normal | $8.500 | $15.000 | **$25.000** |
| Moto Z2 Play | Normal | $4.500 | $15.000 | **$21.000** |

### Motorola · Cambio de puerto de carga (65)

| Equipo | Calidad | Repuesto | Mano de obra | **Precio estimado** |
|---|---|---:|---:|---:|
| Moto E4 | Original | $3.000 | $15.000 | **$19.000** |
| Moto E4 Plus | Original | $3.000 | $15.000 | **$19.000** |
| Moto E5 Play | Original | $3.500 | $15.000 | **$20.000** |
| Moto E5Plus | Original | $3.500 | $15.000 | **$20.000** |
| Moto E5 / G6 Play | Original | $3.500 | $15.000 | **$20.000** |
| Moto E6 Play | Original | $3.000 | $15.000 | **$19.000** |
| Moto E6 Plus | Original | $3.000 | $15.000 | **$19.000** |
| Moto E6I | Original | $3.000 | $15.000 | **$19.000** |
| Moto E6S | Original | $3.000 | $15.000 | **$19.000** |
| Moto E7 | Original | $4.000 | $15.000 | **$20.000** |
| Moto E7 Plus | Original | $4.000 | $15.000 | **$20.000** |
| Moto E7 Power / E7I Power | Original | $4.000 | $15.000 | **$20.000** |
| Moto E13 | Original | $3.000 | $15.000 | **$19.000** |
| Moto E20 / E30 / E40 | Original | $4.000 | $15.000 | **$20.000** |
| Moto E22 / E22I | Original | $3.000 | $15.000 | **$19.000** |
| Moto E32 | Original | $3.000 | $15.000 | **$19.000** |
| Moto Edge 20 Lite | Original | $5.000 | $15.000 | **$21.000** |
| Moto Edge 30 Fusion | Original | $4.000 | $15.000 | **$20.000** |
| Moto Edge 30 Neo | Original | $4.000 | $15.000 | **$20.000** |
| Moto Edge 40 | Original | $6.000 | $15.000 | **$22.000** |
| Moto Edge 40 Neo | Original | $3.500 | $15.000 | **$20.000** |
| Moto Edge 50 | Original | $3.000 | $15.000 | **$19.000** |
| Moto Edge 50 Fusion | Original | $3.000 | $15.000 | **$19.000** |
| Moto Edge 60 Fusion | Original | $3.500 | $15.000 | **$20.000** |
| Moto G3 | Original | $3.000 | $15.000 | **$19.000** |
| Moto G04S | Original | $3.500 | $15.000 | **$20.000** |
| Moto G05 | Original | $3.000 | $15.000 | **$19.000** |
| Moto G5 | Original | $3.000 | $15.000 | **$19.000** |
| Moto G7 | Original | $4.000 | $15.000 | **$20.000** |
| Moto G7 Play | Original | $4.000 | $15.000 | **$20.000** |
| Moto G7 Plus | Original | $4.000 | $15.000 | **$20.000** |
| Moto G7 Power | Original | $4.000 | $15.000 | **$20.000** |
| Moto G8 Play / One Macro | Original | $3.000 | $15.000 | **$19.000** |
| Moto G8 Plus | Original | $5.000 | $15.000 | **$21.000** |
| Moto G8 Power | Original | $4.000 | $15.000 | **$20.000** |
| Moto G8 Power Lite | Original | $3.000 | $15.000 | **$19.000** |
| Moto G9 Play | Original | $4.000 | $15.000 | **$20.000** |
| Moto G9 Plus | Original | $4.000 | $15.000 | **$20.000** |
| Moto G9 Power | Original | $3.000 | $15.000 | **$19.000** |
| Moto G13 | Original | $3.000 | $15.000 | **$19.000** |
| Moto G14 | Original | $4.000 | $15.000 | **$20.000** |
| Moto G20 | Original | $3.000 | $15.000 | **$19.000** |
| Moto G22 | Original | $3.000 | $15.000 | **$19.000** |
| Moto G23 | Original | $4.000 | $15.000 | **$20.000** |
| Moto G30 | Original | $3.000 | $15.000 | **$19.000** |
| Moto G31 | Original | $7.000 | $15.000 | **$24.000** |
| Moto G34 | Original | $3.000 | $15.000 | **$19.000** |
| Moto G35 | Original | $3.500 | $15.000 | **$20.000** |
| Moto G50 5G | Original | $4.000 | $15.000 | **$20.000** |
| Moto G51 | Original | $4.000 | $15.000 | **$20.000** |
| Moto G53 | Original | $3.000 | $15.000 | **$19.000** |
| Moto G54 | Original | $4.000 | $15.000 | **$20.000** |
| Moto G55 | Original | $3.000 | $15.000 | **$19.000** |
| Moto G56 | Original | $4.000 | $15.000 | **$20.000** |
| Moto G60 / G60S | Original | $4.000 | $15.000 | **$20.000** |
| Moto G71 | Original | $4.000 | $15.000 | **$20.000** |
| Moto G84 | Original | $4.000 | $15.000 | **$20.000** |
| Moto G85 | Original | $4.000 | $15.000 | **$20.000** |
| Moto G100 | Original | $3.500 | $15.000 | **$20.000** |
| Moto G200 | Original | $4.000 | $15.000 | **$20.000** |
| Moto One | Original | $4.000 | $15.000 | **$20.000** |
| Moto One Action | Original | $4.000 | $15.000 | **$20.000** |
| Moto One Fusion | Original | $4.000 | $15.000 | **$20.000** |
| Moto One Hyper | Original | $4.000 | $15.000 | **$20.000** |
| Moto X4 | Original | $4.000 | $15.000 | **$20.000** |

### Vivo · Cambio de pantalla (41)

| Equipo | Calidad | Repuesto | Mano de obra | **Precio estimado** |
|---|---|---:|---:|---:|
| Vivo V20 | OLED | $24.000 | $25.000 | **$53.000** |
| Vivo V21S | OLED | $18.600 | $25.000 | **$47.000** |
| Vivo V21 / V25 5G | Incell | $11.000 | $20.000 | **$33.000** |
| Vivo V21 / V25 5G | OLED | $29.000 | $25.000 | **$59.000** |
| Vivo V23 | OLED | $35.900 | $25.000 | **$67.000** |
| Vivo V25 Pro | Original | $49.000 | $20.000 | **$77.000** |
| Vivo V27 | Original | $39.000 | $20.000 | **$65.000** |
| Vivo V29 | Original | $39.000 | $20.000 | **$65.000** |
| Vivo V30 Lite | OLED | $32.000 | $25.000 | **$62.000** |
| Vivo V30 5G | Original | $43.000 | $20.000 | **$70.000** |
| Vivo V40 SE | OLED | $33.000 | $25.000 | **$63.000** |
| Vivo V50 Envíos A Todo Chile | Incell | $22.000 | $20.000 | **$46.000** |
| Vivo V50 Lite | Incell | $22.000 | $20.000 | **$46.000** |
| Vivo V50 Lite | Original | $55.000 | $20.000 | **$84.000** |
| Vivo V60 Lite 5G | Original | $41.000 | $20.000 | **$68.000** |
| Vivo X21 | OLED | $26.500 | $25.000 | **$56.000** |
| Vivo X80 Pro | Original | $94.000 | $20.000 | **$129.000** |
| Vivo Y02 | Original | $12.000 | $20.000 | **$34.000** |
| Vivo Y03 | Original | $10.000 | $20.000 | **$32.000** |
| Vivo Y04 / Y39 | Original | $10.000 | $20.000 | **$32.000** |
| Vivo Y17S | Original | $9.500 | $20.000 | **$31.000** |
| Vivo Y18 | Original | $9.000 | $20.000 | **$31.000** |
| Vivo Y19S | Original | $10.000 | $20.000 | **$32.000** |
| Vivo Y20 / Y20I / Y11 S / Y15S / Y01 / Y20S | Original | $9.500 | $20.000 | **$31.000** |
| Vivo Y21D | Original | $9.000 | $20.000 | **$31.000** |
| Vivo Y21S / Y16 / Y02S | Original | $9.000 | $20.000 | **$31.000** |
| Vivo Y22S | Original | $10.000 | $20.000 | **$32.000** |
| Vivo Y27 | Original | $10.000 | $20.000 | **$32.000** |
| Vivo Y28S 4G | Original | $10.000 | $20.000 | **$32.000** |
| Vivo Y30 | Original | $12.000 | $20.000 | **$34.000** |
| Vivo Y33S / Y35 | Original | $11.000 | $20.000 | **$33.000** |
| Vivo Y36 5G | Original | $11.000 | $20.000 | **$33.000** |
| Vivo Y38 5G | Original | $10.000 | $20.000 | **$32.000** |
| Vivo Y39 5G | Original | $11.000 | $20.000 | **$33.000** |
| Vivo Y51S | Original | $7.000 | $20.000 | **$29.000** |
| Vivo Y51 / Y52S / Y53S / Y31 | Original | $10.000 | $20.000 | **$32.000** |
| Vivo Y55S / Y55 5G | Original | $10.000 | $20.000 | **$32.000** |
| Vivo Y58 5G | Original | $6.000 | $20.000 | **$27.000** |
| Vivo Y70S | Original | $11.000 | $20.000 | **$33.000** |
| Vivo Y75 5G | Original | $11.000 | $20.000 | **$33.000** |
| Vivo Y93 | Original | $10.000 | $20.000 | **$32.000** |

### Vivo · Cambio de batería (8)

| Equipo | Calidad | Repuesto | Mano de obra | **Precio estimado** |
|---|---|---:|---:|---:|
| Vivo Y02S | Normal | $8.500 | $15.000 | **$25.000** |
| Vivo Y11S | Normal | $8.500 | $15.000 | **$25.000** |
| Vivo Y16 | Normal | $7.900 | $15.000 | **$25.000** |
| Vivo Y20I | Normal | $7.900 | $15.000 | **$25.000** |
| Vivo Y20S | Normal | $7.900 | $15.000 | **$25.000** |
| Vivo Y21S | Normal | $9.000 | $15.000 | **$26.000** |
| Vivo Y50 | Normal | $8.000 | $15.000 | **$25.000** |
| Vivo Y51 | Normal | $8.000 | $15.000 | **$25.000** |

### Vivo · Cambio de puerto de carga (16)

| Equipo | Calidad | Repuesto | Mano de obra | **Precio estimado** |
|---|---|---:|---:|---:|
| Vivo V20 | Original | $5.000 | $15.000 | **$21.000** |
| Vivo V21 | Original | $6.000 | $15.000 | **$22.000** |
| Vivo V25 Version 5G | Original | $6.000 | $15.000 | **$22.000** |
| Vivo Y01 | Original | $4.000 | $15.000 | **$20.000** |
| Vivo Y02S / Y16 | Original | $4.000 | $15.000 | **$20.000** |
| Vivo Y03 | Original | $3.000 | $15.000 | **$19.000** |
| Vivo Y11S / Y20 / Y20 S / Y20I | Original | $4.000 | $15.000 | **$20.000** |
| Vivo Y15S Envíos A Todo Chile | Original | $4.000 | $15.000 | **$20.000** |
| Vivo Y17S | Original | $4.000 | $15.000 | **$20.000** |
| Vivo Y21S | Original | $4.000 | $15.000 | **$20.000** |
| Vivo Y22S | Original | $3.500 | $15.000 | **$20.000** |
| Vivo Y27 | Original | $5.000 | $15.000 | **$21.000** |
| Vivo Y36 5G | Original | $3.500 | $15.000 | **$20.000** |
| Vivo Y53S | Original | $4.000 | $15.000 | **$20.000** |
| Vivo Y55 | Original | $4.000 | $15.000 | **$20.000** |
| Vivo Y55 Version 5G | Original | $4.000 | $15.000 | **$20.000** |
