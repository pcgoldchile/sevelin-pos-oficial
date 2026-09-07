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
