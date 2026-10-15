# v143 · La caja pregunta por TODOS los servicios si son tuyos o de C. Patricio (15-10-2026)

Sin migración ni cambios en el servidor (ya aceptaba el pozo en cualquier servicio). Publicado.

## Qué pidió el dueño
"Al agregar servicios no me pregunta si es para mí o para mis padres… al registrar servicios se registran solo para
mí, y había servicios que debían ser solo para mis padres, mayormente el de celulares." Pidió casilla o ventana, lo que
Claude recomendara.

## Qué pasaba
La ventana "Antes de cobrar" solo preguntaba por los servicios escritos a mano y por los que tienen "Lo hace
C. Patricio" en la ficha. Ninguna ficha lo tenía marcado, así que todo servicio del catálogo se iba entero al dueño sin
que nadie lo decidiera. Ejemplo real: venta #272 (15-10-2026), Formateo de Celular $10.000, sin pozo.

## Qué quedó
- La ventana de antes de cobrar pregunta por **cada servicio** del carrito: "👨‍🔧 ¿Quién hizo el servicio?" con
  "Es mío (Sevelin)", "De C. Patricio: todo a su pozo", "De C. Patricio, menos el repuesto" y "Otro monto a su pozo".
- Sin "Lo hace C. Patricio" en la ficha no viene nada marcado y no deja seguir sin elegir (la regla de la v137 para lo
  escrito a mano, ahora para todos). Con la casilla marcada viene elegido "todo a su pozo" y se puede cambiar.
- Se eligió la ventana y no una casilla al agregar: la ventana ya existía, calcula el monto (menos repuesto, IVA) y
  obliga a responder; una casilla se puede pasar de largo, que es justo lo que pasó con la venta #266.
- Una venta sin servicios no abre la ventana: cobrar productos sigue igual de rápido.

## Cómo se probó
En la maqueta de la caja: un servicio del catálogo sin la casilla (sin nada marcado, botón apagado hasta elegir) y uno
con la casilla (viene en "todo a su pozo"); al elegir "Es mío" y seguir, el carrito lleva el pozo solo en el segundo.
No probado en la caja real.
