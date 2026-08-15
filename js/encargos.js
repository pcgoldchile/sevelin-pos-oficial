// ==========================================
// ENCARGOS.JS - Abonos y Encargos
// ------------------------------------------
// Encargos con seña: pueden nacer vinculados a una Orden de Trabajo o ser
// independientes (pedidos de repuestos, compras por encargo). El backend
// recalcula saldo y estado (PENDIENTE / PARCIAL / PAGADO) en cada abono.
// ==========================================

let encargosList = [];
let editandoEncargoId = null;
let filtroEstadoEncargo = '';
let otVinculada = null;
let encargoAbonando = null;

const ICO_VER_ENCARGO = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>`;
const ICO_EDITAR_ENCARGO = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>`;
const ICO_ELIMINAR_ENCARGO = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M8 6V4h8v2"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/></svg>`;

const elEncargosTableBody = document.getElementById('encargosTableBody');
const elEncargosChips = document.getElementById('encargosChips');
const elEncargosBuscar = document.getElementById('encargosBuscar');
const elBtnRecargarEncargos = document.getElementById('btnRecargarEncargos');
const elEncargosResumenLabel = document.getElementById('encargosResumenLabel');
const elKpiEncargosActivos = document.getElementById('kpiEncargosActivos');
const elKpiEncargosAbonado = document.getElementById('kpiEncargosAbonado');
const elKpiEncargosSaldo = document.getElementById('kpiEncargosSaldo');
const elKpiEncargosSaldoDetalle = document.getElementById('kpiEncargosSaldoDetalle');

const elModalEncargo = document.getElementById('modalEncargo');
const elEncargoFormTitle = document.getElementById('encargoFormTitle');
const elEncargoEditId = document.getElementById('encargoEditId');
const elEncargoBuscarOT = document.getElementById('encargoBuscarOT');
const elEncargoSugerenciasOT = document.getElementById('encargoSugerenciasOT');
const elEncargoOTSeleccionada = document.getElementById('encargoOTSeleccionada');
const elEncargoCliente = document.getElementById('encargoCliente');
const elEncargoRut = document.getElementById('encargoRut');
const elEncargoTelefono = document.getElementById('encargoTelefono');
const elEncargoDescripcion = document.getElementById('encargoDescripcion');
const elEncargoMontoTotal = document.getElementById('encargoMontoTotal');
const elEncargoAbonoInicial = document.getElementById('encargoAbonoInicial');
const elEncargoMetodoPago = document.getElementById('encargoMetodoPago');
const elEncargoSaldoTexto = document.getElementById('encargoSaldoTexto');
const elEncargoSaldoBox = document.getElementById('encargoSaldoBox');
const elEncargoObservaciones = document.getElementById('encargoObservaciones');
const elBtnNuevoEncargo = document.getElementById('btnNuevoEncargo');
const elBtnCancelarEncargo = document.getElementById('btnCancelarEncargo');
const elBtnGuardarEncargo = document.getElementById('btnGuardarEncargo');

const elModalAbono = document.getElementById('modalAbono');
const elAbonoEncargoId = document.getElementById('abonoEncargoId');
const elAbonoResumen = document.getElementById('abonoResumen');
const elAbonoSaldoActual = document.getElementById('abonoSaldoActual');
const elAbonoMonto = document.getElementById('abonoMonto');
const elAbonoMetodoPago = document.getElementById('abonoMetodoPago');
const elAbonoSugerencias = document.getElementById('abonoSugerencias');
const elAbonoNota = document.getElementById('abonoNota');
const elAbonoNuevoSaldo = document.getElementById('abonoNuevoSaldo');
const elBtnCancelarAbono = document.getElementById('btnCancelarAbono');
const elBtnConfirmarAbono = document.getElementById('btnConfirmarAbono');

const elModalDetalleEncargo = document.getElementById('modalDetalleEncargo');
const elDetalleEncargoContent = document.getElementById('detalleEncargoContent');
const elBtnCerrarDetalleEncargo = document.getElementById('btnCerrarDetalleEncargo');

document.addEventListener('DOMContentLoaded', () => {
  setupEncargosEventListeners();
});

function setupEncargosEventListeners() {
  if (elBtnNuevoEncargo) elBtnNuevoEncargo.addEventListener('click', () => abrirModalEncargo());
  if (elBtnCancelarEncargo) elBtnCancelarEncargo.addEventListener('click', cerrarModalEncargo);
  if (elBtnGuardarEncargo) elBtnGuardarEncargo.addEventListener('click', guardarEncargo);
  if (elBtnRecargarEncargos) elBtnRecargarEncargos.addEventListener('click', cargarEncargos);
  if (elEncargosBuscar) elEncargosBuscar.addEventListener('input', () => renderEncargosTabla(encargosList));

  if (elEncargosChips) {
    elEncargosChips.querySelectorAll('.chip').forEach(chip => {
      chip.addEventListener('click', () => {
        filtroEstadoEncargo = chip.dataset.estado || '';
        elEncargosChips.querySelectorAll('.chip').forEach(c => c.classList.toggle('active', c === chip));
        cargarEncargos();
      });
    });
  }

  // Cálculo en vivo del saldo mientras se escribe
  [elEncargoMontoTotal, elEncargoAbonoInicial].forEach(el => {
    if (el) el.addEventListener('input', actualizarSaldoEncargo);
  });

  // Buscador de OT para autocompletar los datos del cliente
  if (elEncargoBuscarOT) {
    elEncargoBuscarOT.addEventListener('input', buscarOTParaEncargo);
    document.addEventListener('click', (e) => {
      if (elEncargoSugerenciasOT && e.target !== elEncargoBuscarOT && !elEncargoSugerenciasOT.contains(e.target)) {
        elEncargoSugerenciasOT.classList.remove('show');
      }
    });
  }

  if (elBtnCancelarAbono) elBtnCancelarAbono.addEventListener('click', cerrarModalAbono);
  if (elBtnConfirmarAbono) elBtnConfirmarAbono.addEventListener('click', confirmarAbono);
  if (elAbonoMonto) elAbonoMonto.addEventListener('input', actualizarNuevoSaldo);
  if (elBtnCerrarDetalleEncargo) elBtnCerrarDetalleEncargo.addEventListener('click', () => elModalDetalleEncargo?.classList.remove('show'));

  [elModalEncargo, elModalAbono, elModalDetalleEncargo].forEach(overlay => {
    if (!overlay) return;
    overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.classList.remove('show'); });
  });
}

// ============================================================
// CARGA Y RENDER
// ============================================================
async function cargarEncargos() {
  if (!tokenActual()) return;

  try {
    encargosList = await API.encargos.listar(filtroEstadoEncargo);
    renderEncargosTabla(encargosList);
    renderKpisEncargos(encargosList);
  } catch (err) {
    console.error('Error al cargar encargos:', err.message || err);
    showToast(err.message || 'No se pudieron cargar los encargos', 'err');
  }
}

function renderKpisEncargos(lista) {
  const activos = (lista || []).filter(e => e.estado !== 'PAGADO');
  const abonado = (lista || []).reduce((a, e) => a + (Number(e.monto_abonado) || 0), 0);
  const saldo = activos.reduce((a, e) => a + (Number(e.saldo) || 0), 0);

  if (elKpiEncargosActivos) elKpiEncargosActivos.textContent = String(activos.length);
  if (elKpiEncargosAbonado) elKpiEncargosAbonado.textContent = fmtCLP(abonado);
  if (elKpiEncargosSaldo) elKpiEncargosSaldo.textContent = fmtCLP(saldo);
  if (elKpiEncargosSaldoDetalle) {
    elKpiEncargosSaldoDetalle.textContent = activos.length
      ? `Sobre ${activos.length} encargo(s) sin pagar`
      : 'Sin encargos pendientes';
  }
  if (elEncargosResumenLabel) {
    elEncargosResumenLabel.textContent = `${(lista || []).length} encargo(s) en pantalla · ${fmtCLP(saldo)} por cobrar`;
  }
}

function badgeEstadoEncargo(estado) {
  const clases = { PENDIENTE: 'badge-red', PARCIAL: 'badge-gold', PAGADO: 'badge-green' };
  return `<span class="badge ${clases[estado] || 'badge-blue'}">${estado}</span>`;
}

function renderEncargosTabla(lista) {
  if (!elEncargosTableBody) return;

  const filtro = (elEncargosBuscar?.value || '').trim().toLowerCase();
  const filas = (lista || []).filter(e => !filtro ||
    (e.cliente_nombre || '').toLowerCase().includes(filtro) ||
    (e.numero_ot || '').toLowerCase().includes(filtro) ||
    (e.descripcion || '').toLowerCase().includes(filtro)
  );

  if (filas.length === 0) {
    elEncargosTableBody.innerHTML = '<tr class="empty-row"><td colspan="7">No hay encargos con este filtro. Crea uno con “Nuevo Encargo”.</td></tr>';
    return;
  }

  elEncargosTableBody.innerHTML = filas.map(e => {
    const pagado = e.estado === 'PAGADO';
    return `
    <tr class="row-in${pagado ? '' : ' fila-pendiente'}">
      <td>
        <span class="strong">${escHtml(e.cliente_nombre || '—')}</span>
        ${e.numero_ot ? `<br><small style="color:var(--text-muted);">${e.numero_ot}</small>` : ''}
        ${e.cliente_telefono ? `<br><small style="color:var(--text-muted);">${escHtml(e.cliente_telefono)}</small>` : ''}
      </td>
      <td>${escHtml((e.descripcion || '').slice(0, 70))}${(e.descripcion || '').length > 70 ? '…' : ''}</td>
      <td class="num strong">${fmtCLP(e.monto_total)}</td>
      <td class="num" style="color:var(--green); font-weight:600;">${fmtCLP(e.monto_abonado)}</td>
      <td class="num" style="color:${pagado ? 'var(--text-muted)' : 'var(--red)'}; font-weight:700;">${fmtCLP(e.saldo)}</td>
      <td>${badgeEstadoEncargo(e.estado)}</td>
      <td>
        <div class="cell-actions">
          ${pagado ? '' : `<button class="btn btn-green btn-sm" data-abonar="${e.id}" title="Registrar abono">💵 Abonar</button>`}
          <button class="btn btn-outline btn-sm" data-ticket="${e.id}" title="Imprimir comprobante de abono">🖨️</button>
          <button class="btn btn-icon btn-icon-view" data-ver="${e.id}" title="Ver detalle">${ICO_VER_ENCARGO}</button>
          <button class="btn btn-icon btn-icon-edit" data-editar="${e.id}" title="Editar encargo">${ICO_EDITAR_ENCARGO}</button>
          <button class="btn btn-icon btn-icon-del admin-only" data-eliminar="${e.id}" title="Eliminar encargo">${ICO_ELIMINAR_ENCARGO}</button>
        </div>
      </td>
    </tr>`;
  }).join('');

  const buscar = id => encargosList.find(e => String(e.id) === String(id));

  elEncargosTableBody.querySelectorAll('button[data-abonar]').forEach(btn => {
    btn.addEventListener('click', () => abrirModalAbono(buscar(btn.dataset.abonar)));
  });
  elEncargosTableBody.querySelectorAll('button[data-ticket]').forEach(btn => {
    btn.addEventListener('click', () => imprimirComprobanteEncargo(buscar(btn.dataset.ticket)));
  });
  elEncargosTableBody.querySelectorAll('button[data-ver]').forEach(btn => {
    btn.addEventListener('click', () => verDetalleEncargo(btn.dataset.ver));
  });
  elEncargosTableBody.querySelectorAll('button[data-editar]').forEach(btn => {
    btn.addEventListener('click', () => abrirModalEncargo(buscar(btn.dataset.editar)));
  });
  elEncargosTableBody.querySelectorAll('button[data-eliminar]').forEach(btn => {
    btn.addEventListener('click', () => eliminarEncargo(btn.dataset.eliminar));
  });
}

// ============================================================
// MODAL DE ENCARGO
// ============================================================
function abrirModalEncargo(encargo = null) {
  if (!elModalEncargo) return;
  otVinculada = null;

  if (encargo) {
    editandoEncargoId = encargo.id;
    if (elEncargoFormTitle) elEncargoFormTitle.textContent = `Editar Encargo · ${encargo.cliente_nombre}`;
    if (elEncargoEditId) elEncargoEditId.value = encargo.id;
    if (elEncargoCliente) elEncargoCliente.value = encargo.cliente_nombre || '';
    if (elEncargoRut) elEncargoRut.value = encargo.cliente_rut || '';
    if (elEncargoTelefono) elEncargoTelefono.value = encargo.cliente_telefono || '';
    if (elEncargoDescripcion) elEncargoDescripcion.value = encargo.descripcion || '';
    if (elEncargoMontoTotal) elEncargoMontoTotal.value = encargo.monto_total || 0;
    if (elEncargoObservaciones) elEncargoObservaciones.value = encargo.observaciones || '';

    // El abono inicial solo existe al crear: después se registran por separado
    if (elEncargoAbonoInicial) { elEncargoAbonoInicial.value = encargo.monto_abonado || 0; elEncargoAbonoInicial.disabled = true; }
    if (elEncargoMetodoPago) elEncargoMetodoPago.disabled = true;

    if (encargo.numero_ot) {
      otVinculada = { id: encargo.ot_id, numero_ot: encargo.numero_ot };
      mostrarOTVinculada(encargo.numero_ot);
    } else if (elEncargoOTSeleccionada) {
      elEncargoOTSeleccionada.style.display = 'none';
    }
  } else {
    editandoEncargoId = null;
    if (elEncargoFormTitle) elEncargoFormTitle.textContent = 'Nuevo Encargo';
    if (elEncargoEditId) elEncargoEditId.value = '';
    [elEncargoCliente, elEncargoRut, elEncargoTelefono, elEncargoDescripcion, elEncargoObservaciones, elEncargoBuscarOT]
      .forEach(el => { if (el) el.value = ''; });
    if (elEncargoMontoTotal) elEncargoMontoTotal.value = '';
    if (elEncargoAbonoInicial) { elEncargoAbonoInicial.value = ''; elEncargoAbonoInicial.disabled = false; }
    if (elEncargoMetodoPago) elEncargoMetodoPago.disabled = false;
    if (elEncargoOTSeleccionada) elEncargoOTSeleccionada.style.display = 'none';
  }

  actualizarSaldoEncargo();
  elModalEncargo.classList.add('show');
  setTimeout(() => elEncargoCliente?.focus(), 80);
}

function cerrarModalEncargo() {
  if (elModalEncargo) elModalEncargo.classList.remove('show');
  editandoEncargoId = null;
  otVinculada = null;
}

function actualizarSaldoEncargo() {
  const total = Number(elEncargoMontoTotal?.value) || 0;
  const abono = Number(elEncargoAbonoInicial?.value) || 0;
  const saldo = total - abono;

  if (elEncargoSaldoTexto) elEncargoSaldoTexto.textContent = fmtCLP(Math.max(saldo, 0));
  if (elEncargoSaldoBox) elEncargoSaldoBox.classList.toggle('falta', abono > total);
}

/* ---------- Vinculación con una Orden de Trabajo ---------- */
function mostrarOTVinculada(texto) {
  if (!elEncargoOTSeleccionada) return;
  elEncargoOTSeleccionada.style.display = 'block';
  elEncargoOTSeleccionada.innerHTML = `Vinculado a <b>${texto}</b> · <a href="#" id="quitarOTEncargo">quitar vínculo</a>`;

  const quitar = document.getElementById('quitarOTEncargo');
  if (quitar) quitar.addEventListener('click', (e) => {
    e.preventDefault();
    otVinculada = null;
    elEncargoOTSeleccionada.style.display = 'none';
    if (elEncargoBuscarOT) elEncargoBuscarOT.value = '';
  });
}

async function buscarOTParaEncargo() {
  if (!elEncargoSugerenciasOT) return;
  const q = (elEncargoBuscarOT.value || '').trim().toLowerCase();

  if (q.length < 2) {
    elEncargoSugerenciasOT.classList.remove('show');
    return;
  }

  // Se reutiliza la lista ya cargada del taller y, si no está, se consulta
  let ordenes = (typeof ordenesList !== 'undefined' && Array.isArray(ordenesList)) ? ordenesList : [];
  if (ordenes.length === 0) {
    try { ordenes = await API.ot.listar(); } catch (_) { ordenes = []; }
  }

  const encontradas = ordenes.filter(o =>
    (o.numero_ot || '').toLowerCase().includes(q) ||
    (o.cliente_nombre || '').toLowerCase().includes(q) ||
    (o.dispositivo_modelo || '').toLowerCase().includes(q)
  ).slice(0, 8);

  if (encontradas.length === 0) {
    elEncargoSugerenciasOT.classList.remove('show');
    return;
  }

  elEncargoSugerenciasOT.innerHTML = encontradas.map(o => `
    <div class="suggestion-item" data-ot="${o.id}">
      <span>${escHtml(o.numero_ot)} · ${escHtml(o.cliente_nombre || 'Sin cliente')}</span>
      <span>${o.dispositivo_modelo || ''}</span>
    </div>
  `).join('');
  elEncargoSugerenciasOT.classList.add('show');

  elEncargoSugerenciasOT.querySelectorAll('.suggestion-item').forEach(item => {
    item.addEventListener('click', () => {
      const orden = encontradas.find(o => String(o.id) === item.dataset.ot);
      if (orden) seleccionarOTEncargo(orden);
      elEncargoSugerenciasOT.classList.remove('show');
    });
  });
}

function seleccionarOTEncargo(orden) {
  otVinculada = orden;
  if (elEncargoBuscarOT) elEncargoBuscarOT.value = '';
  if (elEncargoCliente) elEncargoCliente.value = orden.cliente_nombre || '';
  if (elEncargoRut) elEncargoRut.value = orden.cliente_rut || '';
  if (elEncargoTelefono) elEncargoTelefono.value = orden.cliente_telefono || '';
  if (elEncargoDescripcion && !elEncargoDescripcion.value.trim()) {
    const equipo = [orden.dispositivo_categoria, orden.dispositivo_modelo].filter(Boolean).join(' ');
    elEncargoDescripcion.value = `Servicio técnico ${orden.numero_ot}${equipo ? ' · ' + equipo : ''}${orden.falla_reportada ? ' · ' + orden.falla_reportada : ''}`;
  }
  mostrarOTVinculada(`${orden.numero_ot} · ${orden.cliente_nombre || ''}`);
  elEncargoMontoTotal?.focus();
}

async function guardarEncargo() {
  const total = Number(elEncargoMontoTotal?.value) || 0;
  const abono = Number(elEncargoAbonoInicial?.value) || 0;

  if (!elEncargoCliente?.value.trim()) { showToast('Ingresa el nombre del cliente', 'err'); elEncargoCliente?.focus(); return; }
  if (!elEncargoDescripcion?.value.trim()) { showToast('Describe el encargo', 'err'); elEncargoDescripcion?.focus(); return; }
  if (total <= 0) { showToast('El monto total debe ser mayor a 0', 'err'); elEncargoMontoTotal?.focus(); return; }
  if (!editandoEncargoId && abono > total) { showToast('El abono no puede superar el monto total', 'err'); return; }

  const payload = {
    ot_id: otVinculada?.id || null,
    numero_ot: otVinculada?.numero_ot || null,
    cliente_nombre: elEncargoCliente.value.trim(),
    cliente_rut: elEncargoRut?.value.trim() || null,
    cliente_telefono: elEncargoTelefono?.value.trim() || null,
    descripcion: elEncargoDescripcion.value.trim(),
    monto_total: total,
    observaciones: elEncargoObservaciones?.value.trim() || null,
    abono_inicial: editandoEncargoId ? 0 : abono,
    metodo_pago: elEncargoMetodoPago?.value || 'Efectivo'
  };

  if (elBtnGuardarEncargo) elBtnGuardarEncargo.disabled = true;

  try {
    let encargo;
    if (editandoEncargoId) encargo = await API.encargos.actualizar(editandoEncargoId, payload);
    else encargo = await API.encargos.crear(payload);

    showToast(editandoEncargoId ? 'Encargo actualizado' : 'Encargo registrado', 'ok');
    cerrarModalEncargo();
    await cargarEncargos();

    // Al crear con seña se ofrece el comprobante de inmediato
    if (!editandoEncargoId && abono > 0 && confirm('¿Imprimir el comprobante de abono?')) {
      imprimirComprobanteEncargo(encargo, abono);
    }
  } catch (err) {
    console.error('Error al guardar el encargo:', err.message || err);
    showToast(err.message || 'No se pudo guardar el encargo', 'err');
  } finally {
    if (elBtnGuardarEncargo) elBtnGuardarEncargo.disabled = false;
  }
}

async function eliminarEncargo(id) {
  if (!confirm('¿Eliminar este encargo y su historial de abonos? Esta acción no se puede deshacer.')) return;
  try {
    await API.encargos.eliminar(id);
    showToast('Encargo eliminado', 'ok');
    cargarEncargos();
  } catch (err) {
    showToast(err.message || 'No se pudo eliminar el encargo', 'err');
  }
}

// ============================================================
// ABONOS
// ============================================================
function abrirModalAbono(encargo) {
  if (!encargo || !elModalAbono) return;
  encargoAbonando = encargo;

  if (elAbonoEncargoId) elAbonoEncargoId.value = encargo.id;
  if (elAbonoResumen) {
    elAbonoResumen.innerHTML = `<b>${escHtml(encargo.cliente_nombre)}</b> · ${escHtml(encargo.descripcion || '')}` +
      (encargo.numero_ot ? ` · ${encargo.numero_ot}` : '');
  }
  if (elAbonoSaldoActual) elAbonoSaldoActual.textContent = fmtCLP(encargo.saldo);
  if (elAbonoMonto) elAbonoMonto.value = '';
  if (elAbonoNota) elAbonoNota.value = '';

  // Atajos: mitad del saldo o saldo completo
  const saldo = Number(encargo.saldo) || 0;
  if (elAbonoSugerencias) {
    const montos = [...new Set([Math.round(saldo / 2), saldo].filter(m => m > 0))];
    elAbonoSugerencias.innerHTML = montos.map(m =>
      `<button type="button" class="chip" data-monto="${m}">${m === saldo ? 'Saldo total · ' : ''}${fmtCLP(m)}</button>`
    ).join('');
    elAbonoSugerencias.querySelectorAll('button[data-monto]').forEach(btn => {
      btn.addEventListener('click', () => {
        elAbonoMonto.value = btn.dataset.monto;
        actualizarNuevoSaldo();
      });
    });
  }

  actualizarNuevoSaldo();
  elModalAbono.classList.add('show');
  setTimeout(() => elAbonoMonto?.focus(), 80);
}

function cerrarModalAbono() {
  if (elModalAbono) elModalAbono.classList.remove('show');
  encargoAbonando = null;
}

function actualizarNuevoSaldo() {
  if (!encargoAbonando || !elAbonoNuevoSaldo) return;
  const saldo = Number(encargoAbonando.saldo) || 0;
  const monto = Number(elAbonoMonto?.value) || 0;
  const nuevo = saldo - monto;

  elAbonoNuevoSaldo.textContent = monto > saldo
    ? `El abono supera el saldo pendiente por ${fmtCLP(monto - saldo)}.`
    : `Nuevo saldo: ${fmtCLP(nuevo)}${nuevo === 0 ? ' — quedará PAGADO' : ''}`;

  if (elBtnConfirmarAbono) elBtnConfirmarAbono.disabled = monto <= 0 || monto > saldo;
}

async function confirmarAbono() {
  const id = elAbonoEncargoId?.value;
  const monto = Number(elAbonoMonto?.value) || 0;
  if (!id || monto <= 0) return;

  if (elBtnConfirmarAbono) elBtnConfirmarAbono.disabled = true;

  try {
    const actualizado = await API.encargos.abonar(id, {
      monto,
      metodo_pago: elAbonoMetodoPago?.value || 'Efectivo',
      nota: elAbonoNota?.value.trim() || null
    });

    showToast(actualizado.estado === 'PAGADO' ? 'Encargo pagado por completo' : 'Abono registrado', 'ok');
    cerrarModalAbono();
    await cargarEncargos();

    if (confirm('¿Imprimir el comprobante de abono?')) imprimirComprobanteEncargo(actualizado, monto);
  } catch (err) {
    console.error('Error al registrar el abono:', err.message || err);
    showToast(err.message || 'No se pudo registrar el abono', 'err');
  } finally {
    if (elBtnConfirmarAbono) elBtnConfirmarAbono.disabled = false;
  }
}

// ============================================================
// DETALLE E IMPRESIÓN
// ============================================================
async function verDetalleEncargo(id) {
  try {
    const encargo = await API.encargos.detalle(id);
    if (!elDetalleEncargoContent) return;

    const abonos = (encargo.abonos || []).map(a => `
      <tr>
        <td style="padding:6px 0;">${tsAChile(a.fecha)}<br><small style="color:var(--text-muted);">${a.metodo_pago || ''}${a.nota ? ' · ' + a.nota : ''}</small></td>
        <td style="text-align:right; padding:6px 0; color:var(--green); font-weight:600;">${fmtCLP(a.monto)}</td>
      </tr>
    `).join('');

    elDetalleEncargoContent.innerHTML = `
      <div class="grid grid-2" style="gap:8px 18px; margin-bottom:12px;">
        <p><b>Cliente:</b> ${escHtml(encargo.cliente_nombre)}</p>
        <p><b>Estado:</b> ${badgeEstadoEncargo(encargo.estado)}</p>
        ${encargo.numero_ot ? `<p><b>OT:</b> ${escHtml(encargo.numero_ot)}</p>` : ''}
        ${encargo.cliente_telefono ? `<p><b>Teléfono:</b> ${escHtml(encargo.cliente_telefono)}</p>` : ''}
      </div>
      <p style="margin-bottom:12px;">${escHtml(encargo.descripcion || '')}</p>
      ${encargo.observaciones ? `<p class="modal-hint">${escHtml(encargo.observaciones)}</p>` : ''}

      <span class="section-label" style="margin-top:14px;">Abonos recibidos</span>
      <table style="width:100%; border-collapse:collapse;">
        <tbody>${abonos || '<tr><td style="padding:6px 0; color:var(--text-muted);">Aún no hay abonos registrados.</td></tr>'}</tbody>
      </table>

      <div class="edit-items-totales">
        <span>Total <b>${fmtCLP(encargo.monto_total)}</b></span>
        <span>Abonado <b style="color:var(--green);">${fmtCLP(encargo.monto_abonado)}</b></span>
        <span>Saldo <b style="color:var(--red);">${fmtCLP(encargo.saldo)}</b></span>
      </div>

      <div class="row-actions" style="justify-content:flex-end; margin-top:16px;">
        <button class="btn btn-gold" id="btnTicketDesdeDetalleEncargo">🖨️ Comprobante de Abono</button>
      </div>
    `;

    const btn = document.getElementById('btnTicketDesdeDetalleEncargo');
    if (btn) btn.addEventListener('click', () => imprimirComprobanteEncargo(encargo));

    elModalDetalleEncargo?.classList.add('show');
  } catch (err) {
    console.error('Error al abrir el encargo:', err.message || err);
    showToast(err.message || 'No se pudo cargar el encargo', 'err');
  }
}

function imprimirComprobanteEncargo(encargo, montoAbono) {
  if (!encargo) return;
  if (typeof imprimirTicketAbono === 'function') imprimirTicketAbono(encargo, montoAbono);
}

/* Los encargos se cargan al iniciar sesión */
document.addEventListener('pos:sesion-iniciada', () => cargarEncargos());
