// ==========================================
// ACUERDO-PADRES.JS — acuerdo del dueño con sus padres (sql/90, v133)
// ------------------------------------------
// Dos piezas:
//   1. La pregunta de la CAJA antes de cobrar: cuánto de cada servicio va al
//      pozo del papá, y de quién es la unidad de un producto que tienen los dos.
//   2. El panel Finanzas → Mis padres: la cuenta de la mercadería y el pozo
//      del mes. Todo llega calculado del servidor (GET /api/padres/resumen).
// El servidor vuelve a calcular el pozo con lo que mande la caja: lo de acá
// es solo la vista previa.
// ==========================================

const POZO_MODOS = [
  { valor: 'NO', texto: 'Es mío (Sevelin)' },
  { valor: 'TODO', texto: 'De C. Patricio: todo a su pozo' },
  { valor: 'MENOS_REPUESTO', texto: 'De C. Patricio, menos el repuesto' },
  { valor: 'OTRO', texto: 'Otro monto a su pozo' }
];
const POZO_IVA = 1.19;

/* ============================================================
   1. ANTES DE COBRAR (caja)
   ============================================================ */
let resolverAntesDeCobrar = null;
let carritoAntesDeCobrar = [];
let factorAntesDeCobrar = 1;

/* Espejo de calcularPozoLinea() del servidor. `cobrado` ya trae el
   descuento de la venta repartido. Devuelve pesos (0 = no va). */
function pozoDeLineaPrevio(cobrado, pozo) {
  const base = Math.round(Number(cobrado) || 0);
  if (!pozo || base <= 0) return 0;
  if (pozo.modo === 'OTRO') return Math.min(base, Math.max(0, Math.round(Number(pozo.monto) || 0)));
  let monto;
  if (pozo.modo === 'TODO') monto = base;
  else if (pozo.modo === 'MENOS_REPUESTO') monto = base - Math.min(base, Math.max(0, Math.round(Number(pozo.repuesto) || 0)));
  else return 0;
  return pozo.sin_iva ? Math.round(monto / POZO_IVA) : monto;
}

/* Todo servicio se pregunta (v143, dueño 15-10-2026: "al agregar servicios no
   me pregunta si es para mí o para mis padres… mayormente el de celulares").
   Antes solo se preguntaban los escritos a mano y los de ficha "Lo hace
   C. Patricio"; como ninguna ficha lo tenía marcado, los del catálogo se iban
   enteros al dueño sin que nadie lo decidiera (venta #272, formateo de
   celular, 15-10-2026). */
function lineaPreguntaPozo(item) {
  return !!item.es_servicio;
}

/* Un servicio sin "Lo hace C. Patricio" en la ficha no trae nada marcado y hay
   que elegir. Antes partía en "No va" con el botón de seguir enfocado: un Enter
   cerraba la pregunta sin que nadie la viera (venta #266, 13-10-2026). Con la
   casilla marcada en la ficha viene elegido "Todo" (se puede cambiar). */
function lineaPozoObligatoria(item) {
  return lineaPreguntaPozo(item) && !item.va_al_pozo;
}

function lineaPozoSinResponder(bloque) {
  return bloque.hasAttribute('data-pozo-obligatoria') && !bloque.querySelector('input[type="radio"]:checked');
}

/* "Continuar al pago" queda apagado mientras falte elegir en alguna línea. */
function actualizarBotonAntesDeCobrar() {
  const cuerpo = document.getElementById('antesDeCobrarCuerpo');
  const btn = document.getElementById('btnAntesDeCobrarSeguir');
  if (!cuerpo || !btn) return;
  btn.disabled = [...cuerpo.querySelectorAll('[data-pozo-linea]')].some(lineaPozoSinResponder);
}

/* Abre la pregunta si hace falta. Resuelve true para seguir al pago y false
   si se canceló. Deja en cada línea del carrito `pozo` y `propietario`, que
   viajan al servidor con la venta. */
function preguntarAntesDeCobrar(carrito, totales) {
  const modal = document.getElementById('modalAntesDeCobrar');
  const hayPozo = carrito.some(lineaPreguntaPozo);
  const hayDeLosDos = carrito.some(i => i.propietario_ficha === 'AMBOS');

  // Sin nada que preguntar no se arrastra lo elegido en un cobro anterior
  if (!hayPozo) carrito.forEach(i => { delete i.pozo; });
  // (en un producto de los dos y en lo escrito a mano vale lo marcado en la caja)
  if (!modal || (!hayPozo && !hayDeLosDos)) return Promise.resolve(true);

  carritoAntesDeCobrar = carrito;
  const subtotal = Number(totales?.subtotal) || 0;
  factorAntesDeCobrar = subtotal > 0 ? Math.max(0, subtotal - (Number(totales?.descuento) || 0)) / subtotal : 1;

  pintarAntesDeCobrar(hayPozo);
  modal.classList.add('show');
  // 150 ms: la caja devuelve el foco al buscador 40 ms después de agregar un producto
  setTimeout(() => {
    const pendiente = [...modal.querySelectorAll('[data-pozo-linea]')].find(lineaPozoSinResponder);
    (pendiente?.querySelector('input[type="radio"]') || document.getElementById('btnAntesDeCobrarSeguir'))?.focus();
  }, 150);
  return new Promise(resolve => { resolverAntesDeCobrar = resolve; });
}

function pintarAntesDeCobrar(hayPozo) {
  const cuerpo = document.getElementById('antesDeCobrarCuerpo');
  if (!cuerpo) return;

  // Con el pozo abierto se listan TODOS los servicios, para poder marcar otros
  const bloquesPozo = !hayPozo ? '' : carritoAntesDeCobrar.map((item, idx) => {
    if (!item.es_servicio) return '';
    const cobrado = Math.round(item.subtotal * factorAntesDeCobrar);
    const previo = item.pozo || null;
    const obligatoria = lineaPozoObligatoria(item);
    // '' = ninguna opción marcada: lo escrito a mano se elige cada vez
    const modo = previo?.modo || (obligatoria ? '' : (lineaPreguntaPozo(item) ? 'TODO' : 'NO'));
    return `
      <div class="antes-linea" data-pozo-linea="${idx}" data-cobrado="${cobrado}"${obligatoria ? ' data-pozo-obligatoria' : ''}>
        <div class="antes-linea-titulo">
          <b>${escHtml(item.nombre)}${item.cantidad > 1 ? ` ×${Number(item.cantidad)}` : ''}</b>
          <span>${fmtCLP(cobrado)}</span>
        </div>
        <div class="antes-opciones" role="radiogroup" aria-label="¿Va al pozo?">
          ${POZO_MODOS.map(m => `
            <label class="antes-opcion">
              <input type="radio" name="pozoModo${idx}" value="${m.valor}"${m.valor === modo ? ' checked' : ''}> ${m.texto}
            </label>`).join('')}
        </div>
        <div class="antes-extra" data-extra="MENOS_REPUESTO">
          <label>Repuesto que pusiste tú
            <input type="number" class="campo-pos" data-pozo-repuesto min="0" step="1" inputmode="numeric" value="${previo?.repuesto ? Number(previo.repuesto) : ''}" placeholder="0">
          </label>
        </div>
        <div class="antes-extra" data-extra="OTRO">
          <label>Va al pozo
            <input type="number" class="campo-pos" data-pozo-monto min="0" step="1" inputmode="numeric" value="${previo?.monto ? Number(previo.monto) : ''}" placeholder="0">
          </label>
        </div>
        <p class="antes-resultado" data-pozo-resultado></p>
      </div>`;
  }).join('');

  const bloquesDueno = carritoAntesDeCobrar.map((item, idx) => {
    if (item.propietario_ficha !== 'AMBOS') return '';
    const elegido = item.propietario === 'PADRES' ? 'PADRES' : 'MIO';   // parte en lo marcado en la caja
    return `
      <div class="antes-linea" data-dueno-linea="${idx}">
        <div class="antes-linea-titulo">
          <b>${escHtml(item.nombre)}${item.cantidad > 1 ? ` ×${Number(item.cantidad)}` : ''}</b>
          <span>${fmtCLP(item.subtotal)}</span>
        </div>
        <div class="antes-opciones" role="radiogroup" aria-label="¿De quién es?">
          <label class="antes-opcion"><input type="radio" name="duenoLinea${idx}" value="MIO"${elegido === 'MIO' ? ' checked' : ''}> Mía</label>
          <label class="antes-opcion"><input type="radio" name="duenoLinea${idx}" value="PADRES"${elegido === 'PADRES' ? ' checked' : ''}> De mis padres</label>
        </div>
      </div>`;
  }).join('');

  cuerpo.innerHTML =
    (bloquesPozo ? `<h3 class="antes-seccion">👨‍🔧 ¿Quién hizo el servicio?</h3><p class="modal-hint">Si lo hizo C. Patricio, va a su pozo. Para que venga elegido, marca "Lo hace C. Patricio" en la ficha del servicio.</p>${bloquesPozo}` : '') +
    (bloquesDueno ? `<h3 class="antes-seccion">📦 Este producto lo tienen los dos: ¿de quién es la unidad?</h3>${bloquesDueno}` : '');

  cuerpo.querySelectorAll('[data-pozo-linea]').forEach(actualizarLineaAntesDeCobrar);
  actualizarBotonAntesDeCobrar();
}

function leerLineaPozo(bloque) {
  const modo = bloque.querySelector('input[type="radio"]:checked')?.value || 'NO';
  if (modo === 'NO') return null;
  return {
    modo,
    repuesto: Number(bloque.querySelector('[data-pozo-repuesto]')?.value) || 0,
    monto: Number(bloque.querySelector('[data-pozo-monto]')?.value) || 0,
    /* Quién pone el IVA se pregunta después del documento (preguntarIvaDelPozo):
       sin DTE no hay IVA (dueño, 16-10-2026). */
    sin_iva: false
  };
}

function actualizarLineaAntesDeCobrar(bloque) {
  const cobrado = Number(bloque.dataset.cobrado) || 0;
  const pozo = leerLineaPozo(bloque);
  const modo = pozo?.modo || 'NO';
  bloque.querySelectorAll('[data-extra]').forEach(el => { el.style.display = el.dataset.extra === modo ? '' : 'none'; });
  const resultado = bloque.querySelector('[data-pozo-resultado]');
  if (resultado) {
    const falta = lineaPozoSinResponder(bloque);
    const monto = pozoDeLineaPrevio(cobrado, pozo);
    resultado.style.color = falta ? 'var(--red)' : '';
    resultado.innerHTML = falta
      ? 'Elige: ¿es tuyo o lo hizo C. Patricio (va a su pozo)?'
      : monto > 0
        ? `Al pozo: <b>${fmtCLP(monto)}</b>${monto < cobrado ? ` · para ti ${fmtCLP(cobrado - monto)}` : ''}` +
          (modo === 'OTRO' ? '' : '<br><small>Si sale con boleta o factura, después te pregunto quién pone el IVA.</small>')
        : 'No va al pozo';
  }
  actualizarBotonAntesDeCobrar();
}

function confirmarAntesDeCobrar() {
  const cuerpo = document.getElementById('antesDeCobrarCuerpo');
  if (!cuerpo) return cerrarAntesDeCobrar(true);

  const pendiente = [...cuerpo.querySelectorAll('[data-pozo-linea]')].find(lineaPozoSinResponder);
  if (pendiente) {
    showToast('Elige si el servicio va al pozo de C. Patricio o es tuyo', 'err');
    pendiente.querySelector('input[type="radio"]')?.focus();
    return;
  }

  // Primero se valida todo; el carrito solo se toca si no hay ningún error
  const elecciones = [];
  for (const bloque of cuerpo.querySelectorAll('[data-pozo-linea]')) {
    const cobrado = Number(bloque.dataset.cobrado) || 0;
    const pozo = leerLineaPozo(bloque);
    if (pozo?.modo === 'MENOS_REPUESTO' && pozo.repuesto > cobrado) {
      showToast('El repuesto no puede ser mayor que lo cobrado por el servicio', 'err');
      bloque.querySelector('[data-pozo-repuesto]')?.focus();
      return;
    }
    if (pozo?.modo === 'OTRO' && (pozo.monto <= 0 || pozo.monto > cobrado)) {
      showToast(pozo.monto <= 0 ? 'Escribe cuánto va al pozo, o marca "No va"' : 'Al pozo no puede ir más de lo cobrado', 'err');
      bloque.querySelector('[data-pozo-monto]')?.focus();
      return;
    }
    elecciones.push({ idx: Number(bloque.dataset.pozoLinea), pozo });
  }

  elecciones.forEach(({ idx, pozo }) => {
    const item = carritoAntesDeCobrar[idx];
    if (!item) return;
    if (pozo) item.pozo = pozo; else delete item.pozo;
  });
  cuerpo.querySelectorAll('[data-dueno-linea]').forEach(bloque => {
    const item = carritoAntesDeCobrar[Number(bloque.dataset.duenoLinea)];
    if (item) item.propietario = bloque.querySelector('input[type="radio"]:checked')?.value === 'PADRES' ? 'PADRES' : 'MIO';
  });
  cerrarAntesDeCobrar(true);
}

function cerrarAntesDeCobrar(seguir) {
  document.getElementById('modalAntesDeCobrar')?.classList.remove('show');
  const resolver = resolverAntesDeCobrar;
  resolverAntesDeCobrar = null;
  if (resolver) resolver(!!seguir);
}

/* ============================================================
   1b. ¿QUIÉN PONE EL IVA? (después de elegir el documento)
   ------------------------------------------------------------
   Dueño, 16-10-2026: "a veces es SIN DTE, entonces no existe IVA hasta que se
   haga la boleta". Por eso ya no se pregunta antes de cobrar: con SIN DTE no
   se pregunta nada y al pozo va lo cobrado; con boleta o factura se elige si
   el IVA lo pone C. Patricio (al pozo va el neto) o Sevelin (va completo).
   Resuelve true para seguir y false para volver al documento.
   ============================================================ */
let resolverIvaPozo = null;
let lineasIvaPozo = [];

function preguntarIvaDelPozo(carrito, tipoDte) {
  // Solo "todo" y "menos el repuesto": en "otro monto" vale lo escrito tal cual
  const lineas = (carrito || []).filter(i => i.pozo && (i.pozo.modo === 'TODO' || i.pozo.modo === 'MENOS_REPUESTO'));
  lineas.forEach(i => { i.pozo.sin_iva = false; });
  const modal = document.getElementById('modalIvaPozo');
  if (!lineas.length || !tipoDte || tipoDte === 'SIN DTE' || !modal) return Promise.resolve(true);

  lineasIvaPozo = lineas;
  const cobradoDe = (i) => Math.round(i.subtotal * factorAntesDeCobrar);
  const completo = lineas.reduce((a, i) => a + pozoDeLineaPrevio(cobradoDe(i), { ...i.pozo, sin_iva: false }), 0);
  const neto = lineas.reduce((a, i) => a + pozoDeLineaPrevio(cobradoDe(i), { ...i.pozo, sin_iva: true }), 0);
  const uno = lineas.length === 1;

  const cuerpo = document.getElementById('ivaPozoCuerpo');
  if (cuerpo) {
    cuerpo.innerHTML = `
      <p class="modal-hint">Esta venta sale con <b>${escHtml(tipoDte)}</b>. ${uno ? 'El servicio' : 'Los servicios'} de C. Patricio
        ${uno ? 'lleva' : 'llevan'} ${fmtCLP(completo - neto)} de IVA: ¿quién lo pone?</p>
      <div class="antes-opciones" role="radiogroup" aria-label="¿Quién pone el IVA?">
        <label class="antes-opcion"><input type="radio" name="ivaPozoQuien" value="PADRE"> C. Patricio: al pozo va ${fmtCLP(neto)} (sin el IVA)</label>
        <label class="antes-opcion"><input type="radio" name="ivaPozoQuien" value="SEVELIN"> Yo (Sevelin): al pozo va ${fmtCLP(completo)} (completo)</label>
      </div>`;
    cuerpo.querySelectorAll('input[name="ivaPozoQuien"]').forEach(r => r.addEventListener('change', () => {
      const btn = document.getElementById('btnIvaPozoSeguir');
      if (btn) btn.disabled = false;
    }));
  }
  const btn = document.getElementById('btnIvaPozoSeguir');
  if (btn) btn.disabled = true;
  modal.classList.add('show');
  setTimeout(() => cuerpo?.querySelector('input[type="radio"]')?.focus(), 60);
  return new Promise(resolve => { resolverIvaPozo = resolve; });
}

function confirmarIvaPozo() {
  const quien = document.querySelector('#ivaPozoCuerpo input[name="ivaPozoQuien"]:checked')?.value;
  if (!quien) { showToast('Elige quién pone el IVA', 'err'); return; }
  lineasIvaPozo.forEach(i => { i.pozo.sin_iva = quien === 'PADRE'; });
  cerrarIvaPozo(true);
}

function cerrarIvaPozo(seguir) {
  document.getElementById('modalIvaPozo')?.classList.remove('show');
  const resolver = resolverIvaPozo;
  resolverIvaPozo = null;
  lineasIvaPozo = [];
  if (resolver) resolver(!!seguir);
}

/* ============================================================
   2. FINANZAS → MIS PADRES
   ============================================================ */
let resumenPadres = null;
let corrigiendoPozo = null;   // { item_id, cobrado }

function panelPadresVisible() {
  return !!document.querySelector('[data-panel-finanzas="padres"].activo');
}

async function cargarPanelPadres() {
  if (!esAdmin()) return;
  const elMes = document.getElementById('padresPozoMes');
  if (elMes && !elMes.value) elMes.value = todayISO().slice(0, 7);
  try {
    resumenPadres = await API.padres.resumen(elMes?.value || '');
    pintarMercaderiaPadres(resumenPadres);
    pintarPozoPadres(resumenPadres);
  } catch (err) {
    showToast(err.message || 'No se pudo cargar el panel de tus padres', 'err');
  }
}

function tarjetaPadres(color, etiqueta, valor, pie) {
  return `<div class="kpi-card kpi-${color}">
    <div class="kpi-label">${escHtml(etiqueta)}</div>
    <div class="kpi-value">${escHtml(valor)}</div>
    <div class="kpi-foot">${escHtml(pie)}</div>
  </div>`;
}

function tablaPadres(titulo, encabezados, filas, vacio) {
  return `<h3 class="padres-subtitulo">${escHtml(titulo)}</h3>
    <div class="table-wrapper">
      <table class="data-table">
        <thead><tr>${encabezados.map(h => `<th>${escHtml(h)}</th>`).join('')}</tr></thead>
        <tbody>${filas.length ? filas.join('') : `<tr class="empty-row"><td colspan="${encabezados.length}">${escHtml(vacio)}</td></tr>`}</tbody>
      </table>
    </div>`;
}

function pintarMercaderiaPadres(r) {
  const m = r.mercaderia;
  const elAviso = document.getElementById('padresAvisoTope');
  const elKpis = document.getElementById('padresMercaderiaKpis');
  const elDetalle = document.getElementById('padresMercaderiaDetalle');
  if (!elKpis || !elDetalle) return;

  /* v138 (sql/94): la cuenta va A COSTO. Te la entregan a costo y pagas hasta el
     tope: lo que importa es si todo lo recibido vale más o menos que eso. */
  const c = m.a_costo || { en_stock: 0, vendido: 0, total: 0, unidades_en_stock: 0, unidades_vendidas: 0, por_confirmar: 0, sin_costo: 0, diferencia_con_tope: -m.tope, productos: [], productos_total: 0 };
  const dif = Number(c.diferencia_con_tope) || 0;
  const avisos = [];
  if (dif > 0) {
    avisos.push(`<div class="callout-warning"><b>La mercadería que llevas contada ya vale ${fmtCLP(c.total)} a costo</b>: ${fmtCLP(dif)} más que los ${fmtCLP(m.tope)} del acuerdo.</div>`);
  }
  if (c.por_confirmar > 0) {
    avisos.push(`<div class="callout-warning">⏳ ${c.por_confirmar === 1 ? 'Hay 1 producto con el costo al ojo' : `Hay ${c.por_confirmar} productos con el costo al ojo`}, por confirmar: el total a costo cambia cuando lo corrijas.</div>`);
  }
  if (m.productos.sin_costo > 0) {
    avisos.push(`<div class="callout-warning">${m.productos.sin_costo === 1 ? 'Hay 1 producto de tus padres sin costo' : `Hay ${m.productos.sin_costo} productos de tus padres sin costo`}: mientras siga en $0, Utilidades cuenta su venta como ganancia completa.</div>`);
  }
  if (elAviso) elAviso.innerHTML = avisos.join('');

  const pendientes = c.por_confirmar > 0 || c.sin_costo > 0;
  elKpis.innerHTML = [
    tarjetaPadres('blue', 'Recibido de ellos, a costo', fmtCLP(c.total),
      `${fmtCLP(c.en_stock)} en stock + ${fmtCLP(c.vendido)} ya vendido`),
    tarjetaPadres(dif > 0 ? 'red' : 'gold', `Contra los ${fmtCLP(m.tope)}`, dif > 0 ? `+${fmtCLP(dif)}` : dif < 0 ? `−${fmtCLP(-dif)}` : fmtCLP(0),
      (dif > 0 ? 'vale más que el acuerdo' : dif < 0 ? 'vale menos que el acuerdo' : 'vale justo el acuerdo') + (pendientes ? ' · todavía contando' : '')),
    tarjetaPadres('green', 'Pagado a ellos', fmtCLP(m.pagado),
      m.por_pagar > 0 ? `te falta pagar ${fmtCLP(m.por_pagar)} de ${fmtCLP(m.tope)}` : 'el acuerdo está pagado'),
    tarjetaPadres('violet', 'Vendido de ellos', fmtCLP(m.vendido),
      `${m.unidades} unidades al precio de venta · es ganancia tuya, no va al pozo`)
  ].join('');

  const filasCosto = c.productos.map(f => `<tr>
      <td>${escHtml(f.nombre)}${f.de_los_dos ? ' <small class="texto-apagado">(de los dos: solo lo vendido como de ellos)</small>' : ''}</td>
      <td>${Number(f.en_stock)}</td>
      <td>${Number(f.vendidas)}</td>
      <td>${f.sin_costo ? '<span class="badge badge-red">sin costo</span>' : fmtCLP(f.costo_unitario)}${f.por_confirmar ? ' <span class="badge badge-gold">⏳ al ojo</span>' : ''}</td>
      <td class="strong">${fmtCLP(f.total)}</td>
    </tr>`);
  if (filasCosto.length) {
    filasCosto.push(`<tr><td class="strong">Total${c.productos_total > c.productos.length ? ` (se muestran ${c.productos.length} de ${c.productos_total})` : ''}</td>
      <td class="strong">${Number(c.unidades_en_stock)}</td><td class="strong">${Number(c.unidades_vendidas)}</td><td></td><td class="strong">${fmtCLP(c.total)}</td></tr>`);
  }

  const filasPagos = m.pagos.map(p => `<tr>
      <td>${fechaCorta(p.fecha)}</td>
      <td class="strong">${fmtCLP(p.monto)}</td>
      <td>${escHtml(p.metodo_pago || '—')}</td>
      <td>${escHtml(p.descripcion || '—')}</td>
    </tr>`);
  const filasVentas = m.ventas.map(v => `<tr>
      <td>${fechaCorta(v.fecha)}</td>
      <td>#${escHtml(String(v.numero_orden ?? ''))}</td>
      <td>${escHtml(v.nombre)}</td>
      <td>${Number(v.cantidad)}</td>
      <td class="strong">${fmtCLP(v.monto)}</td>
    </tr>`);

  elDetalle.innerHTML =
    tablaPadres('Lo que te han entregado, producto por producto (a costo)', ['Producto', 'En stock', 'Vendidas', 'Costo c/u', 'Total a costo'], filasCosto,
      'Todavía no hay productos marcados "De mis padres". Márcalos en la ficha (¿De quién es?) o cárgalos con Productos → Carga masiva → "Me los entregaron mis padres".') +
    tablaPadres('Pagos a tus padres', ['Fecha', 'Monto', 'Medio', 'Detalle'], filasPagos,
      'Todavía no registras ningún pago. Usa el botón "Registrar pago a mis padres".') +
    tablaPadres(m.ventas_total > m.ventas.length ? `Últimas ${m.ventas.length} ventas de su mercadería (de ${m.ventas_total})` : 'Ventas de su mercadería',
      ['Fecha', 'Venta', 'Producto', 'Cant.', 'Cobrado'], filasVentas,
      'Aún no vendes nada marcado como "De mis padres". Márcalo en la ficha del producto: ¿De quién es?');
}

function pintarPozoPadres(r) {
  const p = r.pozo;
  const elAviso = document.getElementById('padresPozoAviso');
  const elKpis = document.getElementById('padresPozoKpis');
  const elDetalle = document.getElementById('padresPozoDetalle');
  if (!elKpis || !elDetalle) return;

  const avisos = [];
  if (!r.acuerdo.pozo_desde) {
    avisos.push(`<div class="callout-warning">El pozo todavía no parte: no hay mínimo corriendo. Cuando C. Patricio empiece,
      <button type="button" class="btn btn-outline btn-sm" id="btnPozoPartirHoy">▶️ Partir hoy</button></div>`);
  } else if (p.activo && p.falta_para_minimo > 0) {
    avisos.push(`<div class="callout-warning">Si el mes cerrara así, pones <b>${fmtCLP(p.falta_para_minimo)}</b> de tu bolsillo para llegar al mínimo de ${fmtCLP(p.minimo_mes)}. El pozo cuenta lo que se cobra por la caja y lo que se cobra en la app del taller.</div>`);
  }
  if (elAviso) elAviso.innerHTML = avisos.join('');

  const pieSugerido = p.saldo_anterior > 0 ? `incluye ${fmtCLP(p.saldo_anterior)} que quedó de meses anteriores`
    : p.saldo_anterior < 0 ? `ya descuenta ${fmtCLP(-p.saldo_anterior)} que le adelantaste antes`
    : 'lo mayor entre lo juntado y el mínimo, menos lo entregado';
  // v135: lo que cobró él mismo en la app ya lo tiene en la mano; no se le vuelve a entregar
  const enSuMano = Number(p.en_su_mano) || 0;
  const deLaApp = p.lineas.filter(l => l.origen === 'APP').length;
  elKpis.innerHTML = [
    tarjetaPadres('blue', 'Juntado en el mes', fmtCLP(p.juntado), `${p.lineas.length} ${p.lineas.length === 1 ? 'servicio cobrado' : 'servicios cobrados'}` + (deLaApp ? ` (${deLaApp} en la app del taller)` : ' en la caja')),
    tarjetaPadres('violet', 'Mínimo a la fecha', fmtCLP(p.minimo_a_la_fecha),
      p.activo ? `día ${p.dias_corridos} de ${p.dias_activos} · mínimo del mes ${fmtCLP(p.minimo_mes)}` : 'sin mínimo este mes'),
    tarjetaPadres('green', 'Entregado', fmtCLP(p.entregado), `${p.entregas.length} ${p.entregas.length === 1 ? 'entrega' : 'entregas'} en el mes` + (enSuMano > 0 ? ` · además ya cobró él ${fmtCLP(enSuMano)}` : '')),
    tarjetaPadres('gold', 'Para entregarle hoy', fmtCLP(p.sugerido_hoy), pieSugerido + (enSuMano > 0 ? ', menos lo que ya cobró él' : ''))
  ].join('');

  const filasLineas = p.lineas.map(l => `<tr>
      <td>${fechaCorta(l.fecha)}</td>
      <td>${l.origen === 'APP' ? `<span class="badge badge-blue" title="Registrado en la app del taller">📱 App #${Number(l.trabajo_id)}</span>` : '#' + escHtml(String(l.numero_orden ?? ''))}</td>
      <td>${escHtml(l.nombre)}${l.devuelto > 0 ? ` <span class="badge badge-gold">devuelto ${fmtCLP(l.devuelto)}</span>` : ''}</td>
      <td>${fmtCLP(l.cobrado)}</td>
      <td class="strong">${fmtCLP(l.pozo)}</td>
      <td>${escHtml(l.nota || '—')}</td>
      <td>${l.origen === 'APP' ? '<span class="texto-apagado" title="Se corrige en la app del taller">en la app</span>'
        : `<button type="button" class="btn btn-outline btn-sm" data-pozo-corregir="${Number(l.item_id)}" data-cobrado="${Number(l.cobrado)}" data-pozo="${Number(l.pozo)}" data-nombre="${escHtml(l.nombre)}">Corregir</button>`}</td>
    </tr>`);
  const filasEntregas = p.entregas.map(e => `<tr>
      <td>${fechaCorta(e.fecha)}</td>
      <td class="strong">${fmtCLP(e.monto)}</td>
      <td>${escHtml(e.metodo_pago || '—')}</td>
      <td>${escHtml(e.descripcion || '—')}</td>
    </tr>`);
  const filasSinPozo = p.servicios_sin_pozo.map(l => `<tr>
      <td>${fechaCorta(l.fecha)}</td>
      <td>#${escHtml(String(l.numero_orden ?? ''))}</td>
      <td>${escHtml(l.nombre)}</td>
      <td>${fmtCLP(l.cobrado)}</td>
      <td><button type="button" class="btn btn-outline btn-sm" data-pozo-corregir="${Number(l.item_id)}" data-cobrado="${Number(l.cobrado)}" data-pozo="0" data-nombre="${escHtml(l.nombre)}">Sumar al pozo</button></td>
    </tr>`);

  elDetalle.innerHTML =
    tablaPadres('Servicios que fueron al pozo', ['Fecha', 'Venta', 'Servicio', 'Cobrado', 'Al pozo', 'Cómo', ''], filasLineas,
      'Ningún servicio fue al pozo este mes. Se marca al cobrar: la caja pregunta cuando el servicio dice "Lo hace C. Patricio", o se registra en la app del taller.') +
    tablaPadres('Entregas a C. Patricio', ['Fecha', 'Monto', 'Medio', 'Detalle'], filasEntregas,
      'Sin entregas este mes. Usa el botón "Entregar a C. Patricio".') +
    (filasSinPozo.length
      ? tablaPadres('Otros servicios del mes que no fueron al pozo', ['Fecha', 'Venta', 'Servicio', 'Cobrado', ''], filasSinPozo, '')
      : '');
}

/* ---------- Acciones del panel ---------- */
function registrarPagoPadres() {
  if (!resumenPadres || typeof abrirGastoPrellenado !== 'function') return;
  const m = resumenPadres.mercaderia;
  if (m.por_pagar <= 0) showToast('Según el acuerdo ya les pagaste todo; igual puedes anotar otro pago', 'ok');
  abrirGastoPrellenado({
    monto: m.por_pagar > 0 ? Math.min(m.cuota_semanal, m.por_pagar) : m.cuota_semanal,
    descripcion: 'Pago a mis padres por su mercadería',
    proveedor: 'Mis padres',
    clasificacion: resumenPadres.clasificaciones.mercaderia
  });
}

function registrarEntregaPozo() {
  if (!resumenPadres || typeof abrirGastoPrellenado !== 'function') return;
  const p = resumenPadres.pozo;
  abrirGastoPrellenado({
    monto: p.sugerido_hoy,
    descripcion: `Entrega del pozo a C. Patricio (${p.mes.slice(5)}-${p.mes.slice(0, 4)})`,
    proveedor: 'C. Patricio',
    clasificacion: resumenPadres.clasificaciones.pozo
  });
}

function abrirAjustesAcuerdo() {
  if (!resumenPadres) return;
  const a = resumenPadres.acuerdo;
  const poner = (id, valor) => { const el = document.getElementById(id); if (el) el.value = valor ?? ''; };
  poner('acuerdoTope', a.tope_mercaderia);
  poner('acuerdoCuota', a.cuota_semanal);
  poner('acuerdoPozoMinimo', a.pozo_minimo_mensual);
  poner('acuerdoPozoDesde', a.pozo_desde || '');
  document.getElementById('modalAcuerdoPadres')?.classList.add('show');
}

async function guardarAjustesAcuerdo() {
  const leer = (id) => document.getElementById(id)?.value ?? '';
  const montos = { tope_mercaderia: leer('acuerdoTope'), cuota_semanal: leer('acuerdoCuota'), pozo_minimo_mensual: leer('acuerdoPozoMinimo') };
  for (const [campo, valor] of Object.entries(montos)) {
    if (valor === '' || Number(valor) < 0) { showToast('Revisa los montos: no pueden quedar vacíos ni negativos', 'err'); return; }
    montos[campo] = Number(valor);
  }
  try {
    await API.padres.guardarAcuerdo({ ...montos, pozo_desde: leer('acuerdoPozoDesde') || null });
    cerrarModal('modalAcuerdoPadres');
    showToast('Acuerdo actualizado', 'ok');
    cargarPanelPadres();
  } catch (err) {
    showToast(err.message || 'No se pudo guardar el acuerdo', 'err');
  }
}

async function partirPozoHoy() {
  try {
    await API.padres.guardarAcuerdo({ pozo_desde: todayISO() });
    showToast('El pozo corre desde hoy', 'ok');
    cargarPanelPadres();
  } catch (err) {
    showToast(err.message || 'No se pudo partir el pozo', 'err');
  }
}

function abrirCorregirPozo(boton) {
  corrigiendoPozo = { item_id: Number(boton.dataset.pozoCorregir), cobrado: Number(boton.dataset.cobrado) || 0 };
  const elResumen = document.getElementById('corregirPozoResumen');
  // textContent: el nombre del servicio lo escribe una persona
  if (elResumen) elResumen.textContent = `${boton.dataset.nombre || 'Servicio'} · cobrado ${fmtCLP(corrigiendoPozo.cobrado)}`;
  const elMonto = document.getElementById('corregirPozoMonto');
  if (elMonto) {
    elMonto.max = String(corrigiendoPozo.cobrado);
    elMonto.value = Number(boton.dataset.pozo) > 0 ? Number(boton.dataset.pozo) : corrigiendoPozo.cobrado;
  }
  document.getElementById('modalCorregirPozo')?.classList.add('show');
  setTimeout(() => { elMonto?.focus(); elMonto?.select(); }, 80);
}

async function guardarCorregirPozo() {
  if (!corrigiendoPozo) return;
  const monto = Math.round(Number(document.getElementById('corregirPozoMonto')?.value) || 0);
  if (monto < 0 || monto > corrigiendoPozo.cobrado) {
    showToast('Al pozo no puede ir más de lo cobrado por ese servicio', 'err');
    return;
  }
  try {
    await API.padres.corregirPozo(corrigiendoPozo.item_id, monto > 0 ? monto : null);
    cerrarModal('modalCorregirPozo');
    corrigiendoPozo = null;
    showToast(monto > 0 ? 'Pozo corregido' : 'Ese servicio ya no va al pozo', 'ok');
    cargarPanelPadres();
  } catch (err) {
    showToast(err.message || 'No se pudo corregir el pozo', 'err');
  }
}

document.addEventListener('DOMContentLoaded', () => {
  // --- Antes de cobrar ---
  const cuerpo = document.getElementById('antesDeCobrarCuerpo');
  if (cuerpo) {
    const alCambiar = (e) => {
      const bloque = e.target.closest('[data-pozo-linea]');
      if (bloque) actualizarLineaAntesDeCobrar(bloque);
    };
    cuerpo.addEventListener('change', alCambiar);
    cuerpo.addEventListener('input', alCambiar);
  }
  document.getElementById('btnAntesDeCobrarSeguir')?.addEventListener('click', confirmarAntesDeCobrar);
  document.getElementById('btnIvaPozoSeguir')?.addEventListener('click', confirmarIvaPozo);
  document.getElementById('btnIvaPozoVolver')?.addEventListener('click', () => cerrarIvaPozo(false));
  document.getElementById('modalIvaPozo')?.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') { e.preventDefault(); cerrarIvaPozo(false); }
    else if (e.key === 'Enter') { e.preventDefault(); confirmarIvaPozo(); }
  });
  document.getElementById('btnAntesDeCobrarCancelar')?.addEventListener('click', () => cerrarAntesDeCobrar(false));
  document.getElementById('modalAntesDeCobrar')?.addEventListener('click', (e) => {
    if (e.target.id === 'modalAntesDeCobrar') cerrarAntesDeCobrar(false);
  });
  // Enter sigue al pago desde cualquier campo (en un botón ya hace su propio clic)
  document.getElementById('modalAntesDeCobrar')?.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter' || e.target.closest('button')) return;
    e.preventDefault();
    confirmarAntesDeCobrar();
  });

  // --- Panel Mis padres ---
  // (la carga al entrar la dispara mostrarPanelFinanzas, en js/balance.js)
  document.getElementById('padresPozoMes')?.addEventListener('change', cargarPanelPadres);
  document.getElementById('btnPadresPagar')?.addEventListener('click', registrarPagoPadres);
  document.getElementById('btnPadresEntregar')?.addEventListener('click', registrarEntregaPozo);
  document.getElementById('btnPadresAjustes')?.addEventListener('click', abrirAjustesAcuerdo);
  document.getElementById('btnAcuerdoGuardar')?.addEventListener('click', guardarAjustesAcuerdo);
  document.getElementById('btnAcuerdoCancelar')?.addEventListener('click', () => cerrarModal('modalAcuerdoPadres'));
  document.getElementById('btnCorregirPozoGuardar')?.addEventListener('click', guardarCorregirPozo);
  document.getElementById('btnCorregirPozoCancelar')?.addEventListener('click', () => cerrarModal('modalCorregirPozo'));
  ['modalAcuerdoPadres', 'modalCorregirPozo'].forEach(id => {
    document.getElementById(id)?.addEventListener('click', (e) => { if (e.target.id === id) cerrarModal(id); });
  });
  document.querySelector('[data-panel-finanzas="padres"]')?.addEventListener('click', (e) => {
    const corregir = e.target.closest('[data-pozo-corregir]');
    if (corregir) return abrirCorregirPozo(corregir);
    if (e.target.closest('#btnPozoPartirHoy')) partirPozoHoy();
  });

  // Un pago o una entrega recién guardados (Registrar Gasto) refrescan el panel
  document.addEventListener('pos:movimiento-dinero', () => { if (panelPadresVisible()) cargarPanelPadres(); });
});
