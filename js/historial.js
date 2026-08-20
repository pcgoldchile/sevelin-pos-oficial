// ==========================================
// HISTORIAL.JS - Ventas e Historial (Sevelin)
// ------------------------------------------
//  · Muestra por defecto las ventas de HOY
//  · Filtros rápidos (Hoy / Semana / Mes / Año / Personalizado)
//  · KPIs + desglose de medios de pago
//  · PDF y Excel con resumen consolidado
//  · Edición de los ítems de una venta con recálculo de totales (admin)
//  · El trabajador solo ve y reimprime: sin costos, utilidades ni borrado
// ==========================================

let salesHistory = [];
let currentSaleDetails = null;
let accionPendientePeriodo = null;
let periodoActivo = 'hoy';
let periodoModal = 'hoy';
let ventaEditando = null;   // venta abierta en el modal de edición
let itemsEditando = [];     // copia editable de sus ítems
let filtroEstado = null;    // null = todas · 'PENDIENTE' = solo por pagar
let filtroEnvio = '';       // '' = todos · 'pendiente'|'preparacion'|'enviado'|'entregado'
let ordenHistorial = 'desc'; // 'desc' = más reciente primero · 'asc' = más antigua

/* Búsqueda por producto: texto que se manda al servidor para filtrar por
   el DETALLE de las ventas (nombre, SKU o número de serie del ítem).
   `itemsPorVenta` guarda los ítems que coincidieron, para poder mostrar
   en cada fila qué salió exactamente en esa venta. */
let filtroProducto = '';
let itemsPorVenta = {};
let ventasSeleccionadas = new Set();

/* El medio de pago real: si la venta nació "Por Pagar" y luego se cobró,
   manda el metodo_pago_final. */
const metodoDeVenta = v => v.metodo_pago_final || v.metodo_pago || 'Sin especificar';

/* ---------- DTE e IVA ----------
   Los precios del sistema son BRUTOS (IVA incluido), así que el IVA
   contenido en un monto es: monto / 1,19 * 0,19. */
const TIPOS_DTE = ['SIN DTE', 'BOLETA', 'FACTURA'];
const IVA_TASA = 0.19;

const dteDeVenta = v => TIPOS_DTE.includes(v.tipo_dte) ? v.tipo_dte : 'SIN DTE';
const ivaDeMonto = monto => (Number(monto) || 0) / (1 + IVA_TASA) * IVA_TASA;
const netoDeMonto = monto => (Number(monto) || 0) / (1 + IVA_TASA);

function claseDte(tipo) {
  if (tipo === 'BOLETA') return 'boleta';
  if (tipo === 'FACTURA') return 'factura';
  return 'sin';
}
const estaPendiente = v => (v.estado || 'PAGADA') === 'PENDIENTE';

/* ---------- Referencias del DOM ---------- */
const elHistorialTableBody = document.getElementById('historialTableBody');
const elHistFechaDesde = document.getElementById('histFechaDesde');
const elHistFechaHasta = document.getElementById('histFechaHasta');
const elBtnFiltrarHistorial = document.getElementById('btnFiltrarHistorial');
const elHistChips = document.getElementById('histChips');
const elHistPeriodoLabel = document.getElementById('histPeriodoLabel');

const elKpiVentas = document.getElementById('kpiVentasTotales');
const elKpiCantidad = document.getElementById('kpiCantidadVentas');
const elKpiUtilidad = document.getElementById('kpiUtilidadTotal');
const elKpiMargen = document.getElementById('kpiMargen');
const elKpiCosto = document.getElementById('kpiCostoTotal');
const elKpiTicket = document.getElementById('kpiTicketPromedio');
const elKpiRangoTexto = document.getElementById('kpiRangoTexto');
const elKpiPorPagar = document.getElementById('kpiPorPagar');
const elKpiPorPagarDetalle = document.getElementById('kpiPorPagarDetalle');
const elKpiPorPagarCard = document.getElementById('kpiPorPagarCard');
// Comisión del POS Tuu y utilidad neta (solo admin)
const elKpiComisionTuu = document.getElementById('kpiComisionTuu');
const elKpiComisionDetalle = document.getElementById('kpiComisionDetalle');
const elKpiUtilidadNeta = document.getElementById('kpiUtilidadNetaPos');
const elKpiMargenNeto = document.getElementById('kpiMargenNeto');
const elHistFiltroEstadoLabel = document.getElementById('histFiltroEstadoLabel');
const elBtnQuitarFiltroPendientes = document.getElementById('btnQuitarFiltroPendientes');
const elCheckTodasVentas = document.getElementById('checkTodasVentas');
const elPayBar = document.getElementById('payBar');
const elPayLegend = document.getElementById('payLegend');

const elHistBuscarProducto = document.getElementById('histBuscarProducto');
const elBtnLimpiarBusquedaProducto = document.getElementById('btnLimpiarBusquedaProducto');
const elBtnBuscarProductoTodo = document.getElementById('btnBuscarProductoTodo');
const elHistResultadoBusqueda = document.getElementById('histResultadoBusqueda');

const elModalDetalleVenta = document.getElementById('modalDetalleVenta');
const elDetalleVentaContent = document.getElementById('detalleVentaContent');
const elBtnCerrarDetalleVenta = document.getElementById('btnCerrarDetalleVenta');

const elBtnExportarHistorialExcel = document.getElementById('btnExportarHistorialExcel');
const elBtnExportarHistorialPDF = document.getElementById('btnExportarHistorialPDF');
const elBtnEliminarHistorialCompleto = document.getElementById('btnEliminarHistorialCompleto');
const elBtnEliminarPorPeriodo = document.getElementById('btnEliminarPorPeriodo');

const elModalExportarHistorial = document.getElementById('modalExportarHistorial');
const elTituloModalPeriodo = document.getElementById('tituloModalPeriodo');
const elHintModalPeriodo = document.getElementById('hintModalPeriodo');
const elModalPeriodoChips = document.getElementById('modalPeriodoChips');
const elExportDteChips = document.getElementById('exportDteChips');
const elExportDteBloque = document.getElementById('exportDteBloque');
const elModalPeriodoResumen = document.getElementById('modalPeriodoResumen');
const elExportFechasPersonalizadas = document.getElementById('exportFechasPersonalizadas');
const elExportFechaDesde = document.getElementById('exportFechaDesde');
const elExportFechaHasta = document.getElementById('exportFechaHasta');
const elBtnCancelarExportar = document.getElementById('btnCancelarExportar');
const elBtnExportarExcelModal = document.getElementById('btnExportarExcelModal');
const elBtnExportarPDFModal = document.getElementById('btnExportarPDFModal');
const elBtnConfirmarEliminarPeriodo = document.getElementById('btnConfirmarEliminarPeriodo');

const elInputImportarVentas = document.getElementById('inputImportarVentas');
const elBtnImportarVentas = document.getElementById('btnImportarVentas');

const elModalEditarVenta = document.getElementById('modalEditarVenta');
const elEditVentaId = document.getElementById('editVentaId');
const elEditVentaNumero = document.getElementById('editVentaNumero');
const elEditVentaFecha = document.getElementById('editVentaFecha');
const elEditVentaHora = document.getElementById('editVentaHora');
const elEditVentaCliente = document.getElementById('editVentaCliente');
const elEditVentaMetodoPago = document.getElementById('editVentaMetodoPago');
const elEditVentaItemsList = document.getElementById('editVentaItemsList');
const elEditVentaTotales = document.getElementById('editVentaTotales');
const elBtnAgregarItemVenta = document.getElementById('btnAgregarItemVenta');
const elBtnCancelarEditarVenta = document.getElementById('btnCancelarEditarVenta');
const elBtnGuardarEdicionVenta = document.getElementById('btnGuardarEdicionVenta');

/* ---------- Íconos ---------- */
const ICONO_VER = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>`;
const ICONO_EDITAR = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>`;
const ICONO_ELIMINAR = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M8 6V4h8v2"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/></svg>`;

const COLORES_PAGO = {
  'Efectivo': '#22c55e',
  'Transferencia': '#3b82f6',
  'Tarjeta Débito': '#a78bfa',
  'Tarjeta Crédito': '#fbbf24',
  'Por Pagar': '#ef4444'
};
const COLORES_EXTRA = ['#38bdf8', '#f472b6', '#facc15', '#34d399', '#94a3b8'];
const colorMedioPago = (nombre, idx) => COLORES_PAGO[nombre] || COLORES_EXTRA[idx % COLORES_EXTRA.length];

const ETIQUETAS_PERIODO = {
  hoy: 'Hoy', semana: 'Esta semana', mes: 'Este mes', anio: 'Este año', personalizado: 'Rango personalizado'
};

document.addEventListener('DOMContentLoaded', () => {
  setDefaultDatesHistorial();
  setupHistorialEventListeners();
});

function setDefaultDatesHistorial() {
  if (elHistFechaDesde) elHistFechaDesde.value = todayISO();
  if (elHistFechaHasta) elHistFechaHasta.value = todayISO();
  marcarChipActivo(elHistChips, 'hoy');
  actualizarEtiquetaPeriodo();
}

function setupHistorialEventListeners() {
  if (elBtnFiltrarHistorial) elBtnFiltrarHistorial.addEventListener('click', () => {
    periodoActivo = 'personalizado';
    marcarChipActivo(elHistChips, 'personalizado');
    cargarHistorial();
  });

  if (elHistChips) {
    elHistChips.querySelectorAll('.chip').forEach(chip => {
      chip.addEventListener('click', () => aplicarPeriodoVista(chip.dataset.periodo));
    });
  }

  // Calendario nativo: se abre al hacer clic en cualquier parte del campo
  [elHistFechaDesde, elHistFechaHasta, elExportFechaDesde, elExportFechaHasta, elEditVentaFecha].forEach(el => {
    if (!el) return;
    el.addEventListener('click', () => { if (typeof el.showPicker === 'function') { try { el.showPicker(); } catch (_) {} } });
  });

  [elHistFechaDesde, elHistFechaHasta].forEach(el => {
    if (!el) return;
    el.addEventListener('change', () => {
      periodoActivo = 'personalizado';
      marcarChipActivo(elHistChips, 'personalizado');
      cargarHistorial();
    });
  });

  // Tarjeta "Por Pagar": filtra la tabla por ventas pendientes
  if (elKpiPorPagarCard) {
    elKpiPorPagarCard.addEventListener('click', alternarFiltroPendientes);
    elKpiPorPagarCard.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); alternarFiltroPendientes(); }
    });
  }
  if (elBtnQuitarFiltroPendientes) elBtnQuitarFiltroPendientes.addEventListener('click', () => {
    filtroEstado = null;
    aplicarFiltroEstado();
  });

  // Punto 5: filtro por estado de envío y orden por fecha
  document.getElementById('histFiltroEnvio')?.addEventListener('change', (e) => {
    filtroEnvio = e.target.value || '';
    renderHistorialTabla(salesHistory);
  });
  document.getElementById('histOrden')?.addEventListener('change', (e) => {
    ordenHistorial = e.target.value === 'asc' ? 'asc' : 'desc';
    renderHistorialTabla(salesHistory);
  });

  /* ---------- Buscador por producto ---------- */
  if (elHistBuscarProducto) {
    /* Retardo antes de consultar: escribir "cargador" son 8 pulsaciones
       y sin esperar serían 8 consultas al servidor, cada una con su
       JOIN contra venta_items. Se dispara al parar de escribir. */
    let tempBusqueda = null;
    elHistBuscarProducto.addEventListener('input', () => {
      clearTimeout(tempBusqueda);
      tempBusqueda = setTimeout(() => buscarVentaUniversal(), 350);
    });

    // Enter busca al tiro, sin esperar el retardo
    elHistBuscarProducto.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') { e.preventDefault(); clearTimeout(tempBusqueda); buscarVentaUniversal(); }
      if (e.key === 'Escape') { e.preventDefault(); limpiarBusquedaProducto(); }
    });
  }

  if (elBtnLimpiarBusquedaProducto) elBtnLimpiarBusquedaProducto.addEventListener('click', limpiarBusquedaProducto);
  if (elBtnBuscarProductoTodo) elBtnBuscarProductoTodo.addEventListener('click', buscarProductoEnTodoElHistorial);

  if (elBtnCerrarDetalleVenta) elBtnCerrarDetalleVenta.addEventListener('click', cerrarDetalleVenta);
  if (elBtnEliminarHistorialCompleto) elBtnEliminarHistorialCompleto.addEventListener('click', eliminarTodoHistorial);

  if (elBtnExportarHistorialExcel) elBtnExportarHistorialExcel.addEventListener('click', () => abrirModalPeriodo('exportar', 'xlsx'));
  if (elBtnExportarHistorialPDF) elBtnExportarHistorialPDF.addEventListener('click', () => abrirModalPeriodo('exportar', 'pdf'));
  if (elBtnEliminarPorPeriodo) elBtnEliminarPorPeriodo.addEventListener('click', () => abrirModalPeriodo('eliminar'));

  if (elModalPeriodoChips) {
    elModalPeriodoChips.querySelectorAll('.chip').forEach(chip => {
      chip.addEventListener('click', () => seleccionarPeriodoModal(chip.dataset.periodo));
    });
  }

  if (elExportDteChips) {
    elExportDteChips.querySelectorAll('.chip').forEach(chip => {
      chip.addEventListener('click', () => {
        filtroDteExport = chip.dataset.dte || 'TODAS';
        elExportDteChips.querySelectorAll('.chip').forEach(c => c.classList.toggle('active', c === chip));
      });
    });
  }

  if (elBtnCancelarExportar) elBtnCancelarExportar.addEventListener('click', cerrarModalPeriodo);
  if (elBtnExportarExcelModal) elBtnExportarExcelModal.addEventListener('click', () => ejecutarAccionModal('xlsx'));
  if (elBtnExportarPDFModal) elBtnExportarPDFModal.addEventListener('click', () => ejecutarAccionModal('pdf'));
  if (elBtnConfirmarEliminarPeriodo) elBtnConfirmarEliminarPeriodo.addEventListener('click', () => ejecutarAccionModal('eliminar'));

  [elModalExportarHistorial, elModalDetalleVenta, elModalEditarVenta].forEach(overlay => {
    if (!overlay) return;
    overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.classList.remove('show'); });
  });

  if (elCheckTodasVentas) elCheckTodasVentas.addEventListener('change', () => {
    const visibles = ventasVisibles();
    if (elCheckTodasVentas.checked) visibles.forEach(v => ventasSeleccionadas.add(String(v.id)));
    else visibles.forEach(v => ventasSeleccionadas.delete(String(v.id)));
    renderHistorialTabla(salesHistory);
  });

  if (elBtnImportarVentas) elBtnImportarVentas.addEventListener('click', () => elInputImportarVentas?.click());
  if (elInputImportarVentas) elInputImportarVentas.addEventListener('change', handleImportarVentas);

  if (elBtnCancelarEditarVenta) elBtnCancelarEditarVenta.addEventListener('click', cerrarModalEditarVenta);
  if (elBtnGuardarEdicionVenta) elBtnGuardarEdicionVenta.addEventListener('click', guardarEdicionVenta);
  if (elBtnAgregarItemVenta) elBtnAgregarItemVenta.addEventListener('click', agregarItemAVentaEditada);
}

// ============================================================
// PERÍODOS
// ============================================================
function calcularRangoPeriodo(periodo) {
  const hoy = fechaChile();   // hoy según America/Santiago
  const hoyISO = todayISO();
  let desde = hoyISO;

  if (periodo === 'semana') {
    const dia = hoy.getDay();
    const diffLunes = (dia === 0 ? 6 : dia - 1);
    const lunes = new Date(hoy);
    lunes.setDate(hoy.getDate() - diffLunes);
    desde = isoLocal(lunes);
  } else if (periodo === 'mes') {
    desde = isoLocal(new Date(hoy.getFullYear(), hoy.getMonth(), 1));
  } else if (periodo === 'anio') {
    desde = isoLocal(new Date(hoy.getFullYear(), 0, 1));
  }

  return { desde, hasta: hoyISO };
}

function marcarChipActivo(contenedor, periodo) {
  if (!contenedor) return;
  contenedor.querySelectorAll('.chip').forEach(c => c.classList.toggle('active', c.dataset.periodo === periodo));
}

function aplicarPeriodoVista(periodo) {
  periodoActivo = periodo;
  marcarChipActivo(elHistChips, periodo);

  if (periodo !== 'personalizado') {
    const { desde, hasta } = calcularRangoPeriodo(periodo);
    if (elHistFechaDesde) elHistFechaDesde.value = desde;
    if (elHistFechaHasta) elHistFechaHasta.value = hasta;
    cargarHistorial();
  } else {
    actualizarEtiquetaPeriodo();
    try { elHistFechaDesde?.focus(); } catch (_) {}
  }
}

function actualizarEtiquetaPeriodo() {
  if (!elHistPeriodoLabel) return;
  const desde = elHistFechaDesde?.value || todayISO();
  const hasta = elHistFechaHasta?.value || todayISO();
  const etiqueta = ETIQUETAS_PERIODO[periodoActivo] || 'Período';
  elHistPeriodoLabel.textContent = desde === hasta ? `${etiqueta} · ${desde}` : `${etiqueta} · ${desde} a ${hasta}`;
  if (elKpiRangoTexto) elKpiRangoTexto.textContent = desde === hasta ? desde : `${desde} → ${hasta}`;
}

// ============================================================
// MODAL DE PERÍODO (Exportar / Eliminar)
// ============================================================
function abrirModalPeriodo(accion, formatoSugerido) {
  if (!esAdmin()) { showToast('Acción disponible solo para el administrador', 'err'); return; }

  accionPendientePeriodo = accion;
  const esEliminar = accion === 'eliminar';

  periodoModal = periodoActivo;
  marcarChipActivo(elModalPeriodoChips, periodoModal);
  if (elExportFechaDesde) elExportFechaDesde.value = elHistFechaDesde?.value || todayISO();
  if (elExportFechaHasta) elExportFechaHasta.value = elHistFechaHasta?.value || todayISO();
  actualizarVisibilidadFechasPersonalizadas();

  if (elTituloModalPeriodo) elTituloModalPeriodo.textContent = esEliminar ? 'Eliminar Ventas por Período' : 'Exportar Historial de Ventas';
  if (elHintModalPeriodo) {
    elHintModalPeriodo.textContent = esEliminar
      ? 'Elige el período que quieres eliminar. Esta acción no se puede deshacer.'
      : 'Elige el período y luego el formato de exportación.';
  }

  // El filtro tributario solo aplica al exportar
  filtroDteExport = 'TODAS';
  if (elExportDteChips) {
    elExportDteChips.querySelectorAll('.chip').forEach(c => c.classList.toggle('active', c.dataset.dte === 'TODAS'));
  }
  if (elExportDteBloque) elExportDteBloque.style.display = esEliminar ? 'none' : '';

  if (elBtnExportarExcelModal) elBtnExportarExcelModal.style.display = esEliminar ? 'none' : '';
  if (elBtnExportarPDFModal) elBtnExportarPDFModal.style.display = esEliminar ? 'none' : '';
  if (elBtnConfirmarEliminarPeriodo) elBtnConfirmarEliminarPeriodo.style.display = esEliminar ? '' : 'none';

  if (!esEliminar) {
    if (elBtnExportarExcelModal) elBtnExportarExcelModal.className = formatoSugerido === 'xlsx' ? 'btn btn-green' : 'btn btn-outline';
    if (elBtnExportarPDFModal) elBtnExportarPDFModal.className = formatoSugerido === 'pdf' ? 'btn btn-green' : 'btn btn-outline';
  }

  if (elModalExportarHistorial) elModalExportarHistorial.classList.add('show');
}

function cerrarModalPeriodo() {
  if (elModalExportarHistorial) elModalExportarHistorial.classList.remove('show');
}

function seleccionarPeriodoModal(periodo) {
  periodoModal = periodo;
  marcarChipActivo(elModalPeriodoChips, periodo);

  if (periodo !== 'personalizado') {
    const { desde, hasta } = calcularRangoPeriodo(periodo);
    if (elExportFechaDesde) elExportFechaDesde.value = desde;
    if (elExportFechaHasta) elExportFechaHasta.value = hasta;
  }
  actualizarVisibilidadFechasPersonalizadas();
}

function actualizarVisibilidadFechasPersonalizadas() {
  const esPersonalizado = periodoModal === 'personalizado';
  if (elExportFechasPersonalizadas) elExportFechasPersonalizadas.style.display = esPersonalizado ? 'grid' : 'none';
  if (elModalPeriodoResumen) {
    const d = elExportFechaDesde?.value || todayISO();
    const h = elExportFechaHasta?.value || todayISO();
    elModalPeriodoResumen.textContent = d === h ? `Período seleccionado: ${d}` : `Período seleccionado: ${d} a ${h}`;
  }
}

async function ejecutarAccionModal(formato) {
  let desde = elExportFechaDesde?.value;
  let hasta = elExportFechaHasta?.value;

  if (periodoModal !== 'personalizado') ({ desde, hasta } = calcularRangoPeriodo(periodoModal));
  if (!desde || !hasta) { showToast('Selecciona ambas fechas', 'err'); return; }
  if (desde > hasta) { showToast('La fecha "Desde" no puede ser mayor que "Hasta"', 'err'); return; }

  if (formato === 'eliminar') await ejecutarEliminarPorPeriodo(desde, hasta);
  else await ejecutarExportarPorPeriodo(formato, desde, hasta);
}

/* Aplica el filtro tributario elegido en el modal de exportación */
function filtrarPorDte(ventas) {
  const lista = ventas || [];
  if (filtroDteExport === 'TODAS') return lista;
  if (filtroDteExport === 'EMITIDOS') return lista.filter(v => dteDeVenta(v) !== 'SIN DTE');
  return lista.filter(v => dteDeVenta(v) === filtroDteExport);
}

/* Resumen tributario del conjunto exportado.
   Los precios son brutos: el IVA contenido es monto / 1,19 * 0,19.
   El IVA de las ventas SIN DTE se informa aparte como "IVA pendiente",
   porque todavía no se emitió documento por él. */
function resumenTributario(ventas) {
  const lista = ventas || [];
  const emitidas = lista.filter(v => dteDeVenta(v) !== 'SIN DTE');
  const sinDte = lista.filter(v => dteDeVenta(v) === 'SIN DTE');

  const totalOf = arr => arr.reduce((a, v) => a + (Number(v.total) || 0), 0);

  const totalGeneral = totalOf(lista);
  const totalEmitido = totalOf(emitidas);
  const totalSinDte = totalOf(sinDte);

  return {
    cantidad: lista.length,
    totalGeneral,
    neto: netoDeMonto(totalGeneral),
    ivaTotal: ivaDeMonto(totalGeneral),

    boletas: lista.filter(v => dteDeVenta(v) === 'BOLETA').length,
    facturas: lista.filter(v => dteDeVenta(v) === 'FACTURA').length,
    sinDteCantidad: sinDte.length,

    totalEmitido,
    ivaEmitido: ivaDeMonto(totalEmitido),
    totalSinDte,
    ivaPendiente: ivaDeMonto(totalSinDte)
  };
}

function etiquetaFiltroDte() {
  const etiquetas = {
    TODAS: 'Todas las ventas',
    BOLETA: 'Solo boletas',
    FACTURA: 'Solo facturas',
    'SIN DTE': 'Solo ventas sin DTE',
    EMITIDOS: 'Boletas + facturas'
  };
  return etiquetas[filtroDteExport] || 'Todas las ventas';
}

async function ejecutarExportarPorPeriodo(formato, desde, hasta) {
  try {
    const todas = await API.ventas.listar(desde, hasta);
    if (!todas || todas.length === 0) { showToast('No hay ventas en ese período', 'err'); return; }

    const ventas = filtrarPorDte(todas);
    if (ventas.length === 0) {
      showToast(`No hay ventas de tipo "${etiquetaFiltroDte()}" en ese período`, 'err');
      return;
    }

    if (formato === 'pdf') exportarHistorialPDF(ventas, desde, hasta);
    else exportarHistorial(formato, ventas, desde, hasta);

    cerrarModalPeriodo();
  } catch (err) {
    console.error('Error al exportar por período:', err.message || err);
    showToast(err.message || 'Error al exportar', 'err');
  }
}

async function ejecutarEliminarPorPeriodo(desde, hasta) {
  const pin = await pedirPinAdmin({
    titulo: 'Eliminar ventas del período',
    mensaje: `Se eliminarán TODAS las ventas entre ${desde} y ${hasta}. Esta acción no se puede deshacer.`,
    resumen: 'El stock de los productos vendidos en ese período volverá al inventario.'
  });
  if (!pin) return;

  try {
    await API.ventas.eliminarPeriodo(desde, hasta, pin);
    showToast('Ventas del período eliminadas', 'ok');
    cerrarModalPeriodo();
    cargarHistorial();
  } catch (err) {
    console.error('Error al eliminar ventas por período:', err.message || err);
    showToast(err.message || 'No se pudo eliminar', 'err');
  }
}

// ============================================================
// RESUMEN / KPIs
// ============================================================
function calcularResumen(ventas) {
  const lista = ventas || [];

  // Las ventas PENDIENTES ("Por Pagar") no suman a ventas, costos ni utilidades:
  // se contabilizan aparte hasta que se cobran.
  const cobradas = lista.filter(v => !estaPendiente(v));
  const pendientes = lista.filter(estaPendiente);

  const total = cobradas.reduce((a, v) => a + (Number(v.total) || 0), 0);
  const costo = cobradas.reduce((a, v) => a + (Number(v.costo_total) || 0), 0);
  const utilidad = cobradas.reduce((a, v) => {
    const u = (v.utilidad !== null && v.utilidad !== undefined)
      ? Number(v.utilidad)
      : (Number(v.total) || 0) - (Number(v.costo_total) || 0);
    return a + (u || 0);
  }, 0);

  const totalPendiente = pendientes.reduce((a, v) => a + (Number(v.total) || 0), 0);

  /* ---------- Comisión del POS Tuu y utilidad neta ----------
     · Utilidad Bruta   = Total Ventas − Costo Total   (la de siempre)
     · Comisión Tuu     = suma de las comisiones de las ventas con tarjeta
     · Utilidad Neta POS = Utilidad Bruta − Comisión Tuu

     Solo las ventas cobradas aportan comisión: una venta PENDIENTE todavía
     no pasó por la máquina. comisionDeVenta() (js/config.js) prioriza el
     valor guardado por el servidor y recalcula las ventas antiguas. */
  const comision = cobradas.reduce((a, v) => a + comisionDeVenta(v), 0);
  const ventasConComision = cobradas.filter(v => comisionDeVenta(v) > 0);
  const montoConComision = ventasConComision.reduce((a, v) => a + (Number(v.total) || 0), 0);
  const utilidadNeta = utilidad - comision;

  const mapa = {};
  cobradas.forEach(v => {
    const metodo = metodoDeVenta(v);
    if (!mapa[metodo]) mapa[metodo] = { nombre: metodo, monto: 0, cantidad: 0 };
    mapa[metodo].monto += Number(v.total) || 0;
    mapa[metodo].cantidad += 1;
  });

  const metodos = Object.values(mapa)
    .sort((a, b) => b.monto - a.monto)
    .map((m, i) => ({
      ...m,
      pct: total > 0 ? (m.monto / total) * 100 : (cobradas.length ? (m.cantidad / cobradas.length) * 100 : 0),
      color: colorMedioPago(m.nombre, i)
    }));

  return {
    cantidad: cobradas.length,
    cantidadTotal: lista.length,
    total, costo, utilidad,
    margen: total > 0 ? (utilidad / total) * 100 : 0,
    ticketPromedio: cobradas.length ? total / cobradas.length : 0,
    totalPendiente,
    cantidadPendiente: pendientes.length,
    metodos,

    // Desglose de comisión del POS Tuu
    utilidadBruta: utilidad,                 // alias explícito para los informes
    comision,
    utilidadNeta,
    margenNeto: total > 0 ? (utilidadNeta / total) * 100 : 0,
    ventasConComision: ventasConComision.length,
    montoConComision
  };
}

function animarValor(el, valorFinal) {
  if (!el) return;
  const inicio = Number(el.dataset.valor) || 0;
  const duracion = 420;
  const t0 = performance.now();
  el.dataset.valor = valorFinal;

  const sinAnimacion = typeof requestAnimationFrame !== 'function' ||
    (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);

  if (sinAnimacion) { el.textContent = fmtCLP(valorFinal); return; }

  function paso(t) {
    const p = Math.min((t - t0) / duracion, 1);
    const eased = 1 - Math.pow(1 - p, 3);
    el.textContent = fmtCLP(inicio + (valorFinal - inicio) * eased);
    if (p < 1) requestAnimationFrame(paso);
  }
  requestAnimationFrame(paso);
}

function renderResumenHistorial(ventas) {
  const r = calcularResumen(ventas);

  animarValor(elKpiVentas, r.total);
  animarValor(elKpiUtilidad, r.utilidad);
  animarValor(elKpiCosto, r.costo);
  animarValor(elKpiTicket, r.ticketPromedio);

  if (elKpiCantidad) elKpiCantidad.textContent = `${r.cantidad} ${r.cantidad === 1 ? 'venta cobrada' : 'ventas cobradas'}`;
  if (elKpiMargen) elKpiMargen.textContent = `Margen ${r.margen.toFixed(1)}%`;

  /* ---------- Comisión del POS Tuu ----------
     Se muestran los tres números por separado para que quede claro cuánto
     se está yendo en comisiones: Bruta → Comisión → Neta. */
  animarValor(elKpiComisionTuu, r.comision);
  animarValor(elKpiUtilidadNeta, r.utilidadNeta);

  if (elKpiComisionDetalle) {
    elKpiComisionDetalle.textContent = r.ventasConComision === 0
      ? 'Sin ventas con tarjeta en el período'
      : `${r.ventasConComision} ${r.ventasConComision === 1 ? 'venta' : 'ventas'} con tarjeta · ${fmtCLP(r.montoConComision)}`;
  }
  if (elKpiMargenNeto) {
    elKpiMargenNeto.textContent = `Bruta − comisión · Margen ${r.margenNeto.toFixed(1)}%`;
  }

  // Pendientes de pago (no suman a los totales de arriba)
  animarValor(elKpiPorPagar, r.totalPendiente);
  if (elKpiPorPagarDetalle) {
    elKpiPorPagarDetalle.textContent = r.cantidadPendiente === 0
      ? 'Sin ventas pendientes'
      : `${r.cantidadPendiente} ${r.cantidadPendiente === 1 ? 'venta pendiente' : 'ventas pendientes'} · clic para filtrar`;
  }
  if (elKpiPorPagarCard) elKpiPorPagarCard.classList.toggle('sin-datos', r.cantidadPendiente === 0);

  if (elPayBar) {
    elPayBar.innerHTML = r.metodos.map(m =>
      `<span style="width:${m.pct}%; background:${m.color};" title="${m.nombre}: ${m.pct.toFixed(1)}%"></span>`
    ).join('');
  }
  if (elPayLegend) {
    elPayLegend.innerHTML = r.metodos.length
      ? r.metodos.map(m => `
          <span class="pay-item">
            <span class="dot" style="background:${m.color};"></span>
            ${m.nombre} <b>${m.pct.toFixed(0)}%</b>
            <span style="color:var(--text-muted);">(${fmtCLP(m.monto)})</span>
          </span>`).join('')
      : '<span class="pay-item" style="color:var(--text-muted);">Sin ventas en el período</span>';
  }

  actualizarEtiquetaPeriodo();
  return r;
}

// ============================================================
// EXPORTAR (Excel / CSV / PDF)
// ============================================================
function obtenerFilasHistorialParaExportar(ventas) {
  return (ventas || []).map(v => ({
    'N° Orden': v.numero_orden ?? v.id,
    Fecha: v.fecha || '',
    Hora: v.hora || '',
    Cliente: v.cliente || 'Consumidor Final',
    'Método de Pago': metodoDeVenta(v),
    Estado: estaPendiente(v) ? 'PENDIENTE' : 'PAGADA',
    DTE: dteDeVenta(v),
    'Neto (sin IVA)': Math.round(netoDeMonto(v.total)),
    'IVA (19%)': Math.round(ivaDeMonto(v.total)),
    Total: Number(v.total) || 0,
    'Costo Total': Number(v.costo_total) || 0,
    // Utilidad Bruta = Total - Costo. La comisión Tuu se resta aparte.
    'Utilidad Bruta': Number(v.utilidad) || 0,
    'Comisión Tuu': comisionDeVenta(v),
    'Utilidad Neta POS': (Number(v.utilidad) || 0) - comisionDeVenta(v)
  }));
}

function exportarHistorial(formato, ventas, desde, hasta) {
  const filas = obtenerFilasHistorialParaExportar(ventas);
  if (filas.length === 0) { showToast('No hay ventas en este rango para exportar', 'err'); return; }

  const r = calcularResumen(ventas);
  const t = resumenTributario(ventas);
  const libro = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(libro, XLSX.utils.json_to_sheet(filas), 'Ventas');

  const resumen = [
    { Concepto: 'Período', Valor: `${desde} a ${hasta}` },
    { Concepto: 'Cantidad de ventas', Valor: r.cantidad },
    { Concepto: 'Total de Ventas', Valor: r.total },
    { Concepto: 'Costo Total', Valor: r.costo },
    { Concepto: '', Valor: '' },
    { Concepto: 'RENTABILIDAD (comisión POS Tuu)', Valor: 'monto x 0,0079 + 65 en tarjetas' },
    { Concepto: 'Utilidad Bruta (Ventas - Costo)', Valor: Math.round(r.utilidadBruta) },
    { Concepto: 'Comisión Tuu', Valor: Math.round(r.comision) },
    { Concepto: 'Utilidad Neta POS (Bruta - Comisión)', Valor: Math.round(r.utilidadNeta) },
    { Concepto: 'Ventas con tarjeta (afectas)', Valor: r.ventasConComision },
    { Concepto: 'Monto cobrado con tarjeta', Valor: Math.round(r.montoConComision) },
    { Concepto: 'Margen Bruto (%)', Valor: Number(r.margen.toFixed(1)) },
    { Concepto: 'Margen Neto (%)', Valor: Number(r.margenNeto.toFixed(1)) },
    { Concepto: '', Valor: '' },
    { Concepto: 'Pendientes por cobrar', Valor: r.totalPendiente },
    { Concepto: 'Cantidad pendientes', Valor: r.cantidadPendiente },
    { Concepto: '', Valor: '' },
    { Concepto: 'RESUMEN TRIBUTARIO', Valor: etiquetaFiltroDte() },
    { Concepto: 'Total General (bruto)', Valor: Math.round(t.totalGeneral) },
    { Concepto: 'Neto (sin IVA)', Valor: Math.round(t.neto) },
    { Concepto: 'IVA Total (19%)', Valor: Math.round(t.ivaTotal) },
    { Concepto: 'Boletas', Valor: t.boletas },
    { Concepto: 'Facturas', Valor: t.facturas },
    { Concepto: 'Sin DTE', Valor: t.sinDteCantidad },
    { Concepto: 'Total con DTE emitido', Valor: Math.round(t.totalEmitido) },
    { Concepto: 'IVA Emitido', Valor: Math.round(t.ivaEmitido) },
    { Concepto: 'Total sin DTE', Valor: Math.round(t.totalSinDte) },
    { Concepto: 'IVA PENDIENTE (sin documentar)', Valor: Math.round(t.ivaPendiente) },
    { Concepto: '', Valor: '' },
    { Concepto: 'MEDIOS DE PAGO', Valor: '% del período' }
  ].concat(r.metodos.map(m => ({ Concepto: m.nombre, Valor: `${m.pct.toFixed(1)}% (${fmtCLP(m.monto)})` })));

  if (formato !== 'csv') XLSX.utils.book_append_sheet(libro, XLSX.utils.json_to_sheet(resumen), 'Resumen');

  XLSX.writeFile(libro, `ventas_${desde}_a_${hasta}.${formato}`, { bookType: formato === 'csv' ? 'csv' : 'xlsx' });
  showToast('Exportación generada', 'ok');
}

function exportarHistorialPDF(ventas, desde, hasta) {
  const filas = obtenerFilasHistorialParaExportar(ventas);
  if (filas.length === 0) { showToast('No hay ventas en este rango para exportar', 'err'); return; }
  if (typeof window.jspdf === 'undefined') { showToast('No se pudo cargar el generador de PDF', 'err'); return; }

  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ orientation: 'landscape' });
  const r = calcularResumen(ventas);
  const t = resumenTributario(ventas);

  doc.setFontSize(15);
  doc.setTextColor(15, 23, 42);
  doc.text(`Historial de Ventas - ${NEGOCIO_NOMBRE}`, 14, 15);

  doc.setFontSize(9);
  doc.setTextColor(71, 85, 105);
  doc.text(`Período: ${desde} a ${hasta}   ·   ${r.cantidad} venta(s) cobrada(s)   ·   Filtro: ${etiquetaFiltroDte()}   ·   Generado: ${fechaHoraISOChile()} (hora de Chile)`, 14, 21);

  const anchoUtil = doc.internal.pageSize.getWidth() - 28;
  doc.setDrawColor(203, 213, 225);
  doc.setFillColor(241, 245, 249);
  doc.roundedRect(14, 25, anchoUtil, 20, 2, 2, 'FD');

  doc.setFontSize(10);
  doc.setTextColor(15, 23, 42);
  doc.setFont(undefined, 'bold');
  doc.text(`Total de Ventas: ${fmtCLP(r.total)}`, 19, 32);
  doc.text(`Costo Total: ${fmtCLP(r.costo)}`, 105, 32);
  doc.text(`Ticket Promedio: ${fmtCLP(r.ticketPromedio)}`, 180, 32);

  doc.setFont(undefined, 'normal');
  doc.setFontSize(9);
  doc.setTextColor(51, 65, 85);
  const desglose = r.metodos.length
    ? r.metodos.map(m => `${m.pct.toFixed(0)}% ${m.nombre} (${fmtCLP(m.monto)})`).join('   ·   ')
    : 'Sin registros';
  doc.text(`Medios de pago:  ${desglose}`, 19, 39, { maxWidth: anchoUtil - 10 });

  /* ---------- RENTABILIDAD: los tres números por separado ----------
     Recuadro propio para que la comisión del POS Tuu no quede escondida
     dentro de la utilidad. Es el desglose que pide el informe:
       Utilidad Bruta  →  Comisión Tuu  →  Utilidad Neta POS          */
  let cursorY = 47;
  doc.setDrawColor(191, 219, 254);
  doc.setFillColor(239, 246, 255);
  doc.roundedRect(14, cursorY, anchoUtil, 19, 2, 2, 'FD');

  doc.setFontSize(10);
  doc.setFont(undefined, 'bold');
  doc.setTextColor(15, 23, 42);
  doc.text(`Utilidad Bruta: ${fmtCLP(r.utilidadBruta)}`, 19, cursorY + 7);

  doc.setTextColor(185, 28, 28);
  doc.text(`(-) Comisión Tuu: ${fmtCLP(r.comision)}`, 105, cursorY + 7);

  doc.setTextColor(21, 128, 61);
  doc.text(`= Utilidad Neta POS: ${fmtCLP(r.utilidadNeta)}`, 180, cursorY + 7);

  doc.setFont(undefined, 'normal');
  doc.setFontSize(8);
  doc.setTextColor(51, 65, 85);
  doc.text(
    `Comisión POS Tuu Haulmer Pro 2 = monto x 0,0079 + $65 por transacción con tarjeta (débito o crédito). ` +
    `Afecta a ${r.ventasConComision} venta(s) por ${fmtCLP(r.montoConComision)}. ` +
    `Efectivo y transferencia no pagan comisión.   |   Margen bruto ${r.margen.toFixed(1)}%  ·  Margen neto ${r.margenNeto.toFixed(1)}%`,
    19, cursorY + 14, { maxWidth: anchoUtil - 10 }
  );
  cursorY += 23;

  if (r.cantidadPendiente > 0) {
    doc.setFontSize(9);
    doc.setTextColor(185, 28, 28);
    doc.text(`Pendientes por cobrar: ${fmtCLP(r.totalPendiente)} en ${r.cantidadPendiente} venta(s) — no incluidas en los totales.`, 19, cursorY);
    doc.setTextColor(51, 65, 85);
    cursorY += 6;
  }

  /* Recuadro tributario. Su contenido cambia según el filtro elegido:
     - Solo Sin DTE  → destaca el IVA PENDIENTE de documentar.
     - Todas         → Total General + IVA emitido + IVA pendiente.
     - Boleta/Factura/Emitidos → neto e IVA del documento emitido. */
  const soloSinDte = filtroDteExport === 'SIN DTE';
  const esTodas = filtroDteExport === 'TODAS';

  doc.setDrawColor(soloSinDte ? 220 : 203, soloSinDte ? 160 : 213, soloSinDte ? 160 : 225);
  doc.setFillColor(soloSinDte ? 254 : 241, soloSinDte ? 242 : 245, soloSinDte ? 242 : 249);
  doc.roundedRect(14, cursorY, anchoUtil, esTodas ? 20 : 15, 2, 2, 'FD');

  doc.setFontSize(10);
  doc.setFont(undefined, 'bold');

  if (soloSinDte) {
    doc.setTextColor(153, 27, 27);
    doc.text(`IVA PENDIENTE DE DOCUMENTAR: ${fmtCLP(t.ivaPendiente)}`, 19, cursorY + 7);
    doc.setFont(undefined, 'normal');
    doc.setFontSize(9);
    doc.text(`Sobre ${fmtCLP(t.totalSinDte)} en ${t.sinDteCantidad} venta(s) sin documento tributario emitido.`, 19, cursorY + 12);
    cursorY += 15;
  } else if (esTodas) {
    doc.setTextColor(15, 23, 42);
    doc.text(`Total General: ${fmtCLP(t.totalGeneral)}`, 19, cursorY + 7);
    doc.text(`IVA Emitido: ${fmtCLP(t.ivaEmitido)}`, 110, cursorY + 7);
    doc.setTextColor(153, 27, 27);
    doc.text(`IVA Pendiente: ${fmtCLP(t.ivaPendiente)}`, 195, cursorY + 7);

    doc.setFont(undefined, 'normal');
    doc.setFontSize(9);
    doc.setTextColor(51, 65, 85);
    doc.text(`${t.boletas} boleta(s) · ${t.facturas} factura(s) · ${t.sinDteCantidad} sin DTE   |   Documentado: ${fmtCLP(t.totalEmitido)}   ·   Sin documentar: ${fmtCLP(t.totalSinDte)}`,
      19, cursorY + 14, { maxWidth: anchoUtil - 10 });
    cursorY += 20;
  } else {
    doc.setTextColor(15, 23, 42);
    doc.text(`Neto: ${fmtCLP(t.neto)}`, 19, cursorY + 7);
    doc.text(`IVA (19%): ${fmtCLP(t.ivaTotal)}`, 110, cursorY + 7);
    doc.text(`Total Bruto: ${fmtCLP(t.totalGeneral)}`, 195, cursorY + 7);
    cursorY += 15;
  }

  doc.setFont(undefined, 'normal');
  doc.setTextColor(51, 65, 85);

  doc.autoTable({
    startY: cursorY + 4,
    /* Tres columnas de rentabilidad al final: bruta, comisión y neta.
       La fuente baja a 7,5 pt porque son 11 columnas en horizontal. */
    head: [['N° Orden', 'Fecha y Hora', 'Cliente', 'Método de Pago', 'DTE', 'Neto', 'IVA', 'Total', 'Util. Bruta', 'Com. Tuu', 'Util. Neta']],
    body: filas.map(f => [
      String(f['N° Orden']).padStart(5, '0'),
      `${f.Fecha}${f.Hora ? ' ' + f.Hora : ''}`,
      f.Cliente, f['Método de Pago'], f.DTE,
      fmtCLP(f['Neto (sin IVA)']), fmtCLP(f['IVA (19%)']),
      fmtCLP(f.Total),
      fmtCLP(f['Utilidad Bruta']),
      f['Comisión Tuu'] > 0 ? '-' + fmtCLP(f['Comisión Tuu']) : '—',
      fmtCLP(f['Utilidad Neta POS'])
    ]),
    styles: { fontSize: 7.5, cellPadding: 2 },
    headStyles: { fillColor: [30, 41, 59], textColor: [248, 250, 252] },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    columnStyles: {
      5: { halign: 'right' }, 6: { halign: 'right' }, 7: { halign: 'right' },
      8: { halign: 'right' },
      9: { halign: 'right', textColor: [185, 28, 28] },
      10: { halign: 'right', fontStyle: 'bold' }
    },
    foot: [['', '', '', '', 'TOTALES', fmtCLP(t.neto), fmtCLP(t.ivaTotal), fmtCLP(t.totalGeneral),
            fmtCLP(r.utilidadBruta), '-' + fmtCLP(r.comision), fmtCLP(r.utilidadNeta)]],
    footStyles: { fillColor: [15, 23, 42], textColor: [251, 191, 36], fontStyle: 'bold', halign: 'right' }
  });

  doc.save(`ventas_${desde}_a_${hasta}.pdf`);
  showToast('PDF generado', 'ok');
}

// ============================================================
// IMPORTAR ventas desde CSV / Excel
// ============================================================
function normalizarEncabezadoVenta(txt) {
  return String(txt || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
}

function parsearFechaImportada(valor) {
  if (!valor) return null;
  if (valor instanceof Date) return isoLocal(valor);

  const str = String(valor).trim();
  const iso = str.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (iso) return `${iso[1]}-${iso[2].padStart(2, '0')}-${iso[3].padStart(2, '0')}`;

  const dmy = str.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/);
  if (dmy) { const [, d, m, y] = dmy; return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`; }
  return null;
}

/* Convierte una fila de planilla al formato que espera el backend.
   Se respetan el correlativo, la fecha, la hora y los montos del archivo. */
function mapearFilaVentaImportada(fila) {
  const claves = {};
  Object.keys(fila).forEach(k => { claves[normalizarEncabezadoVenta(k)] = fila[k]; });

  const buscar = (...nombres) => {
    for (const n of nombres) {
      if (claves[n] !== undefined && claves[n] !== null && String(claves[n]).trim() !== '') return claves[n];
    }
    return null;
  };

  const fecha = parsearFechaImportada(buscar('fecha', 'fecha / hora', 'date'));
  const total = Number(String(buscar('total', 'monto') || '').replace(/[^\d.-]/g, '')) || 0;
  if (!fecha || total <= 0) return null;

  const costoTotal = Number(String(buscar('costo total', 'costo', 'cost') || '').replace(/[^\d.-]/g, '')) || 0;
  const estadoTexto = String(buscar('estado') || '').toUpperCase();
  const numeroOrden = buscar('n° orden', 'n orden', 'numero orden', 'nro orden', 'orden');

  return {
    numero_orden: numeroOrden ? Number(String(numeroOrden).replace(/\D/g, '')) || null : null,
    fecha,
    hora: buscar('hora', 'time') || null,
    cliente: buscar('cliente', 'client', 'customer') || null,
    metodo_pago: buscar('metodo de pago', 'medio de pago', 'payment') || 'Efectivo',
    estado: estadoTexto.includes('PENDIENTE') ? 'PENDIENTE' : 'PAGADA',
    total,
    costo_total: costoTotal,
    utilidad: Number(String(buscar('utilidad', 'profit') || '').replace(/[^\d.-]/g, '')) || (total - costoTotal),
    items: []
  };
}

/* Lee el respaldo JSON generado por el propio sistema (o una lista de ventas)
   y lo deja listo para reimportar con su detalle e ítems originales. */
function mapearRespaldoJSON(texto) {
  const datos = JSON.parse(texto);
  const lista = Array.isArray(datos) ? datos : (Array.isArray(datos.ventas) ? datos.ventas : []);

  return lista.map(v => ({
    numero_orden: v.numero_orden ?? null,
    fecha: String(v.fecha || '').slice(0, 10),
    hora: v.hora || null,
    cliente: v.cliente || null,
    metodo_pago: v.metodo_pago || 'Efectivo',
    metodo_pago_final: v.metodo_pago_final || null,
    estado: v.estado || 'PAGADA',
    fecha_pago: v.fecha_pago || null,
    total: Number(v.total) || 0,
    costo_total: Number(v.costo_total) || 0,
    utilidad: Number(v.utilidad) || 0,
    items: (v.items || []).map(it => ({
      producto_id: it.producto_id || null,
      sku: it.sku || null,
      codigo_barras: it.codigo_barras || null,
      nombre: it.nombre || 'Producto importado',
      cantidad: Number(it.cantidad) || 1,
      costo_unitario: Number(it.costo_unitario) || 0,
      precio_unitario: Number(it.precio_unitario) || 0,
      subtotal: Number(it.subtotal) || 0,
      serial_number: it.serial_number || null
    }))
  })).filter(v => v.fecha);
}

async function handleImportarVentas(e) {
  const file = e.target.files[0];
  if (!file) return;
  if (!esAdmin()) { showToast('Solo el administrador puede importar ventas', 'err'); e.target.value = ''; return; }

  const esJSON = file.name.toLowerCase().endsWith('.json');

  try {
    let ventasNuevas = [];

    if (esJSON) {
      ventasNuevas = mapearRespaldoJSON(await file.text());
    } else {
      const buffer = await file.arrayBuffer();
      const workbook = XLSX.read(buffer, { type: 'array', cellDates: true });
      const hoja = workbook.Sheets[workbook.SheetNames[0]];
      const filas = XLSX.utils.sheet_to_json(hoja, { defval: '' });
      ventasNuevas = filas.map(mapearFilaVentaImportada).filter(Boolean);
    }

    if (ventasNuevas.length === 0) {
      showToast('El archivo no tiene ventas válidas (revisa Fecha y Total)', 'err');
      e.target.value = '';
      return;
    }

    const conDetalle = ventasNuevas.filter(v => v.items && v.items.length).length;
    const mensaje = `Se importarán ${ventasNuevas.length} venta(s) respetando fechas, horas y correlativos del archivo.` +
      (conDetalle ? `\n${conDetalle} incluyen detalle de productos: se descontará el stock de los que existan en el catálogo.` : '') +
      '\n¿Continuar?';
    if (!confirm(mensaje)) { e.target.value = ''; return; }

    const r = await API.ventas.importar(ventasNuevas);

    if (r.importadas > 0) showToast(`${r.importadas} venta(s) importada(s)`, 'ok');
    if (r.omitidas > 0) {
      console.warn('Ventas omitidas durante la importación:', r.errores);
      showToast(`${r.omitidas} venta(s) omitida(s). Revisa la consola para el detalle.`, 'err');
    }

    cargarHistorial();
    if (typeof cargarProductos === 'function') cargarProductos(true);   // se repuso stock
  } catch (err) {
    console.error('Error al importar ventas:', err.message || err);
    showToast('Error al importar: ' + (err.message || 'formato no reconocido'), 'err');
  } finally {
    e.target.value = '';
  }
}

// ============================================================
// CARGA Y RENDER
// ============================================================
async function cargarHistorial() {
  if (!tokenActual()) return;

  if (elHistFechaDesde && !elHistFechaDesde.value) elHistFechaDesde.value = todayISO();
  if (elHistFechaHasta && !elHistFechaHasta.value) elHistFechaHasta.value = todayISO();

  try {
    salesHistory = await API.ventas.listar(
      elHistFechaDesde?.value, elHistFechaHasta?.value, null, filtroProducto || null
    );

    // Se descartan las selecciones de ventas que ya no están en pantalla
    const idsVisibles = new Set(salesHistory.map(v => String(v.id)));
    ventasSeleccionadas.forEach(id => { if (!idsVisibles.has(id)) ventasSeleccionadas.delete(id); });

    /* Con filtro de producto se traen los ítems de esas ventas en UNA
       llamada, para poder mostrar en cada fila qué unidades salieron.
       Sin filtro no se piden: la tabla normal no los usa y serían datos
       de más en cada carga. */
    itemsPorVenta = {};
    if (filtroProducto && salesHistory.length) {
      try {
        const items = await API.ventas.itemsDeVentas(salesHistory.map(v => v.id));
        (items || []).forEach(it => {
          (itemsPorVenta[it.venta_id] = itemsPorVenta[it.venta_id] || []).push(it);
        });
      } catch (err) {
        console.warn('No se pudo traer el detalle de las ventas encontradas:', err.message || err);
      }
    }

    renderHistorialTabla(salesHistory);
    renderResumenHistorial(salesHistory);
    actualizarAvisoBusqueda();
  } catch (err) {
    console.error('Error al cargar historial de ventas:', err.message || err);
    showToast(err.message || 'Error al consultar las ventas', 'err');
  }
}

function loadSalesHistory() { return cargarHistorial(); }

/* ============================================================
   BÚSQUEDA DE VENTAS POR PRODUCTO
   ------------------------------------------------------------
   "¿Qué ventas se hicieron con este producto?" El filtro viaja al
   servidor porque el dato vive en venta_items y el navegador solo tiene
   la cabecera de cada venta.

   Se COMBINA con el rango de fechas en vez de reemplazarlo: buscar un
   producto dentro de un mes concreto es tan útil como buscarlo en todo
   el historial, y para lo segundo está el botón dedicado.
   ============================================================ */
function aplicarBusquedaProducto() {
  const texto = (elHistBuscarProducto?.value || '').trim();

  // Con 1 sola letra la búsqueda devuelve medio catálogo y no sirve
  if (texto && texto.length < 2) return;
  if (texto === filtroProducto) return;

  filtroProducto = texto;
  if (elBtnLimpiarBusquedaProducto) elBtnLimpiarBusquedaProducto.classList.toggle('hidden', !texto);
  cargarHistorial();
}

function limpiarBusquedaProducto() {
  if (elHistBuscarProducto) elHistBuscarProducto.value = '';
  document.getElementById('histSugerencias')?.classList.add('hidden');
  if (elHistResultadoBusqueda) { elHistResultadoBusqueda.classList.add('hidden'); elHistResultadoBusqueda.textContent = ''; }
  // Si había una búsqueda local (fecha/total) activa, repinta todo
  const habiaLocal = elHistBuscarProducto && !filtroProducto;
  if (!filtroProducto) {
    if (habiaLocal && typeof renderHistorialTabla === 'function') renderHistorialTabla(salesHistory);
    if (elBtnLimpiarBusquedaProducto) elBtnLimpiarBusquedaProducto.classList.add('hidden');
    return;
  }
  filtroProducto = '';
  itemsPorVenta = {};
  if (elBtnLimpiarBusquedaProducto) elBtnLimpiarBusquedaProducto.classList.add('hidden');
  cargarHistorial();
}

/* Amplía el rango a todo lo registrado y mantiene el producto buscado.
   Sin esto, buscar un producto con el filtro en "Hoy" daba cero
   resultados y parecía que el buscador no funcionaba. */
function buscarProductoEnTodoElHistorial() {
  const texto = (elHistBuscarProducto?.value || '').trim();
  if (texto.length < 2) {
    showToast('Escribe al menos 2 caracteres del producto', 'err');
    elHistBuscarProducto?.focus();
    return;
  }

  filtroProducto = texto;
  if (elBtnLimpiarBusquedaProducto) elBtnLimpiarBusquedaProducto.classList.remove('hidden');

  // 2020 como piso: anterior a cualquier venta registrada en el sistema
  if (elHistFechaDesde) elHistFechaDesde.value = '2020-01-01';
  if (elHistFechaHasta) elHistFechaHasta.value = todayISO();

  periodoActivo = 'personalizado';
  marcarChipActivo(elHistChips, 'personalizado');
  actualizarEtiquetaPeriodo();
  cargarHistorial();
}

/* Resumen de lo encontrado: cuántas ventas, cuántas unidades y cuánto
   dinero movió ese producto en el período. Es la pregunta que viene
   siempre justo después de "¿en qué ventas salió?". */
function actualizarAvisoBusqueda() {
  if (!elHistResultadoBusqueda) return;

  if (!filtroProducto) {
    elHistResultadoBusqueda.classList.add('hidden');
    elHistResultadoBusqueda.textContent = '';
    return;
  }

  elHistResultadoBusqueda.classList.remove('hidden');

  if (!salesHistory.length) {
    elHistResultadoBusqueda.innerHTML =
      `Sin ventas con <b>"${escHtml(filtroProducto)}"</b> en este período. ` +
      `Prueba con “Buscar en todo el historial”.`;
    return;
  }

  const coincide = (it) => {
    const t = filtroProducto.toLowerCase();
    return String(it.nombre || '').toLowerCase().includes(t) ||
           String(it.sku || '').toLowerCase().includes(t) ||
           String(it.serial_number || '').toLowerCase().includes(t);
  };

  let unidades = 0, dinero = 0;
  Object.values(itemsPorVenta).forEach(items => {
    items.filter(coincide).forEach(it => {
      unidades += Number(it.cantidad) || 0;
      dinero += (Number(it.precio_unitario) || 0) * (Number(it.cantidad) || 0);
    });
  });

  elHistResultadoBusqueda.innerHTML =
    `<b>${salesHistory.length}</b> venta(s) con <b>"${escHtml(filtroProducto)}"</b>` +
    (unidades ? ` · <b>${unidades}</b> unidad(es) · ${fmtCLP(dinero)}` : '');
}

/* Chips de los ítems que coincidieron, para la fila de la tabla */
function chipsItemsCoincidentes(ventaId) {
  if (!filtroProducto) return '';
  const items = itemsPorVenta[ventaId];
  if (!Array.isArray(items) || !items.length) return '';

  const t = filtroProducto.toLowerCase();
  const coinciden = items.filter(it =>
    String(it.nombre || '').toLowerCase().includes(t) ||
    String(it.sku || '').toLowerCase().includes(t) ||
    String(it.serial_number || '').toLowerCase().includes(t));

  if (!coinciden.length) return '';

  return '<div class="hist-items-match">' + coinciden.slice(0, 3).map(it => {
    const detalle = [it.sku ? `SKU ${it.sku}` : '', it.serial_number ? `S/N ${it.serial_number}` : '']
      .filter(Boolean).join(' · ');
    return `<span class="hist-item-chip" title="${escHtml(detalle || it.nombre)}">` +
           `${Number(it.cantidad) || 0}× ${escHtml(it.nombre)}` +
           (detalle ? ` <small>${escHtml(detalle)}</small>` : '') + '</span>';
  }).join('') +
  (coinciden.length > 3 ? `<span class="hist-item-chip">+${coinciden.length - 3}</span>` : '') +
  '</div>';
}

function alternarFiltroPendientes() {
  filtroEstado = filtroEstado === 'PENDIENTE' ? null : 'PENDIENTE';
  aplicarFiltroEstado();
}

function aplicarFiltroEstado() {
  const soloPendientes = filtroEstado === 'PENDIENTE';
  if (elKpiPorPagarCard) elKpiPorPagarCard.classList.toggle('activo', soloPendientes);
  if (elBtnQuitarFiltroPendientes) elBtnQuitarFiltroPendientes.classList.toggle('hidden', !soloPendientes);
  if (elHistFiltroEstadoLabel) {
    elHistFiltroEstadoLabel.textContent = soloPendientes
      ? 'Mostrando solo ventas PENDIENTES de pago'
      : 'Todas las ventas del período';
  }
  renderHistorialTabla(salesHistory);
}

/* Cobra una venta que quedó "Por Pagar" */
function pagarVentaPendiente(id) {
  const venta = salesHistory.find(v => String(v.id) === String(id));
  if (!venta) return;

  abrirSelectorPago({
    titulo: `Cobrar Orden #${String(venta.numero_orden ?? venta.id).padStart(5, '0')}`,
    subtitulo: `Cliente: ${venta.cliente || 'Consumidor Final'} · registrada el ${venta.fecha}`,
    total: Number(venta.total) || 0,
    // Aquí ya no tiene sentido "Por Pagar"
    metodos: ['Efectivo', 'Tarjeta Débito', 'Tarjeta Crédito', 'Transferencia', 'Mixto'],
    textoConfirmar: '✅ Registrar Pago',
    onConfirmar: async (metodo, datos) => {
      await API.ventas.registrarPago(venta.id, metodo, datos?.pagos || null);

      // El documento tributario se emite al cobrar, así que se guarda aquí
      const dte = datos?.tipoDte || 'SIN DTE';
      if (dte !== (venta.tipo_dte || 'SIN DTE')) {
        await API.ventas.cambiarDTE(venta.id, dte);
      }

      showToast(metodo === 'Mixto' ? 'Venta cobrada con pago mixto' : `Venta cobrada con ${metodo}`, 'ok');
      await cargarHistorial();
    }
  });
}

/* Cambio rápido del documento tributario desde la propia fila */
async function cambiarDteVenta(id, tipo, selectEl) {
  const venta = salesHistory.find(v => String(v.id) === String(id));
  const anterior = venta ? dteDeVenta(venta) : 'SIN DTE';

  try {
    if (selectEl) selectEl.disabled = true;
    await API.ventas.cambiarDTE(id, tipo);

    if (venta) venta.tipo_dte = tipo;
    if (selectEl) selectEl.className = `dte-select dte-${claseDte(tipo)}`;
    showToast(`Documento actualizado a ${tipo}`, 'ok');
  } catch (err) {
    console.error('Error al cambiar el DTE:', err.message || err);
    showToast(err.message || 'No se pudo cambiar el documento', 'err');
    if (selectEl) { selectEl.value = anterior; selectEl.className = `dte-select dte-${claseDte(anterior)}`; }
  } finally {
    if (selectEl) selectEl.disabled = false;
  }
}

function ventasVisibles() {
  return (salesHistory || []).filter(v => !filtroEstado || (v.estado || 'PAGADA') === filtroEstado);
}

/* ---------- Selección múltiple y descargas de respaldo ---------- */
function actualizarBarraVentas() {
  const cantidad = ventasSeleccionadas.size;

  if (elCheckTodasVentas) {
    const visibles = ventasVisibles();
    elCheckTodasVentas.checked = visibles.length > 0 && visibles.every(v => ventasSeleccionadas.has(String(v.id)));
  }

  mostrarBarraSeleccion(cantidad, {
    onJSON: descargarVentasJSON,
    onCSV: descargarVentasExcel,
    onEliminar: eliminarVentasSeleccionadas,
    onLimpiar: () => { ventasSeleccionadas.clear(); renderHistorialTabla(salesHistory); }
  });
}

function ventasMarcadas() {
  return (salesHistory || []).filter(v => ventasSeleccionadas.has(String(v.id)));
}

/* Respaldo completo: incluye el detalle de cada venta para poder reimportarla */
async function descargarVentasJSON() {
  const seleccion = ventasMarcadas();
  if (seleccion.length === 0) return;

  showToast('Preparando respaldo…', '');
  try {
    const completas = [];
    for (const venta of seleccion) {
      const detalle = await API.ventas.detalle(venta.id);
      completas.push(detalle);
    }

    const respaldo = {
      sistema: 'Sevelin POS',
      generado_en: fechaHoraISOChile(),
      zona_horaria: 'America/Santiago',
      cantidad: completas.length,
      ventas: completas
    };

    descargarArchivo(`respaldo_ventas_${todayISO()}.json`, JSON.stringify(respaldo, null, 2));
    showToast(`${completas.length} venta(s) exportada(s) en JSON`, 'ok');
  } catch (err) {
    console.error('Error al generar el respaldo:', err.message || err);
    showToast(err.message || 'No se pudo generar el respaldo', 'err');
  }
}

function descargarVentasExcel() {
  const seleccion = ventasMarcadas();
  if (seleccion.length === 0) return;

  const filas = obtenerFilasHistorialParaExportar(seleccion);
  const libro = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(libro, XLSX.utils.json_to_sheet(filas), 'Ventas');
  XLSX.writeFile(libro, `ventas_seleccionadas_${todayISO()}.xlsx`);
  showToast(`${filas.length} venta(s) exportada(s) a Excel`, 'ok');
}

/* Borrado masivo: el backend repone el stock de los productos vendidos
   (buscándolos por id, SKU o código de barras) antes de eliminar. */
async function eliminarVentasSeleccionadas() {
  const seleccion = ventasMarcadas();
  if (seleccion.length === 0) return;

  const totalSeleccion = seleccion.reduce((a, v) => a + (Number(v.total) || 0), 0);
  const pin = await pedirPinAdmin({
    titulo: 'Eliminar ventas seleccionadas',
    mensaje: `¿Estás seguro de que deseas eliminar los ${seleccion.length} registros seleccionados? Esta acción no se puede deshacer.`,
    resumen: `Total involucrado: ${fmtCLP(totalSeleccion)}\nEl stock de los productos vendidos volverá al inventario.`
  });
  if (!pin) return;

  try {
    const r = await API.ventas.eliminarLote(seleccion.map(v => v.id), pin);

    ventasSeleccionadas.clear();
    ocultarBarraSeleccion();

    showToast(`${r.eliminadas} venta(s) eliminada(s)` +
      (r.stock_repuesto ? ` · stock repuesto en ${r.stock_repuesto} producto(s)` : ''), 'ok');

    await cargarHistorial();                                  // tabla y KPIs al día
    if (typeof cargarProductos === 'function') cargarProductos(true);  // inventario al día
  } catch (err) {
    console.error('Error al eliminar las ventas:', err.message || err);
    showToast(err.message || 'No se pudieron eliminar las ventas', 'err');
  }
}

function renderHistorialTabla(ventas) {
  if (!elHistorialTableBody) return;

  let lista = (ventas || []).filter(v => !filtroEstado || (v.estado || 'PAGADA') === filtroEstado);

  // Punto 5: filtro por estado de envío
  if (filtroEnvio) {
    lista = lista.filter(v => (v.estado_envio || '') === filtroEnvio);
  }

  // Punto 5: orden por fecha real de la venta (vendida_en, con id de desempate)
  lista = lista.slice().sort((a, b) => {
    const fa = a.vendida_en || `${a.fecha || ''}T${a.hora || '00:00'}`;
    const fb = b.vendida_en || `${b.fecha || ''}T${b.hora || '00:00'}`;
    const cmp = String(fa).localeCompare(String(fb)) || ((a.id || 0) - (b.id || 0));
    return ordenHistorial === 'asc' ? cmp : -cmp;
  });

  if (lista.length === 0) {
    const msg = filtroEstado === 'PENDIENTE'
      ? 'No hay ventas pendientes de pago en este período.'
      : filtroEnvio
        ? 'No hay ventas con ese estado de envío en el período.'
        : 'No hay ventas en este período. Prueba con otro filtro o registra una venta nueva.';
    elHistorialTableBody.innerHTML = `<tr class="empty-row"><td colspan="11">${msg}</td></tr>`;
    actualizarBarraVentas();
    return;
  }

  elHistorialTableBody.innerHTML = lista.map(v => {
    const pendiente = estaPendiente(v);
    const marcada = ventasSeleccionadas.has(String(v.id));
    return `
    <tr class="row-in${pendiente ? ' fila-pendiente' : ''}${marcada ? ' fila-marcada' : ''}">
      <td class="col-check"><input type="checkbox" data-sel="${v.id}" ${marcada ? 'checked' : ''}></td>
      <td class="strong">#${String(v.numero_orden ?? v.id).padStart(5, '0')}</td>
      <td>${v.fecha || '-'}${v.hora ? ' · ' + v.hora : ''}</td>
      <td>${escHtml(v.cliente || 'Consumidor Final')}${chipsItemsCoincidentes(v.id)}</td>
      <td><span class="badge ${pendiente ? 'badge-gold' : 'badge-blue'}">${metodoDeVenta(v)}</span></td>
      <td>
        <select class="dte-select dte-${claseDte(dteDeVenta(v))}" data-dte="${v.id}" title="Cambiar el documento tributario">
          ${TIPOS_DTE.map(t => `<option value="${t}" ${dteDeVenta(v) === t ? 'selected' : ''}>${t}</option>`).join('')}
        </select>
      </td>
      <td>
        <span class="badge ${pendiente ? 'badge-red' : 'badge-green'}">${pendiente ? 'PENDIENTE' : 'PAGADA'}</span>
      </td>
      <td>${celdaEnvio(v)}</td>
      <td class="num strong">${fmtCLP(v.total)}</td>
      <td class="num admin-only" style="color:var(--green); font-weight:600;">${pendiente ? '—' : fmtCLP(v.utilidad)}</td>
      <td>
        <div class="cell-actions">
          ${pendiente ? `<button class="btn btn-green btn-sm" data-pagar="${v.id}" title="Registrar el pago">💵 Pagar</button>` : ''}
          <button class="btn btn-icon btn-icon-view" data-ver="${v.id}" title="Ver detalle y reimprimir">${ICONO_VER}</button>
          <button class="btn btn-icon btn-icon-edit admin-only" data-editar="${v.id}" title="Editar venta">${ICONO_EDITAR}</button>
          <button class="btn btn-icon btn-icon-del admin-only" data-eliminar="${v.id}" title="Eliminar venta">${ICONO_ELIMINAR}</button>
        </div>
      </td>
    </tr>`;
  }).join('');

  elHistorialTableBody.querySelectorAll('input[data-sel]').forEach(chk => {
    chk.addEventListener('change', () => {
      const id = String(chk.dataset.sel);
      if (chk.checked) ventasSeleccionadas.add(id); else ventasSeleccionadas.delete(id);
      chk.closest('tr')?.classList.toggle('fila-marcada', chk.checked);
      actualizarBarraVentas();
    });
  });

  actualizarBarraVentas();

  elHistorialTableBody.querySelectorAll('select[data-dte]').forEach(sel => {
    sel.addEventListener('change', () => cambiarDteVenta(sel.dataset.dte, sel.value, sel));
  });

  elHistorialTableBody.querySelectorAll('button[data-pagar]').forEach(btn => {
    btn.addEventListener('click', () => pagarVentaPendiente(btn.dataset.pagar));
  });
  elHistorialTableBody.querySelectorAll('button[data-envio]').forEach(btn => {
    btn.addEventListener('click', () => abrirModalEnvio(btn.dataset.envio));
  });
  elHistorialTableBody.querySelectorAll('button[data-ver]').forEach(btn => {
    btn.addEventListener('click', () => verDetalleVenta(btn.dataset.ver));
  });
  elHistorialTableBody.querySelectorAll('button[data-editar]').forEach(btn => {
    btn.addEventListener('click', () => abrirModalEditarVenta(btn.dataset.editar));
  });
  elHistorialTableBody.querySelectorAll('button[data-eliminar]').forEach(btn => {
    btn.addEventListener('click', () => eliminarVentaIndividual(btn.dataset.eliminar));
  });
}

// ---------- Eliminar ----------
async function eliminarVentaIndividual(id) {
  if (!confirm('¿Eliminar esta venta del historial? Esta acción no se puede deshacer.')) return;

  try {
    await API.ventas.eliminar(id);
    showToast('Venta eliminada', 'ok');
    cargarHistorial();
  } catch (err) {
    console.error('Error al eliminar la venta:', err.message || err);
    showToast(err.message || 'No se pudo eliminar la venta', 'err');
  }
}

async function eliminarTodoHistorial() {
  const pin = await pedirPinAdmin({
    titulo: 'Eliminar TODO el historial',
    mensaje: 'Se borrarán todas las ventas registradas y el detalle de cada una. Esta acción no se puede deshacer.',
    resumen: 'Incluye ventas de todos los períodos, no solo las que ves en pantalla.',
    textoBoton: '🗑️ Sí, borrar todo'
  });
  if (!pin) return;

  try {
    await API.ventas.eliminarTodo(pin);
    showToast('Historial de ventas eliminado', 'ok');
    salesHistory = [];
    cargarHistorial();
  } catch (err) {
    console.error('Error al eliminar el historial:', err.message || err);
    showToast(err.message || 'No se pudo eliminar el historial', 'err');
  }
}

// ============================================================
// EDITAR VENTA: cabecera + ítems con recálculo de totales
// ============================================================
async function abrirModalEditarVenta(ventaId) {
  if (!esAdmin()) { showToast('Solo el administrador puede editar ventas', 'err'); return; }

  try {
    const venta = await API.ventas.detalle(ventaId);
    ventaEditando = venta;
    itemsEditando = (venta.items || []).map(it => ({
      producto_id: it.producto_id || null,
      sku: it.sku || null,
      nombre: it.nombre || '',
      cantidad: Number(it.cantidad) || 1,
      costo_unitario: Number(it.costo_unitario) || 0,
      precio_unitario: Number(it.precio_unitario) || 0,
      serial_number: it.serial_number || null
    }));

    if (elEditVentaId) elEditVentaId.value = venta.id;
    if (elEditVentaNumero) elEditVentaNumero.textContent = String(venta.numero_orden ?? venta.id).padStart(5, '0');
    if (elEditVentaFecha) elEditVentaFecha.value = venta.fecha || todayISO();
    if (elEditVentaHora) elEditVentaHora.value = (venta.hora || '').slice(0, 5);
    if (elEditVentaCliente) elEditVentaCliente.value = venta.cliente || '';
    if (elEditVentaMetodoPago) elEditVentaMetodoPago.value = venta.metodo_pago || 'Efectivo';

    renderItemsEditables();
    if (elModalEditarVenta) elModalEditarVenta.classList.add('show');
  } catch (err) {
    console.error('Error al abrir la venta:', err.message || err);
    showToast(err.message || 'No se pudo cargar la venta', 'err');
  }
}

function renderItemsEditables() {
  if (!elEditVentaItemsList) return;

  if (itemsEditando.length === 0) {
    elEditVentaItemsList.innerHTML = '<p class="modal-hint">La venta quedó sin productos. Agrega al menos uno para poder guardar.</p>';
  } else {
    /* SKU y NÚMERO DE SERIE editables.
       ------------------------------------------------------------
       Las ventas ya guardaban ambos campos en venta_items (el POS los
       escribe al vender), pero el modal de edición no los mostraba: al
       editar una venta se enviaba el ítem sin ellos y el backend, que
       reemplaza el detalle completo, los dejaba en null. O sea, editar
       una venta BORRABA el S/N con el que se había vendido el equipo.

       Ahora se muestran, se pueden corregir a mano, y sobre todo
       sobreviven a la edición. Van en una segunda línea para no apretar
       la fila principal. */
    const esc = (v) => String(v == null ? '' : v).replace(/"/g, '&quot;');

    elEditVentaItemsList.innerHTML = itemsEditando.map((it, i) => `
      <div class="edit-item-row" data-idx="${i}">
        <div class="field edit-item-nombre">
          <label>Producto</label>
          <input type="text" data-campo="nombre" value="${esc(it.nombre)}">
        </div>
        <div class="field edit-item-num">
          <label>Cant.</label>
          <input type="number" min="1" step="1" data-campo="cantidad" value="${it.cantidad}">
        </div>
        <div class="field edit-item-num admin-only">
          <label>Costo unit.</label>
          <input type="number" min="0" step="1" data-campo="costo_unitario" value="${it.costo_unitario}">
        </div>
        <div class="field edit-item-num">
          <label>Precio unit.</label>
          <input type="number" min="0" step="1" data-campo="precio_unitario" value="${it.precio_unitario}">
        </div>
        <div class="edit-item-sub">
          <label>Subtotal</label>
          <strong>${fmtCLP(it.precio_unitario * it.cantidad)}</strong>
        </div>
        <button class="btn btn-icon btn-icon-del" data-quitar="${i}" title="Quitar de la venta">${ICONO_ELIMINAR}</button>

        <div class="edit-item-codigos">
          <div class="field">
            <label>SKU</label>
            <input type="text" data-campo="sku" placeholder="Sin SKU" value="${esc(it.sku)}">
          </div>
          <div class="field">
            <label>Número de serie (S/N)</label>
            <div class="input-scan">
              <input type="text" data-campo="serial_number" placeholder="Sin S/N" value="${esc(it.serial_number)}">
              <button class="btn btn-outline btn-scan" type="button"
                      data-escanear-sn="${i}" title="Escanear el S/N con la cámara">📷</button>
            </div>
          </div>
        </div>
      </div>
    `).join('');

    elEditVentaItemsList.querySelectorAll('.edit-item-row input').forEach(input => {
      input.addEventListener('input', () => {
        const fila = input.closest('.edit-item-row');
        const idx = Number(fila.dataset.idx);
        const campo = input.dataset.campo;
        /* SKU y serial son texto, igual que el nombre: pasarlos por
           Number() los habría convertido en 0 y borrado el dato. */
        const CAMPOS_TEXTO = ['nombre', 'sku', 'serial_number'];
        itemsEditando[idx][campo] = CAMPOS_TEXTO.includes(campo)
          ? (input.value.trim() || null)
          : (Number(input.value) || 0);

        if (campo === 'nombre') itemsEditando[idx].nombre = input.value;

        // Actualiza subtotal y totales sin volver a dibujar todo (no pierde el foco)
        const sub = fila.querySelector('.edit-item-sub strong');
        if (sub) sub.textContent = fmtCLP(itemsEditando[idx].precio_unitario * itemsEditando[idx].cantidad);
        actualizarTotalesEdicion();
      });
    });

    /* Escáner de cámara para el S/N.
       ------------------------------------------------------------
       `abrirEscaner(idInput)` recibe el ID de un input, no un callback:
       escribe el código leído en ese elemento. Como estas filas se
       generan dinámicamente, se le pone un id único a cada campo de S/N
       (el atributo data-scan tampoco serviría: escaner.js registra sus
       botones al cargar la página, antes de que existan estas filas).

       Después de escanear hay que copiar el valor a itemsEditando: el
       escáner escribe en el DOM, no en nuestro arreglo. Se hace con el
       evento 'input' que el propio escáner dispara. */
    elEditVentaItemsList.querySelectorAll('button[data-escanear-sn]').forEach(btn => {
      btn.addEventListener('click', () => {
        const idx = Number(btn.dataset.escanearSn);
        const campo = btn.closest('.input-scan')?.querySelector('input[data-campo="serial_number"]');
        if (typeof abrirEscaner !== 'function' || !campo) {
          showToast('El escáner no está disponible', 'err');
          return;
        }
        campo.id = `editItemSN${idx}`;
        abrirEscaner(campo.id);
      });
    });

    elEditVentaItemsList.querySelectorAll('button[data-quitar]').forEach(btn => {
      btn.addEventListener('click', () => {
        itemsEditando.splice(Number(btn.dataset.quitar), 1);
        renderItemsEditables();
      });
    });
  }

  actualizarTotalesEdicion();
}

function totalesEdicion() {
  const total = itemsEditando.reduce((a, i) => a + (Number(i.precio_unitario) || 0) * (Number(i.cantidad) || 0), 0);
  const costo = itemsEditando.reduce((a, i) => a + (Number(i.costo_unitario) || 0) * (Number(i.cantidad) || 0), 0);
  return { total, costo, utilidad: total - costo };
}

function actualizarTotalesEdicion() {
  if (!elEditVentaTotales) return;
  const t = totalesEdicion();
  elEditVentaTotales.innerHTML = `
    <span>Total <b>${fmtCLP(t.total)}</b></span>
    <span>Costo <b>${fmtCLP(t.costo)}</b></span>
    <span>Utilidad <b style="color:var(--green);">${fmtCLP(t.utilidad)}</b></span>
  `;
}

function agregarItemAVentaEditada() {
  itemsEditando.push({
    producto_id: null, sku: null, nombre: 'Nuevo producto',
    cantidad: 1, costo_unitario: 0, precio_unitario: 0, serial_number: null
  });
  // El foco entra directo al nombre del ítem recién creado
  setTimeout(() => {
    const filas = elEditVentaItemsList?.querySelectorAll('.edit-item-row');
    filas?.[filas.length - 1]?.querySelector('input[data-campo="nombre"]')?.focus();
  }, 60);
  renderItemsEditables();
}

function cerrarModalEditarVenta() {
  if (elModalEditarVenta) elModalEditarVenta.classList.remove('show');
  ventaEditando = null;
  itemsEditando = [];
}

async function guardarEdicionVenta() {
  const id = elEditVentaId?.value;
  if (!id) return;

  if (itemsEditando.length === 0) { showToast('La venta debe tener al menos un producto', 'err'); return; }
  const invalido = itemsEditando.find(i => !String(i.nombre).trim() || i.cantidad <= 0 || i.precio_unitario < 0);
  if (invalido) { showToast('Revisa nombres, cantidades y precios de los ítems', 'err'); return; }

  if (elBtnGuardarEdicionVenta) elBtnGuardarEdicionVenta.disabled = true;

  try {
    // El backend reemplaza el detalle y recalcula total, costo_total y utilidad
    await API.ventas.actualizar(id, {
      fecha: elEditVentaFecha?.value || todayISO(),
      hora: elEditVentaHora?.value || null,
      cliente: elEditVentaCliente?.value.trim() || null,
      metodo_pago: elEditVentaMetodoPago?.value || null,
      items: itemsEditando
    });

    showToast('Venta actualizada y totales recalculados', 'ok');
    cerrarModalEditarVenta();
    cargarHistorial();
  } catch (err) {
    console.error('Error al editar la venta:', err.message || err);
    showToast(err.message || 'No se pudo actualizar la venta', 'err');
  } finally {
    if (elBtnGuardarEdicionVenta) elBtnGuardarEdicionVenta.disabled = false;
  }
}

// ---------- Detalle / reimpresión ----------
async function verDetalleVenta(ventaId) {
  try {
    const venta = await API.ventas.detalle(ventaId);
    currentSaleDetails = venta;
    renderDetalleVenta(venta);
    if (elModalDetalleVenta) elModalDetalleVenta.classList.add('show');
  } catch (err) {
    console.error('Error al obtener el detalle de la venta:', err.message || err);
    showToast(err.message || 'No se pudo cargar el detalle de esta venta', 'err');
  }
}

function renderDetalleVenta(venta) {
  if (!elDetalleVentaContent) return;

  const filas = (venta.items || []).map(it => `
    <tr>
      <td style="padding:8px 0;">${it.cantidad}x ${escHtml(it.nombre)}${it.serial_number ? '<br><small style="color:var(--text-muted);">S/N: ' + escHtml(it.serial_number) + '</small>' : ''}</td>
      <td style="text-align:right; padding:8px 0;">${fmtCLP(it.subtotal)}</td>
    </tr>
  `).join('');

  elDetalleVentaContent.innerHTML = `
    <div class="grid grid-2" style="gap:8px 18px; margin-bottom:12px;">
      <p><b>Orden:</b> #${String(venta.numero_orden ?? venta.id).padStart(5, '0')}</p>
      <p><b>Fecha:</b> ${venta.fecha || '-'}${venta.hora ? ' · ' + venta.hora : ''}</p>
      <p><b>Cliente:</b> ${escHtml(venta.cliente || 'Consumidor Final')}</p>
      <p><b>Pago:</b> ${metodoDeVenta(venta)}
        <span class="badge ${estaPendiente(venta) ? 'badge-red' : 'badge-green'}">${estaPendiente(venta) ? 'PENDIENTE' : 'PAGADA'}</span>
      </p>
    </div>
    <table style="width:100%; border-collapse:collapse;">
      <tbody>${filas}</tbody>
    </table>
    <div style="border-top:1px solid var(--border); margin-top:12px; padding-top:12px; display:flex; justify-content:space-between; font-weight:bold; font-size:17px;">
      <span>TOTAL</span><span>${fmtCLP(venta.total)}</span>
    </div>
    ${venta.utilidad !== undefined ? `<p class="modal-hint admin-only">Costo ${fmtCLP(venta.costo_total)} · Utilidad ${fmtCLP(venta.utilidad)}</p>` : ''}
    <div class="row-actions" style="justify-content:flex-end; margin-top:16px;">
      <button class="btn btn-gold" id="btnReimprimirDesdeDetalle">🖨️ Reimprimir Ticket</button>
    </div>
  `;

  const btnReimprimir = document.getElementById('btnReimprimirDesdeDetalle');
  if (btnReimprimir) {
    btnReimprimir.addEventListener('click', () => imprimirTicketVenta(venta, venta.items));
  }
}

function cerrarDetalleVenta() {
  if (elModalDetalleVenta) elModalDetalleVenta.classList.remove('show');
  currentSaleDetails = null;
}

/* ============================================================
   ENVÍO EN EL HISTORIAL (punto 5)
   ------------------------------------------------------------
   Muestra el estado de envío de cada venta y permite cambiarlo, además
   de registrar el número de seguimiento. Solo las ventas de tipo
   'despacho' son editables; el retiro en tienda se marca como entregado.
   ============================================================ */
const ETIQUETAS_ENVIO = {
  pendiente:   { txt: '⏳ Pendiente',   clase: 'badge-gold' },
  preparacion: { txt: '📋 Preparación', clase: 'badge-blue' },
  enviado:     { txt: '🚚 Enviado',     clase: 'badge-blue' },
  entregado:   { txt: '✅ Entregado',   clase: 'badge-green' }
};

function celdaEnvio(v) {
  // Retiro en tienda (o ventas antiguas sin dato): no hay envío que gestionar
  if (!v.tipo_entrega || v.tipo_entrega === 'retiro') {
    return '<span style="color:var(--text-muted);">🏪 Retiro</span>';
  }
  const e = v.estado_envio || 'pendiente';
  const info = ETIQUETAS_ENVIO[e] || ETIQUETAS_ENVIO.pendiente;
  const seg = v.numero_seguimiento
    ? `<br><small style="color:var(--text-muted);">${escHtml(v.numero_seguimiento)}</small>` : '';
  return `<button class="badge ${info.clase} badge-boton" data-envio="${v.id}" title="Cambiar estado de envío">${info.txt}</button>${seg}`;
}

let envioEditandoId = null;

function abrirModalEnvio(id) {
  const venta = salesHistory.find(v => String(v.id) === String(id));
  if (!venta) return;
  envioEditandoId = venta.id;

  const ref = document.getElementById('envioVentaRef');
  if (ref) ref.textContent =
    `Orden #${String(venta.numero_orden ?? venta.id).padStart(5, '0')} · ${venta.cliente || 'Consumidor Final'}` +
    (venta.direccion_envio ? ` · ${venta.direccion_envio}` : '');

  const est = document.getElementById('envioEstado');
  const seg = document.getElementById('envioSeguimiento');
  if (est) est.value = venta.estado_envio || 'pendiente';
  if (seg) seg.value = venta.numero_seguimiento || '';

  document.getElementById('modalEnvio')?.classList.add('show');
}

async function guardarEnvio() {
  if (!envioEditandoId) return;
  const estado_envio = document.getElementById('envioEstado')?.value || 'pendiente';
  const numero_seguimiento = (document.getElementById('envioSeguimiento')?.value || '').trim();

  const btn = document.getElementById('btnGuardarEnvio');
  if (btn) btn.disabled = true;
  try {
    await API.ventas.actualizarEnvio(envioEditandoId, { estado_envio, numero_seguimiento });
    showToast('Envío actualizado', 'ok');
    document.getElementById('modalEnvio')?.classList.remove('show');
    await cargarHistorial();
  } catch (err) {
    showToast(err.message || 'No se pudo actualizar el envío', 'err');
  } finally {
    if (btn) btn.disabled = false;
  }
}

document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('btnCancelarEnvio')?.addEventListener('click', () =>
    document.getElementById('modalEnvio')?.classList.remove('show'));
  document.getElementById('btnGuardarEnvio')?.addEventListener('click', guardarEnvio);
  document.getElementById('modalEnvio')?.addEventListener('click', (e) => {
    if (e.target.id === 'modalEnvio') document.getElementById('modalEnvio').classList.remove('show');
  });
});

/* ============================================================
   BUSCADOR UNIVERSAL DE VENTAS
   ------------------------------------------------------------
   Un solo campo que entiende varios tipos de búsqueda y sugiere en vivo
   sobre las ventas ya cargadas:
     · Fecha exacta        2026-08-18
     · Fecha y hora        2026-08-18 19:56
     · Total de la venta   100000  ó  $100.000
     · Producto/SKU/código texto libre → usa el buscador del backend
   El tipo se detecta por el formato de lo escrito. Para fecha/hora/total
   el filtrado es local (instantáneo); para producto va al servidor porque
   el detalle vive en venta_items.
   ============================================================ */

// Detecta qué tipo de búsqueda es el texto escrito
function detectarTipoBusqueda(texto) {
  const t = texto.trim();
  if (/^\d{4}-\d{2}-\d{2}\s+\d{1,2}:\d{2}$/.test(t)) return { tipo: 'fechahora', valor: t };
  if (/^\d{4}-\d{2}-\d{2}$/.test(t)) return { tipo: 'fecha', valor: t };
  // Monto: solo dígitos, puntos o $ (ej. 100000 o $100.000), al menos 3 dígitos
  const soloNum = t.replace(/[$.\s]/g, '');
  if (/^\d{3,}$/.test(soloNum) && /^[$\d.\s]+$/.test(t)) return { tipo: 'total', valor: Number(soloNum) };
  return { tipo: 'texto', valor: t };
}

/* Ventas de salesHistory que coinciden con una búsqueda local (no-texto).
   Para 'total' se admite una pequeña tolerancia por redondeo. */
function ventasQueCoinciden(det) {
  const lista = salesHistory || [];
  if (det.tipo === 'fecha') {
    return lista.filter(v => (v.fecha || (v.vendida_en || '').slice(0, 10)) === det.valor);
  }
  if (det.tipo === 'fechahora') {
    const [f, h] = det.valor.split(/\s+/);
    const hhmm = h.padStart(5, '0');
    return lista.filter(v => {
      const vf = v.fecha || (v.vendida_en || '').slice(0, 10);
      const vh = (v.hora || (v.vendida_en || '').slice(11, 16) || '').slice(0, 5);
      return vf === f && vh === hhmm;
    });
  }
  if (det.tipo === 'total') {
    return lista.filter(v => Math.abs((Number(v.total) || 0) - det.valor) < 1);
  }
  return [];
}

/* Panel de sugerencias en vivo: muestra hasta 6 ventas que calzan, con su
   orden, fecha/hora y total. Al hacer clic, abre el detalle de esa venta. */
function mostrarSugerenciasVenta(det) {
  const caja = document.getElementById('histSugerencias');
  if (!caja) return;

  if (det.tipo === 'texto' || !det.valor) { caja.classList.add('hidden'); caja.innerHTML = ''; return; }

  const coincidencias = ventasQueCoinciden(det).slice(0, 6);
  if (!coincidencias.length) { caja.classList.add('hidden'); caja.innerHTML = ''; return; }

  caja.innerHTML = coincidencias.map(v => {
    const orden = String(v.numero_orden ?? v.id).padStart(5, '0');
    const fh = `${v.fecha || ''} ${(v.hora || '').slice(0, 5)}`.trim();
    return `<button type="button" class="hist-sug-item" data-sug-venta="${v.id}">
      <span class="hist-sug-orden">#${orden}</span>
      <span class="hist-sug-fh">${escHtml(fh)}</span>
      <span class="hist-sug-total">${fmtCLP(v.total)}</span>
    </button>`;
  }).join('');
  caja.classList.remove('hidden');

  caja.querySelectorAll('[data-sug-venta]').forEach(btn => {
    btn.addEventListener('click', () => {
      caja.classList.add('hidden');
      if (typeof verDetalleVenta === 'function') verDetalleVenta(btn.dataset.sugVenta);
    });
  });
}

/* Punto de entrada del buscador universal. Decide entre filtrar local
   (fecha/hora/total) o delegar en el buscador de producto del backend. */
function buscarVentaUniversal() {
  const texto = (elHistBuscarProducto?.value || '').trim();
  if (elBtnLimpiarBusquedaProducto) elBtnLimpiarBusquedaProducto.classList.toggle('hidden', !texto);

  if (!texto) { limpiarBusquedaProducto(); return; }

  const det = detectarTipoBusqueda(texto);

  if (det.tipo === 'texto') {
    // Producto / SKU / código de barras → buscador del servidor (ya existente)
    document.getElementById('histSugerencias')?.classList.add('hidden');
    aplicarBusquedaProducto();
    return;
  }

  /* Fecha / hora / total: se filtra localmente sobre lo ya cargado. Se
     limpia el filtro de producto para no mezclar criterios. */
  if (filtroProducto) { filtroProducto = ''; itemsPorVenta = {}; }
  mostrarSugerenciasVenta(det);

  const coincidencias = ventasQueCoinciden(det);
  renderHistorialTabla(coincidencias);

  if (elHistResultadoBusqueda) {
    elHistResultadoBusqueda.classList.remove('hidden');
    const etiqueta = det.tipo === 'total' ? `total ${fmtCLP(det.valor)}`
      : det.tipo === 'fechahora' ? `${det.valor}` : `fecha ${det.valor}`;
    elHistResultadoBusqueda.innerHTML = coincidencias.length
      ? `<b>${coincidencias.length}</b> venta(s) con ${escHtml(etiqueta)}.`
      : `Sin ventas con ${escHtml(etiqueta)} en este período. Prueba “Buscar en todo el historial” o amplía las fechas.`;
  }
}
