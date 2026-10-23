# v180 — Productos: orden por margen y por utilidad, y filtro productos/servicios (23-10-2026)

Pidió ver primero lo que más margina y lo que más plata deja, y poder separar productos de servicios.

- **Orden "Margen %: Mayor a Menor"** y **"Utilidad $: Mayor a Menor"** (solo admin) en el selector de Productos. Los dos usan el mayor
  costo conocido (`costoParaMargen`, igual que el resto de los márgenes) y dejan fuera los que no tienen costo ("no se sabe", no "deja todo").
  La utilidad es por unidad: precio − costo.
- **Selector "Todo / Solo productos / Solo servicios"** al lado del orden (`#tipoProductos`); se combina con cualquier orden y con el
  buscador, y también afecta a lo que sale en Exportar. Archivados y Borradores no lo usan.
- Probado en `pos-maqueta` (16 filas = 13 productos + 3 servicios; los dos órdenes devuelven distinto primer lugar). Sin cambios en backend ni precios.
