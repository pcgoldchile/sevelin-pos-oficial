// ==========================================
// PRODUCTOS.JS - Gestión de Inventario (Sevelin)
// ------------------------------------------
// Toda la escritura pasa por el backend, que además exige rol admin.
// Campos compatibles con Tiendanube: peso_kg, alto_cm, ancho_cm,
// profundidad_cm y descripcion.
// ==========================================

let productsList = [];
let editingProductId = null;
let productosSeleccionados = new Set();
let productosVisibles = [];   // última lista renderizada (para "seleccionar todo")

/* Íconos SVG: heredan el color del botón, así el lápiz nunca se pierde
   contra el fondo (antes era un emoji sobre un degradado dorado). */
const ICO_EDITAR_PROD = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>`;
const ICO_ETIQUETA_PROD = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20.6 13.4 12 22l-9-9V3h10l7.6 7.6a2 2 0 0 1 0 2.8Z"/><circle cx="7.5" cy="7.5" r="1.2"/></svg>`;
const ICO_ELIMINAR_PROD = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M8 6V4h8v2"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/></svg>`;

const elProductosTableBody = document.getElementById('productosTableBody');
const elBuscarProductoTabla = document.getElementById('buscarProductoTabla');
const elModalProducto = document.getElementById('modalProducto');
const elProductoFormTitle = document.getElementById('productoFormTitle');
const elProdEditId = document.getElementById('prodEditId');
const elProdSku = document.getElementById('prodSku');
const elProdBarcode = document.getElementById('prodBarcode');
const elProdNombre = document.getElementById('prodNombre');
const elProdCosto = document.getElementById('prodCosto');
const elProdPrecio = document.getElementById('prodPrecio');
const elProdStock = document.getElementById('prodStock');
const elProdRequiereSN = document.getElementById('prodRequiereSN');
const elProdEsRepuesto = document.getElementById('prodEsRepuesto');
const elProdStockMinimo = document.getElementById('prodStockMinimo');
const elProdSinAlertaStock = document.getElementById('prodSinAlertaStock');
const elProdStockActualizado = document.getElementById('prodStockActualizado');
const elProdStockIlimitado = document.getElementById('prodStockIlimitado');
const elGridProdStockControl = document.getElementById('gridProdStockControl');
const elProdPeso = document.getElementById('prodPeso');
const elProdAlto = document.getElementById('prodAlto');
const elProdAncho = document.getElementById('prodAncho');
const elProdProfundidad = document.getElementById('prodProfundidad');
const elProdDescripcion = document.getElementById('prodDescripcion');
const elBtnNuevoProducto = document.getElementById('btnNuevoProducto');
const elBtnCancelarProducto = document.getElementById('btnCancelarProducto');
const elBtnGuardarProducto = document.getElementById('btnGuardarProducto');
const elBtnEliminarTodosProductos = document.getElementById('btnEliminarTodosProductos');
const elOrdenProductos = document.getElementById('ordenProductos');
const elInputImportarProductos = document.getElementById('inputImportarProductos');
const elBtnImportarProductos = document.getElementById('btnImportarProductos');
const elBtnExportarProductosExcel = document.getElementById('btnExportarProductosExcel');
const elBtnExportarProductosCSV = document.getElementById('btnExportarProductosCSV');
const elBtnExportarProductosPDF = document.getElementById('btnExportarProductosPDF');
const elCheckTodosProductos = document.getElementById('checkTodosProductos');
const elPanelBajoStock = document.getElementById('panelBajoStock');
const elListaBajoStock = document.getElementById('listaBajoStock');
const elBadgeBajoStockTotal = document.getElementById('badgeBajoStockTotal');
const elBtnValorizacion = document.getElementById('btnValorizacion');
const elModalValorizacion = document.getElementById('modalValorizacion');
const elBtnCerrarValorizacion = document.getElementById('btnCerrarValorizacion');
const elValorCostoInventario = document.getElementById('valorCostoInventario');
const elValorVentaEstimada = document.getElementById('valorVentaEstimada');
const elValorGanancia = document.getElementById('valorGanancia');
const elValorMargen = document.getElementById('valorMargen');
const elValorizacionDetalle = document.getElementById('valorizacionDetalle');
const elValorizacionNota = document.getElementById('valorizacionNota');

const STOCK_MINIMO_POR_DEFECTO = 3;

document.addEventListener('DOMContentLoaded', () => {
  setupProductosEventListeners();
});

function setupProductosEventListeners() {
  if (elBuscarProductoTabla) elBuscarProductoTabla.addEventListener('input', handleBuscarProductoTabla);
  if (elBtnNuevoProducto) elBtnNuevoProducto.addEventListener('click', () => abrirModalProducto());
  if (elBtnCancelarProducto) elBtnCancelarProducto.addEventListener('click', cerrarModalProducto);
  if (elBtnGuardarProducto) elBtnGuardarProducto.addEventListener('click', guardarProducto);
  if (elBtnEliminarTodosProductos) elBtnEliminarTodosProductos.addEventListener('click', eliminarTodosLosProductos);

  if (elOrdenProductos) elOrdenProductos.addEventListener('change', handleBuscarProductoTabla);

  if (elCheckTodosProductos) elCheckTodosProductos.addEventListener('change', () => {
    if (elCheckTodosProductos.checked) productosVisibles.forEach(p => productosSeleccionados.add(String(p.id)));
    else productosVisibles.forEach(p => productosSeleccionados.delete(String(p.id)));
    renderProductosTabla(productosVisibles);
  });
  if (elBtnImportarProductos) elBtnImportarProductos.addEventListener('click', () => elInputImportarProductos?.click());
  if (elInputImportarProductos) elInputImportarProductos.addEventListener('change', handleImportarProductos);
  if (elBtnExportarProductosExcel) elBtnExportarProductosExcel.addEventListener('click', () => exportarProductos('xlsx'));
  if (elBtnExportarProductosCSV) elBtnExportarProductosCSV.addEventListener('click', () => exportarProductos('csv'));
  if (elBtnExportarProductosPDF) elBtnExportarProductosPDF.addEventListener('click', exportarProductosPDF);

  if (elModalProducto) {
    elModalProducto.addEventListener('click', (e) => { if (e.target === elModalProducto) cerrarModalProducto(); });
  }

  if (elBtnValorizacion) elBtnValorizacion.addEventListener('click', abrirValorizacion);
  if (elProdStockIlimitado) elProdStockIlimitado.addEventListener('change', aplicarStockIlimitadoProductoUI);
  if (elBtnCerrarValorizacion) elBtnCerrarValorizacion.addEventListener('click', cerrarValorizacion);
  if (elModalValorizacion) {
    elModalValorizacion.addEventListener('click', (e) => { if (e.target === elModalValorizacion) cerrarValorizacion(); });
  }
}

// ---------- Cargar productos desde el backend ----------
async function cargarProductos() {
  if (!tokenActual()) return;

  try {
    productsList = await API.productos.listar();

    // Se descartan las selecciones de productos que ya no están en pantalla
    const idsVisibles = new Set(productsList.map(p => String(p.id)));
    productosSeleccionados.forEach(id => { if (!idsVisibles.has(id)) productosSeleccionados.delete(id); });

    handleBuscarProductoTabla();
    renderPanelBajoStock();
  } catch (err) {
    console.error('Error al cargar productos:', err.message || err);
    showToast(err.message || 'Error al obtener el inventario', 'err');
  }
}

// Alias usado por pos.js
function loadProducts() { return cargarProductos(); }

// ============================================================
// CONTROL DE STOCK: alertas, badges y valorización
// ============================================================
function limiteStock(p) {
  const limite = Number(p.stock_minimo);
  return Number.isFinite(limite) && limite > 0 ? limite : STOCK_MINIMO_POR_DEFECTO;
}

/* Un producto entra en alerta solo si la alerta está activa para él.
   Los servicios o ítems sin inventario físico se excluyen con el switch
   "Desactivar alerta" del modal de producto. */
function tieneAlertaStock(p) {
  if (p.stock_ilimitado || p.alerta_stock === false) return false;
  return Number(p.stock || 0) <= limiteStock(p);
}

function badgeStock(p) {
  if (p.stock_ilimitado) return `<span class="stock-badge stock-ok">♾️ Ilimitado</span>`;
  const stock = Number(p.stock) || 0;
  if (p.alerta_stock === false) return `<span class="stock-badge stock-ok">${stock}</span>`;
  if (stock <= 0) return `<span class="stock-badge stock-agotado">Agotado</span>`;
  if (stock <= limiteStock(p)) return `<span class="stock-badge stock-bajo">⚠️ ${stock}</span>`;
  return `<span class="stock-badge stock-ok">${stock}</span>`;
}

function renderPanelBajoStock() {
  if (!elPanelBajoStock) return;

  const enAlerta = productsList.filter(tieneAlertaStock)
    .sort((a, b) => (Number(a.stock) || 0) - (Number(b.stock) || 0));

  if (enAlerta.length === 0) {
    elPanelBajoStock.style.display = 'none';
    return;
  }

  elPanelBajoStock.style.display = 'block';
  if (elBadgeBajoStockTotal) elBadgeBajoStockTotal.textContent = String(enAlerta.length);
  if (elListaBajoStock) {
    elListaBajoStock.innerHTML = enAlerta.slice(0, 12).map(p => `
      <div class="alerta-stock-item" data-abrir="${p.id}" title="Abrir ${p.nombre}">
        <span>${p.nombre}</span>
        <b>${Number(p.stock) || 0}</b>
        <span style="color:var(--text-muted);">/ mín. ${limiteStock(p)}</span>
      </div>
    `).join('') + (enAlerta.length > 12
      ? `<div class="alerta-stock-item" style="cursor:default;">y ${enAlerta.length - 12} más…</div>` : '');

    elListaBajoStock.querySelectorAll('[data-abrir]').forEach(item => {
      item.addEventListener('click', () => {
        const producto = productsList.find(p => String(p.id) === item.dataset.abrir);
        if (producto) abrirModalProducto(producto);
      });
    });
  }
}

function calcularValorizacion() {
  // Los productos de stock ilimitado (servicios) no aportan a la
  // valorización: su "stock" no representa unidades físicas reales.
  const conStockReal = productsList.filter(p => !p.stock_ilimitado);
  const ilimitados = productsList.length - conStockReal.length;

  const costo = conStockReal.reduce((a, p) => a + (Number(p.stock) || 0) * (Number(p.costo_unitario) || 0), 0);
  const venta = conStockReal.reduce((a, p) => a + (Number(p.stock) || 0) * (Number(p.precio_unitario) || 0), 0);
  const ganancia = venta - costo;
  const unidades = conStockReal.reduce((a, p) => a + (Number(p.stock) || 0), 0);
  const sinCosto = conStockReal.filter(p => (Number(p.stock) || 0) > 0 && !(Number(p.costo_unitario) > 0)).length;

  return { costo, venta, ganancia, margen: venta > 0 ? (ganancia / venta) * 100 : 0, unidades, sinCosto, ilimitados };
}

function abrirValorizacion() {
  if (!elModalValorizacion) return;
  const v = calcularValorizacion();

  if (elValorCostoInventario) elValorCostoInventario.textContent = fmtCLP(v.costo);
  if (elValorVentaEstimada) elValorVentaEstimada.textContent = fmtCLP(v.venta);
  if (elValorGanancia) elValorGanancia.textContent = fmtCLP(v.ganancia);
  if (elValorMargen) elValorMargen.textContent = `Margen estimado ${v.margen.toFixed(1)}%`;
  if (elValorizacionDetalle) {
    elValorizacionDetalle.textContent = `${productsList.length} producto(s) · ${v.unidades} unidad(es) en stock · actualizado al ${fechaHoraISOChile()}`;
  }
  if (elValorizacionNota) {
    const notas = [];
    if (v.ilimitados > 0) notas.push(`${v.ilimitados} producto(s) con stock ilimitado quedaron fuera de este cálculo.`);
    if (v.sinCosto > 0) notas.push(`${v.sinCosto} producto(s) con stock no tienen costo unitario cargado, por lo que la ganancia proyectada aparece más alta de lo real.`);
    elValorizacionNota.textContent = notas.join(' ');
  }

  elModalValorizacion.classList.add('show');
}

function cerrarValorizacion() {
  if (elModalValorizacion) elModalValorizacion.classList.remove('show');
}

// ---------- Render de la tabla ----------
function resumenMedidas(p) {
  const alto = Number(p.alto_cm) || 0;
  const ancho = Number(p.ancho_cm) || 0;
  const prof = Number(p.profundidad_cm) || 0;
  const peso = Number(p.peso_kg) || 0;
  if (!alto && !ancho && !prof && !peso) return '<span style="color:var(--text-muted);">—</span>';
  return `${alto || 0}×${ancho || 0}×${prof || 0} cm<br><small style="color:var(--text-muted);">${peso || 0} kg</small>`;
}

// ---------- Selección múltiple y barra flotante ----------
function actualizarBarraProductos() {
  const cantidad = productosSeleccionados.size;

  if (elCheckTodosProductos) {
    elCheckTodosProductos.checked = productosVisibles.length > 0 &&
      productosVisibles.every(p => productosSeleccionados.has(String(p.id)));
  }

  mostrarBarraSeleccion(cantidad, {
    onJSON: descargarProductosJSON,
    onCSV: descargarProductosExcel,
    onEliminar: eliminarProductosSeleccionados,
    onLimpiar: () => { productosSeleccionados.clear(); renderProductosTabla(productosVisibles); }
  });
}

function productosMarcados() {
  return productsList.filter(p => productosSeleccionados.has(String(p.id)));
}

function descargarProductosJSON() {
  const seleccion = productosMarcados();
  if (seleccion.length === 0) return;

  const respaldo = {
    sistema: 'Sevelin POS',
    modulo: 'Productos',
    generado_en: fechaHoraISOChile(),
    zona_horaria: 'America/Santiago',
    cantidad: seleccion.length,
    productos: seleccion
  };

  descargarArchivo(`respaldo_productos_${todayISO()}.json`, JSON.stringify(respaldo, null, 2));
  showToast(`${seleccion.length} producto(s) exportado(s) en JSON`, 'ok');
}

function descargarProductosExcel() {
  const seleccion = productosMarcados();
  if (seleccion.length === 0) return;

  const filas = seleccion.map(filaProductoParaExportar);
  const libro = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(libro, XLSX.utils.json_to_sheet(filas), 'Productos');
  XLSX.writeFile(libro, `productos_seleccionados_${todayISO()}.xlsx`);
  showToast(`${filas.length} producto(s) exportado(s) a Excel`, 'ok');
}

async function eliminarProductosSeleccionados() {
  const seleccion = productosMarcados();
  if (seleccion.length === 0) return;

  if (!confirm(`¿Estás seguro de que deseas eliminar los ${seleccion.length} registros seleccionados? Esta acción no se puede deshacer.`)) return;

  try {
    const r = await API.productos.eliminarLote(seleccion.map(p => p.id));

    productosSeleccionados.clear();
    ocultarBarraSeleccion();
    showToast(`${r.eliminadas} producto(s) eliminado(s)`, 'ok');

    await cargarProductos();
  } catch (err) {
    console.error('Error al eliminar los productos:', err.message || err);
    showToast(err.message || 'No se pudieron eliminar los productos', 'err');
  }
}

function renderProductosTabla(items) {
  if (!elProductosTableBody) return;
  productosVisibles = items || [];

  if (!items || items.length === 0) {
    elProductosTableBody.innerHTML = '<tr class="empty-row"><td colspan="11">No hay productos en el inventario. Crea uno o importa tu CSV de Tiendanube.</td></tr>';
    actualizarBarraProductos();
    return;
  }

  elProductosTableBody.innerHTML = items.map(p => {
    const marcada = productosSeleccionados.has(String(p.id));
    return `
    <tr class="row-in${marcada ? ' fila-marcada' : ''}">
      <td class="col-check"><input type="checkbox" data-sel="${p.id}" ${marcada ? 'checked' : ''}></td>
      <td>${p.sku || '-'}</td>
      <td>${p.codigo_barras || '-'}</td>
      <td>
        ${p.nombre}
        ${p.descripcion ? `<br><small style="color:var(--text-muted);">${String(p.descripcion).slice(0, 60)}${String(p.descripcion).length > 60 ? '…' : ''}</small>` : ''}
      </td>
      <td class="admin-only">${fmtCLP(p.costo_unitario)}</td>
      <td>${fmtCLP(p.precio_unitario)}</td>
      <td>${badgeStock(p)}</td>
      <td class="stock-fecha">${p.stock_actualizado_en ? tsAChile(p.stock_actualizado_en) : '—'}</td>
      <td>${resumenMedidas(p)}</td>
      <td>${p.requiere_sn ? '✅ Sí' : '—'}${p.es_repuesto ? '<br><span class="badge badge-gold">Repuesto</span>' : ''}</td>
      <td>
        <div class="cell-actions">
          <button class="btn btn-icon btn-icon-view" data-etiqueta="${p.id}" title="Imprimir etiqueta de código de barras">${ICO_ETIQUETA_PROD}</button>
          <button class="btn btn-icon btn-icon-edit" data-editar="${p.id}" title="Editar producto">${ICO_EDITAR_PROD}</button>
          <button class="btn btn-icon btn-icon-del" data-eliminar="${p.id}" title="Eliminar producto">${ICO_ELIMINAR_PROD}</button>
        </div>
      </td>
    </tr>`;
  }).join('');

  elProductosTableBody.querySelectorAll('input[data-sel]').forEach(chk => {
    chk.addEventListener('change', () => {
      const id = String(chk.dataset.sel);
      if (chk.checked) productosSeleccionados.add(id); else productosSeleccionados.delete(id);
      chk.closest('tr')?.classList.toggle('fila-marcada', chk.checked);
      actualizarBarraProductos();
    });
  });

  actualizarBarraProductos();

  elProductosTableBody.querySelectorAll('button[data-editar]').forEach(btn => {
    btn.addEventListener('click', () => {
      const producto = productsList.find(p => String(p.id) === btn.dataset.editar);
      if (producto) abrirModalProducto(producto);
    });
  });

  elProductosTableBody.querySelectorAll('button[data-etiqueta]').forEach(btn => {
    btn.addEventListener('click', () => {
      const producto = productsList.find(p => String(p.id) === btn.dataset.etiqueta);
      if (producto && typeof abrirModalEtiqueta === 'function') abrirModalEtiqueta(producto);
    });
  });

  elProductosTableBody.querySelectorAll('button[data-eliminar]').forEach(btn => {
    btn.addEventListener('click', () => eliminarProducto(btn.dataset.eliminar));
  });
}

// ---------- Filtro de búsqueda + orden/filtro especial ----------
function handleBuscarProductoTabla() {
  const q = (elBuscarProductoTabla?.value || '').trim().toLowerCase();
  const modo = elOrdenProductos ? elOrdenProductos.value : '';

  let resultado = productsList.filter(p =>
    (p.nombre || '').toLowerCase().includes(q) ||
    (p.sku || '').toLowerCase().includes(q) ||
    (p.codigo_barras || '').toLowerCase().includes(q)
  );

  switch (modo) {
    case 'precio_desc':
      resultado = resultado.slice().sort((a, b) => (b.precio_unitario || 0) - (a.precio_unitario || 0));
      break;
    case 'precio_asc':
      resultado = resultado.slice().sort((a, b) => (a.precio_unitario || 0) - (b.precio_unitario || 0));
      break;
    case 'sin_sku':
      resultado = resultado.filter(p => !p.sku || !p.sku.trim());
      break;
    case 'sin_barcode':
      resultado = resultado.filter(p => !p.codigo_barras || !p.codigo_barras.trim());
      break;
    case 'sin_costo':
      resultado = resultado.filter(p => !p.costo_unitario || Number(p.costo_unitario) === 0);
      break;
    case 'sin_medidas':
      resultado = resultado.filter(p => !Number(p.peso_kg) && !Number(p.alto_cm) && !Number(p.ancho_cm) && !Number(p.profundidad_cm));
      break;
    case 'bajo_stock':
      resultado = resultado.filter(tieneAlertaStock).sort((a, b) => (Number(a.stock) || 0) - (Number(b.stock) || 0));
      break;
    default:
      resultado = resultado.slice().sort((a, b) => (a.nombre || '').localeCompare(b.nombre || ''));
  }

  renderProductosTabla(resultado);
}

// ---------- Modal Crear / Editar ----------

/* Cuando el producto es de stock ilimitado (ej. un servicio), el campo
   Stock deja de tener sentido: se deshabilita y se ocultan los controles
   de alerta de bajo stock. */
function aplicarStockIlimitadoProductoUI() {
  const ilimitado = !!(elProdStockIlimitado && elProdStockIlimitado.checked);

  if (elProdStock) {
    elProdStock.disabled = ilimitado;
    elProdStock.placeholder = ilimitado ? 'Ilimitado' : '0';
    if (ilimitado) elProdStock.value = '';
  }
  if (elGridProdStockControl) elGridProdStockControl.style.display = ilimitado ? 'none' : '';
}

function abrirModalProducto(producto = null) {
  if (!elModalProducto) return;
  if (!esAdmin()) { showToast('Solo el administrador puede editar productos', 'err'); return; }

  if (producto) {
    editingProductId = producto.id;
    if (elProductoFormTitle) elProductoFormTitle.textContent = 'Editar Producto';
    if (elProdEditId) elProdEditId.value = producto.id;
    if (elProdSku) elProdSku.value = producto.sku || '';
    if (elProdBarcode) elProdBarcode.value = producto.codigo_barras || '';
    if (elProdNombre) elProdNombre.value = producto.nombre || '';
    if (elProdCosto) elProdCosto.value = producto.costo_unitario || 0;
    if (elProdPrecio) elProdPrecio.value = producto.precio_unitario || 0;
    if (elProdStock) elProdStock.value = producto.stock || 0;
    if (elProdRequiereSN) elProdRequiereSN.checked = !!producto.requiere_sn;
    if (elProdEsRepuesto) elProdEsRepuesto.checked = !!producto.es_repuesto;
    if (elProdStockMinimo) elProdStockMinimo.value = producto.stock_minimo ?? STOCK_MINIMO_POR_DEFECTO;
    if (elProdSinAlertaStock) elProdSinAlertaStock.checked = producto.alerta_stock === false;
    if (elProdStockIlimitado) elProdStockIlimitado.checked = !!producto.stock_ilimitado;
    if (elProdStockActualizado) {
      elProdStockActualizado.textContent = producto.stock_actualizado_en
        ? `Última actualización de stock: ${tsAChile(producto.stock_actualizado_en)}`
        : 'Última actualización de stock: sin registro previo.';
    }
    if (elProdPeso) elProdPeso.value = producto.peso_kg || 0;
    if (elProdAlto) elProdAlto.value = producto.alto_cm || 0;
    if (elProdAncho) elProdAncho.value = producto.ancho_cm || 0;
    if (elProdProfundidad) elProdProfundidad.value = producto.profundidad_cm || 0;
    if (elProdDescripcion) elProdDescripcion.value = producto.descripcion || '';
  } else {
    editingProductId = null;
    if (elProductoFormTitle) elProductoFormTitle.textContent = 'Nuevo Producto';
    if (elProdEditId) elProdEditId.value = '';
    [elProdSku, elProdBarcode, elProdNombre, elProdDescripcion].forEach(el => { if (el) el.value = ''; });
    [elProdCosto, elProdPrecio, elProdStock, elProdPeso, elProdAlto, elProdAncho, elProdProfundidad]
      .forEach(el => { if (el) el.value = 0; });
    if (elProdRequiereSN) elProdRequiereSN.checked = false;
    if (elProdEsRepuesto) elProdEsRepuesto.checked = false;
    if (elProdStockMinimo) elProdStockMinimo.value = STOCK_MINIMO_POR_DEFECTO;
    if (elProdSinAlertaStock) elProdSinAlertaStock.checked = false;
    if (elProdStockIlimitado) elProdStockIlimitado.checked = false;
    if (elProdStockActualizado) elProdStockActualizado.textContent = 'Última actualización de stock: se registrará al guardar.';
  }

  aplicarStockIlimitadoProductoUI();

  elModalProducto.classList.add('show');
  setTimeout(() => elProdNombre?.focus(), 80);
}

function cerrarModalProducto() {
  if (elModalProducto) elModalProducto.classList.remove('show');
  editingProductId = null;
}

// ---------- Guardar (crear / actualizar) ----------
async function guardarProducto() {
  const nombre = (elProdNombre?.value || '').trim();
  if (!nombre) { showToast('El nombre del producto es obligatorio', 'err'); return; }

  const payload = {
    sku: elProdSku?.value.trim() || null,
    codigo_barras: elProdBarcode?.value.trim() || null,
    nombre,
    costo_unitario: Number(elProdCosto?.value) || 0,
    precio_unitario: Number(elProdPrecio?.value) || 0,
    stock: Number(elProdStock?.value) || 0,
    requiere_sn: !!(elProdRequiereSN && elProdRequiereSN.checked),
    es_repuesto: !!(elProdEsRepuesto && elProdEsRepuesto.checked),
    stock_minimo: Number(elProdStockMinimo?.value) || 0,
    alerta_stock: !(elProdSinAlertaStock && elProdSinAlertaStock.checked),
    stock_ilimitado: !!(elProdStockIlimitado && elProdStockIlimitado.checked),
    peso_kg: Number(elProdPeso?.value) || 0,
    alto_cm: Number(elProdAlto?.value) || 0,
    ancho_cm: Number(elProdAncho?.value) || 0,
    profundidad_cm: Number(elProdProfundidad?.value) || 0,
    descripcion: elProdDescripcion?.value.trim() || null
  };

  if (elBtnGuardarProducto) elBtnGuardarProducto.disabled = true;

  try {
    if (editingProductId) await API.productos.actualizar(editingProductId, payload);
    else await API.productos.crear(payload);

    showToast(editingProductId ? 'Producto actualizado' : 'Producto creado', 'ok');
    cerrarModalProducto();
    cargarProductos();
  } catch (err) {
    console.error('Error al guardar el producto:', err.message || err);
    showToast(err.message || 'Error al guardar el producto', 'err');
  } finally {
    if (elBtnGuardarProducto) elBtnGuardarProducto.disabled = false;
  }
}

// ---------- Eliminar ----------
async function eliminarProducto(id) {
  if (!confirm('¿Eliminar este producto del inventario?')) return;

  try {
    await API.productos.eliminar(id);
    showToast('Producto eliminado', 'ok');
    cargarProductos();
  } catch (err) {
    console.error('Error al eliminar producto:', err.message || err);
    showToast(err.message || 'No se pudo eliminar el producto', 'err');
  }
}

async function eliminarTodosLosProductos() {
  if (!confirm('⚠️ Esto eliminará TODOS los productos del inventario. ¿Continuar?')) return;
  if (!confirm('Esta acción no se puede deshacer. ¿Confirmas que quieres eliminar todo el catálogo?')) return;

  try {
    await API.productos.eliminarTodos();
    showToast('Todos los productos fueron eliminados', 'ok');
    cargarProductos();
  } catch (err) {
    console.error('Error al eliminar todos los productos:', err.message || err);
    // Causa más común: hay ventas que referencian estos productos (venta_items.producto_id)
    showToast(err.message || 'No se pudo eliminar el catálogo completo', 'err');
  }
}

// ============================================================
// IMPORTAR productos desde CSV / Excel (compatible con Tiendanube)
// ============================================================

/* Dos normalizaciones por encabezado:
   · "Peso (kg)" → "peso (kg)"  (sin tildes, minúsculas)
   · "Peso (kg)" → "pesokg"     (solo letras y números)
   Así reconocemos tanto los encabezados exactos de Tiendanube como
   variantes tipo "PesoKg", "peso_kg", "Peso kg" o "PESO (KG)". */
function normalizarEncabezado(txt) {
  return String(txt || '')
    .toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .trim();
}
function claveCompacta(txt) {
  return normalizarEncabezado(txt).replace(/[^a-z0-9]/g, '');
}

function mapearFilaImportada(fila) {
  const claves = {};
  Object.keys(fila).forEach(k => {
    claves[normalizarEncabezado(k)] = fila[k];
    claves[claveCompacta(k)] = fila[k];
  });

  const buscar = (...nombres) => {
    for (const n of nombres) {
      const v = claves[n] !== undefined ? claves[n] : claves[claveCompacta(n)];
      if (v !== undefined && v !== null && String(v).trim() !== '') return v;
    }
    return null;
  };

  /* Números en formato chileno o internacional:
       "19.990"    → 19990   (punto como separador de miles)
       "1.234,56"  → 1234.56
       "4,5"       → 4.5
       "0.2"       → 0.2     (punto decimal: no son 3 dígitos después)
       "$ 12.000"  → 12000                                            */
  const aNumero = (valor) => {
    if (valor === null || valor === undefined) return 0;
    const limpio = String(valor).replace(/[^\d,.-]/g, '').trim();
    if (!limpio) return 0;

    if (limpio.includes(',') && limpio.includes('.')) {
      return Number(limpio.replace(/\./g, '').replace(',', '.')) || 0;
    }
    if (limpio.includes(',')) return Number(limpio.replace(',', '.')) || 0;
    // Punto como separador de miles: 1.234 / 19.990 / 1.234.567
    if (/^-?\d{1,3}(\.\d{3})+$/.test(limpio)) return Number(limpio.replace(/\./g, '')) || 0;
    return Number(limpio) || 0;
  };

  const nombre = buscar('nombre', 'name', 'producto', 'titulo', 'title');
  if (!nombre) return null; // fila sin nombre, se ignora

  return {
    sku: buscar('sku', 'codigo', 'código', 'identificador de url') || null,
    codigo_barras: buscar('codigo de barras', 'código de barras', 'barcode', 'ean', 'codigo de barra') || null,
    nombre: String(nombre).trim(),
    costo_unitario: aNumero(buscar('costo', 'costo unitario', 'cost', 'precio de costo')),
    precio_unitario: aNumero(buscar('precio', 'precio unitario', 'price', 'precio de venta')),
    stock: aNumero(buscar('stock', 'existencia', 'cantidad', 'quantity')),
    // Encabezados exactos de Tiendanube + variantes
    peso_kg: aNumero(buscar('peso (kg)', 'pesokg', 'peso', 'weight')),
    alto_cm: aNumero(buscar('alto (cm)', 'altocm', 'alto', 'height')),
    ancho_cm: aNumero(buscar('ancho (cm)', 'anchocm', 'ancho', 'width')),
    profundidad_cm: aNumero(buscar('profundidad (cm)', 'profundidadcm', 'profundidad', 'largo (cm)', 'largo', 'depth')),
    descripcion: buscar('descripcion', 'descripción', 'description', 'detalle') || null,
    stock_minimo: aNumero(buscar('stock minimo', 'stock mínimo', 'minimo', 'alerta stock')) || 0,
    requiere_sn: false
  };
}

async function handleImportarProductos(e) {
  const file = e.target.files[0];
  if (!file) return;

  try {
    const buffer = await file.arrayBuffer();
    // XLSX lee también CSV; para CSV de Tiendanube (separado por ";") detecta el separador solo.
    const workbook = XLSX.read(buffer, { type: 'array', raw: false });
    const hoja = workbook.Sheets[workbook.SheetNames[0]];
    const filas = XLSX.utils.sheet_to_json(hoja, { defval: '' });

    const productosNuevos = filas.map(mapearFilaImportada).filter(Boolean);

    if (productosNuevos.length === 0) {
      showToast('El archivo no tiene filas válidas (falta la columna Nombre)', 'err');
      e.target.value = '';
      return;
    }

    const conMedidas = productosNuevos.filter(p => p.peso_kg || p.alto_cm || p.ancho_cm || p.profundidad_cm).length;
    if (!confirm(`Se importarán ${productosNuevos.length} producto(s) al catálogo (${conMedidas} con medidas). ¿Continuar?`)) {
      e.target.value = '';
      return;
    }

    // Se envían por lotes para no exceder el límite del backend
    let importados = 0;
    for (let i = 0; i < productosNuevos.length; i += 200) {
      const lote = productosNuevos.slice(i, i + 200);
      const r = await API.productos.importar(lote);
      importados += r?.importados || lote.length;
    }

    showToast(`${importados} producto(s) importado(s) con éxito`, 'ok');
    cargarProductos();
  } catch (err) {
    console.error('Error al importar productos:', err.message || err);
    showToast('Error al importar: ' + (err.message || 'formato no reconocido'), 'err');
  } finally {
    e.target.value = '';
  }
}

// ============================================================
// EXPORTAR productos (Excel / CSV / PDF)
// ============================================================
function obtenerFilasProductosParaExportar() {
  const q = (elBuscarProductoTabla?.value || '').trim().toLowerCase();
  const modo = elOrdenProductos ? elOrdenProductos.value : '';
  let base = productsList.filter(p =>
    (p.nombre || '').toLowerCase().includes(q) ||
    (p.sku || '').toLowerCase().includes(q) ||
    (p.codigo_barras || '').toLowerCase().includes(q)
  );
  if (modo === 'precio_desc') base = base.slice().sort((a, b) => (b.precio_unitario || 0) - (a.precio_unitario || 0));
  else if (modo === 'precio_asc') base = base.slice().sort((a, b) => (a.precio_unitario || 0) - (b.precio_unitario || 0));
  else if (modo === 'sin_sku') base = base.filter(p => !p.sku || !p.sku.trim());
  else if (modo === 'sin_barcode') base = base.filter(p => !p.codigo_barras || !p.codigo_barras.trim());
  else if (modo === 'sin_costo') base = base.filter(p => !p.costo_unitario || Number(p.costo_unitario) === 0);
  else if (modo === 'sin_medidas') base = base.filter(p => !Number(p.peso_kg) && !Number(p.alto_cm) && !Number(p.ancho_cm) && !Number(p.profundidad_cm));
  else base = base.slice().sort((a, b) => (a.nombre || '').localeCompare(b.nombre || ''));

  // Encabezados idénticos a Tiendanube para poder reimportar sin tocar nada
  return base.map(filaProductoParaExportar);
}

function filaProductoParaExportar(p) {
  return {
    SKU: p.sku || '',
    'Código de Barras': p.codigo_barras || '',
    Nombre: p.nombre || '',
    Descripción: p.descripcion || '',
    Costo: Number(p.costo_unitario) || 0,
    Precio: Number(p.precio_unitario) || 0,
    Stock: Number(p.stock) || 0,
    'Peso (kg)': Number(p.peso_kg) || 0,
    'Alto (cm)': Number(p.alto_cm) || 0,
    'Ancho (cm)': Number(p.ancho_cm) || 0,
    'Profundidad (cm)': Number(p.profundidad_cm) || 0,
    'Requiere S/N': p.requiere_sn ? 'Sí' : 'No',
    'Stock Mínimo': Number(p.stock_minimo) || 0,
    'Alerta de Stock': p.alerta_stock === false ? 'Desactivada' : 'Activa',
    'Stock Ilimitado': p.stock_ilimitado ? 'Sí' : 'No',
    'Última Act. Stock': p.stock_actualizado_en ? tsAChile(p.stock_actualizado_en) : ''
  };
}

function exportarProductos(formato) {
  const filas = obtenerFilasProductosParaExportar();
  if (filas.length === 0) { showToast('No hay productos para exportar', 'err'); return; }

  const hoja = XLSX.utils.json_to_sheet(filas);
  const libro = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(libro, hoja, 'Productos');

  XLSX.writeFile(libro, `productos_${todayISO()}.${formato}`, { bookType: formato === 'csv' ? 'csv' : 'xlsx' });
  showToast('Exportación generada', 'ok');
}

function exportarProductosPDF() {
  const filas = obtenerFilasProductosParaExportar();
  if (filas.length === 0) { showToast('No hay productos para exportar', 'err'); return; }
  if (typeof window.jspdf === 'undefined') { showToast('No se pudo cargar el generador de PDF', 'err'); return; }

  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ orientation: 'landscape' });

  doc.setFontSize(14);
  doc.text(`Catálogo de Productos - ${NEGOCIO_NOMBRE}`, 14, 15);
  doc.setFontSize(9);
  doc.text(`Generado: ${todayISO()} · ${filas.length} producto(s)`, 14, 21);

  doc.autoTable({
    startY: 26,
    head: [['SKU', 'Código de Barras', 'Nombre', 'Costo', 'Precio', 'Stock', 'Alto', 'Ancho', 'Prof.', 'Peso']],
    body: filas.map(f => [
      f.SKU, f['Código de Barras'], f.Nombre, fmtCLP(f.Costo), fmtCLP(f.Precio), f.Stock,
      f['Alto (cm)'], f['Ancho (cm)'], f['Profundidad (cm)'], f['Peso (kg)']
    ]),
    styles: { fontSize: 8 },
    headStyles: { fillColor: [30, 41, 59] },
    alternateRowStyles: { fillColor: [248, 250, 252] }
  });

  doc.save(`productos_${todayISO()}.pdf`);
  showToast('PDF generado', 'ok');
}
