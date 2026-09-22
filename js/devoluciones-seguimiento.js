/* ============================================================
   SEGUIMIENTO DEL PRODUCTO DEVUELTO (v84 · sql/63)
   ------------------------------------------------------------
   Qué pasó con el producto DESPUÉS de la devolución: si se fue al
   proveedor, si se mandó a la garantía del fabricante, si volvió la plata
   o si terminó en la basura.

   Va por LÍNEA devuelta y no por devolución (decisión del dueño): si en
   una misma devolución vuelven dos cosas, una puede irse al proveedor y la
   otra a la basura.

   ⚠️ REGLA DEL DUEÑO, Y ES LA QUE MANDA ACÁ:
   "siempre yo debo vigilar y aprobar si se debe ajustar o no manualmente,
    para que no se descuente de forma automática del balance."
   Por eso cuando el proveedor devuelve la plata el POS solo PROPONE cuánto
   descontarle al gasto de la merma. El balance no se mueve hasta que él
   aprieta "Aplicar".
   ============================================================ */

let segLineaActual = null;      // { id, nombre, cantidad, merma_id, seguimiento }
let segAvisosCache = null;
let intervaloSegAvisos = null;
const INTERVALO_SEG_AVISOS_MS = 10 * 60 * 1000;

const DESTINOS_SEG = [
  ['SIN_DECIDIR',           '🤔 Todavía no decido'],
  ['AL_PROVEEDOR',          '📮 Se lo devolví al proveedor'],
  ['A_GARANTIA_FABRICANTE', '🏭 Lo mandé a la garantía del fabricante'],
  ['REPARADO',              '🔧 Lo reparé y volvió al stock'],
  ['ME_LO_QUEDE',           '📦 Me lo quedé (repuestos / uso interno)'],
  ['BOTADO',                '🗑️ Lo boté']
];

const RESULTADOS_SEG = [
  ['ESPERANDO',      '⏳ Esperando respuesta'],
  ['PLATA_DEVUELTA', '💵 Me devolvieron la plata'],
  ['CAMBIADO',       '🔄 Me lo cambiaron por otro'],
  ['RECHAZADO',      '❌ Me lo rechazaron']
];

// Los dos únicos destinos donde un tercero tiene que responder algo.
const DESTINOS_CON_ESPERA_UI = ['AL_PROVEEDOR', 'A_GARANTIA_FABRICANTE'];

function etiquetaDestino(v) { return (DESTINOS_SEG.find(d => d[0] === v) || [, v])[1]; }
function etiquetaResultado(v) { return (RESULTADOS_SEG.find(d => d[0] === v) || [, v])[1]; }

function cerrarModalSeguimiento() {
  document.getElementById('modalSeguimientoDev')?.classList.remove('show');
  segLineaActual = null;
}

/* `linea` es un item de devolución tal como lo entrega el panel de
   Finanzas, ya con su `seguimiento` (o null si es la primera vez). */
function abrirSeguimientoDevolucion(linea) {
  const modal = document.getElementById('modalSeguimientoDev');
  if (!modal || !linea) return;

  segLineaActual = linea;
  const s = linea.seguimiento || {};

  const ref = document.getElementById('segRef');
  if (ref) ref.textContent = `${num(linea.cantidad)} × ${linea.nombre}`;

  const selDestino = document.getElementById('segDestino');
  if (selDestino) {
    if (!selDestino.options.length) {
      selDestino.innerHTML = DESTINOS_SEG.map(([v, t]) => `<option value="${v}">${escHtml(t)}</option>`).join('');
    }
    selDestino.value = s.destino || 'SIN_DECIDIR';
  }

  const selResultado = document.getElementById('segResultado');
  if (selResultado) {
    if (!selResultado.options.length) {
      selResultado.innerHTML = RESULTADOS_SEG.map(([v, t]) => `<option value="${v}">${escHtml(t)}</option>`).join('');
    }
    selResultado.value = s.resultado || 'ESPERANDO';
  }

  const poner = (id, v) => { const e = document.getElementById(id); if (e) e.value = v ?? ''; };
  poner('segDestinatario', s.destinatario);
  poner('segEnviado', s.enviado_el || todayISO());
  poner('segEsperado', s.esperado_para);
  poner('segMonto', s.monto_recuperado > 0 ? s.monto_recuperado : '');
  poner('segNota', s.nota);
  const chkStock = document.getElementById('segReemplazoStock');
  if (chkStock) chkStock.checked = !!s.reemplazo_a_stock;

  /* Si el producto no volvió al stock, la v82 ya cargó su costo como
     pérdida. Decirlo acá es lo que hace entendible el ajuste de después. */
  const avisoMerma = document.getElementById('segAvisoMerma');
  if (avisoMerma) {
    avisoMerma.style.display = linea.merma_id ? 'block' : 'none';
    if (linea.merma_id) {
      avisoMerma.innerHTML = 'Este producto no volvió al stock, así que su costo ya está anotado como ' +
        'pérdida del mes. Si el proveedor te devuelve la plata, el POS te va a <strong>proponer</strong> ' +
        'descontarlo — pero no toca el balance hasta que tú lo apruebes.';
    }
  }

  ajustarCamposSeguimiento();
  modal.classList.add('show');
}

/* Muestra solo lo que corresponde al camino elegido: mandarle campos de
   "¿cuánta plata te devolvieron?" a quien botó el producto es ruido. */
function ajustarCamposSeguimiento() {
  const destino = document.getElementById('segDestino')?.value;
  const resultado = document.getElementById('segResultado')?.value;
  const espera = DESTINOS_CON_ESPERA_UI.includes(destino);

  const ver = (id, visible) => {
    const e = document.getElementById(id);
    if (e) e.style.display = visible ? '' : 'none';
  };

  ver('segBloqueEnvio', espera);
  ver('segBloqueResultado', espera);
  ver('segBloqueMonto', espera && resultado === 'PLATA_DEVUELTA');
  ver('segBloqueCambio', espera && resultado === 'CAMBIADO');

  const etiqueta = document.getElementById('segEtiquetaDestinatario');
  if (etiqueta) {
    etiqueta.textContent = destino === 'A_GARANTIA_FABRICANTE'
      ? '¿A qué marca lo mandaste?' : '¿A qué proveedor se lo devolviste?';
  }
}

async function guardarSeguimientoDevolucion() {
  if (!segLineaActual) return;

  const destino = document.getElementById('segDestino')?.value;
  const espera = DESTINOS_CON_ESPERA_UI.includes(destino);
  const resultado = espera ? document.getElementById('segResultado')?.value : null;
  const monto = num(document.getElementById('segMonto')?.value);

  if (resultado === 'PLATA_DEVUELTA' && monto <= 0) {
    showToast('Escribe cuánta plata te devolvieron', 'err');
    document.getElementById('segMonto')?.focus();
    return;
  }

  const btn = document.getElementById('btnGuardarSeguimiento');
  if (btn) { btn.disabled = true; btn.textContent = 'Guardando…'; }

  try {
    const r = await API.devoluciones.guardarSeguimiento(segLineaActual.id, {
      destino,
      resultado,
      destinatario: document.getElementById('segDestinatario')?.value?.trim() || null,
      enviado_el: espera ? (document.getElementById('segEnviado')?.value || null) : null,
      esperado_para: espera ? (document.getElementById('segEsperado')?.value || null) : null,
      monto_recuperado: resultado === 'PLATA_DEVUELTA' ? monto : 0,
      reemplazo_a_stock: resultado === 'CAMBIADO' && !!document.getElementById('segReemplazoStock')?.checked,
      nota: document.getElementById('segNota')?.value?.trim() || null
    });

    cerrarModalSeguimiento();
    showToast('Seguimiento guardado', 'ok');
    if (r.stock_repuesto) showToast('La unidad de reemplazo entró al stock', 'ok');

    /* El ajuste se avisa aparte y con claridad: es plata, y es SU decisión.
       No se aplica nada acá. */
    if (r.ajuste_propuesto) {
      alert('El POS calculó que ' + fmtCLP(r.ajuste_propuesto.monto) + ' dejaron de ser pérdida.\n\n' +
            'NO se descontó nada todavía. Tienes que aprobarlo tú desde el aviso ' +
            '"📮 Seguimiento de devoluciones" del header.');
    }

    if (typeof cargarPanelDevoluciones === 'function') cargarPanelDevoluciones();
    actualizarAvisoSeguimiento();
  } catch (err) {
    console.error('No se pudo guardar el seguimiento:', err.message || err);
    showToast(err.message || 'No se pudo guardar el seguimiento', 'err');
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = 'Guardar seguimiento'; }
  }
}

// ============================================================
// El aviso del header
// ============================================================

async function actualizarAvisoSeguimiento() {
  const btn = document.getElementById('btnSeguimientoDev');
  const texto = document.getElementById('textoSeguimientoDev');
  if (!btn || !texto || !tokenActual() || !esAdmin()) return;

  try {
    segAvisosCache = await API.devoluciones.avisosSeguimiento();
    const total = Number(segAvisosCache?.total) || 0;
    if (!total) { btn.hidden = true; return; }

    const ajustes = segAvisosCache.ajustes_por_aprobar?.length || 0;
    // Lo que mueve plata se dice primero: es lo único que espera SU decisión.
    texto.textContent = ajustes
      ? `${ajustes} ajuste(s) por aprobar`
      : `${total} devolución(es) por revisar`;
    btn.classList.toggle('seg-con-plata', ajustes > 0);
    btn.title = ajustes
      ? `${fmtCLP(segAvisosCache.monto_ajustes)} dejaron de ser pérdida y esperan tu visto bueno`
      : 'Productos devueltos que esperan una decisión o una respuesta del proveedor';
    btn.hidden = false;
  } catch (err) {
    console.error('No se pudo revisar el seguimiento de devoluciones:', err.message || err);
  }
}

function abrirModalAvisosSeguimiento() {
  const cont = document.getElementById('segAvisosLista');
  if (!cont || !segAvisosCache) return;

  const ficha = (s, extra) => `
    <div class="dev-linea">
      <div class="dev-linea-info">
        <strong>${num(s.cantidad)} × ${escHtml(s.producto)}</strong>
        <span class="dev-linea-meta">
          ${s.numero_orden ? `Venta #${String(s.numero_orden).padStart(5, '0')} · ` : ''}
          devuelto el ${escHtml(s.devolucion_fecha || '—')}
          ${s.destinatario ? ' · ' + escHtml(s.destinatario) : ''}
        </span>
        ${extra}
      </div>
    </div>`;

  let html = '';

  if (segAvisosCache.ajustes_por_aprobar?.length) {
    html += `<span class="section-label">💵 Esperan tu aprobación · nada se descontó todavía</span>`;
    html += segAvisosCache.ajustes_por_aprobar.map(s => ficha(s, `
      <span class="dev-linea-meta">${escHtml(etiquetaResultado(s.resultado))} — el POS propone descontar
        <strong>${fmtCLP(s.ajuste_monto)}</strong> de la pérdida anotada.</span>
      <span class="dev-linea-campos" style="margin-top:6px;">
        <button class="btn btn-primary btn-sm" data-ajuste-ok="${s.id}">Aplicar al balance</button>
        <button class="btn btn-ghost btn-sm" data-ajuste-no="${s.id}">Dejarlo como está</button>
      </span>`)).join('');
  }

  if (segAvisosCache.vencidas?.length) {
    html += `<span class="section-label">⏰ Se pasó el plazo que pusiste</span>`;
    html += segAvisosCache.vencidas.map(s => ficha(s, `
      <span class="dev-linea-meta">${escHtml(etiquetaDestino(s.destino))} · esperabas respuesta el
        ${escHtml(s.esperado_para)}${s.dias_vencida > 0 ? ` (hace ${s.dias_vencida} día(s))` : ''}.</span>`)).join('');
  }

  if (segAvisosCache.sin_decidir?.length) {
    html += `<span class="section-label">🤔 Llevan más de una semana sin decisión</span>`;
    html += segAvisosCache.sin_decidir.map(s => ficha(s,
      `<span class="dev-linea-meta">Todavía no dice qué se hizo con este producto.</span>`)).join('');
  }

  cont.innerHTML = html || '<p class="modal-hint">No hay nada pendiente.</p>';
  document.getElementById('modalAvisosSeguimiento')?.classList.add('show');
}

async function resolverAjusteSeguimiento(id, aprobar) {
  if (aprobar && !confirm('Esto va a descontar esa plata de la pérdida anotada en el mes. ¿Aplicarlo?')) return;
  try {
    const r = await API.devoluciones.resolverAjuste(id, aprobar);
    showToast(r.aplicado
      ? `Aplicado · la pérdida quedó en ${fmtCLP(r.merma?.perdida_ahora)}`
      : 'Se dejó la pérdida como estaba', 'ok');
    await actualizarAvisoSeguimiento();
    if (segAvisosCache?.total) abrirModalAvisosSeguimiento();
    else cerrarModal('modalAvisosSeguimiento');
    if (typeof cargarPanelDevoluciones === 'function') cargarPanelDevoluciones();
  } catch (err) {
    console.error('No se pudo resolver el ajuste:', err.message || err);
    showToast(err.message || 'No se pudo resolver el ajuste', 'err');
  }
}

document.addEventListener('pos:sesion-iniciada', () => {
  if (intervaloSegAvisos) { clearInterval(intervaloSegAvisos); intervaloSegAvisos = null; }
  if (!esAdmin()) return;
  actualizarAvisoSeguimiento();
  intervaloSegAvisos = setInterval(actualizarAvisoSeguimiento, INTERVALO_SEG_AVISOS_MS);
});

document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('segDestino')?.addEventListener('change', ajustarCamposSeguimiento);
  document.getElementById('segResultado')?.addEventListener('change', ajustarCamposSeguimiento);
  document.getElementById('btnGuardarSeguimiento')?.addEventListener('click', guardarSeguimientoDevolucion);
  document.getElementById('btnCancelarSeguimiento')?.addEventListener('click', cerrarModalSeguimiento);
  document.getElementById('modalSeguimientoDev')?.addEventListener('click', (e) => {
    if (e.target.id === 'modalSeguimientoDev') cerrarModalSeguimiento();
  });

  document.getElementById('btnSeguimientoDev')?.addEventListener('click', abrirModalAvisosSeguimiento);
  document.getElementById('btnCerrarAvisosSeguimiento')?.addEventListener('click', () => cerrarModal('modalAvisosSeguimiento'));
  document.getElementById('segAvisosLista')?.addEventListener('click', (e) => {
    const ok = e.target.closest('[data-ajuste-ok]');
    if (ok) { resolverAjusteSeguimiento(Number(ok.dataset.ajusteOk), true); return; }
    const no = e.target.closest('[data-ajuste-no]');
    if (no) resolverAjusteSeguimiento(Number(no.dataset.ajusteNo), false);
  });
});
