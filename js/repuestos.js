// ==========================================
// REPUESTOS.JS - Repuestos Internos de Taller
// ------------------------------------------
// Inventario propio del taller, separado del catálogo comercial.
// Se organiza por Área/Tipo → Categoría Base → Modelo Exacto, y los
// valores ya usados quedan disponibles como autocompletado.
// ==========================================

let repuestosList = [];
let editandoRepuestoId = null;

const AREAS_SUGERIDAS = ['Teléfonos', 'Laptops', 'Consolas', 'Componentes SMD', 'Impresoras', 'Tablets'];
const CATEGORIAS_SUGERIDAS = ['Batería', 'Pantalla', 'FPC', 'Sub-Board', 'BIOS', 'Capacitores', 'Conector de carga', 'Teclado', 'Bisagras', 'Mano de obra'];
const STOCK_MINIMO_REPUESTO = 2;

const ICO_EDITAR_REP = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>`;
const ICO_ELIMINAR_REP = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M8 6V4h8v2"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/></svg>`;

const elRepuestosTableBody = document.getElementById('repuestosTableBody');
const elRepuestosBuscar = document.getElementById('repuestosBuscar');
const elRepuestosFiltroArea = document.getElementById('repuestosFiltroArea');
const elRepuestosFiltroCategoria = document.getElementById('repuestosFiltroCategoria');
const elBtnRecargarRepuestos = document.getElementById('btnRecargarRepuestos');
const elRepuestosResumenLabel = document.getElementById('repuestosResumenLabel');
const elPanelBajoStockRepuestos = document.getElementById('panelBajoStockRepuestos');
const elListaBajoStockRepuestos = document.getElementById('listaBajoStockRepuestos');
const elBadgeBajoStockRepuestos = document.getElementById('badgeBajoStockRepuestos');
const elBtnValorizacionRepuestos = document.getElementById('btnValorizacionRepuestos');

const elModalRepuesto = document.getElementById('modalRepuesto');
const elRepuestoFormTitle = document.getElementById('repuestoFormTitle');
const elRepuestoEditId = document.getElementById('repuestoEditId');
const elRepuestoArea = document.getElementById('repuestoArea');
const elRepuestoCategoria = document.getElementById('repuestoCategoria');
const elRepuestoModelo = document.getElementById('repuestoModelo');
const elRepuestoDescripcion = document.getElementById('repuestoDescripcion');
const elRepuestoCosto = document.getElementById('repuestoCosto');
const elRepuestoPrecio = document.getElementById('repuestoPrecio');
const elRepuestoStock = document.getElementById('repuestoStock');
const elRepuestoStockMinimo = document.getElementById('repuestoStockMinimo');
const elRepuestoUbicacion = document.getElementById('repuestoUbicacion');
const elRepuestoSinAlerta = document.getElementById('repuestoSinAlerta');
const elRepuestoMargen = document.getElementById('repuestoMargen');
const elBtnNuevoRepuesto = document.getElementById('btnNuevoRepuesto');
const elBtnCancelarRepuesto = document.getElementById('btnCancelarRepuesto');
const elBtnGuardarRepuesto = document.getElementById('btnGuardarRepuesto');

// Autocompletado propio (reemplaza el <datalist> nativo)
const elSugerenciasRepuestoArea = document.getElementById('sugerenciasRepuestoArea');
const elSugerenciasRepuestoCategoria = document.getElementById('sugerenciasRepuestoCategoria');
const elSugerenciasRepuestoModelo = document.getElementById('sugerenciasRepuestoModelo');

// Stock ilimitado
const elRepuestoStockIlimitado = document.getElementById('repuestoStockIlimitado');
const elGridRepuestoStockControl = document.getElementById('gridRepuestoStockControl');
const elItemRepuestoStockIlimitado = document.getElementById('itemRepuestoStockIlimitado');

// Administrar Áreas / Categorías
const elBtnAdminCategoriasRepuesto = document.getElementById('btnAdminCategoriasRepuesto');
const elModalAdminCategorias = document.getElementById('modalAdminCategorias');
const elBtnCerrarAdminCategorias = document.getElementById('btnCerrarAdminCategorias');
const elListaAdminAreas = document.getElementById('listaAdminAreas');
const elListaAdminCategorias = document.getElementById('listaAdminCategorias');
const elNuevaAreaInput = document.getElementById('nuevaAreaInput');
const elBtnNuevaArea = document.getElementById('btnNuevaArea');
const elNuevaCategoriaInput = document.getElementById('nuevaCategoriaInput');
const elBtnNuevaCategoria = document.getElementById('btnNuevaCategoria');

// Listas cargadas desde el catálogo administrable (áreas/categorías con conteo de uso)
let areasAdminList = [];
let categoriasAdminList = [];

document.addEventListener('DOMContentLoaded', () => {
  if (elBtnNuevoRepuesto) elBtnNuevoRepuesto.addEventListener('click', () => abrirModalRepuesto());
  if (elBtnCancelarRepuesto) elBtnCancelarRepuesto.addEventListener('click', cerrarModalRepuesto);
  if (elBtnGuardarRepuesto) elBtnGuardarRepuesto.addEventListener('click', guardarRepuesto);
  if (elBtnRecargarRepuestos) elBtnRecargarRepuestos.addEventListener('click', cargarRepuestos);
  if (elBtnValorizacionRepuestos) elBtnValorizacionRepuestos.addEventListener('click', mostrarValorizacionRepuestos);

  if (elRepuestosBuscar) elRepuestosBuscar.addEventListener('input', () => renderRepuestosTabla(repuestosList));
  [elRepuestosFiltroArea, elRepuestosFiltroCategoria].forEach(el => {
    if (el) el.addEventListener('change', () => renderRepuestosTabla(repuestosList));
  });

  [elRepuestoCosto, elRepuestoPrecio].forEach(el => {
    if (el) el.addEventListener('input', actualizarMargenRepuesto);
  });

  if (elRepuestoStockIlimitado) elRepuestoStockIlimitado.addEventListener('change', aplicarStockIlimitadoRepuestoUI);

  if (elModalRepuesto) {
    elModalRepuesto.addEventListener('click', (e) => { if (e.target === elModalRepuesto) cerrarModalRepuesto(); });
  }

  // Autocompletado con estilo propio para Área, Categoría y Modelo
  activarAutocompletoTexto(elRepuestoArea, elSugerenciasRepuestoArea, () => areasAdminList.map(a => a.nombre));
  activarAutocompletoTexto(elRepuestoCategoria, elSugerenciasRepuestoCategoria, () => categoriasAdminList.map(c => c.nombre));
  activarAutocompletoTexto(elRepuestoModelo, elSugerenciasRepuestoModelo, () => valoresUnicos('modelo'));

  // Administrar Áreas y Categorías
  if (elBtnAdminCategoriasRepuesto) elBtnAdminCategoriasRepuesto.addEventListener('click', abrirModalAdminCategorias);
  if (elBtnCerrarAdminCategorias) elBtnCerrarAdminCategorias.addEventListener('click', () => elModalAdminCategorias?.classList.remove('show'));
  if (elModalAdminCategorias) {
    elModalAdminCategorias.addEventListener('click', (e) => { if (e.target === elModalAdminCategorias) elModalAdminCategorias.classList.remove('show'); });
  }
  if (elBtnNuevaArea) elBtnNuevaArea.addEventListener('click', () => agregarValorCatalogo('areas'));
  if (elBtnNuevaCategoria) elBtnNuevaCategoria.addEventListener('click', () => agregarValorCatalogo('categorias'));
  if (elNuevaAreaInput) elNuevaAreaInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); agregarValorCatalogo('areas'); } });
  if (elNuevaCategoriaInput) elNuevaCategoriaInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); agregarValorCatalogo('categorias'); } });
});

// ============================================================
// CARGA Y RENDER
// ============================================================
async function cargarRepuestos() {
  if (!tokenActual()) return;

  try {
    repuestosList = await API.repuestos.listar();
    await cargarCatalogoAreasYCategorias();
    poblarFiltrosRepuestos();
    renderRepuestosTabla(repuestosList);
    renderPanelBajoStockRepuestos();
  } catch (err) {
    console.error('Error al cargar repuestos:', err.message || err);
    showToast(err.message || 'No se pudieron cargar los repuestos', 'err');
  }
}

/* Trae el catálogo administrable (con conteo de uso) para alimentar los
   filtros, el autocompletado y el panel de administración. */
async function cargarCatalogoAreasYCategorias() {
  try {
    [areasAdminList, categoriasAdminList] = await Promise.all([
      API.repuestos.listarAreas(),
      API.repuestos.listarCategorias()
    ]);
  } catch (err) {
    console.error('Error al cargar áreas/categorías:', err.message || err);
    areasAdminList = areasAdminList.length ? areasAdminList : [];
    categoriasAdminList = categoriasAdminList.length ? categoriasAdminList : [];
  }
}

/* Los valores ya usados alimentan filtros y autocompletado */
function valoresUnicos(campo, sugeridos = []) {
  const usados = repuestosList.map(r => (r[campo] || '').trim()).filter(Boolean);
  return [...new Set([...usados, ...sugeridos])].sort((a, b) => a.localeCompare(b));
}

function poblarFiltrosRepuestos() {
  const areas = areasAdminList.length ? areasAdminList.map(a => a.nombre).sort((a, b) => a.localeCompare(b)) : valoresUnicos('area', AREAS_SUGERIDAS);
  const categorias = categoriasAdminList.length ? categoriasAdminList.map(c => c.nombre).sort((a, b) => a.localeCompare(b)) : valoresUnicos('categoria', CATEGORIAS_SUGERIDAS);

  const pintarSelect = (select, valores, etiqueta) => {
    if (!select) return;
    const actual = select.value;
    select.innerHTML = `<option value="">${etiqueta}</option>` +
      valores.map(v => `<option value="${v}">${v}</option>`).join('');
    select.value = actual;
  };

  pintarSelect(elRepuestosFiltroArea, areas, 'Todas las áreas');
  pintarSelect(elRepuestosFiltroCategoria, categorias, 'Todas las categorías');
}

function limiteStockRepuesto(r) {
  const limite = Number(r.stock_minimo);
  return Number.isFinite(limite) && limite > 0 ? limite : STOCK_MINIMO_REPUESTO;
}

function enAlertaRepuesto(r) {
  if (r.stock_ilimitado || r.alerta_stock === false) return false;
  return Number(r.stock || 0) <= limiteStockRepuesto(r);
}

function badgeStockRepuesto(r) {
  if (r.stock_ilimitado) return `<span class="stock-badge stock-ok">♾️ Ilimitado</span>`;
  const stock = Number(r.stock) || 0;
  if (r.alerta_stock === false) return `<span class="stock-badge stock-ok">${stock}</span>`;
  if (stock <= 0) return `<span class="stock-badge stock-agotado">Agotado</span>`;
  if (stock <= limiteStockRepuesto(r)) return `<span class="stock-badge stock-bajo">⚠️ ${stock}</span>`;
  return `<span class="stock-badge stock-ok">${stock}</span>`;
}

function repuestosFiltrados() {
  const texto = (elRepuestosBuscar?.value || '').trim().toLowerCase();
  const area = elRepuestosFiltroArea?.value || '';
  const categoria = elRepuestosFiltroCategoria?.value || '';

  return repuestosList.filter(r => {
    if (area && r.area !== area) return false;
    if (categoria && r.categoria !== categoria) return false;
    if (!texto) return true;
    return [r.modelo, r.categoria, r.area, r.descripcion, r.ubicacion]
      .some(v => (v || '').toLowerCase().includes(texto));
  });
}

function renderRepuestosTabla(lista) {
  if (!elRepuestosTableBody) return;

  const filas = repuestosFiltrados();
  const total = filas.reduce((a, r) => a + (Number(r.stock) || 0) * (Number(r.precio_venta) || 0), 0);

  if (elRepuestosResumenLabel) {
    elRepuestosResumenLabel.textContent =
      `${filas.length} repuesto(s) en pantalla · ${fmtCLP(total)} en venta potencial`;
  }

  if (filas.length === 0) {
    elRepuestosTableBody.innerHTML = '<tr class="empty-row"><td colspan="8">No hay repuestos con este filtro. Crea uno con “Nuevo Repuesto”.</td></tr>';
    return;
  }

  elRepuestosTableBody.innerHTML = filas.map(r => `
    <tr class="row-in">
      <td><span class="badge badge-blue">${r.area}</span></td>
      <td>${r.categoria}</td>
      <td>
        <span class="strong">${r.modelo}</span>
        ${r.descripcion ? `<br><small style="color:var(--text-muted);">${r.descripcion}</small>` : ''}
      </td>
      <td class="admin-only num">${fmtCLP(r.costo_unitario)}</td>
      <td class="num strong">${fmtCLP(r.precio_venta)}</td>
      <td>${badgeStockRepuesto(r)}</td>
      <td class="stock-fecha">${r.ubicacion || '—'}</td>
      <td>
        <div class="cell-actions">
          <button class="btn btn-icon btn-icon-edit admin-only" data-editar="${r.id}" title="Editar repuesto">${ICO_EDITAR_REP}</button>
          <button class="btn btn-icon btn-icon-del admin-only" data-eliminar="${r.id}" title="Eliminar repuesto">${ICO_ELIMINAR_REP}</button>
        </div>
      </td>
    </tr>
  `).join('');

  elRepuestosTableBody.querySelectorAll('button[data-editar]').forEach(btn => {
    btn.addEventListener('click', () => {
      const repuesto = repuestosList.find(r => String(r.id) === btn.dataset.editar);
      if (repuesto) abrirModalRepuesto(repuesto);
    });
  });
  elRepuestosTableBody.querySelectorAll('button[data-eliminar]').forEach(btn => {
    btn.addEventListener('click', () => eliminarRepuesto(btn.dataset.eliminar));
  });
}

function renderPanelBajoStockRepuestos() {
  if (!elPanelBajoStockRepuestos) return;

  const enAlerta = repuestosList.filter(enAlertaRepuesto)
    .sort((a, b) => (Number(a.stock) || 0) - (Number(b.stock) || 0));

  if (enAlerta.length === 0) { elPanelBajoStockRepuestos.style.display = 'none'; return; }

  elPanelBajoStockRepuestos.style.display = 'block';
  if (elBadgeBajoStockRepuestos) elBadgeBajoStockRepuestos.textContent = String(enAlerta.length);
  if (elListaBajoStockRepuestos) {
    elListaBajoStockRepuestos.innerHTML = enAlerta.slice(0, 12).map(r => `
      <div class="alerta-stock-item" data-abrir="${r.id}" title="${r.area} · ${r.categoria}">
        <span>${r.modelo}</span>
        <b>${Number(r.stock) || 0}</b>
        <span style="color:var(--text-muted);">/ mín. ${limiteStockRepuesto(r)}</span>
      </div>
    `).join('');

    elListaBajoStockRepuestos.querySelectorAll('[data-abrir]').forEach(item => {
      item.addEventListener('click', () => {
        const repuesto = repuestosList.find(r => String(r.id) === item.dataset.abrir);
        if (repuesto) abrirModalRepuesto(repuesto);
      });
    });
  }
}

const elModalValorizacionRepuestos = document.getElementById('modalValorizacionRepuestos');
const elValorizacionRepDetalle = document.getElementById('valorizacionRepDetalle');
const elValorRepCosto = document.getElementById('valorRepCosto');
const elValorRepVenta = document.getElementById('valorRepVenta');
const elValorRepGanancia = document.getElementById('valorRepGanancia');
const elValorRepMargen = document.getElementById('valorRepMargen');
const elValorizacionRepNota = document.getElementById('valorizacionRepNota');
const elBtnCerrarValorizacionRepuestos = document.getElementById('btnCerrarValorizacionRepuestos');

function mostrarValorizacionRepuestos() {
  if (!elModalValorizacionRepuestos) return;

  // Los ítems de stock ilimitado no aportan a la valorización: su "stock"
  // no representa unidades físicas reales.
  const conStockReal = repuestosList.filter(r => !r.stock_ilimitado);
  const ilimitados = repuestosList.length - conStockReal.length;

  const costo = conStockReal.reduce((a, r) => a + (Number(r.stock) || 0) * (Number(r.costo_unitario) || 0), 0);
  const venta = conStockReal.reduce((a, r) => a + (Number(r.stock) || 0) * (Number(r.precio_venta) || 0), 0);
  const ganancia = venta - costo;
  const unidades = conStockReal.reduce((a, r) => a + (Number(r.stock) || 0), 0);
  const margen = venta > 0 ? (ganancia / venta) * 100 : 0;
  const sinCosto = conStockReal.filter(r => (Number(r.stock) || 0) > 0 && !(Number(r.costo_unitario) > 0)).length;

  if (elValorRepCosto) elValorRepCosto.textContent = fmtCLP(costo);
  if (elValorRepVenta) elValorRepVenta.textContent = fmtCLP(venta);
  if (elValorRepGanancia) elValorRepGanancia.textContent = fmtCLP(ganancia);
  if (elValorRepMargen) elValorRepMargen.textContent = `Margen estimado ${margen.toFixed(1)}%`;
  if (elValorizacionRepDetalle) {
    elValorizacionRepDetalle.textContent =
      `${repuestosList.length} repuesto(s) · ${unidades} unidad(es) en stock · actualizado al ${fechaHoraISOChile()}`;
  }
  if (elValorizacionRepNota) {
    const notas = [];
    if (ilimitados > 0) notas.push(`${ilimitados} repuesto(s) con stock ilimitado quedaron fuera de este cálculo.`);
    if (sinCosto > 0) notas.push(`${sinCosto} repuesto(s) con stock no tienen costo unitario cargado, por lo que la ganancia proyectada aparece más alta de lo real.`);
    elValorizacionRepNota.textContent = notas.join(' ');
  }

  elModalValorizacionRepuestos.classList.add('show');
}

document.addEventListener('DOMContentLoaded', () => {
  if (elBtnCerrarValorizacionRepuestos) {
    elBtnCerrarValorizacionRepuestos.addEventListener('click', () => elModalValorizacionRepuestos?.classList.remove('show'));
  }
  if (elModalValorizacionRepuestos) {
    elModalValorizacionRepuestos.addEventListener('click', (e) => {
      if (e.target === elModalValorizacionRepuestos) elModalValorizacionRepuestos.classList.remove('show');
    });
  }
});

// ============================================================
// MODAL CREAR / EDITAR
// ============================================================
/* Cuando el repuesto es de stock ilimitado (ej. mano de obra), el campo
   Stock deja de tener sentido: se deshabilita y se ocultan los controles
   de alerta de bajo stock. */
function aplicarStockIlimitadoRepuestoUI() {
  const ilimitado = !!(elRepuestoStockIlimitado && elRepuestoStockIlimitado.checked);

  if (elRepuestoStock) {
    elRepuestoStock.disabled = ilimitado;
    elRepuestoStock.placeholder = ilimitado ? 'Ilimitado' : '0';
    if (ilimitado) elRepuestoStock.value = '';
  }
  if (elGridRepuestoStockControl) elGridRepuestoStockControl.style.display = ilimitado ? 'none' : '';
}

function abrirModalRepuesto(repuesto = null) {
  if (!elModalRepuesto) return;
  if (!esAdmin()) { showToast('Solo el administrador gestiona el inventario de taller', 'err'); return; }

  poblarFiltrosRepuestos();

  if (repuesto) {
    editandoRepuestoId = repuesto.id;
    if (elRepuestoFormTitle) elRepuestoFormTitle.textContent = `Editar ${repuesto.modelo}`;
    if (elRepuestoEditId) elRepuestoEditId.value = repuesto.id;
    if (elRepuestoArea) elRepuestoArea.value = repuesto.area || '';
    if (elRepuestoCategoria) elRepuestoCategoria.value = repuesto.categoria || '';
    if (elRepuestoModelo) elRepuestoModelo.value = repuesto.modelo || '';
    if (elRepuestoDescripcion) elRepuestoDescripcion.value = repuesto.descripcion || '';
    if (elRepuestoCosto) elRepuestoCosto.value = repuesto.costo_unitario || 0;
    if (elRepuestoPrecio) elRepuestoPrecio.value = repuesto.precio_venta || 0;
    if (elRepuestoStock) elRepuestoStock.value = repuesto.stock || 0;
    if (elRepuestoStockMinimo) elRepuestoStockMinimo.value = repuesto.stock_minimo ?? STOCK_MINIMO_REPUESTO;
    if (elRepuestoUbicacion) elRepuestoUbicacion.value = repuesto.ubicacion || '';
    if (elRepuestoSinAlerta) elRepuestoSinAlerta.checked = repuesto.alerta_stock === false;
    if (elRepuestoStockIlimitado) elRepuestoStockIlimitado.checked = !!repuesto.stock_ilimitado;
  } else {
    editandoRepuestoId = null;
    if (elRepuestoFormTitle) elRepuestoFormTitle.textContent = 'Nuevo Repuesto de Taller';
    if (elRepuestoEditId) elRepuestoEditId.value = '';
    [elRepuestoArea, elRepuestoCategoria, elRepuestoModelo, elRepuestoDescripcion, elRepuestoUbicacion]
      .forEach(el => { if (el) el.value = ''; });
    [elRepuestoCosto, elRepuestoPrecio, elRepuestoStock].forEach(el => { if (el) el.value = ''; });
    if (elRepuestoStockMinimo) elRepuestoStockMinimo.value = STOCK_MINIMO_REPUESTO;
    if (elRepuestoSinAlerta) elRepuestoSinAlerta.checked = false;
    if (elRepuestoStockIlimitado) elRepuestoStockIlimitado.checked = false;
  }

  aplicarStockIlimitadoRepuestoUI();
  actualizarMargenRepuesto();
  elModalRepuesto.classList.add('show');
  setTimeout(() => elRepuestoArea?.focus(), 80);
}

function cerrarModalRepuesto() {
  if (elModalRepuesto) elModalRepuesto.classList.remove('show');
  editandoRepuestoId = null;
}

function actualizarMargenRepuesto() {
  if (!elRepuestoMargen) return;
  const costo = Number(elRepuestoCosto?.value) || 0;
  const precio = Number(elRepuestoPrecio?.value) || 0;

  if (precio <= 0) { elRepuestoMargen.textContent = 'Margen estimado: —'; return; }
  const ganancia = precio - costo;
  elRepuestoMargen.textContent =
    `Margen estimado: ${fmtCLP(ganancia)} por unidad (${((ganancia / precio) * 100).toFixed(1)}%)`;
}

async function guardarRepuesto() {
  const payload = {
    area: elRepuestoArea?.value.trim(),
    categoria: elRepuestoCategoria?.value.trim(),
    modelo: elRepuestoModelo?.value.trim(),
    descripcion: elRepuestoDescripcion?.value.trim() || null,
    costo_unitario: Number(elRepuestoCosto?.value) || 0,
    precio_venta: Number(elRepuestoPrecio?.value) || 0,
    stock: Number(elRepuestoStock?.value) || 0,
    stock_minimo: Number(elRepuestoStockMinimo?.value) || 0,
    ubicacion: elRepuestoUbicacion?.value.trim() || null,
    alerta_stock: !(elRepuestoSinAlerta && elRepuestoSinAlerta.checked),
    stock_ilimitado: !!(elRepuestoStockIlimitado && elRepuestoStockIlimitado.checked)
  };

  if (!payload.area) { showToast('Indica el área o tipo', 'err'); elRepuestoArea?.focus(); return; }
  if (!payload.categoria) { showToast('Indica la categoría base', 'err'); elRepuestoCategoria?.focus(); return; }
  if (!payload.modelo) { showToast('Indica el modelo exacto', 'err'); elRepuestoModelo?.focus(); return; }
  if (payload.precio_venta <= 0) { showToast('El precio de venta debe ser mayor a 0', 'err'); elRepuestoPrecio?.focus(); return; }

  if (elBtnGuardarRepuesto) elBtnGuardarRepuesto.disabled = true;

  try {
    if (editandoRepuestoId) await API.repuestos.actualizar(editandoRepuestoId, payload);
    else await API.repuestos.crear(payload);

    showToast(editandoRepuestoId ? 'Repuesto actualizado' : 'Repuesto agregado al taller', 'ok');
    cerrarModalRepuesto();
    cargarRepuestos();
  } catch (err) {
    console.error('Error al guardar el repuesto:', err.message || err);
    showToast(err.message || 'No se pudo guardar el repuesto', 'err');
  } finally {
    if (elBtnGuardarRepuesto) elBtnGuardarRepuesto.disabled = false;
  }
}

async function eliminarRepuesto(id) {
  if (!confirm('¿Eliminar este repuesto del inventario de taller?')) return;
  try {
    await API.repuestos.eliminar(id);
    showToast('Repuesto eliminado', 'ok');
    cargarRepuestos();
  } catch (err) {
    showToast(err.message || 'No se pudo eliminar el repuesto', 'err');
  }
}

/* Búsqueda usada por el modal de repuestos de una OT */
function buscarRepuestosPorTexto(texto, limite = 8) {
  const t = String(texto || '').trim().toLowerCase();
  if (!t) return [];
  return repuestosList.filter(r =>
    [r.modelo, r.categoria, r.area, r.descripcion].some(v => (v || '').toLowerCase().includes(t))
  ).slice(0, limite);
}

document.addEventListener('pos:sesion-iniciada', () => cargarRepuestos());

// ============================================================
// ADMINISTRAR ÁREAS Y CATEGORÍAS (renombrar / eliminar / agregar)
// ============================================================
async function abrirModalAdminCategorias() {
  if (!elModalAdminCategorias) return;
  if (!esAdmin()) { showToast('Solo el administrador gestiona estas categorías', 'err'); return; }

  await cargarCatalogoAreasYCategorias();
  renderListaAdminCategoria('areas');
  renderListaAdminCategoria('categorias');
  elModalAdminCategorias.classList.add('show');
}

function configCatalogo(tipo) {
  return tipo === 'areas'
    ? { lista: areasAdminList, contenedor: elListaAdminAreas, api: 'listarAreas', crear: 'crearArea', renombrar: 'renombrarArea', eliminar: 'eliminarArea', etiqueta: 'área' }
    : { lista: categoriasAdminList, contenedor: elListaAdminCategorias, api: 'listarCategorias', crear: 'crearCategoria', renombrar: 'renombrarCategoria', eliminar: 'eliminarCategoria', etiqueta: 'categoría' };
}

function renderListaAdminCategoria(tipo) {
  const cfg = configCatalogo(tipo);
  if (!cfg.contenedor) return;

  const lista = tipo === 'areas' ? areasAdminList : categoriasAdminList;

  if (!lista || lista.length === 0) {
    cfg.contenedor.innerHTML = `<p class="admin-cat-vacio">Aún no hay ${cfg.etiqueta}s registradas.</p>`;
    return;
  }

  cfg.contenedor.innerHTML = lista.map(v => `
    <div class="admin-cat-row" data-id="${v.id}">
      <span class="admin-cat-nombre" data-nombre>${v.nombre}</span>
      <span class="admin-cat-usos">${v.usos} ${v.usos === 1 ? 'repuesto' : 'repuestos'}</span>
      <div class="cell-actions">
        <button class="btn btn-icon btn-icon-edit" data-renombrar title="Renombrar">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>
        </button>
        <button class="btn btn-icon btn-icon-del" data-eliminar title="Eliminar${v.usos > 0 ? ' (en uso, no se puede)' : ''}" ${v.usos > 0 ? 'disabled style="opacity:.4;cursor:not-allowed;"' : ''}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M8 6V4h8v2"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/></svg>
        </button>
      </div>
    </div>
  `).join('');

  cfg.contenedor.querySelectorAll('[data-renombrar]').forEach(btn => {
    btn.addEventListener('click', () => iniciarRenombreCategoria(tipo, btn.closest('.admin-cat-row')));
  });
  cfg.contenedor.querySelectorAll('[data-eliminar]:not(:disabled)').forEach(btn => {
    btn.addEventListener('click', () => eliminarValorCatalogo(tipo, btn.closest('.admin-cat-row').dataset.id));
  });
}

function iniciarRenombreCategoria(tipo, fila) {
  if (!fila) return;
  const spanNombre = fila.querySelector('[data-nombre]');
  const nombreActual = spanNombre.textContent;

  spanNombre.innerHTML = `
    <input type="text" value="${nombreActual.replace(/"/g, '&quot;')}" class="admin-cat-input-edit">
  `;
  const input = spanNombre.querySelector('input');
  input.focus();
  input.select();

  // Reemplaza los botones de esa fila por Guardar / Cancelar mientras se edita
  const acciones = fila.querySelector('.cell-actions');
  const accionesOriginal = acciones.innerHTML;
  acciones.innerHTML = `
    <button class="btn btn-icon btn-icon-view" data-guardar title="Guardar">✔</button>
    <button class="btn btn-icon btn-icon-del" data-cancelar title="Cancelar">✖</button>
  `;

  const confirmar = () => guardarRenombreCategoria(tipo, fila.dataset.id, input.value.trim());
  const cancelar = () => renderListaAdminCategoria(tipo);

  acciones.querySelector('[data-guardar]').addEventListener('click', confirmar);
  acciones.querySelector('[data-cancelar]').addEventListener('click', cancelar);
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { e.preventDefault(); confirmar(); }
    if (e.key === 'Escape') { e.preventDefault(); cancelar(); }
  });
}

async function guardarRenombreCategoria(tipo, id, nuevoNombre) {
  if (!nuevoNombre) { showToast('Escribe un nombre', 'err'); return; }
  const cfg = configCatalogo(tipo);

  try {
    await API.repuestos[cfg.renombrar](id, nuevoNombre);
    showToast(`Se actualizó en todos los repuestos que usaban ese valor`, 'ok');
    await cargarCatalogoAreasYCategorias();
    renderListaAdminCategoria(tipo);
    poblarFiltrosRepuestos();
    renderRepuestosTabla(repuestosList); // por si algún repuesto en pantalla cambió de nombre
    await cargarRepuestos();
  } catch (err) {
    console.error('Error al renombrar:', err.message || err);
    showToast(err.message || 'No se pudo renombrar', 'err');
    renderListaAdminCategoria(tipo);
  }
}

async function eliminarValorCatalogo(tipo, id) {
  const cfg = configCatalogo(tipo);
  if (!confirm(`¿Eliminar esta ${cfg.etiqueta} de la lista?`)) return;

  try {
    await API.repuestos[cfg.eliminar](id);
    showToast(`${cfg.etiqueta[0].toUpperCase()}${cfg.etiqueta.slice(1)} eliminada`, 'ok');
    await cargarCatalogoAreasYCategorias();
    renderListaAdminCategoria(tipo);
    poblarFiltrosRepuestos();
  } catch (err) {
    console.error('Error al eliminar:', err.message || err);
    showToast(err.message || 'No se pudo eliminar', 'err');
  }
}

async function agregarValorCatalogo(tipo) {
  const input = tipo === 'areas' ? elNuevaAreaInput : elNuevaCategoriaInput;
  const nombre = (input?.value || '').trim();
  if (!nombre) { showToast('Escribe un nombre', 'err'); input?.focus(); return; }

  const cfg = configCatalogo(tipo);
  try {
    await API.repuestos[cfg.crear](nombre);
    if (input) input.value = '';
    showToast(`${cfg.etiqueta[0].toUpperCase()}${cfg.etiqueta.slice(1)} agregada`, 'ok');
    await cargarCatalogoAreasYCategorias();
    renderListaAdminCategoria(tipo);
    poblarFiltrosRepuestos();
  } catch (err) {
    console.error('Error al agregar:', err.message || err);
    showToast(err.message || 'No se pudo agregar', 'err');
  }
}
