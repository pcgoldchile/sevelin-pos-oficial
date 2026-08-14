// ==========================================
// POS-LAYOUT.JS - Tamaño del área del POS
// ------------------------------------------
// Permite agrandar las DOS tarjetas (Ingresar producto y Carrito de
// venta) al mismo tiempo, arrastrando la esquina inferior derecha.
//
// Por qué se redimensiona el CONTENEDOR y no cada tarjeta:
// las dos columnas viven en un grid con `align-items: stretch`, así que
// estirar el contenedor las estira a ambas por igual y mantiene la
// proporción 7/5. Redimensionar tarjeta por tarjeta habría necesitado
// dos agarres y habrían quedado desparejas.
//
// El tamaño se guarda en el equipo (localStorage), no en la base: es una
// preferencia de ESTA pantalla. El mismo POS abierto en el notebook del
// taller no tiene por qué heredar el tamaño del monitor del mostrador.
// ==========================================

const POS_LAYOUT_KEY = 'pos_layout_v1';

/* Topes. El mínimo evita que se arrastre hasta dejar el POS inservible
   (una tarjeta de 200px no muestra ni el carrito); el máximo es
   generoso a propósito, porque el usuario pidió "hasta donde yo quiera". */
const POS_ANCHO_MIN = 900;
const POS_ANCHO_MAX = 4200;
const POS_ALTO_MIN = 480;
const POS_ALTO_MAX = 2400;

let posLayout = { ancho: null, alto: null, completo: false };

document.addEventListener('DOMContentLoaded', () => {
  const lienzo = document.getElementById('posLienzo');
  const agarre = document.getElementById('posRedim');
  if (!lienzo) return;

  cargarPosLayout();
  aplicarPosLayout();

  document.getElementById('btnPosReset')?.addEventListener('click', restablecerPosLayout);
  document.getElementById('btnPosAncho')?.addEventListener('click', alternarAnchoCompleto);

  if (!agarre) return;

  /* Pointer events en vez de mouse + touch por separado: un solo camino
     para ratón, lápiz y pantalla táctil, y `setPointerCapture` mantiene
     el arrastre aunque el puntero salga de la ventana (antes, al soltar
     fuera, el redimensionado se quedaba pegado). */
  let inicio = null;

  agarre.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    const caja = lienzo.getBoundingClientRect();
    const grid = document.getElementById('posGrid');
    inicio = {
      x: e.clientX,
      y: e.clientY,
      ancho: caja.width,
      alto: grid ? grid.getBoundingClientRect().height : POS_ALTO_MIN
    };
    agarre.setPointerCapture(e.pointerId);
    agarre.classList.add('arrastrando');
    document.body.classList.add('pos-redimensionando');
  });

  agarre.addEventListener('pointermove', (e) => {
    if (!inicio) return;

    /* El ancho crece al DOBLE del desplazamiento porque el lienzo está
       centrado con `margin: 0 auto`: al arrastrar 100px a la derecha el
       borde izquierdo también se corre 100px a la izquierda. Sin este
       factor, el agarre "se escapaba" del puntero. */
    const ancho = inicio.ancho + (e.clientX - inicio.x) * 2;
    const alto = inicio.alto + (e.clientY - inicio.y);

    posLayout.ancho = Math.round(Math.min(Math.max(ancho, POS_ANCHO_MIN), POS_ANCHO_MAX));
    posLayout.alto = Math.round(Math.min(Math.max(alto, POS_ALTO_MIN), POS_ALTO_MAX));
    posLayout.completo = false;   // arrastrar manda sobre el modo pantalla completa

    aplicarPosLayout();
  });

  const soltar = (e) => {
    if (!inicio) return;
    inicio = null;
    try { agarre.releasePointerCapture(e.pointerId); } catch (_) {}
    agarre.classList.remove('arrastrando');
    document.body.classList.remove('pos-redimensionando');
    guardarPosLayout();
  };

  agarre.addEventListener('pointerup', soltar);
  agarre.addEventListener('pointercancel', soltar);

  /* Teclado: con el agarre enfocado, las flechas ajustan de a 40 px.
     No es un adorno de accesibilidad, sirve para afinar el tamaño sin
     pelear con el ratón. */
  agarre.addEventListener('keydown', (e) => {
    const paso = e.shiftKey ? 120 : 40;
    const caja = document.getElementById('posGrid')?.getBoundingClientRect();
    if (posLayout.ancho == null) posLayout.ancho = Math.round(lienzo.getBoundingClientRect().width);
    if (posLayout.alto == null) posLayout.alto = Math.round(caja ? caja.height : POS_ALTO_MIN);

    let tocado = true;
    if (e.key === 'ArrowRight') posLayout.ancho += paso;
    else if (e.key === 'ArrowLeft') posLayout.ancho -= paso;
    else if (e.key === 'ArrowDown') posLayout.alto += paso;
    else if (e.key === 'ArrowUp') posLayout.alto -= paso;
    else tocado = false;

    if (!tocado) return;
    e.preventDefault();
    posLayout.ancho = Math.min(Math.max(posLayout.ancho, POS_ANCHO_MIN), POS_ANCHO_MAX);
    posLayout.alto = Math.min(Math.max(posLayout.alto, POS_ALTO_MIN), POS_ALTO_MAX);
    posLayout.completo = false;
    aplicarPosLayout();
    guardarPosLayout();
  });
});

function aplicarPosLayout() {
  const lienzo = document.getElementById('posLienzo');
  if (!lienzo) return;

  lienzo.classList.toggle('pos-ancho-completo', !!posLayout.completo);

  if (posLayout.ancho) lienzo.style.setProperty('--pos-ancho', posLayout.ancho + 'px');
  else lienzo.style.removeProperty('--pos-ancho');

  /* `pos-alto-manual` desactiva la regla del CSS que calcula el alto
     desde la ventana. Mientras el usuario no arrastre, manda el CSS. */
  if (posLayout.alto) {
    lienzo.style.setProperty('--pos-alto', posLayout.alto + 'px');
    lienzo.classList.add('pos-alto-manual');
  } else {
    lienzo.style.removeProperty('--pos-alto');
    lienzo.classList.remove('pos-alto-manual');
  }

  const btn = document.getElementById('btnPosAncho');
  if (btn) btn.textContent = posLayout.completo ? '↔️ Ancho cómodo' : '↔️ Ancho completo';
}

function alternarAnchoCompleto() {
  posLayout.completo = !posLayout.completo;
  // Pantalla completa ignora el ancho arrastrado, pero lo conserva guardado
  aplicarPosLayout();
  guardarPosLayout();
  if (typeof showToast === 'function') {
    showToast(posLayout.completo ? 'POS a pantalla completa' : 'POS en ancho cómodo', '');
  }
}

function restablecerPosLayout() {
  posLayout = { ancho: null, alto: null, completo: false };
  aplicarPosLayout();
  try { localStorage.removeItem(POS_LAYOUT_KEY); } catch (_) {}
  if (typeof showToast === 'function') showToast('Tamaño del POS restablecido', 'ok');
}

function cargarPosLayout() {
  try {
    const crudo = localStorage.getItem(POS_LAYOUT_KEY);
    if (!crudo) return;
    const datos = JSON.parse(crudo);
    posLayout = {
      ancho: Number(datos.ancho) || null,
      alto: Number(datos.alto) || null,
      completo: !!datos.completo
    };
  } catch (_) {
    // Un JSON corrupto no debe impedir abrir la caja: se ignora y va por defecto
    posLayout = { ancho: null, alto: null, completo: false };
  }
}

function guardarPosLayout() {
  try { localStorage.setItem(POS_LAYOUT_KEY, JSON.stringify(posLayout)); } catch (_) {}
}
