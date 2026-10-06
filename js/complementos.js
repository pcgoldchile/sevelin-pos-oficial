/* ============================================================
   COMPLEMENTA TU COMPRA (v102, sql/75)
   ------------------------------------------------------------
   Pedido del dueño (30-09-2026): en la ficha de sevelin.cl, un carrusel
   con productos relacionados (pasta térmica, limpieza, cables...) que él
   elige desde el POS: cuáles y cuántos.

   Se guarda al instante, por su propia ruta (PUT /api/productos/:id/
   relacionados), igual que las fotos: no depende del botón Guardar del
   producto y editar un precio nunca borra la lista. La tienda muestra solo
   los que están publicados y con stock, en este orden; acá se avisa cuáles
   no van a salir para que no parezca un error.
   ============================================================ */

const MAX_COMPLEMENTOS_POS = 12;
let complementosIds = [];
let complementosDeProducto = null;   // id del producto abierto en el editor
let guardandoComplementos = false;

document.addEventListener('DOMContentLoaded', () => {
  const buscar = document.getElementById('prodComplementosBuscar');
  buscar?.addEventListener('input', pintarSugerenciasComplementos);
  buscar?.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter') return;
    e.preventDefault();   // Enter no debe enviar el formulario del producto
    document.querySelector('#prodComplementosSugerencias [data-agregar-complemento]')?.click();
  });
  document.getElementById('btnComplementosIA')?.addEventListener('click', sugerirComplementosConIA);
  ['prodComplementosSugerencias', 'prodComplementosPorCategoria', 'prodComplementosIA'].forEach(id => {
    document.getElementById(id)?.addEventListener('click', (e) => {
      const b = e.target.closest('[data-agregar-complemento]');
      if (b) agregarComplemento(Number(b.dataset.agregarComplemento));
    });
  });
  document.getElementById('prodComplementosLista')?.addEventListener('click', (e) => {
    const b = e.target.closest('[data-complemento-accion]');
    if (!b) return;
    const i = Number(b.dataset.idx);
    const lista = complementosIds.slice();
    if (b.dataset.complementoAccion === 'quitar') lista.splice(i, 1);
    else {
      const j = b.dataset.complementoAccion === 'subir' ? i - 1 : i + 1;
      if (j < 0 || j >= lista.length) return;
      [lista[i], lista[j]] = [lista[j], lista[i]];
    }
    guardarComplementos(lista);
  });
});

/* La llama abrirModalProducto() (js/productos.js) al abrir el editor. */
function pintarComplementosProducto(producto) {
  complementosDeProducto = producto?.id || null;
  complementosIds = Array.isArray(producto?.relacionados_ids) ? producto.relacionados_ids.map(Number) : [];
  const buscar = document.getElementById('prodComplementosBuscar');
  if (buscar) { buscar.value = ''; buscar.disabled = !complementosDeProducto; }
  const sug = document.getElementById('prodComplementosSugerencias');
  if (sug) sug.innerHTML = '';
  // v119: las sugerencias de la IA son del producto anterior; el botón pide uno ya guardado.
  const ia = document.getElementById('prodComplementosIA');
  if (ia) ia.innerHTML = '';
  const btnIA = document.getElementById('btnComplementosIA');
  if (btnIA) { btnIA.disabled = !complementosDeProducto; btnIA.title = complementosDeProducto ? '' : 'Guarda el producto primero'; }
  pintarListaComplementos();
}

/* v119 (dueño, 03-10-2026): "que el complementa tu compra sea automatizado por
   IA también". La IA elige entre los productos publicados y con stock (el
   servidor descarta cualquier id que no exista). Solo propone: cada uno se
   agrega con su clic, igual que los sugeridos por categoría. */
async function sugerirComplementosConIA() {
  const cont = document.getElementById('prodComplementosIA');
  const btn = document.getElementById('btnComplementosIA');
  if (!cont || !complementosDeProducto) { showToast('Guarda el producto primero', 'err'); return; }
  const productoId = complementosDeProducto;
  if (btn) { btn.disabled = true; btn.textContent = '✨ Buscando…'; }
  try {
    const r = await API.productos.sugerirComplementos(productoId);
    if (productoId !== complementosDeProducto) return;   // se abrió otro producto mientras tanto
    const sugeridos = (r?.sugeridos || []).filter(s => !complementosIds.includes(Number(s.id)));
    cont.innerHTML = sugeridos.length
      ? `<p class="modal-hint" style="margin:8px 0 2px;">✨ Sugeridos por la IA entre tus productos con stock. Toca los que quieras agregar.</p>
         ${sugeridos.map(s => `
           <button type="button" class="complemento-sugerencia" data-agregar-complemento="${Number(s.id)}">
             ➕ ${escHtml(s.nombre)} <small>${fmtCLP(s.precio_unitario)}</small>
           </button>`).join('')}`
      : `<p class="modal-hint" style="margin:8px 0 2px;">${escHtml(r?.motivo || 'La IA no encontró complementos claros entre tus productos con stock.')}</p>`;
  } catch (err) {
    showToast(err.message || 'No se pudieron sugerir complementos', 'err');
  } finally {
    if (btn) { btn.disabled = !complementosDeProducto; btn.textContent = '✨ Sugerir con IA'; }
  }
}

/* v127 (dueño, 06-10-2026): desde la ventana de la ficha con IA, los
   complementos que elige la IA se AGREGAN de una vez (ahí él ya marcó la
   casilla). Quedan en la tarjeta, donde se pueden quitar. */
async function agregarComplementosConIA() {
  if (!complementosDeProducto) return;
  const productoId = complementosDeProducto;
  try {
    const r = await API.productos.sugerirComplementos(productoId);
    if (productoId !== complementosDeProducto) return;   // se abrió otro producto mientras tanto
    const nuevos = (r?.sugeridos || []).map(s => Number(s.id)).filter(id => id && !complementosIds.includes(id));
    if (!nuevos.length) { showToast(r?.motivo || 'La IA no encontró complementos claros entre tus productos con stock', 'err'); return; }
    await guardarComplementos([...complementosIds, ...nuevos].slice(0, MAX_COMPLEMENTOS_POS));
    showToast(`La IA agregó ${nuevos.length} complemento(s): revísalos en "Complementa tu compra"`, 'ok');
  } catch (err) {
    showToast(err.message || 'No se pudieron agregar complementos con IA', 'err');
  }
}

/* v113 (pendiente #54, pieza C): complementos sugeridos según la categoría.
   Sin IA: se cuentan los complementos que YA usan los demás productos de la
   misma categoría (primero los de la misma subcategoría) y se proponen los
   más repetidos. Solo propone: cada uno se agrega con su clic. */
const MAX_SUGERIDOS_CATEGORIA = 6;

function complementosSugeridosPorCategoria(productoId) {
  const todos = typeof productsList !== 'undefined' ? productsList : [];
  const actual = todos.find(p => Number(p.id) === Number(productoId));
  const categoria = String(actual?.categoria_web || '').trim();
  if (!actual || !categoria) return { categoria: '', hermanos: 0, sugeridos: [] };

  const hermanos = todos.filter(p => Number(p.id) !== Number(productoId) && !p.archivado
    && String(p.categoria_web || '').trim() === categoria
    && Array.isArray(p.relacionados_ids) && p.relacionados_ids.length);
  const subcategoria = String(actual.subcategoria_web || '').trim();

  const votos = new Map();   // id del complemento → { usan, mismaSub }
  for (const h of hermanos) {
    const mismaSub = !!subcategoria && String(h.subcategoria_web || '').trim() === subcategoria;
    for (const id of new Set(h.relacionados_ids.map(Number))) {
      const v = votos.get(id) || { usan: 0, mismaSub: 0 };
      v.usan += 1;
      if (mismaSub) v.mismaSub += 1;
      votos.set(id, v);
    }
  }

  const sugeridos = [...votos.entries()]
    .map(([id, v]) => ({ producto: todos.find(p => Number(p.id) === id), ...v }))
    .filter(s => s.producto && !s.producto.archivado
      && Number(s.producto.id) !== Number(productoId) && !complementosIds.includes(Number(s.producto.id)))
    // Solo lo que hoy saldría en la tienda: publicado y con stock.
    .filter(s => s.producto.publicado_web !== false && (s.producto.stock_ilimitado || Number(s.producto.stock) > 0))
    .sort((a, b) => (b.mismaSub - a.mismaSub) || (b.usan - a.usan) || String(a.producto.nombre).localeCompare(String(b.producto.nombre)))
    .slice(0, MAX_SUGERIDOS_CATEGORIA);
  return { categoria, hermanos: hermanos.length, sugeridos };
}

function pintarSugeridosPorCategoria() {
  const cont = document.getElementById('prodComplementosPorCategoria');
  if (!cont) return;
  if (!complementosDeProducto || complementosIds.length >= MAX_COMPLEMENTOS_POS) { cont.innerHTML = ''; return; }
  const { categoria, hermanos, sugeridos } = complementosSugeridosPorCategoria(complementosDeProducto);
  if (!sugeridos.length) { cont.innerHTML = ''; return; }
  cont.innerHTML = `
    <p class="modal-hint" style="margin:8px 0 2px;">💡 Sugeridos: lo que ya usan otros productos de <strong>${escHtml(categoria)}</strong>. Toca los que quieras agregar.</p>
    ${sugeridos.map(s => `
      <button type="button" class="complemento-sugerencia" data-agregar-complemento="${s.producto.id}">
        ➕ ${escHtml(s.producto.nombre)} <small>${fmtCLP(s.producto.precio_unitario)} · lo ${s.usan === 1 ? 'usa 1' : `usan ${s.usan}`} de ${hermanos}</small>
      </button>`).join('')}`;
}

function productoComplementoPorId(id) {
  return (typeof productsList !== 'undefined' ? productsList : []).find(p => Number(p.id) === Number(id)) || null;
}

function pintarListaComplementos() {
  pintarSugeridosPorCategoria();
  const cont = document.getElementById('prodComplementosLista');
  if (!cont) return;
  if (!complementosDeProducto) {
    cont.innerHTML = '<p class="modal-hint">Guarda el producto primero para elegir sus complementos.</p>';
    return;
  }
  if (!complementosIds.length) {
    cont.innerHTML = '<p class="modal-hint">Sin complementos: en la tienda esta sección no aparece.</p>';
    return;
  }
  cont.innerHTML = complementosIds.map((id, i) => {
    const p = productoComplementoPorId(id);
    const nombre = p ? p.nombre : `Producto #${id} (no encontrado)`;
    const avisos = [];
    if (!p) avisos.push('no encontrado');
    else {
      if (!p.publicado_web) avisos.push('no publicado');
      if (!p.stock_ilimitado && Number(p.stock) <= 0) avisos.push('sin stock');
    }
    return `
      <div class="complemento-fila">
        <span class="complemento-pos">${i + 1}</span>
        <div class="complemento-datos">
          <strong>${escHtml(nombre)}</strong>
          ${p ? `<small>${fmtCLP(p.precio_unitario)}${avisos.length ? ` · <span class="complemento-aviso">⚠️ ${avisos.join(', ')}: no sale en la tienda</span>` : ''}</small>` : ''}
        </div>
        <div class="complemento-acciones">
          <button type="button" class="btn btn-sm btn-ghost" data-complemento-accion="subir" data-idx="${i}" ${i === 0 ? 'disabled' : ''} title="Subir">▲</button>
          <button type="button" class="btn btn-sm btn-ghost" data-complemento-accion="bajar" data-idx="${i}" ${i === complementosIds.length - 1 ? 'disabled' : ''} title="Bajar">▼</button>
          <button type="button" class="btn btn-sm btn-ghost" data-complemento-accion="quitar" data-idx="${i}" title="Quitar">✕</button>
        </div>
      </div>`;
  }).join('');
}

function pintarSugerenciasComplementos() {
  const cont = document.getElementById('prodComplementosSugerencias');
  const texto = (document.getElementById('prodComplementosBuscar')?.value || '').trim().toLowerCase();
  if (!cont) return;
  if (texto.length < 2 || !complementosDeProducto) { cont.innerHTML = ''; return; }
  const palabras = texto.split(/\s+/);
  const candidatos = (typeof productsList !== 'undefined' ? productsList : [])
    .filter(p => !p.archivado && Number(p.id) !== Number(complementosDeProducto) && !complementosIds.includes(Number(p.id)))
    .filter(p => {
      const hay = `${p.nombre || ''} ${p.sku || ''}`.toLowerCase();
      return palabras.every(w => hay.includes(w));
    })
    // Primero lo que sí va a salir en la tienda
    .sort((a, b) => (Number(!!b.publicado_web) - Number(!!a.publicado_web)) || String(a.nombre).localeCompare(String(b.nombre)))
    .slice(0, 8);
  cont.innerHTML = candidatos.length
    ? candidatos.map(p => `
        <button type="button" class="complemento-sugerencia" data-agregar-complemento="${p.id}">
          ➕ ${escHtml(p.nombre)} <small>${fmtCLP(p.precio_unitario)}${p.publicado_web ? '' : ' · no publicado'}</small>
        </button>`).join('')
    : '<p class="modal-hint">Ningún producto coincide.</p>';
}

function agregarComplemento(id) {
  if (complementosIds.length >= MAX_COMPLEMENTOS_POS) {
    return showToast(`Máximo ${MAX_COMPLEMENTOS_POS} complementos por producto`, 'err');
  }
  const buscar = document.getElementById('prodComplementosBuscar');
  if (buscar) buscar.value = '';
  document.getElementById('prodComplementosSugerencias').innerHTML = '';
  document.querySelector(`#prodComplementosIA [data-agregar-complemento="${Number(id)}"]`)?.remove();
  guardarComplementos([...complementosIds, id]);
}

async function guardarComplementos(lista) {
  if (!complementosDeProducto || guardandoComplementos) return;
  guardandoComplementos = true;
  const productoId = complementosDeProducto;
  try {
    const r = await API.productos.guardarRelacionados(productoId, lista);
    // Si en el intertanto se abrió otro producto, no se pinta encima de él.
    if (productoId !== complementosDeProducto) return;
    complementosIds = (r?.relacionados_ids || lista).map(Number);
    const local = productoComplementoPorId(productoId);
    if (local) local.relacionados_ids = complementosIds.slice();
    pintarListaComplementos();
    showToast('Complementos guardados', 'ok');
  } catch (err) {
    showToast(err.message || 'No se pudieron guardar los complementos', 'err');
  } finally {
    guardandoComplementos = false;
  }
}
