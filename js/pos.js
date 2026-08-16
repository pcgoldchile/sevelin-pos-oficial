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
/* Contenedores de los campos que solo aparecen al marcar su casilla.
   Se ocultan por defecto para no gastar espacio en algo que casi nunca
   se usa: la hora manual es la excepción, no la regla. */
const elGrupoPosHora = document.getElementById('grupoPosHora');
const elGrupoItemSN = document.getElementById('grupoItemSN');
const elPosHora = document.getElementById('posHora');
const elPosCliente = document.getElementById('posCliente');
const elCartTableBody = document.getElementById('cartTableBody');
const elCartTotalText = document.getElementById('cartTotalText');
const elBtnFinalizarVenta = document.getElementById('btnFinalizarVenta');
const elBtnLimpiarSeleccion = document.getElementById('btnLimpiarSeleccion');

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

  elSugerencias.innerHTML = encontrados.map((p, i) => `
    <div class="suggestion-item" data-id="${p.id}" data-atajo="Alt+${i + 1}">
      <span>${escHtml(p.nombre)}</span>
      <span>${fmtCLP(p.precio_unitario)} · Stock: ${p.stock ?? 0}</span>
    </div>
  `).join('');
  elSugerencias.classList.add('show');

  // Reinicia la marca de navegación con ↑ / ↓ (js/atajos.js)
  if (typeof sugerenciaActiva !== 'undefined') sugerenciaActiva = -1;

  elSugerencias.querySelectorAll('.suggestion-item').forEach(item => {
    item.addEventListener('click', () => {
      const producto = productsList.find(p => String(p.id) === item.dataset.id);
      if (producto) seleccionarProductoCatalogo(producto);
      elSugerencias.classList.remove('show');
      elBuscarProducto.value = '';
    });
  });
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

  if (elCheckSN) {
    elCheckSN.checked = !!producto.requiere_sn;
    alternarCampoSN(elCheckSN.checked);
  }

  actualizarUtilidadPreview();

  /* Alta directa al carrito en modo rápido.
     Excepciones que NO se agregan solas:
       · productos con requiere_sn → falta la serie
       · llamadas marcadas con `sinAutoAgregar` (el escáner ya maneja
         su propio flujo y agregaría dos veces) */
  if (!modoEdicion && !opciones.sinAutoAgregar && !producto.requiere_sn) {
    agregarItemAlCarrito();
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

    // Producto con S/N: se pide la serie antes de agregarlo
    if (producto.requiere_sn) {
      alternarCampoSN(true);
      if (elItemSN) { elItemSN.value = ''; setTimeout(() => elItemSN.focus(), 60); }
      showToast(`${producto.nombre}: ingresa el S/N para agregarlo`, '');
      return;
    }

    /* Si el mismo producto ya está en el carrito, se le suma 1 en vez de
       repetir la línea: escanear tres veces el mismo artículo debe dar
       "x3", no tres filas iguales. */
    const yaEnCarrito = cart.find(i =>
      i.producto_id && producto.id && i.producto_id === producto.id && !i.serial_number
    );

    if (yaEnCarrito) {
      yaEnCarrito.cantidad += 1;
      yaEnCarrito.subtotal = yaEnCarrito.precio_unitario * yaEnCarrito.cantidad;
      renderCart();
      limpiarFormularioItem();
      showToast(`${producto.nombre} x${yaEnCarrito.cantidad}`, 'ok');
    } else {
      agregarItemAlCarrito();
    }
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
        <td>${escHtml(item.nombre)}
          ${item.serial_number ? '<br><small style="color:var(--text-muted);">S/N: ' + escHtml(item.serial_number) + '</small>' : ''}</td>
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
    subtitulo: 'Elige el medio de pago. Con efectivo se calcula el vuelto; con Mixto puedes repartir el total entre varios medios.',
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
    /* Desglose del pago mixto. Va solo si el usuario eligió "Mixto"; el
       backend lo revalida contra el total y calcula la comisión sobre
       cada parte con tarjeta por separado. */
    pagos: datosPago.pagos || null,
    // El backend descuenta el stock (comercial e interno) recién aquí
    /* Las ventas ya NO se vinculan a una Orden de Trabajo. Las OT viven
       en su propio módulo; mezclarlas con la venta obligaba a mantener
       dos fuentes de verdad del mismo cobro. */
    items: cart
  });

  ultimaVentaRegistrada = venta;
  showToast(venta.estado === 'PENDIENTE' ? 'Venta registrada como PENDIENTE de pago' : 'Venta registrada con éxito', 'ok');

  cart = [];
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
