// ==========================================
// BODEGA.JS — Productos → "📦 Más stock y bodega" (sql/101, v156)
// ------------------------------------------
// Pedido del dueño (16-10-2026): "ver los productos que más stock tienen, y
// una sugerencia para ir guardando las cosas en los cajones y qué cosas
// pueden ir en caja […] solamente propuesta, yo tengo la palabra final".
//
// La lista viene ordenada por stock. Cada producto muestra dónde está hoy
// (puede estar en varias repisas) y la propuesta de Claude. "✅ Guardar ahí"
// AGREGA ese lugar al producto (nunca le saca uno que ya tenía); "✕ No" la
// descarta. Nada se guarda solo.
// ==========================================

let bodegaStockDatos = null;
let bodegaStockFiltro = 'unidades';   // unidades | plata | sin_lugar | propuestas

const BODEGA_GUIA_MUEBLES = [
  ['A', 'Cargadores y cables de carga'],
  ['B', 'Cables y adaptadores (video, red, poder, audio, USB)'],
  ['C', 'Almacenamiento, memorias y piezas chicas de PC'],
  ['D', 'Periféricos (mouse, teclados, joysticks, cámaras web)'],
  ['E', 'Audio y energía (audífonos, parlantes, power banks, pilas)'],
  ['F', 'Celulares, accesorios de auto y TV, herramientas (F1, F2 y F5 libres: repuestos de celular)'],
  ['G', 'Hogar chico y oficina'],
  ['H', 'Computación grande (monitores, PCs, gabinetes, fuentes)'],
  ['I', 'Hogar voluminoso; I5 = "por ordenar"'],
];

document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('btnBodegaStock')?.addEventListener('click', abrirBodegaStock);
  document.getElementById('btnCerrarBodegaStock')?.addEventListener('click', () => cerrarModal('modalBodegaStock'));
  document.getElementById('bodegaStockBuscar')?.addEventListener('input', pintarBodegaStock);
  document.getElementById('bodegaStockFiltros')?.addEventListener('click', (e) => {
    const chip = e.target.closest('[data-bodega-filtro]');
    if (!chip) return;
    bodegaStockFiltro = chip.dataset.bodegaFiltro;
    pintarBodegaStock();
  });
  document.getElementById('bodegaStockLista')?.addEventListener('click', (e) => {
    const si = e.target.closest('[data-bodega-aceptar]');
    if (si) { decidirPropuestaBodega(Number(si.dataset.bodegaAceptar), true, si); return; }
    const no = e.target.closest('[data-bodega-descartar]');
    if (no) decidirPropuestaBodega(Number(no.dataset.bodegaDescartar), false, no);
  });
  const guia = document.getElementById('bodegaStockGuia');
  if (guia) {
    guia.innerHTML = `
      <p>Cada letra es un mueble y cada número una repisa, <b>contando de abajo hacia arriba</b> (A1 = abajo del mueble A).
        Supuesto: los muebles van de la A a la I de izquierda a derecha y el A es el más cercano al mesón.</p>
      <ul>${BODEGA_GUIA_MUEBLES.map(([l, t]) => `<li><b>${l}</b>: ${escHtml(t)}</li>`).join('')}</ul>
      <p><b>Repisa 1:</b> lo pesado o grande. <b>Repisa 3:</b> lo que más se vende, a la altura de la vista.
        <b>Repisa 2:</b> la reserva del que tiene mucho stock. <b>Repisa 5:</b> lo liviano y voluminoso.</p>
      <p><b>📦 Caja:</b> lo chico o suelto (pendrives, pilas, adaptadores, cables, tornillos) va en una caja rotulada dentro de
        la repisa. Al aceptar, la caja queda creada como lugar, por ejemplo "Caja Pilas · E3".</p>
      <p>Si una repisa se llena, sigue en la de al lado o en la de arriba o abajo: agrega ese otro lugar al producto (desde la
        ficha o la app del taller). Un producto puede estar en varios lugares; el primero es "donde se busca primero".</p>`;
  }
});

async function abrirBodegaStock() {
  bodegaStockFiltro = 'unidades';
  const buscar = document.getElementById('bodegaStockBuscar');
  if (buscar) buscar.value = '';
  document.getElementById('modalBodegaStock')?.classList.add('show');
  const cuerpo = document.getElementById('bodegaStockLista');
  if (cuerpo) cuerpo.innerHTML = '<tr class="empty-row"><td colspan="7">Cargando…</td></tr>';
  try {
    bodegaStockDatos = await API.bodega.stock();
  } catch (err) {
    if (cuerpo) cuerpo.innerHTML = `<tr class="empty-row"><td colspan="7">${escHtml(err.message || 'No se pudo cargar la bodega')}</td></tr>`;
    return;
  }
  pintarBodegaStock();
}

function textoPropuestaBodega(p) {
  return p.caja ? `📦 Caja "${p.caja}" en ${p.lugar}` : p.lugar;
}

function pintarBodegaStock() {
  const d = bodegaStockDatos;
  const cuerpo = document.getElementById('bodegaStockLista');
  if (!d || !cuerpo) return;
  const r = d.resumen || {};
  const elResumen = document.getElementById('bodegaStockResumen');
  if (elResumen) {
    elResumen.textContent = `${r.productos} productos con stock · ${r.unidades} unidades · ${fmtCLP(r.valor)} guardados al costo · `
      + `${r.sin_lugar} sin lugar · ${r.propuestas_pendientes} propuestas por decidir`;
  }
  const filtros = document.getElementById('bodegaStockFiltros');
  if (filtros) {
    const chips = [['unidades', 'Más unidades'], ['plata', 'Más plata guardada'], ['sin_lugar', `Sin lugar (${r.sin_lugar})`], ['propuestas', `Propuestas por decidir (${r.propuestas_pendientes})`]];
    filtros.innerHTML = chips.map(([k, t]) => `<button type="button" class="chip ${bodegaStockFiltro === k ? 'active' : ''}" data-bodega-filtro="${k}">${escHtml(t)}</button>`).join('');
  }

  const palabras = (document.getElementById('bodegaStockBuscar')?.value || '').toLowerCase().split(/\s+/).filter(Boolean);
  let lista = (d.productos || []).filter(p => {
    if (bodegaStockFiltro === 'sin_lugar' && p.lugares.length) return false;
    if (bodegaStockFiltro === 'propuestas' && p.propuesta?.estado !== 'pendiente') return false;
    if (!palabras.length) return true;
    const texto = `${p.nombre} ${p.categoria} ${p.lugares.map(l => l.nombre).join(' ')} ${p.propuesta ? textoPropuestaBodega(p.propuesta) : ''}`.toLowerCase();
    return palabras.every(w => texto.includes(w));
  });
  lista = [...lista].sort(bodegaStockFiltro === 'plata' ? (a, b) => b.valor - a.valor : (a, b) => b.stock - a.stock);

  if (!lista.length) {
    cuerpo.innerHTML = '<tr class="empty-row"><td colspan="7">Ningún producto calza con eso.</td></tr>';
    return;
  }
  cuerpo.innerHTML = lista.map(p => {
    const hoy = p.lugares.length
      ? p.lugares.map(l => `<span class="bodega-lugar${l.principal ? ' principal' : ''}" title="${l.principal ? 'Se busca primero aquí' : ''}">${escHtml(l.nombre)}</span>`).join(' ')
      : '<span class="bodega-sin-lugar">Sin lugar</span>';
    const prop = p.propuesta;
    let celdaProp = '<small class="modal-hint" style="margin:0;">—</small>';
    let acciones = '';
    if (prop) {
      const estado = prop.estado === 'aceptada' ? ' <small class="bodega-ok">✓ aceptada</small>'
        : prop.estado === 'descartada' ? ' <small class="modal-hint" style="margin:0;">(no)</small>' : '';
      celdaProp = `<b>${escHtml(textoPropuestaBodega(prop))}</b>${estado}${prop.motivo ? `<br><small class="modal-hint" style="margin:0;">${escHtml(prop.motivo)}</small>` : ''}`;
      if (prop.estado === 'pendiente') {
        acciones = `<div class="cell-actions">
          <button type="button" class="btn btn-primary btn-sm" data-bodega-aceptar="${Number(p.id)}" title="Agrega este lugar al producto">✅ Guardar ahí</button>
          <button type="button" class="btn btn-ghost btn-sm" data-bodega-descartar="${Number(p.id)}" title="Descartar esta propuesta">✕ No</button>
        </div>`;
      }
    }
    return `<tr>
      <td><span class="strong">${escHtml(p.nombre)}</span>${p.categoria ? `<br><small class="modal-hint" style="margin:0;">${escHtml(p.categoria)}</small>` : ''}</td>
      <td class="num strong">${Number(p.stock)}</td>
      <td class="num">${Number(p.vendidos_90) || '—'}</td>
      <td class="num">${p.valor ? fmtCLP(p.valor) : '<small class="modal-hint" style="margin:0;">sin costo</small>'}</td>
      <td>${hoy}</td>
      <td>${celdaProp}</td>
      <td>${acciones}</td>
    </tr>`;
  }).join('');
}

async function decidirPropuestaBodega(productoId, aceptar, boton) {
  const p = (bodegaStockDatos?.productos || []).find(x => Number(x.id) === productoId);
  if (!p?.propuesta) return;
  if (boton) boton.disabled = true;
  try {
    if (aceptar) {
      const r = await API.bodega.aceptar(productoId);
      if (!p.lugares.some(l => l.nombre === r.lugar)) p.lugares.push({ nombre: r.lugar, principal: !p.lugares.length });
      p.propuesta.estado = 'aceptada';
      showToast(`Guardado en ${r.lugar}`, 'ok');
    } else {
      await API.bodega.descartar(productoId);
      p.propuesta.estado = 'descartada';
      showToast('Propuesta descartada', 'ok');
    }
    const r = bodegaStockDatos.resumen;
    r.propuestas_pendientes = Math.max(0, (r.propuestas_pendientes || 0) - 1);
    r.sin_lugar = bodegaStockDatos.productos.filter(x => !x.lugares.length).length;
    pintarBodegaStock();
  } catch (err) {
    showToast(err.message || 'No se pudo guardar', 'err');
    if (boton) boton.disabled = false;
  }
}
