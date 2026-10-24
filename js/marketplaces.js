// ==========================================
// MARKETPLACES.JS — Registro de marketplaces (v181, sql/112)
// ------------------------------------------
// Pedido del dueño (24-10-2026): "lleva un registro en el POS de marketplaces,
// de cuáles productos llevo registrados o subidos" y "protégeme de las
// comisiones". Una fila por publicación con lo que cobra ESE canal; el panel
// muestra cuánto queda de verdad (precio − comisión − envío − costo).
// Facebook Marketplace se sigue marcando con su botón (facebook-rapido.js) y
// aparece aquí de solo lectura.
// ==========================================

let mkPublicaciones = [];
let mkEditando = null;   // id de la publicación que se edita, o null si es nueva

const MK_CANALES = { MERCADOLIBRE: 'Mercado Libre', FACEBOOK: 'Facebook', INSTAGRAM: 'Instagram', TIKTOK: 'TikTok',
  RIPLEY: 'Ripley', FALABELLA: 'Falabella', PARIS: 'Paris', OTRO: 'Otro' };
const MK_ESTADOS = { borrador: 'Borrador', en_revision: 'En revisión', publicado: 'Publicado', pausado: 'Pausado',
  agotado: 'Agotado', eliminado: 'Eliminado' };
// Por debajo de esto, la publicación deja poco después de comisión y envío
const MK_UTILIDAD_MINIMA = 5000;

function mkEl(id) { return document.getElementById(id); }

async function abrirMarketplaces() {
  mkEl('modalMarketplaces')?.classList.add('show');
  mkCerrarFormulario();
  await mkCargar();
}

function cerrarMarketplaces() {
  mkEl('modalMarketplaces')?.classList.remove('show');
}

async function mkCargar() {
  const tabla = mkEl('mkTabla');
  if (tabla) tabla.innerHTML = '<tr><td colspan="9">Cargando…</td></tr>';
  try {
    mkPublicaciones = await API.marketplaces.listar();
  } catch (err) {
    mkPublicaciones = [];
    if (tabla) tabla.innerHTML = `<tr><td colspan="9">${escHtml(err.message || 'No se pudo cargar')}</td></tr>`;
    return;
  }
  mkPintar();
}

function mkPintar() {
  const filtro = mkEl('mkFiltroCanal')?.value || '';
  const filas = mkPublicaciones.filter(p => !filtro || p.canal === filtro || (filtro === 'OTRO' && !['MERCADOLIBRE', 'FACEBOOK'].includes(p.canal)));

  const resumen = mkEl('mkResumen');
  if (resumen) {
    const cuenta = {};
    for (const p of mkPublicaciones) if (p.estado === 'publicado') cuenta[p.canal] = (cuenta[p.canal] || 0) + 1;
    const flacas = mkPublicaciones.filter(p => p.estado === 'publicado' && p.utilidad !== null && p.utilidad < MK_UTILIDAD_MINIMA).length;
    resumen.innerHTML = Object.keys(cuenta).length
      ? Object.entries(cuenta).map(([c, n]) => `<span class="mk-chip">${escHtml(MK_CANALES[c] || c)}: <strong>${n}</strong> publicado(s)</span>`).join(' ')
        + (flacas ? ` <span class="mk-chip mk-chip-alerta">⚠️ ${flacas} deja(n) menos de ${fmtCLP(MK_UTILIDAD_MINIMA)}</span>` : '')
      : '<span class="mk-chip">Aún no hay publicaciones registradas</span>';
  }

  const tabla = mkEl('mkTabla');
  if (!tabla) return;
  if (!filas.length) { tabla.innerHTML = '<tr><td colspan="9">Nada en este canal todavía.</td></tr>'; return; }
  tabla.innerHTML = filas.map(p => {
    const utilidad = p.utilidad === null ? '—'
      : `<span class="${p.utilidad < MK_UTILIDAD_MINIMA ? 'mk-flaca' : 'mk-buena'}">${fmtCLP(p.utilidad)}</span>`;
    const link = p.url ? `<a href="${escHtml(p.url)}" target="_blank" rel="noopener">ver</a>` : '';
    const stockPos = p.producto_stock === null ? '—' : num(p.producto_stock);
    const alertaStock = p.stock_canal !== null && p.producto_stock !== null && num(p.stock_canal) > num(p.producto_stock)
      ? ' <span class="mk-flaca" title="Publicaste más de lo que tienes en el POS">⚠️</span>' : '';
    const acciones = p.solo_lectura ? '<span class="modal-hint">con su botón</span>'
      : `<button class="btn btn-ghost btn-sm" data-mk-editar="${p.id}" type="button">✏️</button>
         <button class="btn btn-ghost btn-sm" data-mk-sacar="${p.id}" type="button" title="Sacar del registro">🗑️</button>`;
    return `<tr>
      <td>#${p.producto_id} ${escHtml(p.producto_nombre)}${p.producto_archivado ? ' <em>(archivado)</em>' : ''} ${link}</td>
      <td>${escHtml(MK_CANALES[p.canal] || p.canal)}${p.externo_id ? `<br><small>${escHtml(p.externo_id)}</small>` : ''}</td>
      <td>${escHtml(MK_ESTADOS[p.estado] || p.estado)}</td>
      <td>${p.precio_canal === null ? (p.producto_precio === null ? '—' : fmtCLP(p.producto_precio) + ' <small>(local)</small>') : fmtCLP(p.precio_canal)}</td>
      <td>${p.comision === null ? '—' : fmtCLP(p.comision)}</td>
      <td>${p.envio === null ? '—' : fmtCLP(p.envio)}</td>
      <td>${utilidad}</td>
      <td>${p.stock_canal === null ? '—' : num(p.stock_canal)} / ${stockPos}${alertaStock}</td>
      <td>${acciones}</td>
    </tr>`;
  }).join('');

  tabla.querySelectorAll('button[data-mk-editar]').forEach(b => b.addEventListener('click', () => mkAbrirFormulario(Number(b.dataset.mkEditar))));
  tabla.querySelectorAll('button[data-mk-sacar]').forEach(b => b.addEventListener('click', () => mkSacar(Number(b.dataset.mkSacar))));
}

/* El producto se elige escribiendo "#132" o parte del nombre. */
function mkProductoDesdeTexto(texto) {
  const t = String(texto || '').trim();
  const m = t.match(/^#?(\d+)/);
  const lista = typeof productsList !== 'undefined' ? productsList : [];
  if (m) return lista.find(p => String(p.id) === m[1]) || null;
  const bajo = t.toLowerCase();
  return lista.find(p => String(p.nombre || '').toLowerCase() === bajo) || null;
}

function mkAbrirFormulario(id) {
  const p = id ? mkPublicaciones.find(x => x.id === id) : null;
  mkEditando = p ? p.id : null;
  const lista = mkEl('mkProductosLista');
  if (lista && typeof productsList !== 'undefined') {
    lista.innerHTML = productsList.filter(x => !x.es_servicio).slice(0, 1500)
      .map(x => `<option value="#${x.id} ${escHtml(x.nombre || '')}"></option>`).join('');
  }
  const poner = (campo, valor) => { const el = mkEl(campo); if (el) el.value = valor ?? ''; };
  poner('mkProducto', p ? `#${p.producto_id} ${p.producto_nombre}` : '');
  mkEl('mkProducto').disabled = !!p;
  poner('mkCanal', p?.canal || 'MERCADOLIBRE');
  poner('mkEstado', p?.estado || 'publicado');
  poner('mkCodigo', p?.externo_id);
  poner('mkUrl', p?.url);
  poner('mkPrecio', p?.precio_canal);
  poner('mkComision', p?.comision);
  poner('mkEnvio', p?.envio);
  poner('mkStock', p?.stock_canal);
  poner('mkNotas', p?.notas);
  const titulo = mkEl('mkFormTitulo');
  if (titulo) titulo.textContent = p ? 'Editar publicación' : 'Registrar publicación';
  mkEl('mkForm').hidden = false;
  mkCalcular();
}

function mkCerrarFormulario() {
  const f = mkEl('mkForm');
  if (f) f.hidden = true;
  mkEditando = null;
}

/* Precio que protege de la comisión: (costo + lo que quieres ganar + envío) ÷ (1 − comisión),
   redondeado hacia arriba a un precio terminado en 990. */
function mkCalcular() {
  const prod = mkEditando ? (typeof productsList !== 'undefined' ? productsList.find(x => x.id === mkPublicaciones.find(p => p.id === mkEditando)?.producto_id) : null)
    : mkProductoDesdeTexto(mkEl('mkProducto')?.value);
  const salida = mkEl('mkCalcResultado');
  const vista = mkEl('mkVistaPrevia');
  const costo = prod ? num(prod.costo_unitario) : 0;
  const pct = num(mkEl('mkCalcPct')?.value) / 100;
  const envio = num(mkEl('mkEnvio')?.value);
  const quiero = num(mkEl('mkCalcUtilidad')?.value);
  if (!prod || !costo || pct < 0 || pct >= 0.6) {
    if (salida) salida.textContent = prod && !costo ? 'Este producto no tiene costo en el POS' : 'Elige el producto';
    if (vista) vista.textContent = '';
    return null;
  }
  const bruto = (costo + quiero + envio) / (1 - pct);
  const sugerido = Math.max(990, Math.ceil((bruto + 10) / 1000) * 1000 - 10);
  if (salida) salida.innerHTML = `→ publícalo a <strong>${fmtCLP(sugerido)}</strong> <small>(costo ${fmtCLP(costo)}, en el local ${fmtCLP(num(prod.precio_unitario))})</small>`;

  const precio = num(mkEl('mkPrecio')?.value);
  const comision = mkEl('mkComision')?.value === '' ? Math.round(precio * pct) : num(mkEl('mkComision')?.value);
  if (vista) {
    vista.textContent = precio
      ? `Con ${fmtCLP(precio)}: comisión ${fmtCLP(comision)}, envío ${fmtCLP(envio)} → te quedan ${fmtCLP(precio - comision - envio - costo)} de utilidad.`
      : '';
  }
  return sugerido;
}

async function mkGuardar() {
  const prod = mkEditando ? null : mkProductoDesdeTexto(mkEl('mkProducto')?.value);
  if (!mkEditando && !prod) { showToast('Elige el producto de la lista (ej: #132)', 'err'); return; }
  const leer = id => mkEl(id)?.value ?? '';
  const datos = {
    canal: leer('mkCanal'), estado: leer('mkEstado'), externo_id: leer('mkCodigo'), url: leer('mkUrl'),
    precio_canal: leer('mkPrecio'), comision: leer('mkComision'), envio: leer('mkEnvio'), stock_canal: leer('mkStock'), notas: leer('mkNotas')
  };
  // Sin comisión escrita, se guarda la estimada con el % de la calculadora (mejor que dejarla en blanco)
  if (datos.comision === '' && num(datos.precio_canal) > 0) {
    datos.comision = Math.round(num(datos.precio_canal) * num(leer('mkCalcPct')) / 100);
  }
  const boton = mkEl('btnMkGuardar');
  if (boton) boton.disabled = true;
  try {
    if (mkEditando) await API.marketplaces.actualizar(mkEditando, datos);
    else await API.marketplaces.crear({ ...datos, producto_id: prod.id });
    showToast('Publicación guardada', 'ok');
    mkCerrarFormulario();
    await mkCargar();
  } catch (err) {
    showToast(err.message || 'No se pudo guardar', 'err');
  } finally {
    if (boton) boton.disabled = false;
  }
}

async function mkSacar(id) {
  const p = mkPublicaciones.find(x => x.id === id);
  if (!p) return;
  if (!await ventanaConfirmar(`"${p.producto_nombre}" en ${MK_CANALES[p.canal] || p.canal}\n\nSale del registro. Esto no borra la publicación en el marketplace: eso se hace allá.`, { titulo: '¿Sacar del registro?', textoSi: 'Sí, sacar' })) return;
  try {
    await API.marketplaces.actualizar(id, { estado: 'eliminado' });
    showToast('Sacada del registro', 'ok');
    await mkCargar();
  } catch (err) {
    showToast(err.message || 'No se pudo sacar', 'err');
  }
}

document.addEventListener('DOMContentLoaded', () => {
  mkEl('btnMarketplaces')?.addEventListener('click', abrirMarketplaces);
  mkEl('btnMkCerrar')?.addEventListener('click', cerrarMarketplaces);
  mkEl('btnMkNueva')?.addEventListener('click', () => mkAbrirFormulario(null));
  mkEl('btnMkCancelar')?.addEventListener('click', mkCerrarFormulario);
  mkEl('btnMkGuardar')?.addEventListener('click', mkGuardar);
  mkEl('mkFiltroCanal')?.addEventListener('change', mkPintar);
  mkEl('btnMkUsarPrecio')?.addEventListener('click', () => {
    const sugerido = mkCalcular();
    if (sugerido) { mkEl('mkPrecio').value = sugerido; mkEl('mkComision').value = ''; mkCalcular(); }
  });
  ['mkProducto', 'mkPrecio', 'mkComision', 'mkEnvio', 'mkCalcUtilidad', 'mkCalcPct'].forEach(id =>
    mkEl(id)?.addEventListener('input', mkCalcular));
});
