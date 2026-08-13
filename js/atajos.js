// ==========================================
// ATAJOS.JS - Atajos de teclado del módulo POS
// ------------------------------------------
// Pensado para trabajar en caja sin soltar el teclado.
//
// DECISIONES DE DISEÑO
//
// 1. Solo actúan dentro del POS. En Historial, Productos o Gastos el
//    teclado se comporta normal: un atajo que dispara en la pantalla
//    equivocada es peor que no tenerlo.
//
// 2. Se usan teclas F y combinaciones con Alt, nunca letras sueltas.
//    Una letra suelta se comería lo que estás escribiendo en el buscador.
//
// 3. Se evitan a propósito F5 (recargar), F11 (pantalla completa),
//    F12 (herramientas), Ctrl+W, Ctrl+T y Ctrl+R: son del navegador y
//    pelear con ellas termina mal.
//
// 4. La ventana de ayuda se genera desde ATAJOS[], así que nunca puede
//    quedar desfasada de lo que realmente hace el sistema.
// ==========================================

const ATAJOS = [
  { grupo: 'Buscar y agregar', items: [
    { clave: 'buscar',   desc: 'Ir al buscador de productos',            accion: () => enfocar('posBuscarProducto', true) },
    { teclas: ['Shift'],         desc: 'Ir al buscador (atajo rápido)',          soloAyuda: true },
    { teclas: ['↑', '↓'],        desc: 'Recorrer las sugerencias',               soloAyuda: true },
    { teclas: ['Enter'],         desc: 'Elegir la sugerencia marcada',           soloAyuda: true },
    { teclas: ['Alt', '1..8'],   desc: 'Elegir directamente la sugerencia N',    soloAyuda: true },
    { clave: 'cantidad', desc: 'Ir a Cantidad',                          accion: () => enfocar('itemCantidad', true) },
    { clave: 'precio',   desc: 'Ir a Precio Unitario',                   accion: () => enfocar('itemPrecio', true) },
    { clave: 'agregar',  desc: 'Agregar el producto al carrito',         accion: () => clic('btnAgregarItem') },
    { teclas: ['Alt', 'S'],      desc: 'Marcar / desmarcar "Tiene S/N"',         accion: () => alternar('checkTieneSN') },
    { clave: 'limpiar',  desc: 'Limpiar la selección (no el carrito)',   accion: () => clic('btnLimpiarSeleccion') }
  ]},

  { grupo: 'Carrito', items: [
    { teclas: ['Alt', '+'],      desc: 'Sumar 1 al último producto del carrito', accion: () => ajustarUltimo(+1) },
    { teclas: ['Alt', '-'],      desc: 'Restar 1 al último producto',            accion: () => ajustarUltimo(-1) },
    { teclas: ['Alt', 'Supr'],   desc: 'Quitar el último producto',              accion: () => quitarUltimo() },
    { teclas: ['Alt', 'C'],      desc: 'Ir al campo Cliente',                    accion: () => enfocar('posCliente', true) },
    { teclas: ['Alt', 'H'],      desc: 'Mostrar / ocultar el campo de hora',     accion: () => alternar('posEditarHora') }
  ]},

  { grupo: 'Cerrar la venta', items: [
    { teclas: ['F9'],            desc: 'Finalizar venta (abre el pago)',         accion: () => clic('btnFinalizarVenta') },
    { clave: 'cobrar',   desc: 'Cobrar la venta sin abrir el modal',     soloAyuda: true },
    { teclas: ['←', '→', '↑', '↓'], desc: 'En el pago: moverse entre medios',    soloAyuda: true },
    { teclas: ['Alt', '1..5'],   desc: 'En el pago: elegir medio de pago',       soloAyuda: true },
    { teclas: ['Enter'],         desc: 'En el pago: confirmar',                  soloAyuda: true },
    { teclas: ['Esc'],           desc: 'Cerrar la ventana abierta',              soloAyuda: true }
  ]},

  { grupo: 'General', items: [
    { teclas: ['F1'],            desc: 'Mostrar esta ayuda',                     accion: () => alternarAyudaAtajos(), global: true },
    { teclas: ['Alt', 'P'],      desc: 'Volver al módulo POS',                   accion: () => irAModulo('pos'), global: true },
    { clave: 'merma',    desc: 'Registrar merma',                        accion: () => clic('btnMermaPOS') },
    { teclas: ['Esc'],           desc: 'Cerrar sugerencias o limpiar el foco',   soloAyuda: true }
  ]}
];

/* ============================================================
   ATAJOS CONFIGURABLES
   ------------------------------------------------------------
   Los atajos que se pueden reasignar viven acá con su valor por defecto.
   Lo elegido se guarda en el equipo, así que cada caja puede tener los
   suyos sin tocar el código.

   TECLAS QUE NO SE PERMITEN Y POR QUÉ (ver TECLAS_PROHIBIDAS):
   son del navegador o del sistema, y capturarlas o no funciona, o deja
   al usuario sin una salida que espera tener.
   ============================================================ */
const ATAJOS_POR_DEFECTO = {
  cobrar: ',',
  buscar: 'F2',
  cantidad: 'F3',
  precio: 'F4',
  agregar: 'a',        // con Alt
  limpiar: 'l',        // con Alt
  merma: 'm'           // con Alt
};

/* Teclas reservadas: el navegador o el sistema operativo las usan antes
   de que la página pueda verlas, o son necesarias para navegar. */
const TECLAS_PROHIBIDAS = {
  'F5': 'Recarga la página',
  'F6': 'Va a la barra de direcciones',
  'F11': 'Pantalla completa',
  'F12': 'Herramientas de desarrollo',
  'Tab': 'Navegación entre campos',
  'Enter': 'Confirmar (se usa en toda la app)',
  'Escape': 'Cerrar ventanas',
  'Backspace': 'Borrar texto',
  'Delete': 'Borrar texto',
  ' ': 'Espacio: se usa al escribir',
  'ArrowUp': 'Navegación', 'ArrowDown': 'Navegación',
  'ArrowLeft': 'Navegación', 'ArrowRight': 'Navegación',
  'Shift': 'Ya asignada al buscador',
  'Control': 'Combinaciones del navegador',
  'Alt': 'Combinaciones del sistema',
  'Meta': 'Tecla Windows / Command'
};

let atajosUsuario = {};

function cargarAtajos() {
  try {
    atajosUsuario = JSON.parse(localStorage.getItem('sp_atajos') || '{}');
  } catch (e) { atajosUsuario = {}; }
}

function atajoDe(clave) {
  return atajosUsuario[clave] || ATAJOS_POR_DEFECTO[clave];
}

function guardarAtajo(clave, tecla) {
  atajosUsuario[clave] = tecla;
  try { localStorage.setItem('sp_atajos', JSON.stringify(atajosUsuario)); } catch (e) {}
}

function restablecerAtajos() {
  atajosUsuario = {};
  try { localStorage.removeItem('sp_atajos'); } catch (e) {}
}

/* Valida una tecla antes de aceptarla. Devuelve el motivo del rechazo o
   null si se puede usar. */
function motivoRechazo(tecla, claveActual) {
  if (TECLAS_PROHIBIDAS[tecla]) return TECLAS_PROHIBIDAS[tecla];

  const enUso = Object.keys(ATAJOS_POR_DEFECTO)
    .find(k => k !== claveActual && atajoDe(k) === tecla);
  if (enUso) return `Ya la usa "${ETIQUETAS_ATAJOS[enUso] || enUso}"`;

  return null;
}

const ETIQUETAS_ATAJOS = {
  cobrar: 'Cobrar la venta',
  buscar: 'Ir al buscador',
  cantidad: 'Ir a Cantidad',
  precio: 'Ir a Precio',
  agregar: 'Agregar al carrito (con Alt)',
  limpiar: 'Limpiar selección (con Alt)',
  merma: 'Registrar merma (con Alt)'
};

cargarAtajos();

/* Índice de navegación por las sugerencias con ↑ / ↓. -1 = ninguna. */
let sugerenciaActiva = -1;

document.addEventListener('DOMContentLoaded', () => {
  document.addEventListener('keydown', manejarAtajo, true);

  const btn = document.getElementById('btnVerAtajos');
  if (btn) btn.addEventListener('click', alternarAyudaAtajos);

  const cerrar = document.getElementById('btnCerrarAtajos');
  if (cerrar) cerrar.addEventListener('click', cerrarAyudaAtajos);

  const modal = document.getElementById('modalAtajos');
  if (modal) modal.addEventListener('click', (e) => { if (e.target === modal) cerrarAyudaAtajos(); });

  pintarAyudaAtajos();
});

/* ¿Estamos en el POS? Los atajos marcados como `global` funcionan
   siempre; el resto solo aquí. */
function enPOS() {
  const vista = document.getElementById('view-pos');
  return !!(vista && vista.classList.contains('active'));
}

function hayModalAbierto() {
  return !!document.querySelector('.modal-overlay.show');
}


function manejarAtajo(e) {
  // F1 y la ayuda funcionan en cualquier parte
  if (e.key === 'F1') { e.preventDefault(); alternarAyudaAtajos(); return; }

  if (e.key === 'Escape') { manejarEscape(); return; }

  /* Shift solo (sin combinar con otra tecla) manda el foco al buscador.
     Se comprueba en keyup: en keydown no se sabe todavía si el usuario
     está armando un Shift+algo, y robarle el foco a media combinación
     sería insoportable. Ver manejarShift(). */

  // Flechas y Enter dentro del modal de pago
  if (navegarModalPago(e)) return;

  /* Atajo de cobro configurable (por defecto la coma).
     Se descartó el doble Enter: Enter es la tecla de confirmar en toda
     la app, y un segundo pulso accidental disparaba el cobro cuando el
     usuario solo estaba encadenando confirmaciones. */
  const teclaCobro = atajoDe('cobrar');
  if (e.key === teclaCobro && enPOS() && !hayModalAbierto() && !enCampoDeTexto()) {
    e.preventDefault();
    clic('btnFinalizarVenta');
    return;
  }

  // Navegación de sugerencias: solo con el buscador enfocado
  if (['ArrowDown', 'ArrowUp', 'Enter'].includes(e.key) && document.activeElement?.id === 'posBuscarProducto') {
    if (navegarSugerencias(e)) return;
  }

  if (e.altKey && !e.ctrlKey && !e.metaKey) {
    if (manejarAlt(e)) return;
  }

  /* Las teclas F solo dentro del POS y sin ventanas encima: si hay un
     modal abierto, F9 no debe disparar otra venta por detrás. */
  if (!enPOS() || hayModalAbierto()) return;

  const buscado = buscarAtajo(t => t.length === 1 && t[0] === e.key);
  if (buscado) { e.preventDefault(); buscado.accion(); }
}

function manejarAlt(e) {
  const tecla = e.key.toUpperCase();

  // Alt+1..9 elige la sugerencia N, o el medio de pago N si el pago está abierto
  if (/^[1-9]$/.test(e.key)) {
    if (elegirPorNumero(Number(e.key))) { e.preventDefault(); return true; }
    return false;
  }

  const mapa = {
    'A': 'btnAgregarItem', 'L': 'btnLimpiarSeleccion'
  };

  if (!enPOS() && tecla !== 'P') return false;

  if (mapa[tecla] && !hayModalAbierto()) { e.preventDefault(); clic(mapa[tecla]); return true; }

  switch (tecla) {
    case 'P': e.preventDefault(); irAModulo('pos'); return true;
    case 'C': if (hayModalAbierto()) return false; e.preventDefault(); enfocar('posCliente', true); return true;
    case 'S': if (hayModalAbierto()) return false; e.preventDefault(); alternar('checkTieneSN'); return true;
    case 'H': if (hayModalAbierto()) return false; e.preventDefault(); alternar('posEditarHora'); return true;
  }

  if (hayModalAbierto()) return false;

  if (e.key === '+' || e.key === '=') { e.preventDefault(); ajustarUltimo(+1); return true; }
  if (e.key === '-') { e.preventDefault(); ajustarUltimo(-1); return true; }
  if (e.key === 'Delete') { e.preventDefault(); quitarUltimo(); return true; }

  return false;
}

/* ¿El foco está en un campo donde el usuario escribe? */
function enCampoDeTexto() {
  const a = document.activeElement;
  if (!a) return false;
  const tag = a.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || a.isContentEditable;
}

/* ---------- Shift = ir al buscador ----------
   Se resuelve en keyup y solo si NINGUNA otra tecla se pulsó mientras
   Shift estaba abajo. Así Shift+letra (mayúsculas) o Shift+Tab siguen
   funcionando con normalidad. */
let shiftLimpio = false;

document.addEventListener('keydown', (e) => {
  if (e.key === 'Shift') { shiftLimpio = true; return; }
  shiftLimpio = false;                       // se combinó con otra tecla
}, true);

document.addEventListener('keyup', (e) => {
  if (e.key !== 'Shift' || !shiftLimpio) return;
  shiftLimpio = false;

  if (!enPOS() || hayModalAbierto()) return;

  const buscador = document.getElementById('posBuscarProducto');
  if (!buscador) return;
  // Si ya está en el buscador, Shift no molesta: solo selecciona el texto
  buscador.focus();
  buscador.select();
}, true);

/* ---------- Flechas dentro del modal de pago ----------
   Los medios de pago son una grilla, así que ← → se mueven de a uno y
   ↑ ↓ saltan una fila completa. Enter confirma: si aún no hay medio
   marcado, marca el que está resaltado; si ya hay uno, confirma el pago. */
let medioResaltado = -1;

/* Al abrir el cobro se resalta la primera opción SIN elegirla, para que
   las flechas tengan desde dónde partir. Resaltado ≠ elegido: solo Enter
   o un clic confirman. */
document.addEventListener('pos:pago-abierto', () => {
  medioResaltado = 0;
  setTimeout(() => {
    const modal = document.getElementById('modalPago');
    const botones = Array.from(modal?.querySelectorAll('.pago-metodo-btn') || []);
    botones.forEach((b, i) => b.classList.toggle('resaltado', i === 0));
  }, 60);
});

function navegarModalPago(e) {
  const modal = document.getElementById('modalPago');
  if (!modal || !modal.classList.contains('show')) { medioResaltado = -1; return false; }

  /* El paso de DTE se abre ENCIMA del modal de pago, que sigue visible.
     Sin esta salida, Enter dentro del DTE volvía a pulsar "Confirmar
     Venta" del modal de atrás y se encadenaban dos confirmaciones. */
  const dte = document.getElementById('modalDte');
  if (dte && dte.classList.contains('show')) return false;

  const botones = Array.from(modal.querySelectorAll('.pago-metodo-btn'));
  if (!botones.length) return false;

  // Dentro de un campo (monto recibido, montos del mixto) las flechas son del campo
  if (enCampoDeTexto() && ['ArrowUp', 'ArrowDown'].includes(e.key)) return false;

  const porFila = calcularColumnas(botones);

  if (['ArrowRight', 'ArrowLeft', 'ArrowUp', 'ArrowDown'].includes(e.key)) {
    e.preventDefault();
    if (medioResaltado < 0) medioResaltado = Math.max(0, botones.findIndex(b => b.classList.contains('active')));

    if (e.key === 'ArrowRight') medioResaltado = Math.min(botones.length - 1, medioResaltado + 1);
    if (e.key === 'ArrowLeft')  medioResaltado = Math.max(0, medioResaltado - 1);
    if (e.key === 'ArrowDown')  medioResaltado = Math.min(botones.length - 1, medioResaltado + porFila);
    if (e.key === 'ArrowUp')    medioResaltado = Math.max(0, medioResaltado - porFila);

    botones.forEach((b, i) => b.classList.toggle('resaltado', i === medioResaltado));
    // Algunos navegadores antiguos no traen scrollIntoView con opciones
    if (botones[medioResaltado].scrollIntoView) {
      botones[medioResaltado].scrollIntoView({ block: 'nearest' });
    }
    return true;
  }

  if (e.key === 'Enter') {
    e.preventDefault();
    const marcado = botones.some(b => b.classList.contains('active'));

    /* Primer Enter: elegir el medio resaltado. Como ya no hay ninguno
       preseleccionado, este es el paso normal al abrir el cobro. */
    if (medioResaltado >= 0 && !marcado) {
      botones[medioResaltado].click();
      return true;
    }

    // Con medio ya elegido: confirmar, si el botón lo permite
    const confirmar = document.getElementById('btnConfirmarPago');
    if (confirmar && !confirmar.disabled) confirmar.click();
    return true;
  }

  return false;
}

/* Cuántos botones entran por fila, mirando su posición real en pantalla.
   Se calcula en vez de fijarlo, porque la grilla cambia con el ancho. */
function calcularColumnas(botones) {
  if (botones.length < 2) return 1;

  /* Los medios de pago ahora son una LISTA vertical: una columna, así
     que ↓ avanza de a uno. Se comprueba la clase en vez de medir, porque
     medir offsetTop devuelve 0 para todos si el modal aún no terminó de
     pintarse, y ahí ↓ saltaba al último elemento. */
  if (botones[0].closest('.pago-metodos-lista')) return 1;

  const arriba = botones[0].offsetTop;
  let n = 0;
  for (const b of botones) { if (b.offsetTop === arriba) n++; else break; }
  return Math.max(1, n);
}

/* Teclas que muestra la ayuda para un ítem: las fijas si las tiene, o
   la configurada si es reasignable. */
function teclasDe(item) {
  if (item.teclas) return item.teclas;
  if (item.clave) {
    const t = atajoDe(item.clave) || '?';
    // Los que se disparan con Alt se muestran como combinación
    return ['agregar', 'limpiar', 'merma'].includes(item.clave)
      ? ['Alt', String(t).toUpperCase()]
      : [String(t)];
  }
  return ['—'];
}

function buscarAtajo(coincide) {
  for (const g of ATAJOS) {
    for (const it of g.items) {
      if (it.soloAyuda || !it.accion) continue;
      if (coincide(teclasDe(it))) return it;
    }
  }
  return null;
}

/* ------------------------------------------------------------
   NAVEGACIÓN DE SUGERENCIAS CON EL TECLADO
   Antes había que soltar el teclado y usar el mouse para elegir un
   producto de la lista.
   ------------------------------------------------------------ */
function itemsSugerencias() {
  const caja = document.getElementById('posSugerencias');
  if (!caja || !caja.classList.contains('show')) return [];
  return Array.from(caja.querySelectorAll('.suggestion-item'));
}

function navegarSugerencias(e) {
  const items = itemsSugerencias();
  if (!items.length) { sugerenciaActiva = -1; return false; }

  if (e.key === 'ArrowDown') {
    e.preventDefault();
    sugerenciaActiva = (sugerenciaActiva + 1) % items.length;
    marcarSugerencia(items);
    return true;
  }
  if (e.key === 'ArrowUp') {
    e.preventDefault();
    sugerenciaActiva = sugerenciaActiva <= 0 ? items.length - 1 : sugerenciaActiva - 1;
    marcarSugerencia(items);
    return true;
  }
  if (e.key === 'Enter' && sugerenciaActiva >= 0) {
    e.preventDefault();
    e.stopPropagation();
    items[sugerenciaActiva].click();
    sugerenciaActiva = -1;
    return true;
  }
  return false;
}

function marcarSugerencia(items) {
  items.forEach((el, i) => el.classList.toggle('activa', i === sugerenciaActiva));
  const activo = items[sugerenciaActiva];
  if (activo && activo.scrollIntoView) activo.scrollIntoView({ block: 'nearest' });
}

/* Alt+N: sugerencia N, o medio de pago N si el modal de pago está abierto */
function elegirPorNumero(n) {
  const modalPago = document.getElementById('modalPago');
  if (modalPago && modalPago.classList.contains('show')) {
    const botones = modalPago.querySelectorAll('.pago-metodo-btn');
    if (botones[n - 1]) { botones[n - 1].click(); return true; }
    return false;
  }

  const items = itemsSugerencias();
  if (items[n - 1]) { items[n - 1].click(); sugerenciaActiva = -1; return true; }
  return false;
}

/* ESC cierra lo que esté abierto, en orden de "lo más encima primero".
   ------------------------------------------------------------
   Antes cada modal decidía por su cuenta si respondía a Escape, así que
   la mayoría simplemente no lo hacía y había que buscar el botón
   Cancelar con el mouse. Ahora hay un único manejador para todo el
   sistema. */
function manejarEscape() {
  // 1) Sugerencias desplegadas: se cierran sin tocar el modal de atrás
  const caja = document.querySelector('.suggestions-box.show');
  if (caja) {
    caja.classList.remove('show');
    sugerenciaActiva = -1;
    return;
  }

  // 2) El modal visible que esté más arriba en el DOM apilado
  const abiertos = Array.from(document.querySelectorAll('.modal-overlay.show'));
  if (!abiertos.length) return;

  const modal = abiertos[abiertos.length - 1];

  /* El login no se cierra con ESC: dejaría la app inutilizable sin
     forma de volver a entrar. Ahí ESC solo limpia el PIN escrito. */
  if (modal.id === 'modalLogin') return;

  /* Se prefiere pulsar el botón de cancelar del propio modal, porque
     muchos limpian estado además de ocultarse (formularios a medio
     llenar, selección de productos, etc.). Solo si no hay botón se
     oculta el modal a mano. */
  const cancelar = modal.querySelector(
    '[data-cerrar-modal], .btn-cerrar-modal, .modal-foot .btn-ghost, .modal-actions .btn-ghost'
  );

  if (cancelar && cancelar.offsetParent !== null) cancelar.click();
  else modal.classList.remove('show');
}

/* ------------------------------------------------------------
   ACCIONES
   ------------------------------------------------------------ */
function enfocar(id, seleccionar) {
  const el = document.getElementById(id);
  if (!el || el.disabled) return;
  el.focus();
  if (seleccionar && el.select) el.select();
}

function clic(id) {
  const el = document.getElementById(id);
  if (el && !el.disabled && el.offsetParent !== null) el.click();
}

function alternar(id) {
  const el = document.getElementById(id);
  if (!el || el.disabled) return;
  el.checked = !el.checked;
  el.dispatchEvent(new Event('change', { bubbles: true }));
}

function irAModulo(nombre) {
  const boton = document.querySelector(`[data-view="${nombre}"]`);
  if (boton) boton.click();
}

/* Ajusta la cantidad del último ítem del carrito. `cart` y `renderCart()`
   viven en pos.js (ámbito global compartido). */
function ajustarUltimo(delta) {
  if (typeof cart === 'undefined' || !cart.length) { showToast('El carrito está vacío', 'err'); return; }

  const item = cart[cart.length - 1];
  const nueva = Number(item.cantidad) + delta;

  if (nueva < 1) { showToast('Usa Alt+Supr para quitarlo del carrito', ''); return; }

  item.cantidad = nueva;
  item.subtotal = Number(item.precio_unitario) * nueva;
  if (typeof renderCart === 'function') renderCart();
  showToast(`${item.nombre}: ${nueva} un.`, 'ok');
}

function quitarUltimo() {
  if (typeof cart === 'undefined' || !cart.length) { showToast('El carrito está vacío', 'err'); return; }
  const fuera = cart.pop();
  if (typeof renderCart === 'function') renderCart();
  showToast(`Quitado: ${fuera.nombre}`, '');
}

/* ------------------------------------------------------------
   VENTANA DE AYUDA
   Se dibuja desde ATAJOS[], así no puede quedar desactualizada.
   ------------------------------------------------------------ */
function pintarAyudaAtajos() {
  const caja = document.getElementById('atajosLista');
  if (!caja) return;

  caja.innerHTML = ATAJOS.map(g => `
    <div class="atajos-grupo">
      <h4>${g.grupo}</h4>
      ${g.items.map(it => `
        <div class="atajo-fila">
          <span class="atajo-teclas">${teclasDe(it).map(t => `<kbd>${t}</kbd>`).join('<i>+</i>')}</span>
          <span class="atajo-desc">${it.desc}</span>
          ${it.clave
            ? `<button class="btn-editar-atajo" data-atajo="${it.clave}" title="Cambiar esta tecla">✏️ Cambiar</button>`
            : `<span class="atajo-fijo" title="Este atajo no se puede cambiar: es parte de la navegación del sistema">🔒</span>`}
        </div>`).join('')}
    </div>`).join('');
}

function alternarAyudaAtajos() {
  const modal = document.getElementById('modalAtajos');
  if (!modal) return;
  if (modal.classList.contains('show')) cerrarAyudaAtajos();
  else modal.classList.add('show');
}

function cerrarAyudaAtajos() {
  const modal = document.getElementById('modalAtajos');
  if (modal) modal.classList.remove('show');
}

/* ============================================================
   SUB-PESTAÑAS DEL SERVICIO TÉCNICO
   ------------------------------------------------------------
   Abonos y Repuestos dejaron de ser vistas del menú principal y pasaron
   a ser paneles dentro de Servicio Técnico. Sus id internos no
   cambiaron, así que encargos.js y repuestos.js siguen igual.

   Se emite `pos:subtab-taller` por si algún módulo necesita recargar
   datos al mostrarse.
   ============================================================ */
document.addEventListener('DOMContentLoaded', () => {
  const barra = document.getElementById('subtabsTaller');
  if (!barra) return;

  barra.addEventListener('click', (e) => {
    const boton = e.target.closest('.subtab');
    if (!boton) return;
    mostrarPanelTaller(boton.dataset.subtab);
  });
});

function mostrarPanelTaller(nombre) {
  document.querySelectorAll('#subtabsTaller .subtab').forEach(b => {
    b.classList.toggle('activo', b.dataset.subtab === nombre);
  });
  document.querySelectorAll('[data-panel-taller]').forEach(p => {
    p.classList.toggle('activo', p.dataset.panelTaller === nombre);
  });
  document.dispatchEvent(new CustomEvent('pos:subtab-taller', { detail: { panel: nombre } }));
}


/* ============================================================
   EDITOR DE ATAJOS
   ------------------------------------------------------------
   Se abre desde el lápiz de cada fila en la ventana de ayuda. Captura
   la siguiente tecla que se pulse y la valida contra TECLAS_PROHIBIDAS
   y contra los atajos ya asignados.
   ============================================================ */
let claveEnEdicion = null;

document.addEventListener('DOMContentLoaded', () => {
  // Delegación: las filas se regeneran cada vez que se abre la ayuda
  document.getElementById('atajosLista')?.addEventListener('click', (e) => {
    const btn = e.target.closest('.btn-editar-atajo');
    if (btn) abrirCapturaAtajo(btn.dataset.atajo);
  });

  /* Sin confirm() del navegador: es una ventana del sistema que no se
     puede cerrar con Esc ni estilizar, y restablecer atajos no es
     destructivo —se reasignan en dos clics. */
  document.getElementById('btnRestablecerAtajos')?.addEventListener('click', () => {
    restablecerAtajos();
    pintarAyudaAtajos();
    showToast('Atajos restablecidos a los originales', 'ok');
  });

  document.getElementById('btnCancelarCaptura')?.addEventListener('click', () => cerrarCaptura(true));
});

function abrirCapturaAtajo(clave) {
  claveEnEdicion = clave;
  const modal = document.getElementById('modalCapturaAtajo');
  if (!modal) return;

  /* Se cierra la ayuda mientras se captura: con las dos ventanas
     encima no se sabe cuál está activa, y la de atrás sigue viéndose
     entera. Se reabre al terminar. */
  cerrarAyudaAtajos();

  const nombre = document.getElementById('capturaNombre');
  if (nombre) nombre.textContent = ETIQUETAS_ATAJOS[clave] || clave;

  const actual = document.getElementById('capturaActual');
  if (actual) actual.textContent = atajoDe(clave);

  const aviso = document.getElementById('capturaAviso');
  if (aviso) { aviso.textContent = ''; aviso.className = 'captura-aviso'; }

  modal.classList.add('show');
  document.addEventListener('keydown', capturarTecla, true);
}

function cerrarCaptura(volverAAyuda) {
  document.getElementById('modalCapturaAtajo')?.classList.remove('show');
  document.removeEventListener('keydown', capturarTecla, true);
  claveEnEdicion = null;
  if (volverAAyuda === true) alternarAyudaAtajos();
}

function capturarTecla(e) {
  if (!claveEnEdicion) return;

  e.preventDefault();
  e.stopPropagation();

  // Escape sale sin cambiar nada
  if (e.key === 'Escape') { cerrarCaptura(true); return; }   // Esc vuelve a la lista

  const aviso = document.getElementById('capturaAviso');
  const motivo = motivoRechazo(e.key, claveEnEdicion);

  if (motivo) {
    if (aviso) {
      aviso.className = 'captura-aviso mal';
      aviso.textContent = `No se puede usar "${e.key === ' ' ? 'Espacio' : e.key}": ${motivo}`;
    }
    return;
  }

  guardarAtajo(claveEnEdicion, e.key);
  if (aviso) {
    aviso.className = 'captura-aviso ok';
    aviso.textContent = `✅ Asignada la tecla "${e.key}"`;
  }

  pintarAyudaAtajos();
  setTimeout(() => {
    cerrarCaptura();
    alternarAyudaAtajos();      // vuelve a la lista, ya actualizada
  }, 700);
}
