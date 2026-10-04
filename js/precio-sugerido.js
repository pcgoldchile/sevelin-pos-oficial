// ==========================================
// PRECIO-SUGERIDO.JS - Margen en vivo y precios sugeridos (v109, pendiente #54; v121)
// ------------------------------------------
// Al escribir el costo en el editor de producto, propone el precio que cumple
// el margen objetivo de su familia (terminado en 990), su precio mayorista y,
// desde v121, el segundo escalón mayorista. Además muestra en vivo cuánto
// margen deja cada precio escrito.
// La regla vive en el servidor (POST /api/productos/precio-sugerido): acá solo
// se muestra. Nunca cambia un precio solo: cada sugerencia trae su botón "Usar".
// No es un modelo de lenguaje adivinando: sale de la tabla de márgenes que
// aprobó el dueño, de la mediana de la categoría y del costo real.
// ==========================================

let precioSugeridoTemporizador = null;
let precioSugeridoPeticion = 0;

const pctSugerido = (n) => `${String(n).replace('.', ',')}%`;

/* El costo con el que se calcula todo: el de la ficha y, si está en $0 (un
   producto nuevo, o uno que nunca lo tuvo), el de la compra que se está
   escribiendo. Así el margen y las sugerencias aparecen desde la primera compra. */
function costoEnEdicion() {
  const ficha = Number(document.getElementById('prodCosto')?.value) || 0;
  if (ficha > 0) return { costo: ficha, deCompra: false };
  const compra = Number(document.getElementById('ingCosto')?.value) || 0;
  return { costo: compra, deCompra: compra > 0 };
}

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
    costo: costoEnEdicion().costo,
    precio_actual: Number(val('prodPrecio')) || 0,
    mayorista_actual: Number(val('prodPrecioMayorista')) || 0,
    mayorista_desde_actual: Number(val('prodMayoristaDesde')) || 0,
    categoria_web: categoria.categoria_web || '',
    subcategoria_web: categoria.subcategoria_web || '',
    condicion: val('prodCondicion'),
    es_servicio: !!document.getElementById('prodEsServicio')?.checked || !!document.getElementById('prodStockIlimitado')?.checked,
    producto_id: typeof editingProductId !== 'undefined' ? (editingProductId || null) : null
  };
}

/* ---------- Margen en vivo (v121) ----------
   Pedido del dueño (04-10-2026): "visibilizar cuánto margen estoy poniendo
   en tiempo real al crear o editar". Misma cuenta y mismos colores que la
   lista de Productos (lineaMargen en js/productos.js): margen = (precio −
   costo) / precio, con el MAYOR costo conocido del producto. */
function pintarMargenVivo() {
  const caja = document.getElementById('prodMargenVivo');
  if (!caja || !esAdmin() || typeof lineaMargen !== 'function') return;
  const val = (id) => Number(document.getElementById(id)?.value) || 0;
  if (document.getElementById('prodStockIlimitado')?.checked && !val('prodCosto')) { caja.innerHTML = ''; return; }

  const { costo: escrito, deCompra } = costoEnEdicion();
  const id = typeof editingProductId !== 'undefined' ? editingProductId : null;
  const referencia = id && typeof costosReferenciaProductos !== 'undefined' ? (Number(costosReferenciaProductos?.[id]) || 0) : 0;
  const costo = Math.max(escrito, referencia);
  const precio = val('prodPrecio');

  if (!(costo > 0)) {
    caja.innerHTML = precio > 0 ? '<span class="margen-vivo-nota">Escribe el costo (arriba o en la compra) para ver cuánto margen deja este precio.</span>' : '';
    return;
  }
  if (!(precio > 0)) {
    caja.innerHTML = `<span class="margen-vivo-nota">Con un costo de ${fmtCLP(costo)}: escribe el precio para ver el margen.</span>`;
    return;
  }

  const lineas = [lineaMargen('Al detalle', precio, costo)];
  const web = val('prodPrecioWeb');
  if (web > 0 && web !== precio) lineas.push(lineaMargen('En la web', web, costo));
  const m1 = val('prodPrecioMayorista');
  if (m1 > 0) lineas.push(lineaMargen(`Por mayor ×${val('prodMayoristaDesde') || ''}`, m1, costo));
  const m2 = val('prodPrecioMayorista2');
  if (m1 > 0 && m2 > 0) lineas.push(lineaMargen(`Por mayor ×${val('prodMayoristaDesde2') || ''}`, m2, costo));
  const oferta = val('prodPrecioOfertaWeb');
  if (oferta > 0) lineas.push(lineaMargen('Oferta web', oferta, costo));

  const notas = [];
  if (precio <= costo) notas.push('⚠️ El precio no cubre el costo: cada venta deja pérdida.');
  if (referencia > escrito) notas.push(`Se usa ${fmtCLP(costo)}, el mayor costo conocido (una compra o un lote salió más caro que ${fmtCLP(escrito)}).`);
  else if (deCompra) notas.push('Con el costo de la compra que estás escribiendo (la ficha todavía no tiene costo).');
  notas.push('Margen = lo que queda del precio después del costo, los dos con IVA.');
  caja.innerHTML = lineas.join('') + `<span class="margen-vivo-nota">${escHtml(notas.join(' '))}</span>`;
}

/* Se llama al escribir el costo o el precio, y al cambiar categoría o condición. */
function pedirPrecioSugerido(inmediato) {
  pintarMargenVivo();
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
  const pendientes = [];   // lo que "Usar todo" aplicaría
  let precio;
  if (actual === r.precio) {
    precio = `✔ El precio actual (${fmtCLP(actual)}) es el sugerido: deja ${pctSugerido(r.margen_pct)}.`;
  } else if (actual > r.precio) {
    precio = `✔ El precio actual (${fmtCLP(actual)}) está sobre el sugerido (<strong>${fmtCLP(r.precio)}</strong>): cumple el margen objetivo.`;
  } else {
    pendientes.push('precio');
    precio = `Precio al detalle sugerido: <strong>${fmtCLP(r.precio)}</strong> (deja ${pctSugerido(r.margen_pct)})`
      + (actual > 0 ? `; hoy está en ${fmtCLP(actual)}.` : '.')
      + ` <button type="button" class="btn btn-ghost btn-sm" data-usar-precio-sugerido="${Number(r.precio)}">Usar ${fmtCLP(r.precio)}</button>`;
  }

  const m = r.mayorista;
  const mayoristaActual = datos.mayorista_actual;
  let mayorista;
  if (!m) {
    mayorista = `Mayorista: ${escHtml(r.mayorista_motivo || 'no cabe una rebaja real')}.`;
  } else if (mayoristaActual === m.precio) {
    mayorista = `✔ El mayorista actual (${fmtCLP(mayoristaActual)}) es el sugerido.`;
  } else {
    if (!mayoristaActual) pendientes.push('mayorista');
    mayorista = `Mayorista sugerido: <strong>${fmtCLP(m.precio)}</strong> desde ${Number(m.desde)} u. `
      + `(−${pctSugerido(m.rebaja_pct)} de ${fmtCLP(m.sobre_precio)}, deja ${pctSugerido(m.margen_pct)})`
      + (mayoristaActual > 0 ? `; hoy está en ${fmtCLP(mayoristaActual)}.` : '.')
      + ` <button type="button" class="btn btn-ghost btn-sm" data-usar-mayorista-sugerido="${Number(m.precio)}" data-desde="${Number(m.desde)}">Usar ${fmtCLP(m.precio)}</button>`;
  }

  // v121: segundo escalón (el doble de unidades, cerca de 7% más barato, nunca bajo 23% de margen)
  const m2 = r.mayorista_2;
  const mayorista2Actual = Number(document.getElementById('prodPrecioMayorista2')?.value) || 0;
  let mayorista2;
  if (!m2) {
    mayorista2 = `Segundo mayorista: ${escHtml(r.mayorista_2_motivo || 'no cabe otra rebaja')}.`;
  } else if (mayorista2Actual === m2.precio) {
    mayorista2 = `✔ El segundo mayorista actual (${fmtCLP(mayorista2Actual)}) es el sugerido.`;
  } else {
    if (!mayorista2Actual) pendientes.push('mayorista2');
    mayorista2 = `Segundo mayorista sugerido: <strong>${fmtCLP(m2.precio)}</strong> desde ${Number(m2.desde)} u. `
      + `(−${pctSugerido(m2.rebaja_pct)} de ${fmtCLP(m2.sobre_precio)}, deja ${pctSugerido(m2.margen_pct)})`
      + (mayorista2Actual > 0 ? `; hoy está en ${fmtCLP(mayorista2Actual)}.` : '.')
      + ` <button type="button" class="btn btn-ghost btn-sm" data-usar-mayorista2-sugerido="${Number(m2.precio)}" data-desde="${Number(m2.desde)}">Usar ${fmtCLP(m2.precio)}</button>`;
  }

  caja.innerHTML = `
    <p class="precio-sugerido-titulo">💡 <strong>Precios sugeridos</strong> · margen objetivo de <strong>${escHtml(r.familia)}</strong>: ${pctSugerido(r.margen_objetivo_pct)}
      <small>(${escHtml(r.origen)})</small>${escHtml(costoNota)}</p>
    <p>${precio}</p>
    <p>${mayorista}</p>
    <p>${mayorista2}</p>
    ${pendientes.length >= 2 ? '<p><button type="button" class="btn btn-outline btn-sm" data-usar-todo-sugerido="1">Usar todo lo sugerido</button></p>' : ''}
    <p class="precio-sugerido-nota">Sale de tu margen objetivo y de tus costos reales, no de precios del mercado: compáralo antes de usarlo. Nada cambia hasta que guardes.</p>`;
}

/* Pone un valor en un campo y avisa a lo que lo escucha (margen en vivo, validaciones). */
function ponerValorSugerido(id, valor) {
  const el = document.getElementById(id);
  if (!el) return;
  el.value = valor;
  el.dispatchEvent(new Event('input', { bubbles: true }));
}

document.addEventListener('DOMContentLoaded', () => {
  const caja = document.getElementById('prodPrecioSugerido');
  if (!caja) return;

  // Lo que cambia la sugerencia: costo (de la ficha o de la compra), precio, mayorista, categoría, condición y si es servicio
  ['prodCosto', 'prodPrecio', 'prodPrecioMayorista', 'prodMayoristaDesde', 'ingCosto'].forEach(id => {
    document.getElementById(id)?.addEventListener('input', () => pedirPrecioSugerido(false));
  });
  ['prodCondicion', 'prodCategoriaWeb', 'popFotosCategoria', 'popFotosSubcategoria', 'prodEsServicio', 'prodStockIlimitado'].forEach(id => {
    document.getElementById(id)?.addEventListener('change', () => pedirPrecioSugerido(false));
  });
  // Lo que solo mueve el margen en vivo
  ['prodPrecioMayorista2', 'prodMayoristaDesde2', 'prodPrecioWeb', 'prodPrecioOfertaWeb'].forEach(id => {
    document.getElementById(id)?.addEventListener('input', pintarMargenVivo);
  });

  caja.addEventListener('click', (e) => {
    const precio = e.target.closest('[data-usar-precio-sugerido]');
    if (precio) {
      ponerValorSugerido('prodPrecio', precio.dataset.usarPrecioSugerido);
      showToast(`Precio puesto en ${fmtCLP(Number(precio.dataset.usarPrecioSugerido))}: revísalo y guarda`, 'ok');
      return;
    }
    const mayorista = e.target.closest('[data-usar-mayorista-sugerido]');
    if (mayorista) {
      const elDesde = document.getElementById('prodMayoristaDesde');
      if (elDesde) elDesde.value = mayorista.dataset.desde;
      ponerValorSugerido('prodPrecioMayorista', mayorista.dataset.usarMayoristaSugerido);
      showToast(`Mayorista puesto en ${fmtCLP(Number(mayorista.dataset.usarMayoristaSugerido))} desde ${mayorista.dataset.desde} u.: revísalo y guarda`, 'ok');
      return;
    }
    const mayorista2 = e.target.closest('[data-usar-mayorista2-sugerido]');
    if (mayorista2) {
      if (!(Number(document.getElementById('prodPrecioMayorista')?.value) > 0)) {
        showToast('Primero usa (o escribe) el primer precio mayorista', 'err');
        return;
      }
      const elDesde = document.getElementById('prodMayoristaDesde2');
      if (elDesde) elDesde.value = mayorista2.dataset.desde;
      ponerValorSugerido('prodPrecioMayorista2', mayorista2.dataset.usarMayorista2Sugerido);
      showToast(`Segundo mayorista puesto en ${fmtCLP(Number(mayorista2.dataset.usarMayorista2Sugerido))} desde ${mayorista2.dataset.desde} u.: revísalo y guarda`, 'ok');
      return;
    }
    if (e.target.closest('[data-usar-todo-sugerido]')) {
      // En orden: el precio al detalle, después el primer escalón y al final el segundo.
      const p = caja.querySelector('[data-usar-precio-sugerido]');
      if (p) ponerValorSugerido('prodPrecio', p.dataset.usarPrecioSugerido);
      const m1 = caja.querySelector('[data-usar-mayorista-sugerido]');
      if (m1 && !(Number(document.getElementById('prodPrecioMayorista')?.value) > 0)) {
        const d = document.getElementById('prodMayoristaDesde'); if (d) d.value = m1.dataset.desde;
        ponerValorSugerido('prodPrecioMayorista', m1.dataset.usarMayoristaSugerido);
      }
      const m2 = caja.querySelector('[data-usar-mayorista2-sugerido]');
      if (m2 && Number(document.getElementById('prodPrecioMayorista')?.value) > 0 && !(Number(document.getElementById('prodPrecioMayorista2')?.value) > 0)) {
        const d = document.getElementById('prodMayoristaDesde2'); if (d) d.value = m2.dataset.desde;
        ponerValorSugerido('prodPrecioMayorista2', m2.dataset.usarMayorista2Sugerido);
      }
      showToast('Puse los precios sugeridos: revísalos y guarda', 'ok');
    }
  });
});
