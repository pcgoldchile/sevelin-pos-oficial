// ==========================================
// PRECIO-SUGERIDO.JS - Precio en 990 y mayorista sugeridos (v109, pendiente #54)
// ------------------------------------------
// Al escribir el costo en el editor de producto, propone el precio que cumple
// el margen objetivo de su familia (terminado en 990) y su precio mayorista.
// La regla vive en el servidor (POST /api/productos/precio-sugerido): acá solo
// se muestra. Nunca cambia un precio solo: cada sugerencia trae su botón "Usar".
// ==========================================

let precioSugeridoTemporizador = null;
let precioSugeridoPeticion = 0;

const pctSugerido = (n) => `${String(n).replace('.', ',')}%`;

function datosParaPrecioSugerido() {
  const val = (id) => document.getElementById(id)?.value ?? '';
  let categoria = typeof resolverCategoriaWebYSubcategoria === 'function'
    ? resolverCategoriaWebYSubcategoria()
    : { categoria_web: null, subcategoria_web: null };
  /* Si la lista de categorías todavía no cargó, se usa la que el producto ya
     tiene guardada (no la que se "eligió", que aún no existe en pantalla). */
  const sinLista = typeof categoriasWebCache === 'undefined' || !categoriasWebCache.length;
  if (!categoria.categoria_web && sinLista && typeof editingProductId !== 'undefined' && editingProductId && Array.isArray(productsList)) {
    const guardado = productsList.find(p => String(p.id) === String(editingProductId));
    if (guardado) categoria = { categoria_web: guardado.categoria_web, subcategoria_web: guardado.subcategoria_web };
  }
  return {
    costo: Number(val('prodCosto')) || 0,
    precio_actual: Number(val('prodPrecio')) || 0,
    categoria_web: categoria.categoria_web || '',
    subcategoria_web: categoria.subcategoria_web || '',
    condicion: val('prodCondicion'),
    es_servicio: !!document.getElementById('prodEsServicio')?.checked || !!document.getElementById('prodStockIlimitado')?.checked,
    producto_id: typeof editingProductId !== 'undefined' ? (editingProductId || null) : null
  };
}

/* Se llama al escribir el costo o el precio, y al cambiar categoría o condición. */
function pedirPrecioSugerido(inmediato) {
  clearTimeout(precioSugeridoTemporizador);
  precioSugeridoTemporizador = setTimeout(consultarPrecioSugerido, inmediato ? 0 : 450);
}

async function consultarPrecioSugerido() {
  const caja = document.getElementById('prodPrecioSugerido');
  if (!caja || !esAdmin()) return;
  const datos = datosParaPrecioSugerido();
  if (!(datos.costo > 0)) { caja.innerHTML = ''; return; }

  const turno = ++precioSugeridoPeticion;
  try {
    const r = await API.productos.precioSugerido(datos);
    if (turno !== precioSugeridoPeticion) return;   // llegó tarde: ya se pidió otro
    pintarPrecioSugerido(r, datos);
  } catch (err) {
    if (turno === precioSugeridoPeticion) caja.innerHTML = '';
    console.error('No se pudo calcular el precio sugerido:', err.message || err);
  }
}

function pintarPrecioSugerido(r, datos) {
  const caja = document.getElementById('prodPrecioSugerido');
  if (!caja) return;
  if (!r || !r.precio) {
    caja.innerHTML = r?.motivo ? `<p class="precio-sugerido-nota">💡 ${escHtml(r.motivo)}.</p>` : '';
    return;
  }

  const costoNota = r.costo > r.costo_escrito
    ? ` (se usa ${fmtCLP(r.costo)}, el mayor costo conocido: una compra o un lote salió más caro que ${fmtCLP(r.costo_escrito)})`
    : '';
  const actual = datos.precio_actual;
  let precio;
  if (actual === r.precio) {
    precio = `✔ El precio actual (${fmtCLP(actual)}) es el sugerido: deja ${pctSugerido(r.margen_pct)}.`;
  } else if (actual > r.precio) {
    precio = `✔ El precio actual (${fmtCLP(actual)}) está sobre el sugerido (<strong>${fmtCLP(r.precio)}</strong>): cumple el margen objetivo.`;
  } else {
    precio = `Precio sugerido: <strong>${fmtCLP(r.precio)}</strong> (deja ${pctSugerido(r.margen_pct)})`
      + (actual > 0 ? `; hoy está en ${fmtCLP(actual)}.` : '.')
      + ` <button type="button" class="btn btn-ghost btn-sm" data-usar-precio-sugerido="${Number(r.precio)}">Usar ${fmtCLP(r.precio)}</button>`;
  }

  const m = r.mayorista;
  const mayoristaActual = Number(document.getElementById('prodPrecioMayorista')?.value) || 0;
  let mayorista;
  if (!m) {
    mayorista = `Mayorista: ${escHtml(r.mayorista_motivo || 'no cabe una rebaja real')}.`;
  } else if (mayoristaActual === m.precio) {
    mayorista = `✔ El mayorista actual (${fmtCLP(mayoristaActual)}) es el sugerido.`;
  } else {
    mayorista = `Mayorista sugerido: <strong>${fmtCLP(m.precio)}</strong> desde ${Number(m.desde)} u. `
      + `(−${pctSugerido(m.rebaja_pct)} de ${fmtCLP(m.sobre_precio)}, deja ${pctSugerido(m.margen_pct)})`
      + (mayoristaActual > 0 ? `; hoy está en ${fmtCLP(mayoristaActual)}.` : '.')
      + ` <button type="button" class="btn btn-ghost btn-sm" data-usar-mayorista-sugerido="${Number(m.precio)}" data-desde="${Number(m.desde)}">Usar ${fmtCLP(m.precio)}</button>`;
  }

  caja.innerHTML = `
    <p class="precio-sugerido-titulo">💡 Margen objetivo de <strong>${escHtml(r.familia)}</strong>: ${pctSugerido(r.margen_objetivo_pct)}
      <small>(${escHtml(r.origen)})</small>${escHtml(costoNota)}</p>
    <p>${precio}</p>
    <p>${mayorista}</p>
    <p class="precio-sugerido-nota">Es una sugerencia según tu margen objetivo: compárala con el mercado antes de usarla. Nada cambia hasta que guardes.</p>`;
}

document.addEventListener('DOMContentLoaded', () => {
  const caja = document.getElementById('prodPrecioSugerido');
  if (!caja) return;

  // Lo que cambia la sugerencia: costo, precio, categoría, condición y si es servicio
  ['prodCosto', 'prodPrecio', 'prodPrecioMayorista'].forEach(id => {
    document.getElementById(id)?.addEventListener('input', () => pedirPrecioSugerido(false));
  });
  ['prodCondicion', 'prodCategoriaWeb', 'popFotosCategoria', 'popFotosSubcategoria', 'prodEsServicio', 'prodStockIlimitado'].forEach(id => {
    document.getElementById(id)?.addEventListener('change', () => pedirPrecioSugerido(false));
  });

  caja.addEventListener('click', (e) => {
    const precio = e.target.closest('[data-usar-precio-sugerido]');
    if (precio) {
      const el = document.getElementById('prodPrecio');
      if (el) { el.value = precio.dataset.usarPrecioSugerido; el.dispatchEvent(new Event('input', { bubbles: true })); }
      showToast(`Precio puesto en ${fmtCLP(Number(precio.dataset.usarPrecioSugerido))}: revísalo y guarda`, 'ok');
      return;
    }
    const mayorista = e.target.closest('[data-usar-mayorista-sugerido]');
    if (mayorista) {
      const elPrecio = document.getElementById('prodPrecioMayorista');
      const elDesde = document.getElementById('prodMayoristaDesde');
      if (elDesde) elDesde.value = mayorista.dataset.desde;
      if (elPrecio) { elPrecio.value = mayorista.dataset.usarMayoristaSugerido; elPrecio.dispatchEvent(new Event('input', { bubbles: true })); }
      showToast(`Mayorista puesto en ${fmtCLP(Number(mayorista.dataset.usarMayoristaSugerido))} desde ${mayorista.dataset.desde} u.: revísalo y guarda`, 'ok');
    }
  });
});
