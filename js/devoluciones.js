/* ============================================================
   DEVOLUCIONES Y ANULACIÓN DE VENTAS (v81 · sql/61)
   ------------------------------------------------------------
   Reemplaza al borrado como forma de revertir una venta. Se abre desde el
   Historial de Ventas, que ya sabe buscar por fecha y por producto.

   LO PUEDE USAR EL TRABAJADOR (decisión del dueño, 22-09-2026): es una
   operación de mostrador. Por eso el botón NO lleva `admin-only` y no se
   pide PIN — a diferencia de editar o borrar una venta.

   Todo lo que decide plata (cuánto se devuelve, si alcanza el stock, si
   la venta queda anulada o parcial) lo recalcula el servidor. Acá solo se
   muestra el número para que el dueño lo vea ANTES de confirmar.
   ============================================================ */

let devVentaActual = null;   // venta + items, como la devuelve el detalle
let devYaDevuelto = new Map(); // venta_item_id → unidades ya devueltas

const MOTIVOS_DEV = [
  ['FALLA',               '🔧 Vino fallado'],
  ['GARANTIA',            '🛡️ Garantía'],
  ['ARREPENTIMIENTO',     '🙂 Se arrepintió'],
  ['PRODUCTO_EQUIVOCADO', '📦 Producto equivocado'],
  ['ERROR_DE_VENTA',      '✏️ Error al registrar la venta'],
  ['OTRO',                '… Otro (explica abajo)']
];

const MEDIOS_DEV = [
  'Efectivo', 'Transferencia', 'Tarjeta Débito',
  'Tarjeta Crédito', 'Sin devolución de dinero'
];

function cerrarModalDevolucion() {
  document.getElementById('modalDevolucion')?.classList.remove('show');
  devVentaActual = null;
  devYaDevuelto = new Map();
}

async function abrirModalDevolucion(id) {
  const modal = document.getElementById('modalDevolucion');
  if (!modal) return;

  try {
    const [venta, devoluciones] = await Promise.all([
      API.ventas.detalle(id),
      API.devoluciones.deVenta(id)
    ]);

    devVentaActual = venta;
    devYaDevuelto = new Map();
    (devoluciones || []).forEach(d => (d.items || []).forEach(i => {
      if (!i.venta_item_id) return;
      devYaDevuelto.set(i.venta_item_id, (devYaDevuelto.get(i.venta_item_id) || 0) + num(i.cantidad));
    }));

    const ref = document.getElementById('devVentaRef');
    if (ref) {
      ref.textContent =
        `Venta #${String(venta.numero_orden ?? venta.id).padStart(5, '0')} · ` +
        `${venta.fecha || '—'} · ${venta.cliente || 'Consumidor Final'} · ${fmtCLP(venta.total)}`;
    }

    /* Aviso de Nota de Crédito. El POS NUNCA entra al SII: solo avisa, y
       el documento lo emite el dueño. */
    const dte = String(venta.tipo_dte || '').toUpperCase();
    const avisoNC = document.getElementById('devAvisoNotaCredito');
    if (avisoNC) {
      const necesita = dte && dte !== 'SIN DTE';
      avisoNC.style.display = necesita ? 'block' : 'none';
      if (necesita) {
        avisoNC.innerHTML =
          `⚠️ Esta venta emitió <strong>${escHtml(venta.tipo_dte)}</strong> y ya está declarada. ` +
          'Al devolverla tienes que emitir una <strong>Nota de Crédito</strong> en el SII. ' +
          'El POS deja el registro listo, pero el documento lo emites tú.';
      }
    }

    // Una venta "Por Pagar" nunca entregó plata: solo se puede deshacer.
    const impaga = venta.estado === 'PENDIENTE';
    const avisoImpaga = document.getElementById('devAvisoImpaga');
    if (avisoImpaga) avisoImpaga.style.display = impaga ? 'block' : 'none';

    const selMedio = document.getElementById('devMedio');
    if (selMedio) {
      selMedio.innerHTML = MEDIOS_DEV
        .filter(m => !impaga || m === 'Sin devolución de dinero')
        .map(m => `<option value="${escHtml(m)}">${escHtml(m)}</option>`).join('');
      if (!impaga) selMedio.value = venta.metodo_pago_final || venta.metodo_pago || 'Efectivo';
      if (!MEDIOS_DEV.includes(selMedio.value)) selMedio.value = 'Efectivo';
    }

    const selMotivo = document.getElementById('devMotivo');
    if (selMotivo) {
      if (!selMotivo.options.length) {
        selMotivo.innerHTML = MOTIVOS_DEV
          .map(([v, t]) => `<option value="${v}">${escHtml(t)}</option>`).join('');
      }
      /* Si queda algo en garantía vigente, ese es el motivo más probable.
         El estado lo calcula el servidor con la misma regla del panel de
         Garantías, para que las dos pantallas no puedan discrepar. */
      const hayGarantia = (venta.items || []).some(i =>
        i.estado_garantia === 'VIGENTE' && num(i.cantidad) - (devYaDevuelto.get(i.id) || 0) > 0);
      selMotivo.value = hayGarantia ? 'GARANTIA' : 'FALLA';
    }
    const obs = document.getElementById('devObservacion');
    if (obs) obs.value = '';

    pintarLineasDevolucion();
    modal.classList.add('show');
  } catch (err) {
    console.error('No se pudo abrir la devolución:', err.message || err);
    showToast(err.message || 'No se pudo cargar la venta', 'err');
  }
}

/* Una fila por línea de la venta. Las que ya volvieron enteras se muestran
   apagadas en vez de esconderse: el dueño tiene que poder ver que esa línea
   ya se devolvió antes, no que "desapareció". */
function pintarLineasDevolucion() {
  const cont = document.getElementById('devLineas');
  if (!cont || !devVentaActual) return;

  const items = devVentaActual.items || [];
  cont.innerHTML = items.map(i => {
    const vendidas = num(i.cantidad);
    const devueltas = devYaDevuelto.get(i.id) || 0;
    const quedan = vendidas - devueltas;
    const agotada = quedan <= 0;
    // Una pieza usada en una OT ya se gastó en el taller: vuelve la plata,
    // no el repuesto. El servidor lo fuerza igual.
    const esDeOt = !!i.ot_repuesto_id;

    /* El estado de garantía viene calculado del servidor (v82). Sirve para
       dos cosas: preseleccionar el motivo y, sobre todo, que el dueño vea
       si le corresponde cubrirlo antes de decidir. */
    const enGarantia = i.estado_garantia === 'VIGENTE';
    const chipGarantia = i.vence_el
      ? `<span class="dev-chip ${enGarantia ? 'dev-chip-garantia' : 'dev-chip-vencida'}">
           ${enGarantia ? '🛡️ En garantía hasta' : '⌛ Garantía vencida el'} ${escHtml(i.vence_el)}
         </span>`
      : '';

    return `
      <div class="dev-linea${agotada ? ' dev-linea-lista' : ''}">
        <div class="dev-linea-info">
          <strong>${escHtml(i.nombre || 'Sin nombre')}</strong>
          <span class="dev-linea-meta">
            ${fmtCLP(i.precio_unitario)} c/u · vendidas ${vendidas}${devueltas ? ` · ya devueltas ${devueltas}` : ''}
          </span>
          ${chipGarantia}
        </div>
        <div class="dev-linea-campos">
          <label class="dev-cantidad">
            <span>Vuelven</span>
            <input type="number" data-dev-item="${i.id}" min="0" max="${quedan}" step="1"
                   value="0" inputmode="numeric" ${agotada ? 'disabled' : ''}>
            <small>de ${quedan}</small>
          </label>
          <label class="dev-stock" title="${esDeOt
            ? 'Esta pieza ya se usó en una orden de trabajo: no vuelve al inventario.'
            : 'Desmárcalo si el producto viene quemado o inservible.'}">
            <input type="checkbox" data-dev-stock="${i.id}" ${esDeOt || agotada ? 'disabled' : 'checked'}>
            <span>${esDeOt ? 'Usado en OT' : 'Vuelve al stock'}</span>
          </label>
        </div>
      </div>`;
  }).join('') || '<p class="modal-hint">Esta venta no tiene líneas que devolver.</p>';

  cont.querySelectorAll('input[data-dev-item]').forEach(inp => {
    inp.addEventListener('input', recalcularTotalDevolucion);
  });
  recalcularTotalDevolucion();
}

/* Marca todas las líneas con lo que queda vivo. Es el caso más común:
   "esta venta se anula entera". */
function devolverTodoEnModal() {
  document.querySelectorAll('#devLineas input[data-dev-item]').forEach(inp => {
    if (!inp.disabled) inp.value = inp.max;
  });
  recalcularTotalDevolucion();
}

/* El monto que se muestra es SOLO informativo: el servidor lo recalcula y
   es el suyo el que manda. Acá se reparte el descuento de la venta a
   prorrata igual que en el backend, para que el número que ve el dueño
   antes de confirmar sea el mismo que va a salir del cajón. */
function recalcularTotalDevolucion() {
  const resumen = document.getElementById('devResumen');
  if (!resumen || !devVentaActual) return;

  const items = devVentaActual.items || [];
  const subtotalVenta = items.reduce((s, i) => s + num(i.precio_unitario) * num(i.cantidad), 0);
  const factor = subtotalVenta > 0 ? (1 - num(devVentaActual.descuento_monto) / subtotalVenta) : 1;

  let total = 0, unidades = 0;
  items.forEach(i => {
    const inp = document.querySelector(`#devLineas input[data-dev-item="${i.id}"]`);
    const cant = num(inp?.value);
    if (cant <= 0) return;
    unidades += cant;
    total += Math.round(num(i.precio_unitario) * cant * factor);
  });

  const medio = document.getElementById('devMedio')?.value;
  const sinPlata = medio === 'Sin devolución de dinero';

  resumen.innerHTML = unidades === 0
    ? '<span class="dev-resumen-vacio">Elige cuántas unidades vuelven.</span>'
    : `Vuelven <strong>${unidades}</strong> unidad(es) · ` +
      (sinPlata
        ? 'no sale dinero del cajón'
        : `se devuelven <strong>${fmtCLP(total)}</strong>`);

  const btn = document.getElementById('btnConfirmarDevolucion');
  if (btn) btn.disabled = unidades === 0;
}

async function confirmarDevolucion() {
  if (!devVentaActual) return;

  const items = [];
  (devVentaActual.items || []).forEach(i => {
    const cant = num(document.querySelector(`#devLineas input[data-dev-item="${i.id}"]`)?.value);
    if (cant <= 0) return;
    const chk = document.querySelector(`#devLineas input[data-dev-stock="${i.id}"]`);
    items.push({ venta_item_id: i.id, cantidad: cant, reingresa_stock: !!chk?.checked });
  });
  if (!items.length) { showToast('Elige cuántas unidades vuelven', 'err'); return; }

  const motivo = document.getElementById('devMotivo')?.value || '';
  const medio = document.getElementById('devMedio')?.value || '';
  const observacion = document.getElementById('devObservacion')?.value?.trim() || '';

  if (motivo === 'OTRO' && !observacion) {
    showToast('Con motivo "Otro" escribe una observación', 'err');
    document.getElementById('devObservacion')?.focus();
    return;
  }

  const btn = document.getElementById('btnConfirmarDevolucion');
  if (btn) { btn.disabled = true; btn.textContent = 'Registrando…'; }

  try {
    const r = await API.devoluciones.registrar(devVentaActual.id, {
      motivo, metodo_devolucion: medio, observacion, items
    });

    cerrarModalDevolucion();

    showToast(r.tipo === 'TOTAL'
      ? `Venta anulada · ${fmtCLP(r.monto)} devueltos`
      : `Devolución parcial registrada · ${fmtCLP(r.monto)}`, 'ok');

    /* Los avisos que exigen una acción suya NO van en un toast que se
       desvanece: se quedan en pantalla hasta que los lea. */
    if (r.requiere_nota_credito) {
      alert(`Recuerda emitir la NOTA DE CRÉDITO en el SII.\n\n` +
            `Esta venta emitió ${r.tipo_dte} por ${fmtCLP(r.monto)}. ` +
            `El POS ya dejó el registro, pero el documento lo emites tú en el sitio del SII.`);
    }
    if (r.aviso_caja) alert('⚠️ ' + r.aviso_caja);

    /* Lo que no volvió al stock se dio de baja solo, con su costo real.
       Se avisa porque es plata que se va del mes: el dueño tiene que
       enterarse, no descubrirlo después en el balance. */
    if (r.mermas?.length) {
      const total = r.mermas.reduce((s, m) => s + num(m.costo_total), 0);
      showToast(`Se dio de baja lo que no volvió al stock · ${fmtCLP(total)} de pérdida`, 'ok');
    }

    if (typeof cargarHistorial === 'function') cargarHistorial();
    actualizarAvisoDevolucionesCaja();
  } catch (err) {
    console.error('Error al registrar la devolución:', err.message || err);
    showToast(err.message || 'No se pudo registrar la devolución', 'err');
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = '↩️ Confirmar devolución'; }
  }
}

/* ============================================================
   AVISO DEL HEADER: devoluciones en efectivo fuera de caja (v82)
   ------------------------------------------------------------
   Si se devuelve plata en efectivo sin caja abierta, la plata sale del
   cajón igual: al cerrar el turno el arqueo va a dar de MENOS y sin
   explicación. Este aviso lo dice antes de que pase.

   Se muestra al trabajador también: es quien puede haber hecho esa
   devolución, y es un problema de mostrador, no de contabilidad.
   ============================================================ */

const INTERVALO_DEV_CAJA_MS = 5 * 60 * 1000;
let intervaloDevCaja = null;
let devCajaCache = null;

async function actualizarAvisoDevolucionesCaja() {
  const btn = document.getElementById('btnDevolucionesCaja');
  const texto = document.getElementById('textoDevolucionesCaja');
  if (!btn || !texto || !tokenActual()) return;

  try {
    devCajaCache = await API.devoluciones.pendientesCaja();
    const total = Number(devCajaCache?.total) || 0;
    if (!total) { btn.hidden = true; return; }

    texto.textContent = total === 1
      ? '1 devolución sin caja'
      : `${total} devoluciones sin caja`;
    btn.title = `${fmtCLP(devCajaCache.monto)} salieron del cajón sin quedar registrados en ninguna caja. ` +
                'El arqueo de esos turnos va a dar de menos.';
    btn.hidden = false;
  } catch (err) {
    console.error('No se pudo revisar las devoluciones sin caja:', err.message || err);
  }
}

function abrirModalDevolucionesCaja() {
  const cont = document.getElementById('devCajaLista');
  if (!cont || !devCajaCache) return;

  cont.innerHTML = (devCajaCache.devoluciones || []).map(d => {
    const orden = d.venta?.numero_orden ?? d.venta_id;
    return `
      <div class="dev-linea">
        <div class="dev-linea-info">
          <strong>Venta #${String(orden).padStart(5, '0')} · ${fmtCLP(d.monto)}</strong>
          <span class="dev-linea-meta">
            ${escHtml(d.fecha)} · ${escHtml(String(d.motivo).toLowerCase().replace(/_/g, ' '))}
            ${d.venta?.cliente ? ' · ' + escHtml(d.venta.cliente) : ''}
          </span>
          ${d.observacion ? `<span class="dev-linea-meta">${escHtml(d.observacion)}</span>` : ''}
        </div>
        <div class="dev-linea-campos">
          ${d.se_puede_registrar
            ? `<button class="btn btn-primary btn-sm" data-registrar-egreso="${d.id}">Registrar en la caja de hoy</button>`
            : `<span class="dev-linea-meta">Es de otro día: ajústalo a mano en la caja del ${escHtml(d.fecha)}.</span>`}
        </div>
      </div>`;
  }).join('') || '<p class="modal-hint">No hay devoluciones pendientes.</p>';

  document.getElementById('modalDevolucionesCaja')?.classList.add('show');
}

async function registrarEgresoPendiente(id) {
  try {
    await API.devoluciones.registrarEgreso(id);
    showToast('Egreso registrado en la caja', 'ok');
    await actualizarAvisoDevolucionesCaja();
    if (devCajaCache?.total) abrirModalDevolucionesCaja();
    else cerrarModal('modalDevolucionesCaja');
  } catch (err) {
    console.error('No se pudo registrar el egreso:', err.message || err);
    showToast(err.message || 'No se pudo registrar el egreso', 'err');
  }
}

document.addEventListener('pos:sesion-iniciada', () => {
  if (intervaloDevCaja) { clearInterval(intervaloDevCaja); intervaloDevCaja = null; }
  actualizarAvisoDevolucionesCaja();
  intervaloDevCaja = setInterval(actualizarAvisoDevolucionesCaja, INTERVALO_DEV_CAJA_MS);
});

document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('btnDevolucionesCaja')?.addEventListener('click', abrirModalDevolucionesCaja);
  document.getElementById('btnCerrarDevolucionesCaja')?.addEventListener('click', () => cerrarModal('modalDevolucionesCaja'));
  document.getElementById('devCajaLista')?.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-registrar-egreso]');
    if (btn) registrarEgresoPendiente(Number(btn.dataset.registrarEgreso));
  });

  document.getElementById('btnCancelarDevolucion')?.addEventListener('click', cerrarModalDevolucion);
  document.getElementById('btnConfirmarDevolucion')?.addEventListener('click', confirmarDevolucion);
  document.getElementById('btnDevolverTodo')?.addEventListener('click', devolverTodoEnModal);
  document.getElementById('devMedio')?.addEventListener('change', recalcularTotalDevolucion);
  document.getElementById('modalDevolucion')?.addEventListener('click', (e) => {
    if (e.target.id === 'modalDevolucion') cerrarModalDevolucion();
  });
});
