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
  document.getElementById('prodComplementosSugerencias')?.addEventListener('click', (e) => {
    const b = e.target.closest('[data-agregar-complemento]');
    if (b) agregarComplemento(Number(b.dataset.agregarComplemento));
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
  pintarListaComplementos();
}

function productoComplementoPorId(id) {
  return (typeof productsList !== 'undefined' ? productsList : []).find(p => Number(p.id) === Number(id)) || null;
}

function pintarListaComplementos() {
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
