/* ============================================================
   PEDIDOS WEB — panel del POS para el e-commerce (Fase 5)
   ------------------------------------------------------------
   Lee/actualiza pedidos_web del proyecto Supabase WEB de
   sevelin-tienda, a través de dbWeb en api/index.js (GET/PUT
   /api/pos/pedidos-web). Es lectura + cambio de estado de
   despacho — nunca toca CREADO/PAGADO/FALLIDO (los controla el
   webhook de pago de la tienda, no un click de un trabajador).
   Ver README-ECOMMERCE-SEVELIN.md sección 2.1.
   ============================================================ */

let pedidosWebList = [];
let filtroEstadoPedidoWeb = '';
let pedidoWebEditandoId = null;

const elPedidosWebChips = document.getElementById('pedidosWebChips');
const elPedidosWebTableBody = document.getElementById('pedidosWebTableBody');
const elBtnRecargarPedidosWeb = document.getElementById('btnRecargarPedidosWeb');

const elModalPedidoWeb = document.getElementById('modalPedidoWeb');
const elPedidoWebNumero = document.getElementById('pedidoWebNumero');
const elPedidoWebCliente = document.getElementById('pedidoWebCliente');
const elPedidoWebDireccion = document.getElementById('pedidoWebDireccion');
const elPedidoWebItems = document.getElementById('pedidoWebItems');
const elPedidoWebTotales = document.getElementById('pedidoWebTotales');
const elPedidoWebBoleta = document.getElementById('pedidoWebBoleta');
const elPedidoWebBoletaLink = document.getElementById('pedidoWebBoletaLink');
const elPedidoWebEstado = document.getElementById('pedidoWebEstado');
const elPedidoWebTracking = document.getElementById('pedidoWebTracking');
const elBtnCancelarPedidoWeb = document.getElementById('btnCancelarPedidoWeb');
const elBtnGuardarPedidoWeb = document.getElementById('btnGuardarPedidoWeb');

const elModalCancelarPedidoWeb = document.getElementById('modalCancelarPedidoWeb');
const elCancelarPedidoWebTexto = document.getElementById('cancelarPedidoWebTexto');
const elCancelarPedidoWebReponerStock = document.getElementById('cancelarPedidoWebReponerStock');
const elBtnCancelarPedidoWebVolver = document.getElementById('btnCancelarPedidoWebVolver');
const elBtnCancelarPedidoWebConfirmar = document.getElementById('btnCancelarPedidoWebConfirmar');
let pedidoWebIdACancelar = null;

document.addEventListener('DOMContentLoaded', () => {
  setupPedidosWebEventListeners();
});

// La carga ya no se dispara por 'pos:vista-activa' directo: "Pedidos Web"
// pasó a ser la primera sub-pestaña de "Página Web" (ver js/pagina-web.js,
// mostrarPanelPaginaWeb('pedidos') llama cargarPedidosWeb() con el mismo
// criterio de carga perezosa que usaba antes, solo que un nivel más adentro).

function setupPedidosWebEventListeners() {
  if (elBtnRecargarPedidosWeb) elBtnRecargarPedidosWeb.addEventListener('click', cargarPedidosWeb);
  if (elBtnCancelarPedidoWeb) elBtnCancelarPedidoWeb.addEventListener('click', cerrarModalPedidoWeb);
  if (elBtnGuardarPedidoWeb) elBtnGuardarPedidoWeb.addEventListener('click', guardarPedidoWeb);

  if (elPedidosWebChips) {
    elPedidosWebChips.querySelectorAll('.chip').forEach(chip => {
      chip.addEventListener('click', () => {
        filtroEstadoPedidoWeb = chip.dataset.estado || '';
        elPedidosWebChips.querySelectorAll('.chip').forEach(c => c.classList.toggle('active', c === chip));
        cargarPedidosWeb();
      });
    });
  }

  if (elBtnCancelarPedidoWebVolver) elBtnCancelarPedidoWebVolver.addEventListener('click', cerrarModalCancelarPedidoWeb);
  if (elModalCancelarPedidoWeb) {
    elModalCancelarPedidoWeb.addEventListener('click', (e) => {
      if (e.target === elModalCancelarPedidoWeb) cerrarModalCancelarPedidoWeb();
    });
  }
  if (elBtnCancelarPedidoWebConfirmar) elBtnCancelarPedidoWebConfirmar.addEventListener('click', confirmarCancelarPedidoWeb);
}

async function cargarPedidosWeb() {
  if (!tokenActual()) return;

  try {
    pedidosWebList = await API.pedidosWeb.listar(filtroEstadoPedidoWeb);
    renderPedidosWebTabla(pedidosWebList);
  } catch (err) {
    console.error('Error al cargar pedidos web:', err.message || err);
    showToast(err.message || 'No se pudieron cargar los pedidos web', 'err');
  }
}

const ETIQUETAS_ESTADO_PEDIDO_WEB = {
  CREADO:     { txt: '🕓 Creado',       clase: 'badge-soft' },
  PAGADO:     { txt: '💰 Por preparar', clase: 'badge-gold' },
  PREPARANDO: { txt: '📋 Preparando',   clase: 'badge-blue' },
  ENVIADO:    { txt: '🚚 Enviado',      clase: 'badge-blue' },
  ENTREGADO:  { txt: '✅ Entregado',    clase: 'badge-green' },
  CANCELADO:  { txt: '❌ Cancelado',    clase: 'badge-red' },
  FALLIDO:    { txt: '⚠️ Pago fallido', clase: 'badge-red' }
};

function badgeEstadoPedidoWeb(estado) {
  const info = ETIQUETAS_ESTADO_PEDIDO_WEB[estado] || { txt: estado, clase: 'badge-soft' };
  return `<span class="badge ${info.clase}">${info.txt}</span>`;
}

function renderPedidosWebTabla(lista) {
  if (!elPedidosWebTableBody) return;

  if (!lista || lista.length === 0) {
    elPedidosWebTableBody.innerHTML = '<tr class="empty-row"><td colspan="7">No hay pedidos para este filtro.</td></tr>';
    return;
  }

  elPedidosWebTableBody.innerHTML = lista.map(p => {
    // CREADO/FALLIDO: el pago todavía no se confirmó, nada que despachar
    // (lo controla el webhook de pago de sevelin-tienda, no este panel).
    const puedeDespachar = !['CREADO', 'FALLIDO'].includes(p.estado);
    // Cancelar YA era posible desde "Gestionar" (el select ya tenía la
    // opción) pero quedaba escondido a dos clics — este botón es el
    // atajo directo que se pidió. Se esconde si ya está cancelado (nada
    // que cancelar dos veces).
    const puedeCancelar = puedeDespachar && p.estado !== 'CANCELADO';
    const accion = puedeDespachar
      ? `<div class="cell-actions" style="justify-content:flex-end;">
           <button class="btn btn-outline btn-sm" data-pedido-web="${p.id}">Gestionar</button>
           ${puedeCancelar ? `<button class="btn btn-outline btn-sm" style="color:var(--red);border-color:rgba(239,68,68,.4);" data-cancelar-pedido-web="${p.id}">Cancelar</button>` : ''}
         </div>`
      : '<span style="color:var(--text-muted);">—</span>';
    const tracking = p.tracking_courier
      ? `<br><small style="color:var(--text-muted);">${escHtml(p.tracking_courier)}</small>` : '';

    return `<tr>
      <td>${escHtml(p.numero_pedido)}</td>
      <td>${tsAChile(p.creado_en)}</td>
      <td>${escHtml(p.cliente_nombre || '—')}</td>
      <td>${escHtml(p.metodo_envio || '—')}${tracking}</td>
      <td class="num">${fmtCLP(p.total)}</td>
      <td>${badgeEstadoPedidoWeb(p.estado)}</td>
      <td style="text-align:right;">${accion}</td>
    </tr>`;
  }).join('');

  elPedidosWebTableBody.querySelectorAll('[data-pedido-web]').forEach(btn => {
    btn.addEventListener('click', () => abrirModalPedidoWeb(btn.dataset.pedidoWeb));
  });

  elPedidosWebTableBody.querySelectorAll('[data-cancelar-pedido-web]').forEach(btn => {
    btn.addEventListener('click', () => cancelarPedidoWebDirecto(btn.dataset.cancelarPedidoWeb));
  });
}

/* Atajo de un clic desde la tabla — mismo cambio de estado que ya permitía
   "Gestionar" (PUT /api/pos/pedidos-web/:id con estado: 'CANCELADO'), sin
   pasar por el modal completo. Abre un mini-modal en vez de un confirm()
   liso porque hay una decisión real que tomar: si el producto sigue en
   la tienda (nunca se despachó), reponer el stock automáticamente; si ya
   salió, no — el servidor nunca lo asume solo (ver PUT arriba). */
function cancelarPedidoWebDirecto(id) {
  const pedido = pedidosWebList.find(p => String(p.id) === String(id));
  pedidoWebIdACancelar = id;
  if (elCancelarPedidoWebTexto) {
    elCancelarPedidoWebTexto.textContent = `¿Cancelar el pedido ${pedido?.numero_pedido || `#${id}`}? Esta acción no revierte el pago.`;
  }
  if (elCancelarPedidoWebReponerStock) elCancelarPedidoWebReponerStock.checked = false;
  elModalCancelarPedidoWeb?.classList.add('show');
}

function cerrarModalCancelarPedidoWeb() {
  elModalCancelarPedidoWeb?.classList.remove('show');
  pedidoWebIdACancelar = null;
}

async function confirmarCancelarPedidoWeb() {
  if (!pedidoWebIdACancelar) return;
  const id = pedidoWebIdACancelar;
  const pedido = pedidosWebList.find(p => String(p.id) === String(id));
  const numero = pedido?.numero_pedido || `#${id}`;
  const reponerStock = !!(elCancelarPedidoWebReponerStock && elCancelarPedidoWebReponerStock.checked);

  if (elBtnCancelarPedidoWebConfirmar) elBtnCancelarPedidoWebConfirmar.disabled = true;
  try {
    const resultado = await API.pedidosWeb.actualizar(id, { estado: 'CANCELADO', reponer_stock: reponerStock });
    cerrarModalCancelarPedidoWeb();
    showToast(
      reponerStock
        ? (resultado?.stock_repuesto
            ? `Pedido ${numero} cancelado y stock repuesto`
            : `Pedido ${numero} cancelado — no se pudo reponer el stock, revísalo en Productos`)
        : `Pedido ${numero} cancelado`,
      resultado?.stock_repuesto === false && reponerStock ? 'err' : 'ok'
    );
    await cargarPedidosWeb();
  } catch (err) {
    showToast(err.message || 'No se pudo cancelar el pedido', 'err');
  } finally {
    if (elBtnCancelarPedidoWebConfirmar) elBtnCancelarPedidoWebConfirmar.disabled = false;
  }
}

function abrirModalPedidoWeb(id) {
  const pedido = pedidosWebList.find(p => String(p.id) === String(id));
  if (!pedido) return;
  pedidoWebEditandoId = pedido.id;

  if (elPedidoWebNumero) elPedidoWebNumero.textContent = pedido.numero_pedido;
  if (elPedidoWebCliente) {
    elPedidoWebCliente.textContent =
      `${pedido.cliente_nombre || 'Cliente'} · ${pedido.cliente_email || ''} · ${pedido.cliente_telefono || ''}`;
  }

  const d = pedido.direccion_envio || {};
  if (elPedidoWebDireccion) {
    elPedidoWebDireccion.textContent = d.calle
      ? `${d.calle} ${d.numero || ''}, ${d.comuna || ''}${d.referencia ? ' — ' + d.referencia : ''}`
      : 'Sin dirección registrada';
  }

  if (elPedidoWebItems) {
    const items = Array.isArray(pedido.items) ? pedido.items : [];
    elPedidoWebItems.innerHTML = items.map(it =>
      `<li>${escHtml(it.nombre)} × ${it.cantidad} — ${fmtCLP(it.precio_web * it.cantidad)}</li>`
    ).join('') || '<li>Sin ítems</li>';
  }

  if (elPedidoWebTotales) {
    elPedidoWebTotales.textContent =
      `Subtotal ${fmtCLP(pedido.subtotal)} · Envío ${fmtCLP(pedido.costo_envio)} · Total ${fmtCLP(pedido.total)}`;
  }

  if (elPedidoWebBoleta && elPedidoWebBoletaLink) {
    if (pedido.url_boleta_sii) {
      elPedidoWebBoletaLink.href = pedido.url_boleta_sii;
      elPedidoWebBoleta.style.display = '';
    } else {
      elPedidoWebBoleta.style.display = 'none';
    }
  }

  if (elPedidoWebEstado) {
    elPedidoWebEstado.value = ['PREPARANDO', 'ENVIADO', 'ENTREGADO', 'CANCELADO'].includes(pedido.estado)
      ? pedido.estado
      : 'PREPARANDO';
  }
  if (elPedidoWebTracking) elPedidoWebTracking.value = pedido.tracking_courier || '';

  elModalPedidoWeb?.classList.add('show');
}

function cerrarModalPedidoWeb() {
  elModalPedidoWeb?.classList.remove('show');
  pedidoWebEditandoId = null;
}

async function guardarPedidoWeb() {
  if (!pedidoWebEditandoId) return;
  const estado = elPedidoWebEstado?.value || 'PREPARANDO';
  const tracking_courier = (elPedidoWebTracking?.value || '').trim();

  if (elBtnGuardarPedidoWeb) elBtnGuardarPedidoWeb.disabled = true;
  try {
    await API.pedidosWeb.actualizar(pedidoWebEditandoId, { estado, tracking_courier });
    showToast('Pedido actualizado', 'ok');
    cerrarModalPedidoWeb();
    await cargarPedidosWeb();
  } catch (err) {
    showToast(err.message || 'No se pudo actualizar el pedido', 'err');
  } finally {
    if (elBtnGuardarPedidoWeb) elBtnGuardarPedidoWeb.disabled = false;
  }
}
