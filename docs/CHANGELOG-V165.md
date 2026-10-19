# v165 — Reel con 5 animaciones para elegir y vista previa animada (19-10-2026)

Pedido del dueño: *"dame animaciones nuevas también, con diferentes estilos para elegir"*. Todo desde el botón 📣 del
POS (Redes sociales), sin pedírselo a Claude: al elegir **Reel** aparece la fila **"Animación del reel"**.

| Animación | Cómo se ve |
|---|---|
| **Clásica** | La de v164: la frase, la lámina del estilo elegido animada y el cierre |
| **Impacto** | Las palabras caen de a una con rebote, destellos blancos, la foto entra de golpe con un temblor, cada foto nueva con zoom, y el precio **contando** desde $0 |
| **Suave** | Fondo claro: la frase se escribe letra por letra, la foto aparece y se acerca muy lento, fundidos largos entre fotos y una línea que subraya el precio |
| **Neón** | Partículas que suben, una barra de luz que barre y deja ver la frase, el borde de la foto que se dibuja como tubo de neón, halo que gira y precio que parpadea al encender |
| **Galería** | Las fotos pasan de derecha a izquierda como un carrusel de Instagram, con puntitos de avance; nombre y precio fijos abajo |

- Las cinco duran 12 s y terminan con el mismo cierre (WhatsApp y la web, entrada por Robinson Rojas).
- **Vista previa animada:** el reel se ve moviéndose en bucle en el modal antes de grabarlo.
- **🎲 Otra versión** en un reel también cambia la animación.
- El registro guarda qué animación llevó cada reel (`sql/105`, columna `contenido_redes.animacion`).
- Código: `contenidoRedesCuadroReel()` reparte a `contenidoRedesCuadroClasico/Impacto/Suave/Neon/Galeria()` en
  `js/redes-contenido.js`; la grabación y la vista previa usan la misma función.

Probado en la maqueta (Chrome sin ventana): cuadros de las cuatro nuevas a los 0,8 / 2,6 / 4,5 / 6,5 / 8,5 / 11 s,
sin nada encima de otra cosa; el reel "Neón" grabado en MP4 (5,3 MB). Chequeos de funciones e ids duplicados vacíos.
