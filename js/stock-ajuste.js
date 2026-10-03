/* ============================================================
   CORREGIR EL STOCK A MANO (v118, sql/84)
   ------------------------------------------------------------
   Pedido del dueño (03-10-2026): "si yo por X razón quiero cambiar el
   STOCK ACTUAL, que se necesite el permiso de admin, y se pregunte: si
   estoy restando, si quiero asumir la merma o dar por perdido o no hacer
   nada; y si sumo, si agregar el gasto de este producto o no hacer nada".

   · El campo "Stock actual" de la ficha es de solo lectura. El stock sube
     con una compra y baja con cada venta.
   · "Corregir" abre esta ventana: se escribe cuántas hay de verdad, se
     elige qué pasó y se confirma con la clave del dueño (cada vez).
       Hay menos → se dañó / se perdió o lo robaron (los dos anotan la
                   pérdida al costo en Finanzas) / estaba mal contado.
       Hay más   → las compré (queda como compra y ofrece anotar el gasto)
                   / estaba mal contado.
   · La clave se valida en el servidor (POST /api/productos/:id/ajuste-stock).
   · Cada corrección queda en la lista "Correcciones de stock" de la ficha.
   ============================================================ */

const MOTIVOS_CORRECCION_STOCK = {
  baja: [
    { clave: 'danado', titulo: '💥 Se dañó', detalle: 'Anota la pérdida al costo en Finanzas.' },
    { clave: 'perdido', titulo: '🕵️ Se perdió o lo robaron', detalle: 'Anota la pérdida al costo en Finanzas.' },
    { clave: 'conteo', titulo: '🔢 Estaba mal contado', detalle: 'Solo corrige el número. No mueve plata.' }
  ],
  alza: [
    { clave: 'compra', titulo: '🛒 Las compré', detalle: 'Queda como compra, con su fecha y su costo.' },
    { clave: 'conteo', titulo: '🔢 Estaba mal contado', detalle: 'Solo corrige el número. No mueve plata.' }
  ]
};
const TEXTO_MOTIVO_CORRECCION = { danado: 'Se dañó', perdido: 'Se perdió o lo robaron', conteo: 'Estaba mal contado', compra: 'Las compré' };

let correccionStock = null;   // { stockVisto, costo, nombre, motivo }

document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('btnCorregirStock')?.addEventListener('click', abrirCorreccionStock);
  document.getElementById('btnCancelarAjusteStock')?.addEventListener('click', () => cerrarModal('modalAjusteStock'));
  document.getElementById('btnConfirmarAjusteStock')?.addEventListener('click', confirmarCorreccionStock);
  document.getElementById('ajusteStockNuevo')?.addEventListener('input', () => {
    if (correccionStock) correccionStock.motivo = null;
    pintarCorreccionStock();
  });
  document.getElementById('ajusteStockCosto')?.addEventListener('input', pintarEfectoCorreccionStock);
  document.getElementById('ajusteStockMotivos')?.addEventListener('click', (e) => {
    const b = e.target.closest('[data-motivo-stock]');
    if (!b || !correccionStock) return;
    correccionStock.motivo = b.dataset.motivoStock;
    pintarCorreccionStock();
  });
  document.getElementById('prodStockIlimitado')?.addEventListener('change', actualizarBotonCorregirStock);
});

/* El botón solo sirve sobre un producto ya guardado y con inventario físico. */
function actualizarBotonCorregirStock() {
  const btn = document.getElementById('btnCorregirStock');
  if (!btn) return;
  const ilimitado = !!document.getElementById('prodStockIlimitado')?.checked;
  btn.disabled = !editingProductId || ilimitado;
  btn.title = !editingProductId ? 'Primero guarda el producto: el stock se carga con la compra de abajo'
    : ilimitado ? 'Con stock ilimitado no hay inventario que corregir'
    : 'Corregir el stock a mano (pide tu clave)';
}

function abrirCorreccionStock() {
  if (!editingProductId) { showToast('Guarda el producto primero: el stock se carga con la compra de abajo', 'err'); return; }
  const set = (id, v) => { const el = document.getElementById(id); if (el) el.value = v; };
  correccionStock = {
    stockVisto: Number(document.getElementById('prodStock')?.value) || 0,
    costo: Number(document.getElementById('prodCosto')?.value) || 0,
    nombre: (document.getElementById('prodNombre')?.value || '').trim() || 'este producto',
    motivo: null
  };
  set('ajusteStockNuevo', '');
  set('ajusteStockNota', '');
  set('ajusteStockFecha', todayISO());
  set('ajusteStockCosto', correccionStock.costo || '');
  const titulo = document.getElementById('ajusteStockProducto');
  if (titulo) titulo.textContent = `${correccionStock.nombre} · hoy el sistema dice ${correccionStock.stockVisto}.`;
  pintarCorreccionStock();
  document.getElementById('modalAjusteStock')?.classList.add('show');
  setTimeout(() => document.getElementById('ajusteStockNuevo')?.focus(), 80);
}

/* null si todavía no escribió un número válido. */
function diferenciaCorreccionStock() {
  const crudo = String(document.getElementById('ajusteStockNuevo')?.value ?? '').trim();
  if (!correccionStock || crudo === '') return null;
  const nuevo = Number(crudo);
  if (!Number.isInteger(nuevo) || nuevo < 0) return null;
  return nuevo - correccionStock.stockVisto;
}

function pintarCorreccionStock() {
  const dif = diferenciaCorreccionStock();
  const elDif = document.getElementById('ajusteStockDiferencia');
  const campoMotivo = document.getElementById('ajusteStockMotivoCampo');
  const motivos = document.getElementById('ajusteStockMotivos');
  const tituloMotivo = document.getElementById('ajusteStockMotivoTitulo');
  const compra = document.getElementById('ajusteStockCompraCampos');
  const nota = document.getElementById('ajusteStockNotaCampo');
  const hay = dif !== null && dif !== 0;

  if (elDif) {
    elDif.textContent = dif === null ? 'Escribe lo que contaste. Un número entero, 0 o más.'
      : dif === 0 ? 'Es lo mismo que dice el sistema: no hay nada que corregir.'
      : dif < 0 ? `Faltan ${-dif} unidad(es).` : `Sobran ${dif} unidad(es).`;
    elDif.style.color = hay ? (dif < 0 ? 'var(--red)' : 'var(--green)') : '';
  }
  if (campoMotivo) campoMotivo.style.display = hay ? '' : 'none';
  if (hay && motivos) {
    const lista = MOTIVOS_CORRECCION_STOCK[dif < 0 ? 'baja' : 'alza'];
    if (tituloMotivo) tituloMotivo.textContent = dif < 0 ? '¿Qué pasó con las que faltan?' : '¿De dónde salieron las que sobran?';
    motivos.innerHTML = lista.map(m => `
      <button type="button" class="ajuste-motivo ${correccionStock.motivo === m.clave ? 'activo' : ''}" data-motivo-stock="${m.clave}">
        <strong>${m.titulo}</strong><small>${m.detalle}</small>
      </button>`).join('');
  }
  if (compra) compra.style.display = hay && dif > 0 && correccionStock.motivo === 'compra' ? '' : 'none';
  if (nota) nota.style.display = hay && correccionStock.motivo ? '' : 'none';
  pintarEfectoCorreccionStock();
}

/* Qué va a pasar con la plata, dicho ANTES de confirmar. */
function pintarEfectoCorreccionStock() {
  const el = document.getElementById('ajusteStockEfecto');
  const btn = document.getElementById('btnConfirmarAjusteStock');
  const dif = diferenciaCorreccionStock();
  const motivo = correccionStock?.motivo;
  const listo = dif !== null && dif !== 0 && !!motivo;
  if (btn) btn.disabled = !listo;
  if (!el) return;
  if (!listo) { el.textContent = ''; return; }

  const unidades = Math.abs(dif);
  if (motivo === 'conteo') {
    el.textContent = `Solo cambia el número: de ${correccionStock.stockVisto} a ${correccionStock.stockVisto + dif}. Queda anotado quién lo corrigió y cuándo.`;
  } else if (motivo === 'compra') {
    const costo = Number(document.getElementById('ajusteStockCosto')?.value) || 0;
    el.textContent = costo > 0
      ? `Queda como una compra de ${unidades} × ${fmtCLP(costo)} = ${fmtCLP(unidades * costo)}. Después te ofrezco anotar el gasto en Finanzas.`
      : `Queda como una compra de ${unidades} unidad(es) sin costo anotado. Si sabes cuánto costaron, escríbelo.`;
  } else {
    el.textContent = correccionStock.costo > 0
      ? `Se anota una pérdida de ${fmtCLP(unidades * correccionStock.costo)} en Finanzas (${unidades} × ${fmtCLP(correccionStock.costo)} de costo). No sale de la caja.`
      : 'Se anota la merma, pero en $0: este producto no tiene costo cargado.';
  }
}

async function confirmarCorreccionStock() {
  const dif = diferenciaCorreccionStock();
  if (!correccionStock || dif === null || dif === 0 || !correccionStock.motivo) return;
  const motivo = correccionStock.motivo;
  const stockNuevo = correccionStock.stockVisto + dif;
  const fecha = (document.getElementById('ajusteStockFecha')?.value || '').trim();
  if (motivo === 'compra' && !fecha) { showToast('Indica la fecha de la compra', 'err'); return; }

  const pin = await pedirPinAdmin({
    titulo: 'Corregir stock',
    mensaje: 'Cambiar el stock a mano pide la clave del dueño.',
    resumen: `${correccionStock.nombre}\nDe ${correccionStock.stockVisto} a ${stockNuevo} · ${TEXTO_MOTIVO_CORRECCION[motivo]}`,
    textoBoton: '✔️ Sí, corregir'
  });
  if (!pin) return;

  const btn = document.getElementById('btnConfirmarAjusteStock');
  if (btn) btn.disabled = true;
  try {
    const r = await API.productos.ajustarStock(editingProductId, {
      pin,
      stock_nuevo: stockNuevo,
      stock_visto: correccionStock.stockVisto,
      motivo,
      nota: (document.getElementById('ajusteStockNota')?.value || '').trim() || null,
      ...(motivo === 'compra' ? {
        fecha_compra: fecha,
        costo_unitario: Number(document.getElementById('ajusteStockCosto')?.value) || 0
      } : {})
    });

    const elStock = document.getElementById('prodStock');
    if (elStock) { elStock.value = num(r.stock_nuevo); elStock.dispatchEvent(new Event('input', { bubbles: true })); }
    if (r.costo_rellenado) {
      const elCosto = document.getElementById('prodCosto');
      if (elCosto) elCosto.value = num(r.costo_rellenado);
    }
    cerrarModal('modalAjusteStock');
    showToast(r.perdida != null
      ? `Stock corregido a ${num(r.stock_nuevo)} · pérdida anotada: ${fmtCLP(r.perdida)}`
      : `Stock corregido a ${num(r.stock_nuevo)}`, 'ok');
    if (r.aviso) setTimeout(() => showToast(r.aviso, 'err'), 1800);

    await cargarIngresosProducto({ conservarFormulario: true });   // también recarga las correcciones
    if (r.compra && typeof ofrecerGastoDeCompra === 'function') {
      ofrecerGastoDeCompra({ unidades: dif, costoUnitario: r.compra.costo_unitario, proveedor: r.compra.proveedor });
    }
    if (r.lote && typeof cargarLotesDelProducto === 'function') await cargarLotesDelProducto(editingProductId);
    if (typeof cargarProductos === 'function') cargarProductos(true);
    if (typeof revisarCompletitudProducto === 'function') revisarCompletitudProducto();
  } catch (err) {
    // El stock cambió mientras tanto (una venta): se pone al día y se vuelve a preguntar.
    if (err.stock_actual != null) {
      const elStock = document.getElementById('prodStock');
      if (elStock) elStock.value = num(err.stock_actual);
      cerrarModal('modalAjusteStock');
    }
    showToast(err.message || 'No se pudo corregir el stock', 'err');
  } finally {
    pintarEfectoCorreccionStock();
  }
}

/* La lista de correcciones bajo las compras. Sin producto guardado, nada. */
async function cargarAjustesStockProducto() {
  actualizarBotonCorregirStock();
  const cont = document.getElementById('ajustesStockLista');
  if (!cont) return;
  if (!editingProductId) { cont.innerHTML = ''; return; }
  let ajustes = [];
  try {
    ajustes = await API.productos.listarAjustesStock(editingProductId) || [];
  } catch (err) {
    // Sin la migración 84 la tabla no existe: la ficha funciona igual, solo sin esta lista.
    console.error('No se pudieron cargar las correcciones de stock:', err.message || err);
    cont.innerHTML = '';
    return;
  }
  if (!ajustes.length) { cont.innerHTML = ''; return; }
  cont.innerHTML = `
    <p class="modal-hint" style="margin-bottom:4px;"><strong>Correcciones de stock</strong></p>
    ${ajustes.map(a => `
      <div class="ajuste-fila">
        <span>${escHtml(fechaCorta(tsAChile(a.creado_en)))}</span>
        <strong>${num(a.stock_antes)} → ${num(a.stock_despues)}</strong>
        <span>${escHtml(TEXTO_MOTIVO_CORRECCION[a.motivo] || a.motivo)}</span>
        ${a.merma_id && a.costo_total != null ? `<small>pérdida ${fmtCLP(a.costo_total)}</small>` : ''}
        ${a.nota ? `<small>${escHtml(a.nota)}</small>` : ''}
        <small>por ${escHtml(a.creado_por || 'admin')}</small>
      </div>`).join('')}`;
}
