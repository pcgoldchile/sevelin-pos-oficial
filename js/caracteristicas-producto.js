/* ============================================================
   FILTROS DE LA TIENDA EN LA FICHA (v159, sql/103, dueño 18-10-2026)
   ------------------------------------------------------------
   "Falta un tipo filtro aquí, por ejemplo marcar la casilla si incluye: HDMI,
   VGA, parlantes." Cada producto guarda qué casillas tiene marcadas en
   productos.caracteristicas, y sevelin.cl arma con eso el panel "Filtrar".

   Las casillas cambian con la categoría: el esquema (qué grupos y valores
   tiene cada una) vive solo en el servidor (CARACTERISTICAS_TIENDA en
   api/index.js) y se pide una vez. "✨ Rellenar con IA" marca lo que dice la
   descripción; no guarda: se guarda con el producto, como todo lo demás.

   Va después de productos.js y asistente-producto.js: usa su estado de la
   ficha (sesionEditorProducto, resolverCategoriaWebYSubcategoria…).
   ============================================================ */

let esquemaCaracteristicasCache = null;     // [{ categoria, subcategoria, grupos }] o null si no cargó
let pidiendoEsquemaCaracteristicas = null;  // la promesa en curso, para no pedirlo dos veces
let caracteristicasEnEdicion = {};          // lo marcado, también de grupos que ahora no se ven
let caracteristicasDibujadas = false;       // false = el cuadro no está listo: no se manda nada al guardar

async function cargarEsquemaCaracteristicas() {
  if (esquemaCaracteristicasCache) return esquemaCaracteristicasCache;
  if (!pidiendoEsquemaCaracteristicas) {
    pidiendoEsquemaCaracteristicas = API.productos.esquemaCaracteristicas()
      .then(r => { esquemaCaracteristicasCache = Array.isArray(r?.esquema) ? r.esquema : null; return esquemaCaracteristicasCache; })
      .catch(err => { console.error('No se pudo cargar el esquema de filtros:', err.message || err); return null; })
      .finally(() => { pidiendoEsquemaCaracteristicas = null; });
  }
  return pidiendoEsquemaCaracteristicas;
}

/* Misma regla que gruposCaracteristicasDe() del servidor: los de la categoría
   y encima los de la subcategoría. */
function gruposFiltroDeCategoria(categoria, subcategoria) {
  if (!categoria || !esquemaCaracteristicasCache) return [];
  const porId = new Map();
  for (const e of esquemaCaracteristicasCache) {
    if (e.categoria !== categoria) continue;
    if (e.subcategoria && e.subcategoria !== subcategoria) continue;
    for (const g of e.grupos) {
      if (!e.subcategoria && porId.has(g.id)) continue;
      porId.set(g.id, g);
    }
  }
  return [...porId.values()];
}

/* Al abrir la ficha (producto nuevo o existente). */
async function prepararCaracteristicasProducto(valores) {
  caracteristicasEnEdicion = (valores && typeof valores === 'object' && !Array.isArray(valores))
    ? JSON.parse(JSON.stringify(valores)) : {};
  caracteristicasDibujadas = false;
  const aviso = document.getElementById('prodCaracteristicasIA');
  if (aviso) aviso.textContent = '';
  await cargarEsquemaCaracteristicas();
  pintarCaracteristicasProducto({ alAbrir: true });
}

/* Antes de redibujar (cambio de categoría) se guarda lo que estaba marcado en
   pantalla, para que volver a la categoría anterior no lo pierda. */
function recogerCaracteristicasEnPantalla() {
  const caja = document.getElementById('prodCaracteristicas');
  if (!caja || !caracteristicasDibujadas) return;
  caja.querySelectorAll('[data-grupo-filtro]').forEach(bloque => {
    const id = bloque.dataset.grupoFiltro;
    const marcados = [...bloque.querySelectorAll('input[type="checkbox"]:checked')].map(c => c.value);
    if (marcados.length) caracteristicasEnEdicion[id] = marcados; else delete caracteristicasEnEdicion[id];
  });
}

function pintarCaracteristicasProducto(opciones = {}) {
  const caja = document.getElementById('prodCaracteristicas');
  const card = document.querySelector('#view-producto-editor [data-seccion="filtros"]');
  const boton = document.getElementById('btnCaracteristicasIA');
  if (!caja) return;
  recogerCaracteristicasEnPantalla();

  if (!esquemaCaracteristicasCache) {
    caracteristicasDibujadas = false;
    caja.innerHTML = '<p class="modal-hint">No se pudieron cargar los filtros. Cierra y vuelve a abrir el producto; lo que ya tenía marcado no se toca.</p>';
    if (boton) boton.hidden = true;
    return;
  }

  const { categoria_web, subcategoria_web } = resolverCategoriaWebYSubcategoria();
  const grupos = gruposFiltroDeCategoria(categoria_web, subcategoria_web);
  caracteristicasDibujadas = true;
  if (boton) boton.hidden = !grupos.length;

  if (!grupos.length) {
    caja.innerHTML = `<p class="modal-hint">${categoria_web
      ? `<strong>${escHtml(subcategoria_web || categoria_web)}</strong> no tiene filtros en la tienda: ahí bastan la marca, el precio y el estado.`
      : 'Elige la categoría primero: las casillas cambian según la categoría.'}</p>`;
    pintarResumenCaracteristicas(0);
    return;
  }

  caja.innerHTML = grupos.map(g => {
    const marcados = caracteristicasEnEdicion[g.id] || [];
    return `
      <div class="filtro-grupo" data-grupo-filtro="${escHtml(g.id)}" data-multiple="${g.multiple ? '1' : '0'}">
        <p class="filtro-grupo-titulo">${escHtml(g.nombre)} <small>${g.multiple ? 'marca todas las que tenga' : 'una sola'}</small></p>
        <div class="filtro-opciones">
          ${g.valores.map(v => `
            <label class="filtro-opcion">
              <input type="checkbox" value="${escHtml(v)}" ${marcados.includes(v) ? 'checked' : ''}>
              <span>${escHtml(v)}</span>
            </label>`).join('')}
        </div>
      </div>`;
  }).join('');

  const total = grupos.reduce((n, g) => n + (caracteristicasEnEdicion[g.id] || []).filter(v => g.valores.includes(v)).length, 0);
  pintarResumenCaracteristicas(total);
  // v173: con las entradas de video a la vista (a mano, con IA o al cambiar de categoría), la
  // tarjeta "➕ Agregable" pregunta si ofrecer el adaptador a un monitor sin HDMI (js/agregable.js)
  if (typeof agregableRevisarPregunta === 'function') agregableRevisarPregunta();
  // Al abrir: si la categoría tiene filtros y no hay nada marcado, la tarjeta queda abierta para que se vea
  if (opciones.alAbrir && card && total === 0) card.classList.remove('plegada');
}

function pintarResumenCaracteristicas(total) {
  const resumen = document.getElementById('prodCaracteristicasResumen');
  if (!resumen) return;
  resumen.textContent = total ? `${total} marcada${total === 1 ? '' : 's'}` : 'Ninguna marcada';
}

/* Lo que va en el guardado. Solo los grupos que hoy se ven: lo de otra
   categoría se descarta. Si el cuadro no alcanzó a dibujarse (no cargó el
   esquema), no se manda el campo y el servidor deja lo guardado como estaba. */
function leerCaracteristicasProducto() {
  if (!caracteristicasDibujadas) return {};
  recogerCaracteristicasEnPantalla();
  const { categoria_web, subcategoria_web } = resolverCategoriaWebYSubcategoria();
  const salida = {};
  for (const g of gruposFiltroDeCategoria(categoria_web, subcategoria_web)) {
    const marcados = (caracteristicasEnEdicion[g.id] || []).filter(v => g.valores.includes(v));
    if (marcados.length) salida[g.id] = marcados;
  }
  return { caracteristicas: salida };
}

async function rellenarCaracteristicasConIA() {
  const aviso = document.getElementById('prodCaracteristicasIA');
  const boton = document.getElementById('btnCaracteristicasIA');
  const nombre = (document.getElementById('prodNombre')?.value || '').trim();
  const descripcion = document.getElementById('prodDescripcion')?.value || '';
  const { categoria_web, subcategoria_web } = resolverCategoriaWebYSubcategoria();
  if (!categoria_web) { showToast('Elige la categoría primero', 'err'); return; }
  if (!nombre && !descripcion.trim()) {
    showToast('Escribe el nombre y la descripción primero: la IA marca solo lo que dice el texto', 'err');
    return;
  }
  const sesion = sesionEditorProducto;
  if (boton) { boton.disabled = true; boton.textContent = '✨ Leyendo la descripción…'; }
  try {
    const r = await API.productos.sugerirCaracteristicas({
      nombre: (typeof nombreProvisorioDeProducto === 'function' && nombreProvisorioDeProducto(nombre)) ? '' : nombre,
      descripcion_html: descripcion,
      categoria_web,
      subcategoria_web
    });
    if (sesion !== sesionEditorProducto) return;   // la ficha ya es de otro producto
    const propuestas = r?.caracteristicas || {};
    const grupos = gruposFiltroDeCategoria(categoria_web, subcategoria_web);
    recogerCaracteristicasEnPantalla();
    let cambios = 0;
    for (const g of grupos) {
      const antes = (caracteristicasEnEdicion[g.id] || []).join('|');
      const despues = (propuestas[g.id] || []);
      if (antes !== despues.join('|')) cambios++;
      if (despues.length) caracteristicasEnEdicion[g.id] = [...despues]; else delete caracteristicasEnEdicion[g.id];
    }
    caracteristicasDibujadas = false;   // ya se recogió: que el redibujo no lo vuelva a leer de la pantalla
    pintarCaracteristicasProducto();
    const total = Object.values(propuestas).reduce((n, l) => n + l.length, 0);
    if (aviso) {
      aviso.innerHTML = total
        ? `✨ La IA marcó <strong>${total}</strong> casilla${total === 1 ? '' : 's'} con lo que dice la descripción${cambios ? '' : ' (las mismas que ya tenía)'}. Revísalas: se guardan con el producto.`
        : 'La IA no encontró nada de esto en la descripción. Si el producto lo tiene, márcalo a mano (y conviene sumarlo a la descripción).';
    }
  } catch (err) {
    if (sesion === sesionEditorProducto) showToast(err.message || 'No se pudieron proponer las casillas', 'err');
  } finally {
    if (boton) { boton.disabled = false; boton.textContent = '✨ Rellenar con IA'; }
  }
}

document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('btnCaracteristicasIA')?.addEventListener('click', rellenarCaracteristicasConIA);
  // "Una sola": marcar una desmarca las otras del mismo grupo.
  document.getElementById('prodCaracteristicas')?.addEventListener('change', (e) => {
    const casilla = e.target.closest('input[type="checkbox"]');
    const bloque = casilla?.closest('[data-grupo-filtro]');
    if (!casilla || !bloque) return;
    if (casilla.checked && bloque.dataset.multiple === '0') {
      bloque.querySelectorAll('input[type="checkbox"]').forEach(c => { if (c !== casilla) c.checked = false; });
    }
    recogerCaracteristicasEnPantalla();
    const { categoria_web, subcategoria_web } = resolverCategoriaWebYSubcategoria();
    const grupos = gruposFiltroDeCategoria(categoria_web, subcategoria_web);
    pintarResumenCaracteristicas(grupos.reduce((n, g) => n + (caracteristicasEnEdicion[g.id] || []).length, 0));
  });
});
