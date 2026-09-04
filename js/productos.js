// ==========================================
// PRODUCTOS.JS - Gestión de Inventario (Sevelin)
// ------------------------------------------
// Toda la escritura pasa por el backend, que además exige rol admin.
// Campos compatibles con Tiendanube: peso_kg, alto_cm, ancho_cm,
// profundidad_cm y descripcion.
// ==========================================

let productsList = [];
let editingProductId = null;
// Estado real del producto que se está editando — el botón Archivar/
// Desarchivar del editor (ver abrirModalProducto) lo lee para saber qué
// mostrar, porque un producto archivado ya no vive en productsList.
let productoEnEdicionArchivado = false;
let productosSeleccionados = new Set();
let productosVisibles = [];   // última lista renderizada (para "seleccionar todo")

// Productos archivados: NO viven en productsList (que alimenta venta, OT,
// mermas, lotes, reportes — un archivado no debe aparecer ahí). Se piden
// aparte solo cuando se elige "Ver: Archivados", y se cachean para no
// volver a pedirlos en cada tecla del buscador. Se invalida (= null) cada
// vez que se archiva/desarchiva algo.
let productosArchivadosCache = null;
let productosBorradoresCache = null;

/* Íconos SVG: heredan el color del botón, así el lápiz nunca se pierde
   contra el fondo (antes era un emoji sobre un degradado dorado). */
const ICO_EDITAR_PROD = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>`;
const ICO_ETIQUETA_PROD = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20.6 13.4 12 22l-9-9V3h10l7.6 7.6a2 2 0 0 1 0 2.8Z"/><circle cx="7.5" cy="7.5" r="1.2"/></svg>`;
const ICO_ELIMINAR_PROD = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M8 6V4h8v2"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/></svg>`;
const ICO_ARCHIVAR_PROD = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="5" rx="1"/><path d="M5 9v9a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V9"/><path d="M10 13h4"/></svg>`;
const ICO_DESARCHIVAR_PROD = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="5" rx="1"/><path d="M5 9v9a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V9"/><path d="M12 17v-4M10 15l2-2 2 2"/></svg>`;

/* Etiqueta destacada (NOVEDAD/TENDENCIA/OFERTA) — se muestra igual en la
   tabla del POS y en la tienda web (ver tarjeta-producto.tsx). */
function etiquetaWebTexto(valor) {
  if (valor === 'NOVEDAD') return '🆕 Novedad';
  if (valor === 'TENDENCIA') return '🔥 Tendencia';
  if (valor === 'OFERTA') return '⚡ Oferta irresistible';
  return '';
}

const elProductosTableBody = document.getElementById('productosTableBody');
const elBuscarProductoTabla = document.getElementById('buscarProductoTabla');
const elViewProductoEditor = document.getElementById('view-producto-editor');
const elViewProductos = document.getElementById('view-productos');
const elBtnVolverProductos = document.getElementById('btnVolverProductos');
const elProductoFormTitle = document.getElementById('productoFormTitle');
const elProdEditId = document.getElementById('prodEditId');
const elProdSku = document.getElementById('prodSku');
const elProdBarcode = document.getElementById('prodBarcode');
const elProdNombre = document.getElementById('prodNombre');
const elProdCosto = document.getElementById('prodCosto');
const elProdPrecio = document.getElementById('prodPrecio');
// Al enfocar, selecciona el contenido completo — así pegar o escribir un
// monto nuevo lo REEMPLAZA en vez de insertarse junto al "0" que deja el
// campo vacío (ver abrirModalProducto): sin esto, pegar "39990" con el
// cursor al final del "0" da "039990". Mismo patrón que ya usa el resto
// del POS para montos (elPagoMontoRecibido, elItemCantidad, etc.).
elProdCosto?.addEventListener('focus', () => elProdCosto.select());
elProdPrecio?.addEventListener('focus', () => elProdPrecio.select());
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
const elProdFotoInput = document.getElementById('prodFotoInput');
const elProdFotoCanvas = document.getElementById('prodFotoCanvas');
const elProdFotoEstado = document.getElementById('prodFotoEstado');
const elProdFotosGrid = document.getElementById('prodFotosGrid');
const elDropzoneFotos = document.getElementById('dropzoneFotos');
const elAvisoPublicacionIncompleta = document.getElementById('avisoPublicacionIncompleta');
const elProdPublicadoWeb = document.getElementById('prodPublicadoWeb');
const elProdEsEncargo = document.getElementById('prodEsEncargo');
const elProdCondicion = document.getElementById('prodCondicion');
const elProdMesesGarantia = document.getElementById('prodMesesGarantia');
const elProdPrecioWeb = document.getElementById('prodPrecioWeb');
const elProdCategoriaWeb = document.getElementById('prodCategoriaWeb');
const elProdStockUmbralWeb = document.getElementById('prodStockUmbralWeb');
const elProdEtiquetaWeb = document.getElementById('prodEtiquetaWeb');
const elProdMetaTitulo = document.getElementById('prodMetaTitulo');
const elProdMetaTituloContador = document.getElementById('prodMetaTituloContador');
const elProdMetaDescripcion = document.getElementById('prodMetaDescripcion');
const elProdMetaDescripcionContador = document.getElementById('prodMetaDescripcionContador');
const elBtnGenerarSeoIA = document.getElementById('btnGenerarSeoIA');
const elProdSeoIAAviso = document.getElementById('prodSeoIAAviso');
let productoEnEdicionImagenUrls = [];
// Fotos elegidas ANTES de que el producto tenga id (modo creación): quedan
// acá como data URLs hasta que guardarProducto() cree el producto y recién
// ahí se suban en este mismo orden — ver manejarSeleccionFotoProducto().
let fotosNuevasStaged = [];
// Cache de producto_categorias (misma tabla que "Página Web → Categorías",
// js/pagina-web.js) para la tarjeta "Categoría" del editor — se refresca al
// abrir el editor o al crear una categoría/subcategoría desde ahí. Los ids
// "pop*" son legado de cuando esto vivía en un pop-up aparte (sesión
// anterior) — la tarjeta ahora es parte fija de #view-producto-editor.
let categoriasWebCache = [];
const elPopFotosCategoria = document.getElementById('popFotosCategoria');
const elPopFotosSubcategoria = document.getElementById('popFotosSubcategoria');
const elPopNuevaCategoriaInput = document.getElementById('popNuevaCategoriaInput');
const elBtnPopNuevaCategoria = document.getElementById('btnPopNuevaCategoria');
const elPopNuevaSubcategoriaInput = document.getElementById('popNuevaSubcategoriaInput');
const elBtnPopNuevaSubcategoria = document.getElementById('btnPopNuevaSubcategoria');
const elBtnNuevoProducto = document.getElementById('btnNuevoProducto');
const elBtnCancelarProducto = document.getElementById('btnCancelarProducto');
const elBtnGuardarProducto = document.getElementById('btnGuardarProducto');
const elBtnExportarProducto = document.getElementById('btnExportarProducto');
const elBtnArchivarProducto = document.getElementById('btnArchivarProducto');
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
  initEditorDescripcion();

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
  if (elBtnArchivarProducto) elBtnArchivarProducto.addEventListener('click', alternarArchivadoDesdeEditor);
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
  if (elBtnVolverProductos) elBtnVolverProductos.addEventListener('click', cerrarModalProducto);
  if (elBtnGuardarProducto) elBtnGuardarProducto.addEventListener('click', guardarProducto);
  document.getElementById('btnDescargarTodasFotos')?.addEventListener('click', descargarTodasFotosProducto);
  if (elBtnGenerarSeoIA) elBtnGenerarSeoIA.addEventListener('click', generarSeoConIA);
  if (elProdMetaTitulo) elProdMetaTitulo.addEventListener('input', actualizarContadoresSeo);
  if (elProdMetaDescripcion) elProdMetaDescripcion.addEventListener('input', actualizarContadoresSeo);
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

  if (elProdFotoInput) elProdFotoInput.addEventListener('change', manejarSeleccionFotoProducto);
  configurarDropzoneFotos();

  // Aviso "no va a aparecer en la tienda" (Tienda web) — se recalcula en
  // vivo con cualquier campo que lo pueda cambiar.
  [elProdPublicadoWeb, elProdSku, elProdStock, elProdStockIlimitado].forEach(el => {
    if (el) el.addEventListener('input', evaluarAvisoPublicacion);
    if (el) el.addEventListener('change', evaluarAvisoPublicacion);
  });

  // Categoría/subcategoría: ahora son parte fija de la tarjeta "Categoría"
  // (antes había que confirmar con un botón "Aceptar" en el pop-up) — al
  // elegir, se escribe directo en #prodCategoriaWeb (estado real que lee
  // guardarProducto()).
  if (elPopFotosCategoria) {
    elPopFotosCategoria.addEventListener('change', () => {
      poblarSubcategoriasEditor(elPopFotosCategoria.value, '');
      aplicarSeleccionCategoria();
    });
  }
  if (elPopFotosSubcategoria) {
    elPopFotosSubcategoria.addEventListener('change', aplicarSeleccionCategoria);
  }
  if (elBtnPopNuevaCategoria) elBtnPopNuevaCategoria.addEventListener('click', crearCategoriaEditor);
  if (elBtnPopNuevaSubcategoria) elBtnPopNuevaSubcategoria.addEventListener('click', crearSubcategoriaEditor);
  if (elPopNuevaCategoriaInput) {
    elPopNuevaCategoriaInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); crearCategoriaEditor(); } });
  }
  if (elPopNuevaSubcategoriaInput) {
    elPopNuevaSubcategoriaInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); crearSubcategoriaEditor(); } });
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
    <div class="alerta-stock-item" data-abrir="${p.id}" title="Editar ${escHtml(p.nombre)}">
      <span>${escHtml(p.nombre)}${p.sku ? ` <small style="color:var(--text-muted);">· ${escHtml(p.sku)}</small>` : ''}</span>
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

function renderProductosTabla(items, origen) {
  if (!elProductosTableBody) return;
  productosVisibles = items || [];
  // 'activos' (por defecto) busca en productsList al editar/etiquetar;
  // 'archivados'/'borradores' buscan en su propia caché, fuera de productsList.
  const fuente = origen === 'archivados' ? productosArchivadosCache
    : origen === 'borradores' ? productosBorradoresCache
    : productsList;

  if (!items || items.length === 0) {
    const mensaje = origen === 'archivados'
      ? 'No hay productos archivados.'
      : origen === 'borradores'
        ? 'No hay borradores pendientes.'
        : 'No hay productos en el inventario. Crea uno o importa tu CSV de Tiendanube.';
    elProductosTableBody.innerHTML = `<tr class="empty-row"><td colspan="12">${mensaje}</td></tr>`;
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
      <td>${miniaturaProducto(p, 56)}</td>
      <td>
        <!-- El nombre abre el editor directo: es lo que uno intenta
             tocar por instinto antes de buscar el lápiz de la derecha.
             El title lleva el nombre completo, porque en la celda se
             corta a 40 caracteres. -->
        <a href="#" class="nombre-editable" data-editar="${p.id}"
           title="${escHtml(p.nombre)}">${escHtml(acortar(p.nombre, 40))}</a>
        <small class="fila-meta">
          ${p.sku ? `SKU ${escHtml(acortar(p.sku, 22))}` : ''}
          ${p.requiere_sn ? ' · <b>S/N</b>' : ''}
          ${p.es_repuesto ? ' · Repuesto' : ''}
          ${etiquetaWebTexto(p.etiqueta_web) ? ` · ${etiquetaWebTexto(p.etiqueta_web)}` : ''}
        </small>
      </td>
      <td class="admin-only">${fmtCLP(p.costo_unitario)}</td>
      <td>${fmtCLP(p.precio_unitario)}</td>
      <td>${badgeStock(p)}</td>
      <td>
        <div class="cell-actions">
          <button class="btn btn-icon btn-icon-view" data-etiqueta="${p.id}" title="Imprimir etiqueta de código de barras">${ICO_ETIQUETA_PROD}</button>
          <button class="btn btn-icon btn-icon-edit" data-editar="${p.id}" title="Editar producto">${ICO_EDITAR_PROD}</button>
          ${origen === 'archivados'
            ? `<button class="btn btn-icon btn-icon-edit" data-desarchivar="${p.id}" title="Desarchivar producto">${ICO_DESARCHIVAR_PROD}</button>`
            : `<button class="btn btn-icon btn-icon-edit" data-archivar="${p.id}" title="Archivar producto (retirarlo sin borrar su historial)">${ICO_ARCHIVAR_PROD}</button>`}
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
      const producto = (fuente || []).find(p => String(p.id) === btn.dataset.editar);
      if (producto) abrirModalProducto(producto);
    });
  });

  elProductosTableBody.querySelectorAll('button[data-etiqueta]').forEach(btn => {
    btn.addEventListener('click', () => {
      const producto = (fuente || []).find(p => String(p.id) === btn.dataset.etiqueta);
      if (producto && typeof abrirModalEtiqueta === 'function') abrirModalEtiqueta(producto);
    });
  });

  elProductosTableBody.querySelectorAll('button[data-eliminar]').forEach(btn => {
    btn.addEventListener('click', () => eliminarProducto(btn.dataset.eliminar));
  });

  elProductosTableBody.querySelectorAll('button[data-archivar]').forEach(btn => {
    btn.addEventListener('click', () => archivarProducto(btn.dataset.archivar, fuente));
  });

  elProductosTableBody.querySelectorAll('button[data-desarchivar]').forEach(btn => {
    btn.addEventListener('click', () => desarchivarProducto(btn.dataset.desarchivar, fuente));
  });
}

// ---------- Filtro de búsqueda + orden/filtro especial ----------
function handleBuscarProductoTabla() {
  const q = (elBuscarProductoTabla?.value || '').trim().toLowerCase();
  const modo = elOrdenProductos ? elOrdenProductos.value : '';

  // "Ver: Archivados" / "Ver: Borradores" no filtran productsList (ninguno
  // de los dos está ahí) — piden su propia lista aparte.
  if (modo === 'archivados') { renderProductosArchivados(q); return; }
  if (modo === 'borradores') { renderProductosBorradores(q); return; }

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
    case 'nombre_asc':
      resultado = resultado.slice().sort((a, b) => (a.nombre || '').localeCompare(b.nombre || ''));
      break;
    default:
      // "Más recientes primero": el más útil al abrir Productos sin elegir
      // nada — lo último que se cargó es lo que más probablemente se
      // quiere revisar (pedido explícito del dueño). created_at siempre
      // existe (columna real de la tabla); si por lo que sea faltara, cae
      // a 0 y esos productos quedan al final en vez de romper el orden.
      resultado = resultado.slice().sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0));
  }

  renderProductosTabla(resultado);
}

/* Trae (y cachea) los productos archivados, filtra por el buscador y los
   pinta con las acciones propias de esa vista (Desarchivar en vez de
   Archivar, ver renderProductosTabla). */
async function renderProductosArchivados(q) {
  try {
    if (!productosArchivadosCache) productosArchivadosCache = await API.productos.listarArchivados();
    const resultado = productosArchivadosCache
      .filter(p =>
        (p.nombre || '').toLowerCase().includes(q) ||
        (p.sku || '').toLowerCase().includes(q) ||
        (p.codigo_barras || '').toLowerCase().includes(q)
      )
      .slice()
      .sort((a, b) => (a.nombre || '').localeCompare(b.nombre || ''));
    renderProductosTabla(resultado, 'archivados');
  } catch (err) {
    console.error('Error al cargar productos archivados:', err.message || err);
    showToast(err.message || 'No se pudieron cargar los productos archivados', 'err');
  }
}

/* Mismo patrón que renderProductosArchivados — productos que se
   autocrearon como borrador al agregar su primera foto (ver
   crearBorradorProducto()) y todavía no pasaron por un "Guardar
   Producto" real. */
async function renderProductosBorradores(q) {
  try {
    if (!productosBorradoresCache) productosBorradoresCache = await API.productos.listarBorradores();
    const resultado = productosBorradoresCache
      .filter(p =>
        (p.nombre || '').toLowerCase().includes(q) ||
        (p.sku || '').toLowerCase().includes(q) ||
        (p.codigo_barras || '').toLowerCase().includes(q)
      )
      .slice()
      .sort((a, b) => (a.nombre || '').localeCompare(b.nombre || ''));
    renderProductosTabla(resultado, 'borradores');
  } catch (err) {
    console.error('Error al cargar los borradores:', err.message || err);
    showToast(err.message || 'No se pudieron cargar los borradores', 'err');
  }
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

// ---------- Editor de Descripción (Quill, texto enriquecido) ----------
// #prodDescripcion (textarea oculto, ver index.html) sigue siendo la
// fuente que lee guardarProducto() con su .value de siempre — Quill solo
// se mantiene sincronizado con él, así el resto del código no necesita
// saber que existe un editor rico detrás.
let editorDescripcion = null;

/* Pegado de Markdown en el editor de Descripción.
   ------------------------------------------------------------
   Las respuestas de Gemini/ChatGPT copiadas con su botón "Copiar
   respuesta" traen sintaxis Markdown como TEXTO PLANO (**negrita**,
   ### título, - listas, [texto](url)) — Quill no la interpreta, así que
   quedaba pegada tal cual: los símbolos a la vista, y un link como
   "[www.sevelin.cl](http://www.sevelin.cl)" se veía con el dominio DOS
   VECES (una como texto del link, otra dentro del paréntesis) porque
   nunca se armaba el <a> real.

   convertirMarkdownAHtml() la convierte a HTML real antes de insertarla —
   solo lo que el editor y el sanitizador de la tienda soportan (negrita,
   cursiva, listas, links, título de sección: ver la whitelist en
   sevelin-tienda/src/lib/sanitizar-html.ts). Cualquier otra sintaxis de
   Markdown (tablas, imágenes, código) se deja como texto plano a
   propósito: mejor mostrarla tal cual que inventar un tag que el
   sanitizador de la tienda va a borrar de todos modos. */

// ¿El texto pegado TIENE pinta de traer sintaxis Markdown? Si no matchea
// nada de esto, se deja el pegado normal de Quill sin tocarlo.
function pareceMarkdown(texto) {
  return /\*\*[^*]+\*\*/.test(texto) ||
    /^ {0,3}#{1,6}\s+\S/m.test(texto) ||
    /\[[^\]]+\]\(https?:\/\/[^)\s]+\)/.test(texto) ||
    /^ {0,3}[-*]\s+\S/m.test(texto);
}

// Reemplazos DENTRO de una línea, sobre texto YA escapado (escHtml) —
// solo arma las etiquetas, nunca lee HTML crudo del portapapeles.
function markdownInlineAHtml(textoEscapado) {
  return textoEscapado
    // Links primero: un "*" adentro del texto de un link no debe
    // interpretarse como negrita/cursiva antes de que el link se arme.
    .replace(/\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/\*([^*]+)\*/g, '<em>$1</em>');
}

function convertirMarkdownAHtml(textoPlano) {
  const lineas = textoPlano.replace(/\r\n/g, '\n').split('\n');
  const bloques = [];
  let itemsLista = null;

  const cerrarLista = () => {
    if (itemsLista) {
      bloques.push(`<ul>${itemsLista.map(li => `<li>${li}</li>`).join('')}</ul>`);
      itemsLista = null;
    }
  };

  for (const lineaCruda of lineas) {
    const linea = lineaCruda.trim();
    if (!linea) { cerrarLista(); continue; }

    const encabezado = linea.match(/^ {0,3}#{1,6}\s+(.*)$/);
    if (encabezado) {
      cerrarLista();
      bloques.push(`<h3>${markdownInlineAHtml(escHtml(encabezado[1]))}</h3>`);
      continue;
    }

    // Viñetas Markdown ("- "/"* ") y las listas de características que
    // arma Gemini con ✅ / ☑️ / ✔️ como marcador — el resto de líneas con
    // un emoji suelto adelante (🇨🇱, 📲, 💳...) se dejan como párrafo
    // normal, no como viñeta, porque no vienen en una lista de verdad.
    const viñeta = linea.match(/^ {0,3}(?:[-*]|✅|☑️|✔️)\s+(.*)$/);
    if (viñeta) {
      if (!itemsLista) itemsLista = [];
      itemsLista.push(markdownInlineAHtml(escHtml(viñeta[1])));
      continue;
    }

    cerrarLista();
    bloques.push(`<p>${markdownInlineAHtml(escHtml(linea))}</p>`);
  }
  cerrarLista();

  return bloques.join('');
}

function initEditorDescripcion() {
  if (editorDescripcion || typeof Quill === 'undefined') return;
  const contenedor = document.getElementById('prodDescripcionEditor');
  if (!contenedor) return;
  editorDescripcion = new Quill(contenedor, {
    theme: 'snow',
    placeholder: 'Detalle largo del producto (opcional) — se usa en la tienda web',
    modules: { toolbar: [['bold', 'italic'], [{ list: 'ordered' }, { list: 'bullet' }], ['link'], ['clean']] }
  });
  editorDescripcion.on('text-change', () => {
    if (!elProdDescripcion) return;
    // Un editor "visualmente vacío" igual guarda '<p><br></p>' — sin este
    // chequeo, cada producto nuevo terminaría con una descripción "vacía"
    // que en realidad no lo está.
    elProdDescripcion.value = editorDescripcion.getText().trim() ? editorDescripcion.root.innerHTML : '';
    actualizarDisponibilidadSeoIA();
  });

  // Toggle "Convertir Markdown al pegar" — recordado en localStorage entre
  // sesiones. Apagado, el pegado vuelve a ser el normal de Quill.
  const elToggleMarkdown = document.getElementById('prodDescripcionMarkdownToggle');
  if (elToggleMarkdown) {
    const guardado = localStorage.getItem('prodDescripcionMarkdownToggle');
    if (guardado !== null) elToggleMarkdown.checked = guardado === '1';
    elToggleMarkdown.addEventListener('change', () => {
      localStorage.setItem('prodDescripcionMarkdownToggle', elToggleMarkdown.checked ? '1' : '0');
    });
  }

  /* BUG REAL (encontrado probando en producción, no en jsdom): Quill tiene
     su PROPIO listener de 'paste' en editorDescripcion.root (lo agrega él
     solo al construirse) que procesa y pega el texto crudo — como el
     nuestro se agregaba DESPUÉS sobre el mismo elemento, Quill alcanzaba a
     insertar el Markdown sin convertir antes de que este código llegara a
     hacer nada (preventDefault() acá no lo frena: el pegado de Quill es
     manejado por su propio JS, no por el "pegar" nativo del navegador).

     Se engancha en la FASE DE CAPTURA (el `true` final) sobre `contenedor`
     (el div que envuelve a Quill, un ancestro de editorDescripcion.root) en
     vez de sobre el editor mismo — así el evento pasa por acá ANTES de
     llegar al listener de Quill, y stopPropagation() evita que el de Quill
     se ejecute siquiera cuando este código decide manejar el pegado él
     mismo. */
  contenedor.addEventListener('paste', e => {
    if (!elToggleMarkdown || !elToggleMarkdown.checked) return; // pegado normal de Quill
    const texto = (e.clipboardData || window.clipboardData)?.getData('text/plain') || '';
    if (!texto.trim() || !pareceMarkdown(texto)) return; // no tiene pinta de Markdown, pegado normal

    e.preventDefault();
    e.stopPropagation();
    const html = convertirMarkdownAHtml(texto);
    const rango = editorDescripcion.getSelection(true);
    editorDescripcion.clipboard.dangerouslyPasteHTML(rango.index, html, 'user');
  }, true);
}

// Único punto de escritura del editor — abrirModalProducto() (cargar un
// producto existente o limpiar el formulario) pasa siempre por acá en vez
// de tocar el textarea oculto directo, para que Quill y el textarea nunca
// queden desincronizados.
/* ---------- SEO con IA (título/meta-descripción para Google) ----------
   La IA solo reescribe la Descripción que ya existe — nunca agrega specs
   nuevas (ver CLAUDE.md, "no inventar specs"); el servidor rechaza la
   llamada si no hay descripción real todavía. El resultado se deja en los
   dos campos para que el admin lo revise/edite — recién se guarda de
   verdad cuando aprieta "Guardar producto", como cualquier otro campo. */
function actualizarContadoresSeo() {
  if (elProdMetaTituloContador) elProdMetaTituloContador.textContent = (elProdMetaTitulo?.value || '').length;
  if (elProdMetaDescripcionContador) elProdMetaDescripcionContador.textContent = (elProdMetaDescripcion?.value || '').length;
}

function actualizarDisponibilidadSeoIA() {
  const hayDescripcion = !!(elProdDescripcion?.value || '').trim();
  if (elBtnGenerarSeoIA) elBtnGenerarSeoIA.disabled = !hayDescripcion;
  if (elProdSeoIAAviso) {
    elProdSeoIAAviso.textContent = hayDescripcion
      ? 'Reescribe el nombre y la Descripción de arriba — revisa el resultado antes de guardar.'
      : 'Escribe la Descripción primero — la IA reescribe lo que ya está ahí, nunca inventa características nuevas.';
  }
}

async function generarSeoConIA() {
  const descripcionHtml = elProdDescripcion?.value || '';
  const nombre = elProdNombre?.value.trim() || '';
  if (!descripcionHtml.trim()) { showToast('Escribe la Descripción primero', 'err'); return; }
  if (!nombre) { showToast('Escribe el nombre del producto primero', 'err'); return; }

  if (elBtnGenerarSeoIA) { elBtnGenerarSeoIA.disabled = true; elBtnGenerarSeoIA.textContent = '✨ Generando…'; }
  try {
    const resultado = await API.productos.generarSeo({ nombre, descripcion_html: descripcionHtml });
    if (elProdMetaTitulo) elProdMetaTitulo.value = resultado.meta_titulo || '';
    if (elProdMetaDescripcion) elProdMetaDescripcion.value = resultado.meta_descripcion || '';
    actualizarContadoresSeo();
    showToast('SEO generado — revísalo y guarda el producto', 'ok');
  } catch (err) {
    showToast(err.message || 'No se pudo generar el SEO', 'err');
  } finally {
    if (elBtnGenerarSeoIA) { elBtnGenerarSeoIA.disabled = false; elBtnGenerarSeoIA.textContent = '✨ Generar con IA'; }
  }
}

function establecerDescripcion(html) {
  initEditorDescripcion();
  if (editorDescripcion) editorDescripcion.root.innerHTML = html || '<p><br></p>';
  if (elProdDescripcion) elProdDescripcion.value = html || '';
  actualizarDisponibilidadSeoIA();
}

function abrirModalProducto(producto = null) {
  if (!elViewProductoEditor) return;
  if (!esAdmin()) { showToast('Solo el administrador puede editar productos', 'err'); return; }

  if (producto) {
    editingProductId = producto.id;
    if (elProductoFormTitle) elProductoFormTitle.textContent = 'Editar Producto';
    if (elProdEditId) elProdEditId.value = producto.id;
    if (elProdSku) elProdSku.value = producto.sku || '';
    if (elProdBarcode) elProdBarcode.value = producto.codigo_barras || '';
    if (elProdNombre) elProdNombre.value = producto.nombre || '';
    if (elProdCosto) elProdCosto.value = producto.costo_unitario || '';
    if (elProdPrecio) elProdPrecio.value = producto.precio_unitario || '';
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
    // Una sola descripción: si el producto viene de antes de este cambio y
    // solo tenía escrita la "web", se usa esa como punto de partida.
    establecerDescripcion(producto.descripcion || producto.descripcion_web || '');
    if (elProdPublicadoWeb) elProdPublicadoWeb.checked = !!producto.publicado_web;
    if (elProdEsEncargo) elProdEsEncargo.checked = !!producto.es_pedido_encargo;
    if (elProdCondicion) elProdCondicion.value = producto.condicion || 'nuevo';
    if (elProdMesesGarantia) elProdMesesGarantia.value = producto.meses_garantia ?? 6;
    if (elProdPrecioWeb) elProdPrecioWeb.value = producto.precio_web ?? '';
    if (elProdStockUmbralWeb) elProdStockUmbralWeb.value = producto.stock_umbral_web ?? '';
    if (elProdEtiquetaWeb) elProdEtiquetaWeb.value = producto.etiqueta_web || '';
    if (elProdMetaTitulo) elProdMetaTitulo.value = producto.meta_titulo_web || '';
    if (elProdMetaDescripcion) elProdMetaDescripcion.value = producto.meta_descripcion_web || '';
    actualizarContadoresSeo();
    // Si el producto tiene subcategoría, hay que reseleccionar ESA opción
    // en el <select> (no la categoría padre) — si no, cada vez que se
    // reabre el editor de un producto subcategorizado, se pierde la
    // subcategoría al guardar de nuevo sin tocar el campo.
    poblarSelectCategoriaWeb(producto.subcategoria_web || producto.categoria_web || '').then(cargarCategoriasEditor);
    productoEnEdicionImagenUrls = Array.isArray(producto.imagen_urls) ? [...producto.imagen_urls] : [];
    fotosNuevasStaged = [];
    productoEnEdicionArchivado = !!producto.archivado;
  } else {
    editingProductId = null;
    if (elProductoFormTitle) elProductoFormTitle.textContent = 'Nuevo Producto';
    if (elProdEditId) elProdEditId.value = '';
    [elProdSku, elProdBarcode, elProdNombre].forEach(el => { if (el) el.value = ''; });
    establecerDescripcion('');
    // Costo y precio quedan VACÍOS (con placeholder "0") — no "0" puesto de
    // verdad, para que pegar o escribir un monto lo reemplace en vez de
    // pegarse junto al "0" (ver el listener de foco más arriba). El resto
    // de los campos numéricos sigue igual, no era parte de lo reportado.
    [elProdCosto, elProdPrecio].forEach(el => { if (el) el.value = ''; });
    [elProdStock, elProdPeso, elProdAlto, elProdAncho, elProdProfundidad]
      .forEach(el => { if (el) el.value = 0; });
    if (elProdRequiereSN) elProdRequiereSN.checked = false;
    if (elProdEsRepuesto) elProdEsRepuesto.checked = false;
    if (elProdStockMinimo) elProdStockMinimo.value = STOCK_MINIMO_POR_DEFECTO;
    if (elProdSinAlertaStock) elProdSinAlertaStock.checked = false;
    // Un producto NUEVO siempre nace sin lotes: solo se activan a mano
    if (elProdUsaLotes) elProdUsaLotes.checked = false;
    if (elProdStockIlimitado) elProdStockIlimitado.checked = false;
    if (elProdStockActualizado) elProdStockActualizado.textContent = 'Última actualización de stock: se registrará al guardar.';
    // Pedido explícito del dueño: un producto nuevo nace marcado para
    // publicarse en la web — antes había que acordarse de tildarlo a mano
    // cada vez. Sigue siendo reversible con un click antes de guardar.
    if (elProdPublicadoWeb) elProdPublicadoWeb.checked = true;
    if (elProdEsEncargo) elProdEsEncargo.checked = false;
    // Un producto nuevo siempre parte "Nuevo" y con 6 meses de garantía
    // (pedido explícito del dueño) — editable después si hace falta.
    if (elProdCondicion) elProdCondicion.value = 'nuevo';
    if (elProdMesesGarantia) elProdMesesGarantia.value = 6;
    if (elProdPrecioWeb) elProdPrecioWeb.value = '';
    if (elProdStockUmbralWeb) elProdStockUmbralWeb.value = '';
    if (elProdEtiquetaWeb) elProdEtiquetaWeb.value = '';
    if (elProdMetaTitulo) elProdMetaTitulo.value = '';
    if (elProdMetaDescripcion) elProdMetaDescripcion.value = '';
    actualizarContadoresSeo();
    poblarSelectCategoriaWeb('').then(cargarCategoriasEditor);
    productoEnEdicionImagenUrls = [];
    fotosNuevasStaged = [];
    productoEnEdicionArchivado = false;
  }

  aplicarStockIlimitadoProductoUI();
  if (typeof alternarLotesUI === 'function') alternarLotesUI();

  // Solo se exporta lo que ya existe en la base
  if (elBtnExportarProducto) elBtnExportarProducto.style.display = producto ? '' : 'none';
  // Mismo criterio: archivar solo tiene sentido sobre un producto que ya
  // existe. El texto cambia según su estado real (ver sql/32-archivar-productos.sql).
  if (elBtnArchivarProducto) {
    elBtnArchivarProducto.style.display = producto ? '' : 'none';
    elBtnArchivarProducto.textContent = productoEnEdicionArchivado ? '📤 Desarchivar' : '📦 Archivar';
    elBtnArchivarProducto.title = productoEnEdicionArchivado
      ? 'Vuelve a aparecer en el POS, la venta y la tienda web'
      : 'Lo retira del POS, la venta y la tienda web sin borrar su historial de ventas';
  }

  if (elProdFotoEstado) elProdFotoEstado.textContent = '';
  if (elProdFotoInput) elProdFotoInput.value = '';
  evaluarAvisoPublicacion();
  renderFotosProducto();

  elViewProductos?.classList.remove('active');
  elViewProductoEditor.classList.add('active');
  window.scrollTo({ top: 0, behavior: 'instant' });
  setTimeout(() => elProdNombre?.focus(), 80);
}

// Puebla el <select> de categoría web desde producto_categorias (módulo
// "Página Web → Categorías") y deja seleccionado el nombre que ya traía
// el producto — si esa categoría fue borrada mientras tanto, simplemente
// no queda ninguna opción marcada (el modal no inventa una categoría).
async function poblarSelectCategoriaWeb(nombreSeleccionado) {
  if (!elProdCategoriaWeb) return;
  try {
    const categorias = await API.productosCategorias.listar();
    categoriasWebCache = categorias;
    // Árbol de 2 niveles: cada categoría de nivel superior seguida de sus
    // subcategorías indentadas — mismo orden que ya trae la API.
    const raiz = categorias.filter(c => !c.parent_id);
    const opcion = (c, indentado) =>
      `<option value="${escHtml(c.nombre)}" data-id="${c.id}">${indentado ? '— ' : ''}${escHtml(c.nombre)}</option>`;
    const html = raiz.map(c => {
      const hijos = categorias.filter(h => String(h.parent_id) === String(c.id));
      return opcion(c, false) + hijos.map(h => opcion(h, true)).join('');
    }).join('');
    elProdCategoriaWeb.innerHTML = '<option value="">Sin categoría</option>' + html;
    elProdCategoriaWeb.value = nombreSeleccionado || '';
  } catch (err) {
    console.error('Error al cargar categorías web:', err.message || err);
  }
}

function cerrarModalProducto() {
  elViewProductoEditor?.classList.remove('active');
  elViewProductos?.classList.add('active');
  editingProductId = null;
  productoEnEdicionImagenUrls = [];
  fotosNuevasStaged = [];
}

// ---------- Guardar (crear / actualizar) ----------
/* Publicar con stock 0 falla en silencio: el catálogo público de
   sevelin-tienda filtra siempre stock_web > 0. Este aviso no bloquea el
   guardado, solo evita que el error pase desapercibido.
   NO avisa por falta de SKU: sevelin-tienda ya arma un slug de respaldo
   a partir del nombre + id cuando no hay SKU (ver slugDeRespaldo() en
   sevelin-tienda/src/app/api/sync/producto/route.ts) — útil sobre todo
   para productos que en realidad son servicios, que nunca llevan SKU ni
   código de barras. Avisar igual ahí era falso y solo entorpecía. */
function evaluarAvisoPublicacion() {
  if (!elAvisoPublicacionIncompleta) return;
  const publicado = !!(elProdPublicadoWeb && elProdPublicadoWeb.checked);
  const ilimitado = !!(elProdStockIlimitado && elProdStockIlimitado.checked);
  const sinStock = !ilimitado && (Number(elProdStock?.value) || 0) === 0;

  if (!publicado || !sinStock) {
    elAvisoPublicacionIncompleta.style.display = 'none';
    return;
  }

  elAvisoPublicacionIncompleta.textContent =
    '⚠️ Este producto está con stock en 0: no va a aparecer en sevelin.cl hasta que lo corrijas.';
  elAvisoPublicacionIncompleta.style.display = '';
}

// El <select> de categoría web puede tener elegida una categoría de nivel
// superior O una subcategoría (indentada con "— ", ver
// poblarSelectCategoriaWeb). productos_web.categoria en la tienda es un
// filtro PLANO de nivel superior nada más — si se guardara ahí el nombre
// de la subcategoría tal cual, ese producto desaparecería del filtro de
// categoría principal (mismo bug que tenía "Fuentes de poder" antes de
// esta sesión, ver docs/SNAPSHOT.md). Por eso categoria_web SIEMPRE sube
// hasta el ancestro de nivel superior, y subcategoria_web (columna nueva,
// sql/25) guarda el nombre específico elegido, o null si ya era de nivel
// superior.
function resolverCategoriaWebYSubcategoria() {
  const idElegido = elProdCategoriaWeb?.selectedOptions[0]?.dataset.id || null;
  const elegida = idElegido ? categoriasWebCache.find(c => String(c.id) === String(idElegido)) : null;
  if (!elegida) return { categoria_web: null, categoria_id: null, subcategoria_web: null };

  if (!elegida.parent_id) {
    return { categoria_web: elegida.nombre, categoria_id: elegida.id, subcategoria_web: null };
  }
  const padre = categoriasWebCache.find(c => String(c.id) === String(elegida.parent_id));
  return {
    categoria_web: padre ? padre.nombre : elegida.nombre,
    categoria_id: elegida.id,
    subcategoria_web: elegida.nombre
  };
}

/* Arma el payload con lo que haya escrito el formulario hasta ahora — lo
   usan tanto guardarProducto() (guardado normal) como
   crearBorradorProducto() (autoguardado al agregar la primera foto de un
   producto nuevo), para no mantener dos copias de esta lista que se
   puedan desincronizar. Devuelve null si falta el nombre. */
function construirPayloadProducto() {
  const nombre = (elProdNombre?.value || '').trim();
  if (!nombre) return null;

  const { categoria_web, categoria_id, subcategoria_web } = resolverCategoriaWebYSubcategoria();

  return {
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
    descripcion: elProdDescripcion?.value.trim() || null,
    // --- Tienda web (e-commerce Fase 0). imagen_urls NO va acá: se sube
    // aparte, foto por foto, con API.productos.subirImagen/quitarImagen. ---
    publicado_web: !!(elProdPublicadoWeb && elProdPublicadoWeb.checked),
    es_pedido_encargo: !!(elProdEsEncargo && elProdEsEncargo.checked),
    // --- Módulo Garantías (ver sql/31-garantias.sql) ---
    condicion: elProdCondicion?.value || 'nuevo',
    meses_garantia: elProdMesesGarantia?.value.trim() ? Number(elProdMesesGarantia.value) : 6,
    precio_web: elProdPrecioWeb?.value.trim() ? Number(elProdPrecioWeb.value) : null,
    categoria_web,
    categoria_id,
    subcategoria_web,
    stock_umbral_web: elProdStockUmbralWeb?.value.trim() ? Number(elProdStockUmbralWeb.value) : null,
    etiqueta_web: elProdEtiquetaWeb?.value || null,
    meta_titulo_web: elProdMetaTitulo?.value.trim() || null,
    meta_descripcion_web: elProdMetaDescripcion?.value.trim() || null,
    // Una sola descripción para todo (ya no hay campo aparte para la web):
    // se manda el mismo HTML también a descripcion_web, la columna que
    // lee sevelin-tienda al sincronizar (ver POST /api/sync/producto).
    descripcion_web: elProdDescripcion?.value.trim() || null,
    // Todo guardado real (este botón) apaga el borrador — solo
    // crearBorradorProducto() lo enciende, sobrescribiendo esto después.
    es_borrador: false
  };
}

async function guardarProducto() {
  const payload = construirPayloadProducto();
  if (!payload) { showToast('El nombre del producto es obligatorio', 'err'); return; }

  if (elBtnGuardarProducto) elBtnGuardarProducto.disabled = true;

  try {
    let mensaje;
    if (editingProductId) {
      await API.productos.actualizar(editingProductId, payload);
      mensaje = 'Producto actualizado';
    } else {
      const creado = await API.productos.crear(payload);
      mensaje = 'Producto creado';

      // Recién con el id real se pueden subir las fotos elegidas antes de
      // guardar (ver manejarSeleccionFotoProducto) — se suben en el mismo
      // orden en que quedaron en fotosNuevasStaged.
      if (fotosNuevasStaged.length && creado?.id) {
        const totalFotos = fotosNuevasStaged.length;
        let subidas = 0;
        for (const dataUrl of fotosNuevasStaged) {
          try {
            await API.productos.subirImagen(creado.id, dataUrl);
            subidas++;
          } catch (errFoto) {
            console.error('Error al subir foto del producto nuevo:', errFoto.message || errFoto);
          }
        }
        fotosNuevasStaged = [];
        if (subidas < totalFotos) {
          mensaje += ` (${subidas}/${totalFotos} fotos subidas — reintenta el resto editando el producto)`;
        }
      }
    }

    showToast(mensaje, 'ok');
    // Cualquier guardado real deja es_borrador en false (ver
    // construirPayloadProducto) — si este producto venía de "Ver:
    // Borradores", ya no pertenece ahí.
    productosBorradoresCache = null;
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

// ---------- Fotos de producto (e-commerce Fase 0) ----------
const FOTO_LADO_PX = 1000;
const FOTO_CALIDAD_INICIAL = 0.85;
const FOTO_CALIDAD_MINIMA = 0.5;
const FOTO_OBJETIVO_BYTES = 150 * 1024;

// Fuente activa de fotos: en edición son las ya subidas (API real); en
// creación (sin id todavía) son las que están en memoria esperando a que
// el producto se guarde — ver manejarSeleccionFotoProducto().
function fotosActivas() {
  return editingProductId ? productoEnEdicionImagenUrls : fotosNuevasStaged;
}

// Índice de la foto que se está arrastrando (drag & drop del grid) — vive
// fuera de renderFotosProducto() porque el grid se vuelve a pintar entero
// en cada paso (dragstart/drop), y el índice tiene que sobrevivir a esos
// repintados hasta soltar.
let fotoArrastrandoIdx = null;

function renderFotosProducto() {
  if (!elProdFotosGrid) return;
  const lista = fotosActivas();
  const elBtnDescargarTodas = document.getElementById('btnDescargarTodasFotos');
  if (elBtnDescargarTodas) elBtnDescargarTodas.style.display = lista.length ? '' : 'none';
  if (!lista.length) {
    elProdFotosGrid.innerHTML = '<p class="modal-hint">Sin fotos todavía.</p>';
    return;
  }
  // La primera foto del arreglo es la que la tienda usa como foto principal
  // de catálogo (imagen_urls[0]) — de ahí la etiqueta y las flechas/el
  // arrastre para que el dueño elija el orden a mano, sin depender del
  // orden de subida.
  elProdFotosGrid.innerHTML = lista.map((url, i) => `
    <div class="foto-producto-item" draggable="true" data-idx="${i}" title="Arrastra para reordenar" style="position:relative; width:90px;">
      <div style="position:relative; width:90px; height:90px;">
        <img src="${escHtml(url)}" style="width:100%; height:100%; object-fit:cover; border-radius:8px; border:1px solid #d8dee9; pointer-events:none;">
        <button type="button" class="btn-quitar-foto" data-idx="${i}"
          style="position:absolute; top:-6px; right:-6px; width:22px; height:22px; border-radius:999px; border:none; background:#dc2626; color:#fff; cursor:pointer; line-height:1;">×</button>
        <button type="button" class="btn-descargar-foto" data-idx="${i}" title="Descargar esta foto"
          style="position:absolute; bottom:-6px; right:-6px; width:22px; height:22px; border-radius:999px; border:none; background:#0891b2; color:#fff; cursor:pointer; line-height:1; font-size:11px;">⬇</button>
        ${i === 0 ? '<span style="position:absolute; bottom:4px; left:4px; background:rgba(37,99,235,.9); color:#fff; font-size:10px; font-weight:700; padding:2px 6px; border-radius:999px;">Principal</span>' : ''}
      </div>
      <div style="display:flex; justify-content:center; gap:4px; margin-top:4px;">
        <button type="button" class="btn-mover-foto" data-idx="${i}" data-direccion="arriba" title="Mover antes"
          ${i === 0 ? 'disabled style="opacity:.35;cursor:not-allowed;"' : ''}>◀</button>
        <button type="button" class="btn-mover-foto" data-idx="${i}" data-direccion="abajo" title="Mover después"
          ${i === lista.length - 1 ? 'disabled style="opacity:.35;cursor:not-allowed;"' : ''}>▶</button>
      </div>
    </div>`).join('');

  elProdFotosGrid.querySelectorAll('.btn-quitar-foto').forEach(btn => {
    btn.addEventListener('click', () => quitarFotoProducto(Number(btn.dataset.idx)));
  });
  elProdFotosGrid.querySelectorAll('.btn-mover-foto').forEach(btn => {
    btn.addEventListener('click', () => moverFotoProducto(Number(btn.dataset.idx), btn.dataset.direccion));
  });
  elProdFotosGrid.querySelectorAll('.btn-descargar-foto').forEach(btn => {
    btn.addEventListener('click', () => descargarFotoProducto(Number(btn.dataset.idx), btn));
  });
  configurarArrastreFotos();
}

/* ---------- Descargar fotos (una o todas) ----------
   Las fotos viven en Supabase Storage (bucket público) — un <a href
   download> normal no fuerza la descarga en un dominio distinto (el
   navegador la abre en pestaña nueva en vez de bajarla), así que se trae
   la imagen como blob y se dispara la descarga desde ahí, con el nombre
   de archivo real del producto en vez del hash del storage. */
function slugArchivo(base) {
  return (base || 'producto').trim().toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60) || 'producto';
}

function nombreArchivoFoto(base, idx, total, url) {
  const ext = (url.split('.').pop() || 'webp').split('?')[0].slice(0, 5);
  const limpio = slugArchivo(base);
  return total > 1 ? `${limpio}-${idx + 1}.${ext}` : `${limpio}.${ext}`;
}

function dispararDescargaBlob(blob, nombreArchivo) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = nombreArchivo;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

async function descargarFotoProducto(idx, boton) {
  const lista = fotosActivas();
  const url = lista[idx];
  if (!url) return;
  const nombre = elProdNombre?.value.trim() || 'producto';
  if (boton) boton.disabled = true;
  try {
    const resp = await fetch(url);
    if (!resp.ok) throw new Error('No se pudo descargar la foto');
    const blob = await resp.blob();
    dispararDescargaBlob(blob, nombreArchivoFoto(nombre, idx, lista.length, url));
  } catch (err) {
    showToast(err.message || 'No se pudo descargar la foto', 'err');
  } finally {
    if (boton) boton.disabled = false;
  }
}

/* "Descargar todas": una sola foto se baja directa; dos o más se empaquetan
   en un .zip (JSZip, cargado en index.html) — bajar 5 archivos sueltos de
   un solo click casi siempre lo bloquea el navegador (límite de descargas
   múltiples por interacción del usuario). */
async function descargarTodasFotosProducto() {
  const lista = fotosActivas();
  if (!lista.length) return;
  const nombre = elProdNombre?.value.trim() || 'producto';
  const boton = document.getElementById('btnDescargarTodasFotos');
  if (boton) { boton.disabled = true; boton.textContent = '⏳ Descargando…'; }
  try {
    const blobs = await Promise.all(lista.map(async (url) => {
      const resp = await fetch(url);
      if (!resp.ok) throw new Error(`No se pudo descargar una de las fotos (${resp.status})`);
      return resp.blob();
    }));

    if (blobs.length === 1) {
      dispararDescargaBlob(blobs[0], nombreArchivoFoto(nombre, 0, 1, lista[0]));
      return;
    }

    if (typeof JSZip === 'undefined') { showToast('No se pudo cargar el compresor .zip', 'err'); return; }
    const zip = new JSZip();
    blobs.forEach((blob, i) => zip.file(nombreArchivoFoto(nombre, i, lista.length, lista[i]), blob));
    const zipBlob = await zip.generateAsync({ type: 'blob' });
    dispararDescargaBlob(zipBlob, `${slugArchivo(nombre)}-fotos.zip`);
  } catch (err) {
    showToast(err.message || 'No se pudieron descargar las fotos', 'err');
  } finally {
    if (boton) { boton.disabled = false; boton.textContent = '⬇️ Descargar todas'; }
  }
}

/* Arrastrar y soltar para reordenar libremente (además de las flechas
   ◀▶, que quedan para mover de a un paso con precisión/teclado). Nativo
   del navegador (HTML5 Drag and Drop), sin librerías. */
function configurarArrastreFotos() {
  const items = elProdFotosGrid.querySelectorAll('.foto-producto-item');
  items.forEach(item => {
    item.addEventListener('dragstart', (e) => {
      fotoArrastrandoIdx = Number(item.dataset.idx);
      item.classList.add('foto-arrastrando');
      e.dataTransfer.effectAllowed = 'move';
      // Firefox exige setData con algún dato para permitir el drag.
      e.dataTransfer.setData('text/plain', String(fotoArrastrandoIdx));
    });
    item.addEventListener('dragend', () => {
      fotoArrastrandoIdx = null;
      items.forEach(el => el.classList.remove('foto-arrastrando', 'foto-drop-objetivo'));
    });
    item.addEventListener('dragover', (e) => {
      e.preventDefault(); // necesario para que 'drop' dispare
      if (fotoArrastrandoIdx === null || Number(item.dataset.idx) === fotoArrastrandoIdx) return;
      item.classList.add('foto-drop-objetivo');
    });
    item.addEventListener('dragleave', () => item.classList.remove('foto-drop-objetivo'));
    item.addEventListener('drop', (e) => {
      e.preventDefault();
      item.classList.remove('foto-drop-objetivo');
      const destinoIdx = Number(item.dataset.idx);
      if (fotoArrastrandoIdx === null || destinoIdx === fotoArrastrandoIdx) return;
      moverFotoADestino(fotoArrastrandoIdx, destinoIdx);
    });
  });
}

/* Reordenamiento libre (arrastre) a cualquier posición, a diferencia de
   moverFotoProducto() (abajo) que solo intercambia con el vecino
   inmediato. En modo edición se pinta optimista y se confirma con el
   servidor (PUT .../imagen/orden con el arreglo completo, ver
   sql/... y api/index.js) — si falla, se revierte. */
async function moverFotoADestino(origenIdx, destinoIdx) {
  const lista = fotosActivas();
  if (origenIdx === destinoIdx || !lista[origenIdx]) return;
  const nuevoOrden = [...lista];
  const [movida] = nuevoOrden.splice(origenIdx, 1);
  nuevoOrden.splice(destinoIdx, 0, movida);

  if (!editingProductId) {
    fotosNuevasStaged = nuevoOrden;
    renderFotosProducto();
    return;
  }

  const anterior = productoEnEdicionImagenUrls;
  productoEnEdicionImagenUrls = nuevoOrden;
  renderFotosProducto();
  try {
    const actualizado = await API.productos.reordenarImagenes(editingProductId, nuevoOrden);
    productoEnEdicionImagenUrls = actualizado.imagen_urls || nuevoOrden;
    renderFotosProducto();
  } catch (err) {
    console.error('Error al reordenar las fotos:', err.message || err);
    showToast(err.message || 'No se pudo reordenar las fotos', 'err');
    productoEnEdicionImagenUrls = anterior;
    renderFotosProducto();
  }
}

async function moverFotoProducto(idx, direccion) {
  const lista = fotosActivas();
  const url = lista[idx];
  if (!url) return;

  // Modo creación: la foto todavía no existe en el servidor, se reordena
  // el array local sin red.
  if (!editingProductId) {
    const destino = direccion === 'arriba' ? idx - 1 : idx + 1;
    if (destino < 0 || destino >= lista.length) return;
    [lista[idx], lista[destino]] = [lista[destino], lista[idx]];
    renderFotosProducto();
    return;
  }

  try {
    const actualizado = await API.productos.moverImagen(editingProductId, url, direccion);
    productoEnEdicionImagenUrls = actualizado.imagen_urls || productoEnEdicionImagenUrls;
    renderFotosProducto();
  } catch (err) {
    console.error('Error al mover la foto:', err.message || err);
    showToast(err.message || 'No se pudo mover la foto', 'err');
  }
}

/* Lee los archivos elegidos, uno por uno, y los deja listos en el mismo
   pipeline de siempre (dibujar sobre 1000x1000 + comprimir a webp). Con el
   producto ya guardado, cada foto se sube de inmediato; sin guardar
   todavía, quedan en fotosNuevasStaged y se suben recién cuando
   guardarProducto() cree el producto y tenga un id real. */
function manejarSeleccionFotoProducto(event) {
  const archivos = Array.from(event.target.files || []);
  event.target.value = ''; // permite elegir los mismos archivos dos veces seguidas
  if (archivos.length) procesarArchivosFoto(archivos);
}

/* Cablea la zona de arrastrar y soltar (#dropzoneFotos): mismo pipeline que
   elegir archivos a mano (procesarArchivosFoto), solo cambia el origen de
   los File — admite soltar varias fotos a la vez, no solo una.
   dragover/dragenter agregan .dropzone-activa (glow) mientras el archivo
   está encima; dragleave/drop la quitan. */
function configurarDropzoneFotos() {
  if (!elDropzoneFotos) return;
  const marcarActiva = (e) => { e.preventDefault(); elDropzoneFotos.classList.add('dropzone-activa'); };
  const quitarActiva = (e) => { e.preventDefault(); elDropzoneFotos.classList.remove('dropzone-activa'); };

  ['dragenter', 'dragover'].forEach(ev => elDropzoneFotos.addEventListener(ev, marcarActiva));
  ['dragleave', 'dragend'].forEach(ev => elDropzoneFotos.addEventListener(ev, quitarActiva));
  elDropzoneFotos.addEventListener('drop', (e) => {
    quitarActiva(e);
    const archivos = Array.from(e.dataTransfer?.files || []);
    if (archivos.length) procesarArchivosFoto(archivos);
  });
  // El <label for="prodFotoInput"> ya abre el selector de archivos al hacer
  // click — no hace falta un listener de click aparte acá.
}

/* Procesa una tanda de archivos (elegidos a mano o arrastrados) en orden,
   uno detrás de otro — así el orden en que quedan las fotos coincide con
   el orden en que se soltaron/eligieron, y no se satura la red subiendo
   todas en paralelo. Los que no sean imagen se ignoran y se avisan aparte,
   en vez de cortar el resto de la tanda. */
async function procesarArchivosFoto(archivos) {
  const validos = archivos.filter(a => a.type.startsWith('image/'));
  const ignorados = archivos.length - validos.length;

  if (!validos.length) {
    showToast('Elige uno o más archivos de imagen', 'err');
    return;
  }

  let subidas = 0;
  for (let i = 0; i < validos.length; i++) {
    if (elProdFotoEstado) {
      elProdFotoEstado.textContent = validos.length > 1
        ? `Procesando foto ${i + 1} de ${validos.length}...`
        : 'Procesando imagen...';
    }
    try {
      await procesarUnaFoto(validos[i]);
      subidas++;
    } catch (err) {
      console.error('Error al procesar una de las fotos:', err.message || err);
      showToast(err.message || 'No se pudo procesar una de las fotos', 'err');
    }
  }

  if (elProdFotoEstado) {
    elProdFotoEstado.textContent = subidas
      ? (editingProductId ? `${subidas} foto(s) subida(s).` : `${subidas} foto(s) agregada(s) (se suben al guardar el producto).`)
      : '';
  }
  if (subidas) showToast(subidas === 1 ? 'Foto agregada' : `${subidas} fotos agregadas`, 'ok');
  if (ignorados > 0) showToast(`${ignorados} archivo(s) ignorado(s) por no ser imágenes`, 'err');
}

/* Lee UN archivo, lo dibuja centrado sobre un lienzo 1000x1000 con fondo
   blanco (sin deformar ni recortar), y lo exporta a webp bajando la
   calidad hasta acercarse a ~150KB — pieza reusada por procesarArchivosFoto
   para cada archivo de la tanda. */
async function procesarUnaFoto(archivo) {
  const bitmap = await cargarBitmapDeArchivo(archivo);
  // Recorte opcional ANTES de centrar en el lienzo 1000×1000 — una foto
  // con mucho espacio vacío alrededor (caso real: foto de catálogo del
  // proveedor) quedaba con el producto chico y rodeado de blanco. "Usar
  // imagen completa" salta este paso y sigue igual que antes.
  const bitmapRecortado = await abrirRecortadorFoto(bitmap);
  const dataUrlWebp = await dibujarYComprimirFoto(bitmapRecortado);

  // Antes, en un producto NUEVO, la foto quedaba solo en memoria del
  // navegador (fotosNuevasStaged) hasta apretar "Guardar Producto" — si se
  // cerraba la pestaña antes de eso, la foto se perdía entera y sin aviso
  // (caso real reportado: varias fotos subidas y nunca guardadas). Ahora,
  // apenas se agrega la PRIMERA foto de un producto nuevo, se crea de una
  // vez un borrador real en la base (mismo guardarProducto, con lo que
  // haya escrito hasta ahora) para que esa y las siguientes fotos se
  // suban de inmediato a Supabase como en modo edición — sobrevive a que
  // se cierre el navegador. Sigue siendo un producto de verdad, editable
  // o borrable como cualquier otro; "Guardar Producto" después solo lo
  // actualiza (PUT), nunca crea uno segundo.
  if (!editingProductId) {
    try {
      await crearBorradorProducto();
    } catch (err) {
      console.error('No se pudo crear el borrador automático:', err.message || err);
      // Sin borrador, se cae al comportamiento de siempre (memoria del
      // navegador) — mejor que perder la foto por completo.
      fotosNuevasStaged.push(dataUrlWebp);
      renderFotosProducto();
      return;
    }
  }

  const actualizado = await API.productos.subirImagen(editingProductId, dataUrlWebp);
  productoEnEdicionImagenUrls = actualizado.imagen_urls || productoEnEdicionImagenUrls;
  renderFotosProducto();
}

/* Crea el producto tal cual está escrito hasta ahora en el formulario
   (mismo construirPayloadProducto() que el guardado normal), SIN cerrar
   el editor ni recargar el catálogo — a diferencia de guardarProducto(),
   esto pasa de fondo mientras se sigue completando el formulario. Sin
   nombre todavía, usa uno provisorio con la fecha; el aviso deja
   clarísimo que hay que completarlo y no es el guardado final. */
async function crearBorradorProducto() {
  if (!(elProdNombre?.value || '').trim() && elProdNombre) {
    elProdNombre.value = `Borrador sin nombre — ${new Date().toLocaleString('es-CL')}`;
  }

  const payload = construirPayloadProducto();
  if (!payload) throw new Error('No se pudo crear el borrador');
  payload.es_borrador = true;
  // Nunca publicado, sin importar la casilla: un borrador por definición
  // está incompleto (a veces sin precio ni descripción todavía) — no
  // debe poder aparecer en sevelin.cl solo porque "Publicar en la web"
  // nace tildada por defecto en un producto nuevo.
  payload.publicado_web = false;

  const creado = await API.productos.crear(payload);
  if (!creado?.id) throw new Error('No se pudo crear el borrador');
  productosBorradoresCache = null;   // se invalida: hay uno nuevo que "Ver: Borradores" todavía no tiene

  editingProductId = creado.id;
  if (elProdEditId) elProdEditId.value = creado.id;
  if (elProductoFormTitle) elProductoFormTitle.textContent = 'Editar Producto (borrador)';
  // Mismo criterio que abrirModalProducto: exportar/archivar solo tienen
  // sentido sobre un producto que ya existe de verdad — y este, apenas se
  // creó, ya existe.
  if (elBtnExportarProducto) elBtnExportarProducto.style.display = '';
  if (elBtnArchivarProducto) {
    elBtnArchivarProducto.style.display = '';
    elBtnArchivarProducto.textContent = '📦 Archivar';
    productoEnEdicionArchivado = false;
  }

  showToast('Producto creado como borrador para no perder tus fotos — complétalo y presiona "Guardar Producto" cuando termines.', 'ok');
}

/* ---------- Recortar foto (opcional) ----------
   Modal con un recuadro arrastrable/redimensionable a mano (mousedown +
   mousemove + mouseup en el documento, sin librería externa) sobre la
   imagen ya cargada. Devuelve una Promise que resuelve con la imagen
   recortada (un nuevo <img>) o la original si el usuario elige "Usar
   imagen completa". */
const elModalRecortarFoto = document.getElementById('modalRecortarFoto');
const elRecortarFotoStage = document.getElementById('recortarFotoStage');
const elRecortarFotoImg = document.getElementById('recortarFotoImg');
const elRecortarFotoSeleccion = document.getElementById('recortarFotoSeleccion');
const elRecortarFotoHandle = document.getElementById('recortarFotoHandle');
const elBtnRecortarFotoCompleta = document.getElementById('btnRecortarFotoCompleta');
const elBtnRecortarFotoConfirmar = document.getElementById('btnRecortarFotoConfirmar');

function abrirRecortadorFoto(img) {
  return new Promise((resolve) => {
    if (!elModalRecortarFoto || !elRecortarFotoStage || !elRecortarFotoImg) { resolve(img); return; }

    // El <img> que llega ya cargó su bitmap y cargarBitmapDeArchivo() ya
    // revocó la URL de origen — se redibuja a un dataURL propio para el
    // <img> del modal en vez de reusar esa URL (ya inválida para un
    // elemento nuevo, aunque el original la siga mostrando bien).
    const canvasPrevia = document.createElement('canvas');
    canvasPrevia.width = img.naturalWidth || img.width;
    canvasPrevia.height = img.naturalHeight || img.height;
    canvasPrevia.getContext('2d').drawImage(img, 0, 0);
    elRecortarFotoImg.src = canvasPrevia.toDataURL('image/png');

    let sel = null;
    let arrastre = null;

    const pintarSeleccion = () => {
      elRecortarFotoSeleccion.style.left = sel.x + 'px';
      elRecortarFotoSeleccion.style.top = sel.y + 'px';
      elRecortarFotoSeleccion.style.width = sel.w + 'px';
      elRecortarFotoSeleccion.style.height = sel.h + 'px';
    };

    const clamp = () => {
      const rect = elRecortarFotoStage.getBoundingClientRect();
      sel.w = Math.max(30, Math.min(sel.w, rect.width));
      sel.h = Math.max(30, Math.min(sel.h, rect.height));
      sel.x = Math.max(0, Math.min(sel.x, rect.width - sel.w));
      sel.y = Math.max(0, Math.min(sel.y, rect.height - sel.h));
    };

    const inicializarSeleccion = () => {
      const rect = elRecortarFotoStage.getBoundingClientRect();
      const w = rect.width * 0.8, h = rect.height * 0.8;
      sel = { x: (rect.width - w) / 2, y: (rect.height - h) / 2, w, h };
      pintarSeleccion();
    };

    const onMouseDownSeleccion = (e) => {
      e.preventDefault();
      arrastre = { tipo: 'mover', startX: e.clientX, startY: e.clientY, selInicial: { ...sel } };
    };
    const onMouseDownHandle = (e) => {
      e.preventDefault(); e.stopPropagation();
      arrastre = { tipo: 'resize', startX: e.clientX, startY: e.clientY, selInicial: { ...sel } };
    };
    const onMouseMove = (e) => {
      if (!arrastre) return;
      const dx = e.clientX - arrastre.startX;
      const dy = e.clientY - arrastre.startY;
      if (arrastre.tipo === 'mover') {
        sel.x = arrastre.selInicial.x + dx;
        sel.y = arrastre.selInicial.y + dy;
      } else {
        sel.w = arrastre.selInicial.w + dx;
        sel.h = arrastre.selInicial.h + dy;
      }
      clamp();
      pintarSeleccion();
    };
    const onMouseUp = () => { arrastre = null; };

    const limpiar = () => {
      elModalRecortarFoto.classList.remove('show');
      elRecortarFotoImg.onload = null;
      elRecortarFotoSeleccion.removeEventListener('mousedown', onMouseDownSeleccion);
      elRecortarFotoHandle.removeEventListener('mousedown', onMouseDownHandle);
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
      elBtnRecortarFotoCompleta.removeEventListener('click', usarCompleta);
      elBtnRecortarFotoConfirmar.removeEventListener('click', confirmarRecorte);
    };

    const usarCompleta = () => { limpiar(); resolve(img); };

    const confirmarRecorte = () => {
      const rect = elRecortarFotoStage.getBoundingClientRect();
      const escalaX = img.naturalWidth / rect.width;
      const escalaY = img.naturalHeight / rect.height;
      const sx = sel.x * escalaX, sy = sel.y * escalaY;
      const sw = sel.w * escalaX, sh = sel.h * escalaY;

      const canvas = document.createElement('canvas');
      canvas.width = sw;
      canvas.height = sh;
      canvas.getContext('2d').drawImage(img, sx, sy, sw, sh, 0, 0, sw, sh);

      const recortada = new Image();
      recortada.onload = () => { limpiar(); resolve(recortada); };
      recortada.src = canvas.toDataURL('image/png');
    };

    elRecortarFotoSeleccion.addEventListener('mousedown', onMouseDownSeleccion);
    elRecortarFotoHandle.addEventListener('mousedown', onMouseDownHandle);
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
    elBtnRecortarFotoCompleta.addEventListener('click', usarCompleta);
    elBtnRecortarFotoConfirmar.addEventListener('click', confirmarRecorte);

    elModalRecortarFoto.classList.add('show');
    // El stage recién tiene su tamaño real una vez que el <img> del modal
    // (que puede ser más chico/grande que el original) terminó de cargar.
    if (elRecortarFotoImg.complete) inicializarSeleccion();
    else elRecortarFotoImg.onload = inicializarSeleccion;
  });
}

function cargarBitmapDeArchivo(archivo) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const urlObjeto = URL.createObjectURL(archivo);
    img.onload = () => { URL.revokeObjectURL(urlObjeto); resolve(img); };
    img.onerror = () => { URL.revokeObjectURL(urlObjeto); reject(new Error('No se pudo leer la imagen')); };
    img.src = urlObjeto;
  });
}

function dibujarYComprimirFoto(img) {
  const canvas = elProdFotoCanvas || document.createElement('canvas');
  canvas.width = FOTO_LADO_PX;
  canvas.height = FOTO_LADO_PX;
  const ctx = canvas.getContext('2d');

  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 0, FOTO_LADO_PX, FOTO_LADO_PX);

  // "Contain": mantiene proporción, centrada, sin recortar ni deformar
  const escala = Math.min(FOTO_LADO_PX / img.width, FOTO_LADO_PX / img.height);
  const w = img.width * escala;
  const h = img.height * escala;
  ctx.drawImage(img, (FOTO_LADO_PX - w) / 2, (FOTO_LADO_PX - h) / 2, w, h);

  return new Promise((resolve, reject) => {
    const intentar = (calidad) => {
      canvas.toBlob((blob) => {
        if (!blob) { reject(new Error('No se pudo generar la imagen')); return; }
        if (blob.size > FOTO_OBJETIVO_BYTES && calidad > FOTO_CALIDAD_MINIMA) {
          intentar(Math.round((calidad - 0.1) * 100) / 100);
          return;
        }
        blobADataUrl(blob).then(resolve, reject);
      }, 'image/webp', calidad);
    };
    intentar(FOTO_CALIDAD_INICIAL);
  });
}

function blobADataUrl(blob) {
  return new Promise((resolve, reject) => {
    const lector = new FileReader();
    lector.onload = () => resolve(lector.result);
    lector.onerror = () => reject(new Error('No se pudo leer la imagen procesada'));
    lector.readAsDataURL(blob);
  });
}

async function quitarFotoProducto(idx) {
  const lista = fotosActivas();
  const url = lista[idx];
  if (!url) return;
  if (!confirm('¿Quitar esta foto?')) return;

  // Modo creación: solo vive en memoria, no hay nada que borrar en el servidor.
  if (!editingProductId) {
    fotosNuevasStaged.splice(idx, 1);
    renderFotosProducto();
    showToast('Foto quitada', 'ok');
    return;
  }

  try {
    const actualizado = await API.productos.quitarImagen(editingProductId, url);
    productoEnEdicionImagenUrls = actualizado.imagen_urls || productoEnEdicionImagenUrls.filter(u => u !== url);
    renderFotosProducto();
    showToast('Foto eliminada', 'ok');
  } catch (err) {
    console.error('Error al quitar la foto:', err.message || err);
    showToast(err.message || 'No se pudo quitar la foto', 'err');
  }
}

// ---------- Tarjeta "Categoría": selects en cascada + creación inline ----------
// Antes vivía en un pop-up aparte (#modalFotosCategoria, sesión anterior);
// ahora es una tarjeta fija de #view-producto-editor y no hay paso
// "Aceptar" — cada cambio en los selects escribe directo en
// #prodCategoriaWeb (aplicarSeleccionCategoria), que es el estado real que
// lee guardarProducto().

// Carga producto_categorias (misma tabla que "Página Web → Categorías") y
// arma los dos <select> en cascada, dejando preseleccionada la categoría o
// subcategoría que ya traía #prodCategoriaWeb (estado compartido con
// guardarProducto()).
async function cargarCategoriasEditor() {
  if (!elPopFotosCategoria) return;
  try {
    const categorias = await API.productosCategorias.listar();
    categoriasWebCache = categorias;

    const seleccionadaId = elProdCategoriaWeb?.selectedOptions[0]?.dataset.id || '';
    const seleccionada = categorias.find(c => String(c.id) === String(seleccionadaId));
    const categoriaPadreId = seleccionada ? (seleccionada.parent_id || seleccionada.id) : '';
    const subcategoriaId = seleccionada?.parent_id ? seleccionada.id : '';

    const raiz = categorias.filter(c => !c.parent_id);
    elPopFotosCategoria.innerHTML = '<option value="">Sin categoría</option>' +
      raiz.map(c => `<option value="${c.id}">${escHtml(c.nombre)}</option>`).join('');
    elPopFotosCategoria.value = categoriaPadreId || '';

    poblarSubcategoriasEditor(categoriaPadreId, subcategoriaId);
  } catch (err) {
    console.error('Error al cargar categorías:', err.message || err);
    showToast(err.message || 'No se pudieron cargar las categorías', 'err');
  }
}

function poblarSubcategoriasEditor(categoriaId, subcategoriaSeleccionadaId) {
  if (!elPopFotosSubcategoria) return;
  const hijos = categoriaId ? categoriasWebCache.filter(c => String(c.parent_id) === String(categoriaId)) : [];
  elPopFotosSubcategoria.innerHTML = '<option value="">Sin subcategoría</option>' +
    hijos.map(c => `<option value="${c.id}">${escHtml(c.nombre)}</option>`).join('');
  elPopFotosSubcategoria.value = subcategoriaSeleccionadaId || '';

  const habilitar = !!categoriaId;
  elPopFotosSubcategoria.disabled = !habilitar;
  if (elPopNuevaSubcategoriaInput) elPopNuevaSubcategoriaInput.disabled = !habilitar;
  if (elBtnPopNuevaSubcategoria) elBtnPopNuevaSubcategoria.disabled = !habilitar;
}

async function crearCategoriaEditor() {
  const nombre = (elPopNuevaCategoriaInput?.value || '').trim();
  if (!nombre) { showToast('Escribe un nombre', 'err'); return; }
  try {
    const creada = await API.productosCategorias.crear(nombre, null);
    if (elPopNuevaCategoriaInput) elPopNuevaCategoriaInput.value = '';
    await cargarCategoriasEditor();
    if (elPopFotosCategoria) elPopFotosCategoria.value = creada.id;
    poblarSubcategoriasEditor(creada.id, '');
    aplicarSeleccionCategoria();
    showToast('Categoría creada', 'ok');
  } catch (err) {
    console.error('Error al crear categoría:', err.message || err);
    showToast(err.message || 'No se pudo crear la categoría', 'err');
  }
}

async function crearSubcategoriaEditor() {
  const categoriaId = elPopFotosCategoria?.value;
  if (!categoriaId) { showToast('Elige primero una categoría', 'err'); return; }
  const nombre = (elPopNuevaSubcategoriaInput?.value || '').trim();
  if (!nombre) { showToast('Escribe un nombre', 'err'); return; }
  try {
    const creada = await API.productosCategorias.crear(nombre, categoriaId);
    if (elPopNuevaSubcategoriaInput) elPopNuevaSubcategoriaInput.value = '';
    categoriasWebCache.push(creada);
    poblarSubcategoriasEditor(categoriaId, creada.id);
    aplicarSeleccionCategoria();
    showToast('Subcategoría creada', 'ok');
  } catch (err) {
    console.error('Error al crear subcategoría:', err.message || err);
    showToast(err.message || 'No se pudo crear la subcategoría', 'err');
  }
}

// Escribe la categoría/subcategoría elegida en el <select> oculto
// #prodCategoriaWeb — mismo estado que guardarProducto() ya leía desde
// antes (value + data-id de la opción elegida), ahora actualizado en vivo
// con cada cambio en vez de con un botón "Aceptar".
function aplicarSeleccionCategoria() {
  const subcategoriaId = elPopFotosSubcategoria?.value || '';
  const categoriaId = elPopFotosCategoria?.value || '';
  const idElegido = subcategoriaId || categoriaId;
  const categoria = categoriasWebCache.find(c => String(c.id) === String(idElegido));

  if (elProdCategoriaWeb) {
    elProdCategoriaWeb.innerHTML = '<option value="">Sin categoría</option>' +
      (categoria ? `<option value="${escHtml(categoria.nombre)}" data-id="${categoria.id}" selected>${escHtml(categoria.nombre)}</option>` : '');
    elProdCategoriaWeb.value = categoria ? categoria.nombre : '';
  }
}

// ---------- Eliminar ----------
async function eliminarProducto(id) {
  if (!confirm('¿Eliminar este producto del inventario?')) return;

  try {
    await API.productos.eliminar(id);
    showToast('Producto eliminado', 'ok');
    productosArchivadosCache = null;
    productosBorradoresCache = null;
    cargarProductos(true);
  } catch (err) {
    console.error('Error al eliminar producto:', err.message || err);
    // Causa más común: el producto tiene ventas reales (venta_items) —
    // no se puede borrar sin romper ese historial. La solución es
    // archivarlo, no forzar el borrado.
    showToast(err.message || 'No se pudo eliminar — si tiene ventas, archívalo en vez de borrarlo', 'err');
  }
}

// ---------- Archivar / Desarchivar ----------
// Retira un producto del POS/venta/tienda SIN borrarlo (a diferencia de
// Eliminar, que la base rechaza si el producto tiene ventas reales). El
// nombre viaja siempre: sanearProducto() exige `nombre` incluso en un PUT
// parcial, así que un body con solo {archivado:true} da 400.
async function archivarProducto(id, fuente) {
  const producto = (fuente || productsList).find(p => String(p.id) === String(id));
  if (!producto) return;
  if (!confirm(`Archivar "${producto.nombre}"? Deja de aparecer en el POS y en la tienda web, pero conserva su historial de ventas.`)) return;

  try {
    await API.productos.actualizar(id, { nombre: producto.nombre, archivado: true });
    showToast('Producto archivado', 'ok');
    productosArchivadosCache = null;   // se invalida: la próxima vez que se abra "Ver: Archivados" debe traerlo
    productosBorradoresCache = null;
    cargarProductos(true);
  } catch (err) {
    console.error('Error al archivar producto:', err.message || err);
    showToast(err.message || 'No se pudo archivar el producto', 'err');
  }
}

async function desarchivarProducto(id, fuente) {
  const producto = (fuente || productosArchivadosCache || []).find(p => String(p.id) === String(id));
  if (!producto) return;
  if (!confirm(`¿Desarchivar "${producto.nombre}"? Vuelve a aparecer en el POS, la venta y la tienda web.`)) return;

  try {
    await API.productos.actualizar(id, { nombre: producto.nombre, archivado: false });
    showToast('Producto desarchivado — vuelve a aparecer en el POS', 'ok');
    // Se invalida la caché de archivados y se refresca productsList en un
    // solo paso: cargarProductos(true) termina llamando a
    // handleBuscarProductoTabla(), que como el filtro sigue en
    // "Ver: Archivados" vuelve a pedir la lista (ya sin este producto).
    productosArchivadosCache = null;
    productosBorradoresCache = null;
    cargarProductos(true);
  } catch (err) {
    console.error('Error al desarchivar producto:', err.message || err);
    showToast(err.message || 'No se pudo desarchivar el producto', 'err');
  }
}

/* Mismo Archivar/Desarchivar de la tabla, pero disparado desde DENTRO del
   editor (pedido del dueño: no encontraba la opción al editar un
   producto, solo estaba en la fila de la tabla). Usa editingProductId +
   el nombre actual del formulario (por si lo estaba editando) y, a
   diferencia de las de la tabla, NO cierra el editor — se queda ahí,
   solo cambia el botón de estado para poder revertirlo al toque si fue
   un clic accidental. */
async function alternarArchivadoDesdeEditor() {
  if (!editingProductId) return;
  const nuevoEstado = !productoEnEdicionArchivado;
  const nombre = (elProdNombre?.value || '').trim() || 'este producto';

  const mensajeConfirmacion = nuevoEstado
    ? `¿Archivar "${nombre}"? Deja de aparecer en el POS y en la tienda web, pero conserva su historial de ventas.`
    : `¿Desarchivar "${nombre}"? Vuelve a aparecer en el POS, la venta y la tienda web.`;
  if (!confirm(mensajeConfirmacion)) return;

  try {
    await API.productos.actualizar(editingProductId, { nombre, archivado: nuevoEstado });
    productoEnEdicionArchivado = nuevoEstado;
    if (elBtnArchivarProducto) {
      elBtnArchivarProducto.textContent = nuevoEstado ? '📤 Desarchivar' : '📦 Archivar';
      elBtnArchivarProducto.title = nuevoEstado
        ? 'Vuelve a aparecer en el POS, la venta y la tienda web'
        : 'Lo retira del POS, la venta y la tienda web sin borrar su historial de ventas';
    }
    // Si se archivó, publicado_web quedó en false en el servidor (ver
    // sanearProducto) — se refleja también acá para que el editor no
    // muestre un estado que ya no es real.
    if (nuevoEstado && elProdPublicadoWeb) elProdPublicadoWeb.checked = false;
    showToast(nuevoEstado ? 'Producto archivado' : 'Producto desarchivado — vuelve a aparecer en el POS', 'ok');
    productosArchivadosCache = null;
    productosBorradoresCache = null;
    cargarProductos(true);
  } catch (err) {
    console.error('Error al archivar/desarchivar producto:', err.message || err);
    showToast(err.message || 'No se pudo cambiar el estado de archivado', 'err');
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
