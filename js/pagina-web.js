/* ============================================================
   PÁGINA WEB — módulo padre del POS que agrupa las dos vistas de
   e-commerce: Pedidos Web (js/pedidos-web.js, sin cambios de lógica) y
   Categorías (nuevo, catálogo propio del POS para agrupar productos en
   la tienda — ver sql/23-categorias-web-y-umbral-stock.sql).
   Mismo patrón de sub-pestañas que Finanzas/Servicio Técnico
   (mostrarPanelFinanzas en js/balance.js, mostrarPanelTaller en js/atajos.js).
   ============================================================ */

let categoriasWebList = [];

const elSubtabsPaginaWeb = document.getElementById('subtabsPaginaWeb');
const elListaCategoriasWeb = document.getElementById('listaCategoriasWeb');
const elNuevaCategoriaWebInput = document.getElementById('nuevaCategoriaWebInput');
const elBtnNuevaCategoriaWeb = document.getElementById('btnNuevaCategoriaWeb');
const elMasBuscadosDias = document.getElementById('masBuscadosDias');
const elMasBuscadosTerminosBody = document.getElementById('masBuscadosTerminosBody');
const elMasBuscadosProductosBody = document.getElementById('masBuscadosProductosBody');
const elBtnRecargarMetricasWeb = document.getElementById('btnRecargarMetricasWeb');

document.addEventListener('DOMContentLoaded', () => {
  if (elSubtabsPaginaWeb) {
    elSubtabsPaginaWeb.addEventListener('click', (e) => {
      const b = e.target.closest('.subtab');
      if (b) mostrarPanelPaginaWeb(b.dataset.subtab);
    });
  }
  if (elBtnNuevaCategoriaWeb) elBtnNuevaCategoriaWeb.addEventListener('click', () => agregarCategoriaWeb());
  if (elNuevaCategoriaWebInput) {
    elNuevaCategoriaWebInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') { e.preventDefault(); agregarCategoriaWeb(); }
    });
  }
  if (elMasBuscadosDias) elMasBuscadosDias.addEventListener('change', () => cargarMasBuscados());
  if (elBtnRecargarMetricasWeb) elBtnRecargarMetricasWeb.addEventListener('click', () => cargarMetricasWeb());
});

function mostrarPanelPaginaWeb(nombre) {
  document.querySelectorAll('#subtabsPaginaWeb .subtab').forEach(b => {
    b.classList.toggle('activo', b.dataset.subtab === nombre);
  });
  document.querySelectorAll('[data-panel-pagina-web]').forEach(p => {
    p.classList.toggle('activo', p.dataset.panelPaginaWeb === nombre);
  });

  if (nombre === 'pedidos' && typeof cargarPedidosWeb === 'function') cargarPedidosWeb();
  if (nombre === 'categorias') cargarCategoriasWeb();
  if (nombre === 'mas-buscados') cargarMasBuscados();
  if (nombre === 'metricas') { cargarMetricasWeb(); iniciarRefrescoVisitantesActivos(); }
  else { detenerRefrescoVisitantesActivos(); }
}

// Deja de refrescar "Visitando ahora" apenas se sale de la sección
// Página Web por completo (no solo cambiando de sub-pestaña) — evita un
// timer corriendo de fondo para siempre en una pantalla que ya no se ve.
document.addEventListener('pos:vista-activa', (e) => {
  if (e.detail?.vista !== 'view-pagina-web') detenerRefrescoVisitantesActivos();
});

/* ---------- Más buscados (términos de búsqueda y vistas de producto) ---------- */

async function cargarMasBuscados() {
  const dias = elMasBuscadosDias?.value || 30;
  if (elMasBuscadosTerminosBody) elMasBuscadosTerminosBody.innerHTML = '<tr class="empty-row"><td colspan="2">Cargando…</td></tr>';
  if (elMasBuscadosProductosBody) elMasBuscadosProductosBody.innerHTML = '<tr class="empty-row"><td colspan="2">Cargando…</td></tr>';

  try {
    const datos = await API.masBuscados.obtener(dias);
    renderMasBuscados(datos);
  } catch (err) {
    console.error('Error al cargar más buscados:', err.message || err);
    const mensaje = `<tr class="empty-row"><td colspan="2">${escHtml(err.message || 'No se pudo cargar')}</td></tr>`;
    if (elMasBuscadosTerminosBody) elMasBuscadosTerminosBody.innerHTML = mensaje;
    if (elMasBuscadosProductosBody) elMasBuscadosProductosBody.innerHTML = mensaje;
  }
}

function renderMasBuscados(datos) {
  const terminos = datos?.terminos_mas_buscados || [];
  const productos = datos?.productos_mas_vistos || [];

  if (elMasBuscadosTerminosBody) {
    elMasBuscadosTerminosBody.innerHTML = terminos.length
      ? terminos.map(t => `<tr><td>${escHtml(t.termino)}</td><td class="num">${t.veces}</td></tr>`).join('')
      : '<tr class="empty-row"><td colspan="2">Todavía no hay búsquedas registradas en este período.</td></tr>';
  }

  if (elMasBuscadosProductosBody) {
    elMasBuscadosProductosBody.innerHTML = productos.length
      ? productos.map(p => `
        <tr>
          <td>${escHtml(p.nombre)}${p.sku ? ` <small class="fila-meta">SKU ${escHtml(p.sku)}</small>` : ''}${!p.publicado_web ? ' <small class="fila-meta">(no publicado)</small>' : ''}</td>
          <td class="num">${p.veces}</td>
        </tr>`).join('')
      : '<tr class="empty-row"><td colspan="2">Todavía no hay vistas registradas en este período.</td></tr>';
  }
}

/* ---------- Categorías del catálogo web ---------- */

async function cargarCategoriasWeb() {
  try {
    categoriasWebList = await API.productosCategorias.listar();
    renderCategoriasWeb();
  } catch (err) {
    console.error('Error al cargar categorías web:', err.message || err);
    showToast(err.message || 'No se pudieron cargar las categorías', 'err');
  }
}

// Arma el árbol de 2 niveles (categoría → subcategorías) a partir de la
// lista plana que devuelve la API — el orden de hermanos ya viene resuelto
// del backend (orden, nombre), acá solo se agrupa por parent_id.
function construirArbolCategoriasWeb() {
  const raiz = categoriasWebList.filter(c => !c.parent_id);
  const hijosPorPadre = {};
  categoriasWebList.forEach(c => {
    if (c.parent_id) (hijosPorPadre[c.parent_id] = hijosPorPadre[c.parent_id] || []).push(c);
  });
  return raiz.map(c => ({ ...c, hijos: hijosPorPadre[c.id] || [] }));
}

function filaCategoriaWebHtml(c, opciones, hermanos) {
  const idx = hermanos.findIndex(h => h.id === c.id);
  const esSubcategoria = !!c.parent_id;
  return `
    <div class="admin-cat-row" data-id="${c.id}" data-parent-id="${c.parent_id || ''}" style="${esSubcategoria ? 'margin-left:28px;' : ''}">
      <div class="cell-actions" style="margin-right:8px;">
        <button class="btn btn-icon" data-mover="arriba" title="Subir" ${idx === 0 ? 'disabled style="opacity:.35;cursor:not-allowed;"' : ''}>▲</button>
        <button class="btn btn-icon" data-mover="abajo" title="Bajar" ${idx === hermanos.length - 1 ? 'disabled style="opacity:.35;cursor:not-allowed;"' : ''}>▼</button>
      </div>
      <span class="admin-cat-nombre" data-nombre>${esSubcategoria ? '↳ ' : ''}${escHtml(c.nombre)}</span>
      <div class="cell-actions">
        ${opciones.conSubcategoria ? `
        <button class="btn btn-icon" data-subcategoria title="Agregar subcategoría">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 5v14M5 12h14"/></svg>
        </button>` : ''}
        <button class="btn btn-icon btn-icon-edit" data-renombrar title="Renombrar">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>
        </button>
        <button class="btn btn-icon btn-icon-del" data-eliminar title="Eliminar">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M8 6V4h8v2"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/></svg>
        </button>
      </div>
    </div>
  `;
}

function renderCategoriasWeb() {
  if (!elListaCategoriasWeb) return;

  if (!categoriasWebList || categoriasWebList.length === 0) {
    elListaCategoriasWeb.innerHTML = '<p class="admin-cat-vacio">Aún no hay categorías registradas.</p>';
    return;
  }

  const arbol = construirArbolCategoriasWeb();
  const raiz = arbol; // hermanos de nivel superior
  elListaCategoriasWeb.innerHTML = arbol.map(c => {
    const propia = filaCategoriaWebHtml(c, { conSubcategoria: true }, raiz);
    const hijos = c.hijos.map(h => filaCategoriaWebHtml(h, { conSubcategoria: false }, c.hijos)).join('');
    return propia + hijos;
  }).join('');

  elListaCategoriasWeb.querySelectorAll('[data-mover]').forEach(btn => {
    btn.addEventListener('click', () => moverCategoriaWeb(btn.closest('.admin-cat-row').dataset.id, btn.dataset.mover));
  });
  elListaCategoriasWeb.querySelectorAll('[data-subcategoria]').forEach(btn => {
    btn.addEventListener('click', () => iniciarNuevaSubcategoriaWeb(btn.closest('.admin-cat-row')));
  });
  elListaCategoriasWeb.querySelectorAll('[data-renombrar]').forEach(btn => {
    btn.addEventListener('click', () => iniciarRenombreCategoriaWeb(btn.closest('.admin-cat-row')));
  });
  elListaCategoriasWeb.querySelectorAll('[data-eliminar]').forEach(btn => {
    btn.addEventListener('click', () => eliminarCategoriaWeb(btn.closest('.admin-cat-row').dataset.id));
  });
}

// Inserta una fila temporal con un input para escribir el nombre de la
// nueva subcategoría, justo debajo de la categoría padre.
function iniciarNuevaSubcategoriaWeb(filaPadre) {
  if (!filaPadre) return;
  const parentId = filaPadre.dataset.id;

  const filaTemp = document.createElement('div');
  filaTemp.className = 'admin-cat-row';
  filaTemp.style.marginLeft = '28px';
  filaTemp.innerHTML = `
    <span class="admin-cat-nombre" style="flex:1;">
      ↳ <input type="text" class="admin-cat-input-edit" placeholder="Nombre de la subcategoría">
    </span>
    <div class="cell-actions">
      <button class="btn btn-icon btn-icon-view" data-guardar title="Guardar">✔</button>
      <button class="btn btn-icon btn-icon-del" data-cancelar title="Cancelar">✖</button>
    </div>
  `;
  filaPadre.insertAdjacentElement('afterend', filaTemp);

  const input = filaTemp.querySelector('input');
  input.focus();

  const confirmar = () => agregarCategoriaWeb(input.value.trim(), parentId);
  const cancelar = () => renderCategoriasWeb();

  filaTemp.querySelector('[data-guardar]').addEventListener('click', confirmar);
  filaTemp.querySelector('[data-cancelar]').addEventListener('click', cancelar);
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { e.preventDefault(); confirmar(); }
    if (e.key === 'Escape') { e.preventDefault(); cancelar(); }
  });
}

// Sin argumentos: crea una categoría de nivel superior desde el input
// principal. Con (nombre, parentId): crea una subcategoría (ver
// iniciarNuevaSubcategoriaWeb) — mismo endpoint, distinto origen del valor.
async function agregarCategoriaWeb(nombre, parentId) {
  const esSubcategoria = nombre !== undefined;
  const nombreFinal = esSubcategoria ? nombre : (elNuevaCategoriaWebInput?.value || '').trim();
  if (!nombreFinal) {
    showToast('Escribe un nombre', 'err');
    if (!esSubcategoria) elNuevaCategoriaWebInput?.focus();
    return;
  }

  try {
    await API.productosCategorias.crear(nombreFinal, parentId);
    if (!esSubcategoria && elNuevaCategoriaWebInput) elNuevaCategoriaWebInput.value = '';
    showToast(esSubcategoria ? 'Subcategoría agregada' : 'Categoría agregada', 'ok');
    await cargarCategoriasWeb();
  } catch (err) {
    console.error('Error al agregar categoría web:', err.message || err);
    showToast(err.message || 'No se pudo agregar', 'err');
  }
}

function iniciarRenombreCategoriaWeb(fila) {
  if (!fila) return;
  const spanNombre = fila.querySelector('[data-nombre]');
  const nombreActual = spanNombre.textContent;

  spanNombre.innerHTML = `<input type="text" value="${nombreActual.replace(/"/g, '&quot;')}" class="admin-cat-input-edit">`;
  const input = spanNombre.querySelector('input');
  input.focus();
  input.select();

  const acciones = fila.querySelector('.cell-actions:last-child');
  const confirmar = () => guardarRenombreCategoriaWeb(fila.dataset.id, input.value.trim());
  const cancelar = () => renderCategoriasWeb();

  acciones.innerHTML = `
    <button class="btn btn-icon btn-icon-view" data-guardar title="Guardar">✔</button>
    <button class="btn btn-icon btn-icon-del" data-cancelar title="Cancelar">✖</button>
  `;
  acciones.querySelector('[data-guardar]').addEventListener('click', confirmar);
  acciones.querySelector('[data-cancelar]').addEventListener('click', cancelar);
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { e.preventDefault(); confirmar(); }
    if (e.key === 'Escape') { e.preventDefault(); cancelar(); }
  });
}

async function guardarRenombreCategoriaWeb(id, nuevoNombre) {
  if (!nuevoNombre) { showToast('Escribe un nombre', 'err'); return; }
  try {
    await API.productosCategorias.renombrar(id, nuevoNombre);
    showToast('Categoría actualizada', 'ok');
    await cargarCategoriasWeb();
  } catch (err) {
    console.error('Error al renombrar categoría web:', err.message || err);
    showToast(err.message || 'No se pudo renombrar', 'err');
    renderCategoriasWeb();
  }
}

async function moverCategoriaWeb(id, direccion) {
  try {
    await API.productosCategorias.mover(id, direccion);
    await cargarCategoriasWeb();
  } catch (err) {
    console.error('Error al mover categoría web:', err.message || err);
    showToast(err.message || 'No se pudo mover', 'err');
  }
}

async function eliminarCategoriaWeb(id) {
  const tieneHijos = categoriasWebList.some(c => String(c.parent_id) === String(id));
  const aviso = tieneHijos
    ? '¿Eliminar esta categoría? Sus subcategorías se eliminan con ella, y los productos que las usaban quedan sin categoría.'
    : '¿Eliminar esta categoría? Los productos que la usaban quedan sin categoría.';
  if (!confirm(aviso)) return;
  try {
    await API.productosCategorias.eliminar(id);
    showToast('Categoría eliminada', 'ok');
    await cargarCategoriasWeb();
  } catch (err) {
    console.error('Error al eliminar categoría web:', err.message || err);
    showToast(err.message || 'No se pudo eliminar', 'err');
  }
}

/* ---------- Métricas de la tienda online ---------- */

async function cargarMetricasWeb() {
  try {
    const datos = await API.metricasWeb.obtener();
    renderMetricasWeb(datos);
  } catch (err) {
    console.error('Error al cargar métricas web:', err.message || err);
    showToast(err.message || 'No se pudieron cargar las métricas', 'err');
  }
}

function renderMetricasWeb(datos) {
  const elVisitasTotales = document.getElementById('kpiVisitasTotales');
  const elVisitas30Dias = document.getElementById('kpiVisitas30Dias');
  const elUsuarios = document.getElementById('kpiUsuariosRegistrados');
  const elCompartidos = document.getElementById('kpiCarritosCompartidos');
  const elAbandonados = document.getElementById('kpiCarritosAbandonados');
  const elConvertidos = document.getElementById('kpiCarritosConvertidos');
  const elActivos = document.getElementById('kpiVisitantesActivos');

  const n = (v) => (v || 0).toLocaleString('es-CL');

  if (elVisitasTotales) elVisitasTotales.textContent = n(datos?.total_visitas);
  if (elVisitas30Dias) elVisitas30Dias.textContent = `Últimos 30 días: ${n(datos?.visitas_ultimos_30_dias)}`;
  if (elUsuarios) elUsuarios.textContent = n(datos?.total_usuarios_registrados);
  if (elCompartidos) elCompartidos.textContent = n(datos?.total_carritos_compartidos);
  if (elAbandonados) elAbandonados.textContent = n(datos?.total_carritos_abandonados);
  if (elConvertidos) elConvertidos.textContent = `Terminaron en compra: ${n(datos?.total_carritos_convertidos)}`;
  if (elActivos) elActivos.textContent = n(datos?.visitantes_activos_ahora);
}

/* ---------- "Visitando ahora": se refresca solo cada 20s ----------
   Trae las métricas completas de nuevo (mismo endpoint liviano, un solo
   COUNT por tabla) en vez de crear un endpoint aparte solo para un
   número — la pestaña Métricas ya está pensada para pedirse seguido. */
let intervaloVisitantesActivos = null;

function iniciarRefrescoVisitantesActivos() {
  detenerRefrescoVisitantesActivos();
  intervaloVisitantesActivos = setInterval(cargarMetricasWeb, 20000);
}

function detenerRefrescoVisitantesActivos() {
  if (intervaloVisitantesActivos) clearInterval(intervaloVisitantesActivos);
  intervaloVisitantesActivos = null;
}

/* ---------- Detalle desplegable (Cuentas / Compartidos / Abandonados) ----------
   Un solo <tbody> reutilizado (ver #panelDetalleMetricas en index.html):
   cada tipo arma sus propias columnas y acciones por fila. */

let detalleMetricasAbierto = null;   // 'cuentas' | 'compartidos' | 'abandonados' | null

document.addEventListener('DOMContentLoaded', () => {
  document.querySelectorAll('.kpi-clickable[data-drill]').forEach(card => {
    card.addEventListener('click', () => abrirDetalleMetricas(card.dataset.drill));
  });
  document.getElementById('btnCerrarDetalleMetricas')?.addEventListener('click', cerrarDetalleMetricas);
});

function cerrarDetalleMetricas() {
  detalleMetricasAbierto = null;
  const panel = document.getElementById('panelDetalleMetricas');
  if (panel) panel.style.display = 'none';
}

async function abrirDetalleMetricas(tipo) {
  // Un segundo click sobre la misma tarjeta ya abierta la cierra, como un acordeón.
  if (detalleMetricasAbierto === tipo) { cerrarDetalleMetricas(); return; }
  detalleMetricasAbierto = tipo;

  const panel = document.getElementById('panelDetalleMetricas');
  const titulo = document.getElementById('tituloDetalleMetricas');
  const thead = document.getElementById('theadDetalleMetricas');
  const tbody = document.getElementById('tbodyDetalleMetricas');
  if (!panel || !titulo || !thead || !tbody) return;

  panel.style.display = '';
  titulo.textContent = 'Cargando…';
  thead.innerHTML = '';
  tbody.innerHTML = '<tr class="empty-row"><td>Cargando…</td></tr>';

  try {
    if (tipo === 'cuentas') {
      const datos = await API.metricasWeb.cuentas();
      renderDetalleCuentas(datos, titulo, thead, tbody);
    } else if (tipo === 'compartidos') {
      const datos = await API.metricasWeb.carritosCompartidos();
      renderDetalleCompartidos(datos, titulo, thead, tbody);
    } else if (tipo === 'abandonados') {
      const datos = await API.metricasWeb.carritosAbandonados();
      renderDetalleAbandonados(datos, titulo, thead, tbody);
    }
    panel.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  } catch (err) {
    console.error('Error al cargar el detalle de métricas:', err.message || err);
    tbody.innerHTML = `<tr class="empty-row"><td>${escHtml(err.message || 'No se pudo cargar el detalle')}</td></tr>`;
  }
}

/* Resumen corto de los ítems de un carrito ("2× Mouse Gamer, 1× Teclado…")
   para no imprimir un JSON crudo en la tabla. */
function resumenItemsCarrito(items) {
  if (!items || items.length === 0) return '(sin productos disponibles)';
  return items.map(it => `${it.cantidad}× ${escHtml(it.nombre)}`).join(', ');
}

function renderDetalleCuentas(datos, titulo, thead, tbody) {
  titulo.textContent = `👥 Cuentas de cliente (${datos.length})`;
  thead.innerHTML = '<tr><th>Nombre</th><th>Teléfono</th><th>Creada</th><th>Carrito actual</th><th style="text-align:right;">WhatsApp</th></tr>';

  if (datos.length === 0) {
    tbody.innerHTML = '<tr class="empty-row"><td colspan="5">Todavía no hay cuentas registradas.</td></tr>';
    return;
  }

  tbody.innerHTML = datos.map(c => `
    <tr>
      <td>${escHtml(c.nombre)}</td>
      <td>${c.telefono ? escHtml(c.telefono) : '<span class="fila-meta">Sin teléfono</span>'}</td>
      <td>${tsAChile(c.creado_en, false)}</td>
      <td>${resumenItemsCarrito(c.carrito_actual)}</td>
      <td style="text-align:right;">
        ${c.carrito_actual?.length
          ? `<button class="btn btn-outline btn-sm" data-wa-carrito='${JSON.stringify({ telefono: c.telefono || '', items: c.carrito_actual }).replace(/'/g, '&#39;')}'>📲 Compartir</button>`
          : ''}
      </td>
    </tr>`).join('');

  tbody.querySelectorAll('[data-wa-carrito]').forEach(btn => {
    btn.addEventListener('click', () => {
      const { telefono, items } = JSON.parse(btn.dataset.waCarrito);
      compartirCarritoPorWhatsapp(telefono, items, null);
    });
  });
}

function renderDetalleCompartidos(datos, titulo, thead, tbody) {
  titulo.textContent = `🔗 Carritos compartidos (${datos.length})`;
  thead.innerHTML = '<tr><th>Creado</th><th>Contenido</th><th style="text-align:right;">Acciones</th></tr>';

  if (datos.length === 0) {
    tbody.innerHTML = '<tr class="empty-row"><td colspan="3">Todavía no se ha compartido ningún carrito.</td></tr>';
    return;
  }

  tbody.innerHTML = datos.map(c => `
    <tr>
      <td>${tsAChile(c.creado_en)}</td>
      <td>${resumenItemsCarrito(c.items)}</td>
      <td style="text-align:right;">
        <div class="cell-actions" style="justify-content:flex-end;">
          ${c.link ? `<button class="btn btn-outline btn-sm" data-copiar-link="${escHtml(c.link)}">🔗 Copiar link</button>` : ''}
          ${c.items?.length ? `<button class="btn btn-outline btn-sm" data-wa-carrito='${JSON.stringify({ telefono: '', items: c.items, link: c.link }).replace(/'/g, '&#39;')}'>📲 WhatsApp</button>` : ''}
        </div>
      </td>
    </tr>`).join('');

  tbody.querySelectorAll('[data-copiar-link]').forEach(btn => {
    btn.addEventListener('click', async () => {
      try {
        await navigator.clipboard.writeText(btn.dataset.copiarLink);
        showToast('Link copiado', 'ok');
      } catch {
        showToast('No se pudo copiar — cópialo a mano: ' + btn.dataset.copiarLink, 'err');
      }
    });
  });
  tbody.querySelectorAll('[data-wa-carrito]').forEach(btn => {
    btn.addEventListener('click', () => {
      const { telefono, items, link } = JSON.parse(btn.dataset.waCarrito);
      compartirCarritoPorWhatsapp(telefono, items, link);
    });
  });
}

function renderDetalleAbandonados(datos, titulo, thead, tbody) {
  titulo.textContent = `🛒 Carritos abandonados (${datos.length})`;
  thead.innerHTML = '<tr><th>Correo</th><th>Dejado</th><th>Contenido</th><th>Estado</th><th style="text-align:right;">Acciones</th></tr>';

  if (datos.length === 0) {
    tbody.innerHTML = '<tr class="empty-row"><td colspan="5">No hay carritos abandonados pendientes.</td></tr>';
    return;
  }

  tbody.innerHTML = datos.map(c => {
    const estado = c.expirado
      ? '<span class="badge badge-red">Expirado</span>'
      : c.recordatorio_enviado_en
        ? `<span class="badge badge-blue">Recordatorio enviado</span>`
        : '<span class="badge badge-gold">Sin recordatorio</span>';
    return `
    <tr data-fila-carrito="${c.id}">
      <td>${escHtml(c.correo || '(sin correo)')}</td>
      <td>${tsAChile(c.actualizado_en || c.creado_en)}</td>
      <td>${resumenItemsCarrito(c.items)}</td>
      <td>${estado}</td>
      <td style="text-align:right;">
        <div class="cell-actions" style="justify-content:flex-end;">
          ${c.correo ? `<button class="btn btn-outline btn-sm" data-reenviar-correo="${c.id}">✉️ Reenviar correo</button>` : ''}
          ${c.items?.length ? `<button class="btn btn-outline btn-sm" data-wa-carrito='${JSON.stringify({ telefono: '', items: c.items, link: null }).replace(/'/g, '&#39;')}'>📲 WhatsApp</button>` : ''}
        </div>
      </td>
    </tr>`;
  }).join('');

  tbody.querySelectorAll('[data-reenviar-correo]').forEach(btn => {
    btn.addEventListener('click', () => reenviarCorreoCarrito(btn.dataset.reenviarCorreo, btn));
  });
  tbody.querySelectorAll('[data-wa-carrito]').forEach(btn => {
    btn.addEventListener('click', () => {
      const { telefono, items, link } = JSON.parse(btn.dataset.waCarrito);
      compartirCarritoPorWhatsapp(telefono, items, link);
    });
  });
}

async function reenviarCorreoCarrito(id, btn) {
  const textoOriginal = btn.textContent;
  btn.disabled = true;
  btn.textContent = 'Enviando…';
  try {
    const resp = await API.metricasWeb.reenviarCorreoCarrito(id);
    if (resp?.enviado) {
      showToast('Correo reenviado', 'ok');
      const fila = btn.closest('tr');
      const celdaEstado = fila?.children?.[3];
      if (celdaEstado) celdaEstado.innerHTML = '<span class="badge badge-blue">Recordatorio enviado</span>';
    } else {
      showToast('La tienda no pudo enviarlo (revisa que el dominio de Resend esté verificado)', 'err');
    }
  } catch (err) {
    console.error('Error al reenviar el correo del carrito:', err.message || err);
    showToast(err.message || 'No se pudo reenviar el correo', 'err');
  } finally {
    btn.disabled = false;
    btn.textContent = textoOriginal;
  }
}

/* Abre WhatsApp con un mensaje armado a partir del carrito — con
   teléfono, va directo a esa conversación; sin teléfono (carrito de
   invitado sin cuenta), abre igual pero con el número vacío para que el
   dueño lo complete a mano (pedido explícito: mejor ofrecer el botón
   siempre que no tener nada). */
function compartirCarritoPorWhatsapp(telefono, items, link) {
  const detalle = (items || []).map(it => `• ${it.cantidad}× ${it.nombre}`).join('\n');
  const partes = [
    'Hola! Vi que dejaste esto en tu carrito de Sevelin:',
    detalle,
    link ? `Puedes retomarlo aquí: ${link}` : '¿Te ayudamos a completar la compra?',
  ];
  const mensaje = encodeURIComponent(partes.join('\n\n'));
  const numero = (telefono || '').replace(/\D/g, '');
  window.open(`https://wa.me/${numero}?text=${mensaje}`, '_blank');
}
