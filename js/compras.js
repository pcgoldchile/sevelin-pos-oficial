// ==========================================
// COMPRAS.JS - Compras y Gastos (solo administrador)
// ------------------------------------------
// Los archivos suben al bucket "compras-documentos" a través del backend,
// así la service_role key nunca pasa por el navegador.
// ==========================================

let comprasList = [];
let editandoCompraId = null;
let filtroDocumentos = '';           // '' | 'sin_documento' | 'sin_comprobante'
let archivosPendientes = { url_documento: null, url_comprobante: null };
let comprasSeleccionadas = new Set();
let campoArchivoPendiente = null;   // atajo desde el ✖ de la tabla

const CLASIFICACIONES_COMPRA = [
  'Mercadería / Productos para Reventa',
  'Activo Fijo (Maquinaria, Herramientas, Equipamiento)',
  'Insumos / Consumibles Taller',
  'Gastos Operativos (Servicios, Arriendo, etc.)'
];

const ICO_EDITAR_COMPRA = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>`;
const ICO_ELIMINAR_COMPRA = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M8 6V4h8v2"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/></svg>`;

const elComprasTableBody = document.getElementById('comprasTableBody');
const elComprasDesde = document.getElementById('comprasDesde');
const elComprasHasta = document.getElementById('comprasHasta');
const elComprasClasificacionFiltro = document.getElementById('comprasClasificacionFiltro');
const elBtnFiltrarCompras = document.getElementById('btnFiltrarCompras');
const elComprasChipsDocs = document.getElementById('comprasChipsDocs');
const elComprasPeriodoLabel = document.getElementById('comprasPeriodoLabel');
const elCheckTodasCompras = document.getElementById('checkTodasCompras');
const elComprasBuscar = document.getElementById('comprasBuscar');

const elKpiComprasMes = document.getElementById('kpiComprasMes');
const elKpiComprasMesDetalle = document.getElementById('kpiComprasMesDetalle');
const elKpiComprasFiltro = document.getElementById('kpiComprasFiltro');
const elKpiComprasFiltroDetalle = document.getElementById('kpiComprasFiltroDetalle');
const elKpiComprasSinDoc = document.getElementById('kpiComprasSinDoc');

const elModalCompra = document.getElementById('modalCompra');
const elCompraFormTitle = document.getElementById('compraFormTitle');
const elCompraEditId = document.getElementById('compraEditId');
const elCompraFecha = document.getElementById('compraFecha');
const elCompraProveedor = document.getElementById('compraProveedor');
const elCompraClasificacion = document.getElementById('compraClasificacion');
const elCompraCosto = document.getElementById('compraCosto');
const elCompraDescripcion = document.getElementById('compraDescripcion');
const elCompraUrlDocumento = document.getElementById('compraUrlDocumento');
const elCompraUrlComprobante = document.getElementById('compraUrlComprobante');
const elCompraArchivoDocumento = document.getElementById('compraArchivoDocumento');
const elCompraArchivoComprobante = document.getElementById('compraArchivoComprobante');
const elBtnSubirDocumento = document.getElementById('btnSubirDocumento');
const elBtnSubirComprobante = document.getElementById('btnSubirComprobante');
const elEstadoDocumento = document.getElementById('estadoDocumento');
const elEstadoComprobante = document.getElementById('estadoComprobante');
const elBtnNuevaCompra = document.getElementById('btnNuevaCompra');
const elBtnCancelarCompra = document.getElementById('btnCancelarCompra');
const elBtnGuardarCompra = document.getElementById('btnGuardarCompra');

// Exportar: botón único → período → formato (Excel / CSV / PDF)
const elBtnExportarCompras = document.getElementById('btnExportarCompras');
const elModalExportarCompras = document.getElementById('modalExportarCompras');
const elComprasExportChips = document.getElementById('comprasExportChips');
const elComprasExportFechasPersonalizadas = document.getElementById('comprasExportFechasPersonalizadas');
const elComprasExportFechaDesde = document.getElementById('comprasExportFechaDesde');
const elComprasExportFechaHasta = document.getElementById('comprasExportFechaHasta');
const elComprasExportResumen = document.getElementById('comprasExportResumen');
const elBtnCancelarExportarCompras = document.getElementById('btnCancelarExportarCompras');
const elBtnExportarComprasExcelModal = document.getElementById('btnExportarComprasExcelModal');
const elBtnExportarComprasCSVModal = document.getElementById('btnExportarComprasCSVModal');
const elBtnExportarComprasPDFModal = document.getElementById('btnExportarComprasPDFModal');

let periodoExportCompras = 'hoy';

document.addEventListener('DOMContentLoaded', () => {
  setDefaultDatesCompras();
  setupComprasEventListeners();
});

function setDefaultDatesCompras() {
  const hoy = fechaChile();
  if (elComprasDesde) elComprasDesde.value = isoLocal(new Date(hoy.getFullYear(), hoy.getMonth(), 1));
  if (elComprasHasta) elComprasHasta.value = todayISO();
}

function setupComprasEventListeners() {
  if (elBtnFiltrarCompras) elBtnFiltrarCompras.addEventListener('click', cargarCompras);
  if (elComprasBuscar) elComprasBuscar.addEventListener('input', () => renderComprasTabla(comprasList));
  if (elComprasClasificacionFiltro) elComprasClasificacionFiltro.addEventListener('change', cargarCompras);

  if (elComprasChipsDocs) {
    elComprasChipsDocs.querySelectorAll('.chip').forEach(chip => {
      chip.addEventListener('click', () => {
        filtroDocumentos = chip.dataset.doc || '';
        elComprasChipsDocs.querySelectorAll('.chip').forEach(c => c.classList.toggle('active', c === chip));
        cargarCompras();
      });
    });
  }

  [elComprasDesde, elComprasHasta].forEach(el => {
    if (!el) return;
    el.addEventListener('click', () => { if (typeof el.showPicker === 'function') { try { el.showPicker(); } catch (_) {} } });
    el.addEventListener('change', cargarCompras);
  });

  if (elCheckTodasCompras) elCheckTodasCompras.addEventListener('change', () => {
    if (elCheckTodasCompras.checked) comprasList.forEach(c => comprasSeleccionadas.add(String(c.id)));
    else comprasSeleccionadas.clear();
    renderComprasTabla(comprasList);
  });

  if (elBtnNuevaCompra) elBtnNuevaCompra.addEventListener('click', () => abrirModalCompra());
  if (elBtnCancelarCompra) elBtnCancelarCompra.addEventListener('click', cerrarModalCompra);
  if (elBtnGuardarCompra) elBtnGuardarCompra.addEventListener('click', guardarCompra);
  if (elModalCompra) elModalCompra.addEventListener('click', (e) => { if (e.target === elModalCompra) cerrarModalCompra(); });

  if (elBtnSubirDocumento) elBtnSubirDocumento.addEventListener('click', () => elCompraArchivoDocumento?.click());
  if (elBtnSubirComprobante) elBtnSubirComprobante.addEventListener('click', () => elCompraArchivoComprobante?.click());
  if (elCompraArchivoDocumento) elCompraArchivoDocumento.addEventListener('change', (e) => subirArchivoCompra(e, 'url_documento'));
  if (elCompraArchivoComprobante) elCompraArchivoComprobante.addEventListener('change', (e) => subirArchivoCompra(e, 'url_comprobante'));

  // Exportar: período → formato
  if (elBtnExportarCompras) elBtnExportarCompras.addEventListener('click', abrirModalExportarCompras);
  if (elBtnCancelarExportarCompras) elBtnCancelarExportarCompras.addEventListener('click', () => elModalExportarCompras?.classList.remove('show'));
  if (elModalExportarCompras) {
    elModalExportarCompras.addEventListener('click', (e) => { if (e.target === elModalExportarCompras) elModalExportarCompras.classList.remove('show'); });
  }
  if (elComprasExportChips) {
    elComprasExportChips.querySelectorAll('.chip').forEach(chip => {
      chip.addEventListener('click', () => seleccionarPeriodoExportCompras(chip.dataset.periodo));
    });
  }
  [elComprasExportFechaDesde, elComprasExportFechaHasta].forEach(el => {
    if (!el) return;
    el.addEventListener('click', () => { if (typeof el.showPicker === 'function') { try { el.showPicker(); } catch (_) {} } });
    el.addEventListener('change', actualizarResumenExportCompras);
  });
  if (elBtnExportarComprasExcelModal) elBtnExportarComprasExcelModal.addEventListener('click', () => ejecutarExportarCompras('xlsx'));
  if (elBtnExportarComprasCSVModal) elBtnExportarComprasCSVModal.addEventListener('click', () => ejecutarExportarCompras('csv'));
  if (elBtnExportarComprasPDFModal) elBtnExportarComprasPDFModal.addEventListener('click', () => ejecutarExportarCompras('pdf'));
}

// ---------- Carga y filtros ----------
async function cargarCompras() {
  if (!tokenActual() || !esAdmin()) return;

  const filtros = {
    desde: elComprasDesde?.value,
    hasta: elComprasHasta?.value,
    clasificacion: elComprasClasificacionFiltro?.value
  };
  if (filtroDocumentos === 'sin_documento') filtros.sin_documento = 'true';
  if (filtroDocumentos === 'sin_comprobante') filtros.sin_comprobante = 'true';

  try {
    comprasList = await API.compras.listar(filtros);

    const idsVisibles = new Set(comprasList.map(c => String(c.id)));
    comprasSeleccionadas.forEach(id => { if (!idsVisibles.has(id)) comprasSeleccionadas.delete(id); });

    renderComprasTabla(comprasList);
    renderKpisCompras(comprasList);
  } catch (err) {
    console.error('Error al cargar compras:', err.message || err);
    showToast(err.message || 'No se pudieron cargar las compras', 'err');
  }
}

function renderKpisCompras(lista) {
  const hoy = fechaChile();
  const inicioMes = isoLocal(new Date(hoy.getFullYear(), hoy.getMonth(), 1));
  const finMes = isoLocal(new Date(hoy.getFullYear(), hoy.getMonth() + 1, 0));

  const delMes = (lista || []).filter(c => {
    const f = String(c.fecha || '').slice(0, 10);
    return f >= inicioMes && f <= finMes;
  });

  const totalMes = delMes.reduce((a, c) => a + (Number(c.costo_total) || 0), 0);
  const totalFiltro = (lista || []).reduce((a, c) => a + (Number(c.costo_total) || 0), 0);
  const sinDocs = (lista || []).filter(c => !c.url_documento || !c.url_comprobante).length;

  if (elKpiComprasMes) { elKpiComprasMes.dataset.valor = totalMes; elKpiComprasMes.textContent = fmtCLP(totalMes); }
  if (elKpiComprasMesDetalle) elKpiComprasMesDetalle.textContent = `${delMes.length} ${delMes.length === 1 ? 'compra' : 'compras'} en ${hoy.toLocaleDateString('es-CL', { month: 'long' })}`;
  if (elKpiComprasFiltro) elKpiComprasFiltro.textContent = fmtCLP(totalFiltro);
  if (elKpiComprasFiltroDetalle) elKpiComprasFiltroDetalle.textContent = `${(lista || []).length} ${(lista || []).length === 1 ? 'registro' : 'registros'} en pantalla`;
  if (elKpiComprasSinDoc) elKpiComprasSinDoc.textContent = String(sinDocs);

  if (elComprasPeriodoLabel) {
    elComprasPeriodoLabel.textContent = `Período ${elComprasDesde?.value || '—'} a ${elComprasHasta?.value || '—'}`;
  }
}

function marcaDocumento(url, etiqueta, compraId, campo) {
  if (!url) {
    // Clic en la ✖ → abre la compra con el foco puesto en ese archivo
    return `<span class="doc-check doc-falta" data-subir="${compraId}" data-campo="${campo}"
              title="Falta ${etiqueta}. Clic para subirla ahora.">✖</span>`;
  }
  return `<a class="doc-check doc-ok" href="${url}" target="_blank" rel="noopener" title="Ver ${etiqueta}">✔</a>`;
}

/* ---------- Selección múltiple ---------- */
function actualizarBarraCompras() {
  const cantidad = comprasSeleccionadas.size;

  if (elCheckTodasCompras) {
    elCheckTodasCompras.checked = comprasList.length > 0 &&
      comprasList.every(c => comprasSeleccionadas.has(String(c.id)));
  }

  mostrarBarraSeleccion(cantidad, {
    onJSON: descargarComprasJSON,
    onCSV: descargarComprasExcel,
    onEliminar: eliminarComprasSeleccionadas,
    onLimpiar: () => { comprasSeleccionadas.clear(); renderComprasTabla(comprasList); }
  });
}

async function eliminarComprasSeleccionadas() {
  const seleccion = comprasMarcadas();
  if (seleccion.length === 0) return;

  if (!confirm(`¿Estás seguro de que deseas eliminar los ${seleccion.length} registros seleccionados? Esta acción no se puede deshacer.`)) return;

  try {
    const r = await API.compras.eliminarLote(seleccion.map(c => c.id));

    comprasSeleccionadas.clear();
    ocultarBarraSeleccion();
    showToast(`${r.eliminadas} compra(s) eliminada(s)`, 'ok');

    await cargarCompras();   // tabla y KPIs recalculados
  } catch (err) {
    console.error('Error al eliminar las compras:', err.message || err);
    showToast(err.message || 'No se pudieron eliminar las compras', 'err');
  }
}

function comprasMarcadas() {
  return comprasList.filter(c => comprasSeleccionadas.has(String(c.id)));
}

function descargarComprasJSON() {
  const seleccion = comprasMarcadas();
  if (seleccion.length === 0) return;

  const respaldo = {
    sistema: 'Sevelin POS',
    modulo: 'Compras y Gastos',
    generado_en: fechaHoraISOChile(),
    zona_horaria: 'America/Santiago',
    cantidad: seleccion.length,
    compras: seleccion
  };

  descargarArchivo(`respaldo_compras_${todayISO()}.json`, JSON.stringify(respaldo, null, 2));
  showToast(`${seleccion.length} compra(s) exportada(s) en JSON`, 'ok');
}

function descargarComprasExcel() {
  const seleccion = comprasMarcadas();
  if (seleccion.length === 0) return;

  const filas = seleccion.map(c => ({
    Fecha: tsAChile(c.fecha),
    Proveedor: c.proveedor || '',
    Clasificación: c.clasificacion || '',
    Detalle: c.descripcion || '',
    'Costo Total': Number(c.costo_total) || 0,
    'Factura / Boleta': c.url_documento || 'SIN DOCUMENTO',
    'Comprobante de Pago': c.url_comprobante || 'SIN COMPROBANTE'
  }));

  const libro = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(libro, XLSX.utils.json_to_sheet(filas), 'Compras');
  XLSX.writeFile(libro, `compras_seleccionadas_${todayISO()}.xlsx`);
  showToast(`${filas.length} compra(s) exportada(s) a Excel`, 'ok');
}

function renderComprasTabla(listaOriginal) {
  if (!elComprasTableBody) return;

  // Filtro de texto local (proveedor, detalle o clasificación)
  const texto = (elComprasBuscar?.value || '').trim().toLowerCase();
  const lista = texto
    ? (listaOriginal || []).filter(c =>
        (c.proveedor || '').toLowerCase().includes(texto) ||
        (c.descripcion || '').toLowerCase().includes(texto) ||
        (c.clasificacion || '').toLowerCase().includes(texto))
    : (listaOriginal || []);

  if (!lista || lista.length === 0) {
    elComprasTableBody.innerHTML = '<tr class="empty-row"><td colspan="8">No hay compras registradas con estos filtros.</td></tr>';
    actualizarBarraCompras();
    return;
  }

  elComprasTableBody.innerHTML = lista.map(c => {
    const marcada = comprasSeleccionadas.has(String(c.id));
    return `
    <tr class="row-in${marcada ? ' fila-marcada' : ''}">
      <td class="col-check"><input type="checkbox" data-sel="${c.id}" ${marcada ? 'checked' : ''}></td>
      <td>${tsAChile(c.fecha)}</td>
      <td>
        ${c.proveedor || '—'}
        ${c.descripcion ? `<br><small style="color:var(--text-muted);">${c.descripcion}</small>` : ''}
      </td>
      <td><span class="badge badge-blue">${c.clasificacion}</span></td>
      <td class="num strong">${fmtCLP(c.costo_total)}</td>
      <td>${marcaDocumento(c.url_documento, 'Factura / Boleta', c.id, 'url_documento')}</td>
      <td>${marcaDocumento(c.url_comprobante, 'Comprobante de pago', c.id, 'url_comprobante')}</td>
      <td>
        <div class="cell-actions">
          <button class="btn btn-icon btn-icon-edit" data-editar="${c.id}" title="Editar compra">${ICO_EDITAR_COMPRA}</button>
          <button class="btn btn-icon btn-icon-del" data-eliminar="${c.id}" title="Eliminar compra">${ICO_ELIMINAR_COMPRA}</button>
        </div>
      </td>
    </tr>`;
  }).join('');

  elComprasTableBody.querySelectorAll('input[data-sel]').forEach(chk => {
    chk.addEventListener('change', () => {
      const id = String(chk.dataset.sel);
      if (chk.checked) comprasSeleccionadas.add(id); else comprasSeleccionadas.delete(id);
      chk.closest('tr')?.classList.toggle('fila-marcada', chk.checked);
      actualizarBarraCompras();
    });
  });

  elComprasTableBody.querySelectorAll('[data-subir]').forEach(marca => {
    marca.addEventListener('click', () => {
      const compra = comprasList.find(c => String(c.id) === marca.dataset.subir);
      if (compra) abrirModalCompra(compra, marca.dataset.campo);
    });
  });

  actualizarBarraCompras();

  elComprasTableBody.querySelectorAll('button[data-editar]').forEach(btn => {
    btn.addEventListener('click', () => {
      const compra = comprasList.find(c => String(c.id) === btn.dataset.editar);
      if (compra) abrirModalCompra(compra);
    });
  });
  elComprasTableBody.querySelectorAll('button[data-eliminar]').forEach(btn => {
    btn.addEventListener('click', () => eliminarCompra(btn.dataset.eliminar));
  });
}

// ---------- Modal de compra ----------
function abrirModalCompra(compra = null, campoFoco = null) {
  if (!esAdmin()) { showToast('Solo el administrador gestiona las compras', 'err'); return; }
  archivosPendientes = { url_documento: null, url_comprobante: null };
  campoArchivoPendiente = campoFoco;

  if (compra) {
    editandoCompraId = compra.id;
    if (elCompraFormTitle) elCompraFormTitle.textContent = 'Editar Compra';
    if (elCompraEditId) elCompraEditId.value = compra.id;
    if (elCompraFecha) elCompraFecha.value = String(compra.fecha || '').slice(0, 10);
    if (elCompraProveedor) elCompraProveedor.value = compra.proveedor || '';
    if (elCompraClasificacion) elCompraClasificacion.value = compra.clasificacion || CLASIFICACIONES_COMPRA[0];
    if (elCompraCosto) elCompraCosto.value = compra.costo_total || 0;
    if (elCompraDescripcion) elCompraDescripcion.value = compra.descripcion || '';
    if (elCompraUrlDocumento) elCompraUrlDocumento.value = compra.url_documento || '';
    if (elCompraUrlComprobante) elCompraUrlComprobante.value = compra.url_comprobante || '';
  } else {
    editandoCompraId = null;
    if (elCompraFormTitle) elCompraFormTitle.textContent = 'Registrar Compra';
    if (elCompraEditId) elCompraEditId.value = '';
    if (elCompraFecha) elCompraFecha.value = todayISO();
    [elCompraProveedor, elCompraCosto, elCompraDescripcion, elCompraUrlDocumento, elCompraUrlComprobante]
      .forEach(el => { if (el) el.value = ''; });
    if (elCompraClasificacion) elCompraClasificacion.value = CLASIFICACIONES_COMPRA[0];
  }

  actualizarEstadoArchivo('url_documento');
  actualizarEstadoArchivo('url_comprobante');
  if (elModalCompra) elModalCompra.classList.add('show');

  setTimeout(() => {
    if (campoArchivoPendiente === 'url_documento') {
      elBtnSubirDocumento?.focus();
      elBtnSubirDocumento?.classList.add('resaltado');
      elCompraArchivoDocumento?.click();
    } else if (campoArchivoPendiente === 'url_comprobante') {
      elBtnSubirComprobante?.focus();
      elBtnSubirComprobante?.classList.add('resaltado');
      elCompraArchivoComprobante?.click();
    } else {
      elCompraProveedor?.focus();
    }
    campoArchivoPendiente = null;
  }, 120);
}

function cerrarModalCompra() {
  if (elModalCompra) elModalCompra.classList.remove('show');
  editandoCompraId = null;
  campoArchivoPendiente = null;
  elBtnSubirDocumento?.classList.remove('resaltado');
  elBtnSubirComprobante?.classList.remove('resaltado');
}

function actualizarEstadoArchivo(campo, texto) {
  const destino = campo === 'url_documento' ? elEstadoDocumento : elEstadoComprobante;
  if (!destino) return;

  const url = campo === 'url_documento' ? elCompraUrlDocumento?.value : elCompraUrlComprobante?.value;
  destino.textContent = texto || (url ? '✔ Archivo cargado' : 'Sin archivo');
  destino.className = 'doc-estado ' + (url ? 'doc-ok' : 'doc-falta');
}

async function subirArchivoCompra(evento, campo) {
  const archivo = evento.target.files[0];
  if (!archivo) return;

  if (archivo.size > 4 * 1024 * 1024) {
    showToast('El archivo supera los 4 MB', 'err');
    evento.target.value = '';
    return;
  }

  actualizarEstadoArchivo(campo, '⏳ Subiendo…');

  try {
    const base64 = await new Promise((resolve, reject) => {
      const lector = new FileReader();
      lector.onload = () => resolve(String(lector.result).split(',')[1]);
      lector.onerror = () => reject(new Error('No se pudo leer el archivo'));
      lector.readAsDataURL(archivo);
    });

    const { url } = await API.compras.subirArchivo(archivo.name, archivo.type, base64);
    if (campo === 'url_documento' && elCompraUrlDocumento) elCompraUrlDocumento.value = url;
    if (campo === 'url_comprobante' && elCompraUrlComprobante) elCompraUrlComprobante.value = url;

    actualizarEstadoArchivo(campo);
    showToast('Archivo cargado', 'ok');
  } catch (err) {
    console.error('Error al subir el archivo:', err.message || err);
    actualizarEstadoArchivo(campo, '✖ No se pudo subir');
    showToast(err.message || 'No se pudo subir el archivo', 'err');
  } finally {
    evento.target.value = '';
  }
}

async function guardarCompra() {
  const costo = Number(elCompraCosto?.value) || 0;
  if (costo <= 0) { showToast('Ingresa el costo total de la compra', 'err'); return; }

  const payload = {
    fecha: elCompraFecha?.value || todayISO(),
    proveedor: elCompraProveedor?.value.trim() || null,
    clasificacion: elCompraClasificacion?.value,
    costo_total: costo,
    descripcion: elCompraDescripcion?.value.trim() || null,
    url_documento: elCompraUrlDocumento?.value.trim() || null,
    url_comprobante: elCompraUrlComprobante?.value.trim() || null
  };

  if (elBtnGuardarCompra) elBtnGuardarCompra.disabled = true;

  try {
    if (editandoCompraId) await API.compras.actualizar(editandoCompraId, payload);
    else await API.compras.crear(payload);

    showToast(editandoCompraId ? 'Compra actualizada' : 'Compra registrada', 'ok');
    cerrarModalCompra();
    cargarCompras();
  } catch (err) {
    console.error('Error al guardar la compra:', err.message || err);
    showToast(err.message || 'No se pudo guardar la compra', 'err');
  } finally {
    if (elBtnGuardarCompra) elBtnGuardarCompra.disabled = false;
  }
}

async function eliminarCompra(id) {
  if (!confirm('¿Eliminar esta compra del registro? Esta acción no se puede deshacer.')) return;

  try {
    await API.compras.eliminar(id);
    showToast('Compra eliminada', 'ok');
    cargarCompras();
  } catch (err) {
    console.error('Error al eliminar la compra:', err.message || err);
    showToast(err.message || 'No se pudo eliminar la compra', 'err');
  }
}

// ============================================================
// EXPORTAR: botón único → período → formato (Excel / CSV / PDF)
// Reutiliza calcularRangoPeriodo(), definida en historial.js.
// ============================================================
function abrirModalExportarCompras() {
  if (!elModalExportarCompras) return;

  periodoExportCompras = 'hoy';
  marcarChipActivo(elComprasExportChips, 'hoy');
  const { desde, hasta } = calcularRangoPeriodo('hoy');
  if (elComprasExportFechaDesde) elComprasExportFechaDesde.value = desde;
  if (elComprasExportFechaHasta) elComprasExportFechaHasta.value = hasta;
  if (elComprasExportFechasPersonalizadas) elComprasExportFechasPersonalizadas.style.display = 'none';

  actualizarResumenExportCompras();
  elModalExportarCompras.classList.add('show');
}

function seleccionarPeriodoExportCompras(periodo) {
  periodoExportCompras = periodo;
  marcarChipActivo(elComprasExportChips, periodo);

  if (periodo !== 'personalizado') {
    const { desde, hasta } = calcularRangoPeriodo(periodo);
    if (elComprasExportFechaDesde) elComprasExportFechaDesde.value = desde;
    if (elComprasExportFechaHasta) elComprasExportFechaHasta.value = hasta;
  }
  if (elComprasExportFechasPersonalizadas) {
    elComprasExportFechasPersonalizadas.style.display = periodo === 'personalizado' ? 'grid' : 'none';
  }
  actualizarResumenExportCompras();
}

function actualizarResumenExportCompras() {
  if (!elComprasExportResumen) return;
  const d = elComprasExportFechaDesde?.value || todayISO();
  const h = elComprasExportFechaHasta?.value || todayISO();
  elComprasExportResumen.textContent = d === h
    ? `Período seleccionado: ${d}`
    : `Período seleccionado: ${d} a ${h}`;
}

async function ejecutarExportarCompras(formato) {
  const desde = elComprasExportFechaDesde?.value;
  const hasta = elComprasExportFechaHasta?.value;
  if (!desde || !hasta) { showToast('Selecciona ambas fechas', 'err'); return; }
  if (desde > hasta) { showToast('La fecha "Desde" no puede ser mayor que "Hasta"', 'err'); return; }

  try {
    const compras = await API.compras.listar({ desde, hasta });
    if (!compras || compras.length === 0) { showToast('No hay compras en ese período', 'err'); return; }

    if (formato === 'pdf') exportarComprasPDF(compras, desde, hasta);
    else exportarComprasPlanilla(formato, compras, desde, hasta);

    elModalExportarCompras?.classList.remove('show');
  } catch (err) {
    console.error('Error al exportar compras:', err.message || err);
    showToast(err.message || 'Error al exportar', 'err');
  }
}

function filasComprasParaExportar(compras) {
  return (compras || []).map(c => ({
    Fecha: tsAChile(c.fecha),
    Proveedor: c.proveedor || '',
    Clasificación: c.clasificacion || '',
    Detalle: c.descripcion || '',
    'Costo Total': Number(c.costo_total) || 0,
    'Factura / Boleta': c.url_documento || 'SIN DOCUMENTO',
    'Comprobante de Pago': c.url_comprobante || 'SIN COMPROBANTE'
  }));
}

function exportarComprasPlanilla(formato, compras, desde, hasta) {
  const filas = filasComprasParaExportar(compras);
  const libro = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(libro, XLSX.utils.json_to_sheet(filas), 'Compras');
  XLSX.writeFile(libro, `compras_${desde}_a_${hasta}.${formato}`, { bookType: formato === 'csv' ? 'csv' : 'xlsx' });
  showToast('Exportación generada', 'ok');
}

function exportarComprasPDF(compras, desde, hasta) {
  if (typeof window.jspdf === 'undefined') { showToast('No se pudo cargar el generador de PDF', 'err'); return; }

  const total = compras.reduce((a, c) => a + (Number(c.costo_total) || 0), 0);
  const sinDoc = compras.filter(c => !c.url_documento).length;
  const sinComp = compras.filter(c => !c.url_comprobante).length;

  const porClasificacion = {};
  compras.forEach(c => {
    const k = c.clasificacion || 'Sin clasificar';
    porClasificacion[k] = (porClasificacion[k] || 0) + (Number(c.costo_total) || 0);
  });
  const desglose = Object.entries(porClasificacion)
    .sort((a, b) => b[1] - a[1])
    .map(([nombre, monto]) => `${total > 0 ? ((monto / total) * 100).toFixed(0) : 0}% ${nombre}`)
    .join('   ·   ');

  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ orientation: 'landscape' });

  doc.setFontSize(15);
  doc.setTextColor(15, 23, 42);
  doc.text(`Historial de Compras - ${NEGOCIO_NOMBRE}`, 14, 15);

  doc.setFontSize(9);
  doc.setTextColor(71, 85, 105);
  doc.text(`Período: ${desde} a ${hasta}   ·   ${compras.length} compra(s)   ·   Generado: ${fechaHoraISOChile()} (hora de Chile)`, 14, 21);

  const anchoUtil = doc.internal.pageSize.getWidth() - 28;
  doc.setDrawColor(203, 213, 225);
  doc.setFillColor(241, 245, 249);
  doc.roundedRect(14, 25, anchoUtil, 22, 2, 2, 'FD');

  doc.setFontSize(10);
  doc.setTextColor(15, 23, 42);
  doc.setFont(undefined, 'bold');
  doc.text(`Total del Período: ${fmtCLP(total)}`, 19, 32);
  doc.text(`Sin Factura: ${sinDoc}`, 140, 32);
  doc.text(`Sin Comprobante: ${sinComp}`, 210, 32);

  doc.setFont(undefined, 'normal');
  doc.setFontSize(9);
  doc.setTextColor(51, 65, 85);
  doc.text(`Por clasificación:  ${desglose || 'Sin registros'}`, 19, 41, { maxWidth: anchoUtil - 10 });

  doc.autoTable({
    startY: 52,
    head: [['Fecha', 'Proveedor', 'Clasificación', 'Detalle', 'Costo', 'Factura', 'Comprobante']],
    body: compras.map(c => [
      tsAChile(c.fecha), c.proveedor || '—', c.clasificacion || '', (c.descripcion || '').slice(0, 40),
      fmtCLP(c.costo_total), c.url_documento ? 'Sí' : 'No', c.url_comprobante ? 'Sí' : 'No'
    ]),
    styles: { fontSize: 8, cellPadding: 2.5 },
    headStyles: { fillColor: [30, 41, 59], textColor: [248, 250, 252] },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    columnStyles: { 4: { halign: 'right' } },
    foot: [['', '', '', 'TOTAL', fmtCLP(total), '', '']],
    footStyles: { fillColor: [15, 23, 42], textColor: [251, 191, 36], fontStyle: 'bold', halign: 'right' }
  });

  doc.save(`compras_${desde}_a_${hasta}.pdf`);
  showToast('PDF generado', 'ok');
}
