/* ============================================================
   INTERRUPTOR DE OFERTAS WEB (v116, sql/83)
   ------------------------------------------------------------
   Pedido del dueño (03-10-2026): "necesito un botón en el POS para activar
   las ofertas ... prefiero activar o desactivarlas yo desde el POS".

   · Chip "Ofertas" en el encabezado, siempre visible para admin.
   · Lista los productos con precio de oferta cargado, cada uno con su
     interruptor. Apagar NO borra el precio ni las fechas: la tienda deja de
     mostrarla y de cobrarla hasta que se encienda otra vez.
   · Encendida respeta la fecha de la ficha (empieza y termina sola). Si la
     fecha de fin ya pasó, encender pide una nueva.
   · El precio de oferta y las fechas se siguen cargando en la ficha del
     producto (Tienda web → Oferta web).

   Si la columna todavía no existe (migración sin aplicar), el chip se oculta.
   ============================================================ */

let datosOfertas = null;        // [{ id, nombre, precio_normal, precio_oferta, estado, ... }]
let ofertaPidiendoFecha = null; // id de la fila con el campo "hasta" a la vista

document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('btnOfertas')?.addEventListener('click', abrirOfertas);
  document.getElementById('btnCerrarOfertas')?.addEventListener('click', () => cerrarModal('modalOfertas'));
  document.getElementById('btnOfertasEncenderTodas')?.addEventListener('click', () => cambiarTodasLasOfertas(true));
  document.getElementById('btnOfertasApagarTodas')?.addEventListener('click', () => cambiarTodasLasOfertas(false));
  const lista = document.getElementById('ofertasLista');
  lista?.addEventListener('change', e => {
    const sw = e.target.closest('.oferta-switch');
    if (sw) cambiarOferta(Number(sw.dataset.id), { encender: sw.checked });
  });
  lista?.addEventListener('click', e => {
    const b = e.target.closest('[data-oferta-accion]');
    if (!b) return;
    const id = Number(b.dataset.id);
    if (b.dataset.ofertaAccion === 'empezar') cambiarOferta(id, { encender: true, empezar_ya: true });
    else if (b.dataset.ofertaAccion === 'cancelar-fecha') { ofertaPidiendoFecha = null; pintarOfertas(); }
    else if (b.dataset.ofertaAccion === 'confirmar-fecha') {
      const valor = document.getElementById('ofertaHastaNueva')?.value;
      if (!valor) return showToast('Elige hasta cuándo dura la oferta', 'error');
      cambiarOferta(id, { encender: true, hasta: new Date(valor).toISOString() });
    }
  });
});

document.addEventListener('pos:sesion-iniciada', () => {
  const btn = document.getElementById('btnOfertas');
  if (!esAdmin()) { if (btn) btn.hidden = true; return; }
  actualizarAvisoOfertas();
});

async function actualizarAvisoOfertas() {
  const btn = document.getElementById('btnOfertas');
  const texto = document.getElementById('textoOfertas');
  if (!btn || !texto || !tokenActual() || !esAdmin()) return;
  try {
    datosOfertas = (await API.productos.ofertas()).ofertas || [];
  } catch (err) {
    console.error('Error al revisar las ofertas:', err.message || err);
    btn.hidden = true;
    return;
  }
  const vigentes = datosOfertas.filter(o => o.estado === 'vigente').length;
  const programadas = datosOfertas.filter(o => o.estado === 'programada').length;
  texto.textContent = vigentes ? `${vigentes} oferta(s) encendida(s)`
    : programadas ? `${programadas} oferta(s) por empezar`
    : 'Ofertas apagadas';
  btn.classList.toggle('ofertas-activas', vigentes > 0);
  btn.hidden = false;
  if (document.getElementById('modalOfertas')?.classList.contains('show')) pintarOfertas();
}

async function abrirOfertas() {
  ofertaPidiendoFecha = null;
  document.getElementById('modalOfertas')?.classList.add('show');
  pintarOfertas();
  await actualizarAvisoOfertas();
}

function fechaOfertaLegible(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('es-CL', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', hour12: false });
}

function etiquetaEstadoOferta(o) {
  if (o.estado === 'vigente') return `<span class="pend-etiqueta hecho">A la vista · termina ${escHtml(fechaOfertaLegible(o.oferta_hasta))}</span>`;
  if (o.estado === 'programada') return `<span class="pend-etiqueta pronto">Empieza ${escHtml(fechaOfertaLegible(o.oferta_desde))}</span>`;
  if (o.estado === 'terminada') return `<span class="pend-etiqueta vencido">Terminó ${escHtml(fechaOfertaLegible(o.oferta_hasta))}</span>`;
  if (o.estado === 'invalida') return '<span class="pend-etiqueta vencido">No es más barata que el precio normal: corrígela en la ficha</span>';
  return '<span class="pend-etiqueta">Apagada</span>';
}

function pintarOfertas() {
  const cont = document.getElementById('ofertasLista');
  const resumen = document.getElementById('ofertasResumen');
  if (!cont) return;
  if (!datosOfertas) { cont.innerHTML = '<p class="modal-hint">Cargando…</p>'; return; }
  if (!datosOfertas.length) {
    if (resumen) resumen.textContent = 'Ningún producto tiene precio de oferta cargado.';
    cont.innerHTML = '<p class="modal-hint">Para crear una: Productos → editar → Tienda web → "Oferta web". Ahí pones el precio rebajado y hasta cuándo dura; después se enciende y apaga desde acá.</p>';
    return;
  }
  const vigentes = datosOfertas.filter(o => o.estado === 'vigente').length;
  if (resumen) {
    resumen.textContent = `${datosOfertas.length} producto(s) con oferta cargada · ${vigentes} a la vista en sevelin.cl ahora. Apagar no borra el precio de oferta.`;
  }
  cont.innerHTML = datosOfertas.map(o => {
    const pct = o.precio_normal > o.precio_oferta ? Math.floor((o.precio_normal - o.precio_oferta) / o.precio_normal * 100) : 0;
    const encendida = !o.pausada && o.estado !== 'terminada' && o.estado !== 'invalida';
    const pideFecha = ofertaPidiendoFecha === o.id;
    return `
      <div class="pend-fila oferta-fila ${encendida ? '' : 'oferta-apagada'}">
        <label class="oferta-interruptor" title="${encendida ? 'Apagar' : 'Encender'} esta oferta">
          <input type="checkbox" class="oferta-switch" data-id="${o.id}" ${encendida ? 'checked' : ''} ${o.estado === 'invalida' ? 'disabled' : ''}
                 aria-label="Oferta de ${escHtml(o.nombre)}">
          <span class="oferta-pista" aria-hidden="true"></span>
        </label>
        <div class="pend-cuerpo">
          <strong>${escHtml(o.nombre)}</strong>
          <span class="oferta-precios">
            <s>${fmtCLP(o.precio_normal)}</s> <b>${fmtCLP(o.precio_oferta)}</b>
            ${pct > 0 ? `<span class="oferta-pct">−${pct}%</span>` : ''}
          </span>
          <span class="pend-etiquetas">
            ${etiquetaEstadoOferta(o)}
            ${o.publicado_web ? '' : '<span class="pend-etiqueta pronto">No está publicado en la web</span>'}
          </span>
          ${pideFecha ? `
            <div class="oferta-fecha">
              <label for="ofertaHastaNueva">¿Hasta cuándo dura?</label>
              <input type="datetime-local" id="ofertaHastaNueva">
              <button type="button" class="btn btn-sm btn-primary" data-oferta-accion="confirmar-fecha" data-id="${o.id}">Encender</button>
              <button type="button" class="btn btn-sm btn-ghost" data-oferta-accion="cancelar-fecha" data-id="${o.id}">Cancelar</button>
            </div>` : ''}
        </div>
        ${o.estado === 'programada' ? `
          <div class="pend-acciones">
            <button type="button" class="btn btn-sm btn-outline" data-oferta-accion="empezar" data-id="${o.id}" title="Empieza ahora en vez de esperar la fecha de inicio">Empezar ahora</button>
          </div>` : ''}
      </div>`;
  }).join('');
}

async function cambiarOferta(id, datos) {
  const oferta = datosOfertas?.find(o => o.id === id);
  // Terminada: encender no sirve sin una fecha de fin nueva; se pide en la misma fila.
  if (datos.encender && !datos.hasta && oferta?.estado === 'terminada') {
    ofertaPidiendoFecha = id;
    pintarOfertas();
    document.getElementById('ofertaHastaNueva')?.focus();
    return;
  }
  try {
    const nueva = await API.productos.cambiarOferta(id, datos);
    ofertaPidiendoFecha = null;
    showToast(!datos.encender ? 'Oferta apagada: la tienda vuelve al precio normal'
      : nueva.estado === 'programada' ? `Encendida: empieza ${fechaOfertaLegible(nueva.oferta_desde)}`
      : `✔ Oferta a la vista hasta ${fechaOfertaLegible(nueva.oferta_hasta)}`, 'success');
  } catch (err) {
    if (err.necesita_fecha) ofertaPidiendoFecha = id;
    showToast(err.message || 'No se pudo cambiar la oferta', 'error');
  }
  await actualizarAvisoOfertas();
  pintarOfertas();
}

async function cambiarTodasLasOfertas(encender) {
  try {
    const r = await API.productos.cambiarTodasLasOfertas(encender);
    const aviso = encender
      ? `${r.cambiadas} oferta(s) encendida(s)` + (r.sin_fecha ? ` · ${r.sin_fecha} ya terminaron: enciéndelas una por una con fecha nueva` : '')
      : `${r.cambiadas} oferta(s) apagada(s): la tienda vuelve al precio normal`;
    showToast(aviso, r.sin_fecha ? 'info' : 'success');
  } catch (err) {
    showToast(err.message || 'No se pudieron cambiar las ofertas', 'error');
  }
  await actualizarAvisoOfertas();
  pintarOfertas();
}
