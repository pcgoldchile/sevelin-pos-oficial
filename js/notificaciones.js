/* ============================================================
   NOTIFICACIONES DEL HEADER — pedidos web que necesitan atención
   ------------------------------------------------------------
   Junta en un solo contador los pedidos en PAGADO (recién pagados, por
   preparar) y ERROR_STOCK_SIN_DESPACHO (pagados pero sin stock para
   despachar — carrera entre dos checkouts casi simultáneos de la última
   unidad, ver POST /api/flow-webhook en sevelin-tienda). Ambos viven en
   pedidos_web (Supabase de la tienda), leídos en vivo vía GET
   /api/pos/pedidos-web — no existe una tabla de notificaciones aparte,
   así que no hay nada que marcar como "leído": el contador baja solo en
   cuanto el pedido se gestiona (pasa a PREPARANDO/CANCELADO/etc.).

   Solo para admin: el botón tiene la clase admin-only (se oculta solo
   para el rol trabajador) y el panel "Pedidos Web" al que lleva ya es
   admin-only (ver index.html, nav-btn "🌐 Página Web").
   ============================================================ */

const ESTADOS_NOTIFICACION_PEDIDOS_WEB = 'PAGADO,ERROR_STOCK_SIN_DESPACHO';
const INTERVALO_NOTIFICACIONES_MS = 60 * 1000;

const elBtnNotificaciones = document.getElementById('btnNotificaciones');
const elBadgeNotificaciones = document.getElementById('badgeNotificaciones');

let intervaloNotificaciones = null;

document.addEventListener('DOMContentLoaded', () => {
  if (elBtnNotificaciones) {
    elBtnNotificaciones.addEventListener('click', () => {
      if (typeof activarVista === 'function') activarVista('view-pagina-web', 'pedidos');
    });
  }
});

/* Arranca (o reinicia) el sondeo apenas hay sesión — mismo momento en que
   el resto de los módulos empiezan a cargar sus datos. Un trabajador
   nunca ve el botón (admin-only) ni gasta llamadas al servidor por él. */
document.addEventListener('pos:sesion-iniciada', () => {
  if (intervaloNotificaciones) { clearInterval(intervaloNotificaciones); intervaloNotificaciones = null; }
  if (!esAdmin()) return;

  actualizarNotificaciones();
  intervaloNotificaciones = setInterval(actualizarNotificaciones, INTERVALO_NOTIFICACIONES_MS);
});

async function actualizarNotificaciones() {
  if (!elBadgeNotificaciones || !tokenActual() || !esAdmin()) return;

  try {
    const pedidos = await API.pedidosWeb.listar(ESTADOS_NOTIFICACION_PEDIDOS_WEB);
    const cantidad = Array.isArray(pedidos) ? pedidos.length : 0;
    elBadgeNotificaciones.textContent = `(${cantidad})`;
    elBtnNotificaciones?.classList.toggle('tiene-pendientes', cantidad > 0);
  } catch (err) {
    // Silencioso a propósito (mismo criterio que verificarBackend()): un
    // fallo puntual de este sondeo cada 60s no debe interrumpir al
    // administrador con un toast — se reintenta solo en el próximo ciclo.
    console.error('Error al actualizar notificaciones:', err.message || err);
  }
}

/* ============================================================
   RECORDATORIO DEL F29 (sql/49)
   ------------------------------------------------------------
   Un botón en el header, al lado de la campana, que solo aparece si hay
   un período del F29 sin marcar como presentado. El color sube con la
   urgencia: gris (más de 7 días), ámbar (7 o menos), rojo con pulso (2 o
   menos, o atrasado). Al hacer clic abre el modal para marcarlo.

   El estado cambia una vez al día, así que se consulta al iniciar sesión
   y cada 30 minutos — no en el ciclo de 60s de los pedidos web.
   ============================================================ */

const INTERVALO_F29_MS = 30 * 60 * 1000;
let intervaloF29 = null;
let f29PendienteActual = null;   // el período más antiguo sin presentar

document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('btnF29')?.addEventListener('click', abrirModalF29);
  document.getElementById('btnCancelarF29')?.addEventListener('click', () => cerrarModal('modalF29'));
  document.getElementById('btnConfirmarF29')?.addEventListener('click', confirmarF29Presentado);
  document.getElementById('f29RegistrarGasto')?.addEventListener('change', actualizarCamposF29);
  document.getElementById('f29Monto')?.addEventListener('input', actualizarCamposF29);
});

document.addEventListener('pos:sesion-iniciada', () => {
  if (intervaloF29) { clearInterval(intervaloF29); intervaloF29 = null; }
  const btn = document.getElementById('btnF29');
  if (!esAdmin()) { if (btn) btn.hidden = true; return; }

  actualizarRecordatorioF29();
  intervaloF29 = setInterval(actualizarRecordatorioF29, INTERVALO_F29_MS);
});

/* "vence lun 21-09 · en 8 días" — la fecha se arma a mano desde el ISO
   (new Date('2026-09-21') se leería como UTC y podría mostrar el 20). */
function textoVencimientoF29(p) {
  const [a, m, d] = String(p.vence).split('-').map(Number);
  const dias = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb'];
  const dow = dias[new Date(Date.UTC(a, m - 1, d)).getUTCDay()];
  const fecha = `${dow} ${String(d).padStart(2, '0')}-${String(m).padStart(2, '0')}`;
  const n = Number(p.diasRestantes);
  const cuando = n < 0 ? `atrasado ${Math.abs(n)} día(s)` : n === 0 ? 'vence HOY' : n === 1 ? 'mañana' : `en ${n} días`;
  return { fecha, cuando };
}

async function actualizarRecordatorioF29() {
  const btn = document.getElementById('btnF29');
  const texto = document.getElementById('textoF29');
  if (!btn || !texto || !tokenActual() || !esAdmin()) return;

  try {
    const estado = await API.balance.f29Estado();
    const pendientes = Array.isArray(estado?.pendientes) ? estado.pendientes : [];
    f29PendienteActual = pendientes[0] || null;

    if (!f29PendienteActual) { btn.hidden = true; return; }

    const { fecha, cuando } = textoVencimientoF29(f29PendienteActual);
    const extra = pendientes.length > 1 ? ` (+${pendientes.length - 1})` : '';
    texto.textContent = `F29 ${f29PendienteActual.nombre}: ${cuando}${extra}`;
    btn.title = `F29 de ${f29PendienteActual.nombre} sin marcar como presentado · vence ${fecha}`;
    btn.classList.remove('f29-pronto', 'f29-urgente', 'f29-atrasado');
    if (f29PendienteActual.nivel !== 'normal') btn.classList.add(`f29-${f29PendienteActual.nivel}`);
    btn.hidden = false;
  } catch (err) {
    // Mismo criterio que la campana: un fallo puntual no interrumpe con un toast
    console.error('Error al revisar el F29:', err.message || err);
  }
}

function actualizarCamposF29() {
  const monto = Number(document.getElementById('f29Monto')?.value) || 0;
  const registrar = !!document.getElementById('f29RegistrarGasto')?.checked;
  const metodo = document.getElementById('f29Metodo');
  if (metodo) metodo.disabled = !(registrar && monto > 0);
}

function abrirModalF29() {
  if (!f29PendienteActual) return;
  const { fecha, cuando } = textoVencimientoF29(f29PendienteActual);
  const resumen = document.getElementById('f29Resumen');
  if (resumen) resumen.textContent = `Período ${f29PendienteActual.nombre} · vence ${fecha} (${cuando}).`;

  const monto = document.getElementById('f29Monto');
  if (monto) monto.value = '';
  const remanente = document.getElementById('f29Remanente');
  if (remanente) remanente.value = '';
  const chk = document.getElementById('f29RegistrarGasto');
  if (chk) chk.checked = true;
  const metodo = document.getElementById('f29Metodo');
  if (metodo) metodo.value = 'Transferencia';
  actualizarCamposF29();

  document.getElementById('modalF29')?.classList.add('show');
  setTimeout(() => monto?.focus(), 80);
}

async function confirmarF29Presentado() {
  if (!f29PendienteActual) return;
  const monto = Number(document.getElementById('f29Monto')?.value) || 0;
  if (monto < 0) { showToast('El monto no puede ser negativo', 'err'); return; }

  const btn = document.getElementById('btnConfirmarF29');
  if (btn) btn.disabled = true;
  try {
    const registrar = !!document.getElementById('f29RegistrarGasto')?.checked && monto > 0;
    await API.balance.f29Marcar({
      periodo: f29PendienteActual.periodo,
      monto_pagado: monto,
      registrar_gasto: registrar,
      metodo_pago: document.getElementById('f29Metodo')?.value || 'Transferencia',
      // Código 77 (sql/51): vacío = no se toca el remanente guardado
      remanente_siguiente: (document.getElementById('f29Remanente')?.value || '').trim() || null
    });
    showToast(registrar
      ? `F29 de ${f29PendienteActual.nombre} marcado y pago de ${fmtCLP(monto)} registrado en Gastos`
      : `F29 de ${f29PendienteActual.nombre} marcado como presentado`, 'ok');
    cerrarModal('modalF29');
    await actualizarRecordatorioF29();
    if (registrar && typeof cargarCompras === 'function') cargarCompras();
  } catch (err) {
    showToast(err.message || 'No se pudo marcar el F29', 'err');
  } finally {
    if (btn) btn.disabled = false;
  }
}

/* ============================================================
   PRODUCTOS AGOTADOS: QUÉ HACER CON CADA UNO (sql/55)
   ------------------------------------------------------------
   Un producto que llega a stock 0 hoy se queda callado y deja de
   venderse sin que nadie lo note. Este botón aparece en el header solo
   si hay agotados sin decidir, y el modal ofrece las cuatro salidas que
   ya existen en el sistema:

     · Por llegar  → productos.por_llegar (sql/42): se puede reservar
                     pagando el 100% y la tienda avisa cuando llega.
     · Encargo     → productos.es_pedido_encargo (sql/30): se vende sin
                     stock, con abono.
     · Archivar    → productos.archivado (sql/32): sale del catálogo y de
                     la tienda, sin borrarse ni perder su historial.
     · Dejarlo     → no cambia nada, pero se GUARDA la decisión para no
                     volver a preguntar por ese producto.

   REGLA DEL DUEÑO: nada se mueve solo. El POS detecta y pregunta; el
   cambio lo aplica el servidor recién con la decisión aprobada.

   Se consulta cada 30 minutos, igual que el F29: un producto no se
   agota cada minuto y no vale la pena gastar llamadas en eso.
   ============================================================ */

const INTERVALO_AGOTADOS_MS = 30 * 60 * 1000;
let intervaloAgotados = null;
let agotadosPendientes = [];
let agotadosDias = 90;

document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('btnAgotados')?.addEventListener('click', abrirModalAgotados);
  document.getElementById('btnCerrarAgotados')?.addEventListener('click', () => cerrarModal('modalAgotados'));

  /* Clic delegado: la lista se vuelve a pintar entera después de cada
     decisión, así que enganchar botón por botón se perdería en el
     siguiente render (mismo criterio que el visor de imagen). */
  document.getElementById('agotadosLista')?.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-agotado-decision]');
    if (!btn) return;
    const id = Number(btn.dataset.agotadoId);
    const decision = btn.dataset.agotadoDecision;
    if (decision === 'por_llegar' && !btn.dataset.confirmado) {
      mostrarCamposPorLlegar(id);
      return;
    }
    decidirAgotado(id, decision);
  });
});

document.addEventListener('pos:sesion-iniciada', () => {
  if (intervaloAgotados) { clearInterval(intervaloAgotados); intervaloAgotados = null; }
  const btn = document.getElementById('btnAgotados');
  if (!esAdmin()) { if (btn) btn.hidden = true; return; }

  actualizarAvisoAgotados();
  intervaloAgotados = setInterval(actualizarAvisoAgotados, INTERVALO_AGOTADOS_MS);
});

async function actualizarAvisoAgotados() {
  const btn = document.getElementById('btnAgotados');
  const texto = document.getElementById('textoAgotados');
  if (!btn || !texto || !tokenActual() || !esAdmin()) return;

  try {
    const datos = await API.productos.agotados();
    agotadosPendientes = Array.isArray(datos?.pendientes) ? datos.pendientes : [];
    agotadosDias = Number(datos?.dias) || 90;

    if (agotadosPendientes.length === 0) { btn.hidden = true; return; }
    texto.textContent = `${agotadosPendientes.length} agotado${agotadosPendientes.length === 1 ? '' : 's'}`;
    btn.title = 'Productos en stock 0 esperando que decidas qué hacer con ellos';
    btn.hidden = false;
    if (document.getElementById('modalAgotados')?.classList.contains('show')) pintarListaAgotados();
  } catch (err) {
    // Mismo criterio que la campana y el F29: un fallo puntual del sondeo
    // no interrumpe al administrador con un toast.
    console.error('Error al revisar los productos agotados:', err.message || err);
  }
}

function abrirModalAgotados() {
  if (!agotadosPendientes.length) return;
  pintarListaAgotados();
  document.getElementById('modalAgotados')?.classList.add('show');
}

/* "vendió 8 en 90 días · última el 12-09" — sin esto la decisión se toma
   a ciegas: no es lo mismo que se agote algo que vendía 8 al mes que algo
   que vendió 1 en todo el año. */
function resumenVentasAgotado(p) {
  const u = Number(p.unidades_vendidas) || 0;
  if (u === 0) {
    return `Sin ventas en los últimos ${agotadosDias} días — se agotó hace rato y nadie lo pidió.`;
  }
  const ultima = p.ultima_venta ? ` · última el ${String(p.ultima_venta).slice(0, 10).split('-').reverse().join('-')}` : '';
  const ritmo = u / (agotadosDias / 30);
  return `Vendió ${u} unidad${u === 1 ? '' : 'es'} en ${agotadosDias} días (${ritmo.toFixed(1)} al mes)${ultima}`;
}

function pintarListaAgotados() {
  const cont = document.getElementById('agotadosLista');
  const resumen = document.getElementById('agotadosResumen');
  if (!cont) return;

  if (resumen) {
    resumen.textContent = agotadosPendientes.length
      ? `${agotadosPendientes.length} producto(s) en stock 0 esperando tu decisión. Nada cambia hasta que elijas.`
      : 'No queda ningún agotado por decidir.';
  }

  if (!agotadosPendientes.length) {
    cont.innerHTML = '<p class="modal-hint">Nada pendiente por acá.</p>';
    return;
  }

  cont.innerHTML = agotadosPendientes.map(p => `
    <div class="agotado-fila" data-fila-agotado="${p.id}">
      <div class="agotado-cabecera">
        ${miniaturaProducto({ imagen_urls: p.imagen_url ? [p.imagen_url] : [], nombre: p.nombre }, 56, { ampliable: true })}
        <div class="agotado-datos">
          <strong>${escHtml(p.nombre)}</strong>
          ${p.sku ? `<small>SKU ${escHtml(p.sku)}</small>` : ''}
          <small>${escHtml(resumenVentasAgotado(p))}</small>
          <small>Deja ${fmtCLP(p.margen)} por unidad (costo ${fmtCLP(p.costo_unitario)} · precio ${fmtCLP(p.precio_unitario)})</small>
        </div>
      </div>
      <div class="agotado-campos" id="agotadoCampos-${p.id}" style="display:none;">
        <label>¿Cuántas vienen?</label>
        <input type="number" id="agotadoUnidades-${p.id}" min="0" step="1" placeholder="Ej: 5" inputmode="numeric">
        <label>¿Cuándo llegan?</label>
        <input type="date" id="agotadoFecha-${p.id}">
        <button class="btn btn-blue btn-sm" data-agotado-decision="por_llegar" data-agotado-id="${p.id}" data-confirmado="1">Confirmar</button>
      </div>
      <div class="agotado-acciones">
        <button class="btn btn-outline btn-sm" data-agotado-decision="por_llegar" data-agotado-id="${p.id}">🚚 Por llegar</button>
        <button class="btn btn-outline btn-sm" data-agotado-decision="encargo" data-agotado-id="${p.id}">📝 Por encargo</button>
        <button class="btn btn-outline btn-sm" data-agotado-decision="archivar" data-agotado-id="${p.id}">🗄️ Archivar</button>
        <button class="btn btn-ghost btn-sm" data-agotado-decision="dejar" data-agotado-id="${p.id}">Dejarlo como está</button>
      </div>
    </div>
  `).join('');
}

/* "Por llegar" es la única salida que pide datos extra: cuántas vienen
   (es el tope de lo que se puede reservar, sql/44) y cuándo. Las dos son
   opcionales — se puede confirmar sin llenarlas. */
function mostrarCamposPorLlegar(id) {
  const campos = document.getElementById(`agotadoCampos-${id}`);
  if (campos) campos.style.display = campos.style.display === 'none' ? 'flex' : 'none';
}

async function decidirAgotado(id, decision) {
  const fila = document.querySelector(`[data-fila-agotado="${id}"]`);
  fila?.querySelectorAll('button').forEach(b => { b.disabled = true; });
  try {
    const datos = { decision };
    if (decision === 'por_llegar') {
      const u = Number(document.getElementById(`agotadoUnidades-${id}`)?.value) || 0;
      if (u > 0) datos.stock_por_llegar = u;
      const f = (document.getElementById(`agotadoFecha-${id}`)?.value || '').trim();
      if (f) datos.fecha_llegada_estimada = f;
    }
    await API.productos.decidirAgotado(id, datos);

    const nombres = { por_llegar: 'marcado "por llegar"', encargo: 'pasado a encargo', archivar: 'archivado', dejar: 'dejado como está' };
    showToast(`Producto ${nombres[decision] || 'actualizado'}`, 'ok');

    agotadosPendientes = agotadosPendientes.filter(p => Number(p.id) !== Number(id));
    pintarListaAgotados();
    const btn = document.getElementById('btnAgotados');
    const texto = document.getElementById('textoAgotados');
    if (agotadosPendientes.length === 0) {
      if (btn) btn.hidden = true;
      cerrarModal('modalAgotados');
    } else if (texto) {
      texto.textContent = `${agotadosPendientes.length} agotado${agotadosPendientes.length === 1 ? '' : 's'}`;
    }

    // El catálogo cambió: se recarga para que el POS y la tabla de
    // productos no sigan mostrando el estado viejo.
    if (typeof cargarProductos === 'function') cargarProductos();
  } catch (err) {
    showToast(err.message || 'No se pudo aplicar la decisión', 'err');
    fila?.querySelectorAll('button').forEach(b => { b.disabled = false; });
  }
}
