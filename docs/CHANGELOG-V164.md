# v164 — Redes sociales: crear contenido de un producto con un botón, y registro de lo promocionado (19-10-2026)

Pedido del dueño: *"una opción de crear contenido a partir de un producto con un botón, para armar si es para historia,
feed, carrusel o contenido, en un módulo redes sociales en el POS… que haya un sistema de registro de qué se ha
promocionado últimamente… formas de variar si subo de un producto, pero hecho de otra forma"*.

**Menú → 📣 Redes sociales** (solo admin) y **botón 📣 en cada fila de Productos** (al lado del de Facebook).

- **Crear contenido** (`js/redes-contenido.js`, modal `#modalContenidoRedes`): con las fotos y datos reales del producto
  dibuja en el navegador (canvas), sin servidor ni IA:
  - **Formatos:** historia 1080×1920 (deja aire abajo para el sticker de enlace), post 1080×1350, carrusel de hasta 5
    láminas (portada, beneficios, foto de cerca, precio, cierre; baja un .zip) y **reel de 12 s en MP4** (frase → producto
    pasando por sus fotos → precio con golpe → cierre con WhatsApp y la web). Sin música, a propósito.
  - **Estilos:** Dinámico (oscuro con brillo), Minimalista (claro), Precio grande, Beneficios (las ✅ de su ficha: si la
    ficha no tiene, el estilo se apaga) y Por qué Sevelin (garantía, retiro, despacho).
  - **Frase grande** editable, elegida de una lista de frases ciertas para cualquier producto (nada de "el más vendido"
    sin el dato). **🎲 Otra versión** cambia estilo, frase y foto, eligiendo lo que ese producto menos ha usado.
  - **Texto para pegar:** el de Instagram guardado en el producto (v139) o el que arma redes-texto.js; botón Copiar.
  - El precio respeta la oferta web vigente ("Antes $X") y el "Desde" de los que se cotizan.
- **Registro** (`sql/104`, tabla `contenido_redes`): cada descarga queda como "Descargado"; en el panel se marca IG / FB
  cuando se publica. Al abrir un producto avisa cuántas veces se mostró en 30 días y cuándo fue la última; si fue hace
  menos de 14 días lo marca como "mostrado hace poco".
- **Panel:** piezas en 7 y 30 días, productos distintos, marcadas como publicadas, productos repetidos en 14 días;
  **Sugeridos para hoy** (con foto y stock, sin mostrar en 14 días, primero lo de más puntaje en Destacados de sevelin.cl);
  buscador; y la tabla del registro.
- Endpoints: `GET/POST /api/redes/registro`, `PUT /api/redes/registro/:id`, `GET /api/redes/sugeridos` (todos admin).

Probado:
- **Servidor real contra el doble de Supabase:** valida formato y estilo, guarda quién la creó, al marcar descarta redes
  que no existen, los sugeridos sacan lo recién mostrado y ponen primero lo de más puntaje; un trabajador recibe 403.
- **Maqueta del POS** (Chrome sin ventana): los 5 estilos en post e historia sin que nada se monte (la foto toma el
  espacio que sobra), el carrusel, el reel grabado en MP4 (4,6 MB), la descarga que queda en el registro, el aviso de
  repetido, "Otra versión" y la marca IG.
- Chequeos de funciones e ids duplicados vacíos. Sin clases Tailwind nuevas (estilos en css/styles.css).

No probado: subir las piezas a Instagram y Facebook de verdad (lo hace el dueño o Claude por Chrome con su OK).
