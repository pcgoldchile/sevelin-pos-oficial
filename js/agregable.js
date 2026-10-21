/* ============================================================
   "➕ AGREGABLE" (v173, sql/110, dueño 21-10-2026)
   ------------------------------------------------------------
   "Quiero una opción (opcional y que me pregunte con la IA) de agregar un
   adaptador HDMI a VGA en los monitores que no tengan HDMI nativo… en el
   texto de la tienda, Facebook, y un botón de agregar en la misma página."

   UN accesorio opcional por producto. En sevelin.cl sale como casilla en el
   cuadro de compra (y una línea en la descripción); en Facebook e Instagram
   como bloque "➕ OPCIONAL" con el precio del día (js/redes-texto.js).

   La pregunta: si el producto es un monitor y sus "Entradas de video"
   (marcadas a mano o con "✨ Rellenar con IA" en Filtros de la tienda) no
   tienen HDMI, la tarjeta pregunta si ofrecer el adaptador que sirve. Nunca
   lo pone sola: se agrega con su "Sí". Un "No" no vuelve a preguntar en ese
   producto (se recuerda en este navegador).

   Se guarda al instante por su propia ruta (PUT /api/productos/:id/agregable),
   como "Complementa tu compra". Va después de complementos.js y
   caracteristicas-producto.js (usa caracteristicasEnEdicion y
   resolverCategoriaWebYSubcategoria).
   ============================================================ */

let agregableProductoId = null;     // producto abierto en el editor
let agregableIdActual = null;       // el accesorio elegido (id) o null
let agregableMotivoActual = '';
let guardandoAgregable = false;

/* Qué adaptador sirve según las entradas del monitor. Solo cuando NO tiene HDMI.
   `buscar` reconoce el producto por su nombre en el catálogo (sin ids fijos). */
const AGREGABLE_REGLAS_MONITOR = [
  {
    entrada: 'VGA',
    buscar: /\bhdmi\b.*\ba\b.*\bvga\b/i,
    descartar: /\bvga\b.*\ba\b.*\bhdmi\b/i,   // el "VGA a HDMI" va al revés: sirve para un PC viejo y una tele
    motivo: 'Para conectarlo a un PC o notebook que solo tiene salida HDMI.'
  },
  {
    entrada: 'DVI',
    buscar: /\bdvi\b.*\ba\b.*\bhdmi\b|\bhdmi\b.*\ba\b.*\bdvi\b/i,
    descartar: null,
    motivo: 'Para conectarlo con un cable HDMI a un PC o notebook con salida HDMI.'
  }
];

function agregableProductoPorId(id) {
  return (typeof productsList !== 'undefined' ? productsList : []).find(p => Number(p.id) === Number(id)) || null;
}

function agregableTieneStock(p) {
  return !!p && !p.archivado && (p.stock_ilimitado || Number(p.stock) > 0);
}

/* Lo que va en el texto de redes armado desde el formulario (productoDelFormularioParaRedes). */
function agregableDeLaFicha() {
  return { agregable_id: agregableIdActual, agregable_motivo: agregableMotivoActual };
}

/* Las entradas marcadas en "Filtros de la tienda"; si no hay ninguna, lo que diga el texto. */
function agregableEntradasDelMonitor() {
  const marcadas = (typeof caracteristicasEnEdicion !== 'undefined' && Array.isArray(caracteristicasEnEdicion?.entradas))
    ? caracteristicasEnEdicion.entradas : [];
  if (marcadas.length) return { entradas: marcadas, deTexto: false };
  const texto = `${document.getElementById('prodNombre')?.value || ''} ${document.getElementById('prodDescripcion')?.value || ''}`
    .replace(/<[^>]+>/g, ' ');
  const hay = [];
  if (/\bhdmi\b/i.test(texto)) hay.push('HDMI');
  if (/\bvga\b|d-?sub/i.test(texto)) hay.push('VGA');
  if (/\bdvi\b/i.test(texto)) hay.push('DVI');
  if (/displayport|\bdp\b/i.test(texto)) hay.push('DisplayPort');
  if (/usb[\s-]?c\b|tipo[\s-]?c\b/i.test(texto)) hay.push('USB-C');
  return { entradas: hay, deTexto: true };
}

/* La sugerencia para el producto abierto, o null. */
function agregableSugerido() {
  if (!agregableProductoId || agregableIdActual) return null;
  const categoria = typeof resolverCategoriaWebYSubcategoria === 'function' ? resolverCategoriaWebYSubcategoria() : {};
  if (String(categoria.categoria_web || '').trim() !== 'Monitores') return null;
  const { entradas, deTexto } = agregableEntradasDelMonitor();
  if (!entradas.length || entradas.includes('HDMI')) return null;

  for (const regla of AGREGABLE_REGLAS_MONITOR) {
    if (!entradas.includes(regla.entrada)) continue;
    const candidatos = (typeof productsList !== 'undefined' ? productsList : [])
      .filter(p => Number(p.id) !== Number(agregableProductoId) && !p.es_servicio && agregableTieneStock(p))
      .filter(p => regla.buscar.test(p.nombre || '') && !(regla.descartar && regla.descartar.test(p.nombre || '')))
      // Primero el adaptador (no el cable), luego el publicado, luego el que tiene más stock
      .sort((a, b) => (Number(/cable/i.test(a.nombre)) - Number(/cable/i.test(b.nombre)))
        || (Number(!!b.publicado_web) - Number(!!a.publicado_web))
        || (Number(b.stock) - Number(a.stock)));
    if (candidatos.length) return { producto: candidatos[0], motivo: regla.motivo, entradas, deTexto };
  }
  return null;
}

function agregableClaveNo(id) { return `sevelin-agregable-no-${id}`; }
function agregableYaDijoNo(id) {
  try { return localStorage.getItem(agregableClaveNo(id)) === '1'; } catch (_) { return false; }
}

/* La llama abrirModalProducto() (js/productos.js) al abrir el editor. */
function pintarAgregableProducto(producto) {
  agregableProductoId = producto?.id || null;
  agregableIdActual = Number(producto?.agregable_id) || null;
  agregableMotivoActual = String(producto?.agregable_motivo || '');
  const buscar = document.getElementById('prodAgregableBuscar');
  if (buscar) { buscar.value = ''; buscar.disabled = !agregableProductoId; }
  const sug = document.getElementById('prodAgregableSugerencias');
  if (sug) sug.innerHTML = '';
  pintarTarjetaAgregable();
}

function pintarTarjetaAgregable() {
  const cont = document.getElementById('prodAgregableActual');
  const campoMotivo = document.getElementById('prodAgregableMotivoCampo');
  const motivo = document.getElementById('prodAgregableMotivo');
  const etiqueta = document.getElementById('prodAgregableBuscarEtiqueta');
  const resumen = document.getElementById('prodAgregableResumen');
  if (!cont) return;
  agregableRevisarPregunta();

  if (!agregableProductoId) {
    cont.innerHTML = '<p class="modal-hint">Guarda el producto primero para elegir su agregable.</p>';
    if (campoMotivo) campoMotivo.hidden = true;
    if (resumen) resumen.textContent = '';
    return;
  }
  if (!agregableIdActual) {
    cont.innerHTML = '<p class="modal-hint">Sin agregable: en la tienda no sale la casilla.</p>';
    if (campoMotivo) campoMotivo.hidden = true;
    if (etiqueta) etiqueta.textContent = 'Elegir accesorio';
    if (resumen) resumen.textContent = '';
    return;
  }
  const p = agregableProductoPorId(agregableIdActual);
  const avisos = [];
  if (!p) avisos.push('no encontrado');
  else {
    if (p.archivado) avisos.push('archivado');
    if (!p.publicado_web) avisos.push('no publicado: no sale en la tienda');
    if (!p.stock_ilimitado && Number(p.stock) <= 0) avisos.push('sin stock: no sale en la tienda ni en el texto');
  }
  cont.innerHTML = `
    <div class="complemento-fila">
      <span class="complemento-pos">➕</span>
      <div class="complemento-datos">
        <strong>${escHtml(p ? p.nombre : `Producto #${agregableIdActual}`)}</strong>
        ${p ? `<small>${fmtCLP(p.precio_unitario)} · ${p.stock_ilimitado ? 'sin límite' : `${Number(p.stock) || 0} en stock`}${avisos.length ? ` · <span class="complemento-aviso">⚠️ ${escHtml(avisos.join(', '))}</span>` : ''}</small>` : ''}
      </div>
      <div class="complemento-acciones">
        <button type="button" class="btn btn-sm btn-ghost" data-agregable-quitar title="Quitar el agregable">✕</button>
      </div>
    </div>`;
  if (campoMotivo) campoMotivo.hidden = false;
  if (motivo && document.activeElement !== motivo) motivo.value = agregableMotivoActual;
  if (etiqueta) etiqueta.textContent = 'Cambiar por otro accesorio';
  if (resumen) resumen.textContent = p ? `Hoy: ${p.nombre}` : '';
}

/* La pregunta "¿ofrecer el adaptador?". Se rehace al abrir la ficha, al cambiar las
   entradas de video y después de "✨ Rellenar con IA". */
function agregableRevisarPregunta() {
  const caja = document.getElementById('prodAgregablePregunta');
  if (!caja) return;
  const s = agregableSugerido();
  if (!s || agregableYaDijoNo(agregableProductoId)) { caja.innerHTML = ''; return; }
  const sinHdmi = s.entradas.filter(e => e !== 'HDMI').join(', ');
  caja.innerHTML = `
    <div class="agregable-pregunta">
      <p>💡 <strong>Este monitor no tiene entrada HDMI</strong> (${s.deTexto ? 'según el nombre y la descripción' : 'según los filtros'}: ${escHtml(sinHdmi)}).
        ¿Ofrecer <strong>${escHtml(s.producto.nombre)}</strong> (${fmtCLP(s.producto.precio_unitario)}${s.producto.stock_ilimitado ? '' : ` · ${Number(s.producto.stock) || 0} en stock`}) como agregable?</p>
      <p class="modal-hint" style="margin:4px 0 8px;">Sale como casilla junto al botón de compra en sevelin.cl y como "➕ OPCIONAL" en el texto de Facebook e Instagram.</p>
      <div style="display:flex; gap:8px; flex-wrap:wrap;">
        <button type="button" class="btn btn-primary btn-sm" data-agregable-si="${Number(s.producto.id)}">Sí, agregarlo</button>
        <button type="button" class="btn btn-ghost btn-sm" data-agregable-no>No, gracias</button>
      </div>
    </div>`;
  caja.querySelector('[data-agregable-si]').dataset.motivo = s.motivo;
  // Que se vea: si la tarjeta estaba plegada, se abre
  document.querySelector('#view-producto-editor [data-seccion="agregable"]')?.classList.remove('plegada');
}

function pintarBusquedaAgregable() {
  const cont = document.getElementById('prodAgregableSugerencias');
  const texto = (document.getElementById('prodAgregableBuscar')?.value || '').trim().toLowerCase();
  if (!cont) return;
  if (texto.length < 2 || !agregableProductoId) { cont.innerHTML = ''; return; }
  const palabras = texto.split(/\s+/);
  const candidatos = (typeof productsList !== 'undefined' ? productsList : [])
    .filter(p => !p.archivado && !p.es_servicio && Number(p.id) !== Number(agregableProductoId) && Number(p.id) !== Number(agregableIdActual))
    .filter(p => palabras.every(w => `${p.nombre || ''} ${p.sku || ''}`.toLowerCase().includes(w)))
    .sort((a, b) => (Number(agregableTieneStock(b)) - Number(agregableTieneStock(a)))
      || (Number(!!b.publicado_web) - Number(!!a.publicado_web)) || String(a.nombre).localeCompare(String(b.nombre)))
    .slice(0, 8);
  cont.innerHTML = candidatos.length
    ? candidatos.map(p => `
        <button type="button" class="complemento-sugerencia" data-agregable-elegir="${Number(p.id)}">
          ➕ ${escHtml(p.nombre)} <small>${fmtCLP(p.precio_unitario)}${p.publicado_web ? '' : ' · no publicado'}${agregableTieneStock(p) ? '' : ' · sin stock'}</small>
        </button>`).join('')
    : '<p class="modal-hint">Ningún producto coincide.</p>';
}

/* Guarda en el servidor y deja el texto de Facebook e Instagram con el bloque nuevo
   (o sin él): en la ficha y también en lo guardado, para que coincidan. */
async function guardarAgregable(id, motivo) {
  if (!agregableProductoId || guardandoAgregable) return;
  guardandoAgregable = true;
  const productoId = agregableProductoId;
  try {
    const r = await API.productos.guardarAgregable(productoId, id || null, id ? (motivo || '') : '');
    if (productoId !== agregableProductoId) return;   // se abrió otro producto mientras tanto
    agregableIdActual = Number(r?.agregable_id) || null;
    agregableMotivoActual = String(r?.agregable_motivo || '');
    const local = agregableProductoPorId(productoId);
    if (local) { local.agregable_id = agregableIdActual; local.agregable_motivo = agregableMotivoActual || null; }
    pintarTarjetaAgregable();
    await agregableActualizarTextosDeRedes(productoId, local);
    showToast(agregableIdActual ? 'Agregable guardado: ya sale en la tienda y en el texto de redes' : 'Agregable quitado', 'ok');
  } catch (err) {
    showToast(err.message || 'No se pudo guardar el agregable', 'err');
  } finally {
    guardandoAgregable = false;
  }
}

async function agregableActualizarTextosDeRedes(productoId, local) {
  if (typeof conAgregableParaRedes !== 'function') return;
  const datos = { ...(local || {}), agregable_id: agregableIdActual, agregable_motivo: agregableMotivoActual };
  // En la ficha abierta: así "Guardar Producto" no vuelve a escribir el texto viejo
  const cajaFb = typeof elProdFacebookTexto !== 'undefined' ? elProdFacebookTexto : document.getElementById('prodFacebookTexto');
  const cajaIg = typeof elProdInstagramTexto !== 'undefined' ? elProdInstagramTexto : document.getElementById('prodInstagramTexto');
  if (cajaFb && cajaFb.value.trim()) cajaFb.value = conAgregableParaRedes(cajaFb.value, datos);
  if (cajaIg && cajaIg.value.trim()) cajaIg.value = conAgregableParaRedes(cajaIg.value, datos);
  // Y en lo guardado, si ya había texto
  if (!local) return;
  const cambios = {};
  const fb = conAgregableParaRedes(local.facebook_texto || '', datos);
  const ig = conAgregableParaRedes(local.instagram_texto || '', datos);
  if ((local.facebook_texto || '') && fb !== local.facebook_texto) cambios.texto = fb;
  if ((local.instagram_texto || '') && ig !== local.instagram_texto && ig.length <= 2200) cambios.instagram = ig;
  if (!Object.keys(cambios).length) return;
  try {
    const r = await API.productos.guardarFacebook(productoId, cambios);
    if (r && typeof r === 'object') Object.assign(local, r);
  } catch (err) {
    showToast('El agregable quedó guardado, pero no se pudo actualizar el texto de redes: ' + (err.message || ''), 'err');
  }
}

document.addEventListener('DOMContentLoaded', () => {
  const buscar = document.getElementById('prodAgregableBuscar');
  buscar?.addEventListener('input', pintarBusquedaAgregable);
  buscar?.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter') return;
    e.preventDefault();   // Enter no debe enviar el formulario del producto
    document.querySelector('#prodAgregableSugerencias [data-agregable-elegir]')?.click();
  });
  document.getElementById('prodAgregableSugerencias')?.addEventListener('click', (e) => {
    const b = e.target.closest('[data-agregable-elegir]');
    if (!b) return;
    if (buscar) buscar.value = '';
    document.getElementById('prodAgregableSugerencias').innerHTML = '';
    guardarAgregable(Number(b.dataset.agregableElegir), agregableMotivoActual);
  });
  document.getElementById('prodAgregableActual')?.addEventListener('click', (e) => {
    if (e.target.closest('[data-agregable-quitar]')) guardarAgregable(null, '');
  });
  document.getElementById('prodAgregablePregunta')?.addEventListener('click', (e) => {
    const si = e.target.closest('[data-agregable-si]');
    if (si) { guardarAgregable(Number(si.dataset.agregableSi), si.dataset.motivo || ''); return; }
    if (e.target.closest('[data-agregable-no]')) {
      try { localStorage.setItem(agregableClaveNo(agregableProductoId), '1'); } catch (_) { /* sin almacenamiento: solo se oculta */ }
      document.getElementById('prodAgregablePregunta').innerHTML = '';
    }
  });
  const motivo = document.getElementById('prodAgregableMotivo');
  const guardarMotivo = () => {
    const nuevo = (motivo?.value || '').replace(/\s+/g, ' ').trim();
    if (!agregableIdActual || nuevo === agregableMotivoActual) return;
    guardarAgregable(agregableIdActual, nuevo);
  };
  document.getElementById('btnAgregableGuardarMotivo')?.addEventListener('click', guardarMotivo);
  motivo?.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); guardarMotivo(); } });
  // Cambiar las entradas de video o la descripción puede hacer aparecer (o quitar) la pregunta
  document.getElementById('prodCaracteristicas')?.addEventListener('change', () => setTimeout(agregableRevisarPregunta, 0));
  document.getElementById('prodDescripcion')?.addEventListener('change', agregableRevisarPregunta);
});
