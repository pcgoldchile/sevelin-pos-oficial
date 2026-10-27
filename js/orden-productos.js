// ==========================================
// ORDEN-PRODUCTOS.JS — Ventana "Orden y filtros" de Productos (27-10-2026)
// ------------------------------------------
// Pedido del dueño: en vez de una lista desplegable larga, una ventana con las
// opciones agrupadas (publicación en la web y Facebook, margen poco/medio/mucho,
// stock, lo que falta en la ficha) y cuántos productos hay en cada una.
// El valor elegido sigue viviendo en el <select id="ordenProductos"> oculto: lo
// leen handleBuscarProductoTabla(), la exportación y config.js.
// Los filtros son los de aplicarModoProductos() en productos.js.
// ==========================================

const GRUPOS_ORDEN_PRODUCTOS = [
  { titulo: 'Ordenar', opciones: [
    { valor: '', texto: 'Más recientes primero', icono: '🕒', sinConteo: true },
    { valor: 'nombre_asc', texto: 'Nombre A-Z', icono: '🔤', sinConteo: true },
    { valor: 'precio_desc', texto: 'Precio mayor a menor', icono: '⬇️', sinConteo: true },
    { valor: 'precio_asc', texto: 'Precio menor a mayor', icono: '⬆️', sinConteo: true },
    { valor: 'stock_desc', texto: 'Más stock primero', icono: '📦', sinConteo: true }
  ] },
  { titulo: 'Publicación', opciones: [
    { valor: 'no_web', texto: 'No publicados en la web', icono: '🌐', alerta: true },
    { valor: 'si_web', texto: 'Publicados en la web', icono: '🌐' },
    { valor: 'no_facebook', texto: 'No publicados en Facebook', icono: '📘', alerta: true },
    { valor: 'si_facebook', texto: 'Publicados en Facebook', icono: '📘' },
    { valor: 'en_oferta', texto: 'En oferta hoy', icono: '🏷️' }
  ] },
  { titulo: 'Margen', admin: true, opciones: [
    { valor: 'margen_poco', texto: 'Poco (bajo 15%)', icono: '🔴', tono: 'rojo' },
    { valor: 'margen_medio', texto: 'Medio (15% a 25%)', icono: '🟡', tono: 'ambar' },
    { valor: 'margen_mucho', texto: 'Mucho (desde 25%)', icono: '🟢', tono: 'verde' },
    { valor: 'margen_desc', texto: 'Margen % mayor a menor', icono: '📈' },
    { valor: 'utilidad_desc', texto: 'Utilidad $ mayor a menor', icono: '💰' },
    { valor: 'sin_costo', texto: 'Sin costo', icono: '❔', alerta: true }
  ] },
  { titulo: 'Stock', opciones: [
    { valor: 'con_stock', texto: 'Con stock', icono: '✅' },
    { valor: 'agotados_lista', texto: 'Agotados', icono: '⛔' },
    { valor: 'bajo_stock', texto: 'Bajo stock', icono: '⚠️' },
    { valor: 'por_llegar_lista', texto: 'Por llegar', icono: '🚚' }
  ] },
  { titulo: 'Le falta a la ficha', opciones: [
    { valor: 'sin_fotos', texto: 'Sin fotos', icono: '📷', alerta: true },
    { valor: 'sin_descripcion', texto: 'Sin descripción', icono: '📝', alerta: true },
    { valor: 'sin_sku', texto: 'Sin SKU', icono: '🏷️' },
    { valor: 'sin_barcode', texto: 'Sin código de barras', icono: '▦' },
    { valor: 'sin_medidas', texto: 'Sin medidas', icono: '📏' },
    { valor: 'con_sn', texto: 'Con S/N', icono: '🔢' },
    { valor: 'sin_sn', texto: 'Sin S/N', icono: '🔢' }
  ] },
  { titulo: 'Otras listas', opciones: [
    { valor: 'archivados', texto: 'Archivados', icono: '🗄️', sinConteo: true },
    { valor: 'borradores', texto: 'Borradores', icono: '✏️', sinConteo: true }
  ] }
];

function opcionOrdenProductos(valor) {
  for (const g of GRUPOS_ORDEN_PRODUCTOS) {
    const o = g.opciones.find(x => x.valor === valor);
    if (o) return o;
  }
  return null;
}

/* La lista con el buscador y el tipo de hoy, sin el filtro de orden. */
function baseParaContarOrdenProductos() {
  const q = (document.getElementById('buscarProductoTabla')?.value || '').trim().toLowerCase();
  return (typeof productsList !== 'undefined' ? productsList : []).filter(p =>
    (typeof cumpleTipoProducto !== 'function' || cumpleTipoProducto(p)) && (
      (p.nombre || '').toLowerCase().includes(q) ||
      (p.sku || '').toLowerCase().includes(q) ||
      (p.codigo_barras || '').toLowerCase().includes(q)
    ));
}

function pintarEtiquetaOrdenProductos() {
  const valor = document.getElementById('ordenProductos')?.value || '';
  const o = opcionOrdenProductos(valor);
  const etiqueta = document.getElementById('ordenProductosEtiqueta');
  if (etiqueta) etiqueta.textContent = o ? o.texto : 'Más recientes primero';
  document.getElementById('btnOrdenProductos')?.classList.toggle('activo', !!valor);
}

function abrirOrdenProductos() {
  const cont = document.getElementById('ordenProductosGrupos');
  if (!cont) return;
  const actual = document.getElementById('ordenProductos')?.value || '';
  const base = baseParaContarOrdenProductos();
  const admin = typeof esAdmin === 'function' && esAdmin();
  cont.innerHTML = GRUPOS_ORDEN_PRODUCTOS.filter(g => !g.admin || admin).map(g => `
    <section class="orden-prod-grupo">
      <h3>${escHtml(g.titulo)}</h3>
      <div class="orden-prod-opciones">
        ${g.opciones.map(o => {
          const cuantos = o.sinConteo || typeof aplicarModoProductos !== 'function' ? null : aplicarModoProductos(base, o.valor).length;
          const clases = ['orden-prod-op', o.valor === actual ? 'activo' : '', o.tono ? `tono-${o.tono}` : '',
            o.alerta && cuantos ? 'con-alerta' : '', cuantos === 0 ? 'vacio' : ''].filter(Boolean).join(' ');
          return `<button type="button" class="${clases}" data-orden-prod="${escHtml(o.valor)}">
            <span class="orden-prod-ico" aria-hidden="true">${o.icono}</span>
            <span class="orden-prod-texto">${escHtml(o.texto)}</span>
            ${cuantos === null ? '' : `<span class="orden-prod-num">${cuantos}</span>`}
          </button>`;
        }).join('')}
      </div>
    </section>`).join('');
  document.getElementById('modalOrdenProductos')?.classList.add('show');
}

function cerrarOrdenProductos() {
  document.getElementById('modalOrdenProductos')?.classList.remove('show');
}

function elegirOrdenProductos(valor) {
  const sel = document.getElementById('ordenProductos');
  if (!sel) return;
  sel.value = valor;
  sel.dispatchEvent(new Event('change'));
  pintarEtiquetaOrdenProductos();
  cerrarOrdenProductos();
}

document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('btnOrdenProductos')?.addEventListener('click', abrirOrdenProductos);
  document.getElementById('btnOrdenProductosCerrar')?.addEventListener('click', cerrarOrdenProductos);
  document.getElementById('btnOrdenProductosQuitar')?.addEventListener('click', () => elegirOrdenProductos(''));
  document.getElementById('ordenProductosGrupos')?.addEventListener('click', (e) => {
    const b = e.target.closest('[data-orden-prod]');
    if (b) elegirOrdenProductos(b.dataset.ordenProd);
  });
  document.getElementById('modalOrdenProductos')?.addEventListener('click', (e) => {
    if (e.target.id === 'modalOrdenProductos') cerrarOrdenProductos();
  });
  // config.js cambia el valor al entrar a Archivados/Borradores: la etiqueta lo sigue
  document.getElementById('ordenProductos')?.addEventListener('change', pintarEtiquetaOrdenProductos);
  pintarEtiquetaOrdenProductos();
});
