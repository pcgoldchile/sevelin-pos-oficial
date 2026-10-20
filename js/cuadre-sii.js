// ==========================================
// CUADRE-SII.JS — Cuadrar con el SII (v169, sql/108)
// ------------------------------------------
// Pedido del dueño (20-10-2026): "que cuadrar con el SII me permita registrar las compras y
// ventas, y queden como pendientes… para yo rellenarlas, y que me salgan en notis".
//
//   · Finanzas → 🧾 Cuadrar con el SII: por mes, cada boleta emitida y cada factura recibida
//     del RCV contra las ventas y los gastos del POS.
//   · Propuestas: lo que calza por monto y fecha. Nada se anota sin su clic ("Confirmar").
//   · Boleta sin venta → "Registrar la venta": abre la caja con la fecha de la boleta, fuera
//     de la caja de hoy, y al cobrar le anota el N° de boleta.
//   · Factura sin gasto → "Crear el gasto" (una o varias del mismo proveedor).
//   · Chip "🧾 SII: N por cuadrar" en el encabezado (solo admin).
// Las facturas de TUU (Haulmer), Banchile y Khipu son las comisiones de las máquinas: el
// servidor las aparta solas, porque esa comisión ya se descuenta venta por venta.
// ==========================================

const CUADRE_SII_INTERVALO_MS = 30 * 60 * 1000;
const CUADRE_SII_CLAVE_VENTA = 'sevelin.cuadreSii.ventaEnCurso';
let cuadreSiiDatos = null;
let cuadreSiiAviso = null;
let cuadreSiiIntervalo = null;
let cuadreSiiVentaEnCurso = null;     // la boleta que se está registrando en la caja
let cuadreSiiModalAccion = null;      // qué hace el botón "Aceptar" del modal

const cuadreSiiMesTexto = (periodo) => {
  const nombres = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
  return `${nombres[Number(String(periodo).slice(4, 6)) - 1] || ''} ${String(periodo).slice(0, 4)}`;
};
const cuadreSiiOrden = (v) => `#${String(v?.numero_orden ?? v?.id ?? '').padStart(5, '0')}`;
const cuadreSiiTipoDoc = (t) => ({ 33: 'Factura', 34: 'Factura exenta', 39: 'Boleta', 41: 'Boleta exenta', 46: 'Factura de compra', 914: 'Importación (DIN)' }[Number(t)] || `Documento ${t}`);

function cuadreSiiPeriodoElegido() {
  const v = document.getElementById('cuadreSiiMes')?.value || '';
  return /^\d{4}-\d{2}$/.test(v) ? v.replace('-', '') : '';
}
/* Por defecto, el mes cerrado anterior: es el que se declara en el F29 */
function cuadreSiiMesPorDefecto() {
  const [a, m] = todayISO().split('-').map(Number);
  const d = new Date(Date.UTC(a, m - 2, 1));
  return d.toISOString().slice(0, 7);
}

document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('cuadreSiiMes')?.addEventListener('change', cargarCuadreSii);
  document.getElementById('btnCuadreSiiActualizar')?.addEventListener('click', cargarCuadreSii);
  document.getElementById('btnCuadreSiiSubir')?.addEventListener('click', () => document.getElementById('cuadreSiiArchivo')?.click());
  document.getElementById('cuadreSiiArchivo')?.addEventListener('change', cuadreSiiSubirCsv);
  document.getElementById('btnCuadreSiiModalCancelar')?.addEventListener('click', () => cerrarModal('modalCuadreSii'));
  document.getElementById('btnCuadreSiiModalOk')?.addEventListener('click', () => { if (cuadreSiiModalAccion) cuadreSiiModalAccion(); });
  document.getElementById('modalCuadreSii')?.addEventListener('click', (e) => { if (e.target.id === 'modalCuadreSii') cerrarModal('modalCuadreSii'); });
  document.getElementById('btnSiiPorCuadrar')?.addEventListener('click', cuadreSiiIrDesdeAviso);
  /* Un solo listener para todos los botones del panel */
  document.querySelector('[data-panel-finanzas="sii"]')?.addEventListener('click', cuadreSiiClicPanel);
  document.getElementById('cuadreSiiBannerPos')?.addEventListener('click', (e) => {
    if (e.target.closest('[data-cuadre-cancelar]')) cuadreSiiCancelarVenta();
  });
  const mes = document.getElementById('cuadreSiiMes');
  if (mes && !mes.value) mes.value = cuadreSiiMesPorDefecto();
});

document.addEventListener('pos:sesion-iniciada', () => {
  if (cuadreSiiIntervalo) { clearInterval(cuadreSiiIntervalo); cuadreSiiIntervalo = null; }
  const btn = document.getElementById('btnSiiPorCuadrar');
  if (!esAdmin()) { if (btn) btn.hidden = true; cuadreSiiCancelarVenta(true); return; }
  actualizarAvisoCuadreSii();
  cuadreSiiIntervalo = setInterval(actualizarAvisoCuadreSii, CUADRE_SII_INTERVALO_MS);
  /* Una boleta que se estaba registrando antes de recargar la página */
  try {
    const guardada = JSON.parse(sessionStorage.getItem(CUADRE_SII_CLAVE_VENTA) || 'null');
    if (guardada?.doc_id) { cuadreSiiVentaEnCurso = guardada; cuadreSiiPintarBanner(); }
  } catch (_) { /* sin sessionStorage: se pierde, no pasa nada */ }
});

/* ------------------------------------------------------------
   Aviso del encabezado
   ------------------------------------------------------------ */
async function actualizarAvisoCuadreSii() {
  const btn = document.getElementById('btnSiiPorCuadrar');
  const texto = document.getElementById('textoSiiPorCuadrar');
  if (!btn || !texto || !tokenActual() || !esAdmin()) return;
  try {
    cuadreSiiAviso = await API.balance.cuadreSiiAviso();
    const n = (Number(cuadreSiiAviso?.ventas) || 0) + (Number(cuadreSiiAviso?.compras) || 0);
    const falta = cuadreSiiAviso?.falta_csv_ventas;
    if (!n && !falta) { btn.hidden = true; return; }
    texto.textContent = n ? `SII: ${n} por cuadrar` : 'SII: faltan tus boletas';
    const partes = [];
    if (cuadreSiiAviso.ventas) partes.push(`${cuadreSiiAviso.ventas} boleta(s) sin su venta en el POS (${fmtCLP(cuadreSiiAviso.monto_ventas)})`);
    if (cuadreSiiAviso.compras) partes.push(`${cuadreSiiAviso.compras} factura(s) sin su gasto (${fmtCLP(cuadreSiiAviso.monto_compras)})`);
    if (falta) partes.push(`falta subir las boletas de ${cuadreSiiMesTexto(falta)}`);
    btn.title = `Cuadrar con el SII: ${partes.join(' · ')}`;
    btn.hidden = false;
  } catch (err) {
    console.error('Error al revisar el cuadre con el SII:', err.message || err);
  }
}

function cuadreSiiIrDesdeAviso() {
  const mes = document.getElementById('cuadreSiiMes');
  const periodos = cuadreSiiAviso?.periodos || [];
  /* El mes más antiguo con algo pendiente; si solo faltan boletas, ese mes */
  const destino = periodos[0] || cuadreSiiAviso?.falta_csv_ventas;
  if (mes && destino) mes.value = `${destino.slice(0, 4)}-${destino.slice(4)}`;
  /* Por el menú, para que pase por la clave de Finanzas igual que siempre */
  document.querySelector('.nav-subitem[data-view="view-finanzas"][data-subtab="sii"]')?.click();
}

/* ------------------------------------------------------------
   Panel
   ------------------------------------------------------------ */
async function cargarCuadreSii() {
  const cont = document.getElementById('cuadreSiiContenido');
  const mes = document.getElementById('cuadreSiiMes');
  if (mes && !mes.value) mes.value = cuadreSiiMesPorDefecto();
  const periodo = cuadreSiiPeriodoElegido();
  if (!cont || !periodo) return;
  cont.innerHTML = '<p class="modal-hint">Cruzando el SII con tus ventas y gastos…</p>';
  try {
    cuadreSiiDatos = await API.balance.cuadreSii(periodo);
    cuadreSiiPintar();
  } catch (err) {
    cont.innerHTML = `<p class="modal-hint" style="color:var(--red);">${escHtml(err.message || 'No se pudo cargar el cuadre')}</p>`;
  }
}

function cuadreSiiKpi(etiqueta, valor, pie, color = '') {
  return `<div class="kpi-card${color ? ' kpi-' + color : ''}">
    <div class="kpi-label">${escHtml(etiqueta)}</div>
    <div class="kpi-value">${escHtml(valor)}</div>
    <div class="kpi-foot">${escHtml(pie)}</div>
  </div>`;
}

function cuadreSiiTextoVenta(v) {
  if (!v) return 'venta';
  const tipo = v.tipo_dte && v.tipo_dte !== 'SIN DTE' ? ` · marcada ${v.tipo_dte === 'FACTURA' ? 'con factura' : 'con boleta'}` : ' · marcada sin boleta';
  return `Venta ${cuadreSiiOrden(v)} · ${fechaCortaAviso(v.fecha)} · ${fmtCLP(v.total)}${v.metodo_pago ? ' · ' + v.metodo_pago : ''}${tipo}${v.cliente ? ' · ' + v.cliente : ''}`;
}
function cuadreSiiTextoGasto(c) {
  if (!c) return 'gasto';
  return `Gasto #${c.id} · ${fechaCortaAviso(c.dia || c.fecha)} · ${c.proveedor || 'sin proveedor'} · ${fmtCLP(c.costo_total)}${c.descripcion ? ' · ' + c.descripcion : ''}`;
}
function cuadreSiiTextoDoc(x) {
  const quien = x.operacion === 'COMPRA' ? ` · ${x.razon_social || x.rut}` : '';
  return `${cuadreSiiTipoDoc(x.tipo_doc)} N° ${x.folio} · ${fechaCortaAviso(x.fecha_doc)}${quien} · ${fmtCLP(x.total)}`;
}

function cuadreSiiPintar() {
  const cont = document.getElementById('cuadreSiiContenido');
  const d = cuadreSiiDatos;
  if (!cont || !d) return;
  const r = d.resumen;
  const ventasPend = d.ventas.filter(x => x.cuadre_estado === 'pendiente');
  const comprasPend = d.compras.filter(x => x.cuadre_estado === 'pendiente');
  const conProp = [...ventasPend, ...comprasPend].filter(x => x.propuesta);
  const boletasSinVenta = ventasPend.filter(x => !x.propuesta);
  const facturasSinGasto = comprasPend.filter(x => !x.propuesta);

  const avisos = [];
  if (!d.hay_boletas) {
    avisos.push(`<div class="cuadre-sii-aviso">📤 <b>Faltan las boletas de ${escHtml(cuadreSiiMesTexto(d.periodo))}.</b> En el SII entra a
      <b>Registro de Compras y Ventas → Ventas → ${escHtml(cuadreSiiMesTexto(d.periodo))}</b>, descarga el detalle (CSV) y súbelo con
      "Subir boletas". El robot lo intenta solo cada mañana, pero el SII no siempre lo entrega.</div>`);
  }
  if (d.ultima_sync) avisos.push(`<p class="modal-hint">Datos del SII al ${escHtml(tsAChile(d.ultima_sync.creado_en))}${d.ultima_sync.ok ? '' : ' (la última lectura falló)'}.</p>`);

  const kpis = `<div class="kpi-grid">
    ${cuadreSiiKpi('🧾 Boletas del SII', d.hay_boletas ? `${r.ventas.asociado} de ${r.ventas.total}` : '—', d.hay_boletas ? 'con su venta en el POS' : 'faltan las boletas', r.ventas.pendiente ? 'gold' : 'green')}
    ${cuadreSiiKpi('🛒 Boletas por resolver', fmtCLP(r.ventas.monto_pendiente), `${r.ventas.pendiente} boleta(s)${r.ventas.propuestas ? `, ${r.ventas.propuestas} ya con propuesta` : ''}`, r.ventas.pendiente ? 'red' : 'green')}
    ${cuadreSiiKpi('📑 Facturas recibidas', `${r.compras.asociado + r.compras.comision + r.compras.ignorado} de ${r.compras.total}`, `resueltas (${r.compras.comision} son comisiones)`, r.compras.pendiente ? 'gold' : 'green')}
    ${cuadreSiiKpi('💸 Facturas por resolver', fmtCLP(r.compras.monto_pendiente), `${r.compras.pendiente} factura(s)${r.compras.propuestas ? `, ${r.compras.propuestas} ya con propuesta` : ''}`, r.compras.pendiente ? 'red' : 'green')}
  </div>`;

  cont.innerHTML = `${avisos.join('')}${kpis}
    ${cuadreSiiSeccionPropuestas(conProp)}
    ${cuadreSiiSeccionBoletas(boletasSinVenta)}
    ${cuadreSiiSeccionFacturas(facturasSinGasto)}
    ${cuadreSiiSeccionOtros()}`;
}

function cuadreSiiSeccionPropuestas(lista) {
  if (!lista.length) return '';
  /* Las facturas que juntas suman un gasto van en una sola fila */
  const filas = [];
  const vistos = new Set();
  for (const x of lista) {
    if (vistos.has(x.id)) continue;
    const grupo = x.propuesta.grupo ? lista.filter(y => x.propuesta.grupo.includes(y.id)) : [x];
    grupo.forEach(y => vistos.add(y.id));
    const p = x.propuesta;
    const destino = p.nc ? `Anulada con la nota de crédito N° ${p.nc.folio} (${fechaCortaAviso(p.nc.fecha_doc)})`
      : p.venta_id ? cuadreSiiTextoVenta(p.venta) : cuadreSiiTextoGasto(p.compra);
    const datos = JSON.stringify(grupo.map(y => ({ doc_id: y.id, venta_id: p.venta_id || undefined, compra_id: p.compra_id || undefined, nc_id: p.nc?.id })));
    const alta = p.confianza === 'alta';
    filas.push(`
      <label class="cuadre-sii-fila cuadre-sii-propuesta">
        <input type="checkbox" class="cuadre-sii-marca" data-propuesta='${escHtml(datos)}' ${alta ? 'checked' : ''}>
        <span class="cuadre-sii-texto">
          <strong>${grupo.map(y => escHtml(cuadreSiiTextoDoc(y))).join('<br>')}</strong>
          <small>→ ${escHtml(destino)}</small>
          <small>${escHtml(p.motivo || '')}</small>
        </span>
        <span class="badge ${alta ? 'badge-green' : 'badge-gold'}">${alta ? 'Segura' : 'Revisar'}</span>
      </label>`);
  }
  return `<div class="cuadre-sii-bloque">
    <div class="cuadre-sii-bloque-cabeza">
      <div><h3>✅ Calzan por monto y fecha (${filas.length})</h3>
      <p class="modal-hint">Las "seguras" ya vienen marcadas. Las de "revisar" tienen otra del mismo monto cerca: márcalas solo si te acuerdas.
      Al confirmar, la venta queda con su N° de boleta (y marcada con boleta).</p></div>
      <button class="btn btn-primary" type="button" data-cuadre-accion="confirmar">✅ Confirmar las marcadas</button>
    </div>
    ${filas.join('')}
  </div>`;
}

function cuadreSiiSeccionBoletas(lista) {
  if (!lista.length) return '';
  const reaj = cuadreSiiUltimoReajuste();
  const filas = lista.map(x => `
    <div class="cuadre-sii-fila">
      <span class="cuadre-sii-texto">
        <strong>${escHtml(cuadreSiiTextoDoc(x))}</strong>
        <small>${x.sugerencias.length ? `Podría ser: ${x.sugerencias.map(v => escHtml(cuadreSiiOrden(v))).join(', ')}` : 'No hay ninguna venta de ese monto esos días.'}
        ${reaj && x.fecha_doc <= reaj ? ' · es de antes de tu último reajuste del saldo' : ''}</small>
      </span>
      <span class="cuadre-sii-acciones">
        <button class="btn btn-primary btn-sm" type="button" data-cuadre-accion="registrar" data-id="${x.id}">🛒 Registrar la venta</button>
        <button class="btn btn-outline btn-sm" type="button" data-cuadre-accion="asociar" data-id="${x.id}">🔗 Es de otra venta</button>
        <button class="btn btn-ghost btn-sm" type="button" data-cuadre-accion="ignorar" data-id="${x.id}">No corresponde</button>
      </span>
    </div>`).join('');
  return `<div class="cuadre-sii-bloque">
    <div class="cuadre-sii-bloque-cabeza"><div>
      <h3>🛒 Boletas que no están en el POS (${lista.length} · ${fmtCLP(lista.reduce((s, x) => s + num(x.total), 0))})</h3>
      <p class="modal-hint">Emitiste la boleta pero la venta no se anotó (como la RTX 5060). "Registrar la venta" abre la caja con la fecha de la boleta:
      agregas lo que se vendió y cobras como siempre. No entra en la caja de hoy y queda con el N° de boleta.</p>
    </div></div>
    ${filas}
  </div>`;
}

function cuadreSiiSeccionFacturas(lista) {
  if (!lista.length) return '';
  /* Agrupadas por proveedor y día: varias facturas de una misma compra van a un solo gasto */
  const grupos = new Map();
  lista.forEach(x => { const k = `${x.rut}|${x.fecha_doc}`; grupos.set(k, [...(grupos.get(k) || []), x]); });
  const bloques = [...grupos.values()].map(g => {
    const total = g.reduce((s, x) => s + num(x.total), 0);
    const filas = g.map(x => `
      <div class="cuadre-sii-fila">
        ${g.length > 1 ? `<input type="checkbox" class="cuadre-sii-factura" data-id="${x.id}" data-rut="${escHtml(x.rut)}" checked aria-label="Incluir en el gasto">` : ''}
        <span class="cuadre-sii-texto">
          <strong>${escHtml(cuadreSiiTipoDoc(x.tipo_doc))} N° ${escHtml(String(x.folio))} · ${fmtCLP(x.total)}</strong>
          <small>IVA ${fmtCLP(x.iva)}${x.sugerencias.length && !x.sugerencias[0].tomado ? ` · el gasto más parecido: ${escHtml(cuadreSiiTextoGasto(x.sugerencias[0]))}` : ''}</small>
        </span>
        <span class="cuadre-sii-acciones">
          <button class="btn btn-primary btn-sm" type="button" data-cuadre-accion="gasto" data-id="${x.id}">💸 Crear el gasto</button>
          <button class="btn btn-outline btn-sm" type="button" data-cuadre-accion="asociar" data-id="${x.id}">🔗 Ya está en otro gasto</button>
          <button class="btn btn-ghost btn-sm" type="button" data-cuadre-accion="ignorar" data-id="${x.id}">No corresponde</button>
        </span>
      </div>`).join('');
    return `<div class="cuadre-sii-grupo">
      <div class="cuadre-sii-grupo-cabeza">
        <span><b>${escHtml(g[0].razon_social || g[0].rut)}</b> · ${escHtml(fechaCortaAviso(g[0].fecha_doc))}${g.length > 1 ? ` · ${g.length} facturas, ${fmtCLP(total)}` : ''}</span>
        ${g.length > 1 ? `<button class="btn btn-outline btn-sm" type="button" data-cuadre-accion="gasto-grupo" data-rut="${escHtml(g[0].rut)}" data-fecha="${escHtml(g[0].fecha_doc)}">💸 Un solo gasto con las marcadas</button>` : ''}
      </div>
      ${filas}
    </div>`;
  }).join('');
  return `<div class="cuadre-sii-bloque">
    <div class="cuadre-sii-bloque-cabeza"><div>
      <h3>💸 Facturas recibidas sin su gasto en Finanzas (${lista.length} · ${fmtCLP(lista.reduce((s, x) => s + num(x.total), 0))})</h3>
      <p class="modal-hint">Compras con factura que no se anotaron en Gastos. Al crear el gasto suma su IVA como crédito en tus cálculos del POS.
      Si la compra es mercadería que ya cargaste al stock, igual hay que crear el gasto: el stock y la plata van por separado.</p>
    </div></div>
    ${bloques}
  </div>`;
}

function cuadreSiiSeccionOtros() {
  const d = cuadreSiiDatos;
  const partes = [];
  const sinFactura = d.compras.filter(x => x.cuadre_estado === 'asociado' && x.compra_sin_factura);
  const vistosGasto = new Set();
  const filasSinFactura = sinFactura.filter(x => !vistosGasto.has(x.compra?.id) && vistosGasto.add(x.compra?.id)).map(x => `
    <div class="cuadre-sii-fila">
      <span class="cuadre-sii-texto"><strong>${escHtml(cuadreSiiTextoGasto(x.compra))}</strong>
      <small>Tiene factura en el SII (IVA ${fmtCLP(x.iva_de_las_facturas)}) pero en el POS no está marcada: su IVA no suma crédito.</small></span>
      <span class="cuadre-sii-acciones"><button class="btn btn-primary btn-sm" type="button" data-cuadre-accion="marcar-factura" data-id="${x.id}">🧾 Marcar la factura</button></span>
    </div>`).join('');
  if (filasSinFactura) partes.push(`<div class="cuadre-sii-bloque"><h3>🧾 Gastos sin la factura marcada</h3>${filasSinFactura}</div>`);

  if (d.pos_sin_documento?.length) {
    partes.push(`<details class="cuadre-sii-detalle"><summary>⚠️ Ventas marcadas con boleta que no aparecen en el SII (${d.pos_sin_documento.length})</summary>
      <p class="modal-hint">En el POS dicen "boleta", pero el SII no tiene ninguna boleta de ese monto esos días. Puede que se haya marcado por error,
      o que la boleta sea del mes siguiente. Si no hubo boleta, quítasela: así el IVA que calcula el POS no queda inflado.</p>
      ${d.pos_sin_documento.map(v => `<div class="cuadre-sii-fila"><span class="cuadre-sii-texto"><strong>${escHtml(cuadreSiiTextoVenta(v))}</strong>${v.dte_folio ? `<small>N° anotado: ${escHtml(v.dte_folio)}</small>` : ''}</span>
        <span class="cuadre-sii-acciones"><button class="btn btn-ghost btn-sm" type="button" data-cuadre-accion="sin-boleta" data-venta="${v.id}">Fue sin boleta</button></span></div>`).join('')}
    </details>`);
  }

  const comis = d.compras.filter(x => x.cuadre_estado === 'comision');
  if (comis.length) {
    partes.push(`<details class="cuadre-sii-detalle"><summary>💳 Facturas de comisiones de las máquinas de pago (${comis.length})</summary>
      <p class="modal-hint">TUU (Haulmer), Banchile y Khipu te facturan la comisión que cobran por cada pago con tarjeta. No se anotan como gasto
      porque el POS ya descuenta esa comisión en cada venta; su IVA sí es crédito fiscal y ya está en tu RCV.</p>
      ${(d.comisiones || []).map(m => `<p class="modal-hint">Comisiones de ${escHtml(cuadreSiiMesTexto(m.mes.replace('-', '')))}: facturado <b>${fmtCLP(m.facturado)}</b> (IVA ${fmtCLP(m.iva)}) · el POS calculó <b>${fmtCLP(m.pos)}</b>${Math.abs(m.facturado - m.pos) > 2000 ? ' · hay diferencia: revisa la tasa de las máquinas o ventas con tarjeta sin anotar' : ''}.</p>`).join('')}
      ${comis.map(x => `<div class="cuadre-sii-fila"><span class="cuadre-sii-texto"><small>${escHtml(cuadreSiiTextoDoc(x))}</small></span>
        <span class="cuadre-sii-acciones"><button class="btn btn-ghost btn-sm" type="button" data-cuadre-accion="reabrir" data-id="${x.id}">No es comisión</button></span></div>`).join('')}
    </details>`);
  }

  const hechas = [...d.ventas, ...d.compras].filter(x => x.cuadre_estado === 'asociado');
  if (hechas.length) {
    partes.push(`<details class="cuadre-sii-detalle"><summary>✔ Ya cuadradas (${hechas.length})</summary>
      ${hechas.map(x => `<div class="cuadre-sii-fila"><span class="cuadre-sii-texto"><small><b>${escHtml(cuadreSiiTextoDoc(x))}</b> → ${escHtml(x.venta ? cuadreSiiTextoVenta(x.venta) : cuadreSiiTextoGasto(x.compra))}${x.cuadrado_por ? ` · ${escHtml(x.cuadrado_por)}` : ''}</small></span>
        <span class="cuadre-sii-acciones"><button class="btn btn-ghost btn-sm" type="button" data-cuadre-accion="reabrir" data-id="${x.id}">Deshacer</button></span></div>`).join('')}
    </details>`);
  }
  const ignoradas = [...d.ventas, ...d.compras].filter(x => x.cuadre_estado === 'ignorado');
  if (ignoradas.length) {
    partes.push(`<details class="cuadre-sii-detalle"><summary>🚫 No corresponden (${ignoradas.length})</summary>
      ${ignoradas.map(x => `<div class="cuadre-sii-fila"><span class="cuadre-sii-texto"><small><b>${escHtml(cuadreSiiTextoDoc(x))}</b> · ${escHtml(x.cuadre_nota || '')}</small></span>
        <span class="cuadre-sii-acciones"><button class="btn btn-ghost btn-sm" type="button" data-cuadre-accion="reabrir" data-id="${x.id}">Deshacer</button></span></div>`).join('')}
    </details>`);
  }
  if (!partes.length && !d.ventas.some(x => x.cuadre_estado === 'pendiente') && !d.compras.some(x => x.cuadre_estado === 'pendiente')) {
    partes.push('<p class="modal-hint">✔ Todo cuadrado este mes.</p>');
  }
  return partes.join('');
}

function cuadreSiiUltimoReajuste(canal) {
  const r = cuadreSiiDatos?.ultimo_reajuste || {};
  if (canal) return r[canal] || null;
  return [r.BANCO, r.EFECTIVO].filter(Boolean).sort().pop() || null;
}
const cuadreSiiDoc = (id) => [...(cuadreSiiDatos?.ventas || []), ...(cuadreSiiDatos?.compras || [])].find(x => x.id === Number(id));

async function cuadreSiiClicPanel(e) {
  const b = e.target.closest('[data-cuadre-accion]');
  if (!b) return;
  const accion = b.dataset.cuadreAccion;
  const doc = b.dataset.id ? cuadreSiiDoc(b.dataset.id) : null;
  try {
    if (accion === 'confirmar') return await cuadreSiiConfirmar(b);
    if (accion === 'registrar' && doc) return cuadreSiiRegistrarVenta(doc);
    if (accion === 'asociar' && doc) return cuadreSiiAbrirAsociar(doc);
    if (accion === 'ignorar' && doc) return await cuadreSiiIgnorar(doc);
    if (accion === 'gasto' && doc) return cuadreSiiAbrirGasto([doc]);
    if (accion === 'gasto-grupo') {
      const marcadas = [...document.querySelectorAll('.cuadre-sii-factura:checked')].map(i => cuadreSiiDoc(i.dataset.id))
        .filter(x => x && x.rut === b.dataset.rut && x.fecha_doc === b.dataset.fecha);
      if (!marcadas.length) { showToast('Marca al menos una factura', 'err'); return; }
      return cuadreSiiAbrirGasto(marcadas);
    }
    if (accion === 'marcar-factura' && doc) {
      const r = await API.balance.cuadreSiiMarcarFactura(doc.id);
      showToast(`Gasto con factura: ${fmtCLP(r.iva_credito)} de IVA crédito`, 'ok');
      return cargarCuadreSii();
    }
    if (accion === 'reabrir' && doc) {
      await API.balance.cuadreSiiReabrir(doc.id);
      showToast('Quedó pendiente otra vez', 'ok');
      cargarCuadreSii(); actualizarAvisoCuadreSii();
      return;
    }
    if (accion === 'sin-boleta') {
      if (!await ventanaConfirmar('La venta queda "sin boleta" y se borra el N° anotado, si tenía.', { titulo: '¿Esta venta fue sin boleta?', textoSi: 'Sí, fue sin boleta' })) return;
      await API.ventas.guardarFolio(Number(b.dataset.venta), { dte_folio: '', tipo_dte: 'SIN DTE' });
      showToast('Venta marcada sin boleta', 'ok');
      return cargarCuadreSii();
    }
  } catch (err) {
    showToast(err.message || 'No se pudo', 'err');
  }
}

async function cuadreSiiConfirmar(boton) {
  const propuestas = [...document.querySelectorAll('.cuadre-sii-marca:checked')]
    .flatMap(i => { try { return JSON.parse(i.dataset.propuesta); } catch (_) { return []; } });
  if (!propuestas.length) { showToast('No marcaste ninguna', 'err'); return; }
  boton.disabled = true;
  try {
    const r = await API.balance.cuadreSiiConfirmar({ periodo: cuadreSiiDatos.periodo, propuestas });
    showToast(`${r.aplicadas} cuadrada(s)${r.omitidas ? ` · ${r.omitidas} ya no calzaban y quedaron como estaban` : ''}`, 'ok');
    await cargarCuadreSii();
    actualizarAvisoCuadreSii();
    if (typeof cargarHistorial === 'function') cargarHistorial();
  } finally {
    boton.disabled = false;
  }
}

/* ------------------------------------------------------------
   Modal: asociar a mano, crear gasto
   ------------------------------------------------------------ */
function cuadreSiiAbrirModal(titulo, cuerpo, textoOk, accion) {
  document.getElementById('cuadreSiiModalTitulo').textContent = titulo;
  document.getElementById('cuadreSiiModalCuerpo').innerHTML = cuerpo;
  const ok = document.getElementById('btnCuadreSiiModalOk');
  ok.textContent = textoOk;
  ok.disabled = false;
  cuadreSiiModalAccion = accion;
  document.getElementById('modalCuadreSii')?.classList.add('show');
}

function cuadreSiiAbrirAsociar(doc) {
  const esVenta = doc.operacion === 'VENTA';
  const opciones = (doc.sugerencias || []).map((s, i) => `
    <label class="cuadre-sii-fila cuadre-sii-propuesta">
      <input type="radio" name="cuadreSiiDestino" value="${s.id}" ${i === 0 && !s.tomado ? 'checked' : ''}>
      <span class="cuadre-sii-texto"><small>${escHtml(esVenta ? cuadreSiiTextoVenta(s) : cuadreSiiTextoGasto(s))}${s.tomado ? ' · ya tiene otra factura' : ''}</small></span>
    </label>`).join('');
  const cuerpo = `<p class="modal-hint"><b>${escHtml(cuadreSiiTextoDoc(doc))}</b></p>
    ${opciones ? `<p class="modal-hint">${esVenta ? 'Ventas del mismo monto esos días' : 'Gastos de esos días (primero los de monto parecido)'}:</p>${opciones}` : `<p class="modal-hint">No hay ${esVenta ? 'ventas del mismo monto' : 'gastos'} cerca de esa fecha.</p>`}
    <div class="field" style="margin-top:10px;">
      <label for="cuadreSiiDestinoManual">${esVenta ? 'O escribe el N° de orden de la venta' : 'O escribe el N° del gasto (#)'}</label>
      <input type="number" id="cuadreSiiDestinoManual" min="1" step="1" placeholder="${esVenta ? 'Ej: 151' : 'Ej: 41'}">
    </div>`;
  cuadreSiiAbrirModal(esVenta ? '🔗 ¿De qué venta es esta boleta?' : '🔗 ¿En qué gasto está esta factura?', cuerpo, 'Asociar', async () => {
    const manual = parseInt(document.getElementById('cuadreSiiDestinoManual')?.value, 10);
    const elegido = parseInt(document.querySelector('input[name="cuadreSiiDestino"]:checked')?.value, 10);
    if (!manual && !elegido) { showToast('Elige una o escribe el número', 'err'); return; }
    const datos = esVenta ? (manual ? { numero_orden: manual } : { venta_id: elegido }) : { compra_id: manual || elegido };
    try {
      document.getElementById('btnCuadreSiiModalOk').disabled = true;
      const r = await API.balance.cuadreSiiAsociar(doc.id, datos);
      cerrarModal('modalCuadreSii');
      showToast(r.aviso || 'Asociada', r.aviso ? 'err' : 'ok');
      cargarCuadreSii(); actualizarAvisoCuadreSii();
    } catch (err) {
      showToast(err.message || 'No se pudo asociar', 'err');
      document.getElementById('btnCuadreSiiModalOk').disabled = false;
    }
  });
}

async function cuadreSiiAbrirGasto(docs) {
  const total = docs.reduce((s, x) => s + num(x.total), 0);
  const iva = docs.reduce((s, x) => s + num(x.iva), 0);
  const fecha = docs.map(x => x.fecha_doc).sort()[0];
  const reaj = cuadreSiiUltimoReajuste('BANCO');
  const antes = reaj && fecha <= reaj;
  let clasificaciones = [];
  try { clasificaciones = (await API.compras.listarClasificaciones()) || []; } catch (_) { /* se escribe a mano */ }
  const sugerida = docs[0].clasificacion_sugerida;
  const opciones = (Array.isArray(clasificaciones) ? clasificaciones : clasificaciones.clasificaciones || [])
    .map(c => c.nombre || c).filter(Boolean)
    .map(n => `<option value="${escHtml(n)}"${n === sugerida ? ' selected' : ''}>${escHtml(n)}</option>`).join('');
  const cuerpo = `
    <p class="modal-hint">${docs.map(x => escHtml(cuadreSiiTextoDoc(x))).join('<br>')}</p>
    <p class="modal-hint">Total <b>${fmtCLP(total)}</b> · IVA crédito <b>${fmtCLP(iva)}</b> · fecha ${escHtml(fechaCortaAviso(fecha))}</p>
    <div class="field"><label for="cuadreSiiGastoProveedor">Proveedor</label>
      <input type="text" id="cuadreSiiGastoProveedor" maxlength="120" value="${escHtml(docs[0].razon_social || docs[0].rut)}"></div>
    <div class="field"><label for="cuadreSiiGastoClasif">Clasificación</label>
      <select id="cuadreSiiGastoClasif">${opciones || `<option>${escHtml(sugerida)}</option>`}</select></div>
    <div class="field"><label for="cuadreSiiGastoMetodo">¿Con qué se pagó?</label>
      <select id="cuadreSiiGastoMetodo">
        <option value="Transferencia">Transferencia · banco</option>
        <option value="Tarjeta Débito">Tarjeta Débito · banco</option>
        <option value="Tarjeta Crédito">Tarjeta Crédito · banco</option>
        <option value="Mercado Pago">Mercado Pago</option>
        <option value="Efectivo">Efectivo</option>
      </select></div>
    <div class="field"><label for="cuadreSiiGastoDesc">¿Qué se compró? (opcional)</label>
      <input type="text" id="cuadreSiiGastoDesc" maxlength="200" placeholder="Ej: 3 monitores para vender"></div>
    <label class="cuadre-sii-check">
      <input type="checkbox" id="cuadreSiiGastoSaldo" ${antes ? '' : 'checked'}>
      <span><b>Descontarlo del saldo de Finanzas</b><br>
      <small>${antes
        ? `Es de antes de tu último reajuste del saldo (${escHtml(fechaCortaAviso(reaj))}): ese pago ya quedó descontado ahí. Déjalo <b>sin marcar</b> para no descontarlo dos veces.`
        : 'El pago no estaba anotado, así que el saldo de Finanzas lo tiene de más. Márcalo para que baje.'}</small></span>
    </label>`;
  cuadreSiiAbrirModal(docs.length > 1 ? `💸 Un gasto con ${docs.length} facturas` : '💸 Crear el gasto de esta factura', cuerpo, 'Crear el gasto', async () => {
    try {
      document.getElementById('btnCuadreSiiModalOk').disabled = true;
      const r = await API.balance.cuadreSiiCrearGasto({
        ids: docs.map(x => x.id),
        proveedor: document.getElementById('cuadreSiiGastoProveedor')?.value || '',
        clasificacion: document.getElementById('cuadreSiiGastoClasif')?.value || sugerida,
        metodo_pago: document.getElementById('cuadreSiiGastoMetodo')?.value || 'Transferencia',
        descripcion: document.getElementById('cuadreSiiGastoDesc')?.value || '',
        afecta_saldo: !!document.getElementById('cuadreSiiGastoSaldo')?.checked,
      });
      cerrarModal('modalCuadreSii');
      showToast(`Gasto #${r.compra_id} creado: ${fmtCLP(r.total)} con ${fmtCLP(r.iva)} de IVA`, 'ok');
      cargarCuadreSii(); actualizarAvisoCuadreSii();
      if (typeof cargarCompras === 'function') cargarCompras();
    } catch (err) {
      showToast(err.message || 'No se pudo crear el gasto', 'err');
      document.getElementById('btnCuadreSiiModalOk').disabled = false;
    }
  });
}

async function cuadreSiiIgnorar(doc) {
  const nota = await ventanaPreguntar(`${cuadreSiiTextoDoc(doc)}\n\nQueda anotado para que no vuelva a salir.`, {
    titulo: '¿Por qué no corresponde?', placeholder: doc.operacion === 'VENTA' ? 'Ej: boleta emitida por error' : 'Ej: compra personal', maximo: 300,
  });
  if (!nota || !nota.trim()) return;
  await API.balance.cuadreSiiIgnorar(doc.id, nota.trim());
  showToast('Anotado: no corresponde', 'ok');
  cargarCuadreSii(); actualizarAvisoCuadreSii();
}

async function cuadreSiiSubirCsv(e) {
  const archivo = e.target.files && e.target.files[0];
  e.target.value = '';
  if (!archivo) return;
  const periodo = cuadreSiiPeriodoElegido();
  if (!periodo) { showToast('Elige primero el mes', 'err'); return; }
  try {
    // El SII entrega el CSV en Latin-1: se lee así y, si no trae el encabezado, en UTF-8
    const buffer = await archivo.arrayBuffer();
    let texto = new TextDecoder('iso-8859-1').decode(buffer);
    if (!/folio/i.test(texto.slice(0, 500))) texto = new TextDecoder('utf-8').decode(buffer);
    if (!/rut receptor|tipo venta|monto total/i.test(texto.slice(0, 500)) && /rut proveedor/i.test(texto.slice(0, 500))) {
      showToast('Ese es el CSV de COMPRAS. Aquí va el de VENTAS (las compras las baja el robot)', 'err');
      return;
    }
    const r = await API.balance.cuadreSiiVentasCsv({ periodo, csv: texto });
    showToast(`${r.documentos} boleta(s) de ${cuadreSiiMesTexto(periodo)} cargadas`, 'ok');
    await cargarCuadreSii();
    actualizarAvisoCuadreSii();
  } catch (err) {
    showToast(err.message || 'No se pudo leer el CSV', 'err');
  }
}

/* ------------------------------------------------------------
   Registrar en la caja una venta que tiene boleta y no se anotó
   ------------------------------------------------------------ */
function cuadreSiiRegistrarVenta(doc) {
  const reaj = cuadreSiiUltimoReajuste();
  cuadreSiiVentaEnCurso = {
    doc_id: doc.id, folio: doc.folio, fecha: doc.fecha_doc, total: num(doc.total), tipo: doc.tipo_doc,
    antes_del_reajuste: reaj && doc.fecha_doc <= reaj ? reaj : null,
  };
  try { sessionStorage.setItem(CUADRE_SII_CLAVE_VENTA, JSON.stringify(cuadreSiiVentaEnCurso)); } catch (_) { /* sin sessionStorage */ }
  activarVista('view-pos');
  const fecha = document.getElementById('posFecha');
  if (fecha) fecha.value = doc.fecha_doc;
  cuadreSiiPintarBanner();
  showToast(`Agrega lo que se vendió por ${fmtCLP(doc.total)} y cobra como siempre`, 'ok');
}

/* Lo consulta pos.js al cobrar: la venta atrasada no entra en la caja abierta de hoy */
function cuadreSiiVentaAtrasada() {
  return !!cuadreSiiVentaEnCurso;
}

function cuadreSiiPintarBanner() {
  const caja = document.getElementById('cuadreSiiBannerPos');
  if (!caja) return;
  const v = cuadreSiiVentaEnCurso;
  if (!v) { caja.hidden = true; caja.innerHTML = ''; return; }
  const fecha = document.getElementById('posFecha');
  if (fecha && fecha.value !== v.fecha) fecha.value = v.fecha;
  caja.innerHTML = `
    <div><b>🧾 Registrando la boleta N° ${escHtml(String(v.folio))}</b> del ${escHtml(fechaCortaAviso(v.fecha))} por <b>${fmtCLP(v.total)}</b>.
    Agrega lo que se vendió y cobra (elige Boleta). Queda con esa fecha, <b>fuera de la caja de hoy</b> y con el N° de boleta.
    Si el producto está en el catálogo, se descuenta del stock de hoy.</div>
    ${v.antes_del_reajuste ? `<div class="cuadre-sii-banner-ojo">Ojo: es de antes de tu último reajuste del saldo (${escHtml(fechaCortaAviso(v.antes_del_reajuste))}).
      Esa plata ya quedó dentro del saldo de Finanzas: después de registrarla, corrige el saldo con un Reajuste por ${fmtCLP(v.total)} menos.</div>` : ''}
    <button class="btn btn-ghost btn-sm" type="button" data-cuadre-cancelar>Cancelar</button>`;
  caja.hidden = false;
}

function cuadreSiiCancelarVenta(silencioso) {
  const habia = !!cuadreSiiVentaEnCurso;
  cuadreSiiVentaEnCurso = null;
  try { sessionStorage.removeItem(CUADRE_SII_CLAVE_VENTA); } catch (_) { /* nada */ }
  cuadreSiiPintarBanner();
  const fecha = document.getElementById('posFecha');
  if (habia && fecha) fecha.value = todayISO();
  if (habia && !silencioso) showToast('Listo: la caja vuelve a la fecha de hoy', 'ok');
}

/* pos.js avisa cada venta registrada: si era la de la boleta, se le anota el N° */
document.addEventListener('pos:venta-registrada', (e) => {
  const v = cuadreSiiVentaEnCurso;
  const venta = e.detail;
  if (!v || !venta?.id) return;
  /* Para que la ventana "Venta registrada" ya muestre el N° de boleta */
  venta.dte_folio = String(v.folio);
  if (!venta.tipo_dte || venta.tipo_dte === 'SIN DTE') venta.tipo_dte = Number(v.tipo) === 33 ? 'FACTURA' : 'BOLETA';
  cuadreSiiVentaEnCurso = null;
  try { sessionStorage.removeItem(CUADRE_SII_CLAVE_VENTA); } catch (_) { /* nada */ }
  cuadreSiiPintarBanner();
  const fecha = document.getElementById('posFecha');
  if (fecha) fecha.value = todayISO();
  API.balance.cuadreSiiAsociar(v.doc_id, { venta_id: venta.id })
    .then(r => {
      showToast(r?.aviso || `Boleta N° ${v.folio} asociada a la venta ${cuadreSiiOrden(venta)}`, r?.aviso ? 'err' : 'ok');
      actualizarAvisoCuadreSii();
      if (document.querySelector('[data-panel-finanzas="sii"].activo')) cargarCuadreSii();
    })
    .catch(err => showToast(`La venta quedó registrada, pero no se pudo asociar la boleta: ${err.message || err}. Asóciala desde Cuadrar con el SII.`, 'err'));
});
