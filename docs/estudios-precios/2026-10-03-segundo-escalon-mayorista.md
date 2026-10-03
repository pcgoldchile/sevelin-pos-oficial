# Segundo precio por mayor: propuesta (03-10-2026)

Pendiente #28. El dueño pidió "pon un segundo precio por mayor". Esta es la lista concreta, armada con los datos
de la base del POS del 03-10-2026 (solo lectura). **No se carga ningún precio sin su OK a esta lista.**

## La regla usada

- **Cantidad:** el doble del primer escalón (3 → 6, 5 → 10, 10 → 20 unidades).
- **Precio:** cerca de 7% bajo el primer precio por mayor (entre 6% y 8%), redondeado a $100 (a $50 bajo $1.000;
  por eso el tornillo baja $50, que es 12%).
- **Piso:** nunca bajo 20% de margen sobre el mayor costo conocido (lo hace cumplir la base, sql/81). Se dejó un
  colchón: ninguno queda bajo 23%, para que una compra un poco más cara no lo desactive.
- **Stock:** solo productos con unidades para al menos una compra de ese tamaño hoy.
- Costos y precios con IVA. Margen = (precio − costo) / precio.

## Los 15 productos

| Producto | Precio normal | Por mayor hoy | Segundo precio propuesto | Margen del segundo | Stock |
|---|---|---|---|---|---|
| Adaptador HDMI a VGA | $4.990 | $4.000 desde 5 | **$3.700 desde 10** | 40% | 12 |
| Cable HDMI 1 m | $1.990 | $1.600 desde 10 | **$1.500 desde 20** | 60% | 29 |
| Cable HDMI 5 m mallado | $4.990 | $4.200 desde 5 | **$3.900 desde 10** | 35% | 12 |
| Cable de Poder PC 1,8 m | $2.990 | $2.500 desde 5 | **$2.300 desde 10** | 40% | 28 |
| Cable de Red Cat6E 5 m | $4.990 | $4.000 desde 5 | **$3.700 desde 10** | 60% | 20 |
| Antena TV Digital de Interior | $4.990 | $4.000 desde 5 | **$3.700 desde 10** | 46% | 10 |
| Mouse Urbano Labs Gamer Pro | $2.990 | $2.500 desde 5 | **$2.300 desde 10** | 29% | 20 |
| Ventilador Gamer RGB 120 mm | $3.990 | $3.500 desde 5 | **$3.300 desde 10** | 24% | 24 |
| Tornillo de Montaje M.2 | $500 | $400 desde 10 | **$350 desde 20** | 90% | 93 |
| Pila CR2032 Energizer | $990 | $800 desde 10 | **$750 desde 20** | 44% | 23 |
| Combo Teclado y Mouse RGB AB-D335 | $7.990 | $7.000 desde 3 | **$6.500 desde 6** | 23% | 13 |
| Parlantes Gamer RGB USB | $9.990 | $9.000 desde 3 | **$8.300 desde 6** | 25% | 10 |
| Mini Parrillera Plegable | $9.990 | $8.400 desde 3 | **$7.800 desde 6** | 33% | 9 |
| Cargador Universal Notebook 120W | $9.990 | $8.500 desde 3 | **$7.900 desde 6** | 28% | 9 |
| Power Bank Master-G 30.000 mAh | $29.990 | $26.000 desde 3 | **$24.000 desde 6** | 27% | 11 |

## Los 19 que quedan con un solo precio por mayor

- **Sin stock para una compra de ese tamaño:** Soporte Magnético para Auto, Transmisor FM CARG7, Adaptador VGA a
  HDMI, Cable DisplayPort, Cable HDMI 15 m, Cable HDMI 1,5 m, Cable VGA, microSD Dahua 32GB, Cable Fibra Óptica,
  Cocinilla de Camping, Control Remoto Samsung, Kit de Limpieza de Pantallas, Kit de Limpieza de Zapatillas, Lámpara
  Astronauta, Mini Impresora Gatito, Balanza Bluetooth (stock 0).
- **Sin espacio sobre el piso de 20%:** Anillo de Luz LED (por mayor $7.300, piso $7.189) y los dos monitores de 19"
  reacondicionados (por mayor $37.000, piso $36.250).

## Límites

- No se comparó con el mercado: es una rebaja sobre precios por mayor ya aprobados, no un estudio nuevo.
- Las ventas anotadas no están completas, así que no se usó "se vende poco" para sacar a ninguno.
- Hoy no hay ninguna cuenta mayorista aprobada: estos precios los vería primero la caja (botón "Aplicar mayorista"
  cuando la cantidad alcanza) y una cuenta que el dueño apruebe.
