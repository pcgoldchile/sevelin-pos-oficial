// ==========================================
// CATEGORIAS-WEB.JS - Página Web → Categorías (rehecha en v126, dueño 06-10-2026)
// ------------------------------------------
// Antes era una lista de nombres con flechas: no se veía qué productos
// tenía cada categoría ni cuántos, y para mover un producto había que
// abrir su ficha. Ahora son dos columnas:
//
//   IZQUIERDA  el árbol (categoría → subcategorías) con cuántos productos
//              tiene cada una, buscador, y los grupos "Todos" y "Sin
//              categoría". Se ordena arrastrando (o con ▲▼ en el celular).
//   DERECHA    los productos de lo que esté elegido. Se mueven arrastrándolos
//              sobre una categoría, o marcando varios y "Mover a".
//
// La tienda arma su menú con el TEXTO del producto (categoria_web y
// subcategoria_web), no con la tabla de categorías: por eso acá un producto
// se ubica por ese texto, y el servidor lo reescribe al renombrar, eliminar
// o asignar (ver "CATEGORÍAS" en api/index.js).
//
// Todo lleva el prefijo catw para no chocar con otro archivo (regla 1).
// ==========================================

let catw = {
  lista: [],              // filas de producto_categorias
  seleccion: 'todas',     // 'todas' | 'sin' | id de categoría
  abiertas: new Set(),    // categorías con sus subcategorías desplegadas
  buscarCat: '',
  buscarProd: '',
  marcados: new Set(),    // ids de productos marcados
  arrastre: null,         // { tipo: 'cat', id } | { tipo: 'prod', ids }
  editando: null          // { modo: 'nueva' | 'sub' | 'renombrar', id }
};

document.addEventListener('DOMContentLoaded', () => {
  const arbol = document.getElementById('catwArbol');
  const detalle = document.getElementById('catwDetalle');
  if (!arbol || !detalle) return;

  document.getElementById('btnCatwCancelarEliminar')?.addEventListener('click', () => cerrarModal('modalCatwEliminar'));
  document.getElementById('btnCatwNueva')?.addEventListener('click', () => { catw.editando = { modo: 'nueva' }; catwPintarArbol(); });
  document.getElementById('catwBuscarCat')?.addEventListener('input', (e) => { catw.buscarCat = e.target.value.trim().toLowerCase(); catwPintarArbol(); });

  arbol.addEventListener('click', catwClicArbol);
  arbol.addEventListener('dblclick', (e) => {
    const fila = e.target.closest('[data-cat-id]');
    if (fila && !e.target.closest('button, input')) { catw.editando = { modo: 'renombrar', id: fila.dataset.catId }; catwPintarArbol(); }
  });
  arbol.addEventListener('keydown', (e) => {
    if (!e.target.matches('.catw-input')) return;
    if (e.key === 'Enter') { e.preventDefault(); catwGuardarEdicion(e.target.value); }
    if (e.key === 'Escape') { e.preventDefault(); catw.editando = null; catwPintarArbol(); }
  });

  detalle.addEventListener('click', catwClicDetalle);
  detalle.addEventListener('change', (e) => {
    const chk = e.target.closest('[data-prod-marcar]');
    if (chk) {
      if (chk.checked) catw.marcados.add(String(chk.dataset.prodMarcar)); else catw.marcados.delete(String(chk.dataset.prodMarcar));
      chk.closest('.catw-prod')?.classList.toggle('marcado', chk.checked);
      catwPintarBarra();
    }
  });
  detalle.addEventListener('input', (e) => {
    if (e.target.id !== 'catwBuscarProd') return;
    catw.buscarProd = e.target.value.trim().toLowerCase();
    catwPintarProductos();
  });

  // ---------- Arrastrar ----------
  document.getElementById('view-pagina-web')?.addEventListener('dragstart', (e) => {
    const prod = e.target.closest?.('[data-prod-id]');
    const cat = e.target.closest?.('[data-cat-id]');
    if (prod) {
      const id = String(prod.dataset.prodId);
      catw.arrastre = { tipo: 'prod', ids: catw.marcados.has(id) ? [...catw.marcados] : [id] };
    } else if (cat && !catw.editando) {
      catw.arrastre = { tipo: 'cat', id: String(cat.dataset.catId) };
    } else return;
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', catw.arrastre.tipo);   // Firefox no arrastra sin datos
    (prod || cat).classList.add('arrastrando');
  });
  document.getElementById('view-pagina-web')?.addEventListener('dragend', () => {
    catw.arrastre = null;
    document.querySelectorAll('#view-pagina-web .arrastrando, #view-pagina-web .soltar, #view-pagina-web .soltar-antes')
      .forEach(el => el.classList.remove('arrastrando', 'soltar', 'soltar-antes'));
  });
  arbol.addEventListener('dragover', (e) => {
    const destino = catwDestinoValido(e.target);
    arbol.querySelectorAll('.soltar, .soltar-antes').forEach(el => { if (el !== destino?.el) el.classList.remove('soltar', 'soltar-antes'); });
    if (!destino) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    destino.el.classList.add(destino.clase);
  });
  arbol.addEventListener('drop', (e) => {
    const destino = catwDestinoValido(e.target);
    if (!destino || !catw.arrastre) return;
    e.preventDefault();
    const arrastre = catw.arrastre;
    catw.arrastre = null;
    if (arrastre.tipo === 'prod') catwMoverProductos(arrastre.ids, destino.sel === 'sin' ? null : destino.sel);
    else catwReordenar(arrastre.id, destino.sel);
  });
});

/* ---------- Datos ---------- */

async function cargarCategoriasWeb() {
  const arbol = document.getElementById('catwArbol');
  if (!arbol) return;
  try {
    if (!catw.lista.length) arbol.innerHTML = '<p class="modal-hint">Cargando categorías…</p>';
    const [lista] = await Promise.all([
      API.productosCategorias.listar(),
      (typeof productsList !== 'undefined' && productsList.length) ? null : (typeof cargarProductos === 'function' ? cargarProductos() : null)
    ]);
    catw.lista = lista || [];
    if (!['todas', 'sin'].includes(catw.seleccion) && !catw.lista.some(c => String(c.id) === String(catw.seleccion))) catw.seleccion = 'todas';
    pintarCategoriasWeb();
  } catch (err) {
    console.error('Error al cargar categorías web:', err.message || err);
    showToast(err.message || 'No se pudieron cargar las categorías', 'err');
  }
}

const catwProductos = () => (typeof productsList !== 'undefined' ? productsList : []);
const catwPorId = (id) => catw.lista.find(c => String(c.id) === String(id)) || null;
const catwHijas = (id) => catw.lista.filter(c => String(c.parent_id || '') === String(id));
const catwRaices = () => catw.lista.filter(c => !c.parent_id);

/* En qué categoría está un producto PARA LA TIENDA: manda el texto
   (subcategoría dentro de su categoría, o la categoría sola). Si el texto no
   calza con ninguna, se usa el id; si tampoco, queda "sin categoría". */
function catwCategoriaDe(p) {
  const top = p.categoria_web ? catwRaices().find(c => c.nombre === p.categoria_web) : null;
  if (top && p.subcategoria_web) {
    const sub = catwHijas(top.id).find(c => c.nombre === p.subcategoria_web);
    if (sub) return String(sub.id);
  }
  if (top) return String(top.id);
  return p.categoria_id && catwPorId(p.categoria_id) ? String(p.categoria_id) : null;
}

/* { id: productos directos } y, para una categoría, los suyos más los de sus subcategorías. */
function catwConteos() {
  const directos = new Map();
  let sin = 0;
  for (const p of catwProductos()) {
    const id = catwCategoriaDe(p);
    if (!id) { sin++; continue; }
    directos.set(id, (directos.get(id) || 0) + 1);
  }
  const total = (id) => (directos.get(String(id)) || 0) + catwHijas(id).reduce((a, h) => a + (directos.get(String(h.id)) || 0), 0);
  return { directos, total, sin };
}

/* Productos de lo que está elegido (una categoría incluye sus subcategorías). */
function catwProductosVisibles() {
  const sel = catw.seleccion;
  const ids = sel === 'todas' || sel === 'sin' ? null : new Set([String(sel), ...catwHijas(sel).map(h => String(h.id))]);
  const q = catw.buscarProd;
  return catwProductos().filter(p => {
    const cat = catwCategoriaDe(p);
    if (sel === 'sin' && cat) return false;
    if (ids && !ids.has(String(cat))) return false;
    return !q || (p.nombre || '').toLowerCase().includes(q) || (p.sku || '').toLowerCase().includes(q);
  }).sort((a, b) => (a.nombre || '').localeCompare(b.nombre || '', 'es'));
}

/* ---------- Pintar ---------- */

function pintarCategoriasWeb() {
  const resumen = document.getElementById('catwResumen');
  const { sin } = catwConteos();
  if (resumen) {
    const subs = catw.lista.filter(c => c.parent_id).length;
    resumen.innerHTML = `
      <span class="catw-chip"><strong>${catwRaices().length}</strong> categorías</span>
      <span class="catw-chip"><strong>${subs}</strong> subcategorías</span>
      <span class="catw-chip"><strong>${catwProductos().length}</strong> productos</span>
      ${sin ? `<button type="button" class="catw-chip aviso" data-catw-ir-sin="1">⚠️ <strong>${sin}</strong> sin categoría: no salen en ningún filtro de la tienda</button>` : '<span class="catw-chip ok">✅ Todos los productos tienen categoría</span>'}`;
    resumen.querySelector('[data-catw-ir-sin]')?.addEventListener('click', () => catwElegir('sin'));
  }
  catwPintarArbol();
  catwPintarDetalle();
}

function catwFilaHtml(c, cuenta, hermanos) {
  const id = String(c.id);
  const esSub = !!c.parent_id;
  const hijas = esSub ? [] : catwHijas(id);
  const abierta = catw.abiertas.has(id) || !!catw.buscarCat;
  const idx = hermanos.findIndex(h => String(h.id) === id);
  const renombrando = catw.editando?.modo === 'renombrar' && String(catw.editando.id) === id;
  return `
    <div class="catw-item${esSub ? ' sub' : ''}${String(catw.seleccion) === id ? ' elegida' : ''}" data-cat-sel="${escHtml(id)}" data-cat-id="${escHtml(id)}"
         data-cat-padre="${escHtml(String(c.parent_id || ''))}" draggable="${renombrando ? 'false' : 'true'}">
      <span class="catw-agarre" title="Arrastra para cambiar el orden" aria-hidden="true">⠿</span>
      ${esSub ? '<span class="catw-rama" aria-hidden="true">↳</span>'
        : `<button type="button" class="catw-flecha${hijas.length ? '' : ' vacia'}" data-cat-abrir="${escHtml(id)}" title="${abierta ? 'Ocultar' : 'Ver'} subcategorías" ${hijas.length ? '' : 'tabindex="-1"'}>${hijas.length ? (abierta ? '▾' : '▸') : ''}</button>`}
      ${renombrando
        ? `<input type="text" class="catw-input" value="${escHtml(c.nombre)}" maxlength="60" aria-label="Nombre nuevo">
           <button type="button" class="btn btn-icon btn-icon-view" data-cat-guardar="1" title="Guardar">✔</button>
           <button type="button" class="btn btn-icon btn-icon-del" data-cat-cancelar="1" title="Cancelar">✖</button>`
        : `<span class="catw-nombre" title="Doble clic para cambiar el nombre">${escHtml(c.nombre)}</span>
           ${!esSub && hijas.length ? `<span class="catw-subs">${hijas.length} sub</span>` : ''}
           <span class="catw-cuenta${cuenta ? '' : ' cero'}" title="Productos en esta ${esSub ? 'subcategoría' : 'categoría'}">${cuenta}</span>
           <span class="catw-acciones">
             <button type="button" class="catw-mini" data-cat-mover="arriba" title="Subir" ${idx <= 0 ? 'disabled' : ''}>▲</button>
             <button type="button" class="catw-mini" data-cat-mover="abajo" title="Bajar" ${idx === hermanos.length - 1 ? 'disabled' : ''}>▼</button>
             ${esSub ? '' : `<button type="button" class="catw-mini" data-cat-sub="${escHtml(id)}" title="Agregar una subcategoría">＋</button>`}
             <button type="button" class="catw-mini" data-cat-renombrar="${escHtml(id)}" title="Cambiar el nombre">✏️</button>
             <button type="button" class="catw-mini peligro" data-cat-eliminar="${escHtml(id)}" title="Eliminar">🗑</button>
           </span>`}
    </div>`;
}

const catwFilaNuevaHtml = (placeholder, esSub) => `
  <div class="catw-item nueva${esSub ? ' sub' : ''}">
    ${esSub ? '<span class="catw-rama" aria-hidden="true">↳</span>' : ''}
    <input type="text" class="catw-input" placeholder="${escHtml(placeholder)}" maxlength="60">
    <button type="button" class="btn btn-icon btn-icon-view" data-cat-guardar="1" title="Guardar">✔</button>
    <button type="button" class="btn btn-icon btn-icon-del" data-cat-cancelar="1" title="Cancelar">✖</button>
  </div>`;

function catwPintarArbol() {
  const arbol = document.getElementById('catwArbol');
  if (!arbol) return;
  const { directos, total, sin } = catwConteos();
  const q = catw.buscarCat;
  const calza = (c) => !q || c.nombre.toLowerCase().includes(q);
  const raices = catwRaices().filter(c => calza(c) || catwHijas(c.id).some(calza));

  const especiales = q ? '' : `
    <div class="catw-item especial${catw.seleccion === 'todas' ? ' elegida' : ''}" data-cat-sel="todas">
      <span class="catw-nombre">📦 Todos los productos</span><span class="catw-cuenta">${catwProductos().length}</span>
    </div>
    <div class="catw-item especial${sin ? ' aviso' : ''}${catw.seleccion === 'sin' ? ' elegida' : ''}" data-cat-sel="sin" title="Suelta acá un producto para dejarlo sin categoría">
      <span class="catw-nombre">${sin ? '⚠️' : '✅'} Sin categoría</span><span class="catw-cuenta${sin ? '' : ' cero'}">${sin}</span>
    </div>`;

  arbol.innerHTML = especiales
    + (catw.editando?.modo === 'nueva' ? catwFilaNuevaHtml('Nombre de la categoría nueva', false) : '')
    + (raices.length ? raices.map(c => {
        const id = String(c.id);
        const hijas = catwHijas(id).filter(h => !q || calza(h) || calza(c));
        const abierta = catw.abiertas.has(id) || !!q;
        const nuevaSub = catw.editando?.modo === 'sub' && String(catw.editando.id) === id;
        return `<div class="catw-grupo">
          ${catwFilaHtml(c, total(id), catwRaices())}
          ${(abierta && hijas.length) || nuevaSub ? `<div class="catw-hijas">
            ${abierta ? hijas.map(h => catwFilaHtml(h, directos.get(String(h.id)) || 0, catwHijas(id))).join('') : ''}
            ${nuevaSub ? catwFilaNuevaHtml(`Subcategoría de ${c.nombre}`, true) : ''}
          </div>` : ''}
        </div>`;
      }).join('')
      : `<p class="modal-hint">${q ? 'Ninguna categoría con ese nombre.' : 'Todavía no hay categorías: crea la primera con "Nueva categoría".'}</p>`);

  const input = arbol.querySelector('.catw-input');
  if (input) { input.focus(); input.select(); }
}

function catwPintarDetalle() {
  const detalle = document.getElementById('catwDetalle');
  if (!detalle) return;
  const sel = catw.seleccion;
  const cat = catwPorId(sel);
  const padre = cat?.parent_id ? catwPorId(cat.parent_id) : null;
  const titulo = sel === 'todas' ? 'Todos los productos' : sel === 'sin' ? 'Sin categoría' : cat ? cat.nombre : '';
  const ruta = cat ? (padre ? `${padre.nombre} › ${cat.nombre}` : cat.nombre) : '';
  const urlTienda = cat
    ? `https://sevelin.cl/productos?categoria=${encodeURIComponent(padre ? padre.nombre : cat.nombre)}${padre ? `&subcategoria=${encodeURIComponent(cat.nombre)}` : ''}`
    : '';

  detalle.innerHTML = `
    <div class="catw-detalle-head">
      <div>
        <h3>${escHtml(titulo)}</h3>
        <p class="subtitle" id="catwDetalleSub"></p>
      </div>
      <div class="catw-detalle-acciones">
        ${urlTienda ? `<a class="btn btn-outline btn-sm" href="${escHtml(urlTienda)}" target="_blank" rel="noopener noreferrer" title="Abrir ${escHtml(ruta)} en la tienda">🌐 Ver en sevelin.cl</a>` : ''}
        <input type="search" id="catwBuscarProd" placeholder="Buscar producto…" value="${escHtml(catw.buscarProd)}" aria-label="Buscar producto en esta categoría">
      </div>
    </div>
    <p class="modal-hint catw-ayuda">${sel === 'sin'
      ? 'Estos productos no aparecen en ningún filtro de la tienda. Arrástralos sobre una categoría de la izquierda, o márcalos y usa “Mover a”.'
      : 'Para cambiar un producto de categoría, arrástralo sobre una categoría de la izquierda. Para varios, márcalos y usa “Mover a”.'}</p>
    <div id="catwBarra"></div>
    <div id="catwProductos" class="catw-productos"></div>`;
  catwPintarProductos();
}

function catwPintarProductos() {
  const cont = document.getElementById('catwProductos');
  if (!cont) return;
  const lista = catwProductosVisibles();
  const visibles = new Set(lista.map(p => String(p.id)));
  catw.marcados.forEach(id => { if (!visibles.has(id)) catw.marcados.delete(id); });

  const sub = document.getElementById('catwDetalleSub');
  if (sub) {
    const publicados = lista.filter(p => p.publicado_web).length;
    sub.textContent = `${lista.length} producto${lista.length === 1 ? '' : 's'} · ${publicados} publicado${publicados === 1 ? '' : 's'} en la tienda`;
  }

  const selCat = catwPorId(catw.seleccion);
  cont.innerHTML = lista.length ? lista.map(p => {
    const id = String(p.id);
    const cat = catwPorId(catwCategoriaDe(p));
    const padre = cat?.parent_id ? catwPorId(cat.parent_id) : null;
    // Dónde está: en "Todos" la ruta completa; dentro de una categoría, solo su subcategoría
    const donde = !cat ? (p.categoria_web ? `En la tienda dice “${p.categoria_web}”, que ya no existe` : 'Sin categoría')
      : selCat && !selCat.parent_id ? (padre ? `↳ ${cat.nombre}` : 'Sin subcategoría')
        : (padre ? `${padre.nombre} › ${cat.nombre}` : cat.nombre);
    const stock = p.stock_ilimitado ? 'servicio' : `stock ${num(p.stock)}`;
    return `
      <div class="catw-prod${catw.marcados.has(id) ? ' marcado' : ''}" data-prod-id="${escHtml(id)}" draggable="true">
        <input type="checkbox" data-prod-marcar="${escHtml(id)}" ${catw.marcados.has(id) ? 'checked' : ''} aria-label="Marcar ${escHtml(p.nombre)}">
        ${miniaturaProducto(p, 40)}
        <div class="catw-prod-texto">
          <a href="#" class="catw-prod-nombre" data-prod-abrir="${escHtml(id)}" title="Abrir la ficha">${escHtml(p.nombre)}</a>
          <small>${escHtml(donde)} · ${escHtml(stock)}${p.por_llegar ? ' · 🚚 por llegar' : ''}</small>
        </div>
        <span class="catw-prod-estado ${p.publicado_web ? 'ok' : ''}">${p.publicado_web ? '🌐 publicado' : 'oculto'}</span>
      </div>`;
  }).join('')
    : `<p class="modal-hint catw-vacio">${catw.buscarProd ? 'Ningún producto con ese nombre acá.'
      : catw.seleccion === 'sin' ? '✅ No hay productos sin categoría.'
        : 'Todavía no hay productos en esta categoría. Arrastra alguno desde “Todos los productos”.'}</p>`;
  catwPintarBarra();
}

function catwOpcionesDestino(excluir) {
  return '<option value="">— Sin categoría —</option>' + catwRaices().map(c => `
    <option value="${escHtml(String(c.id))}" ${String(c.id) === String(excluir) ? 'disabled' : ''}>${escHtml(c.nombre)}</option>
    ${catwHijas(c.id).map(h => `<option value="${escHtml(String(h.id))}" ${String(h.id) === String(excluir) ? 'disabled' : ''}>&nbsp;&nbsp;&nbsp;↳ ${escHtml(h.nombre)}</option>`).join('')}`).join('');
}

function catwPintarBarra() {
  const barra = document.getElementById('catwBarra');
  if (!barra) return;
  const n = catw.marcados.size;
  const total = document.querySelectorAll('#catwProductos .catw-prod').length;
  barra.innerHTML = !total ? '' : `
    <div class="catw-barra${n ? ' activa' : ''}">
      <label class="catw-barra-todos"><input type="checkbox" data-prod-todos="1" ${n && n === total ? 'checked' : ''}> ${n ? `<strong>${n}</strong> marcado${n === 1 ? '' : 's'}` : 'Marcar todos'}</label>
      ${n ? `<span class="catw-barra-mover">Mover a
        <select id="catwDestino" aria-label="Categoría de destino">${catwOpcionesDestino(null)}</select>
        <button type="button" class="btn btn-primary btn-sm" data-prod-mover="1">Mover</button></span>` : ''}
    </div>`;
  barra.querySelector('[data-prod-todos]')?.addEventListener('change', (e) => {
    document.querySelectorAll('#catwProductos .catw-prod').forEach(f => {
      const id = String(f.dataset.prodId);
      if (e.target.checked) catw.marcados.add(id); else catw.marcados.delete(id);
    });
    catwPintarProductos();
  });
}

/* ---------- Acciones ---------- */

function catwElegir(sel) {
  catw.seleccion = sel;
  catw.buscarProd = '';
  catw.marcados.clear();
  const cat = catwPorId(sel);
  if (cat) catw.abiertas.add(String(cat.parent_id || cat.id));
  catwPintarArbol();
  catwPintarDetalle();
}

function catwClicArbol(e) {
  if (e.target.closest('.catw-input')) return;
  if (e.target.closest('[data-cat-guardar]')) { catwGuardarEdicion(e.target.closest('.catw-item')?.querySelector('.catw-input')?.value); return; }
  if (e.target.closest('[data-cat-cancelar]')) { catw.editando = null; catwPintarArbol(); return; }
  const abrir = e.target.closest('[data-cat-abrir]');
  if (abrir) {
    const id = abrir.dataset.catAbrir;
    if (catw.abiertas.has(id)) catw.abiertas.delete(id); else catw.abiertas.add(id);
    catwPintarArbol();
    return;
  }
  const sub = e.target.closest('[data-cat-sub]');
  if (sub) { catw.abiertas.add(sub.dataset.catSub); catw.editando = { modo: 'sub', id: sub.dataset.catSub }; catwPintarArbol(); return; }
  const ren = e.target.closest('[data-cat-renombrar]');
  if (ren) { catw.editando = { modo: 'renombrar', id: ren.dataset.catRenombrar }; catwPintarArbol(); return; }
  const eli = e.target.closest('[data-cat-eliminar]');
  if (eli) { catwPedirEliminar(eli.dataset.catEliminar); return; }
  const mover = e.target.closest('[data-cat-mover]');
  if (mover) { catwMoverConFlecha(mover.closest('[data-cat-id]').dataset.catId, mover.dataset.catMover); return; }
  const fila = e.target.closest('[data-cat-sel]');
  if (fila) catwElegir(fila.dataset.catSel);
}

function catwClicDetalle(e) {
  const abrir = e.target.closest('[data-prod-abrir]');
  if (abrir) {
    e.preventDefault();
    const p = catwProductos().find(x => String(x.id) === String(abrir.dataset.prodAbrir));
    if (p && typeof abrirModalProducto === 'function') abrirModalProducto(p);
    return;
  }
  if (e.target.closest('[data-prod-mover]')) {
    const destino = document.getElementById('catwDestino')?.value || null;
    catwMoverProductos([...catw.marcados], destino);
  }
}

async function catwGuardarEdicion(valor) {
  const nombre = String(valor || '').trim();
  const ed = catw.editando;
  if (!ed) return;
  if (!nombre) { showToast('Escribe un nombre', 'err'); return; }
  try {
    if (ed.modo === 'renombrar') {
      const antes = catwPorId(ed.id);
      if (antes && antes.nombre === nombre) { catw.editando = null; catwPintarArbol(); return; }
      const r = await API.productosCategorias.renombrar(ed.id, nombre);
      showToast(`Nombre cambiado${num(r?.productos_actualizados) ? ` · ${num(r.productos_actualizados)} producto(s) actualizados en la tienda` : ''}`, 'ok');
      catw.editando = null;
      // El texto de categoría de esos productos cambió: se recargan
      if (num(r?.productos_actualizados) && typeof cargarProductos === 'function') await cargarProductos(true);
    } else {
      const creada = await API.productosCategorias.crear(nombre, ed.modo === 'sub' ? ed.id : null);
      showToast(ed.modo === 'sub' ? 'Subcategoría creada' : 'Categoría creada', 'ok');
      catw.editando = null;
      if (creada?.id) catw.seleccion = String(creada.id);
    }
    await cargarCategoriasWeb();
  } catch (err) {
    showToast(err.message || 'No se pudo guardar', 'err');
  }
}

/* Eliminar pregunta a dónde van los productos, en vez de dejarlos en el aire. */
function catwPedirEliminar(id) {
  const cat = catwPorId(id);
  if (!cat) return;
  const { directos, total } = catwConteos();
  const cuantos = cat.parent_id ? (directos.get(String(id)) || 0) : total(id);
  const hijas = catwHijas(id);
  const modal = document.getElementById('modalCatwEliminar');
  if (!modal) return;
  document.getElementById('catwEliminarTitulo').textContent = `Eliminar “${cat.nombre}”`;
  document.getElementById('catwEliminarTexto').innerHTML =
    `${hijas.length ? `Se elimina${hijas.length === 1 ? ' también su <strong>subcategoría' : `n también sus <strong>${hijas.length} subcategorías`}</strong>. ` : ''}`
    + (cuantos
      ? `Tiene <strong>${cuantos} producto${cuantos === 1 ? '' : 's'}</strong>. ¿A dónde los muevo?`
      : 'No tiene productos: se puede eliminar sin mover nada.');
  const bloque = document.getElementById('catwEliminarBloque');
  bloque.style.display = cuantos ? 'block' : 'none';
  const destino = document.getElementById('catwEliminarDestino');
  const excluir = new Set([String(id), ...hijas.map(h => String(h.id))]);
  destino.innerHTML = (cat.parent_id
    ? `<option value="">Dejarlos en “${escHtml(catwPorId(cat.parent_id)?.nombre || '')}”, sin subcategoría</option>`
    : '<option value="">Dejarlos sin categoría</option>')
    + catwRaices().filter(c => !excluir.has(String(c.id))).map(c => `
      <option value="${escHtml(String(c.id))}">${escHtml(c.nombre)}</option>
      ${catwHijas(c.id).filter(h => !excluir.has(String(h.id))).map(h => `<option value="${escHtml(String(h.id))}">&nbsp;&nbsp;&nbsp;↳ ${escHtml(h.nombre)}</option>`).join('')}`).join('');
  const btn = document.getElementById('btnCatwEliminar');
  btn.onclick = async () => {
    btn.disabled = true;
    try {
      const r = await API.productosCategorias.eliminar(id, cuantos ? destino.value : '');
      showToast(`Categoría eliminada${num(r?.productos_movidos) ? ` · ${num(r.productos_movidos)} producto(s) movidos` : ''}`, 'ok');
      cerrarModal('modalCatwEliminar');
      if (String(catw.seleccion) === String(id) || excluir.has(String(catw.seleccion))) catw.seleccion = 'todas';
      if (typeof cargarProductos === 'function') await cargarProductos(true);
      await cargarCategoriasWeb();
    } catch (err) {
      showToast(err.message || 'No se pudo eliminar', 'err');
    } finally {
      btn.disabled = false;
    }
  };
  modal.classList.add('show');
}

async function catwMoverProductos(ids, destinoId) {
  const lista = [...new Set((ids || []).map(String))].filter(id => {
    const p = catwProductos().find(x => String(x.id) === id);
    return p && String(catwCategoriaDe(p) || '') !== String(destinoId || '');   // los que ya están ahí no se tocan
  });
  if (!lista.length) { showToast('Ya están en esa categoría', 'ok'); return; }
  const destino = catwPorId(destinoId);
  try {
    const r = await API.productosCategorias.asignar(lista.map(Number), destinoId || null);
    // La lista de productos en memoria queda igual que la base, sin recargar todo
    catwProductos().forEach(p => {
      if (lista.includes(String(p.id))) Object.assign(p, { categoria_id: r.categoria_id, categoria_web: r.categoria_web, subcategoria_web: r.subcategoria_web });
    });
    catw.marcados.clear();
    showToast(`${num(r.movidos)} producto${num(r.movidos) === 1 ? '' : 's'} ${destino ? `→ ${destino.nombre}` : 'sin categoría'}`, 'ok');
    pintarCategoriasWeb();
  } catch (err) {
    showToast(err.message || 'No se pudo mover', 'err');
  }
}

/* Soltar una categoría sobre otra del mismo nivel: queda justo antes de ella. */
async function catwReordenar(id, antesDe) {
  const cat = catwPorId(id);
  const destino = catwPorId(antesDe);
  if (!cat || !destino || String(cat.parent_id || '') !== String(destino.parent_id || '') || String(id) === String(antesDe)) return;
  const hermanos = (cat.parent_id ? catwHijas(cat.parent_id) : catwRaices()).map(c => String(c.id)).filter(x => x !== String(id));
  hermanos.splice(hermanos.indexOf(String(antesDe)), 0, String(id));
  try {
    await API.productosCategorias.ordenar(hermanos);
    await cargarCategoriasWeb();
  } catch (err) {
    showToast(err.message || 'No se pudo cambiar el orden', 'err');
  }
}

async function catwMoverConFlecha(id, direccion) {
  try {
    await API.productosCategorias.mover(id, direccion);
    await cargarCategoriasWeb();
  } catch (err) {
    showToast(err.message || 'No se pudo mover', 'err');
  }
}

/* Dónde se puede soltar lo que se está arrastrando. */
function catwDestinoValido(objetivo) {
  const el = objetivo.closest?.('[data-cat-sel]');
  if (!el || !catw.arrastre) return null;
  const sel = el.dataset.catSel;
  if (catw.arrastre.tipo === 'prod') return sel === 'todas' ? null : { el, sel, clase: 'soltar' };
  const cat = catwPorId(catw.arrastre.id);
  const destino = catwPorId(sel);
  if (!cat || !destino || String(cat.id) === String(destino.id)) return null;
  return String(cat.parent_id || '') === String(destino.parent_id || '') ? { el, sel, clase: 'soltar-antes' } : null;
}
