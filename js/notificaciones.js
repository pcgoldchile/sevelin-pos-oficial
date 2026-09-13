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
      metodo_pago: document.getElementById('f29Metodo')?.value || 'Transferencia'
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
