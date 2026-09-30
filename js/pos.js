// ==========================================
// POS.JS - Módulo de Venta (Sevelin)
// ------------------------------------------
// La venta se registra en el backend (que recalcula totales y, si es
// un trabajador, toma los costos del catálogo). Al confirmar se imprime
// el ticket de 58 mm de inmediato y queda disponible para reimprimir.
// ==========================================

let cart = [];
let productoSeleccionado = null;
let ultimaVentaRegistrada = null;
let claveCobroEnCurso = null;   // sql/50: se repite en los reintentos del mismo cobro

// Descuento del carrito actual — 'MONTO' ($) o 'PORCENTAJE' (%). El monto
// real siempre lo vuelve a calcular el servidor al confirmar la venta
// (api/index.js::calcularDescuentoMonto); esto es solo la previsualización.
let descuentoTipo = 'MONTO';

const elBuscarProducto = document.getElementById('posBuscarProducto');
const elSugerencias = document.getElementById('posSugerencias');
const elItemNombre = document.getElementById('itemNombre');
const elItemCantidad = document.getElementById('itemCantidad');
const elItemCosto = document.getElementById('itemCosto');
const elItemPrecio = document.getElementById('itemPrecio');
const elCheckSN = document.getElementById('checkTieneSN');
const elItemSN = document.getElementById('itemSN');
const elCheckEsServicio = document.getElementById('checkEsServicio');
const elItemFotoPreview = document.getElementById('itemFotoPreview');

// Muestra/oculta la miniatura junto al nombre del producto en "Ingresar
// producto" — compartido entre seleccionarProductoCatalogo() y
// limpiarFormularioItem().
/* Muestra la miniatura del producto elegido. `urls` puede traer todas las
   fotos: al hacer clic se abren en el visor grande, con flechas si hay
   varias (dueño, 16-09-2026 — la miniatura de 52px no alcanza para
   confirmar que es el producto que el cliente tiene en la mano). */
function mostrarFotoItem(urls, nombre) {
  if (!elItemFotoPreview) return;
  const lista = (Array.isArray(urls) ? urls : [urls]).filter(Boolean);
  if (lista.length) {
    elItemFotoPreview.src = lista[0];
    elItemFotoPreview.style.display = '';
    elItemFotoPreview.classList.add('miniatura-ampliable');
    elItemFotoPreview.dataset.ampliar = JSON.stringify(lista);
    elItemFotoPreview.dataset.ampliarTitulo = nombre || '';
    elItemFotoPreview.title = 'Clic para ver la foto en grande';
  } else {
    elItemFotoPreview.removeAttribute('src');
    elItemFotoPreview.style.display = 'none';
    elItemFotoPreview.classList.remove('miniatura-ampliable');
    delete elItemFotoPreview.dataset.ampliar;
    delete elItemFotoPreview.dataset.ampliarTitulo;
    elItemFotoPreview.removeAttribute('title');
  }
}
const elUtilidadPreview = document.getElementById('utilidadPreview');
const elBtnAgregarItem = document.getElementById('btnAgregarItem');
const elPosFecha = document.getElementById('posFecha');
const elPosEditarHora = document.getElementById('posEditarHora');
/* Contenedores de los campos que solo aparecen al marcar su casilla.
   Se ocultan por defecto para no gastar espacio en algo que casi nunca
   se usa: la hora manual es la excepción, no la regla. */
const elGrupoPosHora = document.getElementById('grupoPosHora');
const elGrupoItemSN = document.getElementById('grupoItemSN');
const elPosHora = document.getElementById('posHora');
const elPosCliente = document.getElementById('posCliente');
/* Contacto del cliente (sql/37, bloqueo B5 del plan de crecimiento):
   opcional, nunca bloquea el cobro. El backend lo normaliza a dígitos
   con código de país para poder agrupar las compras de una persona. */
const elPosClienteTelefono = document.getElementById('posClienteTelefono');
const elCartTableBody = document.getElementById('cartTableBody');
const elCartTotalText = document.getElementById('cartTotalText');
const elBtnFinalizarVenta = document.getElementById('btnFinalizarVenta');
const elBtnLimpiarSeleccion = document.getElementById('btnLimpiarSeleccion');

// Descuento sobre el total del carrito (ver renderCart/aplicarDescuentoCarrito)
const elBtnDescuentoMonto = document.getElementById('btnDescuentoMonto');
const elBtnDescuentoPorcentaje = document.getElementById('btnDescuentoPorcentaje');
const elPosDescuentoValor = document.getElementById('posDescuentoValor');
const elFilaSubtotalDescuento = document.getElementById('filaSubtotalDescuento');
const elPosSubtotalText = document.getElementById('posSubtotalText');
const elPosDescuentoMontoText = document.getElementById('posDescuentoMontoText');
const elFilaUtilidadPos = document.getElementById('filaUtilidadPos');
const elPosUtilidadBrutaText = document.getElementById('posUtilidadBrutaText');
const elFilaUtilidadNeta = document.getElementById('filaUtilidadNeta');
const elPosUtilidadNetaText = document.getElementById('posUtilidadNetaText');

const elModalVentaExitosa = document.getElementById('modalVentaExitosa');
const elVentaExitosaDetalle = document.getElementById('ventaExitosaDetalle');
const elVentaExitosaVuelto = document.getElementById('ventaExitosaVuelto');
const elVentaExitosaVueltoMonto = document.getElementById('ventaExitosaVueltoMonto');
const elVentaExitosaAviso = document.getElementById('ventaExitosaAviso');
const elBtnPrintTicketVenta = document.getElementById('btnPrintTicketVenta');
const elBtnCloseVentaExitosa = document.getElementById('btnCloseVentaExitosa');

const ICO_QUITAR = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M8 6V4h8v2"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/></svg>`;

document.addEventListener('DOMContentLoaded', () => {
  if (elPosFecha) elPosFecha.value = todayISO();
  setupPosEventListeners();
  actualizarBotonesDescuentoTipo();
  renderCart();
});

/* Tras validar el PIN, el cursor queda en el buscador para escanear de inmediato */
document.addEventListener('pos:sesion-iniciada', () => {
  if (elPosFecha) elPosFecha.value = todayISO();
  enfocarBuscador();
});

/* Y también al volver a la pestaña de POS */
document.addEventListener('pos:vista-activa', (e) => {
  if (e.detail && e.detail.vista === 'view-pos') enfocarBuscador();
});

function setupPosEventListeners() {
  if (elBuscarProducto) {
    elBuscarProducto.addEventListener('input', handleBuscarProducto);
    document.addEventListener('click', (e) => {
      // Cerrar el visor de una foto de la lista no debe cerrar la lista
      if (e.target.closest('#visorImagen')) return;
      if (elSugerencias && e.target !== elBuscarProducto && !elSugerencias.contains(e.target)) {
        elSugerencias.classList.remove('show');
      }
    });
  }

  if (elCheckSN) {
    elCheckSN.addEventListener('change', () => {
      alternarCampoSN(elCheckSN.checked);
      if (elCheckSN.checked) setTimeout(() => elItemSN?.focus(), 50);
      else if (elItemSN) elItemSN.value = '';
    });
  }

  [elItemCantidad, elItemCosto, elItemPrecio].forEach(el => {
    if (el) el.addEventListener('input', actualizarUtilidadPreview);
  });

  if (elBtnAgregarItem) elBtnAgregarItem.addEventListener('click', agregarItemAlCarrito);
  if (elBtnFinalizarVenta) elBtnFinalizarVenta.addEventListener('click', abrirModalPago);

  // Botones de cada línea del carrito: delegados, porque renderCart repinta todo
  if (elCartTableBody) elCartTableBody.addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (!b || b.disabled) return;
    if (b.dataset.quitar !== undefined) { cart.splice(Number(b.dataset.quitar), 1); renderCart(); }
    else if (b.dataset.cantMas !== undefined) cambiarCantidadCarrito(Number(b.dataset.cantMas), +1);
    else if (b.dataset.cantMenos !== undefined) cambiarCantidadCarrito(Number(b.dataset.cantMenos), -1);
    else if (b.dataset.mayoristaAplicar !== undefined) alternarMayoristaLinea(Number(b.dataset.mayoristaAplicar), true);
    else if (b.dataset.mayoristaQuitar !== undefined) alternarMayoristaLinea(Number(b.dataset.mayoristaQuitar), false);
  });

  if (elBtnDescuentoMonto) elBtnDescuentoMonto.addEventListener('click', () => elegirTipoDescuento('MONTO'));
  if (elBtnDescuentoPorcentaje) elBtnDescuentoPorcentaje.addEventListener('click', () => elegirTipoDescuento('PORCENTAJE'));
  if (elPosDescuentoValor) elPosDescuentoValor.addEventListener('input', renderCart);

  // Limpia SOLO los campos de ingreso; el carrito queda intacto
  if (elBtnLimpiarSeleccion) elBtnLimpiarSeleccion.addEventListener('click', () => {
    limpiarFormularioItem();
    enfocarBuscador();
    showToast('Selección limpiada', '');
  });

  if (elBtnPrintTicketVenta) elBtnPrintTicketVenta.addEventListener('click', () => {
    if (ultimaVentaRegistrada) imprimirTicketVenta(ultimaVentaRegistrada, ultimaVentaRegistrada.items);
  });
  if (elBtnCloseVentaExitosa) elBtnCloseVentaExitosa.addEventListener('click', cerrarModalVentaExitosa);

  /* Hora personalizada: por defecto se usa la hora actual del sistema, y
     el campo ni siquiera se muestra. Aparece al marcar la casilla. */
  if (elPosEditarHora) elPosEditarHora.addEventListener('change', () => {
    const activo = elPosEditarHora.checked;
    if (elGrupoPosHora) elGrupoPosHora.style.display = activo ? 'block' : 'none';
    if (!elPosHora) return;
    if (activo) {
      /* Se re-habilita SIEMPRE: tras completar una venta el campo queda
         disabled (ver limpieza al final de confirmarVenta). Sin esto, al
         marcar la casilla el grupo aparecía pero el input seguía
         bloqueado, y parecía que "no se podía editar la hora". */
      elPosHora.disabled = false;
      if (!elPosHora.value) elPosHora.value = horaActualCorta();
      setTimeout(() => elPosHora.focus(), 50);
    }
  });



  // Enter en el precio agrega el ítem directamente
  if (elItemPrecio) elItemPrecio.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { e.preventDefault(); agregarItemAlCarrito(); }
  });
}

// ============================================================
// Búsqueda / autocompletado de productos del catálogo
// ============================================================
function handleBuscarProducto() {
  if (!elSugerencias) return;
  const q = (elBuscarProducto.value || '').trim().toLowerCase();

  if (!q || typeof productsList === 'undefined' || !Array.isArray(productsList)) {
    elSugerencias.classList.remove('show');
    elSugerencias.innerHTML = '';
    return;
  }

  /* Búsqueda por palabras sueltas: "cable vga" encuentra "Cable HDMI a
     VGA" aunque la frase no aparezca literal ni en ese orden. Los
     resultados vienen ordenados por parecido (ver config.js). */
  const encontrados = filtrarPorBusqueda(
    productsList, q,
    p => [p.nombre, p.sku, p.codigo_barras, p.descripcion],
    8
  );

  if (encontrados.length === 0) {
    elSugerencias.classList.remove('show');
    elSugerencias.innerHTML = '';
    return;
  }

  elSugerencias.innerHTML = encontrados.map((p, i) => {
    const sinStock = !p.stock_ilimitado && !p.es_servicio && Number(p.stock) <= 0;
    const stock = p.stock_ilimitado || p.es_servicio ? '' : `Stock: ${p.stock ?? 0}`;
    return `
    <div class="suggestion-item" data-id="${p.id}" data-atajo="Alt+${i + 1}">
      ${miniaturaProducto(p, 40, { ampliable: true })}
      <span class="sug-nombre">${escHtml(p.nombre)}${p.requiere_sn ? ' <small class="sug-sn">S/N</small>' : ''}</span>
      <span class="sug-meta">${fmtCLP(p.precio_unitario)}${stock ? `<small class="${sinStock ? 'sug-sin-stock' : ''}">${stock}</small>` : ''}</span>
    </div>`;
  }).join('');
  elSugerencias.classList.add('show');

  // Reinicia la marca de navegación con ↑ / ↓ (js/atajos.js)
  if (typeof sugerenciaActiva !== 'undefined') sugerenciaActiva = -1;

  elSugerencias.querySelectorAll('.suggestion-item').forEach(item => {
    item.addEventListener('click', (e) => {
      // La foto abre el visor (clic delegado en config.js), no elige el producto
      if (e.target.closest('[data-ampliar]')) return;
      const producto = productsList.find(p => String(p.id) === item.dataset.id);
      if (producto) seleccionarProductoCatalogo(producto);
      elSugerencias.classList.remove('show');
      elBuscarProducto.value = '';
    });
    item.addEventListener('mouseenter', () => previsualizarSugerencia(item));
  });
}

/* ------------------------------------------------------------
   VISTA PREVIA: la foto grande de lo que vas a agregar (la sugerencia
   marcada) o de lo último que entró al carrito. Clic en la foto = visor.
   ------------------------------------------------------------ */
const elVistaPrevia = document.getElementById('posVistaPrevia');
let vistaPrevia = null;        // { producto, modo: 'sugerencia' | 'agregado' }
let ultimoAgregado = null;

function mostrarVistaPrevia(producto, modo) {
  if (!elVistaPrevia) return;
  vistaPrevia = producto ? { producto, modo } : null;
  elVistaPrevia.classList.toggle('con-producto', !!producto);
  if (!producto) {
    elVistaPrevia.innerHTML = '<p class="vp-vacia">Escanea o busca un producto y su foto aparece aquí.</p>';
    return;
  }
  const enCarrito = cart.filter(i => i.producto_id === producto.id).reduce((a, i) => a + i.cantidad, 0);
  const etiqueta = modo === 'agregado'
    ? `Agregado · ${enCarrito} en el carrito`
    : (enCarrito ? `Vista previa · ya llevas ${enCarrito}` : 'Vista previa');
  const stock = producto.stock_ilimitado || producto.es_servicio ? '' : `Stock: ${producto.stock ?? 0}`;
  const fotos = (producto.imagen_urls || []).filter(Boolean).length;
  elVistaPrevia.innerHTML = `
    ${miniaturaProducto(producto, 128, { ampliable: true })}
    <div class="vp-info">
      <span class="vp-etiqueta${modo === 'agregado' ? ' vp-agregado' : ''}">${escHtml(etiqueta)}</span>
      <strong class="vp-nombre">${escHtml(producto.nombre)}</strong>
      <span class="vp-precio">${fmtCLP(producto.precio_unitario)}</span>
      <span class="vp-detalle">${[stock, fotos > 1 ? `${fotos} fotos` : '', producto.requiere_sn ? 'Pide S/N' : ''].filter(Boolean).join(' · ')}</span>
    </div>`;
}

function previsualizarSugerencia(item) {
  const producto = item && productsList.find(p => String(p.id) === item.dataset.id);
  if (producto) mostrarVistaPrevia(producto, 'sugerencia');
}

// Al cerrarse la lista, la vista previa vuelve a lo último agregado
if (elSugerencias) {
  new MutationObserver(() => {
    if (!elSugerencias.classList.contains('show') && vistaPrevia?.modo === 'sugerencia') {
      mostrarVistaPrevia(ultimoAgregado, 'agregado');
    }
  }).observe(elSugerencias, { attributes: true, attributeFilter: ['class'] });
}

/* ============================================================
   MODO EDICIÓN
   ------------------------------------------------------------
   APAGADO (por defecto): elegir un producto del catálogo lo manda
   directo al carrito. Es el flujo de caja rápida: buscar, Enter, listo.

   ENCENDIDO: el producto se carga en el formulario y espera a que
   ajustes cantidad, precio o S/N antes de agregarlo. Sirve para
   descuentos puntuales o ventas con detalle.

   Nace apagado en cada carga de la vista a propósito: es un modo de
   excepción, y dejarlo encendido de un día para otro haría que la caja
   se sintiera trabada sin motivo aparente.

   Los productos que exigen S/N NUNCA entran solos, encendido o no: sin
   la serie el ítem quedaría incompleto.
   ============================================================ */
let modoEdicion = false;

document.addEventListener('DOMContentLoaded', () => {
  const toggle = document.getElementById('toggleModoEdicion');
  if (!toggle) return;

  toggle.checked = false;
  modoEdicion = false;
  actualizarEtiquetaModoEdicion();

  toggle.addEventListener('change', () => {
    modoEdicion = toggle.checked;
    actualizarEtiquetaModoEdicion();
    showToast(modoEdicion
      ? 'Modo edición activo: podrás ajustar cada producto antes de agregarlo'
      : 'Modo rápido: los productos entran directo al carrito', '');
  });
});

function actualizarEtiquetaModoEdicion() {
  const cont = document.getElementById('cajaModoEdicion');
  const txt = document.getElementById('textoModoEdicion');
  if (cont) cont.classList.toggle('activo', modoEdicion);
  if (txt) txt.textContent = modoEdicion ? 'Modo edición' : 'Modo rápido';

  /* El formulario de detalle solo estorba en modo rápido: se atenúa para
     dejar claro que no hay que tocarlo, sin ocultarlo (sigue sirviendo
     para productos manuales que no están en el catálogo). */
  const detalle = document.getElementById('detalleProducto');
  if (detalle) detalle.classList.toggle('detalle-atenuado', !modoEdicion);
}

function seleccionarProductoCatalogo(producto, opciones = {}) {
  productoSeleccionado = producto;
  if (elItemNombre) elItemNombre.value = producto.nombre || '';
  // El trabajador no ve costos: el backend los completa desde el catálogo
  if (elItemCosto && esAdmin()) elItemCosto.value = producto.costo_unitario || 0;
  if (elItemPrecio) elItemPrecio.value = producto.precio_unitario || 0;
  if (elItemCantidad) elItemCantidad.value = 1;
  mostrarFotoItem(producto.imagen_urls, producto.nombre);

  if (elCheckSN) {
    elCheckSN.checked = !!producto.requiere_sn;
    alternarCampoSN(elCheckSN.checked);
  }

  // Servicio = marca propia del producto (sql/52) o categoría web
  // "Servicios Técnicos". Nunca por stock_ilimitado: ese campo también lo
  // usan productos físicos sin control de stock exacto (Rollos Térmicos,
  // Disipador CPU) y marcarlos "servicio" falsearía el resumen de ventas en
  // productos vs. servicios. La marca propia existe porque un servicio que
  // no se publica en la tienda no tiene categoría web (15-09-2026).
  if (elCheckEsServicio) elCheckEsServicio.checked = !!producto.es_servicio || producto.categoria_web === 'Servicios Técnicos';

  actualizarUtilidadPreview();

  /* Alta directa al carrito en modo rápido. Un producto con S/N primero
     pregunta la serie (opcional). `sinAutoAgregar`: el escáner maneja su
     propio flujo y agregaría dos veces. */
  if (!modoEdicion && !opciones.sinAutoAgregar) {
    if (producto.requiere_sn) agregarConSerie(producto);
    else agregarItemAlCarrito();
    return;
  }

  // En modo edición el cursor va a Cantidad, que es lo que más se ajusta
  if (modoEdicion && elItemCantidad) {
    setTimeout(() => { elItemCantidad.focus(); elItemCantidad.select(); }, 60);
  }
}

/* Muestra u oculta el campo de número de serie. Se centraliza aquí
   porque lo tocan tres sitios distintos (casilla, selección de producto
   del catálogo y limpieza del formulario). */
function alternarCampoSN(mostrar) {
  if (elGrupoItemSN) elGrupoItemSN.style.display = mostrar ? 'block' : 'none';
  if (elItemSN) elItemSN.style.display = '';   // lo controla el contenedor
}

function actualizarUtilidadPreview() {
  if (!elUtilidadPreview) return;
  if (!esAdmin()) { elUtilidadPreview.textContent = ''; return; }

  const cant = Number(elItemCantidad?.value) || 0;
  const costo = Number(elItemCosto?.value) || 0;
  const precio = Number(elItemPrecio?.value) || 0;
  const utilidad = (precio - costo) * cant;
  elUtilidadPreview.textContent = cant > 0 ? `Utilidad estimada: ${fmtCLP(utilidad)}` : '';
}

// ============================================================
// Carrito de venta
// ============================================================
function agregarItemAlCarrito() {
  const nombre = (elItemNombre?.value || '').trim();
  const cantidad = Number(elItemCantidad?.value) || 0;
  const costo = esAdmin() ? (Number(elItemCosto?.value) || 0) : 0;
  const precio = Number(elItemPrecio?.value) || 0;
  const tieneSN = !!(elCheckSN && elCheckSN.checked);
  const numeroSerie = tieneSN ? (elItemSN?.value || '').trim() : '';
  const esServicio = !!(elCheckEsServicio && elCheckEsServicio.checked);

  if (!nombre) { showToast('Ingresa el nombre del producto', 'err'); return; }
  if (cantidad <= 0) { showToast('La cantidad debe ser mayor a 0', 'err'); return; }
  if (precio <= 0) { showToast('Ingresa el precio de venta', 'err'); return; }
  // El S/N es opcional (dueño, 27-09-2026), pero la misma serie no puede salir dos veces
  if (numeroSerie && cart.some(i => i.serial_number === numeroSerie)) {
    showToast(`El S/N ${numeroSerie} ya está en el carrito`, 'err');
    return;
  }

  const producto = productoSeleccionado;
  /* Venta mayorista (sql/76): si se tipeó justo el precio mayorista, la
     línea nace marcada; si no, nace normal y la caja ofrece aplicarlo cuando
     la cantidad alcance (ver renderCart). */
  const precioMayorista = producto ? (Number(producto.precio_mayorista) || null) : null;
  const esPrecioMayorista = !!precioMayorista && precio === precioMayorista;
  // El mismo producto sin S/N y al mismo precio suma a su línea en vez de repetirla
  // (una línea ya pasada a mayorista también recibe las unidades a precio normal).
  const igual = producto && !numeroSerie && cart.find(i =>
    i.producto_id === producto.id && !i.serial_number &&
    (i.precio_unitario === precio || (i.precio_tipo === 'MAYORISTA' && i.precio_normal === precio)) &&
    i.costo_unitario === costo && i.es_servicio === esServicio);

  if (igual) {
    igual.cantidad += cantidad;
    igual.subtotal = igual.precio_unitario * igual.cantidad;
    showToast(`${igual.nombre} x${igual.cantidad}`, 'ok');
  } else {
    cart.push({
      producto_id: producto ? producto.id : null,
      sku: producto ? (producto.sku || null) : null,
      nombre,
      cantidad,
      costo_unitario: costo,
      precio_unitario: precio,
      subtotal: precio * cantidad,
      serial_number: numeroSerie || null,
      // Independiente de si el ítem viene del catálogo o se escribió a mano
      es_servicio: esServicio,
      // Venta mayorista (sql/76): precio_tipo viaja al servidor; el resto es solo del carrito.
      precio_tipo: esPrecioMayorista ? 'MAYORISTA' : 'NORMAL',
      precio_normal: esPrecioMayorista ? (Number(producto.precio_unitario) || precio) : precio,
      precio_mayorista: precioMayorista,
      mayorista_desde: producto ? (Number(producto.mayorista_desde) || null) : null,
      // Solo para el carrito (fotos y el "+" que pide S/N); normalizarItems() los descarta
      requiere_sn: !!producto?.requiere_sn,
      imagen_urls: producto ? (producto.imagen_urls || []).filter(Boolean) : []
    });
  }

  if (producto) ultimoAgregado = producto;
  renderCart();
  limpiarFormularioItem();
  if (producto) {
    mostrarVistaPrevia(producto, 'agregado');
    avisoStockCarrito(producto.id);
  }
  enfocarBuscador();   // listo para el siguiente escaneo
}

/* Producto con S/N en modo rápido o escaneado: pregunta la serie (opcional)
   y lo agrega. Cancelar deja el carrito como estaba. */
async function agregarConSerie(producto) {
  const serie = await pedirNumeroSerie(producto);
  if (serie === null) { limpiarFormularioItem(); enfocarBuscador(); return; }
  if (elCheckSN) elCheckSN.checked = !!serie;
  if (elItemSN) elItemSN.value = serie;
  agregarItemAlCarrito();
}

/* Ventana del número de serie. Devuelve la serie, '' si se agrega sin S/N,
   o null si se cancela. Se arma al abrirla y se destruye al cerrar, igual
   que el visor de fotos: no deja ids fijos en index.html. */
function pedirNumeroSerie(producto) {
  return new Promise((resolve) => {
    document.getElementById('modalNumeroSerie')?.remove();
    const cont = document.createElement('div');
    cont.id = 'modalNumeroSerie';
    cont.className = 'modal-overlay show';
    cont.innerHTML = `
      <div class="modal-box modal-sn" role="dialog" aria-modal="true" aria-labelledby="snTitulo">
        <div class="modal-sn-cabecera">
          ${miniaturaProducto(producto, 56)}
          <div>
            <h2 id="snTitulo">Número de serie</h2>
            <p class="modal-hint">${escHtml(producto.nombre || '')}</p>
          </div>
        </div>
        <label for="snPromptInput" class="etiqueta-pos">S/N (opcional) · escanéalo o escríbelo y pulsa Enter</label>
        <div class="relative">
          <input type="text" id="snPromptInput" class="campo-pos pr-12" autocomplete="off" spellcheck="false"
                 placeholder="Déjalo vacío si no lo tienes a mano">
          <button type="button" class="sn-camara" data-sn-camara title="Escanear el S/N con la cámara">📷</button>
        </div>
        <div class="modal-foot">
          <button type="button" class="btn btn-ghost" data-cerrar-modal>Cancelar</button>
          <button type="button" class="btn btn-outline" data-sn-sin>Agregar sin S/N</button>
          <button type="button" class="btn btn-primary" data-sn-ok>Agregar</button>
        </div>
      </div>`;
    document.body.appendChild(cont);

    const input = cont.querySelector('#snPromptInput');
    const porCamara = (e) => { if (e.detail?.inputId === 'snPromptInput') cerrar(input.value.trim()); };
    function cerrar(valor) {
      document.removeEventListener('escaner:codigo', porCamara);
      cont.remove();
      resolve(valor);
    }
    document.addEventListener('escaner:codigo', porCamara);

    // Esc lo resuelve atajos.js pulsando el botón data-cerrar-modal
    cont.addEventListener('click', (e) => {
      if (e.target === cont || e.target.closest('[data-cerrar-modal]')) cerrar(null);
      else if (e.target.closest('[data-sn-sin]')) cerrar('');
      else if (e.target.closest('[data-sn-ok]')) cerrar(input.value.trim());
      else if (e.target.closest('[data-sn-camara]') && typeof abrirEscaner === 'function') abrirEscaner('snPromptInput');
    });
    input.addEventListener('keydown', (e) => {
      if (e.key !== 'Enter') return;
      e.preventDefault();
      cerrar(input.value.trim());
    });
    setTimeout(() => input.focus(), 50);
  });
}

/* + / − de cada línea (y Alt + / Alt − para la última, ver atajos.js).
   En un producto con S/N, cada unidad nueva pregunta su serie: con serie va
   en su propia línea; sin serie suma a la línea sin S/N de ese producto. */
/* ---------- Venta mayorista en caja (sql/76, v103) ----------
   En el local decide quien vende: la caja solo muestra el precio mayorista
   del producto y, cuando la cantidad alcanza, un botón para aplicarlo. La
   línea queda marcada MAYORISTA (venta_items.precio_tipo) para medirla. */
function detalleMayoristaLinea(item, idx) {
  const pm = Number(item.precio_mayorista) || 0;
  const desde = Number(item.mayorista_desde) || 0;
  if (!pm || !desde) return '';
  if (item.precio_tipo === 'MAYORISTA') {
    return ` · <span class="cart-mayorista activo">🤝 Mayorista</span>
      <button type="button" class="cart-mayorista-btn" data-mayorista-quitar="${idx}" title="Volver al precio normal (${fmtCLP(item.precio_normal)})">quitar</button>`;
  }
  if (item.cantidad >= desde && pm < item.precio_unitario) {
    return ` · <button type="button" class="cart-mayorista-btn" data-mayorista-aplicar="${idx}"
      title="Llevan ${item.cantidad}: el precio mayorista corre desde ${desde} unidades">🤝 Aplicar mayorista ${fmtCLP(pm)} c/u</button>`;
  }
  return ` · <span class="cart-mayorista">Mayorista ${fmtCLP(pm)} desde ${desde} u.</span>`;
}

function aplicarPrecioMayoristaLinea(linea, aplicar) {
  if (aplicar) {
    linea.precio_normal = linea.precio_unitario;
    linea.precio_unitario = Number(linea.precio_mayorista);
    linea.precio_tipo = 'MAYORISTA';
  } else {
    linea.precio_unitario = Number(linea.precio_normal) || linea.precio_unitario;
    linea.precio_tipo = 'NORMAL';
  }
  linea.subtotal = linea.precio_unitario * linea.cantidad;
}

function alternarMayoristaLinea(idx, aplicar) {
  const linea = cart[idx];
  if (!linea) return;
  if (aplicar && linea.cantidad < Number(linea.mayorista_desde)) {
    showToast(`El precio mayorista corre desde ${linea.mayorista_desde} unidades`, 'err');
    return;
  }
  aplicarPrecioMayoristaLinea(linea, aplicar);
  renderCart();
  enfocarBuscador();
}

async function cambiarCantidadCarrito(idx, delta) {
  const linea = cart[idx];
  if (!linea) return;

  if (delta < 0) {
    if (linea.cantidad <= 1) { showToast('Para quitarlo usa el basurero (o Alt+Supr)', ''); return; }
    linea.cantidad -= 1;
    // Bajo la cantidad mínima deja de ser venta mayorista: vuelve sola al precio normal.
    if (linea.precio_tipo === 'MAYORISTA' && linea.cantidad < Number(linea.mayorista_desde)) {
      aplicarPrecioMayoristaLinea(linea, false);
      showToast(`Menos de ${linea.mayorista_desde} u.: vuelve al precio normal (${fmtCLP(linea.precio_unitario)})`, '');
    }
  } else if (linea.requiere_sn) {
    const serie = await pedirNumeroSerie(linea);
    if (serie === null) { enfocarBuscador(); return; }
    if (serie && cart.some(i => i.serial_number === serie)) {
      showToast(`El S/N ${serie} ya está en el carrito`, 'err');
      return;
    }
    const sinSerie = !serie && cart.find(i => i.producto_id === linea.producto_id && !i.serial_number);
    if (sinSerie) sinSerie.cantidad += 1;
    else cart.push({ ...linea, cantidad: 1, serial_number: serie || null });
  } else {
    linea.cantidad += 1;
  }

  cart.forEach(i => { i.subtotal = i.precio_unitario * i.cantidad; });
  renderCart();
  if (delta > 0) avisoStockCarrito(linea.producto_id);
  enfocarBuscador();
}

/* Solo avisa: el servidor es quien valida el stock al cobrar. */
function avisoStockCarrito(productoId) {
  if (!productoId || !Array.isArray(productsList)) return;
  const p = productsList.find(x => x.id === productoId);
  if (!p || p.stock_ilimitado || p.es_servicio) return;
  const stock = Number(p.stock) || 0;
  const llevas = cart.filter(i => i.producto_id === productoId).reduce((a, i) => a + i.cantidad, 0);
  if (llevas > stock) showToast(`Ojo: ${p.nombre} tiene ${stock} en stock y llevas ${llevas}`, 'err');
}

// ============================================================
// ESCÁNER DE CÁMARA — alta directa al carrito
// ------------------------------------------------------------
// Al escanear en el buscador del POS no basta con rellenar el campo: el
// producto se agrega solo. Se consulta al backend, que busca el código
// indistintamente por código de barras, SKU y número de serie.
//
// Si el producto exige S/N, NO se agrega a ciegas: se deja cargado en el
// formulario con el cursor en el campo de serie, porque esa venta necesita
// la serie de la unidad concreta que sale de la tienda.
// ============================================================
let buscandoPorCodigo = false;

document.addEventListener('escaner:codigo', (e) => {
  const detalle = e.detail || {};
  // Solo reacciona el buscador del POS; el resto de los módulos siguen
  // usando el escáner como un simple rellenador de campos.
  if (detalle.inputId !== 'posBuscarProducto') return;
  agregarPorCodigoEscaneado(detalle.codigo);
});

/* Una pistola láser USB se comporta como un teclado: escribe muy rápido y
   termina con Enter. Ese Enter también dispara el alta directa. */
document.addEventListener('DOMContentLoaded', () => {
  if (!elBuscarProducto) return;
  elBuscarProducto.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter') return;
    e.preventDefault();
    const codigo = (elBuscarProducto.value || '').trim();
    if (codigo) agregarPorCodigoEscaneado(codigo);
  });
});

async function agregarPorCodigoEscaneado(codigo) {
  const limpio = String(codigo || '').trim();
  if (!limpio || buscandoPorCodigo) return;

  buscandoPorCodigo = true;
  try {
    /* Primero se prueba en memoria: productsList ya está cargado y una
       coincidencia exacta evita una ida al servidor en el caso normal. */
    let producto = null;
    if (Array.isArray(productsList)) {
      producto = productsList.find(p =>
        (p.codigo_barras || '').trim() === limpio ||
        (p.sku || '').trim() === limpio
      ) || null;
    }

    // Si no está en memoria, el backend además busca por número de serie
    if (!producto) {
      try {
        producto = await API.productos.buscarPorCodigo(limpio);
      } catch (_) {
        producto = null;   // 404: no existe ningún producto con ese código
      }
    }

    if (!producto) {
      showToast(`Sin coincidencias para "${limpio}"`, 'err');
      if (elSugerencias) elSugerencias.classList.remove('show');
      return;
    }

    seleccionarProductoCatalogo(producto, { sinAutoAgregar: true });
    if (elBuscarProducto) elBuscarProducto.value = '';
    if (elSugerencias) elSugerencias.classList.remove('show');

    /* Con S/N se pregunta la serie (opcional). Sin S/N, escanear tres veces
       el mismo artículo da "x3": agregarItemAlCarrito suma a su línea. */
    if (producto.requiere_sn) await agregarConSerie(producto);
    else agregarItemAlCarrito();
  } finally {
    buscandoPorCodigo = false;
    enfocarBuscador();
  }
}

/* ============================================================
   DIVIDIR VENTA
   ------------------------------------------------------------
   Para cuando una parte de la mercadería necesita boleta y la otra no.

   POR QUÉ ASÍ Y NO "UN DTE POR MEDIO DE PAGO":
   una boleta documenta el TOTAL de la operación, no una fracción. Emitir
   boleta solo por lo pagado con tarjeta dejaría el resto como venta sin
   documentar. La forma correcta es que sean dos ventas distintas, cada
   una con su documento y su medio de pago.

   El flujo evita duplicar código: se cobra la parte 1 con el circuito de
   siempre y, al terminar, el resto vuelve al carrito para cobrarse como
   una segunda venta normal.
   ============================================================ */
let restoDivision = null;      // ítems que quedan pendientes de la parte 2
let seleccionDivision = new Set();

function abrirDividirVenta() {
  if (!cart.length) { showToast('El carrito está vacío', 'err'); return; }
  if (cart.length < 2) { showToast('Se necesitan al menos 2 productos para dividir', 'err'); return; }
  if (restoDivision) { showToast('Primero termina de cobrar la parte pendiente', 'err'); return; }

  // Por defecto, el primer producto va en la parte 1
  seleccionDivision = new Set(['0']);
  renderDividirVenta();
  document.getElementById('modalDividir')?.classList.add('show');
}

function renderDividirVenta() {
  const lista = document.getElementById('dividirLista');
  if (!lista) return;

  lista.innerHTML = cart.map((item, i) => {
    const marcado = seleccionDivision.has(String(i));
    return `
      <label class="dividir-item${marcado ? ' marcado' : ''}">
        <input type="checkbox" data-div="${i}" ${marcado ? 'checked' : ''}>
        <span class="dividir-nombre">
          ${item.cantidad} × ${escHtml(item.nombre)}
          ${item.serial_number ? `<small>S/N: ${escHtml(item.serial_number)}</small>` : ''}
        </span>
        <b>${fmtCLP(item.subtotal)}</b>
      </label>`;
  }).join('');

  lista.querySelectorAll('input[data-div]').forEach(chk => {
    chk.addEventListener('change', () => {
      const k = chk.dataset.div;
      if (chk.checked) seleccionDivision.add(k); else seleccionDivision.delete(k);
      renderDividirVenta();
    });
  });

  actualizarResumenDivision();
}

function actualizarResumenDivision() {
  const parte1 = cart.filter((_, i) => seleccionDivision.has(String(i)));
  const parte2 = cart.filter((_, i) => !seleccionDivision.has(String(i)));

  const t1 = parte1.reduce((a, x) => a + Number(x.subtotal || 0), 0);
  const t2 = parte2.reduce((a, x) => a + Number(x.subtotal || 0), 0);

  const el1 = document.getElementById('dividirTotal1');
  const el2 = document.getElementById('dividirTotal2');
  if (el1) el1.textContent = `${parte1.length} ítem(s) · ${fmtCLP(t1)}`;
  if (el2) el2.textContent = `${parte2.length} ítem(s) · ${fmtCLP(t2)}`;

  /* Las dos partes deben tener algo: si una queda vacía no hay división,
     es la venta completa de siempre. */
  const btn = document.getElementById('btnConfirmarDividir');
  if (btn) btn.disabled = parte1.length === 0 || parte2.length === 0;
}

function confirmarDividirVenta() {
  const parte1 = cart.filter((_, i) => seleccionDivision.has(String(i)));
  const parte2 = cart.filter((_, i) => !seleccionDivision.has(String(i)));
  if (!parte1.length || !parte2.length) return;

  restoDivision = parte2;
  cart = parte1;
  renderCart();

  document.getElementById('modalDividir')?.classList.remove('show');
  mostrarAvisoDivision();
  showToast(`Cobrando la parte 1 de 2 · ${parte2.length} ítem(s) quedan pendientes`, 'ok');

  // Se abre el cobro de la parte 1 con el circuito normal
  setTimeout(() => document.getElementById('btnFinalizarVenta')?.click(), 250);
}

function mostrarAvisoDivision() {
  const aviso = document.getElementById('avisoDivision');
  if (!aviso) return;

  if (!restoDivision) { aviso.style.display = 'none'; return; }

  const total = restoDivision.reduce((a, x) => a + Number(x.subtotal || 0), 0);
  aviso.style.display = '';
  aviso.textContent = `✂️ Venta dividida · quedan ${restoDivision.length} ítem(s) por ${fmtCLP(total)} para la parte 2`;
}

/* Se llama después de registrar una venta: si había división pendiente,
   el resto vuelve al carrito para cobrarse como segunda venta. */
function continuarDivisionSiCorresponde() {
  if (!restoDivision) return false;

  cart = restoDivision;
  restoDivision = null;
  renderCart();
  mostrarAvisoDivision();

  showToast('Parte 1 cobrada. Ahora cobra la parte 2 con su propio documento.', 'ok');
  return true;
}

function cancelarDivision() {
  document.getElementById('modalDividir')?.classList.remove('show');
}

document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('btnDividirVenta')?.addEventListener('click', abrirDividirVenta);
  document.getElementById('btnConfirmarDividir')?.addEventListener('click', confirmarDividirVenta);
  document.getElementById('btnCancelarDividir')?.addEventListener('click', cancelarDivision);
  document.getElementById('modalDividir')?.addEventListener('click', (e) => {
    if (e.target.id === 'modalDividir') cancelarDivision();
  });
});

/* ------------------------------------------------------------
   S/N: escanear el número de serie agrega el producto solo
   ------------------------------------------------------------
   En productos con "Requiere S/N" el flujo era: elegir producto →
   marcar la casilla → escanear la serie → APRETAR Agregar. Ese último
   clic sobraba: escanear la serie ya es la confirmación de que ese
   equipo concreto sale de la tienda.

   Se dispara con Enter (las pistolas lo mandan al final) y también con
   el escáner de cámara, que emite escaner:codigo. Solo actúa si hay un
   producto cargado y la serie tiene contenido. */
document.addEventListener('DOMContentLoaded', () => {
  if (!elItemSN) return;

  elItemSN.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter') return;
    e.preventDefault();
    agregarPorSerieEscaneada();
  });
});

document.addEventListener('escaner:codigo', (e) => {
  if (e.detail?.inputId !== 'itemSN') return;
  agregarPorSerieEscaneada();
});

function agregarPorSerieEscaneada() {
  const serie = (elItemSN?.value || '').trim();
  if (!serie) return;

  // Sin producto cargado la serie no tiene a qué pertenecer
  if (!(elItemNombre?.value || '').trim()) {
    showToast('Elige primero el producto y después escanea el S/N', 'err');
    return;
  }

  agregarItemAlCarrito();
}

/* Deja el cursor en el buscador y selecciona su contenido, de modo que el
   siguiente disparo de la pistola reemplace lo que haya escrito. */
function enfocarBuscador() {
  if (!elBuscarProducto) return;
  if (elSugerencias) elSugerencias.classList.remove('show');
  setTimeout(() => {
    try {
      elBuscarProducto.focus();
      elBuscarProducto.select();
    } catch (_) {}
  }, 40);
}

function limpiarFormularioItem() {
  if (elItemNombre) elItemNombre.value = '';
  if (elItemCantidad) elItemCantidad.value = 1;
  if (elItemCosto) elItemCosto.value = '';
  if (elItemPrecio) elItemPrecio.value = '';
  if (elCheckSN) elCheckSN.checked = false;
  if (elItemSN) elItemSN.value = '';
  alternarCampoSN(false);
  if (elCheckEsServicio) elCheckEsServicio.checked = false;
  mostrarFotoItem(null);
  if (elBuscarProducto) elBuscarProducto.value = '';
  productoSeleccionado = null;
  actualizarUtilidadPreview();
}

/* Cambia entre descuento en $ o en % — mismos valores que espera el
   servidor en descuento_tipo (calcularDescuentoMonto). */
function elegirTipoDescuento(tipo) {
  descuentoTipo = tipo;
  actualizarBotonesDescuentoTipo();
  renderCart();
}

function actualizarBotonesDescuentoTipo() {
  [
    [elBtnDescuentoMonto, 'MONTO'],
    [elBtnDescuentoPorcentaje, 'PORCENTAJE']
  ].forEach(([btn, tipo]) => {
    if (!btn) return;
    const activo = descuentoTipo === tipo;
    btn.classList.toggle('bg-blue-600', activo);
    btn.classList.toggle('text-white', activo);
    btn.classList.toggle('bg-slate-100', !activo);
    btn.classList.toggle('dark:bg-slate-700', !activo);
    btn.classList.toggle('text-slate-600', !activo);
    btn.classList.toggle('dark:text-slate-300', !activo);
  });
}

/* Espejo (para previsualizar) de calcularDescuentoMonto() en api/index.js:
   el monto REAL que se guarda siempre lo recalcula el servidor a partir
   del subtotal de los ítems que reciba, nunca de lo que muestre esta
   función. Nunca deja el descuento negativo, mayor al subtotal, ni un
   porcentaje sobre 100. */
function calcularDescuentoMontoPreview(subtotal, tipo, valor) {
  const v = Math.max(0, Number(valor) || 0);
  let monto = 0;
  if (tipo === 'PORCENTAJE') monto = subtotal * (Math.min(v, 100) / 100);
  else if (tipo === 'MONTO') monto = v;
  return Math.min(Math.max(0, monto), subtotal);
}

/* Descuento tal como se manda al backend al confirmar la venta — null si
   no hay nada válido escrito (el servidor lo trata como "sin descuento"). */
function obtenerDescuentoActual() {
  const valor = Number(elPosDescuentoValor?.value) || 0;
  if (valor <= 0) return { tipo: null, valor: 0 };
  return { tipo: descuentoTipo, valor };
}

function renderCart() {
  if (!elCartTableBody) return;

  if (cart.length === 0) {
    elCartTableBody.innerHTML = '<tr class="empty-row"><td colspan="4">El carrito está vacío. Busca un producto o escribe uno manualmente.</td></tr>';
  } else {
    elCartTableBody.innerHTML = cart.map((item, idx) => {
      const detalle = [
        `${fmtCLP(item.precio_unitario)} c/u`,
        item.serial_number ? `S/N ${escHtml(item.serial_number)}` : (item.requiere_sn ? 'sin S/N' : ''),
        item.es_servicio ? 'Servicio' : ''
      ].filter(Boolean).join(' · ') + detalleMayoristaLinea(item, idx);
      return `
      <tr class="row-in">
        <td class="cart-prod">
          <div class="cart-prod-fila">
            ${miniaturaProducto({ imagen_urls: item.imagen_urls || [], nombre: item.nombre }, 42, { ampliable: true })}
            <div class="cart-prod-texto">
              <span class="cart-prod-nombre">${escHtml(item.nombre)}</span>
              <span class="cart-prod-sub">${detalle}</span>
            </div>
          </div>
        </td>
        <td class="cart-cant">
          <div class="stepper">
            <button type="button" class="stepper-btn" data-cant-menos="${idx}" ${item.cantidad <= 1 ? 'disabled' : ''}
                    aria-label="Una unidad menos de ${escHtml(item.nombre)}">−</button>
            <span class="stepper-num">${item.cantidad}</span>
            <button type="button" class="stepper-btn" data-cant-mas="${idx}"
                    aria-label="Una unidad más de ${escHtml(item.nombre)}">+</button>
          </div>
        </td>
        <td class="cart-subtotal">${fmtCLP(item.subtotal)}</td>
        <td class="cart-quitar">
          <button type="button" class="btn btn-icon btn-icon-del" data-quitar="${idx}" title="Quitar del carrito">${ICO_QUITAR}</button>
        </td>
      </tr>`;
    }).join('');
  }

  const unidades = cart.reduce((a, it) => a + it.cantidad, 0);
  const elConteo = document.getElementById('posCartConteo');
  if (elConteo) elConteo.textContent = unidades ? `${unidades} ${unidades === 1 ? 'unidad' : 'unidades'}` : '';
  // La cantidad "en el carrito" de la vista previa se mantiene al día
  if (vistaPrevia) mostrarVistaPrevia(vistaPrevia.producto, vistaPrevia.modo);

  const subtotal = cart.reduce((acc, it) => acc + it.subtotal, 0);
  const { tipo: tipoActivo, valor: descuentoValor } = obtenerDescuentoActual();
  const descuentoMonto = tipoActivo ? calcularDescuentoMontoPreview(subtotal, tipoActivo, descuentoValor) : 0;
  const total = subtotal - descuentoMonto;

  if (elCartTotalText) elCartTotalText.textContent = fmtCLP(total);

  if (elFilaSubtotalDescuento) elFilaSubtotalDescuento.style.display = descuentoMonto > 0 ? '' : 'none';
  if (descuentoMonto > 0) {
    if (elPosSubtotalText) elPosSubtotalText.textContent = fmtCLP(subtotal);
    if (elPosDescuentoMontoText) elPosDescuentoMontoText.textContent = `-${fmtCLP(descuentoMonto)}`;
  }

  // Utilidad: solo el admin la ve (los ítems de un trabajador ya llegan con
  // costo_unitario=0, ver agregarItemAlCarrito — mostrarla ahí sería mentir).
  if (elFilaUtilidadPos) {
    const mostrar = esAdmin() && cart.length > 0;
    elFilaUtilidadPos.style.display = mostrar ? '' : 'none';
    if (mostrar) {
      const costoTotal = cart.reduce((acc, it) => acc + Number(it.costo_unitario || 0) * it.cantidad, 0);
      const utilidadBruta = subtotal - costoTotal;
      if (elPosUtilidadBrutaText) elPosUtilidadBrutaText.textContent = fmtCLP(utilidadBruta);

      if (elFilaUtilidadNeta) elFilaUtilidadNeta.style.display = descuentoMonto > 0 ? '' : 'none';
      if (descuentoMonto > 0 && elPosUtilidadNetaText) {
        elPosUtilidadNetaText.textContent = fmtCLP(total - costoTotal);
      }
    }
  }
}

// ============================================================
// Finalizar venta → método de pago → registro → ticket
// ============================================================
function abrirModalPago() {
  if (cart.length === 0) { showToast('Agrega al menos un producto al carrito', 'err'); return; }

  /* Punto 4: sin un turno de caja abierto no se registran cobros. El
     estado lo mantiene caja.js; si el módulo no está cargado, no se
     bloquea (hayCajaAbierta no existiría). */
  if (typeof hayCajaAbierta === 'function' && !hayCajaAbierta()) {
    showToast('Abre la caja antes de cobrar', 'err');
    document.getElementById('btnAbrirCajaPos')?.click();
    return;
  }

  const total = cart.reduce((acc, it) => acc + it.subtotal, 0);

  abrirSelectorPago({
    titulo: 'Confirmar Pago',
    subtitulo: 'Elige el medio de pago. Con efectivo se calcula el vuelto; con Mixto puedes repartir el total entre varios medios.',
    total,
    textoConfirmar: 'Confirmar Venta',
    pedirEntrega: true,   // punto 3: tras el DTE se pregunta retiro/despacho
    onConfirmar: (metodo, datos) => confirmarVenta(metodo, datos)
  });
}

async function confirmarVenta(metodoPago, datosPago = {}) {
  // Hora: la actual del sistema, salvo que el usuario marque "Editar hora"
  const horaPersonalizada = (elPosEditarHora && elPosEditarHora.checked && elPosHora?.value)
    ? elPosHora.value
    : horaActualCorta();

  // El backend calcula total, costo_total y utilidad a partir de los ítems,
  // y deja la venta en PENDIENTE si el método es "Por Pagar".
  const descuento = obtenerDescuentoActual();

  /* Clave de cobro (sql/50): la misma en todos los reintentos de este
     carrito, así un corte de Supabase nunca duplica la venta ni descuenta
     el stock dos veces. Se renueva recién cuando la venta queda registrada. */
  if (!claveCobroEnCurso) {
    claveCobroEnCurso = (window.crypto && typeof window.crypto.randomUUID === 'function')
      ? window.crypto.randomUUID()
      : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
  }

  const venta = await API.ventas.crear({
    clave_idempotencia: claveCobroEnCurso,
    fecha: elPosFecha?.value || todayISO(),
    hora: horaPersonalizada,
    tipo_dte: datosPago.tipoDte || 'SIN DTE',
    cliente: elPosCliente?.value.trim() || null,
    cliente_telefono: elPosClienteTelefono?.value.trim() || null,
    metodo_pago: metodoPago,
    // Descuento sobre el TOTAL de la venta (no por ítem) — el monto real
    // siempre lo vuelve a calcular el servidor, ver calcularDescuentoMonto().
    descuento_tipo: descuento.tipo,
    descuento_valor: descuento.valor,
    /* Desglose del pago mixto. Va solo si el usuario eligió "Mixto"; el
       backend lo revalida contra el total y calcula la comisión sobre
       cada parte con tarjeta por separado. */
    pagos: datosPago.pagos || null,
    // Vincula la venta al turno de caja abierto, para el arqueo (punto 4)
    caja_id: (typeof cajaActivaActual !== 'undefined' && cajaActivaActual) ? cajaActivaActual.id : null,
    /* Datos de entrega (punto 3): retiro/despacho, dirección, notas,
       origen del pago y comisión de pasarela. El backend los normaliza
       (retiro → entregado, despacho → pendiente de envío). */
    ...(datosPago.entrega || {}),
    // El backend descuenta el stock (comercial e interno) recién aquí
    /* Las ventas ya NO se vinculan a una Orden de Trabajo. Las OT viven
       en su propio módulo; mezclarlas con la venta obligaba a mantener
       dos fuentes de verdad del mismo cobro. */
    items: cart
  });

  ultimaVentaRegistrada = venta;
  claveCobroEnCurso = null;
  showToast(venta.estado === 'PENDIENTE' ? 'Venta registrada como PENDIENTE de pago'
    : venta.ya_registrada ? 'La venta ya había quedado registrada: no se duplicó' : 'Venta registrada con éxito', 'ok');
  // El envío nunca anula la venta; si algo de su registro falló, se avisa aparte
  if (venta.envio_aviso) setTimeout(() => showToast(venta.envio_aviso, 'err'), 1500);

  cart = [];
  ultimoAgregado = null;
  mostrarVistaPrevia(null);
  if (elPosDescuentoValor) elPosDescuentoValor.value = '';
  descuentoTipo = 'MONTO';
  actualizarBotonesDescuentoTipo();
  renderCart();
  limpiarFormularioItem();

  /* Si la venta venía de una división, el resto vuelve al carrito en vez
     de quedar vacío: la parte 2 se cobra como una venta aparte, con su
     propio documento tributario. */
  const hayParte2 = continuarDivisionSiCorresponde();
  /* Ya no se llama desvincularOT(): esa función desapareció junto con el
     vínculo OT↔venta. Dejarla invocada lanzaba un ReferenceError JUSTO
     después de registrar la venta, así que la venta se guardaba pero el
     carrito no se limpiaba y el modal de éxito nunca aparecía. */
  if (elPosCliente) elPosCliente.value = '';
  if (elPosClienteTelefono) elPosClienteTelefono.value = '';
  if (elPosEditarHora) elPosEditarHora.checked = false;
  if (elPosHora) { elPosHora.value = ''; elPosHora.disabled = true; }

  mostrarModalVentaExitosa(venta, datosPago, hayParte2);

  // La impresión ya NO es automática: el modal ofrece "Cerrar" o
  // "Imprimir Ticket". El vuelto solo se muestra en pantalla.

  if (typeof cargarHistorial === 'function') cargarHistorial();
  if (typeof cargarProductos === 'function') cargarProductos(true);   // la venta descontó stock
}

function mostrarModalVentaExitosa(venta, datosPago = {}, hayParte2 = false) {
  /* Con una venta dividida, el modal avisa que falta cobrar la parte 2:
     sin eso es fácil imprimir el ticket, cerrar y olvidarse. */
  const avisoParte2 = document.getElementById('ventaExitosaParte2');
  if (avisoParte2) avisoParte2.style.display = hayParte2 ? '' : 'none';

  const pendiente = venta.estado === 'PENDIENTE';

  if (elVentaExitosaDetalle) {
    const numero = String(venta.numero_orden ?? venta.id).padStart(5, '0');
    elVentaExitosaDetalle.innerHTML = `Orden <b>#${numero}</b> · Total <b>${fmtCLP(venta.total)}</b><br>
      <span style="color:var(--text-muted); font-size:13px;">${venta.metodo_pago} · ${venta.fecha}${venta.hora ? ' ' + venta.hora : ''}</span>
      ${pendiente ? '<br><span class="badge badge-red" style="margin-top:8px; display:inline-block;">PENDIENTE DE PAGO</span>' : ''}`;
  }

  // Vuelto: visible solo en pantalla, nunca en el ticket
  const hayVuelto = Number(datosPago.vuelto) > 0;
  if (elVentaExitosaVuelto) elVentaExitosaVuelto.style.display = hayVuelto ? 'flex' : 'none';
  if (hayVuelto && elVentaExitosaVueltoMonto) elVentaExitosaVueltoMonto.textContent = fmtCLP(datosPago.vuelto);

  if (elVentaExitosaAviso) {
    elVentaExitosaAviso.textContent = pendiente
      ? 'No suma a los totales hasta que la cobres desde el Historial.'
      : '¿Deseas imprimir el ticket de 58 mm de esta venta?';
  }

  if (elModalVentaExitosa) elModalVentaExitosa.classList.add('show');

  /* Foco en "Cerrar" al abrir: la venta ya está registrada, así que lo
     único que queda es cerrar. Con el foco puesto, Enter o Espacio lo
     hacen sin mover la mano al mouse — importante con cola en caja. */
  setTimeout(() => {
    const cerrar = document.getElementById('btnCloseVentaExitosa');
    if (cerrar) cerrar.focus();
  }, 120);
}

function cerrarModalVentaExitosa() {
  if (elModalVentaExitosa) elModalVentaExitosa.classList.remove('show');
}
