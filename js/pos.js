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
let otVinculadaVenta = null;   // OT que se está cobrando en esta venta

const elBuscarProducto = document.getElementById('posBuscarProducto');
const elSugerencias = document.getElementById('posSugerencias');
const elItemNombre = document.getElementById('itemNombre');
const elItemCantidad = document.getElementById('itemCantidad');
const elItemCosto = document.getElementById('itemCosto');
const elItemPrecio = document.getElementById('itemPrecio');
const elCheckSN = document.getElementById('checkTieneSN');
const elItemSN = document.getElementById('itemSN');
const elUtilidadPreview = document.getElementById('utilidadPreview');
const elBtnAgregarItem = document.getElementById('btnAgregarItem');
const elPosFecha = document.getElementById('posFecha');
const elPosEditarHora = document.getElementById('posEditarHora');
const elPosHora = document.getElementById('posHora');
const elPosCliente = document.getElementById('posCliente');
const elCartTableBody = document.getElementById('cartTableBody');
const elCartTotalText = document.getElementById('cartTotalText');
const elBtnFinalizarVenta = document.getElementById('btnFinalizarVenta');
const elBtnLimpiarSeleccion = document.getElementById('btnLimpiarSeleccion');
const elPosSincronizarOT = document.getElementById('posSincronizarOT');
const elPosBuscarOT = document.getElementById('posBuscarOT');
const elPosSugerenciasOT = document.getElementById('posSugerenciasOT');
const elPosOTVinculada = document.getElementById('posOTVinculada');

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
      if (elSugerencias && e.target !== elBuscarProducto && !elSugerencias.contains(e.target)) {
        elSugerencias.classList.remove('show');
      }
    });
  }

  if (elCheckSN) {
    elCheckSN.addEventListener('change', () => {
      if (elItemSN) {
        elItemSN.style.display = elCheckSN.checked ? 'block' : 'none';
        if (!elCheckSN.checked) elItemSN.value = '';
      }
    });
  }

  [elItemCantidad, elItemCosto, elItemPrecio].forEach(el => {
    if (el) el.addEventListener('input', actualizarUtilidadPreview);
  });

  if (elBtnAgregarItem) elBtnAgregarItem.addEventListener('click', agregarItemAlCarrito);
  if (elBtnFinalizarVenta) elBtnFinalizarVenta.addEventListener('click', abrirModalPago);

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

  // Hora personalizada: por defecto se usa la hora actual del sistema
  if (elPosEditarHora) elPosEditarHora.addEventListener('change', () => {
    if (!elPosHora) return;
    elPosHora.disabled = !elPosEditarHora.checked;
    if (elPosEditarHora.checked) {
      if (!elPosHora.value) elPosHora.value = horaActualCorta();
      elPosHora.focus();
    }
  });

  // Vinculación manual de una OT a la venta en curso
  if (elPosSincronizarOT) elPosSincronizarOT.addEventListener('change', () => {
    if (elPosBuscarOT) {
      elPosBuscarOT.disabled = !elPosSincronizarOT.checked;
      if (elPosSincronizarOT.checked) elPosBuscarOT.focus();
    }
    if (!elPosSincronizarOT.checked) desvincularOT();
  });

  if (elPosBuscarOT) {
    elPosBuscarOT.addEventListener('input', buscarOTParaVenta);
    document.addEventListener('click', (e) => {
      if (elPosSugerenciasOT && e.target !== elPosBuscarOT && !elPosSugerenciasOT.contains(e.target)) {
        elPosSugerenciasOT.classList.remove('show');
      }
    });
  }

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

  const encontrados = productsList.filter(p =>
    (p.nombre || '').toLowerCase().includes(q) ||
    (p.sku || '').toLowerCase().includes(q) ||
    (p.codigo_barras || '').toLowerCase().includes(q)
  ).slice(0, 8);

  if (encontrados.length === 0) {
    elSugerencias.classList.remove('show');
    elSugerencias.innerHTML = '';
    return;
  }

  elSugerencias.innerHTML = encontrados.map(p => `
    <div class="suggestion-item" data-id="${p.id}">
      <span>${p.nombre}</span>
      <span>${fmtCLP(p.precio_unitario)} · Stock: ${p.stock ?? 0}</span>
    </div>
  `).join('');
  elSugerencias.classList.add('show');

  elSugerencias.querySelectorAll('.suggestion-item').forEach(item => {
    item.addEventListener('click', () => {
      const producto = productsList.find(p => String(p.id) === item.dataset.id);
      if (producto) seleccionarProductoCatalogo(producto);
      elSugerencias.classList.remove('show');
      elBuscarProducto.value = '';
    });
  });
}

function seleccionarProductoCatalogo(producto) {
  productoSeleccionado = producto;
  if (elItemNombre) elItemNombre.value = producto.nombre || '';
  // El trabajador no ve costos: el backend los completa desde el catálogo
  if (elItemCosto && esAdmin()) elItemCosto.value = producto.costo_unitario || 0;
  if (elItemPrecio) elItemPrecio.value = producto.precio_unitario || 0;
  if (elItemCantidad) elItemCantidad.value = 1;

  if (elCheckSN) {
    elCheckSN.checked = !!producto.requiere_sn;
    if (elItemSN) elItemSN.style.display = elCheckSN.checked ? 'block' : 'none';
  }

  actualizarUtilidadPreview();
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
// Vínculo con una Orden de Trabajo
// ============================================================
async function buscarOTParaVenta() {
  if (!elPosSugerenciasOT) return;
  const q = (elPosBuscarOT.value || '').trim().toLowerCase();

  if (q.length < 2) { elPosSugerenciasOT.classList.remove('show'); return; }

  let ordenes = (typeof ordenesList !== 'undefined' && Array.isArray(ordenesList)) ? ordenesList : [];
  if (ordenes.length === 0) {
    try { ordenes = await API.ot.listar(); } catch (_) { ordenes = []; }
  }

  const encontradas = ordenes.filter(o =>
    (o.numero_ot || '').toLowerCase().includes(q) ||
    (o.cliente_nombre || '').toLowerCase().includes(q) ||
    (o.dispositivo_modelo || '').toLowerCase().includes(q)
  ).slice(0, 8);

  if (encontradas.length === 0) { elPosSugerenciasOT.classList.remove('show'); return; }

  elPosSugerenciasOT.innerHTML = encontradas.map(o => `
    <div class="suggestion-item" data-ot="${o.id}">
      <span>${o.numero_ot} · ${o.cliente_nombre || 'Sin cliente'}</span>
      <span>${o.dispositivo_modelo || ''}</span>
    </div>
  `).join('');
  elPosSugerenciasOT.classList.add('show');

  elPosSugerenciasOT.querySelectorAll('.suggestion-item').forEach(item => {
    item.addEventListener('click', async () => {
      const orden = encontradas.find(o => String(o.id) === item.dataset.ot);
      elPosSugerenciasOT.classList.remove('show');
      if (!orden) return;

      let pendientes = [];
      try {
        const asignados = await API.ot.listarRepuestos(orden.id);
        pendientes = (asignados || []).filter(r => !r.cobrado);
      } catch (_) { pendientes = []; }

      precargarVentaDesdeOT(orden, pendientes);
    });
  });
}

function mostrarOTVinculadaPOS() {
  if (!elPosOTVinculada) return;

  if (!otVinculadaVenta) { elPosOTVinculada.style.display = 'none'; return; }

  elPosOTVinculada.style.display = 'block';
  elPosOTVinculada.innerHTML =
    `Venta vinculada a <b>${otVinculadaVenta.numero_ot}</b> · ${otVinculadaVenta.cliente_nombre || ''} — ` +
    `<a href="#" id="quitarOTVenta">quitar vínculo</a>`;

  const quitar = document.getElementById('quitarOTVenta');
  if (quitar) quitar.addEventListener('click', (e) => { e.preventDefault(); desvincularOT(); });
}

function desvincularOT() {
  otVinculadaVenta = null;
  if (elPosSincronizarOT) elPosSincronizarOT.checked = false;
  if (elPosBuscarOT) { elPosBuscarOT.value = ''; elPosBuscarOT.disabled = true; }
  mostrarOTVinculadaPOS();
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

  if (!nombre) { showToast('Ingresa el nombre del producto', 'err'); return; }
  if (cantidad <= 0) { showToast('La cantidad debe ser mayor a 0', 'err'); return; }
  if (precio <= 0) { showToast('Ingresa el precio de venta', 'err'); return; }
  if (tieneSN && !numeroSerie) { showToast('Ingresa el S/N del producto', 'err'); return; }

  cart.push({
    producto_id: productoSeleccionado ? productoSeleccionado.id : null,
    sku: productoSeleccionado ? (productoSeleccionado.sku || null) : null,
    nombre,
    cantidad,
    costo_unitario: costo,
    precio_unitario: precio,
    subtotal: precio * cantidad,
    serial_number: numeroSerie || null
  });

  renderCart();
  limpiarFormularioItem();
  enfocarBuscador();   // listo para el siguiente escaneo
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
  if (elItemSN) { elItemSN.value = ''; elItemSN.style.display = 'none'; }
  if (elBuscarProducto) elBuscarProducto.value = '';
  productoSeleccionado = null;
  actualizarUtilidadPreview();
}

function renderCart() {
  if (!elCartTableBody) return;

  if (cart.length === 0) {
    elCartTableBody.innerHTML = '<tr class="empty-row"><td colspan="5">El carrito está vacío. Busca un producto o escribe uno manualmente.</td></tr>';
  } else {
    elCartTableBody.innerHTML = cart.map((item, idx) => `
      <tr class="row-in">
        <td>${item.cantidad}</td>
        <td>${item.nombre}
          ${item.serial_number ? '<br><small style="color:var(--text-muted);">S/N: ' + item.serial_number + '</small>' : ''}</td>
        <td>${fmtCLP(item.precio_unitario)}</td>
        <td>${fmtCLP(item.subtotal)}</td>
        <td>
          <div class="cell-actions">
            <button class="btn btn-icon btn-icon-del" data-idx="${idx}" title="Quitar del carrito">${ICO_QUITAR}</button>
          </div>
        </td>
      </tr>
    `).join('');

    elCartTableBody.querySelectorAll('button[data-idx]').forEach(btn => {
      btn.addEventListener('click', () => {
        cart.splice(Number(btn.dataset.idx), 1);
        renderCart();
      });
    });
  }

  const total = cart.reduce((acc, it) => acc + it.subtotal, 0);
  if (elCartTotalText) elCartTotalText.textContent = fmtCLP(total);
}

// ============================================================
// Finalizar venta → método de pago → registro → ticket
// ============================================================
function abrirModalPago() {
  if (cart.length === 0) { showToast('Agrega al menos un producto al carrito', 'err'); return; }

  const total = cart.reduce((acc, it) => acc + it.subtotal, 0);

  abrirSelectorPago({
    titulo: 'Confirmar Pago',
    subtitulo: 'Elige el medio de pago. Con efectivo se calcula el vuelto.',
    total,
    textoConfirmar: 'Confirmar Venta',
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
  const venta = await API.ventas.crear({
    fecha: elPosFecha?.value || todayISO(),
    hora: horaPersonalizada,
    tipo_dte: datosPago.tipoDte || 'SIN DTE',
    cliente: elPosCliente?.value.trim() || null,
    metodo_pago: metodoPago,
    // El backend descuenta el stock (comercial e interno) recién aquí
    ot_id: otVinculadaVenta?.id || null,
    numero_ot: otVinculadaVenta?.numero_ot || null,
    items: cart
  });

  ultimaVentaRegistrada = venta;
  showToast(venta.estado === 'PENDIENTE' ? 'Venta registrada como PENDIENTE de pago' : 'Venta registrada con éxito', 'ok');

  cart = [];
  renderCart();
  limpiarFormularioItem();
  desvincularOT();
  if (elPosCliente) elPosCliente.value = '';
  if (elPosEditarHora) elPosEditarHora.checked = false;
  if (elPosHora) { elPosHora.value = ''; elPosHora.disabled = true; }

  mostrarModalVentaExitosa(venta, datosPago);

  // La impresión ya NO es automática: el modal ofrece "Cerrar" o
  // "Imprimir Ticket". El vuelto solo se muestra en pantalla.

  if (typeof cargarHistorial === 'function') cargarHistorial();
  if (typeof cargarProductos === 'function') cargarProductos();
}

function mostrarModalVentaExitosa(venta, datosPago = {}) {
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
}

/* Precarga el POS con el cobro de una orden de trabajo.
   Vincula la OT a la venta y baja al carrito los repuestos y la mano de
   obra que le fueron asignados y aún no se han cobrado. */
function precargarVentaDesdeOT(ot, itemsAsignados = []) {
  otVinculadaVenta = ot;

  if (elPosSincronizarOT) elPosSincronizarOT.checked = true;
  if (elPosBuscarOT) { elPosBuscarOT.disabled = false; elPosBuscarOT.value = ''; }
  if (elPosCliente) elPosCliente.value = ot.cliente_nombre || '';
  mostrarOTVinculadaPOS();

  /* Los repuestos de la OT NO entran al carrito: el cliente paga el
     servicio, no un desglose de piezas. Su stock se descuenta aparte,
     cuando la orden pasa a ENTREGADO. Aquí solo se deja el campo listo
     para que se escriba el servicio o se busque en el catálogo. */
  limpiarFormularioItem();
  setTimeout(() => elItemNombre?.focus(), 60);

  productoSeleccionado = null;
  renderCart();
  actualizarUtilidadPreview();
}


function cerrarModalVentaExitosa() {
  if (elModalVentaExitosa) elModalVentaExitosa.classList.remove('show');
}
