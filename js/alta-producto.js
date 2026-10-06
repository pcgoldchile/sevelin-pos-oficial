// ==========================================
// ALTA-PRODUCTO.JS - "Nuevo Producto": elegir cómo cargarlo
// ------------------------------------------
// El botón "Nuevo Producto" abre un selector con dos caminos:
//   · Paso a paso con IA  → js/asistente-producto.js (botón #btnAltaGuiada)
//   · Carga Manual        → el formulario completo de js/productos.js
//
// Este archivo era js/tiendanube.js y traía además "Carga por Comando /
// Tiendanube" (pegar el texto de la ficha del admin de Tiendanube). Se quitó
// entera el 06-10-2026 a pedido del dueño: ya no carga desde Tiendanube.
// Para varios productos de una compra está js/carga-masiva.js.
// La importación por archivo CSV/Excel sigue en js/productos.js.
// ==========================================

const elModalMetodoAlta = document.getElementById('modalMetodoAlta');
const elBtnAltaManual = document.getElementById('btnAltaManual');
const elBtnCancelarMetodoAlta = document.getElementById('btnCancelarMetodoAlta');

document.addEventListener('DOMContentLoaded', () => {
  if (elBtnAltaManual) elBtnAltaManual.addEventListener('click', () => {
    cerrarModalAlta(elModalMetodoAlta);
    abrirModalProducto(null);            // formulario clásico de productos.js
  });
  if (elBtnCancelarMetodoAlta) elBtnCancelarMetodoAlta.addEventListener('click', () => cerrarModalAlta(elModalMetodoAlta));
  if (elModalMetodoAlta) elModalMetodoAlta.addEventListener('click', (e) => { if (e.target === elModalMetodoAlta) cerrarModalAlta(elModalMetodoAlta); });
});

/* Recibe el ELEMENTO, no el id. No se llama `cerrarModal` a propósito:
   js/balance.js ya declara cerrarModal(id) y, como todos los archivos
   comparten el ámbito global, la pisaba en silencio y "Nuevo Producto"
   quedaba trabado (bug 33). */
function cerrarModalAlta(modal) { if (modal) modal.classList.remove('show'); }

/* Punto de entrada, llamado desde el botón "Nuevo Producto". */
function abrirSelectorAltaProducto() {
  if (!esAdmin()) { showToast('Solo el administrador puede crear productos', 'err'); return; }

  // Sin el modal en el DOM se cae al formulario de siempre
  if (!elModalMetodoAlta) { abrirModalProducto(null); return; }
  elModalMetodoAlta.classList.add('show');
}
