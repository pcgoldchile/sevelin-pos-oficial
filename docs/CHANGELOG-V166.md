# v166 — Redes: carrusel de 6 láminas, frase de arriba, cierre con medios de pago y "¿Lo subiste?" (19-10-2026)

Pedido del dueño (con captura de una historia donde los sellos quedaban tapados por el pie): *"mejora aún más… sobre
todo los carruseles y sus diseños… agrega otra frase al inicio, y al final deja todo, medio de pago, suma puntos…
'Precio Sevelin' pon otra frase… si el botón detecta que descargué, que me salga algo para saber si lo subí"*.

- **Arreglado lo que se tapaba:** el alto de los sellos se mide de verdad (eran 2 filas y se suponía 1) y la foto toma
  solo el espacio que queda. Historia con 170 px libres abajo para el sticker de enlace.
- **Frase de arriba** (píldora sobre la frase grande): sale de la categoría ("Monitores en Arica", "Servicio técnico en
  Arica"), se edita en el modal y "Otra versión" la alterna con "Tecnología en Arica" / "Disponible hoy en Sevelin"
  (solo si hay stock).
- **"Precio Sevelin" fuera:** frases de precio nuevas: "Mira este precio", "Precio claro, garantía real", "Lo vale",
  "Así de simple".
- **Carrusel nuevo, hasta 6 láminas** que se sienten una sola al deslizar (una cinta de luz cruza todas; contador
  "2/6"; "Desliza →" en la portada): portada → lo que trae (las ✅ de la ficha) → **ficha técnica** (las casillas de
  filtros del producto, v159) → foto de cerca → **precio y medios de pago** (débito, crédito, efectivo, transferencia)
  → **cómo comprarlo** (WhatsApp, web, tienda con la entrada por Robinson Rojas, garantía, despacho, envíos). Lo que el
  producto no tiene (sin ✅, sin casillas, una sola foto) no sale.
- **Cierre del reel** con "Paga como quieras" y garantía / despacho / envíos.
- **Puntos:** la línea "⭐ Y sumas Puntos Sevelin" ya está, apagada (`CONTENIDO_REDES_PUNTOS_ACTIVOS = false`) hasta
  que los puntos existan.
- **"¿Lo subiste?"** después de cada descarga: A Instagram / A Facebook / A las dos / Todavía no. El panel recuerda las
  descargadas hace más de un día sin marcar.

Probado en la maqueta (Chrome sin ventana): carrusel de 6 en Dinámico y Minimalista, las 5 historias y el cierre del
reel, con un nombre largo, sin choques. Chequeos de funciones e ids duplicados vacíos.
