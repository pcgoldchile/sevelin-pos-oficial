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
    { teclas: ['F2'],            desc: 'Ir al buscador de productos',            accion: () => enfocar('posBuscarProducto', true) },
    { teclas: ['↑', '↓'],        desc: 'Recorrer las sugerencias',               soloAyuda: true },
    { teclas: ['Enter'],         desc: 'Elegir la sugerencia marcada',           soloAyuda: true },
    { teclas: ['Alt', '1..8'],   desc: 'Elegir directamente la sugerencia N',    soloAyuda: true },
    { teclas: ['F3'],            desc: 'Ir a Cantidad',                          accion: () => enfocar('itemCantidad', true) },
    { teclas: ['F4'],            desc: 'Ir a Precio Unitario',                   accion: () => enfocar('itemPrecio', true) },
    { teclas: ['Alt', 'A'],      desc: 'Agregar el producto al carrito',         accion: () => clic('btnAgregarItem') },
    { teclas: ['Alt', 'S'],      desc: 'Marcar / desmarcar "Tiene S/N"',         accion: () => alternar('checkTieneSN') },
    { teclas: ['Alt', 'L'],      desc: 'Limpiar la selección (no el carrito)',   accion: () => clic('btnLimpiarSeleccion') }
  ]},

  { grupo: 'Carrito', items: [
    { teclas: ['Alt', '+'],      desc: 'Sumar 1 al último producto del carrito', accion: () => ajustarUltimo(+1) },
    { teclas: ['Alt', '-'],      desc: 'Restar 1 al último producto',            accion: () => ajustarUltimo(-1) },
    { teclas: ['Alt', 'Supr'],   desc: 'Quitar el último producto',              accion: () => quitarUltimo() },
    { teclas: ['Alt', 'C'],      desc: 'Ir al campo Cliente',                    accion: () => enfocar('posCliente', true) },
    { teclas: ['Alt', 'H'],      desc: 'Activar / desactivar Editar hora',       accion: () => alternar('posEditarHora') },
    { teclas: ['Alt', 'O'],      desc: 'Activar / desactivar Sincronizar OT',    accion: () => alternar('posSincronizarOT') }
  ]},

  { grupo: 'Cerrar la venta', items: [
    { teclas: ['F9'],            desc: 'Finalizar venta (abre el pago)',         accion: () => clic('btnFinalizarVenta') },
    { teclas: ['Alt', 'M'],      desc: 'Registrar merma',                        accion: () => clic('btnMermaPOS') },
    { teclas: ['Alt', '1..5'],   desc: 'En el pago: elegir medio de pago',       soloAyuda: true },
    { teclas: ['Enter'],         desc: 'En el pago: confirmar',                  soloAyuda: true },
    { teclas: ['Esc'],           desc: 'Cerrar la ventana abierta',              soloAyuda: true }
  ]},

  { grupo: 'General', items: [
    { teclas: ['F1'],            desc: 'Mostrar esta ayuda',                     accion: () => alternarAyudaAtajos(), global: true },
    { teclas: ['Alt', 'P'],      desc: 'Volver al módulo POS',                   accion: () => irAModulo('pos'), global: true },
    { teclas: ['Esc'],           desc: 'Cerrar sugerencias o limpiar el foco',   soloAyuda: true }
  ]}
];

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
    'A': 'btnAgregarItem', 'L': 'btnLimpiarSeleccion', 'M': 'btnMermaPOS'
  };

  if (!enPOS() && tecla !== 'P') return false;

  if (mapa[tecla] && !hayModalAbierto()) { e.preventDefault(); clic(mapa[tecla]); return true; }

  switch (tecla) {
    case 'P': e.preventDefault(); irAModulo('pos'); return true;
    case 'C': if (hayModalAbierto()) return false; e.preventDefault(); enfocar('posCliente', true); return true;
    case 'S': if (hayModalAbierto()) return false; e.preventDefault(); alternar('checkTieneSN'); return true;
    case 'H': if (hayModalAbierto()) return false; e.preventDefault(); alternar('posEditarHora'); return true;
    case 'O': if (hayModalAbierto()) return false; e.preventDefault(); alternar('posSincronizarOT'); return true;
  }

  if (hayModalAbierto()) return false;

  if (e.key === '+' || e.key === '=') { e.preventDefault(); ajustarUltimo(+1); return true; }
  if (e.key === '-') { e.preventDefault(); ajustarUltimo(-1); return true; }
  if (e.key === 'Delete') { e.preventDefault(); quitarUltimo(); return true; }

  return false;
}

function buscarAtajo(coincide) {
  for (const g of ATAJOS) {
    for (const it of g.items) {
      if (it.soloAyuda || !it.accion) continue;
      if (coincide(it.teclas)) return it;
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

function manejarEscape() {
  // 1) Si hay ayuda de atajos abierta, se cierra primero
  const ayuda = document.getElementById('modalAtajos');
  if (ayuda && ayuda.classList.contains('show')) { cerrarAyudaAtajos(); return; }

  // 2) Si hay sugerencias desplegadas, se cierran sin tocar el resto
  const caja = document.getElementById('posSugerencias');
  if (caja && caja.classList.contains('show')) {
    caja.classList.remove('show');
    sugerenciaActiva = -1;
    return;
  }

  /* Los demás modales tienen su propio manejo de Escape (o su botón de
     cancelar); no se cierran desde acá para no interferir con
     confirmaciones a medio llenar. */
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
          <span class="atajo-teclas">${it.teclas.map(t => `<kbd>${t}</kbd>`).join('<i>+</i>')}</span>
          <span class="atajo-desc">${it.desc}</span>
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
