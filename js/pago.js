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
  { valor: 'Por Pagar', icono: '⏳' },
  { valor: 'Mixto', icono: '🧩', mixto: true }
];

/* Medios que se pueden combinar en un pago mixto. "Por Pagar" queda
   fuera a propósito: una parte impaga no es un medio de pago, y mezclarla
   dejaría la venta a medio cobrar sin forma de saber cuánto falta. */
const METODOS_MIXTO = ['Efectivo', 'Tarjeta Débito', 'Tarjeta Crédito', 'Transferencia'];

/* Partes del pago mixto: [{ metodo, monto }] */
let partesPagoMixto = [];

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
const elPagoMixtoBox = document.getElementById('pagoMixtoBox');
const elPagoMixtoFilas = document.getElementById('pagoMixtoFilas');
const elPagoMixtoResumen = document.getElementById('pagoMixtoResumen');
const elBtnAgregarParte = document.getElementById('btnAgregarPartePago');

document.addEventListener('DOMContentLoaded', () => {
  if (elBtnCancelarPago) elBtnCancelarPago.addEventListener('click', cerrarSelectorPago);
  if (elBtnConfirmarPago) elBtnConfirmarPago.addEventListener('click', confirmarSelectorPago);
  if (elPagoMontoRecibido) elPagoMontoRecibido.addEventListener('input', actualizarVuelto);

  if (elPagoDteBotones) {
    elPagoDteBotones.querySelectorAll('.dte-btn').forEach(btn => {
      btn.addEventListener('click', () => elegirTipoDte(btn.dataset.dte));
    });
  }
  if (elBtnAgregarParte) elBtnAgregarParte.addEventListener('click', () => agregarPartePago());
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
  partesPagoMixto = [];

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
      <button type="button" class="metodo-pago pago-metodo-btn${m.valor === 'Por Pagar' ? ' metodo-pendiente' : ''}${m.mixto ? ' metodo-mixto' : ''}" data-metodo="${m.valor}">
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
  const esMixto = valor === 'Mixto';

  if (elPagoEfectivoBox) elPagoEfectivoBox.style.display = esEfectivo ? 'block' : 'none';
  if (elPagoMixtoBox) elPagoMixtoBox.style.display = esMixto ? 'block' : 'none';

  if (esEfectivo) {
    renderSugerenciasEfectivo();
    actualizarVuelto();
    setTimeout(() => elPagoMontoRecibido?.focus(), 60);
    return;
  }

  if (esMixto) {
    /* Arranca con dos filas, que es el caso típico: una parte en
       efectivo y otra con tarjeta o transferencia. La primera trae ya
       cargado el total, así el usuario solo baja el monto y el resto se
       reparte solo en la segunda. */
    if (!partesPagoMixto.length) {
      partesPagoMixto = [
        { metodo: 'Efectivo', monto: Number(configPago?.total) || 0 },
        { metodo: 'Transferencia', monto: 0 }
      ];
    }
    renderPagoMixto();
    return;
  }

  if (elBtnConfirmarPago) elBtnConfirmarPago.disabled = false;
}

/* ============================================================
   PAGO MIXTO
   ------------------------------------------------------------
   El cliente cubre una misma venta con varios medios (por ejemplo
   $12.000 en efectivo y $8.000 con débito).

   Importa para la contabilidad: la comisión del POS Tuu se cobra por
   transacción que pasa por la máquina, así que solo la parte con tarjeta
   la paga. El servidor recalcula todo y rechaza la venta si el desglose
   no cuadra con el total; acá solo se arma y se valida en pantalla.
   ============================================================ */

function totalPagoMixto() {
  return partesPagoMixto.reduce((a, p) => a + (Number(p.monto) || 0), 0);
}

function agregarPartePago() {
  if (partesPagoMixto.length >= 4) { showToast('Máximo 4 medios por venta', 'err'); return; }

  // La parte nueva nace con lo que falte por cubrir
  const falta = Math.max((Number(configPago?.total) || 0) - totalPagoMixto(), 0);
  const usados = partesPagoMixto.map(p => p.metodo);
  const libre = METODOS_MIXTO.find(m => !usados.includes(m)) || 'Efectivo';

  partesPagoMixto.push({ metodo: libre, monto: falta });
  renderPagoMixto();
}

function quitarPartePago(i) {
  if (partesPagoMixto.length <= 2) { showToast('El pago mixto necesita al menos 2 medios', 'err'); return; }
  partesPagoMixto.splice(i, 1);
  renderPagoMixto();
}

/* Reparte lo que falta en la parte indicada. Evita tener que sacar la
   resta a mano cuando son montos con decimales o descuentos. */
function completarPartePago(i) {
  const total = Number(configPago?.total) || 0;
  const otras = partesPagoMixto.reduce((a, p, j) => j === i ? a : a + (Number(p.monto) || 0), 0);
  partesPagoMixto[i].monto = Math.max(total - otras, 0);
  renderPagoMixto();
}

function renderPagoMixto() {
  if (!elPagoMixtoFilas) return;

  elPagoMixtoFilas.innerHTML = partesPagoMixto.map((parte, i) => `
    <div class="pago-mixto-fila">
      <select class="pago-mixto-metodo" data-i="${i}">
        ${METODOS_MIXTO.map(m => `<option value="${m}"${m === parte.metodo ? ' selected' : ''}>${m}</option>`).join('')}
      </select>
      <input type="number" class="pago-mixto-monto" data-i="${i}" min="0" step="1"
             value="${Number(parte.monto) || 0}" placeholder="0">
      <button type="button" class="btn btn-outline btn-sm pago-mixto-resto" data-i="${i}"
              title="Poner acá todo lo que falta">= resto</button>
      <button type="button" class="btn btn-outline btn-sm pago-mixto-quitar" data-i="${i}"
              title="Quitar este medio">✕</button>
    </div>`).join('');

  elPagoMixtoFilas.querySelectorAll('.pago-mixto-metodo').forEach(sel => {
    sel.addEventListener('change', () => {
      partesPagoMixto[Number(sel.dataset.i)].metodo = sel.value;
      actualizarResumenMixto();
    });
  });
  elPagoMixtoFilas.querySelectorAll('.pago-mixto-monto').forEach(inp => {
    inp.addEventListener('input', () => {
      partesPagoMixto[Number(inp.dataset.i)].monto = Number(inp.value) || 0;
      actualizarResumenMixto();
    });
  });
  elPagoMixtoFilas.querySelectorAll('.pago-mixto-resto').forEach(b => {
    b.addEventListener('click', () => completarPartePago(Number(b.dataset.i)));
  });
  elPagoMixtoFilas.querySelectorAll('.pago-mixto-quitar').forEach(b => {
    b.addEventListener('click', () => quitarPartePago(Number(b.dataset.i)));
  });

  actualizarResumenMixto();
}

function actualizarResumenMixto() {
  const total = Number(configPago?.total) || 0;
  const suma = totalPagoMixto();
  const dif = total - suma;
  const cuadra = Math.abs(dif) <= 1;

  if (elPagoMixtoResumen) {
    elPagoMixtoResumen.className = 'pago-mixto-resumen ' + (cuadra ? 'ok' : 'mal');
    elPagoMixtoResumen.innerHTML = cuadra
      ? `<strong>✅ Cuadra:</strong> ${fmtCLP(suma)} de ${fmtCLP(total)}`
      : (dif > 0
          ? `<strong>Faltan ${fmtCLP(dif)}</strong> · repartidos ${fmtCLP(suma)} de ${fmtCLP(total)}`
          : `<strong>Sobran ${fmtCLP(-dif)}</strong> · repartidos ${fmtCLP(suma)} de ${fmtCLP(total)}`);
  }

  // Sin cuadrar no se puede confirmar: evita cajas descuadradas
  if (elBtnConfirmarPago) elBtnConfirmarPago.disabled = !cuadra;
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
    tipoDte: tipoDteElegido,
    // Solo va cuando el usuario eligió Mixto; el servidor lo revalida
    pagos: metodoPagoElegido === 'Mixto'
      ? partesPagoMixto.filter(p => (Number(p.monto) || 0) > 0)
      : null
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
  partesPagoMixto = [];
}
