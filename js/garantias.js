/* ============================================================
   GARANTÍAS — busca ventas de productos y órdenes de trabajo entregadas
   para revisar el estado de su garantía (vigente/vencida). Ver
   sql/31-garantias.sql y GET /api/garantias/productos|servicios en
   api/index.js (ahí se calcula vence_el/estado_garantia, nunca acá).
   Mismo patrón de sub-pestañas que Página Web (js/pagina-web.js) y de
   buscador con debounce que el Historial de Ventas (js/historial.js).
   ============================================================ */

let garantiasProductosList = [];
let garantiasServiciosList = [];
let filtroEstadoGarantiasProductos = '';
let filtroEstadoGarantiasServicios = '';

const elSubtabsGarantias = document.getElementById('subtabsGarantias');

const elGarantiasProductosBuscar = document.getElementById('garantiasProductosBuscar');
const elGarantiasProductosChips = document.getElementById('garantiasProductosChips');
const elGarantiasProductosTableBody = document.getElementById('garantiasProductosTableBody');
const elBtnRecargarGarantiasProductos = document.getElementById('btnRecargarGarantiasProductos');

const elGarantiasServiciosBuscar = document.getElementById('garantiasServiciosBuscar');
const elGarantiasServiciosChips = document.getElementById('garantiasServiciosChips');
const elGarantiasServiciosTableBody = document.getElementById('garantiasServiciosTableBody');
const elBtnRecargarGarantiasServicios = document.getElementById('btnRecargarGarantiasServicios');

document.addEventListener('DOMContentLoaded', () => {
  if (elSubtabsGarantias) {
    elSubtabsGarantias.addEventListener('click', (e) => {
      const b = e.target.closest('.subtab');
      if (b) mostrarPanelGarantias(b.dataset.subtab);
    });
  }

  /* Buscador con debounce (mismo criterio que el Historial de Ventas,
     js/historial.js): esperar a que la persona termine de escribir antes
     de golpear al servidor, pero Enter busca al tiro. */
  if (elGarantiasProductosBuscar) {
    let temp = null;
    elGarantiasProductosBuscar.addEventListener('input', () => {
      clearTimeout(temp);
      temp = setTimeout(cargarGarantiasProductos, 350);
    });
    elGarantiasProductosBuscar.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') { e.preventDefault(); clearTimeout(temp); cargarGarantiasProductos(); }
    });
  }
  if (elGarantiasServiciosBuscar) {
    let temp = null;
    elGarantiasServiciosBuscar.addEventListener('input', () => {
      clearTimeout(temp);
      temp = setTimeout(cargarGarantiasServicios, 350);
    });
    elGarantiasServiciosBuscar.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') { e.preventDefault(); clearTimeout(temp); cargarGarantiasServicios(); }
    });
  }

  if (elGarantiasProductosChips) {
    elGarantiasProductosChips.querySelectorAll('.chip').forEach(chip => {
      chip.addEventListener('click', () => {
        filtroEstadoGarantiasProductos = chip.dataset.estado || '';
        elGarantiasProductosChips.querySelectorAll('.chip').forEach(c => c.classList.toggle('active', c === chip));
        cargarGarantiasProductos();
      });
    });
  }
  if (elGarantiasServiciosChips) {
    elGarantiasServiciosChips.querySelectorAll('.chip').forEach(chip => {
      chip.addEventListener('click', () => {
        filtroEstadoGarantiasServicios = chip.dataset.estado || '';
        elGarantiasServiciosChips.querySelectorAll('.chip').forEach(c => c.classList.toggle('active', c === chip));
        cargarGarantiasServicios();
      });
    });
  }

  if (elBtnRecargarGarantiasProductos) elBtnRecargarGarantiasProductos.addEventListener('click', cargarGarantiasProductos);
  if (elBtnRecargarGarantiasServicios) elBtnRecargarGarantiasServicios.addEventListener('click', cargarGarantiasServicios);
});

function mostrarPanelGarantias(nombre) {
  document.querySelectorAll('#subtabsGarantias .subtab').forEach(b => {
    b.classList.toggle('activo', b.dataset.subtab === nombre);
  });
  document.querySelectorAll('[data-panel-garantias]').forEach(p => {
    p.classList.toggle('activo', p.dataset.panelGarantias === nombre);
  });

  if (nombre === 'productos') cargarGarantiasProductos();
  if (nombre === 'servicios') cargarGarantiasServicios();
}

function badgeEstadoGarantia(estado) {
  if (estado === 'VIGENTE') return '<span class="badge badge-green">✅ Vigente</span>';
  if (estado === 'VENCIDA') return '<span class="badge badge-red">⌛ Vencida</span>';
  return '<span class="badge badge-soft">—</span>';
}

/* ---------- Productos ---------- */

async function cargarGarantiasProductos() {
  if (!tokenActual()) return;
  const q = elGarantiasProductosBuscar?.value.trim() || '';
  if (elGarantiasProductosTableBody) {
    elGarantiasProductosTableBody.innerHTML = '<tr class="empty-row"><td colspan="8">Buscando…</td></tr>';
  }

  try {
    garantiasProductosList = await API.garantias.productos(q, filtroEstadoGarantiasProductos);
    renderGarantiasProductosTabla(garantiasProductosList);
  } catch (err) {
    console.error('Error al cargar garantías de productos:', err.message || err);
    showToast(err.message || 'No se pudieron cargar las garantías', 'err');
    if (elGarantiasProductosTableBody) {
      elGarantiasProductosTableBody.innerHTML = `<tr class="empty-row"><td colspan="8">${escHtml(err.message || 'Error al cargar')}</td></tr>`;
    }
  }
}

function renderGarantiasProductosTabla(lista) {
  if (!elGarantiasProductosTableBody) return;

  if (!lista || lista.length === 0) {
    elGarantiasProductosTableBody.innerHTML = '<tr class="empty-row"><td colspan="8">Sin resultados para este filtro.</td></tr>';
    return;
  }

  elGarantiasProductosTableBody.innerHTML = lista.map(it => {
    const skuSn = [it.sku, it.serial_number].filter(Boolean).map(escHtml).join(' · ') || '—';
    const condicion = it.condicion === 'reacondicionado' ? '♻️ Reacondicionado' : (it.condicion === 'nuevo' ? '🆕 Nuevo' : '—');
    return `<tr>
      <td>${escHtml(it.numero_orden || `#${it.venta_id}`)}</td>
      <td>${it.fecha_venta ? tsAChile(it.fecha_venta) : '—'}</td>
      <td>${escHtml(it.nombre)}${it.cantidad > 1 ? ` × ${it.cantidad}` : ''}</td>
      <td>${skuSn}</td>
      <td>${condicion}</td>
      <td>${it.meses_garantia} mes(es)</td>
      <td>${it.vence_el || '—'}</td>
      <td>${badgeEstadoGarantia(it.estado_garantia)}</td>
    </tr>`;
  }).join('');
}

/* ---------- Servicios (Órdenes de Trabajo entregadas) ---------- */

async function cargarGarantiasServicios() {
  if (!tokenActual()) return;
  const q = elGarantiasServiciosBuscar?.value.trim() || '';
  if (elGarantiasServiciosTableBody) {
    elGarantiasServiciosTableBody.innerHTML = '<tr class="empty-row"><td colspan="7">Buscando…</td></tr>';
  }

  try {
    garantiasServiciosList = await API.garantias.servicios(q, filtroEstadoGarantiasServicios);
    renderGarantiasServiciosTabla(garantiasServiciosList);
  } catch (err) {
    console.error('Error al cargar garantías de servicios:', err.message || err);
    showToast(err.message || 'No se pudieron cargar las garantías', 'err');
    if (elGarantiasServiciosTableBody) {
      elGarantiasServiciosTableBody.innerHTML = `<tr class="empty-row"><td colspan="7">${escHtml(err.message || 'Error al cargar')}</td></tr>`;
    }
  }
}

function renderGarantiasServiciosTabla(lista) {
  if (!elGarantiasServiciosTableBody) return;

  if (!lista || lista.length === 0) {
    elGarantiasServiciosTableBody.innerHTML = '<tr class="empty-row"><td colspan="7">Sin resultados para este filtro.</td></tr>';
    return;
  }

  elGarantiasServiciosTableBody.innerHTML = lista.map(o => {
    const equipo = [o.dispositivo_categoria, o.dispositivo_modelo].filter(Boolean).map(escHtml).join(' · ') || '—';
    return `<tr>
      <td>${escHtml(o.numero_ot)}</td>
      <td>${escHtml(o.cliente_nombre || '—')}</td>
      <td>${equipo}</td>
      <td>${o.fecha_entrega ? tsAChile(o.fecha_entrega) : '—'}</td>
      <td>${o.meses_garantia} mes(es)</td>
      <td>${o.vence_el || '—'}</td>
      <td>${badgeEstadoGarantia(o.estado_garantia)}</td>
    </tr>`;
  }).join('');
}
