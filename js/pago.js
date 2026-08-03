// ==========================================
// PAGO.JS - Selector de medio de pago con vuelto
// ------------------------------------------
// Lo usan dos flujos:
//   · POS → finalizar venta (incluye "Por Pagar")
//   · Historial → cobrar una venta pendiente (sin "Por Pagar")
// El vuelto es solo de pantalla: nunca se guarda ni se imprime en el ticket.
// ==========================================

const METODOS_PAGO = [
  { valor: 'Efectivo', icono: '💵' },
  { valor: 'Tarjeta Débito', icono: '💳' },
  { valor: 'Tarjeta Crédito', icono: '🏦' },
  { valor: 'Transferencia', icono: '📲' },
  { valor: 'Por Pagar', icono: '⏳' }
];

let configPago = null;
let metodoPagoElegido = null;
let tipoDteElegido = 'SIN DTE';   // por defecto, como pidió el negocio

const elModalPago = document.getElementById('modalPago');
const elPagoTitulo = document.getElementById('pagoTitulo');
const elPagoSubtitulo = document.getElementById('pagoSubtitulo');
const elPagoTotal = document.getElementById('pagoTotal');
const elPagoMetodos = document.getElementById('pagoMetodos');
const elPagoEfectivoBox = document.getElementById('pagoEfectivoBox');
const elPagoMontoRecibido = document.getElementById('pagoMontoRecibido');
const elPagoVuelto = document.getElementById('pagoVuelto');
const elPagoVueltoBox = document.getElementById('pagoVueltoBox');
const elPagoSugerencias = document.getElementById('pagoSugerencias');
const elPagoAviso = document.getElementById('pagoAviso');
const elPagoDteBox = document.getElementById('pagoDteBox');
const elPagoDteBotones = document.getElementById('pagoDteBotones');
const elBtnCancelarPago = document.getElementById('btnCancelarPago');
const elBtnConfirmarPago = document.getElementById('btnConfirmarPago');

document.addEventListener('DOMContentLoaded', () => {
  if (elBtnCancelarPago) elBtnCancelarPago.addEventListener('click', cerrarSelectorPago);
  if (elBtnConfirmarPago) elBtnConfirmarPago.addEventListener('click', confirmarSelectorPago);
  if (elPagoMontoRecibido) elPagoMontoRecibido.addEventListener('input', actualizarVuelto);

  if (elPagoDteBotones) {
    elPagoDteBotones.querySelectorAll('.dte-btn').forEach(btn => {
      btn.addEventListener('click', () => elegirTipoDte(btn.dataset.dte));
    });
  }
  if (elModalPago) elModalPago.addEventListener('click', (e) => { if (e.target === elModalPago) cerrarSelectorPago(); });
});

/**
 * Abre el selector de pago.
 * @param {Object} opciones
 *   titulo, subtitulo, total, textoConfirmar
 *   metodos          → lista de nombres permitidos (por defecto, todos)
 *   onConfirmar(metodo, { montoRecibido, vuelto }) → promesa
 */
function abrirSelectorPago(opciones) {
  configPago = opciones || {};
  metodoPagoElegido = null;

  if (elPagoTitulo) elPagoTitulo.textContent = configPago.titulo || 'Confirmar Pago';
  if (elPagoSubtitulo) elPagoSubtitulo.textContent = configPago.subtitulo || 'Selecciona el medio de pago.';
  if (elPagoTotal) elPagoTotal.textContent = fmtCLP(configPago.total || 0);
  if (elBtnConfirmarPago) {
    elBtnConfirmarPago.textContent = configPago.textoConfirmar || 'Confirmar Venta';
    elBtnConfirmarPago.disabled = true;
  }
  if (elPagoMontoRecibido) elPagoMontoRecibido.value = '';
  if (elPagoEfectivoBox) elPagoEfectivoBox.style.display = 'none';

  // El DTE solo aplica al cobrar una venta, no al registrar un abono
  const pideDte = configPago.pedirDte !== false;
  if (elPagoDteBox) elPagoDteBox.style.display = pideDte ? '' : 'none';
  elegirTipoDte('SIN DTE');

  renderMetodosPago();
  if (elModalPago) elModalPago.classList.add('show');
}

function renderMetodosPago() {
  if (!elPagoMetodos) return;
  const permitidos = configPago?.metodos || METODOS_PAGO.map(m => m.valor);

  elPagoMetodos.innerHTML = METODOS_PAGO
    .filter(m => permitidos.includes(m.valor))
    .map(m => `
      <button type="button" class="metodo-pago${m.valor === 'Por Pagar' ? ' metodo-pendiente' : ''}" data-metodo="${m.valor}">
        <span class="metodo-icono">${m.icono}</span>
        <span>${m.valor}</span>
      </button>
    `).join('');

  elPagoMetodos.querySelectorAll('.metodo-pago').forEach(btn => {
    btn.addEventListener('click', () => elegirMetodoPago(btn.dataset.metodo));
  });
}

function elegirMetodoPago(valor) {
  metodoPagoElegido = valor;
  elPagoMetodos.querySelectorAll('.metodo-pago').forEach(b => {
    b.classList.toggle('active', b.dataset.metodo === valor);
  });

  const esEfectivo = valor === 'Efectivo';
  if (elPagoEfectivoBox) elPagoEfectivoBox.style.display = esEfectivo ? 'block' : 'none';

  if (esEfectivo) {
    renderSugerenciasEfectivo();
    actualizarVuelto();
    setTimeout(() => elPagoMontoRecibido?.focus(), 60);
  } else if (elBtnConfirmarPago) {
    elBtnConfirmarPago.disabled = false;
  }
}

/* Botones rápidos con montos redondos por sobre el total */
function renderSugerenciasEfectivo() {
  if (!elPagoSugerencias) return;
  const total = Number(configPago?.total) || 0;
  const pasos = [1000, 2000, 5000, 10000, 20000, 50000];

  const montos = [total];
  pasos.forEach(p => {
    const redondeo = Math.ceil(total / p) * p;
    if (redondeo > total && !montos.includes(redondeo)) montos.push(redondeo);
  });

  elPagoSugerencias.innerHTML = montos.slice(0, 5).map(m => `
    <button type="button" class="chip" data-monto="${m}">${m === total ? 'Justo · ' : ''}${fmtCLP(m)}</button>
  `).join('');

  elPagoSugerencias.querySelectorAll('button[data-monto]').forEach(btn => {
    btn.addEventListener('click', () => {
      elPagoMontoRecibido.value = btn.dataset.monto;
      actualizarVuelto();
    });
  });
}

function actualizarVuelto() {
  if (metodoPagoElegido !== 'Efectivo') return;

  const total = Number(configPago?.total) || 0;
  const recibido = Number(elPagoMontoRecibido?.value) || 0;
  const diferencia = recibido - total;

  if (elPagoVuelto) elPagoVuelto.textContent = fmtCLP(Math.max(diferencia, 0));
  if (elPagoVueltoBox) elPagoVueltoBox.classList.toggle('falta', diferencia < 0);

  if (elPagoAviso) {
    elPagoAviso.textContent = diferencia < 0
      ? `Faltan ${fmtCLP(Math.abs(diferencia))} para completar el pago.`
      : 'El vuelto es solo referencial: no se imprime en el ticket.';
  }
  if (elBtnConfirmarPago) elBtnConfirmarPago.disabled = recibido <= 0 || diferencia < 0;
}

function elegirTipoDte(valor) {
  tipoDteElegido = valor || 'SIN DTE';
  if (!elPagoDteBotones) return;
  elPagoDteBotones.querySelectorAll('.dte-btn').forEach(b => {
    b.classList.toggle('active', b.dataset.dte === tipoDteElegido);
  });
}

function datosPagoActuales() {
  const total = Number(configPago?.total) || 0;
  const recibido = metodoPagoElegido === 'Efectivo' ? (Number(elPagoMontoRecibido?.value) || 0) : 0;
  return {
    montoRecibido: recibido,
    vuelto: metodoPagoElegido === 'Efectivo' ? Math.max(recibido - total, 0) : 0,
    tipoDte: tipoDteElegido
  };
}

async function confirmarSelectorPago() {
  if (!metodoPagoElegido) { showToast('Selecciona un medio de pago', 'err'); return; }
  if (!configPago?.onConfirmar) { cerrarSelectorPago(); return; }

  const datos = datosPagoActuales();
  if (elBtnConfirmarPago) elBtnConfirmarPago.disabled = true;

  try {
    await configPago.onConfirmar(metodoPagoElegido, datos);
    cerrarSelectorPago();
  } catch (err) {
    console.error('Error al confirmar el pago:', err.message || err);
    showToast(err.message || 'No se pudo confirmar el pago', 'err');
  } finally {
    if (elBtnConfirmarPago) elBtnConfirmarPago.disabled = false;
  }
}

function cerrarSelectorPago() {
  if (elModalPago) elModalPago.classList.remove('show');
  configPago = null;
  metodoPagoElegido = null;
}
