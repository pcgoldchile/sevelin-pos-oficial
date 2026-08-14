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
const elBtnExportarProducto = document.getElementById('btnExportarProducto');
const elModalFormatoExport = document.getElementById('modalFormatoExport');
const elFormatoExportNombre = document.getElementById('formatoExportNombre');
const elBtnExportProdJSON = document.getElementById('btnExportProdJSON');
const elBtnExportProdCSV = document.getElementById('btnExportProdCSV');
const elBtnCancelarFormatoExport = document.getElementById('btnCancelarFormatoExport');
const elModalModoImportacion = document.getElementById('modalModoImportacion');
const elModoImportacionResumen = document.getElementById('modoImportacionResumen');
const elBtnImportOmitir = document.getElementById('btnImportOmitir');
const elBtnImportActualizar = document.getElementById('btnImportActualizar');
const elBtnCancelarModoImportacion = document.getElementById('btnCancelarModoImportacion');
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
  /* El código de barras solo acepta dígitos mientras se escribe. Se
     filtra en el `input` y no solo al guardar, para que el usuario vea
     de inmediato que ese campo es numérico. El escáner sigue
     funcionando: los lectores mandan dígitos. */
  ['prodBarcode', 'revBarcode'].forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;
    el.addEventListener('input', () => {
      const limpio = el.value.replace(/\D/g, '');
      if (limpio !== el.value) el.value = limpio;
    });
  });

  // Exportación individual desde el modal de producto
  if (elBtnExportarProducto) elBtnExportarProducto.addEventListener('click', abrirModalFormatoExport);
  if (elBtnCancelarFormatoExport) elBtnCancelarFormatoExport.addEventListener('click', cerrarModalFormatoExport);
  if (elBtnExportProdJSON) elBtnExportProdJSON.addEventListener('click', () => exportarProductoIndividual('json'));
  if (elBtnExportProdCSV) elBtnExportProdCSV.addEventListener('click', () => exportarProductoIndividual('csv'));
  if (elModalFormatoExport) elModalFormatoExport.addEventListener('click', (e) => {
    if (e.target === elModalFormatoExport) cerrarModalFormatoExport();
  });

  // Selector de modo de importación masiva
  if (elBtnCancelarModoImportacion) elBtnCancelarModoImportacion.addEventListener('click', cancelarModoImportacion);
  if (elBtnImportOmitir) elBtnImportOmitir.addEventListener('click', () => procesarImportacion('omitir'));
  if (elBtnImportActualizar) elBtnImportActualizar.addEventListener('click', () => procesarImportacion('actualizar'));

  if (elBuscarProductoTabla) elBuscarProductoTabla.addEventListener('input', handleBuscarProductoTabla);
  /* "Nuevo Producto" ya no abre el formulario directo: primero pregunta si
     la carga es manual o pegando la ficha de Tiendanube (js/tiendanube.js).
     Si ese módulo no está cargado, se cae al formulario de siempre. */
  if (elBtnNuevoProducto) elBtnNuevoProducto.addEventListener('click', () => {
    if (typeof abrirSelectorAltaProducto === 'function') abrirSelectorAltaProducto();
    else abrirModalProducto();
  });
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

/* ============================================================
   CACHÉ DEL CATÁLOGO
   ------------------------------------------------------------
   RENDIMIENTO. `cargarProductos()` se llamaba CADA VEZ que se entraba
   al módulo Productos (js/config.js lo dispara en la navegación), más al
   iniciar sesión, más después de cada venta. Cada llamada traía las 108
   filas completas otra vez, aunque no hubiera cambiado nada, y arrastraba
   consigo la carga de lotes.

   Ahora el catálogo se considera fresco por 90 segundos. Al entrar a
   Productos dentro de ese margen se repinta con lo que ya está en
   memoria, sin tocar la red.

   IMPORTANTE — esto NO puede dejar el stock desactualizado, porque
   `invalidarCacheProductos()` se llama en todo lo que modifica el
   catálogo: guardar, borrar, importar, registrar una venta, una merma o
   un movimiento de lotes. La caché solo se salta el viaje cuando de
   verdad no pasó nada. Y `cargarProductos(true)` la ignora siempre.
   ============================================================ */
const CACHE_PRODUCTOS_MS = 90000;
let productosCargadosEn = 0;
let cargaProductosEnCurso = null;

function invalidarCacheProductos() { productosCargadosEn = 0; }

// ---------- Cargar productos desde el backend ----------
async function cargarProductos(forzar = false) {
  if (!tokenActual()) return;

  const fresco = productsList.length > 0 &&
                 (Date.now() - productosCargadosEn) < CACHE_PRODUCTOS_MS;

  if (!forzar && fresco) {
    // Se repinta igual: pudo cambiar el filtro o la página de la tabla
    handleBuscarProductoTabla();
    renderPanelBajoStock();
    return;
  }

  /* Si ya hay una carga en vuelo, se devuelve ESA promesa en vez de
     lanzar otra. Al iniciar sesión, config.js y pos.js podían pedir el
     catálogo casi al mismo tiempo y salían dos peticiones idénticas. */
  if (cargaProductosEnCurso) return cargaProductosEnCurso;

  cargaProductosEnCurso = (async () => {
  try {
    productsList = await API.productos.listar();
    productosCargadosEn = Date.now();

    // Se descartan las selecciones de productos que ya no están en pantalla
    const idsVisibles = new Set(productsList.map(p => String(p.id)));
    productosSeleccionados.forEach(id => { if (!idsVisibles.has(id)) productosSeleccionados.delete(id); });

    /* Capas de costo de los productos que tienen los lotes activos. Se
       piden antes de pintar para que la columna PEPS salga completa en el
       primer render y no parpadee. */
    if (typeof precargarLotesVisibles === 'function') {
      await precargarLotesVisibles(productsList);
    }

    handleBuscarProductoTabla();
    renderPanelBajoStock();
  } catch (err) {
    console.error('Error al cargar productos:', err.message || err);
    showToast(err.message || 'Error al obtener el inventario', 'err');
    productosCargadosEn = 0;    // un fallo no debe quedar cacheado
  } finally {
    cargaProductosEnCurso = null;
  }
  })();

  return cargaProductosEnCurso;
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

/* Corta un texto largo y le pone puntos suspensivos. El nombre completo
   queda en el `title`, así que pasar el mouse lo muestra entero. */
function acortar(texto, largo) {
  const t = String(texto == null ? '' : texto);
  return t.length > largo ? t.slice(0, largo).trimEnd() + '…' : t;
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
    /* Antes se listaban 12 productos en línea, que en un catálogo con 73
       en alerta ocupaba media pantalla y empujaba la tabla fuera de la
       vista. Ahora es un aviso de una línea con el botón al listado. */
    const agotados = enAlerta.filter(p => (Number(p.stock) || 0) <= 0).length;

    elListaBajoStock.innerHTML = `
      <div class="alerta-compacta">
        <span class="alerta-texto">
          <strong>${enAlerta.length}</strong> producto(s) bajo el stock mínimo
          ${agotados ? ` · <span class="stock-cero"><strong>${agotados}</strong> sin stock</span>` : ''}
        </span>
        <button class="btn btn-outline btn-sm" id="btnVerTodoBajoStock">
          👁 Ver y editar
        </button>
      </div>`;

    const btnTodos = document.getElementById('btnVerTodoBajoStock');
    if (btnTodos) btnTodos.addEventListener('click', () => abrirModalBajoStock(enAlerta));
  }
}

function filaBajoStock(p) {
  const agotado = (Number(p.stock) || 0) <= 0;
  return `
    <div class="alerta-stock-item" data-abrir="${p.id}" title="Editar ${String(p.nombre).replace(/"/g, '&quot;')}">
      <span>${p.nombre}${p.sku ? ` <small style="color:var(--text-muted);">· ${p.sku}</small>` : ''}</span>
      <b class="${agotado ? 'stock-cero' : ''}">${Number(p.stock) || 0}</b>
      <span style="color:var(--text-muted);">/ mín. ${limiteStock(p)}</span>
    </div>`;
}

/* Un solo enganche para las dos listas (el panel y el modal): al tocar
   un ítem se abre el editor de ese producto. */
function engancharBajoStock(contenedor) {
  if (!contenedor) return;
  contenedor.querySelectorAll('[data-abrir]').forEach(item => {
    item.addEventListener('click', () => {
      const producto = productsList.find(p => String(p.id) === item.dataset.abrir);
      if (!producto) return;
      const modal = document.getElementById('modalBajoStock');
      if (modal) modal.classList.remove('show');   // no dejar dos modales encima
      abrirModalProducto(producto);
    });
  });
}

/* Listado completo de productos en alerta, con buscador propio: con 60
   ítems, encontrar uno concreto en una lista plana es incómodo. */
function abrirModalBajoStock(enAlerta) {
  const modal = document.getElementById('modalBajoStock');
  const lista = document.getElementById('listaBajoStockTodos');
  const buscador = document.getElementById('buscarBajoStock');
  const resumen = document.getElementById('resumenBajoStock');
  if (!modal || !lista) return;

  const pintar = (filtro) => {
    const items = filtro
      ? filtrarPorBusqueda(enAlerta, filtro, p => [p.nombre, p.sku, p.codigo_barras], 200)
      : enAlerta;

    lista.innerHTML = items.length
      ? items.map(p => filaBajoStock(p)).join('')
      : '<div class="alerta-stock-item" style="cursor:default;">Sin coincidencias</div>';

    engancharBajoStock(lista);
    if (resumen) {
      const agotados = enAlerta.filter(p => (Number(p.stock) || 0) <= 0).length;
      resumen.textContent = `${enAlerta.length} producto(s) en alerta · ${agotados} sin stock` +
        (filtro ? ` · mostrando ${items.length}` : '');
    }
  };

  pintar('');
  if (buscador) {
    buscador.value = '';
    buscador.oninput = () => pintar(buscador.value);
    setTimeout(() => buscador.focus(), 80);
  }
  modal.classList.add('show');
}

// Cierre del modal de bajo stock
document.addEventListener('DOMContentLoaded', () => {
  const cerrar = document.getElementById('btnCerrarBajoStock');
  const modal = document.getElementById('modalBajoStock');
  if (cerrar && modal) cerrar.addEventListener('click', () => modal.classList.remove('show'));
  if (modal) modal.addEventListener('click', (e) => { if (e.target === modal) modal.classList.remove('show'); });
});

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

  const pin = await pedirPinAdmin({
    titulo: 'Eliminar productos seleccionados',
    mensaje: `¿Estás seguro de que deseas eliminar los ${seleccion.length} registros seleccionados? Esta acción no se puede deshacer.`,
    resumen: seleccion.slice(0, 4).map(p => `• ${p.nombre}`).join('\n') +
      (seleccion.length > 4 ? `\n… y ${seleccion.length - 4} más` : '')
  });
  if (!pin) return;

  try {
    const r = await API.productos.eliminarLote(seleccion.map(p => p.id), pin);

    productosSeleccionados.clear();
    ocultarBarraSeleccion();
    showToast(`${r.eliminadas} producto(s) eliminado(s)`, 'ok');

    await cargarProductos(true);
  } catch (err) {
    console.error('Error al eliminar los productos:', err.message || err);
    showToast(err.message || 'No se pudieron eliminar los productos', 'err');
  }
}

/* ============================================================
   PAGINACIÓN DE LA TABLA
   ------------------------------------------------------------
   POR QUÉ SE PAGINA EL RENDER Y NO LA CONSULTA:
   siete módulos dependen de `productsList` como catálogo COMPLETO en
   memoria —el buscador del POS, mermas, OT, lotes, tiendanube—. Traer
   solo 50 productos del servidor dejaría al POS sin poder encontrar el
   producto 51 al escribir o escanear.

   El cuello de botella real no es traer las filas (una consulta), sino
   PINTARLAS: 100 productos × 7 celdas son 700 nodos con sus handlers.
   Paginando el render se elimina ese costo y la búsqueda instantánea del
   POS sigue funcionando sobre el catálogo entero.
   ============================================================ */
const POR_PAGINA = 50;
let paginaActual = 1;
let itemsFiltrados = [];

function renderProductosTabla(items) {
  if (!elProductosTableBody) return;
  productosVisibles = items || [];

  if (!items || items.length === 0) {
    elProductosTableBody.innerHTML = '<tr class="empty-row"><td colspan="12">No hay productos en el inventario. Crea uno o importa tu CSV de Tiendanube.</td></tr>';
    actualizarBarraProductos();
    return;
  }

  /* La página se reinicia cuando cambia el conjunto filtrado: si estabas
     en la página 3 y filtras a 10 resultados, quedarías en una página
     vacía sin entender por qué. */
  if (items !== itemsFiltrados) { itemsFiltrados = items; paginaActual = 1; }

  const totalPaginas = Math.max(1, Math.ceil(items.length / POR_PAGINA));
  if (paginaActual > totalPaginas) paginaActual = totalPaginas;

  const desde = (paginaActual - 1) * POR_PAGINA;
  const pagina = items.slice(desde, desde + POR_PAGINA);

  renderPaginacion(items.length, totalPaginas, desde, pagina.length);

  elProductosTableBody.innerHTML = pagina.map(p => {
    const marcada = productosSeleccionados.has(String(p.id));
    return `
    <tr class="row-in${marcada ? ' fila-marcada' : ''}">
      <td class="col-check"><input type="checkbox" data-sel="${p.id}" ${marcada ? 'checked' : ''}></td>
      <td>
        <!-- El nombre abre el editor directo: es lo que uno intenta
             tocar por instinto antes de buscar el lápiz de la derecha.
             El title lleva el nombre completo, porque en la celda se
             corta a 40 caracteres. -->
        <a href="#" class="nombre-editable" data-editar="${p.id}"
           title="${String(p.nombre).replace(/"/g, '&quot;')}">${acortar(p.nombre, 40)}</a>
        <small class="fila-meta">
          ${p.sku ? `SKU ${acortar(p.sku, 22)}` : ''}
          ${p.requiere_sn ? ' · <b>S/N</b>' : ''}
          ${p.es_repuesto ? ' · Repuesto' : ''}
        </small>
      </td>
      <td class="admin-only">${fmtCLP(p.costo_unitario)}</td>
      <td>${fmtCLP(p.precio_unitario)}</td>
      <td>${badgeStock(p)}</td>
      <td class="admin-only">${typeof celdaLotes === 'function' ? celdaLotes(p) : '—'}</td>
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

  /* Antes esto era `button[data-editar]`: el nombre del producto ahora
     es un <a> con el mismo atributo, así que el selector se amplía a
     cualquier elemento. Sin este cambio, tocar el nombre no haría nada. */
  elProductosTableBody.querySelectorAll('[data-editar]').forEach(btn => {
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
    case 'con_sn':
      resultado = resultado.filter(p => !!p.requiere_sn);
      break;
    case 'sin_sn':
      resultado = resultado.filter(p => !p.requiere_sn);
      break;
    default:
      resultado = resultado.slice().sort((a, b) => (a.nombre || '').localeCompare(b.nombre || ''));
  }

  renderProductosTabla(resultado);
}

/* Controles de página. Se ocultan solos si todo cabe en una. */
function renderPaginacion(total, totalPaginas, desde, enPantalla) {
  const caja = document.getElementById('paginacionProductos');
  if (!caja) return;

  if (total <= POR_PAGINA) { caja.innerHTML = ''; return; }

  caja.innerHTML = `
    <span class="paginacion-info">
      Mostrando <strong>${desde + 1}–${desde + enPantalla}</strong> de <strong>${total}</strong> producto(s)
    </span>
    <div class="paginacion-botones">
      <button class="btn btn-outline btn-sm" id="btnPagPrimera" ${paginaActual === 1 ? 'disabled' : ''}>« Primera</button>
      <button class="btn btn-outline btn-sm" id="btnPagAnterior" ${paginaActual === 1 ? 'disabled' : ''}>‹ Anterior</button>
      <span class="paginacion-actual">Página ${paginaActual} de ${totalPaginas}</span>
      <button class="btn btn-outline btn-sm" id="btnPagSiguiente" ${paginaActual === totalPaginas ? 'disabled' : ''}>Siguiente ›</button>
      <button class="btn btn-outline btn-sm" id="btnPagUltima" ${paginaActual === totalPaginas ? 'disabled' : ''}>Última »</button>
    </div>`;

  /* Se vuelve a llamar con LA MISMA lista, así que la comprobación
     `items !== itemsFiltrados` del render no reinicia la página. */
  const ir = (n) => {
    paginaActual = Math.min(Math.max(1, n), totalPaginas);
    renderProductosTabla(itemsFiltrados);
    /* Volver al inicio de la tabla: cambiar de página con el scroll abajo
       desorienta. Se comprueba el método porque los WebView antiguos no
       lo traen. */
    const tabla = document.querySelector('#view-productos .table-wrapper');
    if (tabla && tabla.scrollIntoView) tabla.scrollIntoView({ block: 'nearest' });
  };

  document.getElementById('btnPagPrimera')?.addEventListener('click', () => ir(1));
  document.getElementById('btnPagAnterior')?.addEventListener('click', () => ir(paginaActual - 1));
  document.getElementById('btnPagSiguiente')?.addEventListener('click', () => ir(paginaActual + 1));
  document.getElementById('btnPagUltima')?.addEventListener('click', () => ir(totalPaginas));
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
    if (elProdUsaLotes) elProdUsaLotes.checked = !!producto.usa_lotes;
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
    // Un producto NUEVO siempre nace sin lotes: solo se activan a mano
    if (elProdUsaLotes) elProdUsaLotes.checked = false;
    if (elProdStockIlimitado) elProdStockIlimitado.checked = false;
    if (elProdStockActualizado) elProdStockActualizado.textContent = 'Última actualización de stock: se registrará al guardar.';
  }

  aplicarStockIlimitadoProductoUI();
  if (typeof alternarLotesUI === 'function') alternarLotesUI();

  // Solo se exporta lo que ya existe en la base
  if (elBtnExportarProducto) elBtnExportarProducto.style.display = producto ? '' : 'none';

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
    // Interruptor de costos por lote (PEPS). Apagado salvo que el admin lo marque.
    usa_lotes: !!(elProdUsaLotes && elProdUsaLotes.checked),
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
    cargarProductos(true);
  } catch (err) {
    console.error('Error al guardar el producto:', err.message || err);

    /* El servidor devuelve 409 con el campo exacto que chocó. Se marca
       ese campo en rojo y se le da el foco: sin eso el usuario tiene que
       adivinar cuál de los tres repite. */
    const campo = err?.duplicado?.campo;
    if (campo) {
      const mapa = { 'SKU': 'prodSku', 'Código de barras': 'prodBarcode', 'Nombre': 'prodNombre' };
      const el = document.getElementById(mapa[campo]);
      if (el) {
        el.classList.add('campo-duplicado');
        el.focus(); el.select?.();
        el.addEventListener('input', () => el.classList.remove('campo-duplicado'), { once: true });
      }
    }

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
    cargarProductos(true);
  } catch (err) {
    console.error('Error al eliminar producto:', err.message || err);
    showToast(err.message || 'No se pudo eliminar el producto', 'err');
  }
}

async function eliminarTodosLosProductos() {
  // Acción masiva: se exige reconfirmar el PIN de administrador
  const pin = await pedirPinAdmin({
    titulo: 'Eliminar TODO el catálogo',
    mensaje: 'Se borrarán todos los productos del inventario. Esta acción no se puede deshacer.',
    resumen: `${productsList.length} producto(s) serán eliminados`,
    textoBoton: '🗑️ Sí, eliminar todo'
  });
  if (!pin) return;

  try {
    await API.productos.eliminarTodos(pin);
    showToast('Todos los productos fueron eliminados', 'ok');
    cargarProductos(true);
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

/* ------------------------------------------------------------
   IMPORTACIÓN MASIVA — flujo en tres pasos
     1. Se lee y valida el archivo (sin tocar la base todavía).
     2. Se pide el PIN de administrador con la misma lógica que usan las
        operaciones destructivas (pedirPinAdmin → el servidor lo verifica).
     3. Se elige el modo: omitir o actualizar los que ya existen.
   Recién ahí se envía. Así el usuario ve cuántas filas trae el archivo
   ANTES de autorizar nada.
   ------------------------------------------------------------ */
let importacionPendiente = null;   // { productos, pin, nombreArchivo }

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
      return;
    }

    // PASO 2: autorización. El PIN viaja al backend, que lo vuelve a validar.
    const conMedidas = productosNuevos.filter(p => p.peso_kg || p.alto_cm || p.ancho_cm || p.profundidad_cm).length;
    const pin = await pedirPinAdmin({
      titulo: 'Importar catálogo',
      mensaje: `El archivo "${file.name}" trae ${productosNuevos.length} producto(s) válido(s).`,
      resumen: `${conMedidas} con medidas de envío. En el siguiente paso eliges qué hacer con los que ya existen.`,
      textoBoton: '🔓 Autorizar importación'
    });
    if (!pin) return;   // el usuario canceló

    // PASO 3: modo de importación
    importacionPendiente = { productos: productosNuevos, pin, nombreArchivo: file.name };
    abrirModalModoImportacion(productosNuevos.length, conMedidas);
  } catch (err) {
    console.error('Error al leer el archivo:', err.message || err);
    showToast('Error al importar: ' + (err.message || 'formato no reconocido'), 'err');
  } finally {
    // Se libera el input siempre, para poder reintentar con el mismo archivo
    e.target.value = '';
  }
}

function abrirModalModoImportacion(total, conMedidas) {
  if (!elModalModoImportacion) {
    // Sin el modal en el DOM se cae al modo seguro por defecto
    procesarImportacion('omitir');
    return;
  }
  if (elModoImportacionResumen) {
    elModoImportacionResumen.textContent =
      `${total} producto(s) listos para importar desde "${importacionPendiente?.nombreArchivo || 'el archivo'}" · ${conMedidas} con medidas.`;
  }
  elModalModoImportacion.classList.add('show');
}

function cancelarModoImportacion() {
  importacionPendiente = null;
  if (elModalModoImportacion) elModalModoImportacion.classList.remove('show');
  showToast('Importación cancelada', '');
}

async function procesarImportacion(modo) {
  if (!importacionPendiente) return;

  const { productos, pin } = importacionPendiente;
  if (elModalModoImportacion) elModalModoImportacion.classList.remove('show');

  [elBtnImportOmitir, elBtnImportActualizar].forEach(b => { if (b) b.disabled = true; });

  const acumulado = { creados: 0, actualizados: 0, omitidos: 0, errores: [] };

  try {
    /* Se envía en bloques de 200: el backend acepta hasta 6 MB por petición
       y un catálogo grande de Tiendanube supera ese límite de una sola vez. */
    for (let i = 0; i < productos.length; i += 200) {
      const bloque = productos.slice(i, i + 200);
      const r = await API.productos.importar(bloque, modo, pin);

      acumulado.creados += r?.creados || 0;
      acumulado.actualizados += r?.actualizados || 0;
      acumulado.omitidos += r?.omitidos || 0;
      if (Array.isArray(r?.errores)) acumulado.errores.push(...r.errores);
    }

    const partes = [];
    if (acumulado.creados) partes.push(`${acumulado.creados} creado(s)`);
    if (acumulado.actualizados) partes.push(`${acumulado.actualizados} actualizado(s)`);
    if (acumulado.omitidos) partes.push(`${acumulado.omitidos} omitido(s) por ya existir`);

    showToast(partes.length ? `Importación lista: ${partes.join(' · ')}` : 'No hubo cambios', 'ok');

    if (acumulado.errores.length) {
      console.warn('Filas con problemas durante la importación:', acumulado.errores);
      showToast(`${acumulado.errores.length} fila(s) con error — revisa la consola`, 'err');
    }

    cargarProductos(true);
  } catch (err) {
    console.error('Error al importar productos:', err.message || err);
    showToast('Error al importar: ' + (err.message || 'fallo del servidor'), 'err');
  } finally {
    importacionPendiente = null;
    [elBtnImportOmitir, elBtnImportActualizar].forEach(b => { if (b) b.disabled = false; });
  }
}

// ============================================================
// EXPORTACIÓN INDIVIDUAL (un producto, desde su propio modal)
// ============================================================
function abrirModalFormatoExport() {
  if (!editingProductId) { showToast('Guarda el producto antes de exportarlo', 'err'); return; }

  const producto = productsList.find(p => String(p.id) === String(editingProductId));
  if (elFormatoExportNombre) {
    elFormatoExportNombre.textContent = producto
      ? `${producto.nombre}${producto.sku ? ' · SKU ' + producto.sku : ''}`
      : 'Producto';
  }
  if (elModalFormatoExport) elModalFormatoExport.classList.add('show');
}

function cerrarModalFormatoExport() {
  if (elModalFormatoExport) elModalFormatoExport.classList.remove('show');
}

/* Nombre de archivo seguro: sin tildes, espacios ni caracteres que a
   Windows le molesten al guardar. */
function nombreArchivoSeguro(texto) {
  return String(texto || 'producto')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase()
    .slice(0, 50) || 'producto';
}

/* BUG 34 — SEGUNDA COLISIÓN DE NOMBRES GLOBALES.
   Esta función se llamaba `descargarArchivo` igual que la de config.js,
   pero con los parámetros AL REVÉS:
       config.js    → descargarArchivo(nombre, contenido, tipo)
       productos.js → descargarArchivo(contenido, nombre, tipoMime)
   productos.js se carga después, así que su versión pisaba a la otra y
   los respaldos JSON de compras, ventas y productos se bajaban con el
   nombre y el contenido intercambiados (un archivo llamado con todo el
   JSON dentro del nombre). Renombrada para que no se pisen. */
function descargarArchivoMime(contenido, nombre, tipoMime) {
  const blob = new Blob([contenido], { type: tipoMime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = nombre;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  // Se libera con retardo: si se revoca al instante, Safari cancela la descarga
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}

async function exportarProductoIndividual(formato) {
  const producto = productsList.find(p => String(p.id) === String(editingProductId));
  if (!producto) { showToast('No se encontró el producto', 'err'); return; }

  const base = nombreArchivoSeguro(producto.sku || producto.nombre);

  try {
    if (formato === 'json') {
      /* JSON: se exporta el producto completo tal cual, más sus capas de
         costo si tiene los lotes activos. Sirve de respaldo fiel y se puede
         volver a cargar sin perder nada. */
      const salida = { ...producto, exportado_en: new Date().toISOString() };

      if (producto.usa_lotes) {
        try {
          salida.lotes = await API.productos.listarLotes(producto.id);
        } catch (_) {
          salida.lotes = [];   // sin capas legibles, se exporta igual el producto
        }
      }

      descargarArchivoMime(JSON.stringify(salida, null, 2), `${base}.json`, 'application/json;charset=utf-8;');
    } else {
      /* CSV: una sola fila con los mismos encabezados de la exportación
         masiva, para que se pueda reimportar sin tocar nada. */
      const hoja = XLSX.utils.json_to_sheet([filaProductoParaExportar(producto)]);
      const csv = XLSX.utils.sheet_to_csv(hoja, { FS: ';' });

      // BOM al inicio: sin esto Excel en Windows rompe las tildes
      descargarArchivoMime('\uFEFF' + csv, `${base}.csv`, 'text/csv;charset=utf-8;');
    }

    showToast(`Producto exportado en ${formato.toUpperCase()}`, 'ok');
    cerrarModalFormatoExport();
  } catch (err) {
    console.error('Error al exportar el producto:', err.message || err);
    showToast(err.message || 'No se pudo exportar el producto', 'err');
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
