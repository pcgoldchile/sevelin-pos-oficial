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
