// ==========================================
// OT.JS - Servicio Técnico (Check-In / Check-Out)
// ------------------------------------------
// Wizard de 3 pasos, panel de órdenes, entrega con firma digital y
// puente al POS para cobrar la reparación.
// ==========================================

let ordenesList = [];
let pasoActualOT = 1;
let ultimaOTCreada = null;
let otSeleccionadaEntrega = null;
let filtroEstadoOT = 'PENDIENTE';
let firmaDibujada = false;

const ICO_VER_OT = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>`;
const ICO_ELIMINAR_OT = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M8 6V4h8v2"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/></svg>`;

/* ---------- Formulario (wizard) ---------- */
const elWizardSteps = document.getElementById('wizardSteps');
const elBtnOtAnterior = document.getElementById('btnOtAnterior');
const elBtnOtSiguiente = document.getElementById('btnOtSiguiente');
const elBtnOtGuardar = document.getElementById('btnOtGuardar');
const elBtnOtLimpiar = document.getElementById('btnOtLimpiar');
const elBtnCopiarWhatsApp = document.getElementById('btnCopiarWhatsApp');
const elBtnImprimirFicha = document.getElementById('btnImprimirFicha');
const elOtCargadorDeja = document.getElementById('otCargadorDeja');
const elOtCargadorDatos = document.getElementById('otCargadorDatos');

/* ---------- Panel de órdenes ---------- */
const elOtTableBody = document.getElementById('otTableBody');
const elOtChips = document.getElementById('otChips');
const elOtBuscar = document.getElementById('otBuscar');
const elBtnOtRecargar = document.getElementById('btnOtRecargar');
const elOtResumenLabel = document.getElementById('otResumenLabel');

/* ---------- Modales ---------- */
const elModalOtPreview = document.getElementById('modalOtPreview');
const elOtPreviewTitulo = document.getElementById('otPreviewTitulo');
const elOtPreviewContenido = document.getElementById('otPreviewContenido');
const elBtnCerrarOtPreview = document.getElementById('btnCerrarOtPreview');
const elBtnImprimirOt = document.getElementById('btnImprimirOt');

const elModalOtRepuestos = document.getElementById('modalOtRepuestos');
const elOtRepuestosId = document.getElementById('otRepuestosId');
const elOtRepuestosResumen = document.getElementById('otRepuestosResumen');
const elOtRepuestoBuscar = document.getElementById('otRepuestoBuscar');
const elOtRepuestoSugerencias = document.getElementById('otRepuestoSugerencias');
const elOtRepuestoNombre = document.getElementById('otRepuestoNombre');
const elOtRepuestoCantidad = document.getElementById('otRepuestoCantidad');
const elOtRepuestoCosto = document.getElementById('otRepuestoCosto');
const elOtRepuestoPrecio = document.getElementById('otRepuestoPrecio');
const elBtnAgregarOtRepuesto = document.getElementById('btnAgregarOtRepuesto');
const elOtRepuestosLista = document.getElementById('otRepuestosLista');
const elOtRepuestosTotales = document.getElementById('otRepuestosTotales');
const elBtnCerrarOtRepuestos = document.getElementById('btnCerrarOtRepuestos');
const elBtnCobrarOtDesdeModal = document.getElementById('btnCobrarOtDesdeModal');

const elModalOtNotas = document.getElementById('modalOtNotas');
const elOtNotasId = document.getElementById('otNotasId');
const elOtNotasResumen = document.getElementById('otNotasResumen');
const elOtNotasTecnico = document.getElementById('otNotasTecnico');
const elOtNotasInternas = document.getElementById('otNotasInternas');
const elBtnCancelarOtNotas = document.getElementById('btnCancelarOtNotas');
const elBtnGuardarOtNotas = document.getElementById('btnGuardarOtNotas');

let otRepuestosActuales = [];
let otRepuestoSeleccionado = null;

const elModalOtEntrega = document.getElementById('modalOtEntrega');
const elOtEntregaId = document.getElementById('otEntregaId');
const elOtEntregaResumen = document.getElementById('otEntregaResumen');
const elOtRetiraNombre = document.getElementById('otRetiraNombre');
const elOtRetiraRut = document.getElementById('otRetiraRut');
const elOtEntregaMesesGarantia = document.getElementById('otEntregaMesesGarantia');
const elOtFirmaCanvas = document.getElementById('otFirmaCanvas');
const elBtnLimpiarFirma = document.getElementById('btnLimpiarFirma');
const elBtnCancelarOtEntrega = document.getElementById('btnCancelarOtEntrega');
const elBtnConfirmarOtEntrega = document.getElementById('btnConfirmarOtEntrega');

document.addEventListener('DOMContentLoaded', () => {
  setupOtEventListeners();
  initFirmaCanvas();
  irAPasoOT(1);
});

function setupOtEventListeners() {
  if (elBtnOtSiguiente) elBtnOtSiguiente.addEventListener('click', () => avanzarPasoOT(1));
  if (elBtnOtAnterior) elBtnOtAnterior.addEventListener('click', () => avanzarPasoOT(-1));
  if (elBtnOtGuardar) elBtnOtGuardar.addEventListener('click', guardarCheckIn);
  if (elBtnOtLimpiar) elBtnOtLimpiar.addEventListener('click', () => { limpiarFormularioOT(); irAPasoOT(1); });
  if (elBtnCopiarWhatsApp) elBtnCopiarWhatsApp.addEventListener('click', copiarPlantillaWhatsApp);
  if (elBtnImprimirFicha) elBtnImprimirFicha.addEventListener('click', () => {
    if (typeof imprimirFichaManual === 'function') imprimirFichaManual();
  });

  // Clic directo sobre el número del paso
  if (elWizardSteps) {
    elWizardSteps.querySelectorAll('.wizard-step').forEach(step => {
      step.addEventListener('click', () => irAPasoOT(Number(step.dataset.paso)));
    });
  }

  if (elOtCargadorDeja) elOtCargadorDeja.addEventListener('change', () => {
    if (elOtCargadorDatos) elOtCargadorDatos.style.display = elOtCargadorDeja.checked ? 'grid' : 'none';
  });

  if (elOtChips) {
    elOtChips.querySelectorAll('.chip').forEach(chip => {
      chip.addEventListener('click', () => {
        filtroEstadoOT = chip.dataset.estado || '';
        elOtChips.querySelectorAll('.chip').forEach(c => c.classList.toggle('active', c === chip));
        cargarOrdenes();
      });
    });
  }
  if (elOtBuscar) elOtBuscar.addEventListener('input', () => renderOrdenesTabla(ordenesList));
  if (elBtnOtRecargar) elBtnOtRecargar.addEventListener('click', cargarOrdenes);

  if (elBtnCerrarOtPreview) elBtnCerrarOtPreview.addEventListener('click', () => elModalOtPreview?.classList.remove('show'));
  if (elBtnImprimirOt) elBtnImprimirOt.addEventListener('click', () => {
    if (!ultimaOTCreada) return;
    // El nombre del PDF se define por el título del documento
    document.title = `${ultimaOTCreada.numero_ot || 'OT'} - SEVELIN`;
    imprimirOrdenTrabajo(ultimaOTCreada);
  });

  if (elBtnCancelarOtEntrega) elBtnCancelarOtEntrega.addEventListener('click', cerrarModalEntrega);
  if (elBtnConfirmarOtEntrega) elBtnConfirmarOtEntrega.addEventListener('click', confirmarEntrega);
  if (elBtnLimpiarFirma) elBtnLimpiarFirma.addEventListener('click', limpiarFirma);

  if (elBtnCerrarOtRepuestos) elBtnCerrarOtRepuestos.addEventListener('click', () => elModalOtRepuestos?.classList.remove('show'));
  if (elBtnAgregarOtRepuesto) elBtnAgregarOtRepuesto.addEventListener('click', agregarRepuestoAOT);
  if (elBtnCobrarOtDesdeModal) elBtnCobrarOtDesdeModal.addEventListener('click', () => {
    const id = elOtRepuestosId?.value;
    elModalOtRepuestos?.classList.remove('show');
    if (id) cobrarEnPOS(id);
  });
  if (elOtRepuestoBuscar) {
    elOtRepuestoBuscar.addEventListener('input', buscarRepuestoParaOT);
    document.addEventListener('click', (e) => {
      if (elOtRepuestoSugerencias && e.target !== elOtRepuestoBuscar && !elOtRepuestoSugerencias.contains(e.target)) {
        elOtRepuestoSugerencias.classList.remove('show');
      }
    });
  }

  if (elBtnCancelarOtNotas) elBtnCancelarOtNotas.addEventListener('click', () => elModalOtNotas?.classList.remove('show'));
  if (elBtnGuardarOtNotas) elBtnGuardarOtNotas.addEventListener('click', guardarNotasOT);

  [elModalOtPreview, elModalOtEntrega, elModalOtRepuestos, elModalOtNotas].forEach(overlay => {
    if (!overlay) return;
    overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.classList.remove('show'); });
  });
}

// ============================================================
// WIZARD
// ============================================================
function irAPasoOT(paso) {
  pasoActualOT = Math.min(Math.max(paso, 1), 3);

  document.querySelectorAll('.wizard-panel').forEach(p => {
    p.classList.toggle('active', Number(p.dataset.paso) === pasoActualOT);
  });
  document.querySelectorAll('.wizard-step').forEach(s => {
    const n = Number(s.dataset.paso);
    s.classList.toggle('active', n === pasoActualOT);
    s.classList.toggle('completo', n < pasoActualOT);
  });

  if (elBtnOtAnterior) elBtnOtAnterior.style.display = pasoActualOT === 1 ? 'none' : '';
  if (elBtnOtSiguiente) elBtnOtSiguiente.style.display = pasoActualOT === 3 ? 'none' : '';
  if (elBtnOtGuardar) elBtnOtGuardar.style.display = pasoActualOT === 3 ? '' : 'none';
}

function avanzarPasoOT(delta) {
  if (delta > 0 && !validarPasoOT(pasoActualOT)) return;
  irAPasoOT(pasoActualOT + delta);
}

function validarPasoOT(paso) {
  if (paso === 1 && !document.getElementById('otClienteNombre').value.trim()) {
    showToast('Ingresa el nombre del cliente', 'err');
    document.getElementById('otClienteNombre').focus();
    return false;
  }
  if (paso === 2 && !document.getElementById('otDispositivoModelo').value.trim()) {
    showToast('Indica el modelo del equipo', 'err');
    document.getElementById('otDispositivoModelo').focus();
    return false;
  }
  return true;
}

function leerFormularioOT() {
  const val = id => (document.getElementById(id)?.value || '').trim();
  const chk = id => !!document.getElementById(id)?.checked;

  return {
    cliente_rut: val('otClienteRut'),
    cliente_nombre: val('otClienteNombre'),
    cliente_telefono: val('otClienteTelefono'),
    cliente_correo: val('otClienteCorreo'),
    cliente_direccion: val('otClienteDireccion'),
    dispositivo_categoria: val('otDispositivoCategoria'),
    dispositivo_modelo: val('otDispositivoModelo'),
    dispositivo_sn: val('otDispositivoSN'),
    dispositivo_enciende: val('otDispositivoEnciende'),
    dispositivo_pin: val('otDispositivoPin'),
    cargador_deja: chk('otCargadorDeja'),
    cargador_tipo: val('otCargadorTipo'),
    cargador_voltaje: val('otCargadorVoltaje'),
    cargador_amperaje: val('otCargadorAmperaje'),
    cargador_cable: chk('otCargadorCable'),
    accesorios: val('otAccesorios'),
    falla_reportada: val('otFallaReportada'),
    obs_cliente: val('otObsCliente'),
    obs_tecnico: val('otObsTecnico'),
    obs_internas: val('otObsInternas'),   // privadas: nunca se imprimen
    acepta_responsabilidad: chk('otAceptaResponsabilidad')
  };
}

function limpiarFormularioOT() {
  ['otClienteRut', 'otClienteNombre', 'otClienteTelefono', 'otClienteCorreo', 'otClienteDireccion',
   'otDispositivoModelo', 'otDispositivoSN', 'otDispositivoPin', 'otCargadorTipo', 'otCargadorVoltaje',
   'otCargadorAmperaje', 'otAccesorios', 'otFallaReportada', 'otObsCliente', 'otObsTecnico']
    .forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; });

  ['otCargadorDeja', 'otCargadorCable'].forEach(id => { const el = document.getElementById(id); if (el) el.checked = false; });
  const acepta = document.getElementById('otAceptaResponsabilidad');
  if (acepta) acepta.checked = true;
  if (elOtCargadorDatos) elOtCargadorDatos.style.display = 'none';
}

async function guardarCheckIn() {
  if (!validarPasoOT(1) || !validarPasoOT(2)) return;

  const datos = leerFormularioOT();
  if (!datos.falla_reportada) {
    showToast('Describe la falla reportada', 'err');
    document.getElementById('otFallaReportada').focus();
    return;
  }

  if (elBtnOtGuardar) elBtnOtGuardar.disabled = true;

  try {
    const ot = await API.ot.crear(datos);
    ultimaOTCreada = ot;

    showToast(`Check-In registrado: ${ot.numero_ot}`, 'ok');
    limpiarFormularioOT();
    irAPasoOT(1);
    cargarOrdenes();

    // La impresión es opcional: se ofrece, no se dispara sola
    mostrarPreviewOT(ot);
  } catch (err) {
    console.error('Error al registrar el check-in:', err.message || err);
    showToast(err.message || 'No se pudo registrar la orden', 'err');
  } finally {
    if (elBtnOtGuardar) elBtnOtGuardar.disabled = false;
  }
}

function mostrarPreviewOT(ot) {
  ultimaOTCreada = ot;
  if (elOtPreviewTitulo) elOtPreviewTitulo.textContent = `Orden de Trabajo ${ot.numero_ot}`;
  if (elOtPreviewContenido) elOtPreviewContenido.innerHTML = construirComprobanteOT(ot, 'VISTA PREVIA');
  if (elModalOtPreview) elModalOtPreview.classList.add('show');
}

/* Plantilla para pedirle los datos al cliente por WhatsApp y no frenar
   la recepción del equipo mientras los busca. */
function plantillaWhatsApp() {
  return [
    `¡Hola! Gracias por dejar tu equipo en ${NEGOCIO_NOMBRE}.`,
    '',
    'Para completar tu orden de trabajo, ¿nos confirmas estos datos?',
    '',
    '1) Nombre y apellidos:',
    '2) RUT / ID (opcional):',
    '3) Teléfono de contacto (opcional):',
    '4) Correo electrónico (opcional):',
    '5) Dirección (opcional):',
    '',
    'También cuéntanos, si puedes:',
    '6) ¿Qué falla presenta el equipo?',
    '7) ¿Tiene clave o PIN de desbloqueo?',
    '',
    'Con eso queda lista tu recepción. ¡Gracias!'
  ].join('\n');
}

async function copiarPlantillaWhatsApp() {
  const texto = plantillaWhatsApp();

  // 1) API moderna del portapapeles (requiere HTTPS)
  try {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      await navigator.clipboard.writeText(texto);
      showToast('Plantilla copiada: pégala en WhatsApp', 'ok');
      return;
    }
  } catch (_) { /* se intenta el respaldo */ }

  // 2) Respaldo para navegadores antiguos o sitios sin HTTPS
  try {
    const area = document.createElement('textarea');
    area.value = texto;
    area.style.position = 'fixed';
    area.style.opacity = '0';
    document.body.appendChild(area);
    area.select();
    const copiado = typeof document.execCommand === 'function' && document.execCommand('copy');
    document.body.removeChild(area);

    if (copiado) { showToast('Plantilla copiada: pégala en WhatsApp', 'ok'); return; }
  } catch (_) { /* último recurso más abajo */ }

  // 3) Último recurso: se muestra el texto para copiarlo a mano
  window.prompt('Copia esta plantilla y envíala por WhatsApp:', texto);
}

// ============================================================
// PANEL DE ÓRDENES
// ============================================================
async function cargarOrdenes() {
  if (!tokenActual()) return;

  try {
    ordenesList = await API.ot.listar(filtroEstadoOT);
    renderOrdenesTabla(ordenesList);
  } catch (err) {
    console.error('Error al cargar las órdenes:', err.message || err);
    showToast(err.message || 'No se pudieron cargar las órdenes', 'err');
  }
}

function renderOrdenesTabla(lista) {
  if (!elOtTableBody) return;

  const filtro = (elOtBuscar?.value || '').trim().toLowerCase();
  const filas = (lista || []).filter(o => !filtro ||
    (o.numero_ot || '').toLowerCase().includes(filtro) ||
    (o.cliente_nombre || '').toLowerCase().includes(filtro) ||
    (o.cliente_rut || '').toLowerCase().includes(filtro) ||
    (o.dispositivo_modelo || '').toLowerCase().includes(filtro) ||
    (o.dispositivo_sn || '').toLowerCase().includes(filtro)
  );

  const pendientes = (lista || []).filter(o => o.estado === 'PENDIENTE').length;
  if (elOtResumenLabel) {
    elOtResumenLabel.textContent = `${filas.length} orden(es) en pantalla · ${pendientes} pendiente(s) en taller`;
  }

  if (filas.length === 0) {
    elOtTableBody.innerHTML = '<tr class="empty-row"><td colspan="7">No hay órdenes con este filtro.</td></tr>';
    return;
  }

  elOtTableBody.innerHTML = filas.map(o => {
    const pendiente = o.estado === 'PENDIENTE';
    return `
    <tr class="row-in${pendiente ? ' fila-pendiente' : ''}">
      <td class="strong">${escHtml(o.numero_ot)}</td>
      <td>${tsAChile(o.fecha_ingreso).slice(0, 10)}<br><small style="color:var(--text-muted);">${tsAChile(o.fecha_ingreso).slice(11)}</small></td>
      <td>${escHtml(o.cliente_nombre || '—')}${o.cliente_telefono ? `<br><small style="color:var(--text-muted);">${escHtml(o.cliente_telefono)}</small>` : ''}</td>
      <td>${escHtml(o.dispositivo_categoria || '')} ${escHtml(o.dispositivo_modelo || '')}${o.dispositivo_sn ? `<br><small style="color:var(--text-muted);">S/N: ${escHtml(o.dispositivo_sn)}</small>` : ''}</td>
      <td>${escHtml((o.falla_reportada || '').slice(0, 70))}${(o.falla_reportada || '').length > 70 ? '…' : ''}</td>
      <td><span class="badge ${pendiente ? 'badge-gold' : 'badge-green'}">${o.estado}</span></td>
      <td>
        <div class="cell-actions">
          ${pendiente ? `<button class="btn btn-green btn-sm" data-entregar="${o.id}" title="Check-Out / Entregar equipo">📦 Entregar</button>` : ''}
          <button class="btn btn-outline btn-sm" data-repuestos="${o.id}" title="Repuestos y mano de obra">🔩 Repuestos</button>
          <button class="btn btn-outline btn-sm" data-notas="${o.id}" title="Notas del taller (privadas)">🔒 Notas</button>
          <button class="btn btn-outline btn-sm" data-cobrar="${o.id}" title="Cobrar la reparación en el POS">💵 Cobrar en POS</button>
          <button class="btn btn-icon btn-icon-view" data-ver="${o.id}" title="Ver e imprimir la orden">${ICO_VER_OT}</button>
          <button class="btn btn-icon btn-icon-del admin-only" data-eliminar="${o.id}" title="Eliminar orden">${ICO_ELIMINAR_OT}</button>
        </div>
      </td>
    </tr>`;
  }).join('');

  elOtTableBody.querySelectorAll('button[data-ver]').forEach(btn => {
    btn.addEventListener('click', () => {
      const ot = ordenesList.find(o => String(o.id) === btn.dataset.ver);
      if (ot) mostrarPreviewOT(ot);
    });
  });
  elOtTableBody.querySelectorAll('button[data-entregar]').forEach(btn => {
    btn.addEventListener('click', () => abrirModalEntrega(btn.dataset.entregar));
  });
  elOtTableBody.querySelectorAll('button[data-repuestos]').forEach(btn => {
    btn.addEventListener('click', () => abrirModalOtRepuestos(btn.dataset.repuestos));
  });
  elOtTableBody.querySelectorAll('button[data-notas]').forEach(btn => {
    btn.addEventListener('click', () => abrirModalNotasOT(btn.dataset.notas));
  });
  elOtTableBody.querySelectorAll('button[data-cobrar]').forEach(btn => {
    btn.addEventListener('click', () => cobrarEnPOS(btn.dataset.cobrar));
  });
  elOtTableBody.querySelectorAll('button[data-eliminar]').forEach(btn => {
    btn.addEventListener('click', () => eliminarOrden(btn.dataset.eliminar));
  });
}

async function eliminarOrden(id) {
  if (!confirm('¿Eliminar esta orden de trabajo? Esta acción no se puede deshacer.')) return;
  try {
    await API.ot.eliminar(id);
    showToast('Orden eliminada', 'ok');
    cargarOrdenes();
  } catch (err) {
    showToast(err.message || 'No se pudo eliminar la orden', 'err');
  }
}

/* ============================================================
   REPUESTOS Y MANO DE OBRA DE UNA OT
   ============================================================ */
async function abrirModalOtRepuestos(id) {
  const ot = ordenesList.find(o => String(o.id) === String(id));
  if (!ot || !elModalOtRepuestos) return;

  if (elOtRepuestosId) elOtRepuestosId.value = ot.id;
  if (elOtRepuestosResumen) {
    elOtRepuestosResumen.innerHTML = `<b>${escHtml(ot.numero_ot)}</b> · ${escHtml(ot.cliente_nombre || 'Cliente')} · ${escHtml(ot.dispositivo_modelo || 'Equipo')}`;
  }
  limpiarFormularioRepuestoOT();

  try {
    otRepuestosActuales = await API.ot.listarRepuestos(ot.id);
  } catch (err) {
    otRepuestosActuales = [];
    showToast(err.message || 'No se pudieron cargar los repuestos de la OT', 'err');
  }

  renderRepuestosDeOT();
  elModalOtRepuestos.classList.add('show');
}

function limpiarFormularioRepuestoOT() {
  otRepuestoSeleccionado = null;
  [elOtRepuestoBuscar, elOtRepuestoNombre, elOtRepuestoCosto, elOtRepuestoPrecio]
    .forEach(el => { if (el) el.value = ''; });
  if (elOtRepuestoCantidad) elOtRepuestoCantidad.value = 1;
}

/* Busca tanto en el inventario de taller como en el catálogo comercial */
function buscarRepuestoParaOT() {
  if (!elOtRepuestoSugerencias) return;
  const q = (elOtRepuestoBuscar.value || '').trim().toLowerCase();

  if (q.length < 2) { elOtRepuestoSugerencias.classList.remove('show'); return; }

  const deTaller = (typeof buscarRepuestosPorTexto === 'function' ? buscarRepuestosPorTexto(q, 6) : [])
    .map(r => ({
      tipo: 'repuesto', id: r.id, etiqueta: `${r.modelo} · ${r.categoria}`,
      detalle: `Taller · stock ${r.stock ?? 0}`, costo: r.costo_unitario, precio: r.precio_venta
    }));

  const delCatalogo = (typeof productsList !== 'undefined' && Array.isArray(productsList) ? productsList : [])
    .filter(p => (p.nombre || '').toLowerCase().includes(q) || (p.sku || '').toLowerCase().includes(q))
    .slice(0, 5)
    .map(p => ({
      tipo: 'producto', id: p.id, etiqueta: p.nombre,
      detalle: `Catálogo · stock ${p.stock ?? 0}`, costo: p.costo_unitario, precio: p.precio_unitario
    }));

  const opciones = [...deTaller, ...delCatalogo];
  if (opciones.length === 0) { elOtRepuestoSugerencias.classList.remove('show'); return; }

  elOtRepuestoSugerencias.innerHTML = opciones.map((o, i) => `
    <div class="suggestion-item" data-idx="${i}">
      <span>${o.etiqueta}</span>
      <span>${fmtCLP(o.precio)} · ${o.detalle}</span>
    </div>
  `).join('');
  elOtRepuestoSugerencias.classList.add('show');

  elOtRepuestoSugerencias.querySelectorAll('.suggestion-item').forEach(item => {
    item.addEventListener('click', () => {
      const opcion = opciones[Number(item.dataset.idx)];
      otRepuestoSeleccionado = opcion;
      if (elOtRepuestoNombre) elOtRepuestoNombre.value = opcion.etiqueta;
      if (elOtRepuestoCosto) elOtRepuestoCosto.value = opcion.costo || 0;
      if (elOtRepuestoPrecio) elOtRepuestoPrecio.value = opcion.precio || 0;
      if (elOtRepuestoBuscar) elOtRepuestoBuscar.value = '';
      elOtRepuestoSugerencias.classList.remove('show');
      elOtRepuestoCantidad?.focus();
    });
  });
}

async function agregarRepuestoAOT() {
  const otId = elOtRepuestosId?.value;
  const nombre = (elOtRepuestoNombre?.value || '').trim();
  const precio = Number(elOtRepuestoPrecio?.value) || 0;

  if (!otId) return;
  if (!nombre) { showToast('Indica el repuesto o servicio', 'err'); elOtRepuestoNombre?.focus(); return; }
  if (precio <= 0) { showToast('Ingresa el precio a cobrar', 'err'); elOtRepuestoPrecio?.focus(); return; }

  try {
    await API.ot.agregarRepuesto(otId, {
      repuesto_id: otRepuestoSeleccionado?.tipo === 'repuesto' ? otRepuestoSeleccionado.id : null,
      producto_id: otRepuestoSeleccionado?.tipo === 'producto' ? otRepuestoSeleccionado.id : null,
      nombre,
      cantidad: Number(elOtRepuestoCantidad?.value) || 1,
      costo_unitario: Number(elOtRepuestoCosto?.value) || 0,
      precio_unitario: precio
    });

    const creado = await API.ot.listarRepuestos(otId);
    otRepuestosActuales = creado;
    renderRepuestosDeOT();
    limpiarFormularioRepuestoOT();
    showToast('Agregado a la orden', 'ok');
  } catch (err) {
    console.error('Error al agregar el repuesto:', err.message || err);
    showToast(err.message || 'No se pudo agregar', 'err');
  }
}

function renderRepuestosDeOT() {
  if (!elOtRepuestosLista) return;

  if (otRepuestosActuales.length === 0) {
    elOtRepuestosLista.innerHTML = '<p class="modal-hint">Aún no hay repuestos ni mano de obra asignados a esta orden.</p>';
  } else {
    elOtRepuestosLista.innerHTML = otRepuestosActuales.map(r => `
      <div class="edit-item-row">
        <div class="edit-item-nombre">
          <b>${r.nombre}</b>
          <div style="font-size:12px; color:var(--text-muted);">
            ${r.cantidad} × ${fmtCLP(r.precio_unitario)}
            ${r.repuesto_id ? ' · repuesto de taller' : (r.producto_id ? ' · catálogo' : ' · manual (no afecta inventario)')}
            ${r.stock_descontado ? ' · <span style="color:var(--green);">stock descontado</span>' : ''}
          </div>
        </div>
        <div class="edit-item-sub">
          <label>Subtotal</label>
          <strong>${fmtCLP((Number(r.precio_unitario) || 0) * (Number(r.cantidad) || 0))}</strong>
        </div>
        <button class="btn btn-icon btn-icon-del" data-quitar="${r.id}" title="Quitar de la orden">${ICO_ELIMINAR_OT}</button>
      </div>
    `).join('');

    elOtRepuestosLista.querySelectorAll('button[data-quitar]').forEach(btn => {
      btn.addEventListener('click', () => quitarRepuestoDeOT(btn.dataset.quitar));
    });
  }

  if (elOtRepuestosTotales) {
    const total = otRepuestosActuales.reduce((a, r) => a + (Number(r.precio_unitario) || 0) * (Number(r.cantidad) || 0), 0);
    const pendiente = otRepuestosActuales.filter(r => !r.cobrado)
      .reduce((a, r) => a + (Number(r.precio_unitario) || 0) * (Number(r.cantidad) || 0), 0);
    const yaDescontado = otRepuestosActuales.some(r => r.stock_descontado);
    elOtRepuestosTotales.innerHTML = `
      <span>Total asignado <b>${fmtCLP(total)}</b></span>
      <span>Por cobrar <b style="color:var(--red);">${fmtCLP(pendiente)}</b></span>
      <span style="color:var(--text-muted); font-size:12.5px;">
        ${yaDescontado ? '📦 Stock ya descontado (orden entregada)' : '📦 El stock se descuenta al entregar la orden'}
      </span>
    `;
  }
}

async function quitarRepuestoDeOT(id) {
  const otId = elOtRepuestosId?.value;
  if (!otId) return;

  try {
    await API.ot.quitarRepuesto(otId, id);
    otRepuestosActuales = await API.ot.listarRepuestos(otId);
    renderRepuestosDeOT();
    showToast('Quitado de la orden', 'ok');
  } catch (err) {
    showToast(err.message || 'No se pudo quitar', 'err');
  }
}

/* ============================================================
   NOTAS DEL TALLER (las internas nunca se imprimen)
   ============================================================ */
function abrirModalNotasOT(id) {
  const ot = ordenesList.find(o => String(o.id) === String(id));
  if (!ot || !elModalOtNotas) return;

  if (elOtNotasId) elOtNotasId.value = ot.id;
  if (elOtNotasResumen) {
    elOtNotasResumen.innerHTML = `<b>${escHtml(ot.numero_ot)}</b> · ${escHtml(ot.cliente_nombre || 'Cliente')} · ${escHtml(ot.dispositivo_modelo || 'Equipo')}`;
  }
  if (elOtNotasTecnico) elOtNotasTecnico.value = ot.obs_tecnico || '';
  if (elOtNotasInternas) elOtNotasInternas.value = ot.obs_internas || '';

  elModalOtNotas.classList.add('show');
  setTimeout(() => elOtNotasInternas?.focus(), 80);
}

async function guardarNotasOT() {
  const id = elOtNotasId?.value;
  const ot = ordenesList.find(o => String(o.id) === String(id));
  if (!ot) return;

  if (elBtnGuardarOtNotas) elBtnGuardarOtNotas.disabled = true;

  try {
    // Se reenvía la orden completa con las notas actualizadas
    await API.ot.actualizar(id, {
      ...ot,
      obs_tecnico: elOtNotasTecnico?.value.trim() || null,
      obs_internas: elOtNotasInternas?.value.trim() || null
    });

    showToast('Notas guardadas', 'ok');
    elModalOtNotas?.classList.remove('show');
    cargarOrdenes();
  } catch (err) {
    console.error('Error al guardar las notas:', err.message || err);
    showToast(err.message || 'No se pudieron guardar las notas', 'err');
  } finally {
    if (elBtnGuardarOtNotas) elBtnGuardarOtNotas.disabled = false;
  }
}

/* Puente al POS: vincula la OT a la venta en curso y baja al carrito los
   repuestos y la mano de obra que aún no se han cobrado. El stock recién
   se descuenta al finalizar la venta. */
async function cobrarEnPOS(id) {
  const ot = ordenesList.find(o => String(o.id) === String(id));
  if (!ot) return;

  let pendientes = [];
  try {
    const asignados = await API.ot.listarRepuestos(ot.id);
    pendientes = (asignados || []).filter(r => !r.cobrado);
  } catch (_) { pendientes = []; }

  if (typeof precargarVentaDesdeOT === 'function') precargarVentaDesdeOT(ot, pendientes);

  const btnPos = document.querySelector('.nav-btn[data-view="view-pos"]');
  if (btnPos) btnPos.click();

  showToast(`${ot.numero_ot} vinculada. Ingresa el servicio a cobrar.`, 'ok');
}

// ============================================================
// CHECK-OUT (entrega con firma)
// ============================================================
function abrirModalEntrega(id) {
  const ot = ordenesList.find(o => String(o.id) === String(id));
  if (!ot) return;

  otSeleccionadaEntrega = ot;
  if (elOtEntregaId) elOtEntregaId.value = ot.id;
  if (elOtEntregaResumen) {
    elOtEntregaResumen.innerHTML = `<b>${escHtml(ot.numero_ot)}</b> · ${escHtml(ot.cliente_nombre || 'Cliente')} · ${escHtml(ot.dispositivo_modelo || 'Equipo')}`;
  }
  if (elOtRetiraNombre) elOtRetiraNombre.value = ot.cliente_nombre || '';
  if (elOtRetiraRut) elOtRetiraRut.value = ot.cliente_rut || '';
  // La garantía del servicio siempre parte en 6 meses (pedido explícito
  // del dueño), editable acá mismo antes de confirmar la entrega.
  if (elOtEntregaMesesGarantia) elOtEntregaMesesGarantia.value = 6;

  limpiarFirma();
  if (elModalOtEntrega) elModalOtEntrega.classList.add('show');
}

function cerrarModalEntrega() {
  if (elModalOtEntrega) elModalOtEntrega.classList.remove('show');
  otSeleccionadaEntrega = null;
}

async function confirmarEntrega() {
  const id = elOtEntregaId?.value;
  if (!id) return;

  if (elBtnConfirmarOtEntrega) elBtnConfirmarOtEntrega.disabled = true;

  try {
    await API.ot.entregar(id, {
      retira_nombre: elOtRetiraNombre?.value.trim() || null,
      retira_rut: elOtRetiraRut?.value.trim() || null,
      meses_garantia: elOtEntregaMesesGarantia?.value.trim() ? Number(elOtEntregaMesesGarantia.value) : 6,
      retira_firma_base64: obtenerFirmaBase64()
    });

    showToast('Equipo entregado y registrado', 'ok');
    cerrarModalEntrega();
    cargarOrdenes();
  } catch (err) {
    console.error('Error al registrar la entrega:', err.message || err);
    showToast(err.message || 'No se pudo registrar la entrega', 'err');
  } finally {
    if (elBtnConfirmarOtEntrega) elBtnConfirmarOtEntrega.disabled = false;
  }
}

function obtenerFirmaBase64() {
  if (!firmaDibujada || !elOtFirmaCanvas) return null;
  try { return elOtFirmaCanvas.toDataURL('image/png'); } catch (_) { return null; }
}

/* ---------- Pad de firma ---------- */
function initFirmaCanvas() {
  if (!elOtFirmaCanvas || typeof elOtFirmaCanvas.getContext !== 'function') return;
  const ctx = elOtFirmaCanvas.getContext('2d');
  if (!ctx) return; // navegador sin soporte de canvas
  let dibujando = false;

  const posicion = (e) => {
    const r = elOtFirmaCanvas.getBoundingClientRect();
    const punto = e.touches ? e.touches[0] : e;
    return {
      x: (punto.clientX - r.left) * (elOtFirmaCanvas.width / r.width),
      y: (punto.clientY - r.top) * (elOtFirmaCanvas.height / r.height)
    };
  };

  const inicio = (e) => {
    e.preventDefault();
    dibujando = true;
    firmaDibujada = true;
    const p = posicion(e);
    ctx.beginPath();
    ctx.moveTo(p.x, p.y);
  };
  const mover = (e) => {
    if (!dibujando) return;
    e.preventDefault();
    const p = posicion(e);
    ctx.lineWidth = 2.2;
    ctx.lineCap = 'round';
    ctx.strokeStyle = '#0f172a';
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
  };
  const fin = () => { dibujando = false; };

  elOtFirmaCanvas.addEventListener('mousedown', inicio);
  elOtFirmaCanvas.addEventListener('mousemove', mover);
  window.addEventListener('mouseup', fin);
  elOtFirmaCanvas.addEventListener('touchstart', inicio, { passive: false });
  elOtFirmaCanvas.addEventListener('touchmove', mover, { passive: false });
  elOtFirmaCanvas.addEventListener('touchend', fin);

  limpiarFirma();
}

function limpiarFirma() {
  if (!elOtFirmaCanvas || typeof elOtFirmaCanvas.getContext !== 'function') return;
  const ctx = elOtFirmaCanvas.getContext('2d');
  if (!ctx) return;
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, elOtFirmaCanvas.width, elOtFirmaCanvas.height);
  firmaDibujada = false;
}

/* Las órdenes se cargan al iniciar sesión (evento de auth.js) */
document.addEventListener('pos:sesion-iniciada', () => cargarOrdenes());
