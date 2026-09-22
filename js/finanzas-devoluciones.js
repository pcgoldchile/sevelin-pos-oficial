/* ============================================================
   FINANZAS → DEVOLUCIONES (v83 · sql/61 y 62)
   ------------------------------------------------------------
   Etapa 3 de las devoluciones. El panel responde tres preguntas que no se
   contestan con un solo total:

     1. ¿Cuánta plata se fue?      → monto devuelto y cuánto salió del cajón
     2. ¿Cuánto se perdió?         → las mermas de lo que volvió roto, a costo
     3. ¿Por qué está pasando?     → motivos y productos más devueltos

   La tercera es la única que sirve para DECIDIR: si un mismo producto
   aparece arriba tres meses seguidos, el problema no es la devolución, es
   el producto o el proveedor.

   Todas las cifras las calcula el servidor (GET /api/finanzas/devoluciones-
   resumen). Acá no se suma nada: si se sumara en los dos lados, tarde o
   temprano dirían cosas distintas.
   ============================================================ */

let devPanelCache = null;
let devPanelRango = { desde: null, hasta: null };

const ETIQUETA_MOTIVO_DEV = {
  FALLA: '🔧 Vino fallado',
  GARANTIA: '🛡️ Garantía',
  ARREPENTIMIENTO: '🙂 Se arrepintió',
  PRODUCTO_EQUIVOCADO: '📦 Producto equivocado',
  ERROR_DE_VENTA: '✏️ Error al registrar',
  OTRO: 'Otro'
};

function aplicarRangoDevoluciones(clave) {
  const r = calcularRango(clave);
  devPanelRango = { desde: r.desde, hasta: r.hasta };

  document.querySelectorAll('[data-rango-dev]').forEach(b => {
    b.classList.toggle('activo', b.dataset.rangoDev === clave);
  });
  const dDesde = document.getElementById('devPanelDesde');
  const dHasta = document.getElementById('devPanelHasta');
  if (dDesde) dDesde.value = r.desde;
  if (dHasta) dHasta.value = r.hasta;

  // Devuelve la promesa para poder esperarla; quien la llama al cambiar de
  // sub-pestaña no la espera, y está bien así.
  return cargarPanelDevoluciones();
}

async function cargarPanelDevoluciones() {
  const cuerpo = document.getElementById('devPanelFilas');
  if (!cuerpo || !tokenActual()) return;

  const { desde, hasta } = devPanelRango;
  if (!desde || !hasta) return;

  try {
    devPanelCache = await API.devoluciones.resumen(desde, hasta);
    pintarResumenDevoluciones();
  } catch (err) {
    console.error('No se pudo cargar el panel de devoluciones:', err.message || err);
    showToast(err.message || 'No se pudo cargar las devoluciones', 'err');
  }
}

function pintarResumenDevoluciones() {
  if (!devPanelCache) return;
  const r = devPanelCache.resumen || {};

  const periodo = document.getElementById('devPanelPeriodo');
  if (periodo) {
    periodo.textContent = r.devoluciones
      ? `${devPanelCache.periodo.desde} a ${devPanelCache.periodo.hasta} · ` +
        `${r.devoluciones} devolución(es): ${r.anuladas} anulada(s) y ${r.parciales} parcial(es)`
      : `${devPanelCache.periodo.desde} a ${devPanelCache.periodo.hasta} · sin devoluciones`;
  }

  const poner = (id, texto) => { const e = document.getElementById(id); if (e) e.textContent = texto; };

  poner('devKpiMonto', fmtCLP(r.monto_devuelto));
  /* La tasa importa más que el monto: $200.000 devueltos sobre $8.000.000
     vendidos es normal; sobre $600.000 es una señal de alarma. */
  poner('devKpiTasa', r.vendido_periodo
    ? `${r.tasa}% de lo vendido (${fmtCLP(r.vendido_periodo)})`
    : 'Sin ventas en el período');

  poner('devKpiCajon', fmtCLP(r.salio_del_cajon));
  poner('devKpiSinDinero', r.sin_dinero
    ? `${fmtCLP(r.sin_dinero)} fue cambio por otro producto`
    : 'Todo se devolvió en dinero');

  poner('devKpiPerdida', fmtCLP(r.perdida_mermas));

  poner('devKpiNC', String(r.nota_credito_pendientes || 0));
  poner('devKpiNCMonto', r.nota_credito_pendientes
    ? `${fmtCLP(r.nota_credito_monto)} · ${fmtCLP(r.nota_credito_iva)} de IVA por recuperar`
    : 'Nada pendiente en el SII');

  const filaVacia = (cols, texto) => `<tr class="empty-row"><td colspan="${cols}">${texto}</td></tr>`;

  const motivos = document.getElementById('devPorMotivo');
  if (motivos) {
    motivos.innerHTML = (devPanelCache.por_motivo || []).map(m => `
      <tr>
        <td>${escHtml(ETIQUETA_MOTIVO_DEV[m.clave] || m.clave)}</td>
        <td class="num">${m.cantidad}</td>
        <td class="num">${fmtCLP(m.monto)}</td>
      </tr>`).join('') || filaVacia(3, 'Sin datos');
  }

  const productos = document.getElementById('devPorProducto');
  if (productos) {
    productos.innerHTML = (devPanelCache.por_producto || []).map(p => `
      <tr>
        <td>${escHtml(p.clave)}</td>
        <td class="num">${p.unidades}</td>
        <td class="num">${fmtCLP(p.monto)}</td>
      </tr>`).join('') || filaVacia(3, 'Sin datos');
  }

  pintarDetalleDevoluciones();
}

function pintarDetalleDevoluciones() {
  const cuerpo = document.getElementById('devPanelFilas');
  if (!cuerpo || !devPanelCache) return;

  const soloNC = document.getElementById('chkDevSoloNC')?.checked;
  const lista = (devPanelCache.devoluciones || [])
    .filter(d => !soloNC || (d.requiere_nota_credito && !d.nota_credito_emitida_en));

  if (!lista.length) {
    cuerpo.innerHTML = `<tr class="empty-row"><td colspan="7">${
      soloNC ? 'No queda ninguna Nota de Crédito pendiente en este período.' : 'Sin devoluciones en este período.'
    }</td></tr>`;
    return;
  }

  cuerpo.innerHTML = lista.map(d => {
    const orden = d.venta?.numero_orden ?? d.venta_id;
    const anulada = d.tipo === 'TOTAL';
    const queVolvio = (d.items || [])
      .map(i => `${num(i.cantidad)} × ${escHtml(i.nombre)}${i.merma_id ? ' <span class="dev-chip dev-chip-rota">rota</span>' : ''}`)
      .join('<br>') || '—';

    /* Tres estados posibles para la Nota de Crédito: no hace falta, ya se
       emitió, o falta. Solo el tercero pide una acción. */
    let celdaNC;
    if (!d.requiere_nota_credito) {
      celdaNC = '<span class="dev-linea-meta">No necesita</span>';
    } else if (d.nota_credito_emitida_en) {
      celdaNC = `<span class="badge badge-green">Emitida</span>` +
        (d.nota_credito_folio ? `<br><small class="dev-linea-meta">Folio ${escHtml(d.nota_credito_folio)}</small>` : '') +
        `<br><a href="#" data-desmarcar-nc="${d.id}" class="dev-linea-meta">deshacer</a>`;
    } else {
      celdaNC = `<button class="btn btn-outline btn-sm" data-marcar-nc="${d.id}" title="Marca que ya la emitiste en el SII">Marcar emitida</button>`;
    }

    return `
      <tr>
        <td>${escHtml(d.fecha)}</td>
        <td>
          #${String(orden).padStart(5, '0')}
          <span class="badge ${anulada ? 'badge-red' : 'badge-gold'}">${anulada ? 'ANULADA' : 'PARCIAL'}</span>
          ${d.venta?.cliente ? `<br><small class="dev-linea-meta">${escHtml(d.venta.cliente)}</small>` : ''}
        </td>
        <td>${queVolvio}</td>
        <td>
          ${escHtml(ETIQUETA_MOTIVO_DEV[d.motivo] || d.motivo)}
          ${d.observacion ? `<br><small class="dev-linea-meta">${escHtml(d.observacion)}</small>` : ''}
        </td>
        <td>${escHtml(d.metodo_devolucion)}</td>
        <td class="num strong">${fmtCLP(d.monto)}</td>
        <td>${celdaNC}</td>
      </tr>`;
  }).join('');
}

/* El POS no emite la Nota de Crédito ni entra al SII: solo anota que el
   dueño ya la emitió, para que la lista de pendientes se pueda vaciar. */
async function marcarNotaCredito(id, emitida) {
  let folio = null;
  if (emitida) {
    folio = prompt('Folio de la Nota de Crédito (opcional, puedes dejarlo vacío):') ?? null;
    if (folio !== null) folio = String(folio).trim();
  }
  try {
    await API.devoluciones.notaCredito(id, { emitida, folio: folio || null });
    showToast(emitida ? 'Nota de Crédito marcada como emitida' : 'Marca deshecha', 'ok');
    await cargarPanelDevoluciones();
  } catch (err) {
    console.error('No se pudo marcar la Nota de Crédito:', err.message || err);
    showToast(err.message || 'No se pudo marcar la Nota de Crédito', 'err');
  }
}

document.addEventListener('DOMContentLoaded', () => {
  document.querySelectorAll('[data-rango-dev]').forEach(btn => {
    btn.addEventListener('click', () => aplicarRangoDevoluciones(btn.dataset.rangoDev));
  });

  document.getElementById('btnDevPanelRango')?.addEventListener('click', () => {
    const desde = document.getElementById('devPanelDesde')?.value;
    const hasta = document.getElementById('devPanelHasta')?.value;
    if (!desde || !hasta) { showToast('Elige las dos fechas', 'err'); return; }
    if (desde > hasta) { showToast('La fecha de inicio no puede ser posterior al fin', 'err'); return; }
    devPanelRango = { desde, hasta };
    document.querySelectorAll('[data-rango-dev]').forEach(b => b.classList.remove('activo'));
    cargarPanelDevoluciones();
  });

  // El filtro no vuelve a pedir datos: el resumen ya trae todo el período.
  document.getElementById('chkDevSoloNC')?.addEventListener('change', pintarDetalleDevoluciones);

  document.getElementById('devPanelFilas')?.addEventListener('click', (e) => {
    const marcar = e.target.closest('[data-marcar-nc]');
    if (marcar) { marcarNotaCredito(Number(marcar.dataset.marcarNc), true); return; }
    const desmarcar = e.target.closest('[data-desmarcar-nc]');
    if (desmarcar) { e.preventDefault(); marcarNotaCredito(Number(desmarcar.dataset.desmarcarNc), false); }
  });
});
