// ==========================================
// OT.JS - Servicio Técnico (Check-In / Check-Out)
// ------------------------------------------
// Wizard de 3 pasos, panel de órdenes y entrega con firma digital.
// Una OT NO se cobra desde acá (decisión del dueño, 12-09-2026): el cobro
// se hace aparte, como una venta normal del POS.
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
// Preguntas de diagnóstico (sql/70, v98)
const elBtnCopiarPreguntasDiag = document.getElementById('btnCopiarPreguntasDiag');
const elBtnEditarPreguntasDiag = document.getElementById('btnEditarPreguntasDiag');
const elModalPreguntasDiag = document.getElementById('modalPreguntasDiag');
const elPreguntasDiagEncabezado = document.getElementById('preguntasDiagEncabezado');
const elPreguntasDiagLista = document.getElementById('preguntasDiagLista');
const elPreguntasDiagCierre = document.getElementById('preguntasDiagCierre');
const elPreguntasDiagVista = document.getElementById('preguntasDiagVista');
const elBtnGuardarPreguntasDiag = document.getElementById('btnGuardarPreguntasDiag');
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

/* ---------- QR de retiro seguro (sql/47) ---------- */
const URL_RETIRO_TIENDA = 'https://sevelin.cl/retiro/';
const elBtnOtRetirarConQr = document.getElementById('btnOtRetirarConQr');
const elOtQrRetiroBloque = document.getElementById('otQrRetiroBloque');
const elOtQrRetiroImagen = document.getElementById('otQrRetiroImagen');
const elOtQrRetiroEstado = document.getElementById('otQrRetiroEstado');
const elBtnOtQrWhatsapp = document.getElementById('btnOtQrWhatsapp');
const elBtnOtQrCorreo = document.getElementById('btnOtQrCorreo');
const elBtnOtQrNuevo = document.getElementById('btnOtQrNuevo');
const elOtEntregaCodigo = document.getElementById('otEntregaCodigo');
const elBtnOtEntregaEscanear = document.getElementById('btnOtEntregaEscanear');
const elOtVerificacionQrCampos = document.getElementById('otVerificacionQrCampos');
const elOtVerificacionAviso = document.getElementById('otVerificacionAviso');
const elOtVerificacionAdminCampos = document.getElementById('otVerificacionAdminCampos');
const elOtEntregaPinAdmin = document.getElementById('otEntregaPinAdmin');
const elOtEntregaMotivoAdmin = document.getElementById('otEntregaMotivoAdmin');
const elOtEntregaFasesBloque = document.getElementById('otEntregaFasesBloque');
const elOtEntregaFasesAviso = document.getElementById('otEntregaFasesAviso');
const elOtEntregaFasesMotivoCampo = document.getElementById('otEntregaFasesMotivoCampo');
const elOtEntregaFasesMotivo = document.getElementById('otEntregaFasesMotivo');
// Sellos de garantía con S/N (sql/69): en el Check-Out y en el detalle de la orden.
const elOtEntregaSelloInput = document.getElementById('otEntregaSelloInput');
const elBtnOtEntregaSelloAgregar = document.getElementById('btnOtEntregaSelloAgregar');
const elOtEntregaSellosLista = document.getElementById('otEntregaSellosLista');
const elOtSellosBloque = document.getElementById('otSellosBloque');
const elOtSellosLista = document.getElementById('otSellosLista');
const elOtSelloInput = document.getElementById('otSelloInput');
const elBtnOtSelloAgregar = document.getElementById('btnOtSelloAgregar');
let otEntregaSellos = [];
// Fases obligatorias sin tachar de la OT que se está entregando (se leen al abrir el modal).
let otEntregaFasesPendientes = [];

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
  // Preguntas de diagnóstico (sql/70)
  elBtnCopiarPreguntasDiag?.addEventListener('click', copiarPreguntasDiag);
  elBtnEditarPreguntasDiag?.addEventListener('click', abrirModalPreguntasDiag);
  [elPreguntasDiagEncabezado, elPreguntasDiagLista, elPreguntasDiagCierre]
    .forEach(el => el?.addEventListener('input', actualizarVistaPreguntasDiag));
  elBtnGuardarPreguntasDiag?.addEventListener('click', guardarPreguntasDiag);
  document.getElementById('btnCancelarPreguntasDiag')?.addEventListener('click', () => elModalPreguntasDiag?.classList.remove('show'));
  document.getElementById('btnRestaurarPreguntasDiag')?.addEventListener('click', () => llenarModalPreguntasDiag(PREGUNTAS_DIAG_ORIGINALES));
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

  // QR de retiro seguro (sql/47)
  if (elBtnOtRetirarConQr) elBtnOtRetirarConQr.addEventListener('click', () => abrirEscaner('otQrRetiroLeido'));
  if (elBtnOtEntregaEscanear) elBtnOtEntregaEscanear.addEventListener('click', () => abrirEscaner('otEntregaCodigo'));
  document.querySelectorAll('input[name="otVerificacion"]').forEach(r => r.addEventListener('change', () => actualizarVerificacionEntrega(true)));
  if (elBtnOtQrWhatsapp) elBtnOtQrWhatsapp.addEventListener('click', enviarQrWhatsappOT);
  if (elBtnOtQrCorreo) elBtnOtQrCorreo.addEventListener('click', reenviarQrCorreoOT);
  if (elBtnOtQrNuevo) elBtnOtQrNuevo.addEventListener('click', generarQrNuevoOT);
  document.addEventListener('escaner:codigo', (e) => {
    if (e.detail?.inputId === 'otQrRetiroLeido') retirarOtConQr(e.detail.codigo);
  });
  if (elBtnLimpiarFirma) elBtnLimpiarFirma.addEventListener('click', limpiarFirma);

  // Sellos de garantía (sql/69). La pistola lectora termina con Enter: cada
  // Enter agrega el sello escaneado y deja el campo listo para el siguiente.
  elOtEntregaSelloInput?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { e.preventDefault(); e.stopPropagation(); agregarSelloEntrega(); }
  });
  elBtnOtEntregaSelloAgregar?.addEventListener('click', agregarSelloEntrega);
  elOtEntregaSellosLista?.addEventListener('click', (e) => {
    const b = e.target.closest('[data-quitar-sello]');
    if (!b) return;
    otEntregaSellos = otEntregaSellos.filter(sn => sn !== b.dataset.quitarSello);
    renderSellosEntrega();
  });
  elOtSelloInput?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { e.preventDefault(); e.stopPropagation(); agregarSelloOT(); }
  });
  elBtnOtSelloAgregar?.addEventListener('click', agregarSelloOT);
  elOtSellosLista?.addEventListener('click', (e) => {
    const b = e.target.closest('[data-quitar-sello-id]');
    if (b) quitarSelloOT(b.dataset.quitarSelloId);
  });

  if (elBtnCerrarOtRepuestos) elBtnCerrarOtRepuestos.addEventListener('click', () => elModalOtRepuestos?.classList.remove('show'));
  if (elBtnAgregarOtRepuesto) elBtnAgregarOtRepuesto.addEventListener('click', agregarRepuestoAOT);
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
    avisarCorreoQr(ot.correo_qr, ot);
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
  renderQrRetiroOT(ot);
  renderSellosOT(ot);
  if (elModalOtPreview) elModalOtPreview.classList.add('show');
}

/* ============================================================
   QR DE RETIRO SEGURO (sql/47)
   El dueño del equipo recibe su QR y decide a quién reenviarlo. Al
   entregar se exige el QR vigente o el carnet del titular.
   ============================================================ */
function renderQrRetiroOT(ot) {
  if (!elOtQrRetiroBloque) return;
  const botones = [elBtnOtQrWhatsapp, elBtnOtQrCorreo, elBtnOtQrNuevo];

  if (!ot || ot.estado === 'ENTREGADO') {
    const verificado = !!ot?.retiro_verificacion;
    elOtQrRetiroBloque.style.display = verificado ? 'block' : 'none';
    if (verificado) {
      // Sin QR que mostrar, el recuadro blanco del QR se oculta (antes quedaba
      // como una barra blanca vacía).
      if (elOtQrRetiroImagen) { elOtQrRetiroImagen.innerHTML = ''; elOtQrRetiroImagen.style.display = 'none'; }
      if (elOtQrRetiroEstado) {
        elOtQrRetiroEstado.innerHTML = `Entregado a <b>${escHtml(ot.retira_nombre || '—')}</b> (RUT ${escHtml(ot.retira_rut || '—')}), ${textoVerificacionRetiro(ot)}.`;
      }
      botones.forEach(b => { if (b) b.style.display = 'none'; });
    }
    return;
  }

  elOtQrRetiroBloque.style.display = 'block';
  botones.forEach(b => { if (b) b.style.display = ''; });

  if (!ot.token_retiro) {
    if (elOtQrRetiroImagen) { elOtQrRetiroImagen.innerHTML = ''; elOtQrRetiroImagen.style.display = 'none'; }
    if (elOtQrRetiroEstado) elOtQrRetiroEstado.textContent = 'Esta orden es anterior al QR de retiro. Genera uno para enviárselo al cliente.';
    if (elBtnOtQrWhatsapp) elBtnOtQrWhatsapp.style.display = 'none';
    if (elBtnOtQrCorreo) elBtnOtQrCorreo.style.display = 'none';
    if (elBtnOtQrNuevo) elBtnOtQrNuevo.textContent = '🔐 Generar QR';
    return;
  }

  if (elBtnOtQrNuevo) elBtnOtQrNuevo.textContent = '♻️ Generar QR nuevo';
  if (elBtnOtQrCorreo) elBtnOtQrCorreo.disabled = !ot.cliente_correo;
  if (elOtQrRetiroEstado) {
    elOtQrRetiroEstado.innerHTML = `Vigente desde ${tsAChile(ot.token_retiro_generado_en)}.${ot.cliente_correo ? '' : ' <b>La orden no tiene correo:</b> envíalo por WhatsApp.'}<br>Quien retire deberá mostrarlo, o ser el titular con su carnet.`;
  }
  if (elOtQrRetiroImagen) elOtQrRetiroImagen.style.display = '';
  if (elOtQrRetiroImagen && typeof QRCode !== 'undefined') {
    QRCode.toString(URL_RETIRO_TIENDA + ot.token_retiro, { type: 'svg', margin: 1, width: 124 }, (err, svg) => {
      elOtQrRetiroImagen.innerHTML = err ? '' : svg;
    });
  }
}

function otDelPreview() {
  if (!ultimaOTCreada) return null;
  return ordenesList.find(o => String(o.id) === String(ultimaOTCreada.id)) || ultimaOTCreada;
}

function avisarCorreoQr(correoQr, ot) {
  if (!correoQr) return;
  if (correoQr.enviado) showToast(`QR de retiro enviado a ${ot.cliente_correo}`, 'ok');
  else showToast(`QR de retiro NO enviado por correo: ${correoQr.motivo || 'sin detalle'}. Envíalo por WhatsApp desde la orden.`, 'err');
}

// "+56 9 1234 5678" → "56912345678"; un celular de 9 dígitos sin código → 56 delante.
function telefonoWhatsappOT(tel) {
  const d = String(tel || '').replace(/\D/g, '');
  if (!d) return '';
  return d.length === 9 ? '56' + d : d;
}

function mensajeQrWhatsappOT(ot) {
  const nombre = String(ot.cliente_nombre || '').trim().split(/\s+/)[0] || '';
  return [
    `Hola${nombre ? ' ' + nombre : ''}, recibimos tu equipo en ${NEGOCIO_NOMBRE} (orden ${ot.numero_ot}).`,
    '',
    'Este es tu código para retirarlo:',
    URL_RETIRO_TIENDA + ot.token_retiro,
    '',
    'Por tu seguridad, solo entregamos el equipo a quien muestre este código, o a ti con tu carnet. Si otra persona va a retirar, reenvíale este mensaje. No lo compartas con nadie más.'
  ].join('\n');
}

// Botón manual (decisión del dueño): abre su WhatsApp con el mensaje listo.
function enviarQrWhatsappOT() {
  const ot = otDelPreview();
  if (!ot?.token_retiro) return;
  const tel = telefonoWhatsappOT(ot.cliente_telefono);
  window.open(`https://wa.me/${tel}?text=${encodeURIComponent(mensajeQrWhatsappOT(ot))}`, '_blank', 'noopener');
}

async function reenviarQrCorreoOT() {
  const ot = otDelPreview();
  if (!ot) return;
  try {
    const r = await API.ot.enviarQr(ot.id);
    avisarCorreoQr(r.correo_qr, ot);
  } catch (err) {
    showToast(err.message || 'No se pudo reenviar el correo', 'err');
  }
}

async function generarQrNuevoOT() {
  const ot = otDelPreview();
  if (!ot) return;
  if (ot.token_retiro && !confirm('¿Generar un QR nuevo? El QR anterior dejará de servir de inmediato.')) return;
  try {
    const nueva = await API.ot.qrNuevo(ot.id);
    const i = ordenesList.findIndex(o => String(o.id) === String(ot.id));
    if (i >= 0) ordenesList[i] = { ...ordenesList[i], ...nueva };
    ultimaOTCreada = { ...ot, ...nueva };
    renderQrRetiroOT(ultimaOTCreada);
    showToast('QR nuevo generado: el anterior ya no sirve', 'ok');
    avisarCorreoQr(nueva.correo_qr, ultimaOTCreada);
  } catch (err) {
    showToast(err.message || 'No se pudo generar el QR', 'err');
  }
}

// Escanearon el QR desde "Retirar con QR": se abre la entrega de esa orden.
async function retirarOtConQr(codigo) {
  try {
    const ot = await API.ot.porQr(codigo);
    if (!ordenesList.some(o => String(o.id) === String(ot.id))) ordenesList.push(ot);
    abrirModalEntrega(ot.id, codigo);
  } catch (err) {
    showToast(err.message || 'QR no válido', 'err');
  }
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
  await copiarTextoParaWhatsApp(plantillaWhatsApp(), 'Plantilla copiada: pégala en WhatsApp');
}

/* Copia con los tres respaldos de siempre. Lo usan la plantilla de datos
   y las preguntas de diagnóstico. */
async function copiarTextoParaWhatsApp(texto, mensajeOk) {
  // 1) API moderna del portapapeles (requiere HTTPS)
  try {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      await navigator.clipboard.writeText(texto);
      showToast(mensajeOk, 'ok');
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

    if (copiado) { showToast(mensajeOk, 'ok'); return; }
  } catch (_) { /* último recurso más abajo */ }

  // 3) Último recurso: se muestra el texto para copiarlo a mano
  window.prompt('Copia este texto y envíalo por WhatsApp:', texto);
}

/* ============================================================
   PREGUNTAS DE DIAGNÓSTICO (sql/70, v98)
   Se guardan como lista SIN número en textos_editables; el número se pone
   acá al copiar, así nunca quedan saltos al editar. Se leen al iniciar
   sesión y quedan en memoria: el botón copia al instante (el portapapeles
   del navegador puede rechazar una copia que espera una respuesta del
   servidor). Si la base no responde, se usan las originales de abajo, que
   son las mismas que carga sql/70.
   ============================================================ */
const PREGUNTAS_DIAG_ORIGINALES = {
  encabezado: 'Para revisar tu equipo, respóndenos con el número de cada pregunta:',
  preguntas: [
    '¿Qué equipo es? (marca y modelo, si lo sabes)',
    '¿Qué problema tiene? Lo que ves o escuchas: no enciende, se apaga solo, se calienta, pantalla azul, ruidos, lentitud…',
    '¿Desde cuándo pasa? ¿Empezó de a poco o de un momento a otro?',
    '¿Pasó algo justo antes? (golpe, caída, líquido, corte de luz, actualización o programa nuevo)',
    '¿Pasa siempre o a ratos? ¿Con algo en particular? (al jugar, al cargar, al abrir un programa)',
    '¿Lo han abierto o reparado antes? ¿Dónde y qué le hicieron?',
    '¿Le han cambiado o agregado piezas? (disco, RAM, pantalla, batería, fuente)',
    '¿Notas alguna otra falla, o hay algo más que quieras que revisemos de paso?',
    '¿Tiene fotos o documentos importantes adentro? ¿Tienes respaldo?',
    '¿Lo traerás con cargador u otros accesorios?'
  ],
  cierre: 'Si tiene clave o PIN, tenla a mano para pedírtela, solo si hace falta para probarlo. ¡Gracias!'
};
let preguntasDiag = PREGUNTAS_DIAG_ORIGINALES;

async function cargarPreguntasDiag() {
  try {
    const r = await API.ot.leerTexto('preguntas_diagnostico');
    if (r?.contenido?.preguntas?.length) preguntasDiag = r.contenido;
  } catch (_) { /* quedan las originales */ }
}

function textoPreguntasDiag(c) {
  const partes = [];
  if (c.encabezado) partes.push(c.encabezado, '');
  (c.preguntas || []).forEach((p, i) => partes.push(`${i + 1}. ${p}`));
  if (c.cierre) partes.push('', c.cierre);
  return partes.join('\n');
}

async function copiarPreguntasDiag() {
  await copiarTextoParaWhatsApp(textoPreguntasDiag(preguntasDiag), 'Preguntas copiadas: pégalas en WhatsApp');
}

// Lo que hay escrito en el modal, con la misma limpieza que hace el servidor.
function preguntasDiagDelModal() {
  return {
    encabezado: (elPreguntasDiagEncabezado?.value || '').trim(),
    preguntas: (elPreguntasDiagLista?.value || '').split('\n')
      .map(l => l.trim().replace(/^\d{1,2}\s*[.)\-:]\s*/, ''))
      .filter(Boolean),
    cierre: (elPreguntasDiagCierre?.value || '').trim()
  };
}

function llenarModalPreguntasDiag(c) {
  if (elPreguntasDiagEncabezado) elPreguntasDiagEncabezado.value = c.encabezado || '';
  if (elPreguntasDiagLista) elPreguntasDiagLista.value = (c.preguntas || []).join('\n');
  if (elPreguntasDiagCierre) elPreguntasDiagCierre.value = c.cierre || '';
  actualizarVistaPreguntasDiag();
}

function actualizarVistaPreguntasDiag() {
  if (elPreguntasDiagVista) elPreguntasDiagVista.textContent = textoPreguntasDiag(preguntasDiagDelModal());
}

async function abrirModalPreguntasDiag() {
  if (!esAdmin() || !elModalPreguntasDiag) return;
  await cargarPreguntasDiag(); // lo último guardado, por si se editó desde otro equipo
  llenarModalPreguntasDiag(preguntasDiag);
  elModalPreguntasDiag.classList.add('show');
  setTimeout(() => elPreguntasDiagLista?.focus(), 80);
}

async function guardarPreguntasDiag() {
  const contenido = preguntasDiagDelModal();
  if (!contenido.preguntas.length) { showToast('Escribe al menos una pregunta', 'err'); return; }
  if (elBtnGuardarPreguntasDiag) elBtnGuardarPreguntasDiag.disabled = true;
  try {
    const r = await API.ot.guardarTexto('preguntas_diagnostico', contenido);
    preguntasDiag = r.contenido;
    elModalPreguntasDiag?.classList.remove('show');
    showToast('Preguntas guardadas', 'ok');
  } catch (err) {
    showToast(err.message || 'No se pudieron guardar las preguntas', 'err');
  } finally {
    if (elBtnGuardarPreguntasDiag) elBtnGuardarPreguntasDiag.disabled = false;
  }
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
  // Sellos de garantía (sql/69): mismo criterio que Garantías, solo letras y
  // números, así "sv 0002" encuentra SV-0002.
  const claveSello = t => String(t || '').replace(/[^0-9a-z]/gi, '').toUpperCase();
  const filtroSello = claveSello(filtro);
  const filas = (lista || []).filter(o => !filtro ||
    (filtroSello && (o.sellos || []).some(s => claveSello(s.numero_serie).includes(filtroSello))) ||
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
      <td><span class="badge ${pendiente ? 'badge-gold' : 'badge-green'}">${o.estado}</span>
          ${typeof insigniaAvanceOT === 'function' ? insigniaAvanceOT(o.id) : ''}</td>
      <td>
        <div class="cell-actions">
          ${pendiente ? `<button class="btn btn-green btn-sm" data-entregar="${o.id}" title="Check-Out / Entregar equipo">📦 Entregar</button>` : ''}
          <button class="btn btn-outline btn-sm" data-protocolo="${o.id}" title="Fases del protocolo de servicio">✅ Protocolo</button>
          <button class="btn btn-outline btn-sm" data-repuestos="${o.id}" title="Repuestos y mano de obra">🔩 Repuestos</button>
          <button class="btn btn-outline btn-sm" data-notas="${o.id}" title="Notas del taller (privadas)">🔒 Notas</button>
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
  elOtTableBody.querySelectorAll('button[data-protocolo]').forEach(btn => {
    btn.addEventListener('click', () => abrirModalProtocoloOT(btn.dataset.protocolo));
  });
  elOtTableBody.querySelectorAll('button[data-repuestos]').forEach(btn => {
    btn.addEventListener('click', () => abrirModalOtRepuestos(btn.dataset.repuestos));
  });
  elOtTableBody.querySelectorAll('button[data-notas]').forEach(btn => {
    btn.addEventListener('click', () => abrirModalNotasOT(btn.dataset.notas));
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

// ============================================================
// CHECK-OUT (entrega con firma)
// ============================================================
function abrirModalEntrega(id, codigoQr) {
  const ot = ordenesList.find(o => String(o.id) === String(id));
  if (!ot) return;

  otSeleccionadaEntrega = ot;
  if (elOtEntregaId) elOtEntregaId.value = ot.id;
  if (elOtEntregaResumen) {
    elOtEntregaResumen.innerHTML = `<b>${escHtml(ot.numero_ot)}</b> · ${escHtml(ot.cliente_nombre || 'Cliente')} · ${escHtml(ot.dispositivo_modelo || 'Equipo')}`;
  }
  // Verificación (sql/47): parte en QR; si llegó escaneado, ya trae el código.
  const radioQr = document.getElementById('otVerificacionQr');
  if (radioQr) radioQr.checked = true;
  if (elOtEntregaCodigo) elOtEntregaCodigo.value = codigoQr || '';
  if (elOtEntregaPinAdmin) elOtEntregaPinAdmin.value = '';
  if (elOtEntregaMotivoAdmin) elOtEntregaMotivoAdmin.value = '';
  if (elOtEntregaFasesMotivo) elOtEntregaFasesMotivo.value = '';
  otEntregaSellos = [];
  if (elOtEntregaSelloInput) elOtEntregaSelloInput.value = '';
  renderSellosEntrega();
  mostrarFasesPendientesEntrega(ot.id);
  actualizarVerificacionEntrega(true);
  // La garantía del servicio siempre parte en 6 meses (pedido explícito
  // del dueño), editable acá mismo antes de confirmar la entrega.
  if (elOtEntregaMesesGarantia) elOtEntregaMesesGarantia.value = 6;

  limpiarFirma();
  if (elModalOtEntrega) elModalOtEntrega.classList.add('show');
}

function cerrarModalEntrega() {
  if (elModalOtEntrega) elModalOtEntrega.classList.remove('show');
  // El PIN no queda escrito en el formulario después de cerrar.
  if (elOtEntregaPinAdmin) elOtEntregaPinAdmin.value = '';
  otSeleccionadaEntrega = null;
}

/* FASES OBLIGATORIAS SIN TACHAR (sql/66). El servidor ya exigía, para
   entregar así, sesión de admin + entrega_forzada_motivo; pero el modal
   nunca tuvo dónde escribirlo (visto en v96). Se leen al abrir: si faltan,
   el admin ve la lista y el campo del motivo; el trabajador ve que solo el
   admin puede. La regla la sigue haciendo cumplir el servidor. */
async function mostrarFasesPendientesEntrega(otId) {
  otEntregaFasesPendientes = [];
  if (elOtEntregaFasesBloque) elOtEntregaFasesBloque.style.display = 'none';
  let datos;
  try {
    datos = await API.protocolos.fasesDeOt(otId);
  } catch (_) {
    return; // Sin la lista, el servidor igual avisa al confirmar.
  }
  // El modal pudo cerrarse o cambiar de orden mientras llegaba la respuesta.
  if (String(elOtEntregaId?.value) !== String(otId)) return;
  otEntregaFasesPendientes = (datos?.fases || []).filter(f => f.obligatoria && !f.completada_en);
  if (!otEntregaFasesPendientes.length || !elOtEntregaFasesBloque) return;

  const nombres = otEntregaFasesPendientes.map(f => escHtml(f.nombre)).join(', ');
  const n = otEntregaFasesPendientes.length;
  elOtEntregaFasesBloque.style.display = '';
  if (elOtEntregaFasesMotivoCampo) elOtEntregaFasesMotivoCampo.style.display = esAdmin() ? '' : 'none';
  if (elOtEntregaFasesAviso) {
    elOtEntregaFasesAviso.innerHTML = esAdmin()
      ? `⚠️ Faltan <b>${n} fase(s) obligatoria(s)</b> del protocolo: ${nombres}. Puedes entregar igual escribiendo el motivo.`
      : `⚠️ Faltan <b>${n} fase(s) obligatoria(s)</b> del protocolo: ${nombres}. Solo el administrador puede entregar así: táchalas en el checklist o pídele que la entregue.`;
  }
}

/* ============================================================
   SELLOS DE GARANTÍA CON S/N (sql/69, v97)
   Mismo criterio que el servidor (normalizarSelloSN): sin espacios, en
   mayúsculas, 1-40 de A-Z 0-9 . _ / -. El servidor vuelve a validar y es
   el que rechaza un S/N que ya está en otra orden.
   ============================================================ */
function normalizarSelloOT(valor) {
  const limpio = String(valor || '').replace(/\s+/g, '').toUpperCase();
  return /^[A-Z0-9][A-Z0-9._/-]{0,39}$/.test(limpio) ? limpio : null;
}

function chipSelloHtml(sn, atributoQuitar) {
  return `<span class="sello-chip">🏷️ ${escHtml(sn)}${atributoQuitar
    ? ` <button type="button" class="sello-chip-quitar" ${atributoQuitar} title="Quitar" aria-label="Quitar sello ${escHtml(sn)}">✕</button>`
    : ''}</span>`;
}

// Devuelve true si agregó (o no había nada que agregar), false si el S/N no sirve.
function agregarSelloEntrega() {
  const crudo = elOtEntregaSelloInput?.value.trim() || '';
  if (!crudo) return true;
  const sn = normalizarSelloOT(crudo);
  if (!sn) {
    showToast('Ese S/N no es válido: solo letras, números y . _ / - (hasta 40)', 'err');
    elOtEntregaSelloInput?.focus();
    return false;
  }
  if (otEntregaSellos.includes(sn)) {
    showToast(`El sello ${sn} ya está en la lista`, 'err');
  } else if (otEntregaSellos.length >= 10) {
    showToast('Máximo 10 sellos por orden', 'err');
    return false;
  } else {
    otEntregaSellos.push(sn);
  }
  if (elOtEntregaSelloInput) elOtEntregaSelloInput.value = '';
  renderSellosEntrega();
  elOtEntregaSelloInput?.focus();
  return true;
}

function renderSellosEntrega() {
  if (!elOtEntregaSellosLista) return;
  elOtEntregaSellosLista.innerHTML = otEntregaSellos
    .map(sn => chipSelloHtml(sn, `data-quitar-sello="${escHtml(sn)}"`)).join('');
}

// Detalle de la orden: la lista viene embebida en GET /api/ot (ot.sellos).
function renderSellosOT(ot) {
  if (!elOtSellosBloque) return;
  if (!ot?.id) { elOtSellosBloque.style.display = 'none'; return; }
  elOtSellosBloque.style.display = 'block';
  const sellos = ot.sellos || [];
  if (elOtSellosLista) {
    elOtSellosLista.innerHTML = sellos.length
      ? sellos.map(s => chipSelloHtml(s.numero_serie, esAdmin() ? `data-quitar-sello-id="${escHtml(String(s.id))}"` : '')).join('')
      : '<span class="modal-hint" style="margin:0;">Sin sellos registrados.</span>';
  }
  if (elOtSelloInput) elOtSelloInput.value = '';
}

// Tras agregar o quitar: el comprobante de la vista previa también los muestra.
function refrescarPreviewSellos(ot) {
  if (elOtPreviewContenido) elOtPreviewContenido.innerHTML = construirComprobanteOT(ot, 'VISTA PREVIA');
  renderSellosOT(ot);
}

async function agregarSelloOT() {
  const ot = ultimaOTCreada;
  if (!ot?.id) return;
  const sn = normalizarSelloOT(elOtSelloInput?.value);
  if (!sn) {
    showToast('Escribe o escanea el S/N del sello (letras, números y . _ / -, hasta 40)', 'err');
    return;
  }
  if (elBtnOtSelloAgregar) elBtnOtSelloAgregar.disabled = true;
  try {
    const sello = await API.ot.agregarSello(ot.id, sn);
    ot.sellos = [...(ot.sellos || []), sello];
    refrescarPreviewSellos(ot);
    showToast(`Sello ${sello.numero_serie} registrado`, 'ok');
    elOtSelloInput?.focus();
  } catch (err) {
    showToast(err.message || 'No se pudo registrar el sello', 'err');
  } finally {
    if (elBtnOtSelloAgregar) elBtnOtSelloAgregar.disabled = false;
  }
}

async function quitarSelloOT(selloId) {
  const ot = ultimaOTCreada;
  const sello = (ot?.sellos || []).find(s => String(s.id) === String(selloId));
  if (!ot || !sello) return;
  if (!confirm(`¿Quitar el sello ${sello.numero_serie} de ${ot.numero_ot}?`)) return;
  try {
    await API.ot.quitarSello(ot.id, sello.id);
    ot.sellos = ot.sellos.filter(s => s.id !== sello.id);
    refrescarPreviewSellos(ot);
    showToast('Sello quitado', 'ok');
  } catch (err) {
    showToast(err.message || 'No se pudo quitar el sello', 'err');
  }
}

function verificacionElegidaOT() {
  return document.querySelector('input[name="otVerificacion"]:checked')?.value || 'QR';
}

/* QR: quien retira puede ser cualquiera; se anota su nombre y RUT.
   CARNET: es el titular; se precargan sus datos para compararlos con el carnet.
   ADMIN (v96): no hay ninguna de las dos; el admin autoriza con su PIN
   (validado en el servidor) y deja el motivo escrito. */
function actualizarVerificacionEntrega(rellenar) {
  const ot = otSeleccionadaEntrega;
  const modo = verificacionElegidaOT();
  if (elOtVerificacionQrCampos) elOtVerificacionQrCampos.style.display = modo === 'QR' ? '' : 'none';
  if (elOtVerificacionAdminCampos) elOtVerificacionAdminCampos.style.display = modo === 'ADMIN' ? '' : 'none';
  if (elOtVerificacionAviso) {
    elOtVerificacionAviso.innerHTML = modo === 'CARNET'
      ? (ot?.cliente_rut
        ? `Revisa que el carnet diga <b>${escHtml(ot.cliente_rut)}</b> (${escHtml(ot.cliente_nombre || '')}).`
        : '<b>Esta orden no tiene RUT del titular:</b> entrégala con el QR (si se perdió, genera uno nuevo desde la orden) o fuérzala con la clave de admin.')
      : modo === 'ADMIN'
        ? 'Úsalo solo si no hay QR ni carnet del titular. Anota igual el nombre y RUT de quien retira: todo queda registrado en la orden y en el comprobante.'
        : 'Escanea el QR que muestra quien retira y anota su nombre y RUT.';
  }
  if (!rellenar || !ot) return;
  if (elOtRetiraNombre) elOtRetiraNombre.value = modo === 'CARNET' ? (ot.cliente_nombre || '') : '';
  if (elOtRetiraRut) elOtRetiraRut.value = modo === 'CARNET' ? (ot.cliente_rut || '') : '';
}

async function confirmarEntrega() {
  const id = elOtEntregaId?.value;
  if (!id) return;

  const verificacion = verificacionElegidaOT();
  if (!elOtRetiraNombre?.value.trim() || !elOtRetiraRut?.value.trim()) {
    showToast('Registra el nombre y el RUT de quien retira', 'err');
    return;
  }
  if (verificacion === 'QR' && !elOtEntregaCodigo?.value.trim()) {
    showToast('Escanea el QR de quien retira, o elige verificar con carnet', 'err');
    return;
  }
  // Un S/N escrito sin presionar Enter también cuenta: no se pierde en silencio.
  if (elOtEntregaSelloInput?.value.trim() && !agregarSelloEntrega()) return;
  const motivoFases = elOtEntregaFasesMotivo?.value.trim() || '';
  if (otEntregaFasesPendientes.length && esAdmin() && !motivoFases) {
    showToast('Faltan fases obligatorias: escribe por qué se entrega igual', 'err');
    elOtEntregaFasesMotivo?.focus();
    return;
  }
  const motivoAdmin = elOtEntregaMotivoAdmin?.value.trim() || '';
  if (verificacion === 'ADMIN') {
    if (!elOtEntregaPinAdmin?.value.trim()) {
      showToast('Escribe el PIN de administrador', 'err');
      elOtEntregaPinAdmin?.focus();
      return;
    }
    if (motivoAdmin.length < 10) {
      showToast('Escribe el motivo (mínimo 10 letras): queda en la orden y en el comprobante', 'err');
      elOtEntregaMotivoAdmin?.focus();
      return;
    }
  }

  if (elBtnConfirmarOtEntrega) elBtnConfirmarOtEntrega.disabled = true;

  try {
    await API.ot.entregar(id, {
      retira_nombre: elOtRetiraNombre?.value.trim() || null,
      retira_rut: elOtRetiraRut?.value.trim() || null,
      verificacion,
      codigo_retiro: verificacion === 'QR' ? elOtEntregaCodigo?.value.trim() : null,
      pin_admin: verificacion === 'ADMIN' ? elOtEntregaPinAdmin?.value.trim() : undefined,
      verificacion_motivo: verificacion === 'ADMIN' ? motivoAdmin : undefined,
      entrega_forzada_motivo: motivoFases || undefined,
      sellos: otEntregaSellos,
      meses_garantia: elOtEntregaMesesGarantia?.value.trim() ? Number(elOtEntregaMesesGarantia.value) : 6,
      retira_firma_base64: obtenerFirmaBase64()
    });

    showToast('Equipo entregado y registrado', 'ok');
    cerrarModalEntrega();
    cargarOrdenes();
  } catch (err) {
    console.error('Error al registrar la entrega:', err.message || err);
    showToast(err.message || 'No se pudo registrar la entrega', 'err');
    // Un PIN rechazado no se deja escrito para el siguiente intento.
    if (verificacion === 'ADMIN' && elOtEntregaPinAdmin) elOtEntregaPinAdmin.value = '';
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
document.addEventListener('pos:sesion-iniciada', () => { cargarOrdenes(); cargarPreguntasDiag(); });
