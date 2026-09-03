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
let filtroTipoPedidoWeb = '';
let pedidoWebEditandoId = null;

const elPedidosWebChips = document.getElementById('pedidosWebChips');
const elPedidosWebTipoChips = document.getElementById('pedidosWebTipoChips');
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

  if (elPedidosWebTipoChips) {
    elPedidosWebTipoChips.querySelectorAll('.chip').forEach(chip => {
      chip.addEventListener('click', () => {
        filtroTipoPedidoWeb = chip.dataset.tipo || '';
        elPedidosWebTipoChips.querySelectorAll('.chip').forEach(c => c.classList.toggle('active', c === chip));
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
    pedidosWebList = await API.pedidosWeb.listar(filtroEstadoPedidoWeb, filtroTipoPedidoWeb);
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
  FALLIDO:    { txt: '⚠️ Pago fallido', clase: 'badge-red' },
  // 24h+ en Creado sin que Flow avisara pago ni fallo — lo pone el cron de
  // limpieza (sevelin-tienda GET /api/cron/expirar-pedidos), no un click
  // acá. Gris, no rojo: no es un error, es un carrito que nunca volvió.
  EXPIRADO:   { txt: '⏳ Expirado',      clase: 'badge-soft' },
  // Pago cobrado de verdad en Flow, pero sin stock para despachar (carrera
  // entre dos checkouts casi simultáneos de la última unidad) — el sistema
  // NUNCA reembolsa ni cancela solo, esto es la señal para revisarlo a
  // mano (ver sevelin-tienda/src/app/api/flow-webhook/route.ts). Rojo a
  // propósito, no naranja: requiere acción, no es un estado de flujo normal.
  ERROR_STOCK_SIN_DESPACHO: { txt: '🚨 Pagado, sin stock — revisar', clase: 'badge-red' }
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
    // CREADO/FALLIDO/EXPIRADO: el pago nunca se confirmó, nada que
    // despachar (lo controla el webhook de pago de sevelin-tienda, no
    // este panel — EXPIRADO lo pone solo el cron de limpieza).
    const puedeDespachar = !['CREADO', 'FALLIDO', 'EXPIRADO'].includes(p.estado);
    // Cancelar YA era posible desde "Gestionar" (el select ya tenía la
    // opción) pero quedaba escondido a dos clics — este botón es el
    // atajo directo que se pidió. Se esconde si ya está cancelado (nada
    // que cancelar dos veces).
    const puedeCancelar = puedeDespachar && p.estado !== 'CANCELADO';
    // Mismo atajo de un clic para el otro cambio de estado más frecuente:
    // marcar como entregado sin abrir "Gestionar". Solo tiene sentido una
    // vez que el pedido ya salió (Preparando/Enviado) — si sigue "Por
    // preparar" (PAGADO) es más fácil equivocarse de un salto.
    const puedeMarcarEntregado = ['PREPARANDO', 'ENVIADO'].includes(p.estado);
    const accion = puedeDespachar
      ? `<div class="cell-actions" style="justify-content:flex-end;">
           <button class="btn btn-outline btn-sm" data-pedido-web="${p.id}">Gestionar</button>
           ${puedeMarcarEntregado ? `<button class="btn btn-outline btn-sm" style="color:var(--green);border-color:rgba(34,197,94,.4);" data-entregar-pedido-web="${p.id}">✅ Entregado</button>` : ''}
           ${puedeCancelar ? `<button class="btn btn-outline btn-sm" style="color:var(--red);border-color:rgba(239,68,68,.4);" data-cancelar-pedido-web="${p.id}">Cancelar</button>` : ''}
         </div>`
      : '<span style="color:var(--text-muted);">—</span>';
    const tracking = p.tracking_courier
      ? `<br><small style="color:var(--text-muted);">${escHtml(p.tracking_courier)}</small>` : '';
    const badgeEncargo = p.tipo_pedido === 'ENCARGO' ? ' <span class="badge badge-gold">📦 Encargo</span>' : '';

    return `<tr>
      <td>${escHtml(p.numero_pedido)}${badgeEncargo}</td>
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

  elPedidosWebTableBody.querySelectorAll('[data-entregar-pedido-web]').forEach(btn => {
    btn.addEventListener('click', () => marcarPedidoWebEntregado(btn.dataset.entregarPedidoWeb, btn));
  });
}

/* Atajo de un clic — mismo cambio de estado que "Gestionar" (PUT
   /api/pos/pedidos-web/:id con estado: 'ENTREGADO'), sin abrir el modal.
   Dispara el correo con el pedido de reseña de Google (ver
   TIENDA_NOTIFICAR_ENTREGA_URL en api/index.js) igual que si se hubiera
   guardado desde el modal — es la misma ruta del backend. */
async function marcarPedidoWebEntregado(id, boton) {
  const pedido = pedidosWebList.find(p => String(p.id) === String(id));
  const numero = pedido?.numero_pedido || `#${id}`;
  if (boton) boton.disabled = true;
  try {
    const resultado = await API.pedidosWeb.actualizar(id, { estado: 'ENTREGADO' });
    showToast(
      `Pedido ${numero} marcado como entregado` + (resultado?.correo_enviado ? ' — cliente notificado por correo' : ''),
      'ok'
    );
    await cargarPedidosWeb();
  } catch (err) {
    showToast(err.message || 'No se pudo marcar el pedido como entregado', 'err');
    if (boton) boton.disabled = false;
  }
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

    const partes = [`Pedido ${numero} cancelado`];
    if (reponerStock) partes.push(resultado?.stock_repuesto ? 'stock repuesto' : 'no se pudo reponer el stock (revísalo en Productos)');
    partes.push(resultado?.correo_enviado ? 'cliente notificado por correo' : 'no se pudo avisar al cliente por correo');
    const huboFalla = (reponerStock && !resultado?.stock_repuesto) || !resultado?.correo_enviado;

    showToast(partes.join(' — '), huboFalla ? 'err' : 'ok');
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
