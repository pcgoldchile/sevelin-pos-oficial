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
  /* Enter en "Paga con": no hace falta buscar el botón Confirmar con el
     mouse. Se valida que el monto alcance antes de avanzar, porque si no
     el vuelto saldría negativo y la venta quedaría mal cobrada. */
  if (elPagoMontoRecibido) {
    elPagoMontoRecibido.addEventListener('keydown', (e) => {
      if (e.key !== 'Enter') return;
      e.preventDefault();

      const recibido = Number(elPagoMontoRecibido.value) || 0;
      const total = Number(configPago?.total) || 0;

      if (recibido > 0 && recibido < total) {
        showToast(`Faltan ${fmtCLP(total - recibido)}`, 'err');
        elPagoMontoRecibido.select();
        return;
      }
      // Sin monto escrito se asume pago justo, que es lo habitual
      confirmarSelectorPago();
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

  /* El DTE pasó a un modal propio, posterior al medio de pago. Motivo:
     así se elige con ↑ ↓ y Enter sin competir con las flechas que
     recorren los medios de pago dentro de este mismo modal.
     El recuadro viejo queda oculto; se conserva en el HTML para no
     romper `elegirTipoDte()`, que sigue sincronizando ambos. */
  if (elPagoDteBox) elPagoDteBox.style.display = 'none';
  elegirTipoDte('SIN DTE');

  renderMetodosPago();
  if (elModalPago) elModalPago.classList.add('show');

  /* Efectivo viene marcado de entrada: es el medio más usado en caja y
     así el flujo típico queda en "escribir el monto → Enter → Enter".
     Las flechas siguen permitiendo cambiarlo. Solo se preselecciona si
     Efectivo está entre los medios permitidos (un cobro de encargo
     puede restringirlos). */
  const permitidos = configPago.metodos || METODOS_PAGO.map(m => m.valor);
  if (permitidos.includes('Efectivo')) {
    elegirMetodoPago('Efectivo');
  }
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
    /* El cálculo del vuelto vive en su propio paso, no incrustado en el
       selector de medios: con la calculadora de vuelto a la vista, el
       resto de los botones distrae justo cuando hay que teclear rápido
       y con el cliente esperando. */
    renderSugerenciasEfectivo();
    actualizarVuelto();
    abrirSubmodalEfectivo();
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

  /* Paso intermedio: elegir el documento tributario.
     Solo al cobrar una venta; un abono de encargo no emite DTE. */
  if (configPago.pedirDte !== false) {
    const dte = await pedirTipoDte();
    if (dte === null) return;          // canceló: se vuelve al medio de pago
    elegirTipoDte(dte);
  }

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

/* ============================================================
   SUB-MODAL DE EFECTIVO
   ------------------------------------------------------------
   Paso dedicado a "monto recibido → vuelto". Al confirmar, encadena con
   el paso de documento tributario.
   ============================================================ */
function abrirSubmodalEfectivo() {
  const modal = document.getElementById('modalEfectivo');
  if (!modal) return;   // sin el modal en el HTML se sigue con el flujo antiguo

  const total = document.getElementById('efectivoTotal');
  if (total) total.textContent = fmtCLP(configPago?.total || 0);

  // Se mueven los controles existentes al sub-modal para no duplicar lógica
  const destino = document.getElementById('efectivoCuerpo');
  const origen = document.getElementById('pagoEfectivoBox');
  if (destino && origen && origen.parentElement !== destino) {
    destino.appendChild(origen);
    origen.style.display = 'block';
  }

  modal.classList.add('show');
  document.getElementById('modalPago')?.classList.add('hay-encima');
  setTimeout(() => { elPagoMontoRecibido?.focus(); elPagoMontoRecibido?.select(); }, 80);
}

function cerrarSubmodalEfectivo() {
  document.getElementById('modalEfectivo')?.classList.remove('show');
  document.getElementById('modalPago')?.classList.remove('hay-encima');
}

/* Confirma el vuelto y encadena con el documento tributario. */
function confirmarEfectivo() {
  const recibido = Number(elPagoMontoRecibido?.value) || 0;
  const total = Number(configPago?.total) || 0;

  if (recibido > 0 && recibido < total) {
    showToast(`Faltan ${fmtCLP(total - recibido)}`, 'err');
    elPagoMontoRecibido?.select();
    return;
  }

  cerrarSubmodalEfectivo();
  confirmarSelectorPago();       // sigue con el paso de DTE
}

function volverDesdeEfectivo() {
  cerrarSubmodalEfectivo();
  /* Se desmarca el medio para que volver a tocar "Efectivo" reabra el
     sub-modal; si quedara marcado, el botón no reaccionaría. */
  metodoPagoElegido = null;
  elPagoMetodos?.querySelectorAll('.metodo-pago').forEach(b => b.classList.remove('active'));
}

document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('btnConfirmarEfectivo')?.addEventListener('click', confirmarEfectivo);
  document.getElementById('btnVolverEfectivo')?.addEventListener('click', volverDesdeEfectivo);

  // Enter dentro del sub-modal confirma
  document.getElementById('modalEfectivo')?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { e.preventDefault(); e.stopPropagation(); confirmarEfectivo(); }
    if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); volverDesdeEfectivo(); }
  }, true);
});

/* ============================================================
   PASO DE DOCUMENTO TRIBUTARIO
   ------------------------------------------------------------
   Modal propio, navegable con ↑ ↓ y confirmable con Enter. Devuelve una
   promesa con el tipo elegido, o null si se cancela.

   Va DESPUÉS del medio de pago y no antes, porque el documento es lo
   último que se decide en el mostrador: primero se acuerda cómo paga el
   cliente y recién ahí si pide boleta o factura.
   ============================================================ */
const OPCIONES_DTE = [
  { valor: 'SIN DTE', icono: '📄', desc: 'Comprobante interno, sin documento tributario' },
  { valor: 'BOLETA',  icono: '🧾', desc: 'Boleta electrónica al consumidor final' },
  { valor: 'FACTURA', icono: '📑', desc: 'Factura electrónica con datos de la empresa' }
];

let dteResolver = null;
let dteIndice = 0;

function pedirTipoDte() {
  const modal = document.getElementById('modalDte');
  const lista = document.getElementById('dteOpciones');

  // Sin el modal en el HTML se cae al valor por defecto, sin bloquear la venta
  if (!modal || !lista) return Promise.resolve(tipoDteElegido || 'SIN DTE');

  dteIndice = Math.max(0, OPCIONES_DTE.findIndex(o => o.valor === (tipoDteElegido || 'SIN DTE')));

  const totalEl = document.getElementById('dteTotal');
  if (totalEl) totalEl.textContent = fmtCLP(configPago?.total || 0);

  renderOpcionesDte();
  modal.classList.add('show');
  document.getElementById('modalPago')?.classList.add('hay-encima');
  setTimeout(() => document.getElementById('btnConfirmarDte')?.focus(), 60);

  return new Promise(resolve => { dteResolver = resolve; });
}

function renderOpcionesDte() {
  const lista = document.getElementById('dteOpciones');
  if (!lista) return;

  lista.innerHTML = OPCIONES_DTE.map((o, i) => `
    <button type="button" class="dte-opcion${i === dteIndice ? ' activa' : ''}" data-i="${i}">
      <span class="dte-opcion-icono">${o.icono}</span>
      <span class="dte-opcion-texto">
        <strong>${o.valor}</strong>
        <small>${o.desc}</small>
      </span>
      <span class="dte-opcion-marca">${i === dteIndice ? '●' : ''}</span>
    </button>`).join('');

  lista.querySelectorAll('.dte-opcion').forEach(b => {
    b.addEventListener('click', () => {
      dteIndice = Number(b.dataset.i);
      renderOpcionesDte();
      resolverDte();                  // un clic elige y confirma de una vez
    });
  });
}

function moverDte(delta) {
  dteIndice = (dteIndice + delta + OPCIONES_DTE.length) % OPCIONES_DTE.length;
  renderOpcionesDte();
}

function resolverDte() {
  const modal = document.getElementById('modalDte');
  if (modal) modal.classList.remove('show');
  document.getElementById('modalPago')?.classList.remove('hay-encima');
  const r = dteResolver; dteResolver = null;
  if (r) r(OPCIONES_DTE[dteIndice].valor);
}

function cancelarDte() {
  const modal = document.getElementById('modalDte');
  if (modal) modal.classList.remove('show');
  document.getElementById('modalPago')?.classList.remove('hay-encima');
  const r = dteResolver; dteResolver = null;
  if (r) r(null);
}

document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('btnConfirmarDte')?.addEventListener('click', resolverDte);
  document.getElementById('btnCancelarDte')?.addEventListener('click', cancelarDte);
  document.getElementById('modalDte')?.addEventListener('click', (e) => {
    if (e.target.id === 'modalDte') cancelarDte();
  });

  /* Teclado del paso de DTE. Se captura antes que los atajos generales
     para que las flechas no se vayan al modal de pago que está detrás. */
  document.addEventListener('keydown', (e) => {
    const modal = document.getElementById('modalDte');
    if (!modal || !modal.classList.contains('show')) return;

    if (e.key === 'ArrowDown' || e.key === 'ArrowRight') { e.preventDefault(); e.stopPropagation(); moverDte(+1); }
    else if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') { e.preventDefault(); e.stopPropagation(); moverDte(-1); }
    else if (e.key === 'Enter') { e.preventDefault(); e.stopPropagation(); resolverDte(); }
    else if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); cancelarDte(); }
    else if (/^[1-9]$/.test(e.key) && OPCIONES_DTE[Number(e.key) - 1]) {
      e.preventDefault(); e.stopPropagation();
      dteIndice = Number(e.key) - 1;
      renderOpcionesDte();
      resolverDte();
    }
  }, true);
});

function cerrarSelectorPago() {
  if (dteResolver) cancelarDte();
  if (elModalPago) elModalPago.classList.remove('show');
  configPago = null;
  metodoPagoElegido = null;
  partesPagoMixto = [];
}
